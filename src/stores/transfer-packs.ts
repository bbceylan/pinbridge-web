import { create } from 'zustand';
import { db } from '@/lib/db';
import { generateId } from '@/lib/utils';
import type {
  TransferPack,
  TransferPackItem,
  TransferTarget,
  PackItemStatus,
  Place,
} from '@/types';

interface TransferPacksState {
  packs: TransferPack[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadPacks: () => Promise<void>;
  createPack: (
    name: string,
    target: TransferTarget,
    placeIds: string[],
    scopeType: 'library' | 'collection' | 'filtered',
    scopeId?: string
  ) => Promise<TransferPack>;
  deletePack: (id: string) => Promise<void>;
  renamePack: (id: string, name: string) => Promise<void>;
  getPackItems: (packId: string) => Promise<TransferPackItem[]>;
  /**
   * @deprecated Use reactive queries instead of imperative progress fetching.
   * Consider using useLiveQuery(() => db.transferPackItems.where('packId').equals(packId).toArray())
   * and calculating progress with useMemo for better performance and consistency.
   * This method will be removed in a future version.
   */
  getPackProgress: (packId: string) => Promise<{ done: number; total: number }>;
  updateItemStatus: (
    itemId: string,
    status: PackItemStatus,
    mismatchReason?: string,
    mismatchNotes?: string
  ) => Promise<void>;
  getNextPendingItem: (packId: string) => Promise<TransferPackItem | null>;
  getItemWithPlace: (itemId: string) => Promise<{ item: TransferPackItem; place: Place } | null>;
}

export const useTransferPacksStore = create<TransferPacksState>((set, get) => ({
  packs: [],
  isLoading: false,
  error: null,

  loadPacks: async () => {
    set({ isLoading: true, error: null });
    try {
      const packs = await db.transferPacks.orderBy('createdAt').reverse().toArray();
      set({ packs, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load packs',
        isLoading: false,
      });
    }
  },

  createPack: async (name, target, placeIds, scopeType, scopeId) => {
    const now = new Date();
    const pack: TransferPack = {
      id: generateId(),
      name,
      target,
      scopeType,
      scopeId,
      createdAt: now,
      updatedAt: now,
    };

    const items: TransferPackItem[] = placeIds.map((placeId) => ({
      id: generateId(),
      packId: pack.id,
      placeId,
      status: 'pending' as const,
    }));

    await db.transaction('rw', [db.transferPacks, db.transferPackItems], async () => {
      await db.transferPacks.add(pack);
      await db.transferPackItems.bulkAdd(items);
    });

    set((state) => ({ packs: [pack, ...state.packs] }));
    return pack;
  },

  deletePack: async (id) => {
    await db.transaction('rw', [db.transferPacks, db.transferPackItems], async () => {
      await db.transferPacks.delete(id);
      await db.transferPackItems.where('packId').equals(id).delete();
    });
    set((state) => ({
      packs: state.packs.filter((p) => p.id !== id),
    }));
  },

  renamePack: async (id, name) => {
    await db.transferPacks.update(id, { name, updatedAt: new Date() });
    set((state) => ({
      packs: state.packs.map((p) =>
        p.id === id ? { ...p, name, updatedAt: new Date() } : p
      ),
    }));
  },

  getPackItems: async (packId) => {
    return db.transferPackItems.where('packId').equals(packId).toArray();
  },

  /**
   * @deprecated Use reactive queries instead of imperative progress fetching.
   * Consider using useLiveQuery(() => db.transferPackItems.where('packId').equals(packId).toArray())
   * and calculating progress with useMemo for better performance and consistency.
   * This method will be removed in a future version.
   */
  getPackProgress: async (packId) => {
    const items = await db.transferPackItems.where('packId').equals(packId).toArray();
    const done = items.filter(
      (item) => item.status === 'done' || item.status === 'skipped'
    ).length;
    return { done, total: items.length };
  },

  updateItemStatus: async (itemId, status, mismatchReason, mismatchNotes) => {
    const updates: Partial<TransferPackItem> = {
      status,
      ...(status === 'done' || status === 'skipped' ? { completedAt: new Date() } : {}),
      ...(mismatchReason ? { mismatchReason } : {}),
      ...(mismatchNotes ? { mismatchNotes } : {}),
    };

    await db.transferPackItems.update(itemId, updates);

    // Update pack's updatedAt
    const item = await db.transferPackItems.get(itemId);
    if (item) {
      await db.transferPacks.update(item.packId, { updatedAt: new Date() });
    }
  },

  getNextPendingItem: async (packId) => {
    const item = await db.transferPackItems
      .where('[packId+status]')
      .equals([packId, 'pending'])
      .first();
    return item ?? null;
  },

  getItemWithPlace: async (itemId) => {
    const item = await db.transferPackItems.get(itemId);
    if (!item) return null;

    const place = await db.places.get(item.placeId);
    if (!place) return null;

    return { item, place };
  },
}));
