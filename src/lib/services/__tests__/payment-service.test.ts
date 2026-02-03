/**
 * @jest-environment jsdom
 */

import { paymentService } from '../payment-service';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock fetch
global.fetch = jest.fn();

// Mock environment variables
process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_123456789';
const setNodeEnv = (value: string) => {
  Object.defineProperty(process.env, 'NODE_ENV', {
    value,
    configurable: true,
  });
};
setNodeEnv('development');

describe('PaymentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    (fetch as jest.Mock).mockClear();
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ sessionId: 'sess_test_123', url: 'https://stripe.test/session' }),
    });
  });

  describe('getPlans', () => {
    it('should return available subscription plans', () => {
      const plans = paymentService.getPlans();
      
      expect(plans).toHaveLength(3);
      expect(plans[0].id).toBe('monthly');
      expect(plans[1].id).toBe('yearly');
      expect(plans[2].id).toBe('lifetime');
    });

    it('should include correct plan details', () => {
      const plans = paymentService.getPlans();
      const yearlyPlan = plans.find(p => p.id === 'yearly');
      
      expect(yearlyPlan).toBeDefined();
      expect(yearlyPlan!.price).toBe(39.99);
      expect(yearlyPlan!.interval).toBe('year');
      expect(yearlyPlan!.popular).toBe(true);
      expect(yearlyPlan!.savings).toBe('33% off');
    });
  });

  describe('getPlan', () => {
    it('should return specific plan by ID', () => {
      const plan = paymentService.getPlan('monthly');
      
      expect(plan).toBeDefined();
      expect(plan!.id).toBe('monthly');
      expect(plan!.price).toBe(4.99);
    });

    it('should return undefined for invalid plan ID', () => {
      const plan = paymentService.getPlan('invalid');
      expect(plan).toBeUndefined();
    });
  });

  describe('createCheckoutSession', () => {
    it('should return error for invalid plan', async () => {
      const result = await paymentService.createCheckoutSession('invalid');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid plan selected');
    });

    it('should simulate successful checkout in development', async () => {
      // Mock the plan to have a stripePriceId
      const originalGetPlan = paymentService.getPlan;
      paymentService.getPlan = jest.fn().mockReturnValue({
        id: 'yearly',
        name: 'Yearly',
        price: 39.99,
        currency: 'USD',
        interval: 'year',
        stripePriceId: 'price_test_123',
        features: ['Ad-free experience'],
      });

      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
      const result = await paymentService.createCheckoutSession('yearly');
      
      expect(result.success).toBe(true);
      expect(result.subscriptionId).toContain('demo_');

      // Restore original method
      paymentService.getPlan = originalGetPlan;
    });

    it('should handle fetch errors gracefully', async () => {
      setNodeEnv('production');
      
      // Mock the plan to have a stripePriceId
      const originalGetPlan = paymentService.getPlan;
      paymentService.getPlan = jest.fn().mockReturnValue({
        id: 'yearly',
        name: 'Yearly',
        price: 39.99,
        currency: 'USD',
        interval: 'year',
        stripePriceId: 'price_test_123',
        features: ['Ad-free experience'],
      });

      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
      
      const result = await paymentService.createCheckoutSession('yearly');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
      
      setNodeEnv('development');
      paymentService.getPlan = originalGetPlan;
    });

    it('should handle API errors', async () => {
      setNodeEnv('production');
      
      // Mock the plan to have a stripePriceId
      const originalGetPlan = paymentService.getPlan;
      paymentService.getPlan = jest.fn().mockReturnValue({
        id: 'yearly',
        name: 'Yearly',
        price: 39.99,
        currency: 'USD',
        interval: 'year',
        stripePriceId: 'price_test_123',
        features: ['Ad-free experience'],
      });

      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
      });
      
      const result = await paymentService.createCheckoutSession('yearly');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to create checkout session');
      
      setNodeEnv('development');
      paymentService.getPlan = originalGetPlan;
    });
  });

  describe('getSubscriptionStatus', () => {
    it('should return inactive status when no premium data', () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      const status = paymentService.getSubscriptionStatus();
      
      expect(status.isActive).toBe(false);
      expect(status.plan).toBeUndefined();
    });

    it('should return active status for valid subscription', () => {
      const subscriptionData = {
        planId: 'yearly',
        isActive: true,
        startDate: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      };

      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'pinbridge_premium') return 'true';
        if (key === 'pinbridge_subscription') return JSON.stringify(subscriptionData);
        return null;
      });
      
      const status = paymentService.getSubscriptionStatus();
      
      expect(status.isActive).toBe(true);
      expect(status.plan).toBeDefined();
      expect(status.plan!.id).toBe('yearly');
      expect(status.expiresAt).toBeInstanceOf(Date);
    });

    it('should return inactive status for expired subscription', () => {
      const subscriptionData = {
        planId: 'yearly',
        isActive: true,
        startDate: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString(),
        expiresAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // Expired 10 days ago
      };

      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'pinbridge_premium') return 'true';
        if (key === 'pinbridge_subscription') return JSON.stringify(subscriptionData);
        return null;
      });
      
      const status = paymentService.getSubscriptionStatus();
      
      expect(status.isActive).toBe(false);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('pinbridge_premium');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('pinbridge_subscription');
    });

    it('should handle lifetime subscriptions', () => {
      const subscriptionData = {
        planId: 'lifetime',
        isActive: true,
        startDate: new Date().toISOString(),
        expiresAt: null, // Lifetime has no expiration
      };

      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'pinbridge_premium') return 'true';
        if (key === 'pinbridge_subscription') return JSON.stringify(subscriptionData);
        return null;
      });
      
      const status = paymentService.getSubscriptionStatus();
      
      expect(status.isActive).toBe(true);
      expect(status.plan!.id).toBe('lifetime');
      expect(status.expiresAt).toBeUndefined();
    });

    it('should handle malformed subscription data', () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'pinbridge_premium') return 'true';
        if (key === 'pinbridge_subscription') return 'invalid json';
        return null;
      });
      
      const status = paymentService.getSubscriptionStatus();
      
      expect(status.isActive).toBe(false);
    });
  });

  describe('cancelSubscription', () => {
    it('should simulate successful cancellation in development', async () => {
      const result = await paymentService.cancelSubscription();
      
      expect(result).toBe(true);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('pinbridge_premium');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('pinbridge_subscription');
    });

    it('should handle API errors in production', async () => {
      setNodeEnv('production');
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
      
      const result = await paymentService.cancelSubscription();
      
      expect(result).toBe(false);
      
      setNodeEnv('development');
    });

    it('should handle API failure response', async () => {
      setNodeEnv('production');
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
      });
      
      const result = await paymentService.cancelSubscription();
      
      expect(result).toBe(false);
      
      setNodeEnv('development');
    });
  });

  describe('isPremiumUser', () => {
    it('should return true for active subscription', () => {
      const subscriptionData = {
        planId: 'yearly',
        isActive: true,
        startDate: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      };

      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'pinbridge_premium') return 'true';
        if (key === 'pinbridge_subscription') return JSON.stringify(subscriptionData);
        return null;
      });
      
      expect(paymentService.isPremiumUser()).toBe(true);
    });

    it('should return false for inactive subscription', () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      expect(paymentService.isPremiumUser()).toBe(false);
    });
  });

  describe('getCustomerPortalUrl', () => {
    it('should return null on API error', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
      
      const url = await paymentService.getCustomerPortalUrl();
      
      expect(url).toBeNull();
    });

    it('should return portal URL on success', async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ url: 'https://billing.stripe.com/session/123' }),
      });
      
      const url = await paymentService.getCustomerPortalUrl();
      
      expect(url).toBe('https://billing.stripe.com/session/123');
    });
  });

  describe('handlePaymentSuccess', () => {
    it('should log successful payment', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      paymentService.handlePaymentSuccess('cs_test_123');
      
      expect(consoleSpy).toHaveBeenCalledWith('Payment successful:', 'cs_test_123');
      
      consoleSpy.mockRestore();
    });
  });

  describe('event dispatching', () => {
    it('should dispatch subscription-updated event on successful upgrade', async () => {
      const dispatchEventSpy = jest.spyOn(window, 'dispatchEvent');
      const originalGetPlan = paymentService.getPlan;

      paymentService.getPlan = jest.fn().mockReturnValue({
        id: 'yearly',
        name: 'Yearly',
        price: 39.99,
        currency: 'USD',
        interval: 'year',
        stripePriceId: 'price_test_123',
        features: ['Ad-free experience'],
      });
      
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
      await paymentService.createCheckoutSession('yearly');
      
      expect(dispatchEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'subscription-updated',
        })
      );
      
      paymentService.getPlan = originalGetPlan;
      dispatchEventSpy.mockRestore();
    });

    it('should dispatch subscription-updated event on cancellation', async () => {
      const dispatchEventSpy = jest.spyOn(window, 'dispatchEvent');
      
      await paymentService.cancelSubscription();
      
      expect(dispatchEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'subscription-updated',
        })
      );
      
      dispatchEventSpy.mockRestore();
    });
  });
});
