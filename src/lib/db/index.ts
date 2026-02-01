import Dexie, { Table } from 'dexie';
import type {
  Place,
  Collection,
  PlaceCollection,
  TransferPack,
  TransferPackItem,
  ImportRun,
  LinkList,
} from '@/types';

export class PinBridgeDB extends Dexie {
  places!: Table<Place, string>;
  collections!: Table<Collection, string>;
  placeCollections!: Table<PlaceCollection, string>;
  transferPacks!: Table<TransferPack, string>;
  transferPackItems!: Table<TransferPackItem, string>;
  importRuns!: Table<ImportRun, string>;
  linkLists!: Table<LinkList, string>;

  constructor() {
    super('pinbridge');

    this.version(1).stores({
      places:
        'id, title, address, normalizedTitle, normalizedAddress, source, createdAt, updatedAt, [normalizedTitle+normalizedAddress]',
      collections: 'id, name, createdAt',
      placeCollections: 'id, placeId, collectionId, [placeId+collectionId]',
      transferPacks: 'id, name, target, createdAt',
      transferPackItems: 'id, packId, placeId, status, [packId+status]',
      importRuns: 'id, type, createdAt',
    });

    // Version 2: Add LinkList table
    this.version(2).stores({
      places:
        'id, title, address, normalizedTitle, normalizedAddress, source, createdAt, updatedAt, [normalizedTitle+normalizedAddress]',
      collections: 'id, name, createdAt',
      placeCollections: 'id, placeId, collectionId, [placeId+collectionId]',
      transferPacks: 'id, name, target, createdAt',
      transferPackItems: 'id, packId, placeId, status, [packId+status]',
      importRuns: 'id, type, createdAt',
      linkLists: 'id, title, createdAt, isPublic, updatedAt',
    });
  }
}

export const db = new PinBridgeDB();

// Helper functions
export async function getPlaceCount(): Promise<number> {
  return db.places.count();
}

export async function getCollectionCount(): Promise<number> {
  return db.collections.count();
}

export async function getMissingCoordinatesCount(): Promise<number> {
  return db.places
    .filter((place) => place.latitude === undefined || place.longitude === undefined)
    .count();
}

export async function clearAllData(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      await table.clear();
    }
  });
}

export async function getPlacesInCollection(collectionId: string): Promise<Place[]> {
  const memberships = await db.placeCollections
    .where('collectionId')
    .equals(collectionId)
    .toArray();
  const placeIds = memberships.map((m) => m.placeId);
  return db.places.where('id').anyOf(placeIds).toArray();
}

export async function getCollectionsForPlace(placeId: string): Promise<Collection[]> {
  const memberships = await db.placeCollections
    .where('placeId')
    .equals(placeId)
    .toArray();
  const collectionIds = memberships.map((m) => m.collectionId);
  return db.collections.where('id').anyOf(collectionIds).toArray();
}

export async function getLinkListCount(): Promise<number> {
  return db.linkLists.count();
}

export async function getPlacesInLinkList(linkListId: string): Promise<Place[]> {
  const linkList = await db.linkLists.get(linkListId);
  if (!linkList) return [];
  
  return db.places.where('id').anyOf(linkList.placeIds).toArray();
}

export async function getCollectionsInLinkList(linkListId: string): Promise<Collection[]> {
  const linkList = await db.linkLists.get(linkListId);
  if (!linkList) return [];
  
  return db.collections.where('id').anyOf(linkList.collectionIds).toArray();
}
