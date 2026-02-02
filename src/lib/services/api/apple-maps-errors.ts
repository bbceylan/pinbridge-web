/**
 * Apple Maps API specific error handling
 */

import type { APIError } from './types';

export interface AppleMapsAPIError extends APIError {
  appleErrorCode?: string;
  appleErrorType?: 'AUTHENTICATION' | 'QUOTA_EXCEEDED' | 'INVALID_REQUEST' | 'NOT_FOUND' | 'SERVER_ERROR';
}

export class AppleMapsErrorHandler {
  /**
   * Handle Apple Maps specific HTTP errors
   */
  static handleHTTPError(status: number, statusText: string, responseBody?: any): AppleMapsAPIError {
    const baseError: AppleMapsAPIError = {
      code: `APPLE_MAPS_${status}`,
      message: statusText,
      details: responseBody,
    };

    switch (status) {
      case 400:
        return {
          ...baseError,
          appleErrorType: 'INVALID_REQUEST',
          message: 'Invalid request parameters. Check your search query and coordinates.',
          details: {
            ...responseBody,
            suggestions: [
              'Verify search query is not empty',
              'Check coordinate format (latitude, longitude)',
              'Ensure radius is within valid range (1-50000 meters)',
            ],
          },
        };

      case 401:
        return {
          ...baseError,
          appleErrorType: 'AUTHENTICATION',
          message: 'Authentication failed. Check your Apple Maps API key.',
          details: {
            ...responseBody,
            suggestions: [
              'Verify API key is correct and active',
              'Check if API key has proper permissions',
              'Ensure API key is not expired',
            ],
          },
        };

      case 403:
        return {
          ...baseError,
          appleErrorType: 'AUTHENTICATION',
          message: 'Access forbidden. Your API key may not have the required permissions.',
          details: {
            ...responseBody,
            suggestions: [
              'Check API key permissions in Apple Developer Console',
              'Verify your Apple Developer account is in good standing',
              'Ensure Maps API is enabled for your key',
            ],
          },
        };

      case 404:
        return {
          ...baseError,
          appleErrorType: 'NOT_FOUND',
          message: 'The requested resource was not found.',
          details: {
            ...responseBody,
            suggestions: [
              'Check if the place ID is valid',
              'Verify the search location exists',
              'Try a broader search query',
            ],
          },
        };

      case 429:
        const retryAfter = this.extractRetryAfter(responseBody);
        return {
          ...baseError,
          appleErrorType: 'QUOTA_EXCEEDED',
          message: 'Rate limit exceeded. Please wait before making more requests.',
          retryAfter,
          details: {
            ...responseBody,
            retryAfterSeconds: retryAfter,
            suggestions: [
              'Implement request throttling',
              'Consider upgrading your API plan',
              'Cache responses to reduce API calls',
            ],
          },
        };

      case 500:
      case 502:
      case 503:
      case 504:
        return {
          ...baseError,
          appleErrorType: 'SERVER_ERROR',
          message: 'Apple Maps service is temporarily unavailable. Please try again later.',
          retryAfter: 60, // Retry after 1 minute for server errors
          details: {
            ...responseBody,
            suggestions: [
              'Retry the request after a short delay',
              'Check Apple Maps service status',
              'Implement fallback to cached data if available',
            ],
          },
        };

      default:
        return {
          ...baseError,
          message: `Unexpected error: ${statusText}`,
          details: {
            ...responseBody,
            suggestions: [
              'Check Apple Maps API documentation',
              'Contact Apple Developer Support if the issue persists',
            ],
          },
        };
    }
  }

  /**
   * Handle network and other non-HTTP errors
   */
  static handleNetworkError(error: any): AppleMapsAPIError {
    if (error.name === 'AbortError') {
      return {
        code: 'APPLE_MAPS_TIMEOUT',
        message: 'Request timed out. Apple Maps API did not respond within the expected time.',
        details: {
          originalError: error.message,
          suggestions: [
            'Check your internet connection',
            'Try increasing the request timeout',
            'Verify Apple Maps service availability',
          ],
        },
      };
    }

    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return {
        code: 'APPLE_MAPS_NETWORK_ERROR',
        message: 'Network error occurred while connecting to Apple Maps API.',
        details: {
          originalError: error.message,
          suggestions: [
            'Check your internet connection',
            'Verify firewall settings allow HTTPS requests',
            'Try again in a few moments',
          ],
        },
      };
    }

    return {
      code: 'APPLE_MAPS_UNKNOWN_ERROR',
      message: 'An unexpected error occurred while communicating with Apple Maps API.',
      details: {
        originalError: error.message || String(error),
        errorType: error.name || 'Unknown',
        suggestions: [
          'Check the browser console for more details',
          'Try refreshing the page',
          'Contact support if the issue persists',
        ],
      },
    };
  }

  /**
   * Extract retry-after value from response
   */
  private static extractRetryAfter(responseBody?: any): number | undefined {
    if (!responseBody) return undefined;

    // Check for retry-after in various formats
    if (responseBody.retryAfter) {
      return typeof responseBody.retryAfter === 'number' 
        ? responseBody.retryAfter 
        : parseInt(responseBody.retryAfter, 10);
    }

    if (responseBody.retry_after) {
      return typeof responseBody.retry_after === 'number' 
        ? responseBody.retry_after 
        : parseInt(responseBody.retry_after, 10);
    }

    // Default retry after for rate limiting
    return 60;
  }

  /**
   * Check if an error is retryable
   */
  static isRetryableError(error: AppleMapsAPIError): boolean {
    const retryableTypes = ['QUOTA_EXCEEDED', 'SERVER_ERROR'];
    const retryableCodes = [
      'APPLE_MAPS_TIMEOUT',
      'APPLE_MAPS_NETWORK_ERROR',
      'APPLE_MAPS_500',
      'APPLE_MAPS_502',
      'APPLE_MAPS_503',
      'APPLE_MAPS_504',
    ];

    return (
      (error.appleErrorType && retryableTypes.includes(error.appleErrorType)) ||
      retryableCodes.includes(error.code)
    );
  }

  /**
   * Get user-friendly error message
   */
  static getUserFriendlyMessage(error: AppleMapsAPIError): string {
    switch (error.appleErrorType) {
      case 'AUTHENTICATION':
        return 'There was an issue with the Apple Maps API configuration. Please check your settings.';
      
      case 'QUOTA_EXCEEDED':
        return 'Apple Maps API usage limit reached. Please try again later or upgrade your plan.';
      
      case 'INVALID_REQUEST':
        return 'The search request was invalid. Please check your search terms and try again.';
      
      case 'NOT_FOUND':
        return 'No results found for your search. Try different search terms or a broader location.';
      
      case 'SERVER_ERROR':
        return 'Apple Maps service is temporarily unavailable. Please try again in a few minutes.';
      
      default:
        return 'An error occurred while searching Apple Maps. Please try again.';
    }
  }

  /**
   * Get suggested actions for the user
   */
  static getSuggestedActions(error: AppleMapsAPIError): string[] {
    if (error.details?.suggestions && Array.isArray(error.details.suggestions)) {
      return error.details.suggestions;
    }

    // Default suggestions based on error type
    switch (error.appleErrorType) {
      case 'AUTHENTICATION':
        return [
          'Check your Apple Maps API key in settings',
          'Verify your Apple Developer account status',
          'Contact your administrator if using a shared key',
        ];
      
      case 'QUOTA_EXCEEDED':
        return [
          'Wait a few minutes before trying again',
          'Consider upgrading your Apple Maps API plan',
          'Use cached results when possible',
        ];
      
      case 'INVALID_REQUEST':
        return [
          'Check your search terms for typos',
          'Try a more specific location',
          'Verify coordinates are in the correct format',
        ];
      
      case 'NOT_FOUND':
        return [
          'Try different search terms',
          'Search for a nearby landmark instead',
          'Check if the place name has changed',
        ];
      
      default:
        return [
          'Try again in a few moments',
          'Check your internet connection',
          'Contact support if the problem persists',
        ];
    }
  }
}