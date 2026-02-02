/**
 * Transfer Execution Engine
 * 
 * Handles the final execution of verified transfers, including URL generation
 * and batch opening for target services.
 */

import { transferSessionService } from './transfer-session';
import { db } from '@/lib/db';
import type { 
  TransferPackSession, 
  PlaceMatchRecord, 
  TransferPack,
  Place,
  TransferTarget 
} from '@/types';

export interface TransferExecutionOptions {
  openInBrowser?: boolean; // Whether to open URLs in browser (default: true)
  batchSize?: number; // Number of URLs to open at once (default: 5)
  delayBetweenBatches?: number; // Delay between batches in ms (default: 2000)
  generateOnly?: boolean; // Only generate URLs, don't open them (default: false)
}

export interface TransferExecutionResult {
  sessionId: string;
  success: boolean;
  totalProcessed: number;
  successfulTransfers: number;
  failedTransfers: number;
  generatedUrls: TransferUrl[];
  executionTimeMs: number;
  errors: TransferExecutionError[];
}

export interface TransferUrl {
  originalPlaceId: string;
  placeName: string;
  targetService: TransferTarget;
  url: string;
  opened: boolean;
  timestamp: Date;
}

export interface TransferExecutionError {
  placeId: string;
  placeName: string;
  error: string;
  timestamp: Date;
}

const DEFAULT_OPTIONS: Required<TransferExecutionOptions> = {
  openInBrowser: true,
  batchSize: 5,
  delayBetweenBatches: 2000,
  generateOnly: false,
};

export class TransferExecutionEngine {
  /**
   * Execute verified transfers for a session
   */
  async executeTransfers(
    sessionId: string,
    options: TransferExecutionOptions = {}
  ): Promise<TransferExecutionResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const startTime = Date.now();
    
    // Get session and verified matches
    const session = await transferSessionService.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const verifiedMatches = await this.getVerifiedMatches(sessionId);
    if (verifiedMatches.length === 0) {
      throw new Error('No verified matches found for execution');
    }

    // Get transfer pack to determine target service
    const transferPack = await db.transferPacks.get(session.packId);
    if (!transferPack) {
      throw new Error(`Transfer pack not found: ${session.packId}`);
    }

    const errors: TransferExecutionError[] = [];
    const generatedUrls: TransferUrl[] = [];
    let successfulTransfers = 0;
    let failedTransfers = 0;

    try {
      // Update session status to executing
      await transferSessionService.updateSessionStatus(sessionId, 'processing');

      // Process each verified match
      for (const match of verifiedMatches) {
        try {
          const originalPlace = await db.places.get(match.originalPlaceId);
          if (!originalPlace) {
            throw new Error(`Original place not found: ${match.originalPlaceId}`);
          }

          const url = await this.generateTransferUrl(match, transferPack.target, originalPlace);
          
          const transferUrl: TransferUrl = {
            originalPlaceId: match.originalPlaceId,
            placeName: originalPlace.title,
            targetService: transferPack.target,
            url,
            opened: false,
            timestamp: new Date(),
          };

          generatedUrls.push(transferUrl);
          successfulTransfers++;

        } catch (error) {
          const originalPlace = await db.places.get(match.originalPlaceId);
          const executionError: TransferExecutionError = {
            placeId: match.originalPlaceId,
            placeName: originalPlace?.title || 'Unknown Place',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date(),
          };
          errors.push(executionError);
          failedTransfers++;
        }
      }

      // Open URLs in batches if requested
      if (opts.openInBrowser && !opts.generateOnly && generatedUrls.length > 0) {
        await this.openUrlsInBatches(generatedUrls, opts.batchSize, opts.delayBetweenBatches);
      }

      // Update session status to completed
      await transferSessionService.updateSessionStatus(sessionId, 'completed');
      await transferSessionService.updateSessionProgress({
        sessionId,
        completedPlaces: successfulTransfers,
      });

      const executionTimeMs = Date.now() - startTime;

      return {
        sessionId,
        success: errors.length === 0,
        totalProcessed: verifiedMatches.length,
        successfulTransfers,
        failedTransfers,
        generatedUrls,
        executionTimeMs,
        errors,
      };

    } catch (error) {
      await transferSessionService.updateSessionStatus(sessionId, 'failed');
      throw error;
    }
  }

  /**
   * Generate transfer URL for a verified match
   */
  private async generateTransferUrl(
    match: PlaceMatchRecord,
    targetService: TransferTarget,
    originalPlace: Place
  ): Promise<string> {
    // Parse target place data
    const targetPlaceData = JSON.parse(match.targetPlaceData);

    // Handle manual selections
    if (match.verificationStatus === 'manual' && match.manualSelectedPlace) {
      const manualPlace = JSON.parse(match.manualSelectedPlace);
      return this.buildServiceUrl(targetService, manualPlace);
    }

    // Use matched place data
    return this.buildServiceUrl(targetService, targetPlaceData);
  }

  /**
   * Build service-specific URL
   */
  private buildServiceUrl(targetService: TransferTarget, placeData: any): string {
    switch (targetService) {
      case 'apple':
        return this.buildAppleMapsUrl(placeData);
      case 'google':
        return this.buildGoogleMapsUrl(placeData);
      default:
        throw new Error(`Unsupported target service: ${targetService}`);
    }
  }

  /**
   * Build Apple Maps URL
   */
  private buildAppleMapsUrl(placeData: any): string {
    // Apple Maps URL schemes:
    // https://maps.apple.com/?q=query
    // https://maps.apple.com/?ll=lat,lng&q=name
    // https://maps.apple.com/?address=address

    const baseUrl = 'https://maps.apple.com/';
    const params = new URLSearchParams();

    if (placeData.latitude && placeData.longitude) {
      // Use coordinates for precise location
      params.set('ll', `${placeData.latitude},${placeData.longitude}`);
      if (placeData.name) {
        params.set('q', placeData.name);
      }
    } else if (placeData.address) {
      // Use address
      params.set('address', placeData.address);
    } else if (placeData.name) {
      // Use name as query
      params.set('q', placeData.name);
    } else {
      throw new Error('Insufficient place data for Apple Maps URL');
    }

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Build Google Maps URL
   */
  private buildGoogleMapsUrl(placeData: any): string {
    // Google Maps URL schemes:
    // https://www.google.com/maps/search/query
    // https://www.google.com/maps/@lat,lng,zoom
    // https://www.google.com/maps/place/place_id

    const baseUrl = 'https://www.google.com/maps';

    // Prefer place ID if available (most accurate)
    if (placeData.placeId) {
      return `${baseUrl}/place/${encodeURIComponent(placeData.placeId)}`;
    }

    // Use coordinates if available
    if (placeData.latitude && placeData.longitude) {
      const lat = placeData.latitude;
      const lng = placeData.longitude;
      const zoom = 15; // Default zoom level
      return `${baseUrl}/@${lat},${lng},${zoom}z`;
    }

    // Use search query
    let query = '';
    if (placeData.name && placeData.address) {
      query = `${placeData.name}, ${placeData.address}`;
    } else if (placeData.name) {
      query = placeData.name;
    } else if (placeData.address) {
      query = placeData.address;
    } else {
      throw new Error('Insufficient place data for Google Maps URL');
    }

    return `${baseUrl}/search/${encodeURIComponent(query)}`;
  }

  /**
   * Open URLs in batches with delays
   */
  private async openUrlsInBatches(
    urls: TransferUrl[],
    batchSize: number,
    delayBetweenBatches: number
  ): Promise<void> {
    const batches = this.createBatches(urls, batchSize);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      // Open all URLs in the current batch
      for (const transferUrl of batch) {
        try {
          // In a browser environment, this would open the URL
          // For now, we'll just mark it as opened
          if (typeof window !== 'undefined') {
            window.open(transferUrl.url, '_blank');
          }
          transferUrl.opened = true;
        } catch (error) {
          console.error(`Failed to open URL: ${transferUrl.url}`, error);
          // Continue with other URLs even if one fails
        }
      }

      // Add delay between batches (except for the last batch)
      if (i < batches.length - 1) {
        await this.delay(delayBetweenBatches);
      }
    }
  }

  /**
   * Get verified matches for a session
   */
  private async getVerifiedMatches(sessionId: string): Promise<PlaceMatchRecord[]> {
    return db.placeMatchRecords
      .where('sessionId')
      .equals(sessionId)
      .and(match => match.verificationStatus === 'accepted' || match.verificationStatus === 'manual')
      .toArray();
  }

  /**
   * Create batches from array
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Preview URLs without opening them
   */
  async previewTransferUrls(sessionId: string): Promise<TransferUrl[]> {
    const result = await this.executeTransfers(sessionId, {
      openInBrowser: false,
      generateOnly: true,
    });
    return result.generatedUrls;
  }

  /**
   * Get execution statistics for a session
   */
  async getExecutionStats(sessionId: string): Promise<{
    totalVerified: number;
    readyForExecution: number;
    alreadyExecuted: boolean;
  }> {
    const session = await transferSessionService.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const verifiedMatches = await this.getVerifiedMatches(sessionId);
    
    return {
      totalVerified: verifiedMatches.length,
      readyForExecution: verifiedMatches.length,
      alreadyExecuted: session.status === 'completed',
    };
  }
}

// Export singleton instance
export const transferExecutionEngine = new TransferExecutionEngine();