export type Provider = 'apple' | 'google' | 'manual' | 'other';

export interface Place {
  id: string;
  title: string;
  address: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  tags: string[];
  source: Provider;
  sourceUrl?: string;
  normalizedTitle: string;
  normalizedAddress: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlaceCollection {
  id: string;
  placeId: string;
  collectionId: string;
}

export type TransferTarget = 'apple' | 'google';

export type PackItemStatus = 'pending' | 'done' | 'skipped' | 'flagged';

export interface TransferPack {
  id: string;
  name: string;
  target: TransferTarget;
  scopeType: 'library' | 'collection' | 'filtered';
  scopeId?: string; // collectionId if scopeType is 'collection'
  createdAt: Date;
  updatedAt: Date;
}

export interface TransferPackItem {
  id: string;
  packId: string;
  placeId: string;
  status: PackItemStatus;
  mismatchReason?: string;
  mismatchNotes?: string;
  completedAt?: Date;
}

export interface ImportRun {
  id: string;
  type: 'takeout' | 'csv' | 'link';
  fileName?: string;
  totalItems: number;
  importedCount: number;
  skippedCount: number;
  errors: ImportError[];
  createdAt: Date;
}

export interface ImportError {
  row?: number;
  item?: string;
  reason: string;
}

export interface ImportResult {
  success: boolean;
  importedCount: number;
  skippedCount: number;
  errors: ImportError[];
  missingCoordinatesCount: number;
  duplicateCandidatesCount: number;
}

export interface ParsedPlace {
  title: string;
  address: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  tags?: string[];
  sourceUrl?: string;
  listName?: string; // For Takeout imports
}
