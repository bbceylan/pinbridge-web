/**
 * Property-based tests for LinkList data model
 * Feature: link-list-feature
 */

import fc from 'fast-check';
import { db } from '@/lib/db';
import { linkListService, type LinkListCreationData } from '../link-list';
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

// Generators for test data
const placeArbitrary = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }),
  title: fc.string({ minLength: 1, maxLength: 100 }),
  address: fc.string({ minLength: 1, maxLength: 200 }),
  latitude: fc.option(fc.double({ min: -90, max: 90 })),
  longitude: fc.option(fc.double({ min: -180, max: 180 })),
  notes: fc.option(fc.string({ maxLength: 500 })),
  tags: fc.array(fc.string({ maxLength: 50 }), { maxLength: 5 }),
  source: fc.constantFrom('apple', 'google', 'manual', 'other'),
  sourceUrl: fc.option(fc.webUrl()),
  normalizedTitle: fc.string({ minLength: 1, maxLength: 100 }),
  normalizedAddress: fc.string({ minLength: 1, maxLength: 200 }),
  createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
  updatedAt: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
}) as fc.Arbitrary<Place>;

const collectionArbitrary = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  description: fc.option(fc.string({ maxLength: 500 })),
  createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
  updatedAt: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
}) as fc.Arbitrary<Collection>;

const linkListCreationDataArbitrary = fc.record({
  title: fc.string({ minLength: 1, maxLength: 100 }),
  description: fc.option(fc.string({ maxLength: 500 })),
  selectedPlaces: fc.array(placeArbitrary, { minLength: 0, maxLength: 5 }),
  selectedCollections: fc.array(collectionArbitrary, { minLength: 0, maxLength: 3 }),
}) as fc.Arbitrary<LinkListCreationData>;

/**
 * Property 8: Data storage efficiency
 * **Validates: Requirements 8.1, 8.2, 8.4**
 * 
 * For any Link List creation, the system should store minimal metadata that references 
 * existing place data rather than duplicating it, while maintaining referential integrity 
 * with the existing Dexie.js IndexedDB implementation.
 */
describe('Property 8: Data storage efficiency', () => {
  it('should store minimal metadata while maintaining referential integrity', async () => {
    await fc.assert(
      fc.asyncProperty(linkListCreationDataArbitrary, async (creationData) => {
        // Skip test cases with no places or collections
        if (creationData.selectedPlaces.length === 0 && creationData.selectedCollections.length === 0) {
          return true;
        }

        // Setup: Add places and collections to database first
        const placesToAdd = creationData.selectedPlaces.map(place => ({
          ...place,
          id: generateId(), // Ensure unique IDs
        }));
        
        const collectionsToAdd = creationData.selectedCollections.map(collection => ({
          ...collection,
          id: generateId(), // Ensure unique IDs
        }));

        // Add places to database
        if (placesToAdd.length > 0) {
          await db.places.bulkAdd(placesToAdd);
        }

        // Add collections to database
        if (collectionsToAdd.length > 0) {
          await db.collections.bulkAdd(collectionsToAdd);
        }

        // Add place-collection relationships for collections
        const placeCollectionMemberships = [];
        for (const collection of collectionsToAdd) {
          // Add some places to each collection
          const placesInCollection = placesToAdd.slice(0, Math.min(3, placesToAdd.length));
          for (const place of placesInCollection) {
            placeCollectionMemberships.push({
              id: generateId(),
              placeId: place.id,
              collectionId: collection.id,
            });
          }
        }
        
        if (placeCollectionMemberships.length > 0) {
          await db.placeCollections.bulkAdd(placeCollectionMemberships);
        }

        // Update creation data with actual database IDs
        const updatedCreationData: LinkListCreationData = {
          ...creationData,
          selectedPlaces: placesToAdd,
          selectedCollections: collectionsToAdd,
        };

        // Act: Create LinkList
        const linkList = await linkListService.createLinkList(updatedCreationData);

        // Assert: Verify data storage efficiency (Requirement 8.1)
        // LinkList should store only IDs, not full place/collection data
        expect(linkList.placeIds).toBeDefined();
        expect(linkList.collectionIds).toBeDefined();
        expect(linkList).not.toHaveProperty('places'); // Should not store full place objects
        expect(linkList).not.toHaveProperty('collections'); // Should not store full collection objects

        // Assert: Verify minimal metadata storage (Requirement 8.1)
        const storedLinkList = await db.linkLists.get(linkList.id);
        expect(storedLinkList).toBeDefined();
        
        // Should only store essential metadata
        const expectedKeys = ['id', 'title', 'description', 'placeIds', 'collectionIds', 'createdAt', 'updatedAt', 'isPublic'];
        const actualKeys = Object.keys(storedLinkList!);
        
        // All actual keys should be in expected keys (no extra data stored)
        for (const key of actualKeys) {
          expect(expectedKeys).toContain(key);
        }

        // Assert: Verify referential integrity with existing Dexie.js implementation (Requirement 8.2, 8.4)
        // All referenced place IDs should exist in places table
        if (linkList.placeIds.length > 0) {
          const referencedPlaces = await db.places.where('id').anyOf(linkList.placeIds).toArray();
          expect(referencedPlaces.length).toBeGreaterThan(0);
          
          // All place IDs in LinkList should reference actual places
          const referencedPlaceIds = referencedPlaces.map(p => p.id);
          for (const placeId of linkList.placeIds) {
            expect(referencedPlaceIds).toContain(placeId);
          }
        }

        // All referenced collection IDs should exist in collections table
        if (linkList.collectionIds.length > 0) {
          const referencedCollections = await db.collections.where('id').anyOf(linkList.collectionIds).toArray();
          expect(referencedCollections.length).toBeGreaterThan(0);
          
          // All collection IDs in LinkList should reference actual collections
          const referencedCollectionIds = referencedCollections.map(c => c.id);
          for (const collectionId of linkList.collectionIds) {
            expect(referencedCollectionIds).toContain(collectionId);
          }
        }

        // Assert: Verify efficient querying capability (Requirement 8.4)
        // Should be able to efficiently retrieve places for the LinkList
        const placesForLinkList = await linkListService.getPlacesForLinkList(linkList.id);
        
        // Should return actual place objects, not just IDs
        if (linkList.placeIds.length > 0) {
          expect(placesForLinkList.length).toBeGreaterThan(0);
          expect(placesForLinkList[0]).toHaveProperty('title');
          expect(placesForLinkList[0]).toHaveProperty('address');
        }

        // Should be able to efficiently retrieve collections for the LinkList
        const collectionsForLinkList = await linkListService.getCollectionsForLinkList(linkList.id);
        
        // Should return actual collection objects, not just IDs
        if (linkList.collectionIds.length > 0) {
          expect(collectionsForLinkList.length).toBeGreaterThan(0);
          expect(collectionsForLinkList[0]).toHaveProperty('name');
        }

        // Assert: Verify no data duplication
        // The size of stored LinkList should be minimal compared to full place/collection data
        const linkListSize = JSON.stringify(storedLinkList).length;
        const fullDataSize = JSON.stringify({
          ...storedLinkList,
          places: placesForLinkList,
          collections: collectionsForLinkList,
        }).length;
        
        // LinkList storage should be smaller than storing full data
        // Only check this if there's meaningful data to compare
        if (placesForLinkList.length > 0 || collectionsForLinkList.length > 0) {
          expect(linkListSize).toBeLessThan(fullDataSize);
          
          // If there's substantial data, it should be significantly smaller
          if (placesForLinkList.length > 2 || collectionsForLinkList.length > 1) {
            expect(linkListSize).toBeLessThan(fullDataSize * 0.7); // At least 30% smaller
          }
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });
});