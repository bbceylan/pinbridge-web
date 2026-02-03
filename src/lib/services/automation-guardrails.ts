import type { BatchProcessingOptions } from './batch-processing-engine';

export type SubscriptionTier = 'free' | 'premium';

export interface AutomationGuardrails {
  maxPlacesPerSession: number;
  maxConcurrency: number;
  maxBatchSize: number;
  maxRetryAttempts: number;
  pauseOnError: boolean;
  dailyCap: number;
  perMinuteCap: number;
}

const GUARDRAILS: Record<SubscriptionTier, AutomationGuardrails> = {
  free: {
    maxPlacesPerSession: 10,
    maxConcurrency: 5,
    maxBatchSize: 10,
    maxRetryAttempts: 1,
    pauseOnError: true,
    dailyCap: 1,
    perMinuteCap: 1,
  },
  premium: {
    maxPlacesPerSession: 100,
    maxConcurrency: 3,
    maxBatchSize: 10,
    maxRetryAttempts: 3,
    pauseOnError: false,
    dailyCap: 10,
    perMinuteCap: 10,
  },
};

export function getAutomationGuardrails(tier: SubscriptionTier): AutomationGuardrails {
  return GUARDRAILS[tier];
}

export function applyAutomationGuardrails(
  options: BatchProcessingOptions,
  guardrails: AutomationGuardrails
): Required<BatchProcessingOptions> {
  return {
    concurrency: Math.min(options.concurrency ?? guardrails.maxConcurrency, guardrails.maxConcurrency),
    batchSize: Math.min(options.batchSize ?? guardrails.maxBatchSize, guardrails.maxBatchSize),
    retryAttempts: Math.min(options.retryAttempts ?? guardrails.maxRetryAttempts, guardrails.maxRetryAttempts),
    retryDelay: options.retryDelay ?? 1000,
    pauseOnError: options.pauseOnError ?? guardrails.pauseOnError,
    estimateProcessingTime: options.estimateProcessingTime ?? true,
  };
}
