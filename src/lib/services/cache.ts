/**
 * Caching service for Link List performance optimization
 * Implements memory caching with TTL and size limits for mobile optimization
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  size: number;
}

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number; // Maximum cache size in bytes (approximate)
  maxEntries?: number; // Maximum number of entries
}

class MemoryCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly defaultTTL: number;
  private readonly maxSize: number;
  private readonly maxEntries: number;
  private currentSize = 0;

  constructor(options: CacheOptions = {}) {
    this.defaultTTL = options.ttl ?? 5 * 60 * 1000; // 5 minutes default
    this.maxSize = options.maxSize ?? 10 * 1024 * 1024; // 10MB default
    this.maxEntries = options.maxEntries ?? 1000; // 1000 entries default
  }

  set(key: string, data: T, ttl?: number): void {
    const now = Date.now();
    const entryTTL = ttl ?? this.defaultTTL;
    const size = this.estimateSize(data);

    // Remove expired entries before adding new one
    this.cleanup();

    // Check if we need to make space
    if (this.cache.size >= this.maxEntries || this.currentSize + size > this.maxSize) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      ttl: entryTTL,
      size,
    };

    // Remove existing entry if it exists
    if (this.cache.has(key)) {
      const existing = this.cache.get(key)!;
      this.currentSize -= existing.size;
    }

    this.cache.set(key, entry);
    this.currentSize += size;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.delete(key);
      return null;
    }

    // Update timestamp for LRU
    entry.timestamp = now;
    return entry.data;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.currentSize -= entry.size;
      return this.cache.delete(key);
    }
    return false;
  }

  clear(): void {
    this.cache.clear();
    this.currentSize = 0;
  }

  size(): number {
    return this.cache.size;
  }

  getStats() {
    return {
      entries: this.cache.size,
      sizeBytes: this.currentSize,
      maxSizeBytes: this.maxSize,
      maxEntries: this.maxEntries,
      utilization: this.currentSize / this.maxSize,
    };
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.delete(key));
  }

  private evictLRU(): void {
    if (this.cache.size === 0) return;

    // Find the least recently used entry
    let oldestKey: string | null = null;
    let oldestTimestamp = Date.now();

    for (const [key, entry] of Array.from(this.cache.entries())) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
    }
  }

  private estimateSize(data: T): number {
    try {
      // Rough estimation of object size in bytes
      const jsonString = JSON.stringify(data);
      return jsonString.length * 2; // Approximate UTF-16 encoding
    } catch {
      return 1024; // Default size if serialization fails
    }
  }
}

// Specialized caches for different data types
class LinkListCacheService {
  private placeCache = new MemoryCache<any>({
    ttl: 10 * 60 * 1000, // 10 minutes for place data
    maxSize: 5 * 1024 * 1024, // 5MB for places
    maxEntries: 500,
  });

  private urlCache = new MemoryCache<string>({
    ttl: 30 * 60 * 1000, // 30 minutes for URLs
    maxSize: 1 * 1024 * 1024, // 1MB for URLs
    maxEntries: 200,
  });

  private linkListCache = new MemoryCache<any>({
    ttl: 5 * 60 * 1000, // 5 minutes for link lists
    maxSize: 2 * 1024 * 1024, // 2MB for link lists
    maxEntries: 100,
  });

  // Place caching methods
  cachePlace(placeId: string, place: any): void {
    this.placeCache.set(`place:${placeId}`, place);
  }

  getCachedPlace(placeId: string): any | null {
    return this.placeCache.get(`place:${placeId}`);
  }

  cachePlaces(places: any[]): void {
    places.forEach(place => {
      if (place.id) {
        this.cachePlace(place.id, place);
      }
    });
  }

  getCachedPlaces(placeIds: string[]): { cached: any[]; missing: string[] } {
    const cached: any[] = [];
    const missing: string[] = [];

    placeIds.forEach(id => {
      const place = this.getCachedPlace(id);
      if (place) {
        cached.push(place);
      } else {
        missing.push(id);
      }
    });

    return { cached, missing };
  }

  // URL caching methods
  cacheURL(key: string, url: string): void {
    this.urlCache.set(`url:${key}`, url);
  }

  getCachedURL(key: string): string | null {
    return this.urlCache.get(`url:${key}`);
  }

  // Link list caching methods
  cacheLinkList(linkListId: string, linkList: any): void {
    this.linkListCache.set(`linklist:${linkListId}`, linkList);
  }

  getCachedLinkList(linkListId: string): any | null {
    return this.linkListCache.get(`linklist:${linkListId}`);
  }

  // Invalidate cached link list
  invalidateLinkList(linkListId: string): void {
    this.linkListCache.delete(`linklist:${linkListId}`);
  }

  // Cache management
  clearAll(): void {
    this.placeCache.clear();
    this.urlCache.clear();
    this.linkListCache.clear();
  }

  getStats() {
    return {
      places: this.placeCache.getStats(),
      urls: this.urlCache.getStats(),
      linkLists: this.linkListCache.getStats(),
    };
  }

  // Preload strategy for mobile optimization
  preloadPlaces(places: any[]): void {
    // Cache places in smaller batches to avoid blocking the main thread
    const batchSize = 10;
    let index = 0;

    const processBatch = () => {
      const batch = places.slice(index, index + batchSize);
      this.cachePlaces(batch);
      index += batchSize;

      if (index < places.length) {
        // Use requestIdleCallback if available, otherwise setTimeout
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(processBatch);
        } else {
          setTimeout(processBatch, 0);
        }
      }
    };

    processBatch();
  }
}

// Service Worker cache for offline support (if available)
class ServiceWorkerCache {
  private cacheName = 'pinbridge-link-lists-v1';

  async cacheURL(url: string): Promise<void> {
    if (!('serviceWorker' in navigator) || !('caches' in window)) {
      return;
    }

    try {
      const cache = await caches.open(this.cacheName);
      await cache.add(url);
    } catch (error) {
      console.warn('Failed to cache URL in service worker:', error);
    }
  }

  async getCachedResponse(url: string): Promise<Response | null> {
    if (!('caches' in window)) {
      return null;
    }

    try {
      const cache = await caches.open(this.cacheName);
      return await cache.match(url) || null;
    } catch (error) {
      console.warn('Failed to get cached response:', error);
      return null;
    }
  }

  async clearCache(): Promise<void> {
    if (!('caches' in window)) {
      return;
    }

    try {
      await caches.delete(this.cacheName);
    } catch (error) {
      console.warn('Failed to clear service worker cache:', error);
    }
  }
}

// Export singleton instances
export const linkListCache = new LinkListCacheService();
export const serviceWorkerCache = new ServiceWorkerCache();

// Cache key generators
export const cacheKeys = {
  place: (id: string) => `place:${id}`,
  linkList: (id: string) => `linklist:${id}`,
  shareableURL: (linkListId: string, placesHash: string) => `url:${linkListId}:${placesHash}`,
  appleMapsURL: (placeId: string) => `apple:${placeId}`,
  googleMapsURL: (placeId: string) => `google:${placeId}`,
};

// Utility functions for cache management
export const cacheUtils = {
  // Generate a hash for cache keys
  generateHash: (data: any): string => {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  },

  // Check if we're on a slow connection
  isSlowConnection: (): boolean => {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      return connection.effectiveType === 'slow-2g' || 
             connection.effectiveType === '2g' ||
             connection.saveData === true;
    }
    return false;
  },

  // Get cache strategy based on connection
  getCacheStrategy: () => {
    const isSlowConnection = cacheUtils.isSlowConnection();
    return {
      aggressiveCaching: isSlowConnection,
      preloadEnabled: !isSlowConnection,
      ttlMultiplier: isSlowConnection ? 2 : 1, // Cache longer on slow connections
    };
  },
};