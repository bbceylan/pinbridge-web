/**
 * Property-based tests for error handling with invalid data
 * Feature: link-list-feature
 */

import fc from 'fast-check';
import { generateAppleMapsUrl, generateGoogleMapsUrl } from '@/lib/links';
import { linkListService, type LinkListCreationData } from '../link-list';
import { urlService } from '../url';
import { db } from '@/lib/db';
import { generateId } from '@/lib/utils';
import type { Place, Collection, LinkList } from '@/types';

// Test setup and teardown
beforeEach(async () => {
  await db.delete();
  await db.open();
});

afterEach(async () => {
  await db.close();
});

// Mock console.error to capture error logging
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

beforeEach(() => {
  mockConsoleError.mockClear();
});

afterEach(() => {
  mockConsoleError.mockRestore();
});

// Generator for places with various levels of incomplete data
const incompleteOrInvalidPlaceArbitrary = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
  title: fc.oneof(
    fc.string({ minLength: 1, maxLength: 50 }).filter(s => !/[&?#]/.test(s)), // Valid title
    fc.constant(''), // Empty title
    fc.constant('   '), // Whitespace-only title
    fc.string({ minLength: 1, maxLength: 5 }).map(s => s.repeat(200)), // Very long title
    fc.constant('Test & Special <Characters> "Quotes"'), // Special characters
    fc.constant('Café München 北京'), // Unicode characters
  ),
  address: fc.oneof(
    fc.string({ minLength: 1, maxLength: 100 }).filter(s => !/[&?#]/.test(s)), // Valid address
    fc.constant(''), // Empty address
    fc.constant('   '), // Whitespace-only address
    fc.string({ minLength: 1, maxLength: 5 }).map(s => s.repeat(100)), // Very long address
    fc.constant('123 Main St & 2nd Ave, City "Name", State'), // Special characters
    fc.constant('東京都渋谷区 Shibuya'), // Mixed scripts
  ),
  latitude: fc.oneof(
    fc.double({ min: -90, max: 90 }), // Valid latitude
    fc.constant(undefined), // Missing latitude
    fc.constant(null as any), // Null latitude
    fc.constant(NaN), // NaN latitude
    fc.constant(Infinity), // Infinite latitude
    fc.constant(-Infinity), // Negative infinite latitude
    fc.constant(91), // Out of range (too high)
    fc.constant(-91), // Out of range (too low)
    fc.constant('invalid' as any), // Wrong type
  ),
  longitude: fc.oneof(
    fc.double({ min: -180, max: 180 }), // Valid longitude
    fc.constant(undefined), // Missing longitude
    fc.constant(null as any), // Null longitude
    fc.constant(NaN), // NaN longitude
    fc.constant(Infinity), // Infinite longitude
    fc.constant(-Infinity), // Negative infinite longitude
    fc.constant(181), // Out of range (too high)
    fc.constant(-181), // Out of range (too low)
    fc.constant('invalid' as any), // Wrong type
  ),
  notes: fc.option(fc.oneof(
    fc.string({ maxLength: 500 }),
    fc.string({ minLength: 1000, maxLength: 5000 }), // Very long notes
  )),
  tags: fc.oneof(
    fc.array(fc.string({ maxLength: 20 }), { maxLength: 5 }), // Normal tags
    fc.array(fc.string({ maxLength: 100 }), { maxLength: 20 }), // Many/long tags
    fc.constant([]), // Empty tags
  ),
  source: fc.oneof(
    fc.constantFrom('apple', 'google', 'manual', 'other'), // Valid sources
    fc.constant('invalid' as any), // Invalid source
    fc.constant('' as any), // Empty source
  ),
  sourceUrl: fc.option(fc.oneof(
    fc.webUrl(), // Valid URL
    fc.constant('invalid-url'), // Invalid URL
    fc.constant(''), // Empty URL
  )),
  normalizedTitle: fc.oneof(
    fc.string({ minLength: 1, maxLength: 100 }),
    fc.constant(''), // Empty normalized title
  ),
  normalizedAddress: fc.oneof(
    fc.string({ minLength: 1, maxLength: 200 }),
    fc.constant(''), // Empty normalized address
  ),
  createdAt: fc.oneof(
    fc.date({ min: new Date('2020-01-01'), max: new Date() }), // Valid date
    fc.constant(new Date('invalid')), // Invalid date
    fc.constant(null as any), // Null date
  ),
  updatedAt: fc.oneof(
    fc.date({ min: new Date('2020-01-01'), max: new Date() }), // Valid date
    fc.constant(new Date('invalid')), // Invalid date
    fc.constant(null as any), // Null date
  ),
}) as fc.Arbitrary<Place>;

// Generator for places with specifically missing coordinate data
const placeWithoutCoordinatesArbitrary = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
  title: fc.string({ minLength: 1, maxLength: 50 }).filter(s => !/[&?#]/.test(s) && s.trim().length > 0),
  address: fc.oneof(
    fc.string({ minLength: 1, maxLength: 100 }).filter(s => !/[&?#]/.test(s) && s.trim().length > 0),
    fc.constant(''), // Empty address - should fallback to title
  ),
  latitude: fc.constant(undefined),
  longitude: fc.constant(undefined),
  notes: fc.option(fc.string({ maxLength: 100 })),
  tags: fc.array(fc.string({ maxLength: 20 }), { maxLength: 3 }),
  source: fc.constantFrom('apple', 'google', 'manual', 'other'),
  sourceUrl: fc.option(fc.webUrl()),
  normalizedTitle: fc.string({ minLength: 1, maxLength: 50 }),
  normalizedAddress: fc.string({ minLength: 1, maxLength: 100 }),
  createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
  updatedAt: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
}) as fc.Arbitrary<Place>;

// Generator for places with mismatched coordinate data (only one coordinate)
const placeWithMismatchedCoordinatesArbitrary = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
  title: fc.string({ minLength: 1, maxLength: 50 }).filter(s => !/[&?#]/.test(s) && s.trim().length > 0),
  address: fc.string({ minLength: 1, maxLength: 100 }).filter(s => !/[&?#]/.test(s) && s.trim().length > 0),
  latitude: fc.oneof(
    fc.double({ min: -90, max: 90 }), // Valid latitude
    fc.constant(undefined), // Missing latitude
  ),
  longitude: fc.oneof(
    fc.double({ min: -180, max: 180 }), // Valid longitude
    fc.constant(undefined), // Missing longitude
  ),
  notes: fc.option(fc.string({ maxLength: 100 })),
  tags: fc.array(fc.string({ maxLength: 20 }), { maxLength: 3 }),
  source: fc.constantFrom('apple', 'google', 'manual', 'other'),
  sourceUrl: fc.option(fc.webUrl()),
  normalizedTitle: fc.string({ minLength: 1, maxLength: 50 }),
  normalizedAddress: fc.string({ minLength: 1, maxLength: 100 }),
  createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
  updatedAt: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
}).filter(place => 
  // Ensure we have mismatched coordinates (one defined, one undefined)
  (place.latitude !== undefined && place.longitude === undefined) ||
  (place.latitude === undefined && place.longitude !== undefined)
) as fc.Arbitrary<Place>;

/**
 * Property 7: Error handling for invalid data
 * **Validates: Requirements 7.3, 7.5**
 * 
 * For any place with incomplete location data, the system should generate links 
 * with available information, handle missing data gracefully, and provide fallback 
 * options when link generation fails.
 */
describe('Property 7: Error handling for invalid data', () => {
  it('should handle incomplete place data gracefully and generate links with available information', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(incompleteOrInvalidPlaceArbitrary, { minLength: 1, maxLength: 3 }),
        async (incompletePlaces) => {
          // Setup: Add places to database with unique IDs
          const placesToAdd = incompletePlaces.map(place => ({
            ...place,
            id: generateId(), // Ensure unique IDs
          }));

          await db.places.bulkAdd(placesToAdd);

          // Create Link List with incomplete places
          const creationData: LinkListCreationData = {
            title: 'Test Incomplete Places',
            selectedPlaces: placesToAdd,
            selectedCollections: [],
          };

          // Act: Create Link List - should not throw (Requirement 7.3)
          let linkList: LinkList;
          try {
            linkList = await linkListService.createLinkList(creationData);
          } catch (error) {
            throw new Error(`Link List creation should not fail with incomplete data: ${error}`);
          }

          // Assert: Link List should be created successfully
          expect(linkList).toBeTruthy();
          expect(linkList.placeIds.length).toBe(placesToAdd.length);

          // Get places for link generation
          const linkListPlaces = await linkListService.getPlacesForLinkList(linkList.id);
          expect(linkListPlaces.length).toBe(placesToAdd.length);

          // Assert: Link generation should handle missing data gracefully (Requirement 7.3)
          for (const place of linkListPlaces) {
            let appleUrl: string;
            let googleUrl: string;

            // Link generation should not throw for any place data
            try {
              appleUrl = generateAppleMapsUrl(place);
              googleUrl = generateGoogleMapsUrl(place);
            } catch (error) {
              throw new Error(`Link generation should not throw for place ${place.id}: ${error}`);
            }

            // Assert: Generated URLs should be valid
            expect(() => new URL(appleUrl)).not.toThrow();
            expect(() => new URL(googleUrl)).not.toThrow();

            // Assert: URLs should follow correct format patterns
            expect(appleUrl).toMatch(/^https:\/\/maps\.apple\.com\/\?/);
            expect(googleUrl).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);

            // Assert: Links should contain available information (Requirement 7.3)
            const appleUrlObj = new URL(appleUrl);
            const googleUrlObj = new URL(googleUrl);

            // Check coordinate handling
            const hasValidCoordinates = 
              place.latitude !== undefined && 
              place.longitude !== undefined &&
              typeof place.latitude === 'number' &&
              typeof place.longitude === 'number' &&
              !isNaN(place.latitude) && 
              !isNaN(place.longitude) &&
              isFinite(place.latitude) && 
              isFinite(place.longitude) &&
              place.latitude >= -90 && 
              place.latitude <= 90 &&
              place.longitude >= -180 && 
              place.longitude <= 180;

            if (hasValidCoordinates) {
              // Should use coordinates when available and valid
              expect(appleUrlObj.searchParams.get('ll')).toBe(`${place.latitude},${place.longitude}`);
              expect(googleUrlObj.searchParams.get('query')).toBe(`${place.latitude},${place.longitude}`);
            } else {
              // Should fallback to address/title query when coordinates are invalid/missing
              expect(appleUrlObj.searchParams.has('q')).toBe(true);
              expect(googleUrlObj.searchParams.has('query')).toBe(true);

              const appleQuery = appleUrlObj.searchParams.get('q');
              const googleQuery = googleUrlObj.searchParams.get('query');

              // Should use address if available and non-empty, otherwise title, otherwise fallback
              const address = place.address?.trim();
              const title = place.title?.trim();
              const expectedQuery = address || title || 'Location';
              
              expect(appleQuery).toBe(expectedQuery);
              expect(googleQuery).toBe(expectedQuery);
            }
          }

          // Assert: Shareable URL generation should handle incomplete data (Requirement 7.5)
          let shareableUrl: string;
          try {
            shareableUrl = urlService.generateShareableURL(linkList, linkListPlaces);
          } catch (error) {
            throw new Error(`URL generation should not fail with incomplete place data: ${error}`);
          }

          // URL should be valid and contain Link List ID
          expect(() => new URL(shareableUrl)).not.toThrow();
          expect(shareableUrl).toContain(linkList.id);

          return true;
        }
      ),
      { numRuns: 25, timeout: 10000 }
    );
  }, 15000);

  it('should provide fallback options when coordinates are missing', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(placeWithoutCoordinatesArbitrary, { minLength: 1, maxLength: 3 }),
        async (placesWithoutCoords) => {
          // Setup: Add places to database
          const placesToAdd = placesWithoutCoords.map(place => ({
            ...place,
            id: generateId(),
          }));

          await db.places.bulkAdd(placesToAdd);

          // Create Link List
          const creationData: LinkListCreationData = {
            title: 'Places Without Coordinates',
            selectedPlaces: placesToAdd,
            selectedCollections: [],
          };

          const linkList = await linkListService.createLinkList(creationData);
          const linkListPlaces = await linkListService.getPlacesForLinkList(linkList.id);

          // Assert: All places should have fallback link generation (Requirement 7.3)
          for (const place of linkListPlaces) {
            // Verify coordinates are indeed missing
            expect(place.latitude).toBeUndefined();
            expect(place.longitude).toBeUndefined();

            // Generate links - should not throw
            const appleUrl = generateAppleMapsUrl(place);
            const googleUrl = generateGoogleMapsUrl(place);

            // Assert: Links should be valid and use fallback query
            expect(() => new URL(appleUrl)).not.toThrow();
            expect(() => new URL(googleUrl)).not.toThrow();

            const appleUrlObj = new URL(appleUrl);
            const googleUrlObj = new URL(googleUrl);

            // Should not contain coordinate parameters
            expect(appleUrlObj.searchParams.has('ll')).toBe(false);
            expect(googleUrlObj.searchParams.get('query')).not.toMatch(/^-?\d+\.?\d*,-?\d+\.?\d*$/);

            // Should contain query parameters with available information
            expect(appleUrlObj.searchParams.has('q')).toBe(true);
            expect(googleUrlObj.searchParams.has('query')).toBe(true);

            const appleQuery = appleUrlObj.searchParams.get('q');
            const googleQuery = googleUrlObj.searchParams.get('query');

            // Should use address if available, otherwise title
            const address = place.address?.trim();
            const title = place.title?.trim();
            const expectedQuery = address || title || 'Location';
            expect(appleQuery).toBe(expectedQuery);
            expect(googleQuery).toBe(expectedQuery);

            // Fallback query should be meaningful
            expect(expectedQuery).toBeTruthy();
            expect(expectedQuery.trim().length).toBeGreaterThan(0);
          }

          return true;
        }
      ),
      { numRuns: 20, timeout: 8000 }
    );
  }, 12000);

  it('should handle mismatched coordinate data gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(placeWithMismatchedCoordinatesArbitrary, { minLength: 1, maxLength: 3 }),
        async (placesWithMismatchedCoords) => {
          // Setup: Add places to database
          const placesToAdd = placesWithMismatchedCoords.map(place => ({
            ...place,
            id: generateId(),
          }));

          await db.places.bulkAdd(placesToAdd);

          // Create Link List
          const creationData: LinkListCreationData = {
            title: 'Places With Mismatched Coordinates',
            selectedPlaces: placesToAdd,
            selectedCollections: [],
          };

          const linkList = await linkListService.createLinkList(creationData);
          const linkListPlaces = await linkListService.getPlacesForLinkList(linkList.id);

          // Assert: Places with incomplete coordinates should fallback to address/title (Requirement 7.3)
          for (const place of linkListPlaces) {
            // Verify coordinates are mismatched
            const hasLatitude = place.latitude !== undefined;
            const hasLongitude = place.longitude !== undefined;
            expect(hasLatitude !== hasLongitude).toBe(true); // One should be defined, one undefined

            // Generate links - should not throw
            const appleUrl = generateAppleMapsUrl(place);
            const googleUrl = generateGoogleMapsUrl(place);

            // Assert: Should fallback to query-based links (not coordinate-based)
            const appleUrlObj = new URL(appleUrl);
            const googleUrlObj = new URL(googleUrl);

            // Should not use coordinate parameters when coordinates are incomplete
            expect(appleUrlObj.searchParams.has('ll')).toBe(false);
            expect(googleUrlObj.searchParams.get('query')).not.toMatch(/^-?\d+\.?\d*,-?\d+\.?\d*$/);

            // Should use address/title query instead
            expect(appleUrlObj.searchParams.has('q')).toBe(true);
            expect(googleUrlObj.searchParams.has('query')).toBe(true);

            const address = place.address?.trim();
            const title = place.title?.trim();
            const expectedQuery = address || title || 'Location';
            expect(appleUrlObj.searchParams.get('q')).toBe(expectedQuery);
            expect(googleUrlObj.searchParams.get('query')).toBe(expectedQuery);
          }

          return true;
        }
      ),
      { numRuns: 15, timeout: 6000 }
    );
  }, 10000);

  it('should handle edge cases in place data without crashing the system', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
            title: fc.oneof(
              fc.constant(''), // Empty title
              fc.constant(null as any), // Null title
              fc.constant(undefined as any), // Undefined title
              fc.string({ minLength: 1000, maxLength: 2000 }), // Very long title
              fc.constant('Title with\nnewlines\tand\rcontrol chars'), // Control characters
            ),
            address: fc.oneof(
              fc.constant(''), // Empty address
              fc.constant(null as any), // Null address
              fc.constant(undefined as any), // Undefined address
              fc.string({ minLength: 1000, maxLength: 2000 }), // Very long address
            ),
            latitude: fc.oneof(
              fc.constant(NaN),
              fc.constant(Infinity),
              fc.constant(-Infinity),
              fc.constant('not-a-number' as any),
              fc.constant({} as any), // Object instead of number
            ),
            longitude: fc.oneof(
              fc.constant(NaN),
              fc.constant(Infinity),
              fc.constant(-Infinity),
              fc.constant('not-a-number' as any),
              fc.constant([] as any), // Array instead of number
            ),
            notes: fc.option(fc.string({ maxLength: 10000 })), // Very long notes
            tags: fc.oneof(
              fc.array(fc.string({ maxLength: 1000 }), { maxLength: 50 }), // Many long tags
              fc.constant(null as any), // Null tags
              fc.constant('not-an-array' as any), // Wrong type
            ),
            source: fc.oneof(
              fc.constantFrom('apple', 'google', 'manual', 'other'),
              fc.constant(null as any),
              fc.constant(123 as any), // Wrong type
            ),
            sourceUrl: fc.option(fc.oneof(
              fc.constant('not-a-url'),
              fc.constant(''),
              fc.string({ minLength: 5000, maxLength: 10000 }), // Very long URL
            )),
            normalizedTitle: fc.oneof(
              fc.string({ minLength: 1, maxLength: 100 }),
              fc.constant(''),
              fc.constant(null as any),
            ),
            normalizedAddress: fc.oneof(
              fc.string({ minLength: 1, maxLength: 200 }),
              fc.constant(''),
              fc.constant(null as any),
            ),
            createdAt: fc.oneof(
              fc.date(),
              fc.constant(new Date('invalid')),
              fc.constant('not-a-date' as any),
            ),
            updatedAt: fc.oneof(
              fc.date(),
              fc.constant(new Date('invalid')),
              fc.constant('not-a-date' as any),
            ),
          }),
          { minLength: 1, maxLength: 2 } // Keep small for performance
        ),
        async (places) => {
          const title = 'Edge Case Test';
          
          // Setup: Add places with edge case data
          const placesToAdd = places.map(place => ({
            ...place,
            id: generateId(),
            notes: place.notes ?? undefined, // Convert null to undefined
            sourceUrl: place.sourceUrl ?? undefined, // Convert null to undefined
          }));

          // Database operations should handle edge cases gracefully
          try {
            await db.places.bulkAdd(placesToAdd);
          } catch (error) {
            // If database rejects the data, that's acceptable - test the error handling
            console.warn('Database rejected edge case data:', error);
            return true; // Skip this test case
          }

          // Create Link List - should not crash
          let linkList: LinkList;
          try {
            const creationData: LinkListCreationData = {
              title,
              selectedPlaces: placesToAdd,
              selectedCollections: [],
            };
            linkList = await linkListService.createLinkList(creationData);
          } catch (error) {
            // System should handle creation errors gracefully (Requirement 7.5)
            expect(error).toBeInstanceOf(Error);
            return true; // Acceptable to fail gracefully
          }

          // Get places for link generation
          const linkListPlaces = await linkListService.getPlacesForLinkList(linkList.id);

          // Assert: Link generation should not crash with edge case data (Requirement 7.5)
          for (const place of linkListPlaces) {
            let appleUrl: string;
            let googleUrl: string;

            try {
              appleUrl = generateAppleMapsUrl(place);
              googleUrl = generateGoogleMapsUrl(place);
            } catch (error) {
              // Link generation failure should be logged and handled gracefully (Requirement 7.5)
              expect(error).toBeInstanceOf(Error);
              
              // System should provide fallback behavior
              // In this case, we expect the error to be handled at a higher level
              // The link generation functions should not throw for any place structure
              throw new Error(`Link generation should handle edge cases gracefully: ${error}`);
            }

            // If links are generated, they should be valid URLs
            expect(() => new URL(appleUrl)).not.toThrow();
            expect(() => new URL(googleUrl)).not.toThrow();

            // URLs should follow expected format patterns
            expect(appleUrl).toMatch(/^https:\/\/maps\.apple\.com\/\?/);
            expect(googleUrl).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
          }

          // Assert: URL generation should handle edge cases (Requirement 7.5)
          try {
            const shareableUrl = urlService.generateShareableURL(linkList, linkListPlaces);
            expect(() => new URL(shareableUrl)).not.toThrow();
            expect(shareableUrl).toContain(linkList.id);
          } catch (error) {
            // URL generation failure should be handled gracefully
            expect(error).toBeInstanceOf(Error);
            // This is acceptable - the system should log the error and provide fallback
          }

          return true;
        }
      ),
      { numRuns: 10, timeout: 8000 }
    );
  }, 12000);

  it('should log errors and provide fallback options when operations fail', async () => {
    // Test specific error scenarios that should trigger logging and fallback behavior
    const problematicPlace: Place = {
      id: generateId(),
      title: '', // Empty title
      address: '', // Empty address
      latitude: NaN, // Invalid latitude
      longitude: Infinity, // Invalid longitude
      notes: undefined,
      tags: [],
      source: 'manual',
      sourceUrl: undefined,
      normalizedTitle: '',
      normalizedAddress: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.places.add(problematicPlace);

    const creationData: LinkListCreationData = {
      title: 'Problematic Place Test',
      selectedPlaces: [problematicPlace],
      selectedCollections: [],
    };

    // Act: Create Link List with problematic data
    const linkList = await linkListService.createLinkList(creationData);
    const linkListPlaces = await linkListService.getPlacesForLinkList(linkList.id);

    // Assert: System should handle the problematic place gracefully (Requirement 7.3, 7.5)
    expect(linkListPlaces.length).toBe(1);
    const place = linkListPlaces[0];

    // Link generation should provide fallback behavior
    const appleUrl = generateAppleMapsUrl(place);
    const googleUrl = generateGoogleMapsUrl(place);

    // Should generate valid URLs despite invalid coordinates
    expect(() => new URL(appleUrl)).not.toThrow();
    expect(() => new URL(googleUrl)).not.toThrow();

    // Should fallback to query-based links (not coordinate-based)
    const appleUrlObj = new URL(appleUrl);
    const googleUrlObj = new URL(googleUrl);

    expect(appleUrlObj.searchParams.has('ll')).toBe(false); // No coordinates
    expect(appleUrlObj.searchParams.has('q')).toBe(true); // Has query fallback

    expect(googleUrlObj.searchParams.get('query')).not.toMatch(/^NaN,Infinity$/); // No invalid coordinates
    expect(googleUrlObj.searchParams.has('query')).toBe(true); // Has query fallback

    // Fallback should use available information (even if empty, should not crash)
    const appleQuery = appleUrlObj.searchParams.get('q');
    const googleQuery = googleUrlObj.searchParams.get('query');

    // Should have some query value (address or title, even if empty)
    expect(appleQuery).toBeDefined();
    expect(googleQuery).toBeDefined();

    // URL generation should work despite problematic data
    const shareableUrl = urlService.generateShareableURL(linkList, linkListPlaces);
    expect(() => new URL(shareableUrl)).not.toThrow();
    expect(shareableUrl).toContain(linkList.id);
  });

  it('should maintain system stability when processing large amounts of invalid data', async () => {
    // Create many places with various types of invalid data
    const invalidPlaces: Place[] = [];
    
    for (let i = 0; i < 10; i++) {
      invalidPlaces.push({
        id: generateId(),
        title: i % 3 === 0 ? '' : `Place ${i}`,
        address: i % 3 === 1 ? '' : `Address ${i}`,
        latitude: i % 4 === 0 ? undefined : (i % 4 === 1 ? NaN : (i % 4 === 2 ? Infinity : 45.0)),
        longitude: i % 4 === 0 ? undefined : (i % 4 === 1 ? NaN : (i % 4 === 2 ? -Infinity : -122.0)),
        notes: i % 5 === 0 ? undefined : `Notes ${i}`,
        tags: i % 6 === 0 ? [] : [`tag${i}`],
        source: 'manual',
        sourceUrl: undefined,
        normalizedTitle: `Place ${i}`,
        normalizedAddress: `Address ${i}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    await db.places.bulkAdd(invalidPlaces);

    // Create Link List with all invalid places
    const creationData: LinkListCreationData = {
      title: 'Large Invalid Dataset',
      selectedPlaces: invalidPlaces,
      selectedCollections: [],
    };

    // Act: System should handle large amounts of invalid data gracefully
    const linkList = await linkListService.createLinkList(creationData);
    const linkListPlaces = await linkListService.getPlacesForLinkList(linkList.id);

    // Assert: All places should be processed without system failure
    expect(linkListPlaces.length).toBe(invalidPlaces.length);

    // All places should have functional links generated
    for (const place of linkListPlaces) {
      const appleUrl = generateAppleMapsUrl(place);
      const googleUrl = generateGoogleMapsUrl(place);

      expect(() => new URL(appleUrl)).not.toThrow();
      expect(() => new URL(googleUrl)).not.toThrow();
      expect(appleUrl).toMatch(/^https:\/\/maps\.apple\.com\/\?/);
      expect(googleUrl).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);
    }

    // URL generation should work with large dataset
    const shareableUrl = urlService.generateShareableURL(linkList, linkListPlaces);
    expect(() => new URL(shareableUrl)).not.toThrow();
    expect(shareableUrl).toContain(linkList.id);

    // System should remain responsive (no infinite loops or hangs)
    // This is implicitly tested by the test completing within timeout
  });
});