/**
 * Intelligent Caching System for Automated Transfer
 * 
 * Provides multi-level caching with TTL management, cache invalidation,
 * and performance monitoring for API responses and match results.
 */

import { db } from '@/lib/db';
import type { NormalizedPlace } from './api/response-normalizer';
import type { PlaceMatch } from './matching/place-matching';

export interface CacheEntry<T = any> {
  id: string;
  key: string;
  data: T;
  createdAt: Date;
  expiresAt: Date;
  accessCount: number;
  lastAccessedAt: Date;
  size: number; // Size in bytes
  tags: string[]; // For cache invalidation
}

export interface CacheConfig {
  defaultTTL: number; // Default TTL in milliseconds
  maxSize: number; // Maximum cache size in bytes
  maxEntries: number; // Maximum number of entries
  cleanupInterval: number; // Cleanup interval in milliseconds
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  averageAccessTime: number;
  oldestEntry: Date | null;
  newestEntry: Date | null;
}

const DEFAULT_CONFIG: CacheConfig = {
  defaultTTL: 24 * 60 * 60 * 1000, // 24 hours
  maxSize: 50 * 1024 * 1024, // 50MB
  maxEntries: 10000,
  cleanupInterval: 60 * 60 * 1000, // 1 hour
};

export class IntelligentCache {
  private config: CacheConfig;
  private stats = {
    hits: 0,
    misses: 0,
    totalAccessTime: 0,
    accessCount: 0,
  };
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCleanupTimer();
  }

  /**
   * Get cached data by key
   */
  async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now();
    
    try {
      if (!db?.cacheEntries) {
        this.stats.misses++;
        return null;
      }
      const entry = await db.cacheEntries.get(key);
      
      if (!entry) {
        this.stats.misses++;
        return null;
      }

      // Check if entry has expired
      if (entry.expiresAt < new Date()) {
        await this.delete(key);
        this.stats.misses++;
        return null;
      }

      // Update access statistics
      await db.cacheEntries.update(key, {
        accessCount: entry.accessCount + 1,
        lastAccessedAt: new Date(),
      });

      this.stats.hits++;
      return entry.data as T;

    } finally {
      const accessTime = Date.now() - startTime;
      this.stats.totalAccessTime += accessTime;
      this.stats.accessCount++;
    }
  }

  /**
   * Set cached data with optional TTL and tags
   */
  async set<T>(
    key: string, 
    data: T, 
    options: {
      ttl?: number;
      tags?: string[];
    } = {}
  ): Promise<void> {
    if (!db?.cacheEntries) {
      return;
    }
    const ttl = options.ttl || this.config.defaultTTL;
    const tags = options.tags || [];
    const size = this.calculateSize(data);
    
    const entry: CacheEntry<T> = {
      id: key,
      key,
      data,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + ttl),
      accessCount: 0,
      lastAccessedAt: new Date(),
      size,
      tags,
    };

    // Check cache size limits before adding
    await this.ensureCacheSize(size);
    
    await db.cacheEntries.put(entry);
  }

  /**
   * Delete cached entry by key
   */
  async delete(key: string): Promise<void> {
    if (!db?.cacheEntries) return;
    await db.cacheEntries.delete(key);
  }

  /**
   * Clear all cached entries
   */
  async clear(): Promise<void> {
    if (!db?.cacheEntries) return;
    await db.cacheEntries.clear();
    this.resetStats();
  }

  /**
   * Invalidate cache entries by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    if (!db?.cacheEntries) return 0;
    const entries = await db.cacheEntries
      .filter(entry => entry.tags.some(tag => tags.includes(tag)))
      .toArray();

    await db.cacheEntries.bulkDelete(entries.map(e => e.key));
    return entries.length;
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    if (!db?.cacheEntries) {
      return {
        totalEntries: 0,
        totalSize: 0,
        hitRate: 0,
        missRate: 0,
        averageAccessTime: 0,
        oldestEntry: null,
        newestEntry: null,
      };
    }
    const entries = await db.cacheEntries.toArray();
    const totalEntries = entries.length;
    const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
    
    const hitRate = this.stats.accessCount > 0 ? 
      (this.stats.hits / this.stats.accessCount) * 100 : 0;
    const missRate = 100 - hitRate;
    
    const averageAccessTime = this.stats.accessCount > 0 ? 
      this.stats.totalAccessTime / this.stats.accessCount : 0;

    const dates = entries.map(e => e.createdAt);
    const oldestEntry = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : null;
    const newestEntry = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;

    return {
      totalEntries,
      totalSize,
      hitRate,
      missRate,
      averageAccessTime,
      oldestEntry,
      newestEntry,
    };
  }

  /**
   * Cleanup expired entries
   */
  async cleanup(): Promise<number> {
    if (!db?.cacheEntries) return 0;
    const now = new Date();
    const expiredEntries = await db.cacheEntries
      .filter(entry => entry.expiresAt < now)
      .toArray();

    if (expiredEntries.length > 0) {
      await db.cacheEntries.bulkDelete(expiredEntries.map(e => e.key));
    }

    return expiredEntries.length;
  }

  /**
   * Ensure cache doesn't exceed size limits
   */
  private async ensureCacheSize(newEntrySize: number): Promise<void> {
    if (!db?.cacheEntries) return;
    const stats = await this.getStats();
    
    // If adding this entry would exceed limits, remove old entries
    if (stats.totalSize + newEntrySize > this.config.maxSize || 
        stats.totalEntries >= this.config.maxEntries) {
      
      // Get entries sorted by last access time (LRU)
      const entries = await db.cacheEntries
        .orderBy('lastAccessedAt')
        .toArray();

      let removedSize = 0;
      let removedCount = 0;
      const toRemove: string[] = [];

      for (const entry of entries) {
        toRemove.push(entry.key);
        removedSize += entry.size;
        removedCount++;

        // Stop when we've freed enough space and entries
        if (stats.totalSize - removedSize + newEntrySize <= this.config.maxSize &&
            stats.totalEntries - removedCount < this.config.maxEntries) {
          break;
        }
      }

      if (toRemove.length > 0) {
        await db.cacheEntries.bulkDelete(toRemove);
      }
    }
  }

  /**
   * Calculate approximate size of data in bytes
   */
  private calculateSize(data: any): number {
    try {
      return new Blob([JSON.stringify(data)]).size;
    } catch {
      // Fallback estimation
      return JSON.stringify(data).length * 2; // Rough estimate for UTF-16
    }
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(async () => {
      try {
        await this.cleanup();
      } catch (error) {
        console.warn('Cache cleanup failed:', error);
      }
    }, this.config.cleanupInterval);
  }

  /**
   * Stop cleanup timer
   */
  private stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /**
   * Reset statistics
   */
  private resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      totalAccessTime: 0,
      accessCount: 0,
    };
  }

  /**
   * Destroy cache instance
   */
  destroy(): void {
    this.stopCleanupTimer();
  }
}

/**
 * Specialized cache for API responses
 */
export class ApiResponseCache extends IntelligentCache {
  constructor() {
    super({
      defaultTTL: 6 * 60 * 60 * 1000, // 6 hours for API responses
      maxSize: 20 * 1024 * 1024, // 20MB
      maxEntries: 5000,
    });
  }

  /**
   * Cache API response with service-specific key
   */
  async cacheApiResponse(
    service: 'apple' | 'google',
    query: string,
    response: NormalizedPlace[]
  ): Promise<void> {
    const key = this.generateApiKey(service, query);
    await this.set(key, response, {
      tags: [`api:${service}`, 'api-response'],
    });
  }

  /**
   * Get cached API response
   */
  async getCachedApiResponse(
    service: 'apple' | 'google',
    query: string
  ): Promise<NormalizedPlace[] | null> {
    const key = this.generateApiKey(service, query);
    return this.get<NormalizedPlace[]>(key);
  }

  /**
   * Invalidate API responses for a specific service
   */
  async invalidateService(service: 'apple' | 'google'): Promise<number> {
    return this.invalidateByTags([`api:${service}`]);
  }

  private generateApiKey(service: string, query: string): string {
    // Create a consistent key from service and query
    const normalizedQuery = query.toLowerCase().trim();
    return `api:${service}:${btoa(normalizedQuery)}`;
  }
}

/**
 * Specialized cache for match results
 */
export class MatchResultCache extends IntelligentCache {
  constructor() {
    super({
      defaultTTL: 12 * 60 * 60 * 1000, // 12 hours for match results
      maxSize: 10 * 1024 * 1024, // 10MB
      maxEntries: 2000,
    });
  }

  /**
   * Cache match results for similar places
   */
  async cacheMatchResult(
    originalPlaceKey: string,
    matches: PlaceMatch[]
  ): Promise<void> {
    const key = this.generateMatchKey(originalPlaceKey);
    await this.set(key, matches, {
      tags: ['match-result'],
    });
  }

  /**
   * Get cached match results
   */
  async getCachedMatchResult(originalPlaceKey: string): Promise<PlaceMatch[] | null> {
    const key = this.generateMatchKey(originalPlaceKey);
    return this.get<PlaceMatch[]>(key);
  }

  /**
   * Generate a consistent key for place matching
   */
  private generateMatchKey(placeKey: string): string {
    return `match:${btoa(placeKey)}`;
  }

  /**
   * Generate place key for caching
   */
  generatePlaceKey(name: string, address?: string, lat?: number, lng?: number): string {
    const parts = [
      name.toLowerCase().trim(),
      address?.toLowerCase().trim() || '',
      lat?.toFixed(6) || '',
      lng?.toFixed(6) || ''
    ];
    return parts.join('|');
  }
}

// Export singleton instances
export const apiResponseCache = new ApiResponseCache();
export const matchResultCache = new MatchResultCache();

// Cleanup on process exit
if (typeof process !== 'undefined') {
  process.on('exit', () => {
    apiResponseCache.destroy();
    matchResultCache.destroy();
  });
}
