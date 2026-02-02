/**
 * Property-Based Tests for Performance Characteristics
 * 
 * Tests performance consistency, memory usage patterns, and optimization
 * effectiveness across various scenarios and data sizes.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fc from 'fast-check';
import { batchProcessingEngine } from '../batch-processing-engine';
import { workerPoolManager } from '../worker-pool-manager';
import { apiResponseCache, matchResultCache } from '../intelligent-cache';
import { transferSessionService } from '../transfer-session';
import { db } from '@/lib/db';
import type { Place, TransferPack } from '@/types';

// Performance test configuration
const PERFORMANCE_CONFIG = {
  maxProcessingTimeMs: 5000, // 5 seconds max for small batches
  maxMemoryGrowthMB: 50, // 50MB max memory growth
  minCacheHitRate: 0.6, // 60% minimum cache hit rate
  maxApiCallsPerPlace: 3, // Maximum API calls per place
  workerTimeoutMs: 10000, // 10 seconds worker timeout
};

// Test utilities
const createMockPlace = (id: string, name: string): Place => ({
  id,
  title: name,
  address: `${Math.floor(Math.random() * 9999)} Test St, Test City`,
  latitude: 40.7128 + (Math.random() - 0.5) * 0.1,
  longitude: -74.0060 + (Math.random() - 0.5) * 0.1,
  notes: '',
  tags: [],
  createdAt: new Date(),
  updatedAt: new Date(),
});

const createMockTransferPack = (id: string, placeCount: number): TransferPack => ({
  id,
  title: `Test Pack ${id}`,
  description: 'Test transfer pack for performance testing',
  target: Math.random() > 0.5 ? 'apple' : 'google',
  scopeType: 'library',
  scopeId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const measureMemoryUsage = (): number => {
  if ('memory' in performance) {
    const memInfo = (performance as any).memory;
    return memInfo.usedJSHeapSize / (1024 * 1024); // Convert to MB
  }
  return 0;
};

const measureProcessingTime = async <T>(operation: () => Promise<T>): Promise<{ result: T; timeMs: number }> => {
  const startTime = performance.now();
  const result = await operation();
  const timeMs = performance.now() - startTime;
  return { result, timeMs };
};

describe('Performance Characteristics Property Tests', () => {
  beforeEach(async () => {
    // Clear database and caches before each test
    await db.places.clear();
    await db.transferPacks.clear();
    await db.transferPackSessions.clear();
    await db.placeMatchRecords.clear();
    await apiResponseCache.clear();
    await matchResultCache.clear();
  });

  afterEach(async () => {
    // Clean up after each test
    await workerPoolManager.terminate();
  });

  /**
   * Property 1: Processing Time Consistency
   * Validates that processing time scales predictably with input size
   */
  it('should have consistent processing time scaling', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 5, max: 50 }), // Place count
        fc.integer({ min: 1, max: 5 }), // Batch size
        async (placeCount, batchSize) => {
          // Create test data
          const places: Place[] = Array.from({ length: placeCount }, (_, i) =>
            createMockPlace(`place_${i}`, `Test Place ${i}`)
          );
          
          const transferPack = createMockTransferPack('test_pack', placeCount);
          
          // Add to database
          await db.places.bulkAdd(places);
          await db.transferPacks.add(transferPack);

          // Measure processing time
          const { timeMs } = await measureProcessingTime(async () => {
            return batchProcessingEngine.startProcessing(transferPack.id, {
              batchSize,
              concurrency: 2,
              retryAttempts: 1,
            });
          });

          // Processing time should scale reasonably with input size
          const timePerPlace = timeMs / placeCount;
          
          // Each place should take less than 1 second on average
          expect(timePerPlace).toBeLessThan(1000);
          
          // Total processing time should be reasonable
          expect(timeMs).toBeLessThan(PERFORMANCE_CONFIG.maxProcessingTimeMs * (placeCount / 10));
          
          return true;
        }
      ),
      { 
        numRuns: 10,
        timeout: 30000,
        verbose: true
      }
    );
  });

  /**
   * Property 2: Memory Usage Bounds
   * Validates that memory usage stays within acceptable bounds
   */
  it('should maintain bounded memory usage during processing', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 10, max: 100 }), // Place count
        async (placeCount) => {
          const initialMemory = measureMemoryUsage();
          
          // Create test data
          const places: Place[] = Array.from({ length: placeCount }, (_, i) =>
            createMockPlace(`place_${i}`, `Test Place ${i}`)
          );
          
          const transferPack = createMockTransferPack('test_pack', placeCount);
          
          // Add to database
          await db.places.bulkAdd(places);
          await db.transferPacks.add(transferPack);

          // Process with memory monitoring
          await batchProcessingEngine.startProcessing(transferPack.id, {
            batchSize: 5,
            concurrency: 2,
          });

          const finalMemory = measureMemoryUsage();
          const memoryGrowth = finalMemory - initialMemory;

          // Memory growth should be bounded
          if (initialMemory > 0) { // Only check if memory API is available
            expect(memoryGrowth).toBeLessThan(PERFORMANCE_CONFIG.maxMemoryGrowthMB);
          }
          
          return true;
        }
      ),
      { 
        numRuns: 5,
        timeout: 45000
      }
    );
  });

  /**
   * Property 3: Cache Effectiveness
   * Validates that caching improves performance for repeated operations
   */
  it('should demonstrate cache effectiveness for repeated queries', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 3, maxLength: 20 }), { minLength: 5, maxLength: 15 }),
        async (placeNames) => {
          // Create places with some duplicates to test cache effectiveness
          const places: Place[] = placeNames.map((name, i) =>
            createMockPlace(`place_${i}`, name)
          );
          
          const transferPack = createMockTransferPack('test_pack', places.length);
          
          await db.places.bulkAdd(places);
          await db.transferPacks.add(transferPack);

          // First run - populate cache
          const { timeMs: firstRunTime } = await measureProcessingTime(async () => {
            return batchProcessingEngine.startProcessing(transferPack.id, {
              batchSize: 3,
              concurrency: 1,
            });
          });

          // Get cache stats after first run
          const cacheStats = await apiResponseCache.getStats();
          
          // Second run - should benefit from cache
          const { timeMs: secondRunTime } = await measureProcessingTime(async () => {
            // Create new pack with same places to test cache
            const secondPack = createMockTransferPack('test_pack_2', places.length);
            await db.transferPacks.add(secondPack);
            
            return batchProcessingEngine.startProcessing(secondPack.id, {
              batchSize: 3,
              concurrency: 1,
            });
          });

          // Cache should have some entries
          expect(cacheStats.totalEntries).toBeGreaterThan(0);
          
          // Second run should be faster (if cache is working)
          // Allow some variance due to test environment
          const speedupRatio = firstRunTime / secondRunTime;
          expect(speedupRatio).toBeGreaterThan(0.8); // At least not significantly slower
          
          return true;
        }
      ),
      { 
        numRuns: 5,
        timeout: 60000
      }
    );
  });

  /**
   * Property 4: Worker Pool Efficiency
   * Validates that worker pool utilization is efficient
   */
  it('should efficiently utilize worker pool resources', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 10, max: 50 }), // Place count
        fc.integer({ min: 1, max: 4 }), // Concurrency level
        async (placeCount, concurrency) => {
          // Initialize worker pool
          await workerPoolManager.initialize();
          
          const places: Place[] = Array.from({ length: placeCount }, (_, i) =>
            createMockPlace(`place_${i}`, `Test Place ${i}`)
          );
          
          const transferPack = createMockTransferPack('test_pack', placeCount);
          
          await db.places.bulkAdd(places);
          await db.transferPacks.add(transferPack);

          // Process with worker monitoring
          const startStats = workerPoolManager.getStats();
          
          await batchProcessingEngine.startProcessing(transferPack.id, {
            batchSize: 5,
            concurrency,
          });

          const endStats = workerPoolManager.getStats();
          
          // Workers should have been utilized
          expect(endStats.totalTasksCompleted).toBeGreaterThan(startStats.totalTasksCompleted);
          
          // Error rate should be low
          const errorRate = endStats.totalErrors / Math.max(endStats.totalTasksCompleted, 1);
          expect(errorRate).toBeLessThan(0.1); // Less than 10% error rate
          
          // Queue should not back up excessively
          expect(endStats.queuedTasks).toBeLessThan(placeCount);
          
          return true;
        }
      ),
      { 
        numRuns: 8,
        timeout: 45000
      }
    );
  });

  /**
   * Property 5: API Call Efficiency
   * Validates that API calls are minimized through caching and batching
   */
  it('should minimize API calls through efficient caching', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 5, max: 25 }), // Place count
        async (placeCount) => {
          const places: Place[] = Array.from({ length: placeCount }, (_, i) =>
            createMockPlace(`place_${i}`, `Test Place ${i}`)
          );
          
          const transferPack = createMockTransferPack('test_pack', placeCount);
          
          await db.places.bulkAdd(places);
          await db.transferPacks.add(transferPack);

          // Track API calls (mock implementation)
          let apiCallCount = 0;
          const originalFetch = global.fetch;
          global.fetch = jest.fn().mockImplementation(async (...args) => {
            apiCallCount++;
            return new Response(JSON.stringify({ results: [] }), { status: 200 });
          });

          try {
            await batchProcessingEngine.startProcessing(transferPack.id, {
              batchSize: 3,
              concurrency: 2,
            });

            // API calls should be reasonable (accounting for retries and caching)
            const apiCallsPerPlace = apiCallCount / placeCount;
            expect(apiCallsPerPlace).toBeLessThan(PERFORMANCE_CONFIG.maxApiCallsPerPlace);
            
          } finally {
            global.fetch = originalFetch;
          }
          
          return true;
        }
      ),
      { 
        numRuns: 6,
        timeout: 30000
      }
    );
  });

  /**
   * Property 6: Concurrent Processing Stability
   * Validates that concurrent processing doesn't cause race conditions or instability
   */
  it('should handle concurrent processing without race conditions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 5 }), // Number of concurrent sessions
        fc.integer({ min: 5, max: 20 }), // Places per session
        async (sessionCount, placesPerSession) => {
          // Create multiple transfer packs
          const sessions: Array<{ pack: TransferPack; places: Place[] }> = [];
          
          for (let i = 0; i < sessionCount; i++) {
            const places: Place[] = Array.from({ length: placesPerSession }, (_, j) =>
              createMockPlace(`place_${i}_${j}`, `Test Place ${i}-${j}`)
            );
            
            const pack = createMockTransferPack(`pack_${i}`, placesPerSession);
            
            await db.places.bulkAdd(places);
            await db.transferPacks.add(pack);
            
            sessions.push({ pack, places });
          }

          // Start all sessions concurrently
          const processingPromises = sessions.map(({ pack }) =>
            batchProcessingEngine.startProcessing(pack.id, {
              batchSize: 3,
              concurrency: 1, // Lower concurrency to avoid overwhelming
            })
          );

          // Wait for all to complete
          const results = await Promise.allSettled(processingPromises);
          
          // All sessions should complete successfully
          const successfulResults = results.filter(r => r.status === 'fulfilled');
          expect(successfulResults.length).toBe(sessionCount);
          
          // Check data integrity - no cross-contamination between sessions
          for (let i = 0; i < sessionCount; i++) {
            const session = await transferSessionService.getSessionForPack(sessions[i].pack.id);
            expect(session).toBeTruthy();
            expect(session!.totalPlaces).toBe(placesPerSession);
          }
          
          return true;
        }
      ),
      { 
        numRuns: 4,
        timeout: 60000
      }
    );
  });

  /**
   * Property 7: Performance Degradation Bounds
   * Validates that performance doesn't degrade beyond acceptable limits under stress
   */
  it('should maintain performance within bounds under increasing load', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 20, max: 100 }), // Large place count for stress testing
        async (placeCount) => {
          const places: Place[] = Array.from({ length: placeCount }, (_, i) =>
            createMockPlace(`place_${i}`, `Stress Test Place ${i}`)
          );
          
          const transferPack = createMockTransferPack('stress_pack', placeCount);
          
          await db.places.bulkAdd(places);
          await db.transferPacks.add(transferPack);

          const { result, timeMs } = await measureProcessingTime(async () => {
            return batchProcessingEngine.startProcessing(transferPack.id, {
              batchSize: 10,
              concurrency: 3,
              retryAttempts: 1, // Reduce retries for stress test
            });
          });

          // Performance should degrade gracefully
          const timePerPlace = timeMs / placeCount;
          
          // Even under stress, processing should complete in reasonable time
          expect(timePerPlace).toBeLessThan(2000); // 2 seconds per place max
          expect(result.success).toBe(true);
          
          // Error rate should remain acceptable
          const errorRate = result.errorCount / placeCount;
          expect(errorRate).toBeLessThan(0.2); // Less than 20% error rate
          
          return true;
        }
      ),
      { 
        numRuns: 3,
        timeout: 120000 // 2 minutes for stress tests
      }
    );
  });
});