/**
 * Unit tests for Apple Maps error handling
 */

import { AppleMapsErrorHandler } from '../apple-maps-errors';
import type { AppleMapsAPIError } from '../apple-maps-errors';

describe('AppleMapsErrorHandler', () => {
  describe('HTTP Error Handling', () => {
    it('should handle 400 Bad Request errors', () => {
      const error = AppleMapsErrorHandler.handleHTTPError(
        400,
        'Bad Request',
        { error: 'Invalid parameters' }
      );

      expect(error.code).toBe('APPLE_MAPS_400');
      expect(error.appleErrorType).toBe('INVALID_REQUEST');
      expect(error.message).toContain('Invalid request parameters');
      expect(error.details.suggestions).toContain('Verify search query is not empty');
    });

    it('should handle 401 Unauthorized errors', () => {
      const error = AppleMapsErrorHandler.handleHTTPError(
        401,
        'Unauthorized',
        { error: 'Invalid API key' }
      );

      expect(error.code).toBe('APPLE_MAPS_401');
      expect(error.appleErrorType).toBe('AUTHENTICATION');
      expect(error.message).toContain('Authentication failed');
      expect(error.details.suggestions).toContain('Verify API key is correct and active');
    });

    it('should handle 403 Forbidden errors', () => {
      const error = AppleMapsErrorHandler.handleHTTPError(
        403,
        'Forbidden',
        { error: 'Insufficient permissions' }
      );

      expect(error.code).toBe('APPLE_MAPS_403');
      expect(error.appleErrorType).toBe('AUTHENTICATION');
      expect(error.message).toContain('Access forbidden');
      expect(error.details.suggestions).toContain('Check API key permissions in Apple Developer Console');
    });

    it('should handle 404 Not Found errors', () => {
      const error = AppleMapsErrorHandler.handleHTTPError(
        404,
        'Not Found',
        { error: 'Resource not found' }
      );

      expect(error.code).toBe('APPLE_MAPS_404');
      expect(error.appleErrorType).toBe('NOT_FOUND');
      expect(error.message).toContain('The requested resource was not found');
      expect(error.details.suggestions).toContain('Check if the place ID is valid');
    });

    it('should handle 429 Rate Limit errors with retry-after', () => {
      const error = AppleMapsErrorHandler.handleHTTPError(
        429,
        'Too Many Requests',
        { error: 'Rate limit exceeded', retryAfter: 120 }
      );

      expect(error.code).toBe('APPLE_MAPS_429');
      expect(error.appleErrorType).toBe('QUOTA_EXCEEDED');
      expect(error.message).toContain('Rate limit exceeded');
      expect(error.retryAfter).toBe(120);
      expect(error.details.retryAfterSeconds).toBe(120);
    });

    it('should handle 429 Rate Limit errors without retry-after', () => {
      const error = AppleMapsErrorHandler.handleHTTPError(
        429,
        'Too Many Requests',
        { error: 'Rate limit exceeded' }
      );

      expect(error.code).toBe('APPLE_MAPS_429');
      expect(error.retryAfter).toBe(60); // Default retry after
    });

    it('should handle 500 Server Error', () => {
      const error = AppleMapsErrorHandler.handleHTTPError(
        500,
        'Internal Server Error',
        { error: 'Server error' }
      );

      expect(error.code).toBe('APPLE_MAPS_500');
      expect(error.appleErrorType).toBe('SERVER_ERROR');
      expect(error.message).toContain('Apple Maps service is temporarily unavailable');
      expect(error.retryAfter).toBe(60);
    });

    it('should handle 502 Bad Gateway', () => {
      const error = AppleMapsErrorHandler.handleHTTPError(
        502,
        'Bad Gateway',
        { error: 'Bad gateway' }
      );

      expect(error.code).toBe('APPLE_MAPS_502');
      expect(error.appleErrorType).toBe('SERVER_ERROR');
      expect(error.retryAfter).toBe(60);
    });

    it('should handle 503 Service Unavailable', () => {
      const error = AppleMapsErrorHandler.handleHTTPError(
        503,
        'Service Unavailable',
        { error: 'Service unavailable' }
      );

      expect(error.code).toBe('APPLE_MAPS_503');
      expect(error.appleErrorType).toBe('SERVER_ERROR');
      expect(error.retryAfter).toBe(60);
    });

    it('should handle 504 Gateway Timeout', () => {
      const error = AppleMapsErrorHandler.handleHTTPError(
        504,
        'Gateway Timeout',
        { error: 'Gateway timeout' }
      );

      expect(error.code).toBe('APPLE_MAPS_504');
      expect(error.appleErrorType).toBe('SERVER_ERROR');
      expect(error.retryAfter).toBe(60);
    });

    it('should handle unknown HTTP status codes', () => {
      const error = AppleMapsErrorHandler.handleHTTPError(
        418,
        "I'm a teapot",
        { error: 'Teapot error' }
      );

      expect(error.code).toBe('APPLE_MAPS_418');
      expect(error.message).toContain("Unexpected error: I'm a teapot");
      expect(error.details.suggestions).toContain('Check Apple Maps API documentation');
    });
  });

  describe('Network Error Handling', () => {
    it('should handle AbortError (timeout)', () => {
      const abortError = new DOMException('The operation was aborted', 'AbortError');
      const error = AppleMapsErrorHandler.handleNetworkError(abortError);

      expect(error.code).toBe('APPLE_MAPS_TIMEOUT');
      expect(error.message).toContain('Request timed out');
      expect(error.details.suggestions).toContain('Check your internet connection');
    });

    it('should handle TypeError (network error)', () => {
      const networkError = new TypeError('Failed to fetch');
      const error = AppleMapsErrorHandler.handleNetworkError(networkError);

      expect(error.code).toBe('APPLE_MAPS_NETWORK_ERROR');
      expect(error.message).toContain('Network error occurred');
      expect(error.details.originalError).toBe('Failed to fetch');
    });

    it('should handle unknown errors', () => {
      const unknownError = new Error('Unknown error');
      const error = AppleMapsErrorHandler.handleNetworkError(unknownError);

      expect(error.code).toBe('APPLE_MAPS_UNKNOWN_ERROR');
      expect(error.message).toContain('An unexpected error occurred');
      expect(error.details.originalError).toBe('Unknown error');
      expect(error.details.errorType).toBe('Error');
    });

    it('should handle non-Error objects', () => {
      const stringError = 'String error';
      const error = AppleMapsErrorHandler.handleNetworkError(stringError);

      expect(error.code).toBe('APPLE_MAPS_UNKNOWN_ERROR');
      expect(error.details.originalError).toBe('String error');
      expect(error.details.errorType).toBe('Unknown');
    });
  });

  describe('Error Classification', () => {
    it('should identify retryable errors', () => {
      const quotaError: AppleMapsAPIError = {
        code: 'APPLE_MAPS_429',
        message: 'Rate limit exceeded',
        appleErrorType: 'QUOTA_EXCEEDED',
      };

      const serverError: AppleMapsAPIError = {
        code: 'APPLE_MAPS_500',
        message: 'Server error',
        appleErrorType: 'SERVER_ERROR',
      };

      const timeoutError: AppleMapsAPIError = {
        code: 'APPLE_MAPS_TIMEOUT',
        message: 'Timeout',
      };

      expect(AppleMapsErrorHandler.isRetryableError(quotaError)).toBe(true);
      expect(AppleMapsErrorHandler.isRetryableError(serverError)).toBe(true);
      expect(AppleMapsErrorHandler.isRetryableError(timeoutError)).toBe(true);
    });

    it('should identify non-retryable errors', () => {
      const authError: AppleMapsAPIError = {
        code: 'APPLE_MAPS_401',
        message: 'Authentication failed',
        appleErrorType: 'AUTHENTICATION',
      };

      const notFoundError: AppleMapsAPIError = {
        code: 'APPLE_MAPS_404',
        message: 'Not found',
        appleErrorType: 'NOT_FOUND',
      };

      expect(AppleMapsErrorHandler.isRetryableError(authError)).toBe(false);
      expect(AppleMapsErrorHandler.isRetryableError(notFoundError)).toBe(false);
    });
  });

  describe('User-Friendly Messages', () => {
    it('should provide user-friendly messages for authentication errors', () => {
      const error: AppleMapsAPIError = {
        code: 'APPLE_MAPS_401',
        message: 'Authentication failed',
        appleErrorType: 'AUTHENTICATION',
      };

      const message = AppleMapsErrorHandler.getUserFriendlyMessage(error);
      expect(message).toContain('Apple Maps API configuration');
      expect(message).not.toContain('401');
    });

    it('should provide user-friendly messages for quota errors', () => {
      const error: AppleMapsAPIError = {
        code: 'APPLE_MAPS_429',
        message: 'Rate limit exceeded',
        appleErrorType: 'QUOTA_EXCEEDED',
      };

      const message = AppleMapsErrorHandler.getUserFriendlyMessage(error);
      expect(message).toContain('usage limit reached');
      expect(message).not.toContain('429');
    });

    it('should provide user-friendly messages for invalid request errors', () => {
      const error: AppleMapsAPIError = {
        code: 'APPLE_MAPS_400',
        message: 'Invalid request',
        appleErrorType: 'INVALID_REQUEST',
      };

      const message = AppleMapsErrorHandler.getUserFriendlyMessage(error);
      expect(message).toContain('search request was invalid');
      expect(message).not.toContain('400');
    });

    it('should provide user-friendly messages for not found errors', () => {
      const error: AppleMapsAPIError = {
        code: 'APPLE_MAPS_404',
        message: 'Not found',
        appleErrorType: 'NOT_FOUND',
      };

      const message = AppleMapsErrorHandler.getUserFriendlyMessage(error);
      expect(message).toContain('No results found');
      expect(message).not.toContain('404');
    });

    it('should provide user-friendly messages for server errors', () => {
      const error: AppleMapsAPIError = {
        code: 'APPLE_MAPS_500',
        message: 'Server error',
        appleErrorType: 'SERVER_ERROR',
      };

      const message = AppleMapsErrorHandler.getUserFriendlyMessage(error);
      expect(message).toContain('temporarily unavailable');
      expect(message).not.toContain('500');
    });

    it('should provide default user-friendly message for unknown errors', () => {
      const error: AppleMapsAPIError = {
        code: 'APPLE_MAPS_UNKNOWN',
        message: 'Unknown error',
      };

      const message = AppleMapsErrorHandler.getUserFriendlyMessage(error);
      expect(message).toContain('An error occurred while searching');
    });
  });

  describe('Suggested Actions', () => {
    it('should provide suggestions from error details when available', () => {
      const error: AppleMapsAPIError = {
        code: 'APPLE_MAPS_400',
        message: 'Invalid request',
        appleErrorType: 'INVALID_REQUEST',
        details: {
          suggestions: ['Custom suggestion 1', 'Custom suggestion 2'],
        },
      };

      const suggestions = AppleMapsErrorHandler.getSuggestedActions(error);
      expect(suggestions).toEqual(['Custom suggestion 1', 'Custom suggestion 2']);
    });

    it('should provide default suggestions for authentication errors', () => {
      const error: AppleMapsAPIError = {
        code: 'APPLE_MAPS_401',
        message: 'Authentication failed',
        appleErrorType: 'AUTHENTICATION',
      };

      const suggestions = AppleMapsErrorHandler.getSuggestedActions(error);
      expect(suggestions).toContain('Check your Apple Maps API key in settings');
      expect(suggestions).toContain('Verify your Apple Developer account status');
    });

    it('should provide default suggestions for quota errors', () => {
      const error: AppleMapsAPIError = {
        code: 'APPLE_MAPS_429',
        message: 'Rate limit exceeded',
        appleErrorType: 'QUOTA_EXCEEDED',
      };

      const suggestions = AppleMapsErrorHandler.getSuggestedActions(error);
      expect(suggestions).toContain('Wait a few minutes before trying again');
      expect(suggestions).toContain('Consider upgrading your Apple Maps API plan');
    });

    it('should provide default suggestions for unknown errors', () => {
      const error: AppleMapsAPIError = {
        code: 'APPLE_MAPS_UNKNOWN',
        message: 'Unknown error',
      };

      const suggestions = AppleMapsErrorHandler.getSuggestedActions(error);
      expect(suggestions).toContain('Try again in a few moments');
      expect(suggestions).toContain('Check your internet connection');
    });
  });
});