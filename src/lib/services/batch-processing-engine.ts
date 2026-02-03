/**
 * Batch Processing Engine for Automated Transfer with Verification
 * 
 * Handles parallel place processing with concurrency control, progress reporting,
 * error handling, and pause/resume functionality.
 */

import { transferSessionService } from './transfer-session';
import { PlaceMatchingService } from './matching/place-matching';
import { AppleMapsService } from './api/apple-maps';
import { GoogleMapsService } from './api/google-maps';
import { workerPoolManager } from './worker-pool-manager';
import { applyAutomationGuardrails, getAutomationGuardrails } from './automation-guardrails';
import { getAutomationAccess } from './automation-access';
import { db } from '@/lib/db';
import type { 
  Place, 
  TransferPack, 
  TransferPackSession, 
  TransferSessionStatus,
  TransferTarget 
} from '@/types';
import type { NormalizedPlace } from './api/response-normalizer';
import type { PlaceSearchQuery } from './api/types';

export interface BatchProcessingOptions {
  concurrency?: number; // Number of parallel API requests (default: 3)
  batchSize?: number; // Number of places to process in each batch (default: 10)
  retryAttempts?: number; // Number of retry attempts for failed requests (default: 3)
  retryDelay?: number; // Delay between retries in ms (default: 1000)
  pauseOnError?: boolean; // Whether to pause processing on errors (default: false)
  estimateProcessingTime?: boolean; // Whether to calculate time estimates (default: true)
}

export interface ProcessingProgress {
  sessionId: string;
  totalPlaces: number;
  processedPlaces: number;
  successfulMatches: number;
  failedMatches: number;
  currentBatch: number;
  totalBatches: number;
  estimatedTimeRemaining?: number; // in milliseconds
  currentOperation: string;
  processingRate: number; // places per second
  apiCallsUsed: number;
  errorCount: number;
  status: TransferSessionStatus;
}

export interface ProcessingResult {
  sessionId: string;
  success: boolean;
  totalProcessed: number;
  successfulMatches: number;
  failedMatches: number;
  processingTimeMs: number;
  apiCallsUsed: number;
  errorCount: number;
  errors: ProcessingError[];
}

export interface ProcessingError {
  placeId: string;
  placeName: string;
  error: string;
  timestamp: Date;
  retryCount: number;
}

const DEFAULT_OPTIONS: Required<BatchProcessingOptions> = {
  concurrency: 3,
  batchSize: 10,
  retryAttempts: 3,
  retryDelay: 1000,
  pauseOnError: false,
  estimateProcessingTime: true,
};

export class BatchProcessingEngine {
  private matchingService: PlaceMatchingService;
  private appleMapsService: AppleMapsService;
  private googleMapsService: GoogleMapsService;
  private activeProcesses = new Map<string, AbortController>();
  private progressCallbacks = new Map<string, (progress: ProcessingProgress) => void>();

  constructor() {
    this.matchingService = new PlaceMatchingService();
    this.appleMapsService = new AppleMapsService();
    this.googleMapsService = new GoogleMapsService();
  }

  /**
   * Start batch processing for a transfer pack
   */
  async startProcessing(
    packId: string,
    options: BatchProcessingOptions = {},
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<ProcessingResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    
    // Get transfer pack and places
    const transferPack = await db.transferPacks.get(packId);
    if (!transferPack) {
      throw new Error(`Transfer pack not found: ${packId}`);
    }

    const access = await getAutomationAccess(transferPack.target);
    if (!access.canUseAutomation) {
      if (access.reason === 'premium') {
        throw new Error('Automated transfer requires Premium.');
      }
      throw new Error('Automated transfer is temporarily unavailable.');
    }

    const guardrails = getAutomationGuardrails(access.tier);
    const enforcedOptions = applyAutomationGuardrails(opts, guardrails);

    const places = await this.getPlacesForPack(transferPack);
    if (places.length === 0) {
      throw new Error('No places found in transfer pack');
    }

    if (places.length > guardrails.maxPlacesPerSession) {
      throw new Error(
        `Automated transfer is limited to ${guardrails.maxPlacesPerSession} places per session.`
      );
    }

    // Create or get existing session
    let session = await transferSessionService.getSessionForPack(packId);
    if (!session) {
      session = await transferSessionService.createSession({
        packId,
        totalPlaces: places.length,
      });
    }

    // Set up progress tracking
    if (onProgress) {
      this.progressCallbacks.set(session.id, onProgress);
    }

    // Create abort controller for this processing session
    const abortController = new AbortController();
    this.activeProcesses.set(session.id, abortController);

    try {
      // Update session status to processing
      await transferSessionService.updateSessionStatus(session.id, 'processing');

      const result = await this.processPlacesInBatches(
        session,
        places,
        transferPack.target,
        enforcedOptions,
        abortController.signal
      );

      // Update final session status
      if (result.success) {
        await transferSessionService.updateSessionStatus(session.id, 'verifying');
      } else {
        await transferSessionService.updateSessionStatus(session.id, 'failed');
      }

      return result;

    } catch (error) {
      await transferSessionService.updateSessionStatus(session.id, 'failed');
      throw error;
    } finally {
      // Clean up
      this.activeProcesses.delete(session.id);
      this.progressCallbacks.delete(session.id);
    }
  }

  /**
   * Pause processing for a session
   */
  async pauseProcessing(sessionId: string): Promise<void> {
    const abortController = this.activeProcesses.get(sessionId);
    if (abortController) {
      abortController.abort();
    }
    await transferSessionService.pauseSession(sessionId);
  }

  /**
   * Resume processing for a paused session
   */
  async resumeProcessing(
    sessionId: string,
    options: BatchProcessingOptions = {},
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<ProcessingResult> {
    const session = await transferSessionService.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (session.status !== 'paused') {
      throw new Error(`Session is not paused: ${session.status}`);
    }

    // Get transfer pack and remaining places
    const transferPack = await db.transferPacks.get(session.packId);
    if (!transferPack) {
      throw new Error(`Transfer pack not found: ${session.packId}`);
    }

    const allPlaces = await this.getPlacesForPack(transferPack);
    const processedMatches = await transferSessionService.getMatchRecordsForSession(sessionId);
    const processedPlaceIds = new Set(processedMatches.map(m => m.originalPlaceId));
    const remainingPlaces = allPlaces.filter(p => !processedPlaceIds.has(p.id));

    if (remainingPlaces.length === 0) {
      await transferSessionService.updateSessionStatus(sessionId, 'verifying');
      return {
        sessionId,
        success: true,
        totalProcessed: 0,
        successfulMatches: 0,
        failedMatches: 0,
        processingTimeMs: 0,
        apiCallsUsed: 0,
        errorCount: 0,
        errors: [],
      };
    }

    // Resume processing with remaining places
    return this.startProcessing(session.packId, options, onProgress);
  }

  /**
   * Get current processing status for a session
   */
  async getProcessingStatus(sessionId: string): Promise<ProcessingProgress | null> {
    const session = await transferSessionService.getSession(sessionId);
    if (!session) {
      return null;
    }

    const progressData = await transferSessionService.getSessionProgress(sessionId);
    const totalBatches = Math.ceil(session.totalPlaces / DEFAULT_OPTIONS.batchSize);
    const currentBatch = Math.ceil(session.processedPlaces / DEFAULT_OPTIONS.batchSize);

    return {
      sessionId: session.id,
      totalPlaces: session.totalPlaces,
      processedPlaces: session.processedPlaces,
      successfulMatches: progressData.matchCounts.total,
      failedMatches: session.errorCount,
      currentBatch,
      totalBatches,
      currentOperation: this.getOperationDescription(session.status),
      processingRate: this.calculateProcessingRate(session),
      apiCallsUsed: session.apiCallsUsed,
      errorCount: session.errorCount,
      status: session.status,
    };
  }

  /**
   * Process places in batches with concurrency control
   */
  private async processPlacesInBatches(
    session: TransferPackSession,
    places: Place[],
    target: TransferTarget,
    options: Required<BatchProcessingOptions>,
    abortSignal: AbortSignal
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const errors: ProcessingError[] = [];
    let totalApiCalls = 0;
    let successfulMatches = 0;
    let failedMatches = 0;

    const batches = this.createBatches(places, options.batchSize);
    const totalBatches = batches.length;

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      if (abortSignal.aborted) {
        break;
      }

      const batch = batches[batchIndex];
      
      // Update progress
      await this.updateProgress(session, {
        currentBatch: batchIndex + 1,
        totalBatches,
        currentOperation: `Processing batch ${batchIndex + 1} of ${totalBatches}`,
      });

      try {
        const batchResult = await this.processBatch(
          session.id,
          batch,
          target,
          options,
          abortSignal
        );

        successfulMatches += batchResult.successfulMatches;
        failedMatches += batchResult.failedMatches;
        totalApiCalls += batchResult.apiCallsUsed;
        errors.push(...batchResult.errors);

        // Update session progress
        await transferSessionService.updateSessionProgress({
          sessionId: session.id,
          processedPlaces: (batchIndex + 1) * options.batchSize,
          apiCallsUsed: totalApiCalls,
          errorCount: errors.length,
        });

      } catch (error) {
        const batchError: ProcessingError = {
          placeId: 'batch',
          placeName: `Batch ${batchIndex + 1}`,
          error: error instanceof Error ? error.message : 'Unknown batch error',
          timestamp: new Date(),
          retryCount: 0,
        };
        errors.push(batchError);
        failedMatches += batch.length;

        if (options.pauseOnError) {
          await transferSessionService.pauseSession(session.id);
          break;
        }
      }

      // Small delay between batches to avoid overwhelming APIs
      if (batchIndex < batches.length - 1) {
        await this.delay(100);
      }
    }

    const processingTimeMs = Date.now() - startTime;
    const success = errors.length === 0 || !options.pauseOnError;

    return {
      sessionId: session.id,
      success,
      totalProcessed: successfulMatches + failedMatches,
      successfulMatches,
      failedMatches,
      processingTimeMs,
      apiCallsUsed: totalApiCalls,
      errorCount: errors.length,
      errors,
    };
  }

  /**
   * Process a single batch of places
   */
  private async processBatch(
    sessionId: string,
    places: Place[],
    target: TransferTarget,
    options: Required<BatchProcessingOptions>,
    abortSignal: AbortSignal
  ): Promise<{
    successfulMatches: number;
    failedMatches: number;
    apiCallsUsed: number;
    errors: ProcessingError[];
  }> {
    const semaphore = new Semaphore(options.concurrency);
    const errors: ProcessingError[] = [];
    let successfulMatches = 0;
    let failedMatches = 0;
    let apiCallsUsed = 0;

    const promises = places.map(async (place) => {
      return semaphore.acquire(async () => {
        if (abortSignal.aborted) {
          return;
        }

        try {
          const result = await this.processPlace(place, target, options);
          
          if (result.success) {
            await transferSessionService.createMatchRecord({
              sessionId,
              originalPlaceId: place.id,
              targetPlaceData: result.matches[0]?.candidatePlace,
              confidenceScore: result.matches[0]?.confidenceScore || 0,
              matchFactors: result.matches[0]?.matchFactors || [],
            });
            successfulMatches++;
          } else {
            failedMatches++;
            errors.push({
              placeId: place.id,
              placeName: place.title,
              error: result.error || 'No matches found',
              timestamp: new Date(),
              retryCount: 0,
            });
          }

          apiCallsUsed += result.apiCallsUsed;

        } catch (error) {
          failedMatches++;
          errors.push({
            placeId: place.id,
            placeName: place.title,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date(),
            retryCount: 0,
          });
        }
      });
    });

    await Promise.all(promises);

    return {
      successfulMatches,
      failedMatches,
      apiCallsUsed,
      errors,
    };
  }

  /**
   * Process a single place
   */
  private async processPlace(
    place: Place,
    target: TransferTarget,
    options: Required<BatchProcessingOptions>
  ): Promise<{
    success: boolean;
    matches: any[];
    apiCallsUsed: number;
    error?: string;
  }> {
    let retryCount = 0;
    let lastError: string | undefined;

    while (retryCount <= options.retryAttempts) {
      try {
        // Create search query
        const searchQuery: PlaceSearchQuery = {
          name: place.title,
          address: place.address,
          latitude: place.latitude,
          longitude: place.longitude,
        };

        // Search in target service
        let candidatePlaces: NormalizedPlace[] = [];
        let apiCallsUsed = 0;

        if (target === 'apple') {
          const results = await this.appleMapsService.searchPlacesNormalized(searchQuery);
          apiCallsUsed = 1;
          if (!results.success || !results.data) {
            return {
              success: false,
              matches: [],
              apiCallsUsed,
              error: results.error?.message || 'Apple Maps search failed',
            };
          }
          candidatePlaces = results.data;
        } else if (target === 'google') {
          const results = await this.googleMapsService.searchPlacesNormalized(searchQuery);
          apiCallsUsed = 1;
          if (!results.success || !results.data) {
            return {
              success: false,
              matches: [],
              apiCallsUsed,
              error: results.error?.message || 'Google Maps search failed',
            };
          }
          candidatePlaces = results.data;
        }

        // Use Web Worker for CPU-intensive matching if available
        let matchingResult;
        try {
          matchingResult = await workerPoolManager.executeMatchQuery({
            originalPlace: place,
            candidatePlaces,
          });
        } catch (workerError) {
          // Fallback to main thread if worker fails
          console.warn('Worker matching failed, falling back to main thread:', workerError);
          matchingResult = await this.matchingService.findMatchesAsync({
            originalPlace: place,
            candidatePlaces,
          });
        }

        return {
          success: matchingResult.matches.length > 0,
          matches: matchingResult.matches,
          apiCallsUsed,
        };

      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        retryCount++;

        if (retryCount <= options.retryAttempts) {
          await this.delay(options.retryDelay * retryCount); // Exponential backoff
        }
      }
    }

    return {
      success: false,
      matches: [],
      apiCallsUsed: retryCount,
      error: lastError,
    };
  }

  /**
   * Get places for a transfer pack based on scope
   */
  private async getPlacesForPack(transferPack: TransferPack): Promise<Place[]> {
    switch (transferPack.scopeType) {
      case 'library':
        return db.places.toArray();
      
      case 'collection':
        if (!transferPack.scopeId) {
          throw new Error('Collection ID required for collection scope');
        }
        return db.placeCollections
          .where('collectionId')
          .equals(transferPack.scopeId)
          .toArray()
          .then(memberships => {
            const placeIds = memberships.map(m => m.placeId);
            return db.places.where('id').anyOf(placeIds).toArray();
          });
      
      case 'filtered':
        // For now, return all places. In the future, this could support filters
        return db.places.toArray();
      
      default:
        throw new Error(`Unsupported scope type: ${transferPack.scopeType}`);
    }
  }

  /**
   * Create batches from places array
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Update processing progress
   */
  private async updateProgress(
    session: TransferPackSession,
    updates: Partial<ProcessingProgress>
  ): Promise<void> {
    const callback = this.progressCallbacks.get(session.id);
    if (callback) {
      const currentProgress = await this.getProcessingStatus(session.id);
      if (currentProgress) {
        callback({ ...currentProgress, ...updates });
      }
    }
  }

  /**
   * Get operation description for status
   */
  private getOperationDescription(status: TransferSessionStatus): string {
    switch (status) {
      case 'pending': return 'Initializing...';
      case 'processing': return 'Processing places...';
      case 'verifying': return 'Ready for verification';
      case 'completed': return 'Transfer completed';
      case 'failed': return 'Processing failed';
      case 'paused': return 'Processing paused';
      default: return 'Unknown status';
    }
  }

  /**
   * Calculate processing rate
   */
  private calculateProcessingRate(session: TransferPackSession): number {
    if (session.processedPlaces === 0 || session.processingTimeMs === 0) {
      return 0;
    }
    return (session.processedPlaces / session.processingTimeMs) * 1000; // places per second
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Semaphore for controlling concurrency
 */
class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const tryAcquire = () => {
        if (this.permits > 0) {
          this.permits--;
          task()
            .then(resolve)
            .catch(reject)
            .finally(() => {
              this.permits++;
              if (this.waiting.length > 0) {
                const next = this.waiting.shift();
                if (next) next();
              }
            });
        } else {
          this.waiting.push(tryAcquire);
        }
      };
      tryAcquire();
    });
  }
}

// Export singleton instance
export const batchProcessingEngine = new BatchProcessingEngine();
