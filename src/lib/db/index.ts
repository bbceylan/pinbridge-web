import Dexie, { Table } from 'dexie';
import type {
  Place,
  Collection,
  PlaceCollection,
  TransferPack,
  TransferPackItem,
  ImportRun,
  LinkList,
  TransferPackSession,
  PlaceMatchRecord,
  VerificationStatus,
  ConfidenceLevel,
} from '@/types';
import type { APIUsageLog, CacheEntry, APIService } from '@/lib/services/api/types';
import type { CacheEntry as IntelligentCacheEntry } from '@/lib/services/intelligent-cache';

export class PinBridgeDB extends Dexie {
  places!: Table<Place, string>;
  collections!: Table<Collection, string>;
  placeCollections!: Table<PlaceCollection, string>;
  transferPacks!: Table<TransferPack, string>;
  transferPackItems!: Table<TransferPackItem, string>;
  importRuns!: Table<ImportRun, string>;
  linkLists!: Table<LinkList, string>;
  apiCache!: Table<CacheEntry<any> & { key: string }, string>;
  apiUsageLog!: Table<APIUsageLog, string>;
  transferPackSessions!: Table<TransferPackSession, string>;
  placeMatchRecords!: Table<PlaceMatchRecord, string>;
  cacheEntries!: Table<IntelligentCacheEntry<any>, string>;

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

    // Version 3: Add API cache and usage logging
    this.version(3).stores({
      places:
        'id, title, address, normalizedTitle, normalizedAddress, source, createdAt, updatedAt, [normalizedTitle+normalizedAddress]',
      collections: 'id, name, createdAt',
      placeCollections: 'id, placeId, collectionId, [placeId+collectionId]',
      transferPacks: 'id, name, target, createdAt',
      transferPackItems: 'id, packId, placeId, status, [packId+status]',
      importRuns: 'id, type, createdAt',
      linkLists: 'id, title, createdAt, isPublic, updatedAt',
      apiCache: 'key, timestamp',
      apiUsageLog: 'id, service, endpoint, createdAt, [service+createdAt]',
    });

    // Version 4: Add automated transfer with verification tables
    this.version(4).stores({
      places:
        'id, title, address, normalizedTitle, normalizedAddress, source, createdAt, updatedAt, [normalizedTitle+normalizedAddress]',
      collections: 'id, name, createdAt',
      placeCollections: 'id, placeId, collectionId, [placeId+collectionId]',
      transferPacks: 'id, name, target, createdAt',
      transferPackItems: 'id, packId, placeId, status, [packId+status]',
      importRuns: 'id, type, createdAt',
      linkLists: 'id, title, createdAt, isPublic, updatedAt',
      apiCache: 'key, timestamp',
      apiUsageLog: 'id, service, endpoint, createdAt, sessionId, [service+createdAt], [sessionId+createdAt]',
      transferPackSessions: 'id, packId, status, createdAt, updatedAt, [packId+status], [status+updatedAt]',
      placeMatchRecords: 'id, sessionId, originalPlaceId, confidenceLevel, verificationStatus, verifiedAt, [sessionId+verificationStatus], [sessionId+confidenceLevel], [originalPlaceId+sessionId]',
    });

    // Version 5: Add intelligent caching system
    this.version(5).stores({
      places:
        'id, title, address, normalizedTitle, normalizedAddress, source, createdAt, updatedAt, [normalizedTitle+normalizedAddress]',
      collections: 'id, name, createdAt',
      placeCollections: 'id, placeId, collectionId, [placeId+collectionId]',
      transferPacks: 'id, name, target, createdAt',
      transferPackItems: 'id, packId, placeId, status, [packId+status]',
      importRuns: 'id, type, createdAt',
      linkLists: 'id, title, createdAt, isPublic, updatedAt',
      apiCache: 'key, timestamp',
      apiUsageLog: 'id, service, endpoint, createdAt, sessionId, [service+createdAt], [sessionId+createdAt]',
      transferPackSessions: 'id, packId, status, createdAt, updatedAt, [packId+status], [status+updatedAt]',
      placeMatchRecords: 'id, sessionId, originalPlaceId, confidenceLevel, verificationStatus, verifiedAt, [sessionId+verificationStatus], [sessionId+confidenceLevel], [originalPlaceId+sessionId]',
      cacheEntries: 'key, expiresAt, lastAccessedAt, createdAt, tags, [expiresAt+lastAccessedAt]',
    });

    // Version 6: Add updatedAt index for transfer packs
    this.version(6).stores({
      places:
        'id, title, address, normalizedTitle, normalizedAddress, source, createdAt, updatedAt, [normalizedTitle+normalizedAddress]',
      collections: 'id, name, createdAt',
      placeCollections: 'id, placeId, collectionId, [placeId+collectionId]',
      transferPacks: 'id, name, target, createdAt, updatedAt',
      transferPackItems: 'id, packId, placeId, status, [packId+status]',
      importRuns: 'id, type, createdAt',
      linkLists: 'id, title, createdAt, isPublic, updatedAt',
      apiCache: 'key, timestamp',
      apiUsageLog: 'id, service, endpoint, createdAt, sessionId, [service+createdAt], [sessionId+createdAt]',
      transferPackSessions: 'id, packId, status, createdAt, updatedAt, [packId+status], [status+updatedAt]',
      placeMatchRecords: 'id, sessionId, originalPlaceId, confidenceLevel, verificationStatus, verifiedAt, [sessionId+verificationStatus], [sessionId+confidenceLevel], [originalPlaceId+sessionId]',
      cacheEntries: 'key, expiresAt, lastAccessedAt, createdAt, tags, [expiresAt+lastAccessedAt]',
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

// Transfer Pack Session helpers
export async function getActiveTransferSessions(): Promise<TransferPackSession[]> {
  return db.transferPackSessions
    .where('status')
    .anyOf(['processing', 'verifying', 'paused'])
    .toArray();
}

export async function getTransferSessionForPack(packId: string): Promise<TransferPackSession | undefined> {
  return db.transferPackSessions
    .where('packId')
    .equals(packId)
    .first();
}

export async function getPlaceMatchesForSession(sessionId: string): Promise<PlaceMatchRecord[]> {
  return db.placeMatchRecords
    .where('sessionId')
    .equals(sessionId)
    .toArray();
}

export async function getPlaceMatchesByStatus(
  sessionId: string, 
  status: VerificationStatus
): Promise<PlaceMatchRecord[]> {
  return db.placeMatchRecords
    .where('[sessionId+verificationStatus]')
    .equals([sessionId, status])
    .toArray();
}

export async function getPlaceMatchesByConfidence(
  sessionId: string, 
  confidenceLevel: ConfidenceLevel
): Promise<PlaceMatchRecord[]> {
  return db.placeMatchRecords
    .where('[sessionId+confidenceLevel]')
    .equals([sessionId, confidenceLevel])
    .toArray();
}

export async function getAPIUsageForSession(sessionId: string): Promise<APIUsageLog[]> {
  return db.apiUsageLog
    .where('sessionId')
    .equals(sessionId)
    .toArray();
}

export async function getAPIUsageStats(
  service: APIService,
  startDate: Date,
  endDate: Date
): Promise<{ totalCalls: number; totalResponseTime: number; errorCount: number }> {
  const logs = await db.apiUsageLog
    .where('[service+createdAt]')
    .between([service, startDate], [service, endDate])
    .toArray();

  return {
    totalCalls: logs.length,
    totalResponseTime: logs.reduce((sum, log) => sum + log.responseTimeMs, 0),
    errorCount: logs.filter(log => log.responseStatus >= 400).length,
  };
}
