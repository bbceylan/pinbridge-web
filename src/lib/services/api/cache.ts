/**
 * API response caching with IndexedDB storage
 */

import { db } from '@/lib/db';
import type { CacheEntry } from './types';

export class APICache {
  private readonly defaultTTL = 24 * 60 * 60 * 1000; // 24 hours

  async get<T>(key: string): Promise<T | null> {
    try {
      const entry = await db.apiCache.get(key);
      if (!entry) {
        return null;
      }

      // Check if entry has expired
      const now = Date.now();
      const expiresAt = entry.timestamp.getTime() + entry.ttl;
      
      if (now > expiresAt) {
        await this.delete(key);
        return null;
      }

      return entry.data as T;
    } catch (error) {
      console.warn('Cache get error:', error);
      return null;
    }
  }

  async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: new Date(),
        ttl: ttl || this.defaultTTL,
      };

      await db.apiCache.put({
        key,
        ...entry,
      });
    } catch (error) {
      console.warn('Cache set error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await db.apiCache.delete(key);
    } catch (error) {
      console.warn('Cache delete error:', error);
    }
  }

  async clear(): Promise<void> {
    try {
      await db.apiCache.clear();
    } catch (error) {
      console.warn('Cache clear error:', error);
    }
  }

  async cleanup(): Promise<void> {
    try {
      const now = Date.now();
      const allEntries = await db.apiCache.toArray();
      
      const expiredKeys = allEntries
        .filter(entry => {
          const expiresAt = entry.timestamp.getTime() + entry.ttl;
          return now > expiresAt;
        })
        .map(entry => entry.key);

      if (expiredKeys.length > 0) {
        await db.apiCache.bulkDelete(expiredKeys);
        console.log(`Cleaned up ${expiredKeys.length} expired cache entries`);
      }
    } catch (error) {
      console.warn('Cache cleanup error:', error);
    }
  }

  generateKey(service: string, endpoint: string, params: any): string {
    const paramString = JSON.stringify(params, Object.keys(params).sort());
    return `${service}:${endpoint}:${btoa(paramString)}`;
  }

  async getStats() {
    try {
      const allEntries = await db.apiCache.toArray();
      const now = Date.now();
      
      let totalSize = 0;
      let expiredCount = 0;
      
      allEntries.forEach(entry => {
        totalSize += JSON.stringify(entry.data).length;
        const expiresAt = entry.timestamp.getTime() + entry.ttl;
        if (now > expiresAt) {
          expiredCount++;
        }
      });

      return {
        totalEntries: allEntries.length,
        expiredEntries: expiredCount,
        estimatedSizeBytes: totalSize,
      };
    } catch (error) {
      console.warn('Cache stats error:', error);
      return {
        totalEntries: 0,
        expiredEntries: 0,
        estimatedSizeBytes: 0,
      };
    }
  }
}