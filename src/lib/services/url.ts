import type { Place, LinkList } from '@/types';
import { linkListCache, cacheKeys, cacheUtils } from './cache';

export interface URLService {
  generateShareableURL(linkList: LinkList, places: Place[]): string;
  parseShareableURL(url: string): { linkListId: string; places: Place[] } | null;
  generateQRCodeURL(linkList: LinkList, places: Place[]): string;
}

interface EncodedLinkListData {
  id: string;
  title: string;
  description?: string;
  places: EncodedPlace[];
  createdAt: string;
}

interface EncodedPlace {
  id: string;
  title: string;
  address: string;
  latitude?: number;
  longitude?: number;
  tags: string[];
}

class URLServiceImpl implements URLService {
  private readonly MAX_URL_LENGTH = 2000; // Conservative browser limit
  
  private toSafeISOString(value: Date | string | number | null | undefined): string {
    if (!value) {
      return new Date(0).toISOString();
    }

    if (value instanceof Date) {
      return isNaN(value.getTime()) ? new Date(0).toISOString() : value.toISOString();
    }

    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? new Date(0).toISOString() : parsed.toISOString();
  }

  generateShareableURL(linkList: LinkList, places: Place[]): string {
    // Generate cache key based on link list content and places
    const placesHash = cacheUtils.generateHash(places.map(p => ({ id: p.id, title: p.title, address: p.address })));
    
    // Handle invalid dates gracefully
    const createdAtString = this.toSafeISOString(linkList.createdAt);
    
    const linkListHash = cacheUtils.generateHash({
      id: linkList.id,
      title: linkList.title,
      description: linkList.description,
      createdAt: createdAtString,
    });
    const cacheKey = cacheKeys.shareableURL(linkListHash, placesHash);
    
    // Check cache first
    const cachedURL = linkListCache.getCachedURL(cacheKey);
    if (cachedURL) {
      return cachedURL;
    }
    
    const encodedData = this.encodeLinkListData(linkList, places);
    const baseUrl = this.getBaseUrl();
    const url = `${baseUrl}/link-list/${linkList.id}?data=${encodedData}`;
    
    // Check URL length and fallback if too long
    let finalURL: string;
    if (url.length > this.MAX_URL_LENGTH) {
      // Fallback: use just the ID and fetch data from IndexedDB
      finalURL = `${baseUrl}/link-list/${linkList.id}`;
    } else {
      finalURL = url;
    }
    
    // Cache the generated URL
    linkListCache.cacheURL(cacheKey, finalURL);
    
    return finalURL;
  }
  
  parseShareableURL(url: string): { linkListId: string; places: Place[] } | null {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      
      // Extract link list ID from path: /link-list/[id]
      if (pathParts.length < 3 || pathParts[1] !== 'link-list') {
        return null;
      }
      
      const linkListId = pathParts[2];
      
      // Check if data is encoded in URL parameters
      const encodedData = urlObj.searchParams.get('data');
      if (encodedData) {
        const places = this.decodeLinkListData(encodedData);
        return { linkListId, places };
      }
      
      // If no encoded data, return just the ID (caller should fetch from IndexedDB)
      return { linkListId, places: [] };
    } catch (error) {
      console.error('Failed to parse shareable URL:', error);
      return null;
    }
  }
  
  generateQRCodeURL(linkList: LinkList, places: Place[]): string {
    // QR codes use the same URL as shareable URLs, but we can cache them separately
    // if needed for different QR-specific optimizations
    return this.generateShareableURL(linkList, places);
  }
  
  private encodeLinkListData(linkList: LinkList, places: Place[]): string {
    const encodedPlaces: EncodedPlace[] = places.map(place => ({
      id: place.id,
      title: place.title,
      address: place.address,
      latitude: place.latitude,
      longitude: place.longitude,
      tags: place.tags,
    }));
    
    const data: EncodedLinkListData = {
      id: linkList.id,
      title: linkList.title,
      description: linkList.description,
      places: encodedPlaces,
      createdAt: this.toSafeISOString(linkList.createdAt),
    };
    
    const jsonString = JSON.stringify(data);
    return this.base64Encode(jsonString);
  }
  
  private decodeLinkListData(encodedData: string): Place[] {
    try {
      const jsonString = this.base64Decode(encodedData);
      const data: EncodedLinkListData = JSON.parse(jsonString);
      
      return data.places.map(encodedPlace => ({
        ...encodedPlace,
        notes: undefined,
        source: 'other' as const,
        sourceUrl: undefined,
        normalizedTitle: encodedPlace.title.toLowerCase().trim(),
        normalizedAddress: encodedPlace.address.toLowerCase().trim(),
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.createdAt),
      }));
    } catch (error) {
      console.error('Failed to decode link list data:', error);
      return [];
    }
  }
  
  private base64Encode(str: string): string {
    // Use browser's btoa for base64 encoding
    return btoa(unescape(encodeURIComponent(str)));
  }
  
  private base64Decode(str: string): string {
    // Use browser's atob for base64 decoding
    return decodeURIComponent(escape(atob(str)));
  }
  
  private getBaseUrl(): string {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    
    // Fallback for server-side rendering
    return process.env.NEXT_PUBLIC_BASE_URL || 'https://localhost:3000';
  }
  
  // Validate URL format
  isValidLinkListURL(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      
      return pathParts.length >= 3 && 
             pathParts[1] === 'link-list' && 
             pathParts[2].length > 0;
    } catch {
      return false;
    }
  }
  
  // Extract link list ID from URL
  extractLinkListId(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      
      if (pathParts.length >= 3 && pathParts[1] === 'link-list') {
        return pathParts[2];
      }
      
      return null;
    } catch {
      return null;
    }
  }
}

// Export singleton instance
export const urlService = new URLServiceImpl();
