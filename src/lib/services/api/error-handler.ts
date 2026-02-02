/**
 * Centralized error handling and retry logic for API calls
 */

import type { APIError, APIResponse } from './types';

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffFactor: number;
  jitter: boolean;
}

export class APIErrorHandler {
  private readonly defaultRetryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffFactor: 2,
    jitter: true,
  };

  async executeWithRetry<T>(
    operation: () => Promise<APIResponse<T>>,
    config?: Partial<RetryConfig>
  ): Promise<APIResponse<T>> {
    const retryConfig = { ...this.defaultRetryConfig, ...config };
    let lastError: APIError | undefined;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        const result = await operation();
        
        if (result.success) {
          return result;
        }

        // Check if error is retryable
        if (result.error && !this.isRetryableError(result.error)) {
          return result;
        }

        lastError = result.error;

        // Don't wait after the last attempt
        if (attempt < retryConfig.maxRetries) {
          const delay = this.calculateDelay(attempt, retryConfig);
          await this.sleep(delay);
        }
      } catch (error) {
        lastError = this.createAPIError(error);
        
        if (!this.isRetryableError(lastError)) {
          break;
        }

        if (attempt < retryConfig.maxRetries) {
          const delay = this.calculateDelay(attempt, retryConfig);
          await this.sleep(delay);
        }
      }
    }

    return {
      success: false,
      error: lastError || this.createAPIError(new Error('Unknown error')),
    };
  }

  private isRetryableError(error: APIError): boolean {
    // Retry on network errors, timeouts, and server errors
    const retryableCodes = [
      'NETWORK_ERROR',
      'TIMEOUT',
      'RATE_LIMITED',
      'SERVER_ERROR',
      'SERVICE_UNAVAILABLE',
    ];

    return retryableCodes.includes(error.code) || 
           (error.code.startsWith('HTTP_') && parseInt(error.code.split('_')[1]) >= 500);
  }

  private calculateDelay(attempt: number, config: RetryConfig): number {
    let delay = config.baseDelay * Math.pow(config.backoffFactor, attempt);
    delay = Math.min(delay, config.maxDelay);

    if (config.jitter) {
      // Add random jitter to prevent thundering herd
      delay = delay * (0.5 + Math.random() * 0.5);
    }

    return Math.floor(delay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  createAPIError(error: any): APIError {
    if (error instanceof Error) {
      return {
        code: this.getErrorCode(error),
        message: error.message,
        details: error,
      };
    }

    if (typeof error === 'object' && error.code && error.message) {
      return error as APIError;
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: String(error),
      details: error,
    };
  }

  private getErrorCode(error: Error): string {
    // Map common error types to codes
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return 'NETWORK_ERROR';
    }
    
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      return 'TIMEOUT';
    }

    if (error.message.includes('rate limit')) {
      return 'RATE_LIMITED';
    }

    return 'UNKNOWN_ERROR';
  }

  handleHTTPError(status: number, statusText: string, body?: any): APIError {
    let code = `HTTP_${status}`;
    let message = statusText;

    switch (status) {
      case 400:
        code = 'BAD_REQUEST';
        message = 'Invalid request parameters';
        break;
      case 401:
        code = 'UNAUTHORIZED';
        message = 'Invalid API key or authentication failed';
        break;
      case 403:
        code = 'FORBIDDEN';
        message = 'Access denied or quota exceeded';
        break;
      case 404:
        code = 'NOT_FOUND';
        message = 'Resource not found';
        break;
      case 429:
        code = 'RATE_LIMITED';
        message = 'Rate limit exceeded';
        break;
      case 500:
        code = 'SERVER_ERROR';
        message = 'Internal server error';
        break;
      case 503:
        code = 'SERVICE_UNAVAILABLE';
        message = 'Service temporarily unavailable';
        break;
    }

    return {
      code,
      message,
      details: { status, statusText, body },
      retryAfter: this.extractRetryAfter(body),
    };
  }

  private extractRetryAfter(body: any): number | undefined {
    if (typeof body === 'object' && body.retryAfter) {
      return parseInt(body.retryAfter);
    }
    return undefined;
  }
}