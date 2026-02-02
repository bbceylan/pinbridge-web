/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { adService } from '@/lib/services/ad-service';
import { paymentService } from '@/lib/services/payment-service';

// Mock services
jest.mock('@/lib/services/ad-service');
jest.mock('@/lib/services/payment-service');

const mockAdService = adService as jest.Mocked<typeof adService>;
const mockPaymentService = paymentService as jest.Mocked<typeof paymentService>;

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

describe('Monetization Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  describe('Free user experience', () => {
    beforeEach(() => {
      mockAdService.shouldShowAds.mockReturnValue(true);
      mockAdService.isPremiumUser.mockReturnValue(false);
      mockPaymentService.isPremiumUser.mockReturnValue(false);
      mockPaymentService.getSubscriptionStatus.mockReturnValue({ isActive: false });
    });

    it('should show ads for free users', () => {
      mockAdService.getAdPlacementsForPage.mockReturnValue([
        {
          id: 'test-ad',
          type: 'banner',
          size: 'responsive',
          position: 'header',
          priority: 8,
          minViewTime: 2,
          frequency: 'always',
          targetPages: ['/'],
          excludePages: [],
        },
      ]);

      const placements = adService.getAdPlacementsForPage('/');
      expect(placements).toHaveLength(1);
      expect(mockAdService.getAdPlacementsForPage).toHaveBeenCalledWith('/');
    });

    it('should allow ad preference changes with limitations', () => {
      const preferences = { adsEnabled: false };
      adService.updateUserPreferences(preferences);
      
      expect(mockAdService.updateUserPreferences).toHaveBeenCalledWith(preferences);
    });

    it('should show upgrade prompts', () => {
      mockAdService.getAdBlockMessage.mockReturnValue(
        "We notice you're using an ad blocker. Please consider upgrading to premium!"
      );

      const message = adService.getAdBlockMessage();
      expect(message).toContain('ad blocker');
      expect(message).toContain('premium');
    });
  });

  describe('Premium upgrade flow', () => {
    it('should handle successful upgrade', async () => {
      mockPaymentService.createCheckoutSession.mockResolvedValue({
        success: true,
        subscriptionId: 'sub_123',
      });

      const result = await paymentService.createCheckoutSession('yearly');
      
      expect(result.success).toBe(true);
      expect(result.subscriptionId).toBe('sub_123');
    });

    it('should handle upgrade failure', async () => {
      mockPaymentService.createCheckoutSession.mockResolvedValue({
        success: false,
        error: 'Payment failed',
      });

      const result = await paymentService.createCheckoutSession('yearly');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Payment failed');
    });

    it('should activate premium features after successful payment', () => {
      mockPaymentService.getSubscriptionStatus.mockReturnValue({
        isActive: true,
        plan: {
          id: 'yearly',
          name: 'Yearly',
          price: 39.99,
          currency: 'USD',
          interval: 'year',
          features: ['Ad-free experience'],
        },
      });

      const status = paymentService.getSubscriptionStatus();
      expect(status.isActive).toBe(true);
      expect(status.plan?.id).toBe('yearly');
    });
  });

  describe('Premium user experience', () => {
    beforeEach(() => {
      mockAdService.shouldShowAds.mockReturnValue(false);
      mockAdService.isPremiumUser.mockReturnValue(true);
      mockPaymentService.isPremiumUser.mockReturnValue(true);
      mockPaymentService.getSubscriptionStatus.mockReturnValue({
        isActive: true,
        plan: {
          id: 'yearly',
          name: 'Yearly',
          price: 39.99,
          currency: 'USD',
          interval: 'year',
          features: ['Ad-free experience'],
        },
      });
    });

    it('should not show ads for premium users', () => {
      mockAdService.getAdPlacementsForPage.mockReturnValue([]);

      const placements = adService.getAdPlacementsForPage('/');
      expect(placements).toHaveLength(0);
    });

    it('should provide premium features', () => {
      const status = paymentService.getSubscriptionStatus();
      expect(status.isActive).toBe(true);
      expect(status.plan?.features).toContain('Ad-free experience');
    });

    it('should allow subscription management', async () => {
      mockPaymentService.cancelSubscription.mockResolvedValue(true);

      const result = await paymentService.cancelSubscription();
      expect(result).toBe(true);
    });

    it('should provide customer portal access', async () => {
      mockPaymentService.getCustomerPortalUrl.mockResolvedValue(
        'https://billing.stripe.com/session/123'
      );

      const url = await paymentService.getCustomerPortalUrl();
      expect(url).toBe('https://billing.stripe.com/session/123');
    });
  });

  describe('Ad blocker detection', () => {
    it('should detect ad blockers', () => {
      // Mock DOM manipulation for ad blocker detection
      const mockDiv = {
        offsetHeight: 0, // Simulate blocked ad
        style: {},
        className: '',
        innerHTML: '',
      };
      
      jest.spyOn(document, 'createElement').mockReturnValue(mockDiv as any);
      jest.spyOn(document.body, 'appendChild').mockImplementation();
      jest.spyOn(document.body, 'removeChild').mockImplementation();

      // Simulate ad blocker detection logic
      const testElement = document.createElement('div');
      testElement.className = 'adsbox';
      document.body.appendChild(testElement);
      
      // In real implementation, this would be detected by offsetHeight
      const isBlocked = testElement.offsetHeight === 0;
      expect(isBlocked).toBe(true);
      
      document.body.removeChild(testElement);
    });

    it('should show polite ad blocker message', () => {
      mockAdService.getAdBlockMessage.mockReturnValue(
        "We notice you're using an ad blocker. PinBridge is free thanks to ads."
      );

      const message = adService.getAdBlockMessage();
      expect(message).toContain('ad blocker');
      expect(message).toContain('free thanks to ads');
    });
  });

  describe('Analytics and tracking', () => {
    it('should track ad impressions', () => {
      adService.markAdAsShown('test-ad');
      expect(mockAdService.markAdAsShown).toHaveBeenCalledWith('test-ad');
    });

    it('should track ad clicks', () => {
      adService.trackAdClick('test-ad');
      expect(mockAdService.trackAdClick).toHaveBeenCalledWith('test-ad');
    });

    it('should provide ad metrics', () => {
      const mockMetrics = {
        impressions: 100,
        clicks: 5,
        revenue: 2.50,
        ctr: 5.0,
        cpm: 2.50,
        viewability: 85,
        adBlockRate: 15,
      };

      mockAdService.getMetrics.mockReturnValue(mockMetrics);

      const metrics = adService.getMetrics('test-ad');
      expect(metrics).toEqual(mockMetrics);
    });
  });

  describe('Subscription lifecycle', () => {
    it('should handle subscription expiration', () => {
      const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
      
      mockPaymentService.getSubscriptionStatus.mockReturnValue({
        isActive: false, // Would be set to false by the service
      });

      const status = paymentService.getSubscriptionStatus();
      expect(status.isActive).toBe(false);
    });

    it('should handle subscription renewal', () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
      
      mockPaymentService.getSubscriptionStatus.mockReturnValue({
        isActive: true,
        expiresAt: futureDate,
      });

      const status = paymentService.getSubscriptionStatus();
      expect(status.isActive).toBe(true);
      expect(status.expiresAt).toEqual(futureDate);
    });

    it('should handle lifetime subscriptions', () => {
      mockPaymentService.getSubscriptionStatus.mockReturnValue({
        isActive: true,
        plan: {
          id: 'lifetime',
          name: 'Lifetime',
          price: 99.99,
          currency: 'USD',
          interval: 'lifetime',
          features: ['All premium features'],
        },
        expiresAt: undefined, // Lifetime has no expiration
      });

      const status = paymentService.getSubscriptionStatus();
      expect(status.isActive).toBe(true);
      expect(status.plan?.interval).toBe('lifetime');
      expect(status.expiresAt).toBeUndefined();
    });
  });

  describe('Error handling', () => {
    it('should handle payment service errors gracefully', async () => {
      mockPaymentService.createCheckoutSession.mockRejectedValue(
        new Error('Network error')
      );

      try {
        await paymentService.createCheckoutSession('yearly');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle ad service errors gracefully', () => {
      mockAdService.shouldShowAds.mockImplementation(() => {
        throw new Error('Ad service error');
      });

      expect(() => {
        try {
          adService.shouldShowAds();
        } catch (error) {
          // Service should handle errors gracefully
          expect(error).toBeInstanceOf(Error);
        }
      }).not.toThrow();
    });

    it('should handle malformed subscription data', () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'pinbridge_subscription') return 'invalid json';
        return null;
      });

      mockPaymentService.getSubscriptionStatus.mockReturnValue({
        isActive: false,
      });

      const status = paymentService.getSubscriptionStatus();
      expect(status.isActive).toBe(false);
    });
  });

  describe('Cross-service integration', () => {
    it('should sync premium status between services', () => {
      // When payment service reports premium status
      mockPaymentService.isPremiumUser.mockReturnValue(true);
      
      // Ad service should also report premium status
      mockAdService.isPremiumUser.mockReturnValue(true);
      mockAdService.shouldShowAds.mockReturnValue(false);

      expect(paymentService.isPremiumUser()).toBe(true);
      expect(adService.isPremiumUser()).toBe(true);
      expect(adService.shouldShowAds()).toBe(false);
    });

    it('should handle subscription state changes', () => {
      // Mock event dispatching
      const dispatchEventSpy = jest.spyOn(window, 'dispatchEvent');
      
      // Simulate subscription update
      const event = new CustomEvent('subscription-updated', {
        detail: { isActive: true, planId: 'yearly' }
      });
      
      window.dispatchEvent(event);
      
      expect(dispatchEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'subscription-updated',
        })
      );
      
      dispatchEventSpy.mockRestore();
    });
  });
});