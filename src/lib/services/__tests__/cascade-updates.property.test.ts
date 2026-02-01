/**
 * Property-based tests for cascade updates
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

// Generator for valid places
const placeArbitrary = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
  title: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  address: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  latitude: fc.option(fc.double({ min: -90, max: 90 })),
  longitude: fc.option(fc.double({ min: -180, max: 180 })),
  notes: fc.option(fc.string({ maxLength: 200 })),
  tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 3 }),
  source: fc.constantFrom('apple', 'google', 'manual', 'other'),
  sourceUrl: fc.option(fc.webUrl()),
  normalizedTitle: fc.string({ minLength: 1, maxLength: 50 }),
  normalizedAddress: fc.string({ minLength: 1, maxLength: 100 }),
  createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
  updatedAt: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
}) as fc.Arbitrary<Place>;

// Generator for valid collections
const collectionArbitrary = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
  name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  description: fc.option(fc.string({ maxLength: 200 })),
  createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
  updatedAt: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
}) as fc.Arbitrary<Collection>;

// Generator for link list creation scenarios (simplified)
const linkListScenarioArbitrary = fc.record({
  places: fc.array(placeArbitrary, { minLength: 1, maxLength: 3 }),
  collections: fc.array(collectionArbitrary, { minLength: 0, maxLength: 2 }),
  linkListsToCreate: fc.array(
    fc.record({
      title: fc.string({ minLength: 1, maxLength: 30 }),
      description: fc.option(fc.string({ maxLength: 50 })),
      selectedPlaceIndices: fc.array(fc.integer({ min: 0, max: 2 }), { maxLength: 2 }),
      selectedCollectionIndices: fc.array(fc.integer({ min: 0, max: 1 }), { maxLength: 1 }),
    }),
    { minLength: 1, maxLength: 2 }
  ),
});

/**
 * Property 9: Cascade updates
 * **Validates: Requirements 8.5**
 * 
 * For any place that is deleted from the system, all Link Lists referencing that place 
 * should be updated to remove the reference or be marked as containing missing data.
 */
describe('Property 9: Cascade updates', () => {
  it('should update all affected Link Lists when places are deleted', async () => {
    await fc.assert(
      fc.asyncProperty(
        linkListScenarioArbitrary,
        async (scenario) => {
          // Setup: Create unique places and collections
          const places = scenario.places.map(place => ({
            ...place,
            id: generateId(), // Ensure unique IDs
          }));

          const collections = scenario.collections.map(collection => ({
            ...collection,
            id: generateId(), // Ensure unique IDs
          }));

          // Add places and collections to database
          await db.places.bulkAdd(places);
          await db.collections.bulkAdd(collections);

          // Create place-collection relationships for some places
          const placeCollectionMemberships = [];
          for (let i = 0; i < Math.min(places.length, collections.length); i++) {
            if (Math.random() > 0.5) { // 50% chance of membership
              placeCollectionMemberships.push({
                id: generateId(),
                placeId: places[i].id,
                collectionId: collections[i % collections.length].id,
              });
            }
          }
          if (placeCollectionMemberships.length > 0) {
            await db.placeCollections.bulkAdd(placeCollectionMemberships);
          }

          // Create Link Lists based on scenario
          const createdLinkLists: LinkList[] = [];
          for (const linkListSpec of scenario.linkListsToCreate) {
            const selectedPlaces = linkListSpec.selectedPlaceIndices
              .filter(index => index < places.length)
              .map(index => places[index]);
            
            const selectedCollections = linkListSpec.selectedCollectionIndices
              .filter(index => index < collections.length)
              .map(index => collections[index]);

            if (selectedPlaces.length > 0 || selectedCollections.length > 0) {
              const creationData: LinkListCreationData = {
                title: linkListSpec.title,
                description: linkListSpec.description,
                selectedPlaces,
                selectedCollections,
              };

              const linkList = await linkListService.createLinkList(creationData);
              createdLinkLists.push(linkList);
            }
          }

          // Skip test if no Link Lists were created
          if (createdLinkLists.length === 0) {
            return true;
          }

          // Record initial state of Link Lists
          const initialLinkListStates = new Map<string, { placeIds: string[], collectionIds: string[] }>();
          for (const linkList of createdLinkLists) {
            initialLinkListStates.set(linkList.id, {
              placeIds: [...linkList.placeIds],
              collectionIds: [...linkList.collectionIds],
            });
          }

          // Select a random place to delete (that exists in at least one Link List)
          const placesInLinkLists = new Set<string>();
          createdLinkLists.forEach(ll => ll.placeIds.forEach(id => placesInLinkLists.add(id)));
          
          if (placesInLinkLists.size === 0) {
            return true; // Skip if no places in Link Lists
          }

          const placeToDelete = Array.from(placesInLinkLists)[0]; // Take first place
          const placeToDeleteObj = places.find(p => p.id === placeToDelete);
          
          if (!placeToDeleteObj) {
            return true; // Skip if place not found
          }

          // Act: Delete the place and handle cascade updates (Requirement 8.5)
          const cascadeResult = await linkListService.handlePlaceDeletion(placeToDelete);

          // Assert: Cascade result should contain information about affected Link Lists
          expect(cascadeResult).toBeDefined();
          expect(cascadeResult.updatedLinkLists).toBeDefined();
          expect(cascadeResult.deletedLinkLists).toBeDefined();
          expect(Array.isArray(cascadeResult.updatedLinkLists)).toBe(true);
          expect(Array.isArray(cascadeResult.deletedLinkLists)).toBe(true);

          // Assert: Total affected Link Lists should match expected count
          const affectedLinkListIds = new Set([
            ...cascadeResult.updatedLinkLists.map(ll => ll.id),
            ...cascadeResult.deletedLinkLists.map(ll => ll.id),
          ]);

          const expectedAffectedCount = createdLinkLists.filter(ll => 
            ll.placeIds.includes(placeToDelete)
          ).length;

          expect(affectedLinkListIds.size).toBe(expectedAffectedCount);

          // Assert: Each affected Link List should be handled appropriately (Requirement 8.5)
          for (const linkList of createdLinkLists) {
            const initialState = initialLinkListStates.get(linkList.id)!;
            const wasAffected = initialState.placeIds.includes(placeToDelete);

            if (wasAffected) {
              const updatedLinkList = cascadeResult.updatedLinkLists.find(ll => ll.id === linkList.id);
              const deletedLinkList = cascadeResult.deletedLinkLists.find(ll => ll.id === linkList.id);

              // Link List should be either updated or deleted, not both
              expect((updatedLinkList !== undefined) !== (deletedLinkList !== undefined)).toBe(true);

              if (updatedLinkList) {
                // Updated Link List should no longer contain the deleted place
                expect(updatedLinkList.placeIds).not.toContain(placeToDelete);
                
                // Other places should remain unchanged
   
                const otherPlaceIds = initialState.placeIds.filter(id => id !== placeToDelete);
                expect(updatedLinkList.placeIds).toEqual(expect.arrayContaining(otherPlaceIds));
                
                // Collections should remain unchanged
                expect(updatedLinkList.collectionIds).toEqual(initialState.collectionIds);
                
                // Updated timestamp should be more recent
                expect(new Date(updatedLinkList.updatedAt).getTime()).toBeGreaterThan(
                  new Date(linkList.updatedAt).getTime()
                );

                // Verify the Link List still exists in database
                const dbLinkList = await linkListService.getLinkList(linkList.id);
                expect(dbLinkList).toBeDefined();
                expect(dbLinkList!.placeIds).not.toContain(placeToDelete);
              }

              if (deletedLinkList) {
                // Deleted Link List should have had only the deleted place and no collections
                // OR all remaining places after deletion would be empty and no collections
                const hadOnlyDeletedPlace = initialState.placeIds.length === 1 && 
                                          initialState.placeIds[0] === placeToDelete &&
                                          initialState.collectionIds.length === 0;
                const wouldBeEmptyAfterDeletion = initialState.placeIds.filter(id => id !== placeToDelete).length === 0 &&
                                                initialState.collectionIds.length === 0;
                expect(hadOnlyDeletedPlace || wouldBeEmptyAfterDeletion).toBe(true);

                // Verify the Link List no longer exists in database
                const dbLinkList = await linkListService.getLinkList(linkList.id);
                expect(dbLinkList).toBeNull();
              }
            } else {
              // Unaffected Link Lists should not appear in cascade results
              expect(cascadeResult.updatedLinkLists.find(ll => ll.id === linkList.id)).toBeUndefined();
              expect(cascadeResult.deletedLinkLists.find(ll => ll.id === linkList.id)).toBeUndefined();

              // Unaffected Link Lists should remain unchanged in database
              const dbLinkList = await linkListService.getLinkList(linkList.id);
              expect(dbLinkList).toBeDefined();
              expect(dbLinkList!.placeIds).toEqual(initialState.placeIds);
              expect(dbLinkList!.collectionIds).toEqual(initialState.collectionIds);
            }
          }

          // Assert: Database integrity should be maintained (Requirement 8.5)
          // All remaining Link Lists should have valid place references
          const remainingLinkLists = await linkListService.getUserLinkLists();
          for (const linkList of remainingLinkLists) {
            for (const placeId of linkList.placeIds) {
              expect(placeId).not.toBe(placeToDelete);
              
              // Verify place still exists in database (unless it was the deleted one)
              if (placeId !== placeToDelete) {
                const place = await db.places.get(placeId);
                expect(place).toBeDefined();
              }
            }
          }

          return true;
        }
      ),
      { numRuns: 25, timeout: 15000 }
    );
  }, 20000);

  it('should update all affected Link Lists when collections are deleted', async () => {
    await fc.assert(
      fc.asyncProperty(
        linkListScenarioArbitrary.filter(scenario => scenario.collections.length > 0),
        async (scenario) => {
          // Setup: Create unique places and collections
          const places = scenario.places.map(place => ({
            ...place,
            id: generateId(),
          }));

          const collections = scenario.collections.map(collection => ({
            ...collection,
            id: generateId(),
          }));

          // Add places and collections to database
          await db.places.bulkAdd(places);
          await db.collections.bulkAdd(collections);

          // Create place-collection relationships
          const placeCollectionMemberships = [];
          for (let i = 0; i < Math.min(places.length, collections.length); i++) {
            placeCollectionMemberships.push({
              id: generateId(),
              placeId: places[i].id,
              collectionId: collections[i % collections.length].id,
            });
          }
          if (placeCollectionMemberships.length > 0) {
            await db.placeCollections.bulkAdd(placeCollectionMemberships);
          }

          // Create Link Lists that include collections
          const createdLinkLists: LinkList[] = [];
          for (const linkListSpec of scenario.linkListsToCreate) {
            const selectedPlaces = linkListSpec.selectedPlaceIndices
              .filter(index => index < places.length)
              .map(index => places[index]);
            
            const selectedCollections = linkListSpec.selectedCollectionIndices
              .filter(index => index < collections.length)
              .map(index => collections[index]);

            // Only create Link Lists that have collections
            if (selectedCollections.length > 0) {
              const creationData: LinkListCreationData = {
                title: linkListSpec.title,
                description: linkListSpec.description,
                selectedPlaces,
                selectedCollections,
              };

              const linkList = await linkListService.createLinkList(creationData);
              createdLinkLists.push(linkList);
            }
          }

          // Skip test if no Link Lists with collections were created
          if (createdLinkLists.length === 0) {
            return true;
          }

          // Record initial state of Link Lists
          const initialLinkListStates = new Map<string, { placeIds: string[], collectionIds: string[] }>();
          for (const linkList of createdLinkLists) {
            initialLinkListStates.set(linkList.id, {
              placeIds: [...linkList.placeIds],
              collectionIds: [...linkList.collectionIds],
            });
          }

          // Select a random collection to delete (that exists in at least one Link List)
          const collectionsInLinkLists = new Set<string>();
          createdLinkLists.forEach(ll => ll.collectionIds.forEach(id => collectionsInLinkLists.add(id)));
          
          if (collectionsInLinkLists.size === 0) {
            return true; // Skip if no collections in Link Lists
          }

          const collectionToDelete = Array.from(collectionsInLinkLists)[0];
          const collectionToDeleteObj = collections.find(c => c.id === collectionToDelete);
          
          if (!collectionToDeleteObj) {
            return true; // Skip if collection not found
          }

          // Act: Delete the collection and handle cascade updates (Requirement 8.5)
          const cascadeResult = await linkListService.handleCollectionDeletion(collectionToDelete);

          // Assert: Cascade result should contain information about affected Link Lists
          expect(cascadeResult).toBeDefined();
          expect(cascadeResult.updatedLinkLists).toBeDefined();
          expect(cascadeResult.deletedLinkLists).toBeDefined();
          expect(Array.isArray(cascadeResult.updatedLinkLists)).toBe(true);
          expect(Array.isArray(cascadeResult.deletedLinkLists)).toBe(true);

          // Assert: Total affected Link Lists should match expected count
          const affectedLinkListIds = new Set([
            ...cascadeResult.updatedLinkLists.map(ll => ll.id),
            ...cascadeResult.deletedLinkLists.map(ll => ll.id),
          ]);

          const expectedAffectedCount = createdLinkLists.filter(ll => 
            ll.collectionIds.includes(collectionToDelete)
          ).length;

          expect(affectedLinkListIds.size).toBe(expectedAffectedCount);

          // Assert: Each affected Link List should be handled appropriately (Requirement 8.5)
          for (const linkList of createdLinkLists) {
            const initialState = initialLinkListStates.get(linkList.id)!;
            const wasAffected = initialState.collectionIds.includes(collectionToDelete);

            if (wasAffected) {
              const updatedLinkList = cascadeResult.updatedLinkLists.find(ll => ll.id === linkList.id);
              const deletedLinkList = cascadeResult.deletedLinkLists.find(ll => ll.id === linkList.id);

              // Link List should be either updated or deleted, not both
              expect((updatedLinkList !== undefined) !== (deletedLinkList !== undefined)).toBe(true);

              if (updatedLinkList) {
                // Updated Link List should no longer contain the deleted collection
                expect(updatedLinkList.collectionIds).not.toContain(collectionToDelete);
                
                // Other collections should remain unchanged
                const otherCollectionIds = initialState.collectionIds.filter(id => id !== collectionToDelete);
                expect(updatedLinkList.collectionIds).toEqual(expect.arrayContaining(otherCollectionIds));
                
                // Places should remain unchanged
                expect(updatedLinkList.placeIds).toEqual(initialState.placeIds);
                
                // Updated timestamp should be more recent
                expect(new Date(updatedLinkList.updatedAt).getTime()).toBeGreaterThan(
                  new Date(linkList.updatedAt).getTime()
                );

                // Verify the Link List still exists in database
                const dbLinkList = await linkListService.getLinkList(linkList.id);
                expect(dbLinkList).toBeDefined();
                expect(dbLinkList!.collectionIds).not.toContain(collectionToDelete);
              }

              if (deletedLinkList) {
                // Deleted Link List should have had only the deleted collection and no places
                // OR all remaining collections after deletion would be empty and no places
                const hadOnlyDeletedCollection = initialState.collectionIds.length === 1 && 
                                               initialState.collectionIds[0] === collectionToDelete &&
                                               initialState.placeIds.length === 0;
                const wouldBeEmptyAfterDeletion = initialState.collectionIds.filter(id => id !== collectionToDelete).length === 0 &&
                                                initialState.placeIds.length === 0;
                expect(hadOnlyDeletedCollection || wouldBeEmptyAfterDeletion).toBe(true);

                // Verify the Link List no longer exists in database
                const dbLinkList = await linkListService.getLinkList(linkList.id);
                expect(dbLinkList).toBeNull();
              }
            } else {
              // Unaffected Link Lists should not appear in cascade results
              expect(cascadeResult.updatedLinkLists.find(ll => ll.id === linkList.id)).toBeUndefined();
              expect(cascadeResult.deletedLinkLists.find(ll => ll.id === linkList.id)).toBeUndefined();

              // Unaffected Link Lists should remain unchanged in database
              const dbLinkList = await linkListService.getLinkList(linkList.id);
              expect(dbLinkList).toBeDefined();
              expect(dbLinkList!.placeIds).toEqual(initialState.placeIds);
              expect(dbLinkList!.collectionIds).toEqual(initialState.collectionIds);
            }
          }

          // Assert: Database integrity should be maintained (Requirement 8.5)
          // All remaining Link Lists should have valid collection references
          const remainingLinkLists = await linkListService.getUserLinkLists();
          for (const linkList of remainingLinkLists) {
            for (const collectionId of linkList.collectionIds) {
              expect(collectionId).not.toBe(collectionToDelete);
              
              // Verify collection still exists in database (unless it was the deleted one)
              if (collectionId !== collectionToDelete) {
                const collection = await db.collections.get(collectionId);
                expect(collection).toBeDefined();
              }
            }
          }

          return true;
        }
      ),
      { numRuns: 8, timeout: 8000 }
    );
  }, 12000);

  it('should handle cascade updates when multiple places are deleted simultaneously', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          places: fc.array(placeArbitrary, { minLength: 3, maxLength: 6 }),
          linkListsToCreate: fc.array(
            fc.record({
              title: fc.string({ minLength: 1, maxLength: 30 }),
              selectedPlaceIndices: fc.array(fc.integer({ min: 0, max: 5 }), { minLength: 1, maxLength: 4 }),
            }),
            { minLength: 2, maxLength: 4 }
          ),
          placesToDeleteCount: fc.integer({ min: 1, max: 3 }),
        }),
        async (scenario) => {
          // Setup: Create unique places
          const places = scenario.places.map(place => ({
            ...place,
            id: generateId(),
          }));

          await db.places.bulkAdd(places);

          // Create Link Lists
          const createdLinkLists: LinkList[] = [];
          for (const linkListSpec of scenario.linkListsToCreate) {
            const selectedPlaces = linkListSpec.selectedPlaceIndices
              .filter(index => index < places.length)
              .map(index => places[index]);

            if (selectedPlaces.length > 0) {
              const creationData: LinkListCreationData = {
                title: linkListSpec.title,
                selectedPlaces,
                selectedCollections: [],
              };

              const linkList = await linkListService.createLinkList(creationData);
              createdLinkLists.push(linkList);
            }
          }

          if (createdLinkLists.length === 0) {
            return true;
          }

          // Record initial state
          const initialLinkListStates = new Map<string, string[]>();
          for (const linkList of createdLinkLists) {
            initialLinkListStates.set(linkList.id, [...linkList.placeIds]);
          }

          // Select places to delete
          const placesToDelete = places
            .slice(0, Math.min(scenario.placesToDeleteCount, places.length))
            .map(p => p.id);

          if (placesToDelete.length === 0) {
            return true;
          }

          // Act: Delete multiple places and handle cascade updates
          const cascadeResults = [];
          for (const placeId of placesToDelete) {
            const result = await linkListService.handlePlaceDeletion(placeId);
            cascadeResults.push(result);
          }

          // Assert: All deleted places should be removed from all Link Lists (Requirement 8.5)
          const remainingLinkLists = await linkListService.getUserLinkLists();
          for (const linkList of remainingLinkLists) {
            for (const deletedPlaceId of placesToDelete) {
              expect(linkList.placeIds).not.toContain(deletedPlaceId);
            }
          }

          // Assert: Link Lists should be deleted if they contained only deleted places
          for (const [linkListId, initialPlaceIds] of initialLinkListStates.entries()) {
            const allPlacesDeleted = initialPlaceIds.every(placeId => placesToDelete.includes(placeId));
            
            if (allPlacesDeleted) {
              // Link List should be deleted
              const dbLinkList = await linkListService.getLinkList(linkListId);
              expect(dbLinkList).toBeNull();
            } else {
              // Link List should still exist with remaining places
              const dbLinkList = await linkListService.getLinkList(linkListId);
              expect(dbLinkList).toBeDefined();
              
              const expectedRemainingPlaces = initialPlaceIds.filter(placeId => !placesToDelete.includes(placeId));
              expect(dbLinkList!.placeIds).toEqual(expect.arrayContaining(expectedRemainingPlaces));
              expect(dbLinkList!.placeIds.length).toBe(expectedRemainingPlaces.length);
            }
          }

          // Assert: Database integrity should be maintained
          for (const linkList of remainingLinkLists) {
            for (const placeId of linkList.placeIds) {
              const place = await db.places.get(placeId);
              expect(place).toBeDefined(); // All referenced places should exist
            }
          }

          return true;
        }
      ),
      { numRuns: 15, timeout: 12000 }
    );
  }, 15000);

  it('should maintain referential integrity during cascade operations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          places: fc.array(placeArbitrary, { minLength: 2, maxLength: 4 }),
          collections: fc.array(collectionArbitrary, { minLength: 1, maxLength: 3 }),
          linkListsToCreate: fc.array(
            fc.record({
              title: fc.string({ minLength: 1, maxLength: 30 }),
              selectedPlaceIndices: fc.array(fc.integer({ min: 0, max: 3 }), { maxLength: 2 }),
              selectedCollectionIndices: fc.array(fc.integer({ min: 0, max: 2 }), { maxLength: 2 }),
            }),
            { minLength: 1, maxLength: 3 }
          ),
        }),
        async (scenario) => {
          // Setup: Create places, collections, and relationships
          const places = scenario.places.map(place => ({
            ...place,
            id: generateId(),
          }));

          const collections = scenario.collections.map(collection => ({
            ...collection,
            id: generateId(),
          }));

          await db.places.bulkAdd(places);
          await db.collections.bulkAdd(collections);

          // Create place-collection relationships
          const placeCollectionMemberships = [];
          for (let i = 0; i < Math.min(places.length, collections.length); i++) {
            placeCollectionMemberships.push({
              id: generateId(),
              placeId: places[i].id,
              collectionId: collections[i % collections.length].id,
            });
          }
          if (placeCollectionMemberships.length > 0) {
            await db.placeCollections.bulkAdd(placeCollectionMemberships);
          }

          // Create Link Lists
          const createdLinkLists: LinkList[] = [];
          for (const linkListSpec of scenario.linkListsToCreate) {
            const selectedPlaces = linkListSpec.selectedPlaceIndices
              .filter(index => index < places.length)
              .map(index => places[index]);
            
            const selectedCollections = linkListSpec.selectedCollectionIndices
              .filter(index => index < collections.length)
              .map(index => collections[index]);

            if (selectedPlaces.length > 0 || selectedCollections.length > 0) {
              const creationData: LinkListCreationData = {
                title: linkListSpec.title,
                selectedPlaces,
                selectedCollections,
              };

              const linkList = await linkListService.createLinkList(creationData);
              createdLinkLists.push(linkList);
            }
          }

          if (createdLinkLists.length === 0) {
            return true;
          }

          // Select random place and collection to delete
          const placeToDelete = places[0].id;
          const collectionToDelete = collections.length > 0 ? collections[0].id : null;

          // Act: Perform cascade operations
          await linkListService.handlePlaceDeletion(placeToDelete);
          if (collectionToDelete) {
            await linkListService.handleCollectionDeletion(collectionToDelete);
          }

          // Assert: Referential integrity should be maintained (Requirement 8.5)
          const remainingLinkLists = await linkListService.getUserLinkLists();
          
          for (const linkList of remainingLinkLists) {
            // All place references should be valid
            for (const placeId of linkList.placeIds) {
              expect(placeId).not.toBe(placeToDelete);
              const place = await db.places.get(placeId);
              expect(place).toBeDefined();
            }

            // All collection references should be valid
            for (const collectionId of linkList.collectionIds) {
              if (collectionToDelete) {
                expect(collectionId).not.toBe(collectionToDelete);
              }
              const collection = await db.collections.get(collectionId);
              expect(collection).toBeDefined();
            }

            // Link List should have at least one place or collection reference
            expect(linkList.placeIds.length + linkList.collectionIds.length).toBeGreaterThan(0);
          }

          // Assert: No orphaned Link Lists should exist
          // (Link Lists with no places and no collections should be deleted)
          for (const linkList of remainingLinkLists) {
            const hasPlaces = linkList.placeIds.length > 0;
            const hasCollections = linkList.collectionIds.length > 0;
            expect(hasPlaces || hasCollections).toBe(true);
          }

          return true;
        }
      ),
      { numRuns: 20, timeout: 12000 }
    );
  }, 15000);

  it('should handle edge cases in cascade operations gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          places: fc.array(placeArbitrary, { minLength: 1, maxLength: 2 }),
          emptyLinkListTitle: fc.string({ minLength: 1, maxLength: 20 }),
        }),
        async (scenario) => {
          // Setup: Create places
          const places = scenario.places.map(place => ({
            ...place,
            id: generateId(),
          }));

          await db.places.bulkAdd(places);

          // Create an empty Link List (edge case)
          const emptyLinkList: LinkList = {
            id: generateId(),
            title: scenario.emptyLinkListTitle,
            placeIds: [],
            collectionIds: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            isPublic: true,
          };

          await db.linkLists.add(emptyLinkList);

          // Create a Link List with all places
          const creationData: LinkListCreationData = {
            title: 'All Places List',
            selectedPlaces: places,
            selectedCollections: [],
          };

          const fullLinkList = await linkListService.createLinkList(creationData);

          // Act: Delete a non-existent place (edge case)
          const nonExistentPlaceId = 'non-existent-place-id';
          const cascadeResult1 = await linkListService.handlePlaceDeletion(nonExistentPlaceId);

          // Assert: Should handle non-existent place gracefully (Requirement 8.5)
          expect(cascadeResult1.updatedLinkLists).toHaveLength(0);
          expect(cascadeResult1.deletedLinkLists).toHaveLength(0);

          // Act: Delete an existing place
          const placeToDelete = places[0].id;
          const cascadeResult2 = await linkListService.handlePlaceDeletion(placeToDelete);

          // Assert: Empty Link List should not be affected
          const emptyLinkListAfter = await linkListService.getLinkList(emptyLinkList.id);
          expect(emptyLinkListAfter).toBeDefined();
          expect(emptyLinkListAfter!.placeIds).toHaveLength(0);
          expect(emptyLinkListAfter!.collectionIds).toHaveLength(0);

          // Assert: Full Link List should be updated or deleted appropriately
          if (places.length === 1) {
            // Should be deleted if it only had the deleted place
            expect(cascadeResult2.deletedLinkLists).toHaveLength(1);
            expect(cascadeResult2.deletedLinkLists[0].id).toBe(fullLinkList.id);
            
            const fullLinkListAfter = await linkListService.getLinkList(fullLinkList.id);
            expect(fullLinkListAfter).toBeNull();
          } else {
            // Should be updated if it had other places
            expect(cascadeResult2.updatedLinkLists).toHaveLength(1);
            expect(cascadeResult2.updatedLinkLists[0].id).toBe(fullLinkList.id);
            
            const fullLinkListAfter = await linkListService.getLinkList(fullLinkList.id);
            expect(fullLinkListAfter).toBeDefined();
            expect(fullLinkListAfter!.placeIds).not.toContain(placeToDelete);
            expect(fullLinkListAfter!.placeIds.length).toBe(places.length - 1);
          }

          return true;
        }
      ),
      { numRuns: 15, timeout: 10000 }
    );
  }, 12000);
});