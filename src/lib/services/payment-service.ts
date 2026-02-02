/**
 * Payment Service for PinBridge Premium Subscriptions
 * 
 * Handles Stripe integration, subscription management, and premium status.
 */

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'month' | 'year' | 'lifetime';
  stripePriceId?: string;
  features: string[];
  popular?: boolean;
  savings?: string;
}

export interface PaymentResult {
  success: boolean;
  subscriptionId?: string;
  error?: string;
  redirectUrl?: string;
}

export interface SubscriptionStatus {
  isActive: boolean;
  plan?: SubscriptionPlan;
  expiresAt?: Date;
  cancelAtPeriodEnd?: boolean;
  trialEndsAt?: Date;
}

const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'monthly',
    name: 'Monthly',
    price: 4.99,
    currency: 'USD',
    interval: 'month',
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID,
    features: [
      'Ad-free experience',
      'Unlimited transfers',
      'Priority processing',
      'Premium support',
    ],
  },
  {
    id: 'yearly',
    name: 'Yearly',
    price: 39.99,
    currency: 'USD',
    interval: 'year',
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_YEARLY_PRICE_ID,
    features: [
      'Ad-free experience',
      'Unlimited transfers',
      'Priority processing',
      'Premium support',
      'Advanced privacy controls',
      'Team features',
    ],
    popular: true,
    savings: '33% off',
  },
  {
    id: 'lifetime',
    name: 'Lifetime',
    price: 99.99,
    currency: 'USD',
    interval: 'lifetime',
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_LIFETIME_PRICE_ID,
    features: [
      'All premium features',
      'Lifetime access',
      'Future feature updates',
      'Priority support',
      'Early access to new features',
    ],
    savings: 'Best deal',
  },
];

class PaymentService {
  private stripe: any = null;
  private isInitialized = false;

  constructor() {
    this.initializeStripe();
  }

  /**
   * Initialize Stripe
   */
  private async initializeStripe(): Promise<void> {
    if (typeof window === 'undefined' || this.isInitialized) return;

    try {
      const { loadStripe } = await import('@stripe/stripe-js');
      this.stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize Stripe:', error);
    }
  }

  /**
   * Get available subscription plans
   */
  getPlans(): SubscriptionPlan[] {
    return SUBSCRIPTION_PLANS;
  }

  /**
   * Get a specific plan by ID
   */
  getPlan(planId: string): SubscriptionPlan | undefined {
    return SUBSCRIPTION_PLANS.find(plan => plan.id === planId);
  }

  /**
   * Create a checkout session for subscription
   */
  async createCheckoutSession(planId: string): Promise<PaymentResult> {
    const plan = this.getPlan(planId);
    if (!plan || !plan.stripePriceId) {
      return {
        success: false,
        error: 'Invalid plan selected',
      };
    }

    try {
      // In a real implementation, this would call your backend API
      // For demo purposes, we'll simulate the flow
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId: plan.stripePriceId,
          planId: plan.id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { sessionId, url } = await response.json();

      // Redirect to Stripe Checkout
      if (this.stripe && sessionId) {
        const { error } = await this.stripe.redirectToCheckout({ sessionId });
        if (error) {
          throw error;
        }
      } else if (url) {
        window.location.href = url;
      }

      return {
        success: true,
        redirectUrl: url,
      };
    } catch (error) {
      console.error('Checkout error:', error);
      
      // For demo purposes, simulate successful upgrade
      if (process.env.NODE_ENV === 'development') {
        this.simulateSuccessfulUpgrade(plan);
        return {
          success: true,
          subscriptionId: 'demo_' + Date.now(),
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment failed',
      };
    }
  }

  /**
   * Simulate successful upgrade for demo purposes
   */
  private simulateSuccessfulUpgrade(plan: SubscriptionPlan): void {
    const subscription = {
      planId: plan.id,
      isActive: true,
      startDate: new Date().toISOString(),
      expiresAt: plan.interval === 'lifetime' 
        ? null 
        : new Date(Date.now() + (plan.interval === 'month' ? 30 : 365) * 24 * 60 * 60 * 1000).toISOString(),
    };

    localStorage.setItem('pinbridge_premium', 'true');
    localStorage.setItem('pinbridge_subscription', JSON.stringify(subscription));

    // Trigger a custom event to notify other components
    window.dispatchEvent(new CustomEvent('subscription-updated', { detail: subscription }));
  }

  /**
   * Get current subscription status
   */
  getSubscriptionStatus(): SubscriptionStatus {
    if (typeof window === 'undefined') {
      return { isActive: false };
    }

    try {
      const isPremium = localStorage.getItem('pinbridge_premium') === 'true';
      const subscriptionData = localStorage.getItem('pinbridge_subscription');

      if (!isPremium || !subscriptionData) {
        return { isActive: false };
      }

      const subscription = JSON.parse(subscriptionData);
      const plan = this.getPlan(subscription.planId);

      // Check if subscription is still valid
      if (subscription.expiresAt && new Date(subscription.expiresAt) < new Date()) {
        // Subscription expired
        this.cancelSubscription();
        return { isActive: false };
      }

      return {
        isActive: true,
        plan,
        expiresAt: subscription.expiresAt ? new Date(subscription.expiresAt) : undefined,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd || false,
        trialEndsAt: subscription.trialEndsAt ? new Date(subscription.trialEndsAt) : undefined,
      };
    } catch (error) {
      console.error('Failed to get subscription status:', error);
      return { isActive: false };
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(): Promise<boolean> {
    try {
      // In a real implementation, this would call your backend API
      const response = await fetch('/api/cancel-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to cancel subscription');
      }

      // Clear local storage
      localStorage.removeItem('pinbridge_premium');
      localStorage.removeItem('pinbridge_subscription');

      // Trigger update event
      window.dispatchEvent(new CustomEvent('subscription-updated', { detail: null }));

      return true;
    } catch (error) {
      console.error('Cancel subscription error:', error);
      
      // For demo purposes, allow local cancellation
      if (process.env.NODE_ENV === 'development') {
        localStorage.removeItem('pinbridge_premium');
        localStorage.removeItem('pinbridge_subscription');
        window.dispatchEvent(new CustomEvent('subscription-updated', { detail: null }));
        return true;
      }

      return false;
    }
  }

  /**
   * Check if user has premium access
   */
  isPremiumUser(): boolean {
    return this.getSubscriptionStatus().isActive;
  }

  /**
   * Get customer portal URL for managing subscription
   */
  async getCustomerPortalUrl(): Promise<string | null> {
    try {
      const response = await fetch('/api/customer-portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get customer portal URL');
      }

      const { url } = await response.json();
      return url;
    } catch (error) {
      console.error('Customer portal error:', error);
      return null;
    }
  }

  /**
   * Handle successful payment (called from success page)
   */
  handlePaymentSuccess(sessionId: string): void {
    // In a real implementation, you'd verify the session with your backend
    console.log('Payment successful:', sessionId);
    
    // For demo purposes, we'll assume the subscription is already activated
    // The actual activation would happen via webhook from Stripe
  }

  /**
   * Track subscription events for analytics
   */
  private trackEvent(event: string, data?: Record<string, any>): void {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', event, {
        event_category: 'subscription',
        ...data,
      });
    }
  }
}

export const paymentService = new PaymentService();