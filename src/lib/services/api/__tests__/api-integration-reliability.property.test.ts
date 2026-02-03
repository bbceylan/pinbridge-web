/**
 * Property-based tests for API integration reliability
 * Feature: automatized-transfer-with-verification, Property 1: API Integration Reliability
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4**
 */

import fc from 'fast-check';
import { AppleMapsService } from '../apple-maps';
import { GoogleMapsService } from '../google-maps';
import { AppleMapsErrorHandler } from '../apple-maps-errors';
import { GoogleMapsErrorHandler } from '../google-maps-errors';
import type { APIConfig, PlaceSearchQuery, APIResponse } from '../types';

// Mock fetch globally
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock the database module
jest.mock('@/lib/db', () => ({
  db: {
    apiUsageLog: {
      add: jest.fn().mockResolvedValue(undefined),
    },
  },
}));

// Suppress console warnings during property tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
beforeAll(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Test data generators
const apiConfigArbitrary = fc.record({
  apiKey: fc.string({ minLength: 10, maxLength: 50 }).filter(key => key.trim().length >= 10 && !key.includes(' ')),
  baseUrl: fc.webUrl(),
  timeout: fc.integer({ min: 1000, max: 30000 }),
  maxRetries: fc.integer({ min: 0, max: 5 }),
  rateLimitPerSecond: fc.integer({ min: 1, max: 100 }),
}) as fc.Arbitrary<APIConfig>;

const placeSearchQueryArbitrary = fc
  .record({
    name: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
    address: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
    latitude: fc.option(fc.float({ min: -90, max: 90 }), { nil: undefined }),
    longitude: fc.option(fc.float({ min: -180, max: 180 }), { nil: undefined }),
    radius: fc.option(fc.integer({ min: 1, max: 50000 }), { nil: undefined }),
  })
  .filter((query) =>
    // Ensure at least one search parameter is provided
    Boolean(query.name || query.address || (query.latitude !== undefined && query.longitude !== undefined))
  ) as fc.Arbitrary<PlaceSearchQuery>;

const httpStatusArbitrary = fc.constantFrom(
  200, 400, 401, 403, 404, 429, 500, 502, 503, 504
);

const networkErrorArbitrary = fc.oneof(
  fc.constant(new DOMException('Aborted', 'AbortError')),
  fc.constant(new TypeError('Failed to fetch')),
  fc.constant(new Error('Network error')),
  fc.constant(new Error('Connection timeout'))
);

describe('API Integration Reliability Properties', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    jest.clearAllMocks();
  });

  /**
   * **Validates: Requirements 7.1, 7.2**
   * 
   * Property 1a: API Authentication Consistency
   * Both Apple Maps and Google Maps services should consistently handle 
   * authentication across all valid API configurations and maintain 
   * proper authentication headers/parameters.
   */
  it('should maintain consistent authentication across all API configurations', async () => {
    await fc.assert(
      fc.asyncProperty(
        apiConfigArbitrary,
        placeSearchQueryArbitrary,
        async (config, query) => {
          // Test Apple Maps authentication
          const appleService = new AppleMapsService(config);
          
          const mockAppleResponse = {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ results: [] }),
          };
          mockFetch.mockResolvedValueOnce(mockAppleResponse as any);

          await appleService.searchPlaces(query);

          // Verify Apple Maps uses Bearer token authentication
          const appleCalls = mockFetch.mock.calls.filter(call => 
            call[1]?.headers && 'Authorization' in call[1].headers
          );
          expect(appleCalls.length).toBeGreaterThan(0);
          
          if (appleCalls.length > 0) {
            const authHeader = (appleCalls[0][1] as any).headers.Authorization;
            expect(authHeader).toBe(`Bearer ${config.apiKey}`);
          }

          mockFetch.mockClear();

          // Test Google Maps authentication
          const googleService = new GoogleMapsService(config);
          
          const mockGoogleResponse = {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ results: [], status: 'OK' }),
          };
          mockFetch.mockResolvedValueOnce(mockGoogleResponse as any);

          await googleService.searchPlaces(query);

          // Verify Google Maps uses API key in URL parameters
          const googleCalls = mockFetch.mock.calls;
          expect(googleCalls.length).toBeGreaterThan(0);
          
          if (googleCalls.length > 0) {
            const url = googleCalls[0][0] as string;
            // The URL should contain the API key parameter
            expect(url).toMatch(/[?&]key=/);
          }
        }
      ),
      { numRuns: 10 }
    );
  }, 15000);

  /**
   * **Validates: Requirements 7.3**
   * 
   * Property 1b: Error Handling Consistency
   * Both services should handle all HTTP error codes gracefully and 
   * return consistent error structures with appropriate retry information.
   */
  it('should handle all HTTP errors consistently with proper error structures', async () => {
    await fc.assert(
      fc.asyncProperty(
        apiConfigArbitrary,
        placeSearchQueryArbitrary,
        httpStatusArbitrary,
        fc.option(fc.record({
          error_message: fc.string({ maxLength: 100 }),
          retryAfter: fc.option(fc.integer({ min: 1, max: 3600 })),
        })),
        async (config, query, statusCode, errorBody) => {
          const services = [
            { name: 'Apple Maps', service: new AppleMapsService(config) },
            { name: 'Google Maps', service: new GoogleMapsService(config) },
          ];

          for (const { name, service } of services) {
            const mockResponse = {
              ok: statusCode >= 200 && statusCode < 300,
              status: statusCode,
              statusText: `HTTP ${statusCode}`,
              text: async () => JSON.stringify(
                statusCode >= 200 && statusCode < 300
                  ? (name === 'Apple Maps' ? { results: [] } : { results: [], status: 'OK' })
                  : (errorBody || {})
              ),
            };
            mockFetch.mockResolvedValueOnce(mockResponse as any);

            const result = await service.searchPlaces(query);

            if (statusCode >= 200 && statusCode < 300) {
              // Success cases should return success: true
              expect(result.success).toBe(true);
            } else {
              // Error cases should return success: false with error details
              expect(result.success).toBe(false);
              expect(result.error).toBeDefined();
              expect(result.error!.code).toBeDefined();
              expect(result.error!.message).toBeDefined();
              expect(typeof result.error!.code).toBe('string');
              expect(typeof result.error!.message).toBe('string');

              // Rate limiting errors should include retry information
              if (statusCode === 429) {
                expect(result.error!.retryAfter).toBeDefined();
                expect(typeof result.error!.retryAfter).toBe('number');
                expect(result.error!.retryAfter!).toBeGreaterThan(0);
              }
            }

            mockFetch.mockClear();
          }
        }
      ),
      { numRuns: 15 }
    );
  }, 20000);

  /**
   * **Validates: Requirements 7.3**
   * 
   * Property 1c: Network Error Resilience
   * Both services should handle all types of network errors gracefully 
   * and provide meaningful error messages for different failure modes.
   */
  it('should handle network errors gracefully across all failure modes', async () => {
    await fc.assert(
      fc.asyncProperty(
        apiConfigArbitrary,
        placeSearchQueryArbitrary,
        networkErrorArbitrary,
        async (config, query, networkError) => {
          const services = [
            { name: 'Apple Maps', service: new AppleMapsService(config) },
            { name: 'Google Maps', service: new GoogleMapsService(config) },
          ];

          for (const { name, service } of services) {
            mockFetch.mockRejectedValueOnce(networkError);

            const result = await service.searchPlaces(query);

            // All network errors should result in failure with proper error structure
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error!.code).toBeDefined();
            expect(result.error!.message).toBeDefined();
            expect(typeof result.error!.code).toBe('string');
            expect(typeof result.error!.message).toBe('string');

            // Error codes should be service-specific
            if (name === 'Apple Maps') {
              expect(result.error!.code).toMatch(/^APPLE_MAPS_/);
            } else {
              expect(result.error!.code).toMatch(/^GOOGLE_MAPS_/);
            }

            // Timeout errors should be identifiable
            if (networkError.name === 'AbortError') {
              expect(result.error!.code).toContain('TIMEOUT');
            }

            // Network errors should be identifiable
            if (networkError.message.includes('fetch')) {
              expect(result.error!.code).toContain('NETWORK_ERROR');
            }

            mockFetch.mockClear();
          }
        }
      ),
      { numRuns: 10 }
    );
  }, 15000);

  /**
   * **Validates: Requirements 7.4**
   * 
   * Property 1d: API Key Validation Reliability
   * API key validation should work consistently across different 
   * configurations and properly identify valid vs invalid keys.
   */
  it('should validate API keys consistently across configurations', async () => {
    await fc.assert(
      fc.asyncProperty(
        apiConfigArbitrary,
        fc.boolean(), // Whether the API key should be considered valid
        async (config, shouldBeValid) => {
          const services = [
            { name: 'Apple Maps', service: new AppleMapsService(config) },
            { name: 'Google Maps', service: new GoogleMapsService(config) },
          ];

          for (const { name, service } of services) {
            if (shouldBeValid) {
              // Mock successful response for valid key
              const mockResponse = {
                ok: true,
                status: 200,
                text: async () => JSON.stringify(
                  name === 'Apple Maps' 
                    ? { results: [] }
                    : { results: [], status: 'OK' }
                ),
              };
              mockFetch.mockResolvedValueOnce(mockResponse as any);
            } else {
              // Mock authentication error for invalid key
              const mockResponse = {
                ok: false,
                status: 401,
                statusText: 'Unauthorized',
                text: async () => JSON.stringify({ error: 'Invalid API key' }),
              };
              mockFetch.mockResolvedValueOnce(mockResponse as any);
            }

            const isValid = await service.validateApiKey();

            // Validation result should match expected validity
            expect(isValid).toBe(shouldBeValid);

            // Should make exactly one API call for validation
            expect(mockFetch).toHaveBeenCalledTimes(1);

            mockFetch.mockClear();
          }
        }
      ),
      { numRuns: 8 }
    );
  }, 12000);

  /**
   * **Validates: Requirements 7.1, 7.3**
   * 
   * Property 1e: Response Structure Consistency
   * Both services should return consistent response structures regardless 
   * of input variations, with proper success/failure indicators and data formatting.
   */
  it('should return consistent response structures across all inputs', async () => {
    await fc.assert(
      fc.asyncProperty(
        apiConfigArbitrary,
        placeSearchQueryArbitrary,
        fc.boolean(), // Whether the response should be successful
        async (config, query, shouldSucceed) => {
          const services = [
            { name: 'Apple Maps', service: new AppleMapsService(config) },
            { name: 'Google Maps', service: new GoogleMapsService(config) },
          ];

          for (const { name, service } of services) {
            if (shouldSucceed) {
              // Mock successful response
              const mockResponse = {
                ok: true,
                status: 200,
                text: async () => JSON.stringify(
                  name === 'Apple Maps' 
                    ? { results: [] }
                    : { results: [], status: 'OK' }
                ),
              };
              mockFetch.mockResolvedValueOnce(mockResponse as any);
            } else {
              // Mock error response
              const mockResponse = {
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                text: async () => JSON.stringify({ error: 'Server error' }),
              };
              mockFetch.mockResolvedValueOnce(mockResponse as any);
            }

            const result = await service.searchPlaces(query);

            // All responses should have consistent structure
            expect(result).toHaveProperty('success');
            expect(typeof result.success).toBe('boolean');

            if (result.success) {
              // Successful responses should have data
              expect(result).toHaveProperty('data');
              expect(Array.isArray(result.data)).toBe(true);
              expect(result).not.toHaveProperty('error');
            } else {
              // Failed responses should have error details
              expect(result).toHaveProperty('error');
              expect(result.error).toBeDefined();
              expect(result.error!).toHaveProperty('code');
              expect(result.error!).toHaveProperty('message');
              expect(result).not.toHaveProperty('data');
            }

            mockFetch.mockClear();
          }
        }
      ),
      { numRuns: 12 }
    );
  }, 15000);

  /**
   * **Validates: Requirements 7.3, 7.4**
   * 
   * Property 1f: Rate Limiting Compliance
   * Both services should respect rate limiting configurations and 
   * handle rate limit exceeded scenarios appropriately.
   */
  it('should handle rate limiting consistently across services', async () => {
    await fc.assert(
      fc.asyncProperty(
        apiConfigArbitrary.filter(config => config.rateLimitPerSecond <= 10), // Keep reasonable for testing
        placeSearchQueryArbitrary,
        fc.integer({ min: 1, max: 300 }), // Retry after seconds
        async (config, query, retryAfterSeconds) => {
          const services = [
            { name: 'Apple Maps', service: new AppleMapsService(config) },
            { name: 'Google Maps', service: new GoogleMapsService(config) },
          ];

          for (const { name, service } of services) {
            // Mock rate limit exceeded response
            const mockResponse = {
              ok: false,
              status: 429,
              statusText: 'Too Many Requests',
              text: async () => JSON.stringify({
                error: 'Rate limit exceeded',
                retryAfter: retryAfterSeconds,
              }),
            };
            mockFetch.mockResolvedValueOnce(mockResponse as any);

            const result = await service.searchPlaces(query);

            // Rate limit errors should be handled consistently
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error!.code).toContain('429');
            expect(result.error!.retryAfter).toBeDefined();
            expect(result.error!.retryAfter).toBeGreaterThan(0);

            // Error should be marked as retryable
            const isRetryable = name === 'Apple Maps' 
              ? AppleMapsErrorHandler.isRetryableError(result.error as any)
              : GoogleMapsErrorHandler.isRetryableError(result.error as any);
            expect(isRetryable).toBe(true);

            mockFetch.mockClear();
          }
        }
      ),
      { numRuns: 8 }
    );
  }, 12000);

  /**
   * **Validates: Requirements 7.1, 7.2**
   * 
   * Property 1g: Connection Validation Reliability
   * Connection validation should work consistently and provide 
   * accurate connectivity status across different network conditions.
   */
  it('should validate connections reliably across network conditions', async () => {
    await fc.assert(
      fc.asyncProperty(
        apiConfigArbitrary,
        fc.oneof(
          fc.constant('success'),
          fc.constant('network_error'),
          fc.constant('server_error'),
          fc.constant('auth_error')
        ),
        async (config, networkCondition) => {
          const services = [
            { name: 'Apple Maps', service: new AppleMapsService(config) },
            { name: 'Google Maps', service: new GoogleMapsService(config) },
          ];

          for (const { name, service } of services) {
            switch (networkCondition) {
              case 'success':
                const mockSuccessResponse = {
                  ok: true,
                  status: 200,
                  text: async () => JSON.stringify(
                    name === 'Apple Maps' 
                      ? { results: [] }
                      : { results: [], status: 'OK' }
                  ),
                };
                mockFetch.mockResolvedValueOnce(mockSuccessResponse as any);
                break;

              case 'network_error':
                mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
                break;

              case 'server_error':
                const mockServerErrorResponse = {
                  ok: false,
                  status: 500,
                  statusText: 'Internal Server Error',
                  text: async () => JSON.stringify({ error: 'Server error' }),
                };
                mockFetch.mockResolvedValueOnce(mockServerErrorResponse as any);
                break;

              case 'auth_error':
                const mockAuthErrorResponse = {
                  ok: false,
                  status: 401,
                  statusText: 'Unauthorized',
                  text: async () => JSON.stringify({ error: 'Invalid credentials' }),
                };
                mockFetch.mockResolvedValueOnce(mockAuthErrorResponse as any);
                break;
            }

            const isConnected = await service.validateConnection();

            // Connection validation should return boolean
            expect(typeof isConnected).toBe('boolean');

            // Only success condition should return true
            expect(isConnected).toBe(networkCondition === 'success');

            mockFetch.mockClear();
          }
        }
      ),
      { numRuns: 10 }
    );
  }, 15000);

  /**
   * **Validates: Requirements 7.1, 7.4**
   * 
   * Property 1h: Normalized Response Consistency
   * Both services should provide consistent normalized responses 
   * regardless of their internal API differences.
   */
  it('should provide consistent normalized responses across services', async () => {
    await fc.assert(
      fc.asyncProperty(
        apiConfigArbitrary,
        placeSearchQueryArbitrary,
        async (config, query) => {
          const services = [
            { name: 'Apple Maps', service: new AppleMapsService(config) },
            { name: 'Google Maps', service: new GoogleMapsService(config) },
          ];

          for (const { name, service } of services) {
            // Mock successful response with place data
            const mockPlaceData = name === 'Apple Maps' ? {
              results: [{
                displayMapRegion: { eastLongitude: -122.0, westLongitude: -122.1, northLatitude: 37.4, southLatitude: 37.3 },
                name: 'Test Place',
                coordinate: { latitude: 37.3349, longitude: -122.0090 },
                formattedAddressLines: ['123 Test St', 'Test City, CA 12345'],
                structuredAddress: {},
                categories: ['restaurant'],
              }]
            } : {
              results: [{
                place_id: 'test-place-id',
                name: 'Test Place',
                formatted_address: '123 Test St, Test City, CA 12345',
                geometry: { location: { lat: 37.3349, lng: -122.0090 } },
                types: ['restaurant'],
              }],
              status: 'OK'
            };

            const mockResponse = {
              ok: true,
              status: 200,
              text: async () => JSON.stringify(mockPlaceData),
            };
            mockFetch.mockResolvedValueOnce(mockResponse as any);

            const result = await service.searchPlacesNormalized(query);

            if (result.success && result.data && result.data.length > 0) {
              const normalizedPlace = result.data[0];

              // All normalized places should have consistent structure
              expect(normalizedPlace).toHaveProperty('id');
              expect(normalizedPlace).toHaveProperty('name');
              expect(normalizedPlace).toHaveProperty('address');
              expect(normalizedPlace).toHaveProperty('latitude');
              expect(normalizedPlace).toHaveProperty('longitude');
              expect(normalizedPlace).toHaveProperty('source');

              // Source should match the service
              expect(normalizedPlace.source).toBe(
                name === 'Apple Maps' ? 'apple_maps' : 'google_maps'
              );

              // Coordinates should be numbers
              expect(typeof normalizedPlace.latitude).toBe('number');
              expect(typeof normalizedPlace.longitude).toBe('number');
              expect(normalizedPlace.latitude).toBeGreaterThanOrEqual(-90);
              expect(normalizedPlace.latitude).toBeLessThanOrEqual(90);
              expect(normalizedPlace.longitude).toBeGreaterThanOrEqual(-180);
              expect(normalizedPlace.longitude).toBeLessThanOrEqual(180);
            }

            mockFetch.mockClear();
          }
        }
      ),
      { numRuns: 8 }
    );
  }, 12000);
});
