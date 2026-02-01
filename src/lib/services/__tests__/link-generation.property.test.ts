/**
 * Property-based tests for link generation correctness
 * Feature: link-list-feature
 */

import fc from 'fast-check';
import { generateAppleMapsUrl, generateGoogleMapsUrl } from '@/lib/links';
import type { Place } from '@/types';

// Generator for valid place data with location information
const placeWithLocationArbitrary = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
  title: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  address: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
  latitude: fc.option(fc.double({ min: -90, max: 90 }), { freq: 4 }), // 80% chance of having coordinates (4:1 ratio)
  longitude: fc.option(fc.double({ min: -180, max: 180 }), { freq: 4 }),
  notes: fc.option(fc.string({ maxLength: 500 })),
  tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }),
  source: fc.constantFrom('apple', 'google', 'manual', 'other'),
  sourceUrl: fc.option(fc.webUrl()),
  normalizedTitle: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  normalizedAddress: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
  createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
  updatedAt: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
}) as fc.Arbitrary<Place>;

// Generator for places with guaranteed coordinates
const placeWithCoordinatesArbitrary = placeWithLocationArbitrary.map(place => ({
  ...place,
  latitude: fc.sample(fc.double({ min: -90, max: 90 }), 1)[0],
  longitude: fc.sample(fc.double({ min: -180, max: 180 }), 1)[0],
})) as fc.Arbitrary<Place>;

// Generator for places without coordinates
const placeWithoutCoordinatesArbitrary = placeWithLocationArbitrary.map(place => ({
  ...place,
  latitude: undefined,
  longitude: undefined,
})) as fc.Arbitrary<Place>;

/**
 * Property 2: Link generation correctness
 * **Validates: Requirements 1.3, 7.1, 7.2, 7.4**
 * 
 * For any place with valid location data, the generated Apple Maps and Google Maps 
 * links should use the existing generateAppleMapsUrl and generateGoogleMapsUrl functions 
 * and produce URLs that match the expected format patterns for their respective map applications.
 */
describe('Property 2: Link generation correctness', () => {
  it('should generate correct Apple Maps URLs for any valid place data', async () => {
    await fc.assert(
      fc.property(
        placeWithLocationArbitrary,
        (place) => {
          // Act: Generate Apple Maps URL using the existing function (Requirement 7.1)
          let appleUrl: string;
          try {
            appleUrl = generateAppleMapsUrl(place);
          } catch (error) {
            // Link generation should not throw for valid place data
            throw new Error(`generateAppleMapsUrl threw for valid place: ${error}`);
          }

          // Assert: URL should be a valid URL
          expect(() => new URL(appleUrl)).not.toThrow();
          const urlObj = new URL(appleUrl);

          // Assert: URL should match Apple Maps format pattern (Requirement 7.4)
          expect(urlObj.protocol).toBe('https:');
          expect(urlObj.hostname).toBe('maps.apple.com');
          expect(urlObj.pathname).toBe('/');

          // Assert: URL should contain appropriate query parameters
          const searchParams = urlObj.searchParams;
          
          if (place.latitude !== undefined && place.longitude !== undefined) {
            // When coordinates are available, should use them (Requirement 1.3)
            expect(searchParams.has('ll')).toBe(true);
            expect(searchParams.has('q')).toBe(true);
            
            const llParam = searchParams.get('ll');
            expect(llParam).toBe(`${place.latitude},${place.longitude}`);
            
            const qParam = searchParams.get('q');
            expect(qParam).toBe(place.title);
          } else {
            // When coordinates are not available, should use address/title query
            expect(searchParams.has('q')).toBe(true);
            
            const qParam = searchParams.get('q');
            const expectedQuery = place.address || place.title;
            expect(qParam).toBe(expectedQuery);
          }

          // Assert: URL should be openable in browsers and mobile apps (Requirement 7.4)
          // Apple Maps URLs should follow the documented format
          expect(appleUrl).toMatch(/^https:\/\/maps\.apple\.com\/\?/);
          
          // Assert: URL should handle special characters properly
          // All query parameters should be properly encoded
          const decodedUrl = decodeURIComponent(appleUrl);
          expect(() => new URL(decodedUrl)).not.toThrow();

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should generate correct Google Maps URLs for any valid place data', async () => {
    await fc.assert(
      fc.property(
        placeWithLocationArbitrary,
        (place) => {
          // Act: Generate Google Maps URL using the existing function (Requirement 7.2)
          let googleUrl: string;
          try {
            googleUrl = generateGoogleMapsUrl(place);
          } catch (error) {
            // Link generation should not throw for valid place data
            throw new Error(`generateGoogleMapsUrl threw for valid place: ${error}`);
          }

          // Assert: URL should be a valid URL
          expect(() => new URL(googleUrl)).not.toThrow();
          const urlObj = new URL(googleUrl);

          // Assert: URL should match Google Maps format pattern (Requirement 7.4)
          expect(urlObj.protocol).toBe('https:');
          expect(urlObj.hostname).toBe('www.google.com');
          expect(urlObj.pathname).toBe('/maps/search/');

          // Assert: URL should contain appropriate query parameters
          const searchParams = urlObj.searchParams;
          expect(searchParams.has('api')).toBe(true);
          expect(searchParams.get('api')).toBe('1');
          expect(searchParams.has('query')).toBe(true);

          const queryParam = searchParams.get('query');
          expect(queryParam).toBeTruthy();

          if (place.latitude !== undefined && place.longitude !== undefined) {
            // When coordinates are available, should use them (Requirement 1.3)
            expect(queryParam).toBe(`${place.latitude},${place.longitude}`);
          } else {
            // When coordinates are not available, should use address/title query
            const expectedQuery = place.address || place.title;
            expect(queryParam).toBe(encodeURIComponent(expectedQuery));
          }

          // Assert: URL should be openable in browsers and mobile apps (Requirement 7.4)
          // Google Maps URLs should follow the documented format
          expect(googleUrl).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);

          // Assert: URL should handle special characters properly
          // Query parameter should be properly encoded
          const decodedQuery = decodeURIComponent(queryParam!);
          expect(decodedQuery.length).toBeGreaterThan(0);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should generate consistent URLs for places with coordinates', async () => {
    await fc.assert(
      fc.property(
        placeWithCoordinatesArbitrary,
        (place) => {
          // Act: Generate URLs multiple times
          const appleUrl1 = generateAppleMapsUrl(place);
          const appleUrl2 = generateAppleMapsUrl(place);
          const googleUrl1 = generateGoogleMapsUrl(place);
          const googleUrl2 = generateGoogleMapsUrl(place);

          // Assert: URLs should be consistent across multiple generations
          expect(appleUrl1).toBe(appleUrl2);
          expect(googleUrl1).toBe(googleUrl2);

          // Assert: Both URLs should contain the same coordinate information
          const appleUrlObj = new URL(appleUrl1);
          const googleUrlObj = new URL(googleUrl1);

          const appleLl = appleUrlObj.searchParams.get('ll');
          const googleQuery = googleUrlObj.searchParams.get('query');

          expect(appleLl).toBe(`${place.latitude},${place.longitude}`);
          expect(googleQuery).toBe(`${place.latitude},${place.longitude}`);

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should generate appropriate fallback URLs for places without coordinates', async () => {
    await fc.assert(
      fc.property(
        placeWithoutCoordinatesArbitrary,
        (place) => {
          // Act: Generate URLs for places without coordinates
          const appleUrl = generateAppleMapsUrl(place);
          const googleUrl = generateGoogleMapsUrl(place);

          // Assert: URLs should still be valid and functional
          expect(() => new URL(appleUrl)).not.toThrow();
          expect(() => new URL(googleUrl)).not.toThrow();

          const appleUrlObj = new URL(appleUrl);
          const googleUrlObj = new URL(googleUrl);

          // Assert: Apple Maps should use query parameter for address/title
          expect(appleUrlObj.searchParams.has('q')).toBe(true);
          expect(appleUrlObj.searchParams.has('ll')).toBe(false);
          
          const appleQuery = appleUrlObj.searchParams.get('q');
          const expectedAppleQuery = place.address || place.title;
          expect(appleQuery).toBe(expectedAppleQuery);

          // Assert: Google Maps should use encoded query parameter for address/title
          expect(googleUrlObj.searchParams.has('query')).toBe(true);
          
          const googleQuery = googleUrlObj.searchParams.get('query');
          const expectedGoogleQuery = place.address || place.title;
          
          // The query parameter should contain the encoded version of the expected query
          // We need to handle the fact that URLSearchParams.get() automatically decodes
          expect(googleQuery).toBe(expectedGoogleQuery);

          // Assert: URLs should not contain coordinate information
          expect(appleUrl).not.toMatch(/ll=/);
          expect(googleUrl).not.toMatch(/query=[\d.-]+,[\d.-]+/);

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle edge cases in place data gracefully', async () => {
    await fc.assert(
      fc.property(
        fc.record({
          id: fc.string({ minLength: 1, maxLength: 20 }),
          title: fc.oneof(
            fc.string({ minLength: 1, maxLength: 20 }),
            fc.string({ minLength: 100, maxLength: 200 }), // Very long titles
            fc.constant('Test & Special <Characters> "Quotes"'), // Special characters
            fc.constant('Café München 北京'), // Unicode characters
          ),
          address: fc.oneof(
            fc.string({ minLength: 1, maxLength: 50 }),
            fc.string({ minLength: 200, maxLength: 300 }), // Very long addresses
            fc.constant('123 Main St & 2nd Ave, City "Name", State'), // Special characters
            fc.constant('東京都渋谷区 Shibuya'), // Mixed scripts
          ),
          latitude: fc.option(fc.oneof(
            fc.double({ min: -90, max: 90 }),
            fc.constant(-90), // Boundary values
            fc.constant(90),
            fc.constant(0),
          )),
          longitude: fc.option(fc.oneof(
            fc.double({ min: -180, max: 180 }),
            fc.constant(-180), // Boundary values
            fc.constant(180),
            fc.constant(0),
          )),
          notes: fc.option(fc.string({ maxLength: 1000 })),
          tags: fc.array(fc.string({ maxLength: 50 }), { maxLength: 10 }),
          source: fc.constantFrom('apple', 'google', 'manual', 'other'),
          sourceUrl: fc.option(fc.webUrl()),
          normalizedTitle: fc.string({ minLength: 1, maxLength: 100 }),
          normalizedAddress: fc.string({ minLength: 1, maxLength: 200 }),
          createdAt: fc.date(),
          updatedAt: fc.date(),
        }),
        (place) => {
          // Act: Generate URLs with edge case data
          let appleUrl: string;
          let googleUrl: string;

          try {
            appleUrl = generateAppleMapsUrl(place as Place);
            googleUrl = generateGoogleMapsUrl(place as Place);
          } catch (error) {
            // Should not throw for any valid place structure
            throw new Error(`Link generation failed for edge case: ${error}`);
          }

          // Assert: URLs should always be valid regardless of input
          expect(() => new URL(appleUrl)).not.toThrow();
          expect(() => new URL(googleUrl)).not.toThrow();

          // Assert: URLs should follow correct format patterns
          expect(appleUrl).toMatch(/^https:\/\/maps\.apple\.com\/\?/);
          expect(googleUrl).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);

          // Assert: Special characters should be properly handled
          const appleUrlObj = new URL(appleUrl);
          const googleUrlObj = new URL(googleUrl);

          // All query parameters should be properly encoded and decodeable
          for (const [key, value] of Array.from(appleUrlObj.searchParams.entries())) {
            expect(typeof key).toBe('string');
            expect(typeof value).toBe('string');
            expect(key.length).toBeGreaterThan(0);
            expect(value.length).toBeGreaterThan(0);
          }

          for (const [key, value] of Array.from(googleUrlObj.searchParams.entries())) {
            expect(typeof key).toBe('string');
            expect(typeof value).toBe('string');
            expect(key.length).toBeGreaterThan(0);
            expect(value.length).toBeGreaterThan(0);
          }

          // Assert: Boundary coordinate values should be handled correctly
          if (place.latitude !== undefined && place.longitude !== undefined) {
            const appleLL = appleUrlObj.searchParams.get('ll');
            const googleQuery = googleUrlObj.searchParams.get('query');

            expect(appleLL).toBe(`${place.latitude},${place.longitude}`);
            expect(googleQuery).toBe(`${place.latitude},${place.longitude}`);

            // Coordinates should be within valid ranges
            if (place.latitude !== undefined && place.latitude !== null) {
              expect(place.latitude).toBeGreaterThanOrEqual(-90);
              expect(place.latitude).toBeLessThanOrEqual(90);
            }
            if (place.longitude !== undefined && place.longitude !== null) {
              expect(place.longitude).toBeGreaterThanOrEqual(-180);
              expect(place.longitude).toBeLessThanOrEqual(180);
            }
          }

          return true;
        }
      ),
      { numRuns: 75 }
    );
  });

  it('should ensure URLs are compatible with mobile applications', async () => {
    await fc.assert(
      fc.property(
        placeWithLocationArbitrary,
        (place) => {
          // Act: Generate URLs
          const appleUrl = generateAppleMapsUrl(place);
          const googleUrl = generateGoogleMapsUrl(place);

          // Assert: Apple Maps URLs should be compatible with iOS apps (Requirement 7.4)
          // Apple Maps URLs with maps.apple.com domain work on both web and iOS
          expect(appleUrl).toMatch(/^https:\/\/maps\.apple\.com\//);
          
          // Should not contain any characters that would break mobile URL schemes
          expect(appleUrl).not.toMatch(/[<>{}|\\^`\[\]]/);

          // Assert: Google Maps URLs should be compatible with Android/web apps (Requirement 7.4)
          // Google Maps search URLs work across platforms
          expect(googleUrl).toMatch(/^https:\/\/www\.google\.com\/maps\/search\//);
          
          // Should not contain any characters that would break mobile URL schemes
          expect(googleUrl).not.toMatch(/[<>{}|\\^`\[\]]/);

          // Assert: URLs should be properly encoded for mobile compatibility
          // Test that URLs can be used in mobile contexts (e.g., as href attributes)
          const appleUrlObj = new URL(appleUrl);
          const googleUrlObj = new URL(googleUrl);

          // URLs should not contain unencoded spaces or special characters in the path
          expect(appleUrlObj.pathname).not.toMatch(/\s/);
          expect(googleUrlObj.pathname).not.toMatch(/\s/);

          // Query parameters should be properly encoded
          expect(appleUrl).not.toMatch(/\?[^&]*\s/); // No unencoded spaces in query
          expect(googleUrl).not.toMatch(/\?[^&]*\s/); // No unencoded spaces in query

          // Assert: URLs should work with common mobile URL handling patterns
          // Test that URLs can be safely used in JavaScript window.open() calls
          expect(() => {
            // Simulate mobile app URL opening - should not throw
            const testUrl = appleUrl.replace(/['"]/g, ''); // Remove any quotes
            new URL(testUrl);
          }).not.toThrow();

          expect(() => {
            // Simulate mobile app URL opening - should not throw
            const testUrl = googleUrl.replace(/['"]/g, ''); // Remove any quotes
            new URL(testUrl);
          }).not.toThrow();

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should maintain URL format consistency across different place data variations', async () => {
    await fc.assert(
      fc.property(
        fc.array(placeWithLocationArbitrary, { minLength: 2, maxLength: 10 }),
        (places) => {
          // Act: Generate URLs for multiple places
          const appleUrls = places.map(place => generateAppleMapsUrl(place));
          const googleUrls = places.map(place => generateGoogleMapsUrl(place));

          // Assert: All Apple Maps URLs should follow the same format pattern
          for (const appleUrl of appleUrls) {
            expect(appleUrl).toMatch(/^https:\/\/maps\.apple\.com\/\?/);
            
            const urlObj = new URL(appleUrl);
            expect(urlObj.hostname).toBe('maps.apple.com');
            expect(urlObj.pathname).toBe('/');
            expect(urlObj.searchParams.has('q')).toBe(true);
          }

          // Assert: All Google Maps URLs should follow the same format pattern
          for (const googleUrl of googleUrls) {
            expect(googleUrl).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
            
            const urlObj = new URL(googleUrl);
            expect(urlObj.hostname).toBe('www.google.com');
            expect(urlObj.pathname).toBe('/maps/search/');
            expect(urlObj.searchParams.get('api')).toBe('1');
            expect(urlObj.searchParams.has('query')).toBe(true);
          }

          // Assert: URLs should be unique for different places (when they have different data)
          const uniqueAppleUrls = new Set(appleUrls);
          const uniqueGoogleUrls = new Set(googleUrls);

          // If places have different titles/addresses/coordinates, URLs should be different
          const uniquePlaceData = new Set(places.map(place => 
            `${place.title}-${place.address}-${place.latitude}-${place.longitude}`
          ));

          if (uniquePlaceData.size > 1) {
            // Should have some URL variation when place data varies
            expect(uniqueAppleUrls.size).toBeGreaterThan(1);
            expect(uniqueGoogleUrls.size).toBeGreaterThan(1);
          }

          return true;
        }
      ),
      { numRuns: 30 }
    );
  });
});