/**
 * Unit tests for LinkListService
 * Tests specific examples and edge cases for CRUD operations and error handling
 */

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

// Helper functions to create test data
const createTestPlace = (overrides: Partial<Place> = {}): Place => ({
  id: generateId(),
  title: 'Test Place',
  address: '123 Test St, Test City',
  latitude: 37.7749,
  longitude: -122.4194,
  notes: 'Test notes',
  tags: ['test'],
  source: 'manual',
  sourceUrl: undefined,
  normalizedTitle: 'test place',
  normalizedAddress: '123 test st test city',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createTestCollection = (overrides: Partial<Collection> = {}): Collection => ({
  id: generateId(),
  name: 'Test Collection',
  description: 'Test collection description',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('LinkListService CRUD Operations', () => {
  describe('createLinkList', () => {
    it('should create a link list with selected places only', async () => {
      // Arrange
      const place1 = createTestPlace({ title: 'Place 1' });
      const place2 = createTestPlace({ title: 'Place 2' });
      
      await db.places.bulkAdd([place1, place2]);
      
      const creationData: LinkListCreationData = {
        title: 'My Link List',
        description: 'Test description',
        selectedPlaces: [place1, place2],
        selectedCollections: [],
      };

      // Act
      const linkList = await linkListService.createLinkList(creationData);

      // Assert
      expect(linkList).toBeDefined();
      expect(linkList.id).toBeDefined();
      expect(linkList.title).toBe('My Link List');
      expect(linkList.description).toBe('Test description');
      expect(linkList.placeIds).toEqual([place1.id, place2.id]);
      expect(linkList.collectionIds).toEqual([]);
      expect(linkList.isPublic).toBe(true);
      expect(linkList.createdAt).toBeInstanceOf(Date);
      expect(linkList.updatedAt).toBeInstanceOf(Date);

      // Verify it's stored in database
      const stored = await db.linkLists.get(linkList.id);
      expect(stored).toBeDefined();
      expect(stored!.id).toBe(linkList.id);
      expect(stored!.title).toBe(linkList.title);
      expect(stored!.description).toBe(linkList.description);
      expect(stored!.placeIds).toEqual(linkList.placeIds);
      expect(stored!.collectionIds).toEqual(linkList.collectionIds);
    });

    it('should create a link list with selected collections only', async () => {
      // Arrange
      const collection1 = createTestCollection({ name: 'Collection 1' });
      const collection2 = createTestCollection({ name: 'Collection 2' });
      const place1 = createTestPlace({ title: 'Place 1' });
      const place2 = createTestPlace({ title: 'Place 2' });
      
      await db.collections.bulkAdd([collection1, collection2]);
      await db.places.bulkAdd([place1, place2]);
      
      // Add places to collections
      await db.placeCollections.bulkAdd([
        { id: generateId(), placeId: place1.id, collectionId: collection1.id },
        { id: generateId(), placeId: place2.id, collectionId: collection2.id },
      ]);
      
      const creationData: LinkListCreationData = {
        title: 'Collection Link List',
        selectedPlaces: [],
        selectedCollections: [collection1, collection2],
      };

      // Act
      const linkList = await linkListService.createLinkList(creationData);

      // Assert
      expect(linkList.title).toBe('Collection Link List');
      expect(linkList.collectionIds).toEqual([collection1.id, collection2.id]);
      expect(linkList.placeIds).toEqual(expect.arrayContaining([place1.id, place2.id]));
    });

    it('should create a link list with both places and collections', async () => {
      // Arrange
      const place1 = createTestPlace({ title: 'Individual Place' });
      const place2 = createTestPlace({ title: 'Collection Place' });
      const collection = createTestCollection({ name: 'Test Collection' });
      
      await db.places.bulkAdd([place1, place2]);
      await db.collections.add(collection);
      await db.placeCollections.add({
        id: generateId(),
        placeId: place2.id,
        collectionId: collection.id,
      });
      
      const creationData: LinkListCreationData = {
        title: 'Mixed Link List',
        selectedPlaces: [place1],
        selectedCollections: [collection],
      };

      // Act
      const linkList = await linkListService.createLinkList(creationData);

      // Assert
      expect(linkList.placeIds).toEqual(expect.arrayContaining([place1.id, place2.id]));
      expect(linkList.collectionIds).toEqual([collection.id]);
      expect(linkList.placeIds).toHaveLength(2); // Should deduplicate if same place in both
    });

    it('should deduplicate places when same place is in both individual selection and collections', async () => {
      // Arrange
      const place = createTestPlace({ title: 'Duplicate Place' });
      const collection = createTestCollection({ name: 'Test Collection' });
      
      await db.places.add(place);
      await db.collections.add(collection);
      await db.placeCollections.add({
        id: generateId(),
        placeId: place.id,
        collectionId: collection.id,
      });
      
      const creationData: LinkListCreationData = {
        title: 'Dedup Test',
        selectedPlaces: [place], // Same place selected individually
        selectedCollections: [collection], // And in collection
      };

      // Act
      const linkList = await linkListService.createLinkList(creationData);

      // Assert
      expect(linkList.placeIds).toEqual([place.id]); // Should appear only once
      expect(linkList.placeIds).toHaveLength(1);
    });

    it('should handle creation without description', async () => {
      // Arrange
      const place = createTestPlace();
      await db.places.add(place);
      
      const creationData: LinkListCreationData = {
        title: 'No Description',
        selectedPlaces: [place],
        selectedCollections: [],
      };

      // Act
      const linkList = await linkListService.createLinkList(creationData);

      // Assert
      expect(linkList.description).toBeUndefined();
    });
  });

  describe('getLinkList', () => {
    it('should retrieve an existing link list', async () => {
      // Arrange
      const place = createTestPlace();
      await db.places.add(place);
      
      const creationData: LinkListCreationData = {
        title: 'Test Retrieval',
        selectedPlaces: [place],
        selectedCollections: [],
      };
      
      const created = await linkListService.createLinkList(creationData);

      // Act
      const retrieved = await linkListService.getLinkList(created.id);

      // Assert
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.title).toBe(created.title);
      expect(retrieved!.placeIds).toEqual(created.placeIds);
      expect(retrieved!.collectionIds).toEqual(created.collectionIds);
    });

    it('should return null for non-existent link list', async () => {
      // Act
      const result = await linkListService.getLinkList('non-existent-id');

      // Assert
      expect(result).toBeNull();
    });

    it('should return null for empty string id', async () => {
      // Act
      const result = await linkListService.getLinkList('');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('updateLinkList', () => {
    it('should update link list title and description', async () => {
      // Arrange
      const place = createTestPlace();
      await db.places.add(place);
      
      const creationData: LinkListCreationData = {
        title: 'Original Title',
        description: 'Original description',
        selectedPlaces: [place],
        selectedCollections: [],
      };
      
      const linkList = await linkListService.createLinkList(creationData);
      const originalUpdatedAt = linkList.updatedAt;

      // Wait a bit to ensure updatedAt changes
      await new Promise(resolve => setTimeout(resolve, 10));

      // Act
      await linkListService.updateLinkList(linkList.id, {
        title: 'Updated Title',
        description: 'Updated description',
      });

      // Assert
      const updated = await linkListService.getLinkList(linkList.id);
      expect(updated).toBeDefined();
      expect(updated!.title).toBe('Updated Title');
      expect(updated!.description).toBe('Updated description');
      // Convert to Date objects for comparison since IndexedDB may serialize dates
      const updatedDate = new Date(updated!.updatedAt);
      const originalDate = new Date(originalUpdatedAt);
      expect(updatedDate.getTime()).toBeGreaterThan(originalDate.getTime());
      expect(new Date(updated!.createdAt)).toEqual(new Date(linkList.createdAt)); // Should not change
    });

    it('should update place IDs', async () => {
      // Arrange
      const place1 = createTestPlace({ title: 'Place 1' });
      const place2 = createTestPlace({ title: 'Place 2' });
      await db.places.bulkAdd([place1, place2]);
      
      const creationData: LinkListCreationData = {
        title: 'Test Update',
        selectedPlaces: [place1],
        selectedCollections: [],
      };
      
      const linkList = await linkListService.createLinkList(creationData);

      // Act
      await linkListService.updateLinkList(linkList.id, {
        placeIds: [place1.id, place2.id],
      });

      // Assert
      const updated = await linkListService.getLinkList(linkList.id);
      expect(updated!.placeIds).toEqual([place1.id, place2.id]);
    });

    it('should handle partial updates', async () => {
      // Arrange
      const place = createTestPlace();
      await db.places.add(place);
      
      const creationData: LinkListCreationData = {
        title: 'Original Title',
        description: 'Original description',
        selectedPlaces: [place],
        selectedCollections: [],
      };
      
      const linkList = await linkListService.createLinkList(creationData);

      // Act - Update only title
      await linkListService.updateLinkList(linkList.id, {
        title: 'New Title Only',
      });

      // Assert
      const updated = await linkListService.getLinkList(linkList.id);
      expect(updated!.title).toBe('New Title Only');
      expect(updated!.description).toBe('Original description'); // Should remain unchanged
      expect(updated!.placeIds).toEqual([place.id]); // Should remain unchanged
    });

    it('should handle update of non-existent link list gracefully', async () => {
      // Act & Assert - Should not throw
      await expect(
        linkListService.updateLinkList('non-existent-id', { title: 'New Title' })
      ).resolves.not.toThrow();
    });
  });

  describe('deleteLinkList', () => {
    it('should delete an existing link list', async () => {
      // Arrange
      const place = createTestPlace();
      await db.places.add(place);
      
      const creationData: LinkListCreationData = {
        title: 'To Be Deleted',
        selectedPlaces: [place],
        selectedCollections: [],
      };
      
      const linkList = await linkListService.createLinkList(creationData);

      // Verify it exists
      expect(await linkListService.getLinkList(linkList.id)).toBeDefined();

      // Act
      await linkListService.deleteLinkList(linkList.id);

      // Assert
      expect(await linkListService.getLinkList(linkList.id)).toBeNull();
    });

    it('should handle deletion of non-existent link list gracefully', async () => {
      // Act & Assert - Should not throw
      await expect(
        linkListService.deleteLinkList('non-existent-id')
      ).resolves.not.toThrow();
    });
  });

  describe('getUserLinkLists', () => {
    it('should return empty array when no link lists exist', async () => {
      // Act
      const linkLists = await linkListService.getUserLinkLists();

      // Assert
      expect(linkLists).toEqual([]);
    });

    it('should return all link lists ordered by creation date (newest first)', async () => {
      // Arrange
      const place = createTestPlace();
      await db.places.add(place);
      
      const creationData1: LinkListCreationData = {
        title: 'First List',
        selectedPlaces: [place],
        selectedCollections: [],
      };
      
      const creationData2: LinkListCreationData = {
        title: 'Second List',
        selectedPlaces: [place],
        selectedCollections: [],
      };
      
      const linkList1 = await linkListService.createLinkList(creationData1);
      
      // Wait to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const linkList2 = await linkListService.createLinkList(creationData2);

      // Act
      const linkLists = await linkListService.getUserLinkLists();

      // Assert
      expect(linkLists).toHaveLength(2);
      expect(linkLists[0].id).toBe(linkList2.id); // Newest first
      expect(linkLists[1].id).toBe(linkList1.id);
    });
  });
});

describe('LinkListService Helper Methods', () => {
  describe('getPlacesForLinkList', () => {
    it('should return places for a valid link list', async () => {
      // Arrange
      const place1 = createTestPlace({ title: 'Place 1' });
      const place2 = createTestPlace({ title: 'Place 2' });
      await db.places.bulkAdd([place1, place2]);
      
      const creationData: LinkListCreationData = {
        title: 'Test Places',
        selectedPlaces: [place1, place2],
        selectedCollections: [],
      };
      
      const linkList = await linkListService.createLinkList(creationData);

      // Act
      const places = await linkListService.getPlacesForLinkList(linkList.id);

      // Assert
      expect(places).toHaveLength(2);
      expect(places.map(p => p.id)).toEqual(expect.arrayContaining([place1.id, place2.id]));
      expect(places[0]).toHaveProperty('title');
      expect(places[0]).toHaveProperty('address');
    });

    it('should return empty array for non-existent link list', async () => {
      // Act
      const places = await linkListService.getPlacesForLinkList('non-existent-id');

      // Assert
      expect(places).toEqual([]);
    });

    it('should return empty array for link list with no places', async () => {
      // Arrange - Create link list with no places (edge case)
      const linkList: LinkList = {
        id: generateId(),
        title: 'Empty List',
        placeIds: [],
        collectionIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        isPublic: true,
      };
      
      await db.linkLists.add(linkList);

      // Act
      const places = await linkListService.getPlacesForLinkList(linkList.id);

      // Assert
      expect(places).toEqual([]);
    });
  });

  describe('getCollectionsForLinkList', () => {
    it('should return collections for a valid link list', async () => {
      // Arrange
      const collection1 = createTestCollection({ name: 'Collection 1' });
      const collection2 = createTestCollection({ name: 'Collection 2' });
      await db.collections.bulkAdd([collection1, collection2]);
      
      const creationData: LinkListCreationData = {
        title: 'Test Collections',
        selectedPlaces: [],
        selectedCollections: [collection1, collection2],
      };
      
      const linkList = await linkListService.createLinkList(creationData);

      // Act
      const collections = await linkListService.getCollectionsForLinkList(linkList.id);

      // Assert
      expect(collections).toHaveLength(2);
      expect(collections.map(c => c.id)).toEqual(expect.arrayContaining([collection1.id, collection2.id]));
      expect(collections[0]).toHaveProperty('name');
    });

    it('should return empty array for non-existent link list', async () => {
      // Act
      const collections = await linkListService.getCollectionsForLinkList('non-existent-id');

      // Assert
      expect(collections).toEqual([]);
    });

    it('should return empty array for link list with no collections', async () => {
      // Arrange
      const place = createTestPlace();
      await db.places.add(place);
      
      const creationData: LinkListCreationData = {
        title: 'No Collections',
        selectedPlaces: [place],
        selectedCollections: [],
      };
      
      const linkList = await linkListService.createLinkList(creationData);

      // Act
      const collections = await linkListService.getCollectionsForLinkList(linkList.id);

      // Assert
      expect(collections).toEqual([]);
    });
  });
});

describe('LinkListService Error Handling', () => {
  describe('Invalid Data Handling', () => {
    it('should handle creation with empty title gracefully', async () => {
      // Arrange
      const place = createTestPlace();
      await db.places.add(place);
      
      const creationData: LinkListCreationData = {
        title: '', // Empty title
        selectedPlaces: [place],
        selectedCollections: [],
      };

      // Act & Assert - Should not throw, but create with empty title
      const linkList = await linkListService.createLinkList(creationData);
      expect(linkList.title).toBe('');
    });

    it('should handle creation with places that do not exist in database', async () => {
      // Arrange - Create place object but don't add to database
      const nonExistentPlace = createTestPlace({ id: 'non-existent-place' });
      
      const creationData: LinkListCreationData = {
        title: 'Invalid Places',
        selectedPlaces: [nonExistentPlace],
        selectedCollections: [],
      };

      // Act - Should not throw, but will create link list with invalid place IDs
      const linkList = await linkListService.createLinkList(creationData);

      // Assert
      expect(linkList.placeIds).toEqual([nonExistentPlace.id]);
      
      // But getPlacesForLinkList should return empty array
      const places = await linkListService.getPlacesForLinkList(linkList.id);
      expect(places).toEqual([]);
    });

    it('should handle creation with collections that do not exist in database', async () => {
      // Arrange - Create collection object but don't add to database
      const nonExistentCollection = createTestCollection({ id: 'non-existent-collection' });
      
      const creationData: LinkListCreationData = {
        title: 'Invalid Collections',
        selectedPlaces: [],
        selectedCollections: [nonExistentCollection],
      };

      // Act - Should not throw, but will create link list with invalid collection IDs
      const linkList = await linkListService.createLinkList(creationData);

      // Assert
      expect(linkList.collectionIds).toEqual([nonExistentCollection.id]);
      
      // But getCollectionsForLinkList should return empty array
      const collections = await linkListService.getCollectionsForLinkList(linkList.id);
      expect(collections).toEqual([]);
    });

    it('should handle places with missing required fields', async () => {
      // Arrange - Create place with missing fields
      const incompletePlace = createTestPlace({
        title: '', // Empty title
        address: '', // Empty address
        latitude: undefined,
        longitude: undefined,
      });
      
      await db.places.add(incompletePlace);
      
      const creationData: LinkListCreationData = {
        title: 'Incomplete Places',
        selectedPlaces: [incompletePlace],
        selectedCollections: [],
      };

      // Act - Should not throw
      const linkList = await linkListService.createLinkList(creationData);

      // Assert
      expect(linkList.placeIds).toEqual([incompletePlace.id]);
      
      const places = await linkListService.getPlacesForLinkList(linkList.id);
      expect(places).toHaveLength(1);
      expect(places[0].title).toBe('');
      expect(places[0].address).toBe('');
    });

    it('should handle very long titles and descriptions', async () => {
      // Arrange
      const place = createTestPlace();
      await db.places.add(place);
      
      const longTitle = 'A'.repeat(1000); // Very long title
      const longDescription = 'B'.repeat(2000); // Very long description
      
      const creationData: LinkListCreationData = {
        title: longTitle,
        description: longDescription,
        selectedPlaces: [place],
        selectedCollections: [],
      };

      // Act - Should not throw
      const linkList = await linkListService.createLinkList(creationData);

      // Assert
      expect(linkList.title).toBe(longTitle);
      expect(linkList.description).toBe(longDescription);
    });
  });

  describe('Database Error Scenarios', () => {
    it('should handle database connection issues gracefully', async () => {
      // Arrange - Close database to simulate connection issue
      await db.close();
      
      const place = createTestPlace();
      const creationData: LinkListCreationData = {
        title: 'Test',
        selectedPlaces: [place],
        selectedCollections: [],
      };

      // Act & Assert - Should throw database error
      await expect(linkListService.createLinkList(creationData)).rejects.toThrow();
      
      // Cleanup - Reopen database for other tests
      await db.open();
    });
  });
});

describe('LinkListService Cascade Operations', () => {
  describe('handlePlaceDeletion', () => {
    it('should remove deleted place from link lists', async () => {
      // Arrange
      const place1 = createTestPlace({ title: 'Place 1' });
      const place2 = createTestPlace({ title: 'Place 2' });
      await db.places.bulkAdd([place1, place2]);
      
      const creationData: LinkListCreationData = {
        title: 'Test Cascade',
        selectedPlaces: [place1, place2],
        selectedCollections: [],
      };
      
      const linkList = await linkListService.createLinkList(creationData);

      // Act
      const result = await linkListService.handlePlaceDeletion(place1.id);

      // Assert
      expect(result.updatedLinkLists).toHaveLength(1);
      expect(result.deletedLinkLists).toHaveLength(0);
      expect(result.updatedLinkLists[0].id).toBe(linkList.id);
      
      const updated = await linkListService.getLinkList(linkList.id);
      expect(updated!.placeIds).toEqual([place2.id]);
      expect(updated!.placeIds).not.toContain(place1.id);
    });

    it('should delete link list when last place is removed and no collections remain', async () => {
      // Arrange
      const place = createTestPlace();
      await db.places.add(place);
      
      const creationData: LinkListCreationData = {
        title: 'Single Place List',
        selectedPlaces: [place],
        selectedCollections: [],
      };
      
      const linkList = await linkListService.createLinkList(creationData);

      // Act
      const result = await linkListService.handlePlaceDeletion(place.id);

      // Assert
      expect(result.updatedLinkLists).toHaveLength(0);
      expect(result.deletedLinkLists).toHaveLength(1);
      expect(result.deletedLinkLists[0].id).toBe(linkList.id);
      
      const dbResult = await linkListService.getLinkList(linkList.id);
      expect(dbResult).toBeNull(); // Link list should be deleted
    });

    it('should keep link list when place is removed but collections remain', async () => {
      // Arrange
      const place = createTestPlace();
      const collection = createTestCollection();
      await db.places.add(place);
      await db.collections.add(collection);
      
      const creationData: LinkListCreationData = {
        title: 'Mixed List',
        selectedPlaces: [place],
        selectedCollections: [collection],
      };
      
      const linkList = await linkListService.createLinkList(creationData);

      // Act
      const result = await linkListService.handlePlaceDeletion(place.id);

      // Assert
      expect(result.updatedLinkLists).toHaveLength(1);
      expect(result.deletedLinkLists).toHaveLength(0);
      expect(result.updatedLinkLists[0].id).toBe(linkList.id);
      
      const updated = await linkListService.getLinkList(linkList.id);
      expect(updated).toBeDefined();
      expect(updated!.placeIds).not.toContain(place.id);
      expect(updated!.collectionIds).toEqual([collection.id]);
    });

    it('should handle deletion of non-existent place gracefully', async () => {
      // Act & Assert - Should not throw and return empty results
      const result = await linkListService.handlePlaceDeletion('non-existent-place');
      expect(result.updatedLinkLists).toHaveLength(0);
      expect(result.deletedLinkLists).toHaveLength(0);
    });

    it('should handle multiple link lists affected by same place deletion', async () => {
      // Arrange
      const place = createTestPlace();
      const otherPlace = createTestPlace({ title: 'Other Place' });
      await db.places.bulkAdd([place, otherPlace]);
      
      const creationData1: LinkListCreationData = {
        title: 'List 1',
        selectedPlaces: [place, otherPlace],
        selectedCollections: [],
      };
      
      const creationData2: LinkListCreationData = {
        title: 'List 2',
        selectedPlaces: [place],
        selectedCollections: [],
      };
      
      const linkList1 = await linkListService.createLinkList(creationData1);
      const linkList2 = await linkListService.createLinkList(creationData2);

      // Act
      const result = await linkListService.handlePlaceDeletion(place.id);

      // Assert
      expect(result.updatedLinkLists).toHaveLength(1);
      expect(result.deletedLinkLists).toHaveLength(1);
      expect(result.updatedLinkLists[0].id).toBe(linkList1.id);
      expect(result.deletedLinkLists[0].id).toBe(linkList2.id);
      
      const updated1 = await linkListService.getLinkList(linkList1.id);
      expect(updated1!.placeIds).toEqual([otherPlace.id]);
      
      const updated2 = await linkListService.getLinkList(linkList2.id);
      expect(updated2).toBeNull(); // Should be deleted as it had only one place
    });
  });

  describe('handleCollectionDeletion', () => {
    it('should remove deleted collection from link lists', async () => {
      // Arrange
      const collection1 = createTestCollection({ name: 'Collection 1' });
      const collection2 = createTestCollection({ name: 'Collection 2' });
      await db.collections.bulkAdd([collection1, collection2]);
      
      const creationData: LinkListCreationData = {
        title: 'Test Collection Cascade',
        selectedPlaces: [],
        selectedCollections: [collection1, collection2],
      };
      
      const linkList = await linkListService.createLinkList(creationData);

      // Act
      const result = await linkListService.handleCollectionDeletion(collection1.id);

      // Assert
      expect(result.updatedLinkLists).toHaveLength(1);
      expect(result.deletedLinkLists).toHaveLength(0);
      expect(result.updatedLinkLists[0].id).toBe(linkList.id);
      
      const updated = await linkListService.getLinkList(linkList.id);
      expect(updated!.collectionIds).toEqual([collection2.id]);
      expect(updated!.collectionIds).not.toContain(collection1.id);
    });

    it('should delete link list when last collection is removed and no places remain', async () => {
      // Arrange
      const collection = createTestCollection();
      await db.collections.add(collection);
      
      const creationData: LinkListCreationData = {
        title: 'Single Collection List',
        selectedPlaces: [],
        selectedCollections: [collection],
      };
      
      const linkList = await linkListService.createLinkList(creationData);

      // Act
      const result = await linkListService.handleCollectionDeletion(collection.id);

      // Assert
      expect(result.updatedLinkLists).toHaveLength(0);
      expect(result.deletedLinkLists).toHaveLength(1);
      expect(result.deletedLinkLists[0].id).toBe(linkList.id);
      
      const dbResult = await linkListService.getLinkList(linkList.id);
      expect(dbResult).toBeNull(); // Link list should be deleted
    });

    it('should keep link list when collection is removed but places remain', async () => {
      // Arrange
      const place = createTestPlace();
      const collection = createTestCollection();
      await db.places.add(place);
      await db.collections.add(collection);
      
      const creationData: LinkListCreationData = {
        title: 'Mixed List',
        selectedPlaces: [place],
        selectedCollections: [collection],
      };
      
      const linkList = await linkListService.createLinkList(creationData);

      // Act
      const result = await linkListService.handleCollectionDeletion(collection.id);

      // Assert
      expect(result.updatedLinkLists).toHaveLength(1);
      expect(result.deletedLinkLists).toHaveLength(0);
      expect(result.updatedLinkLists[0].id).toBe(linkList.id);
      
      const updated = await linkListService.getLinkList(linkList.id);
      expect(updated).toBeDefined();
      expect(updated!.collectionIds).not.toContain(collection.id);
      expect(updated!.placeIds).toEqual([place.id]);
    });

    it('should handle deletion of non-existent collection gracefully', async () => {
      // Act & Assert - Should not throw and return empty results
      const result = await linkListService.handleCollectionDeletion('non-existent-collection');
      expect(result.updatedLinkLists).toHaveLength(0);
      expect(result.deletedLinkLists).toHaveLength(0);
    });
  });
});