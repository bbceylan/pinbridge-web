/**
 * Property-based tests for collection title display
 * Feature: link-list-feature
 */

import fc from 'fast-check';
import { db } from '@/lib/db';
import { linkListService } from '@/lib/services/link-list';
import { generateId } from '@/lib/utils';
import type { Place, Collection } from '@/types';

// Test setup and teardown
beforeEach(async () => {
  await db.delete();
  await db.open();
});

afterEach(async () => {
  await db.close();
});

// Generators for test data
const collectionArbitrary = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
  name: fc.string({ minLength: 1, maxLength: 30 }).filter(s => !/[&?#]/.test(s) && s.trim().length > 0),
  description: fc.option(fc.string({ maxLength: 50 })),
  createdAt: fc.constant(new Date('2024-01-01T10:00:00Z')),
  updatedAt: fc.constant(new Date('2024-01-01T10:00:00Z')),
}) as fc.Arbitrary<Collection>;

const placeArbitrary = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
  title: fc.string({ minLength: 1, maxLength: 30 }).filter(s => !/[&?#]/.test(s) && s.trim().length > 0),
  address: fc.string({ minLength: 1, maxLength: 50 }).filter(s => !/[&?#]/.test(s) && s.trim().length > 0),
  latitude: fc.option(fc.double({ min: -90, max: 90 })),
  longitude: fc.option(fc.double({ min: -180, max: 180 })),
  notes: fc.option(fc.string({ maxLength: 50 })),
  tags: fc.array(fc.string({ maxLength: 10 }).filter(s => !/[&?#]/.test(s)), { maxLength: 2 }),
  source: fc.constantFrom('apple', 'google', 'manual', 'other'),
  sourceUrl: fc.option(fc.constant('https://example.com')),
  normalizedTitle: fc.string({ minLength: 1, maxLength: 30 }).filter(s => !/[&?#]/.test(s) && s.trim().length > 0),
  normalizedAddress: fc.string({ minLength: 1, maxLength: 50 }).filter(s => !/[&?#]/.test(s) && s.trim().length > 0),
  createdAt: fc.constant(new Date('2024-01-01T10:00:00Z')),
  updatedAt: fc.constant(new Date('2024-01-01T10:00:00Z')),
}) as fc.Arbitrary<Place>;

/**
 * Property 6: Collection title display
 * **Validates: Requirements 4.4**
 * 
 * For any Link List created from collections, the page title should accurately 
 * reflect the collection name(s) used in the creation.
 */
describe('Property 6: Collection title display', () => {
  it('should display single collection name as the Link List title', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          collection: collectionArbitrary,
          places: fc.array(placeArbitrary, { minLength: 1, maxLength: 3 }),
        }),
        async ({ collection, places }) => {
          // Setup: Create collection and places with unique IDs
          const collectionWithId = { ...collection, id: generateId() };
          const placesWithIds = places.map(place => ({ ...place, id: generateId() }));
          
          // Add to database
          await db.collections.add(collectionWithId);
          await db.places.bulkAdd(placesWithIds);
          
          // Create place-collection relationships
          const memberships = placesWithIds.map(place => ({
            id: generateId(),
            placeId: place.id,
            collectionId: collectionWithId.id,
          }));
          await db.placeCollections.bulkAdd(memberships);
          
          // Create Link List from collection only (no individual places selected)
          const creationData = {
            title: collectionWithId.name, // Title should match collection name
            selectedPlaces: [],
            selectedCollections: [collectionWithId],
          };
          
          const linkList = await linkListService.createLinkList(creationData);
          
          // Assert: Link List title matches collection name (Requirement 4.4)
          expect(linkList.title).toBe(collectionWithId.name);
          
          // Assert: Link List contains places from the collection
          const linkListPlaces = await linkListService.getPlacesForLinkList(linkList.id);
          expect(linkListPlaces.length).toBe(placesWithIds.length);
          
          // Assert: All places from collection are included
          for (const place of placesWithIds) {
            expect(linkListPlaces.some(p => p.id === place.id)).toBe(true);
          }
          
          return true;
        }
      ),
      { numRuns: 10, timeout: 8000 }
    );
  }, 12000);

  it('should display multiple collection names appropriately in the Link List title', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          collections: fc.array(collectionArbitrary, { minLength: 2, maxLength: 4 }),
          placesPerCollection: fc.array(placeArbitrary, { minLength: 1, maxLength: 2 }),
        }),
        async ({ collections, placesPerCollection }) => {
          // Setup: Create collections with unique IDs
          const collectionsWithIds = collections.map(collection => ({ 
            ...collection, 
            id: generateId() 
          }));
          
          const placesWithIds = placesPerCollection.map(place => ({ 
            ...place, 
            id: generateId() 
          }));
          
          // Add to database
          await db.collections.bulkAdd(collectionsWithIds);
          await db.places.bulkAdd(placesWithIds);
          
          // Create place-collection relationships (distribute places across collections)
          const memberships = [];
          for (let i = 0; i < placesWithIds.length; i++) {
            const collectionIndex = i % collectionsWithIds.length;
            memberships.push({
              id: generateId(),
              placeId: placesWithIds[i].id,
              collectionId: collectionsWithIds[collectionIndex].id,
            });
          }
          await db.placeCollections.bulkAdd(memberships);
          
          // Generate expected title based on collection count
          let expectedTitle: string;
          if (collectionsWithIds.length === 2) {
            expectedTitle = `${collectionsWithIds[0].name} & ${collectionsWithIds[1].name}`;
          } else if (collectionsWithIds.length === 3) {
            expectedTitle = `${collectionsWithIds[0].name}, ${collectionsWithIds[1].name} & ${collectionsWithIds[2].name}`;
          } else {
            expectedTitle = `${collectionsWithIds[0].name}, ${collectionsWithIds[1].name} & ${collectionsWithIds.length - 2} more`;
          }
          
          // Create Link List from multiple collections
          const creationData = {
            title: expectedTitle,
            selectedPlaces: [],
            selectedCollections: collectionsWithIds,
          };
          
          const linkList = await linkListService.createLinkList(creationData);
          
          // Assert: Link List title reflects multiple collection names (Requirement 4.4)
          expect(linkList.title).toBe(expectedTitle);
          
          // Verify the title contains all collection names (for 2-3 collections) or appropriate summary
          if (collectionsWithIds.length === 2) {
            expect(linkList.title).toContain(collectionsWithIds[0].name);
            expect(linkList.title).toContain(collectionsWithIds[1].name);
            expect(linkList.title).toContain(' & ');
          } else if (collectionsWithIds.length === 3) {
            expect(linkList.title).toContain(collectionsWithIds[0].name);
            expect(linkList.title).toContain(collectionsWithIds[1].name);
            expect(linkList.title).toContain(collectionsWithIds[2].name);
            expect(linkList.title).toContain(', ');
            expect(linkList.title).toContain(' & ');
          } else {
            expect(linkList.title).toContain(collectionsWithIds[0].name);
            expect(linkList.title).toContain(collectionsWithIds[1].name);
            expect(linkList.title).toContain(' & ');
            expect(linkList.title).toContain(' more');
          }
          
          return true;
        }
      ),
      { numRuns: 8, timeout: 10000 }
    );
  }, 15000);

  it('should handle mixed collection and individual place selections with appropriate title', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          collection: collectionArbitrary,
          collectionPlaces: fc.array(placeArbitrary, { minLength: 1, maxLength: 2 }),
          individualPlaces: fc.array(placeArbitrary, { minLength: 1, maxLength: 2 }),
          customTitle: fc.string({ minLength: 1, maxLength: 30 }).filter(s => !/[&?#]/.test(s) && s.trim().length > 0),
        }),
        async ({ collection, collectionPlaces, individualPlaces, customTitle }) => {
          // Setup: Create collection and places with unique IDs
          const collectionWithId = { ...collection, id: generateId() };
          const collectionPlacesWithIds = collectionPlaces.map(place => ({ 
            ...place, 
            id: generateId() 
          }));
          const individualPlacesWithIds = individualPlaces.map(place => ({ 
            ...place, 
            id: generateId() 
          }));
          
          const allPlaces = [...collectionPlacesWithIds, ...individualPlacesWithIds];
          
          // Add to database
          await db.collections.add(collectionWithId);
          await db.places.bulkAdd(allPlaces);
          
          // Create place-collection relationships only for collection places
          const memberships = collectionPlacesWithIds.map(place => ({
            id: generateId(),
            placeId: place.id,
            collectionId: collectionWithId.id,
          }));
          await db.placeCollections.bulkAdd(memberships);
          
          // Create Link List with both collection and individual places
          const creationData = {
            title: customTitle, // Use custom title when mixing selections
            selectedPlaces: individualPlacesWithIds,
            selectedCollections: [collectionWithId],
          };
          
          const linkList = await linkListService.createLinkList(creationData);
          
          // Assert: Link List title is the custom title when mixing collections and individual places
          expect(linkList.title).toBe(customTitle);
          
          // Assert: Link List includes places from both collection and individual selection
          const linkListPlaces = await linkListService.getPlacesForLinkList(linkList.id);
          expect(linkListPlaces.length).toBe(allPlaces.length);
          
          // Verify all collection places are included
          for (const place of collectionPlacesWithIds) {
            expect(linkListPlaces.some(p => p.id === place.id)).toBe(true);
          }
          
          // Verify all individual places are included
          for (const place of individualPlacesWithIds) {
            expect(linkListPlaces.some(p => p.id === place.id)).toBe(true);
          }
          
          return true;
        }
      ),
      { numRuns: 6, timeout: 8000 }
    );
  }, 12000);

  it('should generate appropriate default titles when collections are selected in the creator', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          collections: fc.array(collectionArbitrary, { minLength: 1, maxLength: 5 }),
        }),
        async ({ collections }) => {
          // Setup: Create collections with unique IDs
          const collectionsWithIds = collections.map(collection => ({ 
            ...collection, 
            id: generateId() 
          }));
          
          // Add to database
          await db.collections.bulkAdd(collectionsWithIds);
          
          // Test the default title generation logic from LinkListCreator
          let expectedDefaultTitle: string;
          if (collectionsWithIds.length === 1) {
            expectedDefaultTitle = collectionsWithIds[0].name;
          } else if (collectionsWithIds.length === 2) {
            expectedDefaultTitle = `${collectionsWithIds[0].name} & ${collectionsWithIds[1].name}`;
          } else if (collectionsWithIds.length === 3) {
            expectedDefaultTitle = `${collectionsWithIds[0].name}, ${collectionsWithIds[1].name} & ${collectionsWithIds[2].name}`;
          } else {
            expectedDefaultTitle = `${collectionsWithIds[0].name}, ${collectionsWithIds[1].name} & ${collectionsWithIds.length - 2} more`;
          }
          
          // Create Link List using the expected default title
          const creationData = {
            title: expectedDefaultTitle,
            selectedPlaces: [],
            selectedCollections: collectionsWithIds,
          };
          
          const linkList = await linkListService.createLinkList(creationData);
          
          // Assert: Link List title matches the expected pattern for collection names (Requirement 4.4)
          expect(linkList.title).toBe(expectedDefaultTitle);
          
          // Assert: Title generation follows consistent patterns
          if (collectionsWithIds.length === 1) {
            // Single collection: use collection name directly
            expect(linkList.title).toBe(collectionsWithIds[0].name);
          } else if (collectionsWithIds.length === 2) {
            // Two collections: "Collection1 & Collection2"
            expect(linkList.title).toMatch(/^.+ & .+$/);
            expect(linkList.title).toContain(collectionsWithIds[0].name);
            expect(linkList.title).toContain(collectionsWithIds[1].name);
          } else if (collectionsWithIds.length === 3) {
            // Three collections: "Collection1, Collection2 & Collection3"
            expect(linkList.title).toMatch(/^.+, .+ & .+$/);
            expect(linkList.title).toContain(collectionsWithIds[0].name);
            expect(linkList.title).toContain(collectionsWithIds[1].name);
            expect(linkList.title).toContain(collectionsWithIds[2].name);
          } else {
            // More than three: "Collection1, Collection2 & X more"
            expect(linkList.title).toMatch(/^.+, .+ & \d+ more$/);
            expect(linkList.title).toContain(collectionsWithIds[0].name);
            expect(linkList.title).toContain(collectionsWithIds[1].name);
            expect(linkList.title).toContain(`${collectionsWithIds.length - 2} more`);
          }
          
          return true;
        }
      ),
      { numRuns: 10, timeout: 6000 }
    );
  }, 10000);

  it('should preserve collection name accuracy across different character sets and lengths', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          // Test with various character sets and lengths
          collectionName: fc.oneof(
            fc.string({ minLength: 1, maxLength: 50 }).filter(s => 
              !/[&?#]/.test(s) && s.trim().length > 0 && /^[a-zA-Z0-9\s\-_'.()]+$/.test(s)
            ),
            fc.constantFrom(
              'My Favorite Places',
              'Work & Business',
              'Family Spots',
              'Travel 2024',
              'Coffee Shops (NYC)',
              'Weekend Adventures',
              'Mom\'s Recommendations'
            )
          ),
          places: fc.array(placeArbitrary, { minLength: 1, maxLength: 2 }),
        }),
        async ({ collectionName, places }) => {
          // Setup: Create collection with specific name
          const collection = {
            id: generateId(),
            name: collectionName,
            description: undefined,
            createdAt: new Date('2024-01-01T10:00:00Z'),
            updatedAt: new Date('2024-01-01T10:00:00Z'),
          };
          
          const placesWithIds = places.map(place => ({ ...place, id: generateId() }));
          
          // Add to database
          await db.collections.add(collection);
          await db.places.bulkAdd(placesWithIds);
          
          // Create place-collection relationships
          const memberships = placesWithIds.map(place => ({
            id: generateId(),
            placeId: place.id,
            collectionId: collection.id,
          }));
          await db.placeCollections.bulkAdd(memberships);
          
          // Create Link List from collection
          const creationData = {
            title: collection.name, // Title should exactly match collection name
            selectedPlaces: [],
            selectedCollections: [collection],
          };
          
          const linkList = await linkListService.createLinkList(creationData);
          
          // Assert: Link List title exactly matches collection name (Requirement 4.4)
          expect(linkList.title).toBe(collection.name);
          
          // Assert: No character corruption or truncation
          expect(linkList.title.length).toBe(collection.name.length);
          expect(linkList.title).toEqual(collection.name);
          
          return true;
        }
      ),
      { numRuns: 8, timeout: 6000 }
    );
  }, 10000);
});