import { paymentService } from './payment-service';
import type { SubscriptionTier } from './automation-guardrails';
import type { TransferTarget } from '@/types';

export interface AutomationAccessStatus {
  tier: SubscriptionTier;
  apiConfigured: boolean;
  canUseAutomation: boolean;
  reason?: 'premium' | 'api';
}

export async function getAutomationAccess(target?: TransferTarget): Promise<AutomationAccessStatus> {
  const isPremium = paymentService.isPremiumUser();
  const tier: SubscriptionTier = isPremium ? 'premium' : 'free';

  if (!isPremium) {
    return { tier, apiConfigured: false, canUseAutomation: false, reason: 'premium' };
  }

  try {
    const response = await fetch('/api/maps/status', { cache: 'no-store' });
    if (!response.ok) {
      return { tier, apiConfigured: false, canUseAutomation: false, reason: 'api' };
    }

    const data = (await response.json()) as {
      apple: { configured: boolean };
      google: { configured: boolean };
    };

    const apiConfigured = target
      ? target === 'apple'
        ? data.apple.configured
        : data.google.configured
      : data.apple.configured || data.google.configured;

    return {
      tier,
      apiConfigured,
      canUseAutomation: apiConfigured,
      reason: apiConfigured ? undefined : 'api',
    };
  } catch {
    return { tier, apiConfigured: false, canUseAutomation: false, reason: 'api' };
  }
}
