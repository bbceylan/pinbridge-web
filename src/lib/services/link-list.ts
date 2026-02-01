import { db } from '@/lib/db';
import { generateId } from '@/lib/utils';
import type { LinkList, Place, Collection } from '@/types';

export interface LinkListCreationData {
  title: string;
  description?: string;
  selectedPlaces: Place[];
  selectedCollections: Collection[];
}

export interface LinkListService {
  createLinkList(data: LinkListCreationData): Promise<LinkList>;
  getLinkList(id: string): Promise<LinkList | null>;
  deleteLinkList(id: string): Promise<void>;
  getUserLinkLists(): Promise<LinkList[]>;
  updateLinkList(id: string, updates: Partial<LinkList>): Promise<void>;
}

class LinkListServiceImpl implements LinkListService {
  async createLinkList(data: LinkListCreationData): Promise<LinkList> {
    const now = new Date();
    
    // Extract place IDs from selected places
    const placeIds = data.selectedPlaces.map(place => place.id);
    
    // Extract collection IDs from selected collections
    const collectionIds = data.selectedCollections.map(collection => collection.id);
    
    // If collections are selected, also include all places from those collections
    if (collectionIds.length > 0) {
      const collectionPlaces = await this.getPlacesFromCollections(collectionIds);
      const collectionPlaceIds = collectionPlaces.map(place => place.id);
      
      // Merge and deduplicate place IDs
      const allPlaceIds = Array.from(new Set([...placeIds, ...collectionPlaceIds]));
      placeIds.splice(0, placeIds.length, ...allPlaceIds);
    }
    
    const linkList: LinkList = {
      id: generateId(),
      title: data.title,
      description: data.description,
      placeIds,
      collectionIds,
      createdAt: now,
      updatedAt: now,
      isPublic: true, // Default to public for sharing
    };
    
    await db.linkLists.add(linkList);
    return linkList;
  }
  
  async getLinkList(id: string): Promise<LinkList | null> {
    const linkList = await db.linkLists.get(id);
    return linkList ?? null;
  }
  
  async deleteLinkList(id: string): Promise<void> {
    await db.linkLists.delete(id);
  }
  
  async getUserLinkLists(): Promise<LinkList[]> {
    return db.linkLists.orderBy('createdAt').reverse().toArray();
  }
  
  async updateLinkList(id: string, updates: Partial<LinkList>): Promise<void> {
    await db.linkLists.update(id, {
      ...updates,
      updatedAt: new Date(),
    });
  }
  
  private async getPlacesFromCollections(collectionIds: string[]): Promise<Place[]> {
    const memberships = await db.placeCollections
      .where('collectionId')
      .anyOf(collectionIds)
      .toArray();
    
    const placeIds = memberships.map(m => m.placeId);
    return db.places.where('id').anyOf(placeIds).toArray();
  }
  
  // Helper method to get places for a link list
  async getPlacesForLinkList(linkListId: string): Promise<Place[]> {
    const linkList = await this.getLinkList(linkListId);
    if (!linkList) return [];
    
    return db.places.where('id').anyOf(linkList.placeIds).toArray();
  }
  
  // Helper method to get collections for a link list
  async getCollectionsForLinkList(linkListId: string): Promise<Collection[]> {
    const linkList = await this.getLinkList(linkListId);
    if (!linkList) return [];
    
    return db.collections.where('id').anyOf(linkList.collectionIds).toArray();
  }
  
  // Handle cascade updates when places are deleted
  async handlePlaceDeletion(placeId: string): Promise<void> {
    const affectedLinkLists = await db.linkLists
      .filter(linkList => linkList.placeIds.includes(placeId))
      .toArray();
    
    for (const linkList of affectedLinkLists) {
      const updatedPlaceIds = linkList.placeIds.filter(id => id !== placeId);
      
      // If no places remain, delete the link list
      if (updatedPlaceIds.length === 0 && linkList.collectionIds.length === 0) {
        await this.deleteLinkList(linkList.id);
      } else {
        // Update the link list to remove the deleted place
        await this.updateLinkList(linkList.id, {
          placeIds: updatedPlaceIds,
        });
      }
    }
  }
  
  // Handle cascade updates when collections are deleted
  async handleCollectionDeletion(collectionId: string): Promise<void> {
    const affectedLinkLists = await db.linkLists
      .filter(linkList => linkList.collectionIds.includes(collectionId))
      .toArray();
    
    for (const linkList of affectedLinkLists) {
      const updatedCollectionIds = linkList.collectionIds.filter(id => id !== collectionId);
      
      // If no collections remain and no individual places, delete the link list
      if (updatedCollectionIds.length === 0 && linkList.placeIds.length === 0) {
        await this.deleteLinkList(linkList.id);
      } else {
        // Update the link list to remove the deleted collection
        await this.updateLinkList(linkList.id, {
          collectionIds: updatedCollectionIds,
        });
      }
    }
  }
}

// Export singleton instance
export const linkListService = new LinkListServiceImpl();