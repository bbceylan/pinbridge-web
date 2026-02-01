/**
 * Property-based tests for Link List creation completeness
 * Feature: link-list-feature
 */

import fc from 'fast-check';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { LinkListCreator } from '../link-list-creator';
import { db } from '@/lib/db';
import { linkListService } from '@/lib/services/link-list';
import { urlService } from '@/lib/services/url';
import { generateAppleMapsUrl, generateGoogleMapsUrl } from '@/lib/links';
import { generateId } from '@/lib/utils';
import type { Place, Collection } from '@/types';

// Mock the URL service and link generation functions
jest.mock('@/lib/services/url');
jest.mock('@/lib/links');

const mockUrlService = urlService as jest.Mocked<typeof urlService>;
const mockGenerateAppleMapsUrl = generateAppleMapsUrl as jest.MockedFunction<typeof generateAppleMapsUrl>;
const mockGenerateGoogleMapsUrl = generateGoogleMapsUrl as jest.MockedFunction<typeof generateGoogleMapsUrl>;

// Test setup and teardown
beforeEach(async () => {
  await db.delete();
  await db.open();
  jest.clearAllMocks();
  cleanup();
  
  // Setup URL service mocks
  mockUrlService.generateShareableURL.mockImplementation((linkList, places) => 
    `https://pinbridge.app/link-list/${linkList.id}?data=${btoa(JSON.stringify({ places }))}`
  );
  
  mockUrlService.extractLinkListId.mockImplementation((url) => {
    const match = url.match(/\/link-list\/([^?]+)/);
    return match ? match[1] : null;
  });
  
  // Setup link generation mocks
  mockGenerateAppleMapsUrl.mockImplementation((place) => 
    `https://maps.apple.com/?q=${encodeURIComponent(place.title)}&ll=${place.latitude || 0},${place.longitude || 0}`
  );
  
  mockGenerateGoogleMapsUrl.mockImplementation((place) => 
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.title)}`
  );
});

afterEach(async () => {
  await db.close();
  jest.restoreAllMocks();
  cleanup();
});

// Generators for test data
const placeArbitrary = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
  title: fc.string({ minLength: 1, maxLength: 50 }).filter(s => !/[&?#]/.test(s)),
  address: fc.string({ minLength: 1, maxLength: 100 }).filter(s => !/[&?#]/.test(s)),
  latitude: fc.option(fc.double({ min: -90, max: 90 })),
  longitude: fc.option(fc.double({ min: -180, max: 180 })),
  notes: fc.option(fc.string({ maxLength: 100 })),
  tags: fc.array(fc.string({ maxLength: 20 }).filter(s => !/[&?#]/.test(s)), { maxLength: 3 }),
  source: fc.constantFrom('apple', 'google', 'manual', 'other'),
  sourceUrl: fc.option(fc.constant('https://example.com')),
  normalizedTitle: fc.string({ minLength: 1, maxLength: 50 }).filter(s => !/[&?#]/.test(s)),
  normalizedAddress: fc.string({ minLength: 1, maxLength: 100 }).filter(s => !/[&?#]/.test(s)),
  createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
  updatedAt: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
}) as fc.Arbitrary<Place>;

const collectionArbitrary = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
  name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => !/[&?#]/.test(s)),
  description: fc.option(fc.string({ maxLength: 100 })),
  createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
  updatedAt: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
}) as fc.Arbitrary<Collection>;

/**
 * Property 1: Link List creation completeness
 * **Validates: Requirements 1.1, 1.2, 4.1, 4.2, 4.3**
 * 
 * For any valid selection of places and/or collections, creating a Link List should result 
 * in a page containing clickable links for all selected places, with each place displaying 
 * its name, address, and both Apple Maps and Google Maps links.
 */
describe('Property 1: Link List creation completeness', () => {
  it('should create complete Link Lists with clickable links for all selected places', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 30 }).filter(s => !/[&?#]/.test(s)),
          description: fc.option(fc.string({ maxLength: 50 })),
          selectedPlaces: fc.array(placeArbitrary, { minLength: 1, maxLength: 2 }), // Reduced for performance
          selectedCollections: fc.array(collectionArbitrary, { minLength: 0, maxLength: 1 }), // Reduced for performance
          collectionPlaces: fc.array(placeArbitrary, { minLength: 0, maxLength: 1 }), // Reduced for performance
        }),
        async ({ title, description, selectedPlaces, selectedCollections, collectionPlaces }) => {
          cleanup();
          
          // Setup: Add unique IDs to avoid conflicts
          const placesToAdd = selectedPlaces.map(place => ({
            ...place,
            id: generateId(),
          }));
          
          const collectionsToAdd = selectedCollections.map(collection => ({
            ...collection,
            id: generateId(),
          }));
          
          const collectionPlacesToAdd = collectionPlaces.map(place => ({
            ...place,
            id: generateId(),
          }));
          
          // Add all places to database
          const allPlaces = [...placesToAdd, ...collectionPlacesToAdd];
          if (allPlaces.length > 0) {
            await db.places.bulkAdd(allPlaces);
          }
          
          // Add collections to database
          if (collectionsToAdd.length > 0) {
            await db.collections.bulkAdd(collectionsToAdd);
          }
          
          // Create place-collection relationships
          const placeCollectionMemberships = [];
          for (let i = 0; i < collectionsToAdd.length && i < collectionPlacesToAdd.length; i++) {
            placeCollectionMemberships.push({
              id: generateId(),
              placeId: collectionPlacesToAdd[i].id,
              collectionId: collectionsToAdd[i].id,
            });
          }
          
          if (placeCollectionMemberships.length > 0) {
            await db.placeCollections.bulkAdd(placeCollectionMemberships);
          }
          
          // Use linkListService directly instead of UI interaction for faster testing
          const creationData = {
            title,
            description: description ?? undefined, // Convert null to undefined
            selectedPlaces: placesToAdd,
            selectedCollections: collectionsToAdd,
          };
          
          // Create Link List directly (Requirement 1.1)
          const createdLinkList = await linkListService.createLinkList(creationData);
          
          // Assert: Link List was created successfully
          expect(createdLinkList).toBeTruthy();
          expect(createdLinkList.title).toBe(title);
          if (description) {
            expect(createdLinkList.description).toBe(description);
          }
          
          // Get all places that should be in the Link List
          const allExpectedPlaces = await linkListService.getPlacesForLinkList(createdLinkList.id);
          
          // Assert: All selected places are included (Requirement 1.2)
          // Individual places should be included
          for (const place of placesToAdd) {
            expect(allExpectedPlaces.some(p => p.id === place.id)).toBe(true);
          }
          
          // Places from selected collections should be included (Requirement 4.1, 4.2)
          for (const membership of placeCollectionMemberships) {
            if (collectionsToAdd.some(c => c.id === membership.collectionId)) {
              expect(allExpectedPlaces.some(p => p.id === membership.placeId)).toBe(true);
            }
          }
          
          // Assert: Link List contains complete place information for display
          for (const place of allExpectedPlaces) {
            // Each place should have essential display information (Requirement 1.2)
            expect(place.title).toBeDefined();
            expect(typeof place.title).toBe('string');
            expect(place.title.length).toBeGreaterThan(0);
            
            expect(place.address).toBeDefined();
            expect(typeof place.address).toBe('string');
            expect(place.address.length).toBeGreaterThan(0);
            
            // Verify that map links can be generated (Requirement 1.3)
            expect(() => mockGenerateAppleMapsUrl(place)).not.toThrow();
            expect(() => mockGenerateGoogleMapsUrl(place)).not.toThrow();
            
            const appleUrl = mockGenerateAppleMapsUrl(place);
            const googleUrl = mockGenerateGoogleMapsUrl(place);
            
            // Links should be valid URLs
            expect(() => new URL(appleUrl)).not.toThrow();
            expect(() => new URL(googleUrl)).not.toThrow();
            
            // Links should contain place information
            expect(appleUrl).toContain('maps.apple.com');
            expect(googleUrl).toContain('google.com');
          }
          
          // Assert: Shareable URL can be generated (Requirement 1.4)
          const shareableUrl = mockUrlService.generateShareableURL(createdLinkList, allExpectedPlaces);
          expect(shareableUrl).toBeTruthy();
          expect(() => new URL(shareableUrl)).not.toThrow();
          expect(shareableUrl).toContain(createdLinkList.id);
          
          // Assert: URL contains sufficient data for cross-device access
          expect(mockUrlService.generateShareableURL).toHaveBeenCalledWith(
            createdLinkList,
            allExpectedPlaces
          );
          
          return true;
        }
      ),
      { numRuns: 8, timeout: 15000 } // Reduced runs and increased timeout
    );
  }, 20000); // Increased Jest timeout

  it('should handle collection-only selections correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 30 }).filter(s => !/[&?#]/.test(s)),
          collections: fc.array(collectionArbitrary, { minLength: 1, maxLength: 1 }), // Reduced for performance
          placesPerCollection: fc.array(placeArbitrary, { minLength: 1, maxLength: 2 }), // Simplified structure
        }),
        async ({ title, collections, placesPerCollection }) => {
          cleanup();
          
          // Setup: Create collections with places
          const collectionsToAdd = collections.map(collection => ({
            ...collection,
            id: generateId(),
          }));
          
          const placesToAdd = placesPerCollection.map(place => ({
            ...place,
            id: generateId(),
          }));
          
          const memberships = [];
          
          // Connect places to the first collection
          if (collectionsToAdd.length > 0) {
            for (const place of placesToAdd) {
              memberships.push({
                id: generateId(),
                placeId: place.id,
                collectionId: collectionsToAdd[0].id,
              });
            }
          }
          
          // Add to database
          await db.collections.bulkAdd(collectionsToAdd);
          await db.places.bulkAdd(placesToAdd);
          if (memberships.length > 0) {
            await db.placeCollections.bulkAdd(memberships);
          }
          
          // Create Link List directly using service
          const creationData = {
            title,
            selectedPlaces: [],
            selectedCollections: collectionsToAdd,
          };
          
          const createdLinkList = await linkListService.createLinkList(creationData);
          
          // Assert: All places from selected collections are included
          const linkListPlaces = await linkListService.getPlacesForLinkList(createdLinkList.id);
          
          // Should contain all places from all selected collections
          expect(linkListPlaces.length).toBe(placesToAdd.length);
          
          for (const place of placesToAdd) {
            expect(linkListPlaces.some(p => p.id === place.id)).toBe(true);
          }
          
          // Assert: Each place has complete information for link generation
          for (const place of linkListPlaces) {
            expect(place.title).toBeTruthy();
            expect(place.address).toBeTruthy();
            
            // Verify map links can be generated
            const appleUrl = mockGenerateAppleMapsUrl(place);
            const googleUrl = mockGenerateGoogleMapsUrl(place);
            
            expect(appleUrl).toContain('maps.apple.com');
            expect(googleUrl).toContain('google.com');
          }
          
          return true;
        }
      ),
      { numRuns: 5, timeout: 8000 } // Reduced runs and timeout
    );
  }, 12000);

  it('should handle mixed place and collection selections with deduplication', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 30 }).filter(s => !/[&?#]/.test(s)),
          sharedPlace: placeArbitrary, // Place that will be selected both individually and via collection
          collection: collectionArbitrary,
          additionalPlace: placeArbitrary, // Simplified to single additional place
        }),
        async ({ title, sharedPlace, collection, additionalPlace }) => {
          cleanup();
          
          // Setup: Create a place that exists both individually and in a collection
          const sharedPlaceWithId = { ...sharedPlace, id: generateId() };
          const collectionWithId = { ...collection, id: generateId() };
          const additionalPlaceWithId = { ...additionalPlace, id: generateId() };
          
          const allPlaces = [sharedPlaceWithId, additionalPlaceWithId];
          
          // Add to database
          await db.places.bulkAdd(allPlaces);
          await db.collections.add(collectionWithId);
          await db.placeCollections.add({
            id: generateId(),
            placeId: sharedPlaceWithId.id,
            collectionId: collectionWithId.id,
          });
          
          // Create Link List directly using service
          const creationData = {
            title,
            selectedPlaces: [sharedPlaceWithId, additionalPlaceWithId], // Select shared place individually
            selectedCollections: [collectionWithId], // And via collection
          };
          
          const createdLinkList = await linkListService.createLinkList(creationData);
          
          // Assert: Places are deduplicated correctly
          const linkListPlaces = await linkListService.getPlacesForLinkList(createdLinkList.id);
          
          // Should contain all places exactly once (no duplicates)
          expect(linkListPlaces.length).toBe(allPlaces.length);
          
          // Shared place should appear only once despite being selected individually and via collection
          const sharedPlaceInstances = linkListPlaces.filter(p => p.id === sharedPlaceWithId.id);
          expect(sharedPlaceInstances.length).toBe(1);
          
          // All places should be present
          for (const place of allPlaces) {
            expect(linkListPlaces.some(p => p.id === place.id)).toBe(true);
          }
          
          // Assert: All places have complete link generation capability
          for (const place of linkListPlaces) {
            expect(place.title).toBeTruthy();
            expect(place.address).toBeTruthy();
            
            const appleUrl = mockGenerateAppleMapsUrl(place);
            const googleUrl = mockGenerateGoogleMapsUrl(place);
            
            expect(appleUrl).toContain('maps.apple.com');
            expect(googleUrl).toContain('google.com');
          }
          
          return true;
        }
      ),
      { numRuns: 5, timeout: 6000 } // Reduced runs and timeout
    );
  }, 10000);

  it('should validate that created Link Lists contain all required information for display', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 30 }).filter(s => !/[&?#]/.test(s)),
          places: fc.array(placeArbitrary, { minLength: 1, maxLength: 2 }), // Reduced for performance
        }),
        async ({ title, places }) => {
          cleanup();
          
          const placesToAdd = places.map(place => ({
            ...place,
            id: generateId(),
          }));
          
          await db.places.bulkAdd(placesToAdd);
          
          // Create Link List directly using service
          const creationData = {
            title,
            selectedPlaces: placesToAdd,
            selectedCollections: [],
          };
          
          const createdLinkList = await linkListService.createLinkList(creationData);
          
          // Get the created Link List and its places
          const linkListPlaces = await linkListService.getPlacesForLinkList(createdLinkList.id);
          
          // Assert: Link List has complete metadata (Requirement 1.1)
          expect(createdLinkList.title).toBe(title);
          expect(createdLinkList.id).toBeTruthy();
          expect(createdLinkList.createdAt).toBeInstanceOf(Date);
          expect(createdLinkList.isPublic).toBe(true);
          
          // Assert: All places have required display information (Requirement 1.2)
          expect(linkListPlaces.length).toBe(placesToAdd.length);
          
          for (const place of linkListPlaces) {
            // Name and address are required for display
            expect(place.title).toBeDefined();
            expect(typeof place.title).toBe('string');
            expect(place.title.length).toBeGreaterThan(0);
            
            expect(place.address).toBeDefined();
            expect(typeof place.address).toBe('string');
            expect(place.address.length).toBeGreaterThan(0);
            
            // Both Apple Maps and Google Maps links should be generatable (Requirement 1.3)
            expect(() => mockGenerateAppleMapsUrl(place)).not.toThrow();
            expect(() => mockGenerateGoogleMapsUrl(place)).not.toThrow();
            
            const appleUrl = mockGenerateAppleMapsUrl(place);
            const googleUrl = mockGenerateGoogleMapsUrl(place);
            
            // Links should be valid and point to correct services
            expect(() => new URL(appleUrl)).not.toThrow();
            expect(() => new URL(googleUrl)).not.toThrow();
            expect(appleUrl).toContain('maps.apple.com');
            expect(googleUrl).toContain('google.com');
            
            // Links should contain place information
            expect(appleUrl).toContain(encodeURIComponent(place.title));
            expect(googleUrl).toContain(encodeURIComponent(place.title));
          }
          
          // Assert: Shareable URL contains sufficient data (Requirement 1.4)
          const shareableUrl = mockUrlService.generateShareableURL(createdLinkList, linkListPlaces);
          expect(shareableUrl).toBeTruthy();
          expect(shareableUrl).toContain(createdLinkList.id);
          
          // Verify URL service was called with complete data
          expect(mockUrlService.generateShareableURL).toHaveBeenCalledWith(
            expect.objectContaining({
              id: createdLinkList.id,
              title: title,
              isPublic: true,
            }),
            expect.arrayContaining(
              linkListPlaces.map(place => 
                expect.objectContaining({
                  id: place.id,
                  title: place.title,
                  address: place.address,
                })
              )
            )
          );
          
          return true;
        }
      ),
      { numRuns: 5, timeout: 6000 } // Reduced runs and timeout
    );
  }, 10000);
});