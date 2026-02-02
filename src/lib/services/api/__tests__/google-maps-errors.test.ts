/**
 * Google Maps error handler tests
 */

import { GoogleMapsErrorHandler } from '../google-maps-errors';
import type { GoogleMapsAPIError } from '../google-maps-errors';

describe('GoogleMapsErrorHandler', () => {
  describe('handleHTTPError', () => {
    it('should handle 400 Bad Request', () => {
      const error = GoogleMapsErrorHandler.handleHTTPError(400, 'Bad Request', {
        error_message: 'Invalid parameters',
      });

      expect(error.code).toBe('GOOGLE_MAPS_400');
      expect(error.googleErrorType).toBe('INVALID_REQUEST');
      expect(error.message).toContain('Invalid request parameters');
      expect(error.details.suggestions).toContain('Verify search query is not empty');
    });

    it('should handle 401 Unauthorized', () => {
      const error = GoogleMapsErrorHandler.handleHTTPError(401, 'Unauthorized');

      expect(error.code).toBe('GOOGLE_MAPS_401');
      expect(error.googleErrorType).toBe('AUTHENTICATION');
      expect(error.message).toContain('Authentication failed');
      expect(error.details.suggestions).toContain('Verify API key is correct and active');
    });

    it('should handle 403 Forbidden - Authentication', () => {
      const error = GoogleMapsErrorHandler.handleHTTPError(403, 'Forbidden', {
        error_message: 'API key not valid',
      });

      expect(error.code).toBe('GOOGLE_MAPS_403');
      expect(error.googleErrorType).toBe('AUTHENTICATION');
      expect(error.message).toContain('Access forbidden');
      expect(error.details.suggestions).toContain('Check API key permissions in Google Cloud Console');
    });

    it('should handle 403 Forbidden - Billing', () => {
      const error = GoogleMapsErrorHandler.handleHTTPError(403, 'Forbidden', {
        error_message: 'Billing account not enabled',
      });

      expect(error.code).toBe('GOOGLE_MAPS_403');
      expect(error.googleErrorType).toBe('BILLING');
      expect(error.message).toContain('Billing account issue');
      expect(error.details.suggestions).toContain('Check your Google Cloud billing account status');
    });

    it('should handle 404 Not Found', () => {
      const error = GoogleMapsErrorHandler.handleHTTPError(404, 'Not Found');

      expect(error.code).toBe('GOOGLE_MAPS_404');
      expect(error.googleErrorType).toBe('NOT_FOUND');
      expect(error.message).toContain('resource was not found');
      expect(error.details.suggestions).toContain('Check if the place ID is valid');
    });

    it('should handle 429 Rate Limited', () => {
      const error = GoogleMapsErrorHandler.handleHTTPError(429, 'Too Many Requests', {
        retryAfter: 120,
      });

      expect(error.code).toBe('GOOGLE_MAPS_429');
      expect(error.googleErrorType).toBe('QUOTA_EXCEEDED');
      expect(error.message).toContain('Rate limit exceeded');
      expect(error.retryAfter).toBe(120);
      expect(error.details.suggestions).toContain('Implement request throttling');
    });

    it('should handle 500 Server Error', () => {
      const error = GoogleMapsErrorHandler.handleHTTPError(500, 'Internal Server Error');

      expect(error.code).toBe('GOOGLE_MAPS_500');
      expect(error.googleErrorType).toBe('SERVER_ERROR');
      expect(error.message).toContain('temporarily unavailable');
      expect(error.retryAfter).toBe(60);
      expect(error.details.suggestions).toContain('Retry the request after a short delay');
    });

    it('should handle unknown status codes', () => {
      const error = GoogleMapsErrorHandler.handleHTTPError(418, "I'm a teapot");

      expect(error.code).toBe('GOOGLE_MAPS_418');
      expect(error.message).toContain("Unexpected error: I'm a teapot");
      expect(error.details.suggestions).toContain('Check Google Maps API documentation');
    });
  });

  describe('handleAPIStatus', () => {
    it('should handle ZERO_RESULTS', () => {
      const error = GoogleMapsErrorHandler.handleAPIStatus('ZERO_RESULTS');

      expect(error.code).toBe('GOOGLE_MAPS_API_ZERO_RESULTS');
      expect(error.googleErrorType).toBe('NOT_FOUND');
      expect(error.googleErrorCode).toBe('ZERO_RESULTS');
      expect(error.message).toContain('No results found');
      expect(error.details.suggestions).toContain('Try different search terms');
    });

    it('should handle OVER_QUERY_LIMIT', () => {
      const error = GoogleMapsErrorHandler.handleAPIStatus('OVER_QUERY_LIMIT');

      expect(error.code).toBe('GOOGLE_MAPS_API_OVER_QUERY_LIMIT');
      expect(error.googleErrorType).toBe('QUOTA_EXCEEDED');
      expect(error.message).toContain('exceeded your daily quota');
      expect(error.retryAfter).toBe(3600);
      expect(error.details.suggestions).toContain('Wait until your quota resets');
    });

    it('should handle REQUEST_DENIED', () => {
      const error = GoogleMapsErrorHandler.handleAPIStatus('REQUEST_DENIED', 'API key invalid');

      expect(error.code).toBe('GOOGLE_MAPS_API_REQUEST_DENIED');
      expect(error.googleErrorType).toBe('AUTHENTICATION');
      expect(error.message).toContain('request was denied');
      expect(error.details.errorMessage).toBe('API key invalid');
      expect(error.details.suggestions).toContain('Check your API key is valid and active');
    });

    it('should handle INVALID_REQUEST', () => {
      const error = GoogleMapsErrorHandler.handleAPIStatus('INVALID_REQUEST', 'Missing query parameter');

      expect(error.code).toBe('GOOGLE_MAPS_API_INVALID_REQUEST');
      expect(error.googleErrorType).toBe('INVALID_REQUEST');
      expect(error.message).toContain('request was invalid');
      expect(error.details.suggestions).toContain('Verify all required parameters are provided');
    });

    it('should handle UNKNOWN_ERROR', () => {
      const error = GoogleMapsErrorHandler.handleAPIStatus('UNKNOWN_ERROR');

      expect(error.code).toBe('GOOGLE_MAPS_API_UNKNOWN_ERROR');
      expect(error.googleErrorType).toBe('SERVER_ERROR');
      expect(error.message).toContain('unknown error occurred');
      expect(error.retryAfter).toBe(30);
      expect(error.details.suggestions).toContain('Retry the request');
    });

    it('should handle unknown status codes', () => {
      const error = GoogleMapsErrorHandler.handleAPIStatus('CUSTOM_ERROR', 'Custom error message');

      expect(error.code).toBe('GOOGLE_MAPS_API_CUSTOM_ERROR');
      expect(error.message).toContain('Unknown Google Maps API status: CUSTOM_ERROR');
      expect(error.details.errorMessage).toBe('Custom error message');
    });
  });

  describe('handleNetworkError', () => {
    it('should handle AbortError (timeout)', () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'AbortError';

      const error = GoogleMapsErrorHandler.handleNetworkError(timeoutError);

      expect(error.code).toBe('GOOGLE_MAPS_TIMEOUT');
      expect(error.message).toContain('Request timed out');
      expect(error.details.originalError).toBe('Request timeout');
      expect(error.details.suggestions).toContain('Check your internet connection');
    });

    it('should handle TypeError (fetch error)', () => {
      const fetchError = new Error('Failed to fetch');
      fetchError.name = 'TypeError';

      const error = GoogleMapsErrorHandler.handleNetworkError(fetchError);

      expect(error.code).toBe('GOOGLE_MAPS_NETWORK_ERROR');
      expect(error.message).toContain('Network error occurred');
      expect(error.details.originalError).toBe('Failed to fetch');
      expect(error.details.suggestions).toContain('Check your internet connection');
    });

    it('should handle unknown errors', () => {
      const unknownError = new Error('Unknown error');
      unknownError.name = 'UnknownError';

      const error = GoogleMapsErrorHandler.handleNetworkError(unknownError);

      expect(error.code).toBe('GOOGLE_MAPS_UNKNOWN_ERROR');
      expect(error.message).toContain('unexpected error occurred');
      expect(error.details.originalError).toBe('Unknown error');
      expect(error.details.errorType).toBe('UnknownError');
    });

    it('should handle non-Error objects', () => {
      const error = GoogleMapsErrorHandler.handleNetworkError('String error');

      expect(error.code).toBe('GOOGLE_MAPS_UNKNOWN_ERROR');
      expect(error.message).toContain('unexpected error occurred');
      expect(error.details.originalError).toBe('String error');
      expect(error.details.errorType).toBe('Unknown');
    });
  });

  describe('isRetryableError', () => {
    it('should identify retryable errors by type', () => {
      const quotaError: GoogleMapsAPIError = {
        code: 'GOOGLE_MAPS_API_OVER_QUERY_LIMIT',
        message: 'Quota exceeded',
        googleErrorType: 'QUOTA_EXCEEDED',
      };

      const serverError: GoogleMapsAPIError = {
        code: 'GOOGLE_MAPS_500',
        message: 'Server error',
        googleErrorType: 'SERVER_ERROR',
      };

      expect(GoogleMapsErrorHandler.isRetryableError(quotaError)).toBe(true);
      expect(GoogleMapsErrorHandler.isRetryableError(serverError)).toBe(true);
    });

    it('should identify retryable errors by code', () => {
      const timeoutError: GoogleMapsAPIError = {
        code: 'GOOGLE_MAPS_TIMEOUT',
        message: 'Timeout',
      };

      const networkError: GoogleMapsAPIError = {
        code: 'GOOGLE_MAPS_NETWORK_ERROR',
        message: 'Network error',
      };

      expect(GoogleMapsErrorHandler.isRetryableError(timeoutError)).toBe(true);
      expect(GoogleMapsErrorHandler.isRetryableError(networkError)).toBe(true);
    });

    it('should identify non-retryable errors', () => {
      const authError: GoogleMapsAPIError = {
        code: 'GOOGLE_MAPS_401',
        message: 'Authentication failed',
        googleErrorType: 'AUTHENTICATION',
      };

      const invalidError: GoogleMapsAPIError = {
        code: 'GOOGLE_MAPS_API_INVALID_REQUEST',
        message: 'Invalid request',
        googleErrorType: 'INVALID_REQUEST',
      };

      expect(GoogleMapsErrorHandler.isRetryableError(authError)).toBe(false);
      expect(GoogleMapsErrorHandler.isRetryableError(invalidError)).toBe(false);
    });
  });

  describe('getUserFriendlyMessage', () => {
    it('should return user-friendly messages for different error types', () => {
      const authError: GoogleMapsAPIError = {
        code: 'GOOGLE_MAPS_401',
        message: 'Auth failed',
        googleErrorType: 'AUTHENTICATION',
      };

      const billingError: GoogleMapsAPIError = {
        code: 'GOOGLE_MAPS_403',
        message: 'Billing issue',
        googleErrorType: 'BILLING',
      };

      const quotaError: GoogleMapsAPIError = {
        code: 'GOOGLE_MAPS_429',
        message: 'Quota exceeded',
        googleErrorType: 'QUOTA_EXCEEDED',
      };

      expect(GoogleMapsErrorHandler.getUserFriendlyMessage(authError))
        .toContain('Google Maps API configuration');
      expect(GoogleMapsErrorHandler.getUserFriendlyMessage(billingError))
        .toContain('billing issue');
      expect(GoogleMapsErrorHandler.getUserFriendlyMessage(quotaError))
        .toContain('usage limit reached');
    });

    it('should return default message for unknown error types', () => {
      const unknownError: GoogleMapsAPIError = {
        code: 'UNKNOWN_CODE',
        message: 'Unknown error',
      };

      const message = GoogleMapsErrorHandler.getUserFriendlyMessage(unknownError);
      expect(message).toContain('error occurred while searching Google Maps');
    });
  });

  describe('getSuggestedActions', () => {
    it('should return suggestions from error details when available', () => {
      const error: GoogleMapsAPIError = {
        code: 'GOOGLE_MAPS_400',
        message: 'Bad request',
        details: {
          suggestions: ['Custom suggestion 1', 'Custom suggestion 2'],
        },
      };

      const suggestions = GoogleMapsErrorHandler.getSuggestedActions(error);
      expect(suggestions).toEqual(['Custom suggestion 1', 'Custom suggestion 2']);
    });

    it('should return default suggestions based on error type', () => {
      const authError: GoogleMapsAPIError = {
        code: 'GOOGLE_MAPS_401',
        message: 'Auth failed',
        googleErrorType: 'AUTHENTICATION',
      };

      const suggestions = GoogleMapsErrorHandler.getSuggestedActions(authError);
      expect(suggestions).toContain('Check your Google Maps API key in settings');
      expect(suggestions).toContain('Verify Places API is enabled in Google Cloud Console');
    });

    it('should return generic suggestions for unknown error types', () => {
      const unknownError: GoogleMapsAPIError = {
        code: 'UNKNOWN_CODE',
        message: 'Unknown error',
      };

      const suggestions = GoogleMapsErrorHandler.getSuggestedActions(unknownError);
      expect(suggestions).toContain('Try again in a few moments');
      expect(suggestions).toContain('Check your internet connection');
    });
  });
});