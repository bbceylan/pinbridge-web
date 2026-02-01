import { create } from 'zustand';
import { db } from '@/lib/db';
import { generateId, normalizeString } from '@/lib/utils';
import type { Place, Collection, PlaceCollection, ParsedPlace, ImportResult } from '@/types';

interface PlacesState {
  places: Place[];
  collections: Collection[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadPlaces: () => Promise<void>;
  loadCollections: () => Promise<void>;
  addPlace: (place: Omit<Place, 'id' | 'normalizedTitle' | 'normalizedAddress' | 'createdAt' | 'updatedAt'>) => Promise<Place>;
  updatePlace: (id: string, updates: Partial<Place>) => Promise<void>;
  deletePlace: (id: string) => Promise<void>;
  importPlaces: (parsedPlaces: ParsedPlace[], collectionName?: string) => Promise<ImportResult>;
  createCollection: (name: string, description?: string) => Promise<Collection>;
  updateCollection: (id: string, updates: Partial<Collection>) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  addPlaceToCollection: (placeId: string, collectionId: string) => Promise<void>;
  removePlaceFromCollection: (placeId: string, collectionId: string) => Promise<void>;
  getPlacesInCollection: (collectionId: string) => Promise<Place[]>;
}

export const usePlacesStore = create<PlacesState>((set, get) => ({
  places: [],
  collections: [],
  isLoading: false,
  error: null,

  loadPlaces: async () => {
    set({ isLoading: true, error: null });
    try {
      const places = await db.places.toArray();
      set({ places, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load places',
        isLoading: false,
      });
    }
  },

  loadCollections: async () => {
    try {
      const collections = await db.collections.toArray();
      set({ collections });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load collections',
      });
    }
  },

  addPlace: async (placeData) => {
    const now = new Date();
    const place: Place = {
      ...placeData,
      id: generateId(),
      normalizedTitle: normalizeString(placeData.title),
      normalizedAddress: normalizeString(placeData.address),
      createdAt: now,
      updatedAt: now,
    };

    await db.places.add(place);
    set((state) => ({ places: [...state.places, place] }));
    return place;
  },

  updatePlace: async (id, updates) => {
    const updatedData = {
      ...updates,
      updatedAt: new Date(),
      ...(updates.title && { normalizedTitle: normalizeString(updates.title) }),
      ...(updates.address && { normalizedAddress: normalizeString(updates.address) }),
    };

    await db.places.update(id, updatedData);
    set((state) => ({
      places: state.places.map((p) =>
        p.id === id ? { ...p, ...updatedData } : p
      ),
    }));
  },

  deletePlace: async (id) => {
    await db.transaction('rw', [db.places, db.placeCollections, db.transferPackItems], async () => {
      await db.places.delete(id);
      await db.placeCollections.where('placeId').equals(id).delete();
      await db.transferPackItems.where('placeId').equals(id).delete();
    });
    set((state) => ({
      places: state.places.filter((p) => p.id !== id),
    }));
  },

  importPlaces: async (parsedPlaces, collectionName) => {
    const result: ImportResult = {
      success: true,
      importedCount: 0,
      skippedCount: 0,
      errors: [],
      missingCoordinatesCount: 0,
      duplicateCandidatesCount: 0,
    };

    let collection: Collection | undefined;
    if (collectionName) {
      collection = await get().createCollection(collectionName);
    }

    const existingPlaces = await db.places.toArray();
    const existingMap = new Map(
      existingPlaces.map((p) => [`${p.normalizedTitle}|${p.normalizedAddress}`, p])
    );

    for (const parsed of parsedPlaces) {
      try {
        const normalizedTitle = normalizeString(parsed.title);
        const normalizedAddress = normalizeString(parsed.address);
        const key = `${normalizedTitle}|${normalizedAddress}`;

        // Check for duplicate
        if (existingMap.has(key)) {
          result.duplicateCandidatesCount++;
          result.skippedCount++;
          continue;
        }

        const now = new Date();
        const place: Place = {
          id: generateId(),
          title: parsed.title,
          address: parsed.address,
          latitude: parsed.latitude,
          longitude: parsed.longitude,
          notes: parsed.notes,
          tags: parsed.tags || [],
          source: parsed.sourceUrl?.includes('google') ? 'google' :
                  parsed.sourceUrl?.includes('apple') ? 'apple' : 'manual',
          sourceUrl: parsed.sourceUrl,
          normalizedTitle,
          normalizedAddress,
          createdAt: now,
          updatedAt: now,
        };

        await db.places.add(place);
        existingMap.set(key, place);

        if (parsed.latitude === undefined || parsed.longitude === undefined) {
          result.missingCoordinatesCount++;
        }

        if (collection) {
          await db.placeCollections.add({
            id: generateId(),
            placeId: place.id,
            collectionId: collection.id,
          });
        }

        result.importedCount++;
      } catch (error) {
        result.errors.push({
          item: parsed.title,
          reason: error instanceof Error ? error.message : 'Unknown error',
        });
        result.skippedCount++;
      }
    }

    await get().loadPlaces();
    return result;
  },

  createCollection: async (name, description) => {
    const now = new Date();
    const collection: Collection = {
      id: generateId(),
      name,
      description,
      createdAt: now,
      updatedAt: now,
    };

    await db.collections.add(collection);
    set((state) => ({ collections: [...state.collections, collection] }));
    return collection;
  },

  updateCollection: async (id, updates) => {
    const updatedData = { ...updates, updatedAt: new Date() };
    await db.collections.update(id, updatedData);
    set((state) => ({
      collections: state.collections.map((c) =>
        c.id === id ? { ...c, ...updatedData } : c
      ),
    }));
  },

  deleteCollection: async (id) => {
    await db.transaction('rw', [db.collections, db.placeCollections], async () => {
      await db.collections.delete(id);
      await db.placeCollections.where('collectionId').equals(id).delete();
    });
    set((state) => ({
      collections: state.collections.filter((c) => c.id !== id),
    }));
  },

  addPlaceToCollection: async (placeId, collectionId) => {
    // Check if already exists
    const existing = await db.placeCollections
      .where('[placeId+collectionId]')
      .equals([placeId, collectionId])
      .first();

    if (!existing) {
      await db.placeCollections.add({
        id: generateId(),
        placeId,
        collectionId,
      });
    }
  },

  removePlaceFromCollection: async (placeId, collectionId) => {
    await db.placeCollections
      .where('[placeId+collectionId]')
      .equals([placeId, collectionId])
      .delete();
  },

  getPlacesInCollection: async (collectionId) => {
    const memberships = await db.placeCollections
      .where('collectionId')
      .equals(collectionId)
      .toArray();
    const placeIds = memberships.map((m) => m.placeId);
    return db.places.where('id').anyOf(placeIds).toArray();
  },
}));
