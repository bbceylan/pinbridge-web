/**
 * Google Maps API specific error handling
 */

import type { APIError } from './types';

export interface GoogleMapsAPIError extends APIError {
  googleErrorCode?: string;
  googleErrorType?: 'AUTHENTICATION' | 'QUOTA_EXCEEDED' | 'INVALID_REQUEST' | 'NOT_FOUND' | 'SERVER_ERROR' | 'BILLING';
}

export class GoogleMapsErrorHandler {
  /**
   * Handle Google Maps specific HTTP errors
   */
  static handleHTTPError(status: number, statusText: string, responseBody?: any): GoogleMapsAPIError {
    const baseError: GoogleMapsAPIError = {
      code: `GOOGLE_MAPS_${status}`,
      message: statusText,
      details: responseBody,
    };

    switch (status) {
      case 400:
        return {
          ...baseError,
          googleErrorType: 'INVALID_REQUEST',
          message: 'Invalid request parameters. Check your search query and coordinates.',
          details: {
            ...responseBody,
            suggestions: [
              'Verify search query is not empty',
              'Check coordinate format (latitude, longitude)',
              'Ensure radius is within valid range (1-50000 meters)',
              'Verify place_id format is correct',
            ],
          },
        };

      case 401:
        return {
          ...baseError,
          googleErrorType: 'AUTHENTICATION',
          message: 'Authentication failed. Check your Google Maps API key.',
          details: {
            ...responseBody,
            suggestions: [
              'Verify API key is correct and active',
              'Check if API key has proper permissions for Places API',
              'Ensure API key is not expired',
              'Verify API key restrictions (HTTP referrers, IP addresses)',
            ],
          },
        };

      case 403:
        // Google Maps uses 403 for both authentication and billing issues
        const isBillingIssue = responseBody?.error_message?.toLowerCase().includes('billing') ||
                              responseBody?.error_message?.toLowerCase().includes('quota');
        
        return {
          ...baseError,
          googleErrorType: isBillingIssue ? 'BILLING' : 'AUTHENTICATION',
          message: isBillingIssue 
            ? 'Billing account issue or quota exceeded. Check your Google Cloud Console.'
            : 'Access forbidden. Your API key may not have the required permissions.',
          details: {
            ...responseBody,
            suggestions: isBillingIssue ? [
              'Check your Google Cloud billing account status',
              'Verify you have sufficient quota remaining',
              'Consider upgrading your API plan',
              'Enable billing for your Google Cloud project',
            ] : [
              'Check API key permissions in Google Cloud Console',
              'Verify Places API is enabled for your project',
              'Ensure your Google Cloud project is active',
            ],
          },
        };

      case 404:
        return {
          ...baseError,
          googleErrorType: 'NOT_FOUND',
          message: 'The requested resource was not found.',
          details: {
            ...responseBody,
            suggestions: [
              'Check if the place ID is valid',
              'Verify the search location exists',
              'Try a broader search query',
              'Ensure the API endpoint URL is correct',
            ],
          },
        };

      case 429:
        const retryAfter = this.extractRetryAfter(responseBody);
        return {
          ...baseError,
          googleErrorType: 'QUOTA_EXCEEDED',
          message: 'Rate limit exceeded. Please wait before making more requests.',
          retryAfter,
          details: {
            ...responseBody,
            retryAfterSeconds: retryAfter,
            suggestions: [
              'Implement request throttling',
              'Consider upgrading your API plan',
              'Cache responses to reduce API calls',
              'Distribute requests over time',
            ],
          },
        };

      case 500:
      case 502:
      case 503:
      case 504:
        return {
          ...baseError,
          googleErrorType: 'SERVER_ERROR',
          message: 'Google Maps service is temporarily unavailable. Please try again later.',
          retryAfter: 60, // Retry after 1 minute for server errors
          details: {
            ...responseBody,
            suggestions: [
              'Retry the request after a short delay',
              'Check Google Maps service status',
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
              'Check Google Maps API documentation',
              'Contact Google Cloud Support if the issue persists',
            ],
          },
        };
    }
  }

  /**
   * Handle Google Maps API status codes from response body
   */
  static handleAPIStatus(status: string, errorMessage?: string): GoogleMapsAPIError {
    const baseError: GoogleMapsAPIError = {
      code: `GOOGLE_MAPS_API_${status}`,
      message: errorMessage || `Google Maps API returned status: ${status}`,
      googleErrorCode: status,
    };

    switch (status) {
      case 'ZERO_RESULTS':
        return {
          ...baseError,
          googleErrorType: 'NOT_FOUND',
          message: 'No results found for your search query.',
          details: {
            suggestions: [
              'Try different search terms',
              'Expand your search radius',
              'Check spelling of place names',
              'Try searching for nearby landmarks',
            ],
          },
        };

      case 'OVER_QUERY_LIMIT':
        return {
          ...baseError,
          googleErrorType: 'QUOTA_EXCEEDED',
          message: 'You have exceeded your daily quota or per-second rate limit.',
          retryAfter: 3600, // Retry after 1 hour for quota issues
          details: {
            suggestions: [
              'Wait until your quota resets',
              'Upgrade your Google Maps API plan',
              'Implement request caching',
              'Optimize your API usage patterns',
            ],
          },
        };

      case 'REQUEST_DENIED':
        return {
          ...baseError,
          googleErrorType: 'AUTHENTICATION',
          message: 'Your request was denied. This may be due to API key issues or billing problems.',
          details: {
            errorMessage,
            suggestions: [
              'Check your API key is valid and active',
              'Verify Places API is enabled',
              'Check your billing account status',
              'Review API key restrictions',
            ],
          },
        };

      case 'INVALID_REQUEST':
        return {
          ...baseError,
          googleErrorType: 'INVALID_REQUEST',
          message: 'The request was invalid. Check your parameters.',
          details: {
            errorMessage,
            suggestions: [
              'Verify all required parameters are provided',
              'Check parameter formats and values',
              'Ensure coordinates are valid',
              'Review the API documentation',
            ],
          },
        };

      case 'UNKNOWN_ERROR':
        return {
          ...baseError,
          googleErrorType: 'SERVER_ERROR',
          message: 'An unknown error occurred on the server side.',
          retryAfter: 30,
          details: {
            errorMessage,
            suggestions: [
              'Retry the request',
              'Check Google Maps service status',
              'Contact support if the issue persists',
            ],
          },
        };

      default:
        return {
          ...baseError,
          message: `Unknown Google Maps API status: ${status}`,
          details: {
            errorMessage,
            suggestions: [
              'Check the Google Maps API documentation',
              'Verify your request parameters',
              'Contact Google Cloud Support',
            ],
          },
        };
    }
  }

  /**
   * Handle network and other non-HTTP errors
   */
  static handleNetworkError(error: any): GoogleMapsAPIError {
    if (error.name === 'AbortError') {
      return {
        code: 'GOOGLE_MAPS_TIMEOUT',
        message: 'Request timed out. Google Maps API did not respond within the expected time.',
        details: {
          originalError: error.message,
          suggestions: [
            'Check your internet connection',
            'Try increasing the request timeout',
            'Verify Google Maps service availability',
          ],
        },
      };
    }

    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return {
        code: 'GOOGLE_MAPS_NETWORK_ERROR',
        message: 'Network error occurred while connecting to Google Maps API.',
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
      code: 'GOOGLE_MAPS_UNKNOWN_ERROR',
      message: 'An unexpected error occurred while communicating with Google Maps API.',
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
  static isRetryableError(error: GoogleMapsAPIError): boolean {
    const retryableTypes = ['QUOTA_EXCEEDED', 'SERVER_ERROR'];
    const retryableCodes = [
      'GOOGLE_MAPS_TIMEOUT',
      'GOOGLE_MAPS_NETWORK_ERROR',
      'GOOGLE_MAPS_500',
      'GOOGLE_MAPS_502',
      'GOOGLE_MAPS_503',
      'GOOGLE_MAPS_504',
      'GOOGLE_MAPS_API_UNKNOWN_ERROR',
    ];

    return (
      (error.googleErrorType && retryableTypes.includes(error.googleErrorType)) ||
      retryableCodes.includes(error.code)
    );
  }

  /**
   * Get user-friendly error message
   */
  static getUserFriendlyMessage(error: GoogleMapsAPIError): string {
    switch (error.googleErrorType) {
      case 'AUTHENTICATION':
        return 'There was an issue with the Google Maps API configuration. Please check your settings.';
      
      case 'BILLING':
        return 'Google Maps API billing issue. Please check your Google Cloud billing account.';
      
      case 'QUOTA_EXCEEDED':
        return 'Google Maps API usage limit reached. Please try again later or upgrade your plan.';
      
      case 'INVALID_REQUEST':
        return 'The search request was invalid. Please check your search terms and try again.';
      
      case 'NOT_FOUND':
        return 'No results found for your search. Try different search terms or a broader location.';
      
      case 'SERVER_ERROR':
        return 'Google Maps service is temporarily unavailable. Please try again in a few minutes.';
      
      default:
        return 'An error occurred while searching Google Maps. Please try again.';
    }
  }

  /**
   * Get suggested actions for the user
   */
  static getSuggestedActions(error: GoogleMapsAPIError): string[] {
    if (error.details?.suggestions && Array.isArray(error.details.suggestions)) {
      return error.details.suggestions;
    }

    // Default suggestions based on error type
    switch (error.googleErrorType) {
      case 'AUTHENTICATION':
        return [
          'Check your Google Maps API key in settings',
          'Verify Places API is enabled in Google Cloud Console',
          'Check API key restrictions and permissions',
        ];
      
      case 'BILLING':
        return [
          'Check your Google Cloud billing account',
          'Verify billing is enabled for your project',
          'Review your API usage and quotas',
        ];
      
      case 'QUOTA_EXCEEDED':
        return [
          'Wait for your quota to reset',
          'Consider upgrading your Google Maps API plan',
          'Implement request caching to reduce API calls',
        ];
      
      case 'INVALID_REQUEST':
        return [
          'Check your search terms for typos',
          'Verify coordinates are in the correct format',
          'Try a more specific location',
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