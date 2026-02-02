/**
 * Transfer Pack Session Management Service
 * Handles automated transfer sessions, progress tracking, and state management
 */

import { db } from '@/lib/db';
import type {
  TransferPackSession,
  PlaceMatchRecord,
  TransferSessionStatus,
  VerificationStatus,
  ConfidenceLevel,
  MatchFactor,
} from '@/types';

export interface CreateSessionOptions {
  packId: string;
  totalPlaces: number;
}

export interface UpdateSessionProgressOptions {
  sessionId: string;
  processedPlaces?: number;
  verifiedPlaces?: number;
  completedPlaces?: number;
  apiCallsUsed?: number;
  processingTimeMs?: number;
  errorCount?: number;
}

export interface CreateMatchRecordOptions {
  sessionId: string;
  originalPlaceId: string;
  targetPlaceData: any;
  confidenceScore: number;
  matchFactors: MatchFactor[];
}

export class TransferSessionService {
  /**
   * Create a new transfer pack session
   */
  async createSession(options: CreateSessionOptions): Promise<TransferPackSession> {
    const session: TransferPackSession = {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      packId: options.packId,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      apiCallsUsed: 0,
      processingTimeMs: 0,
      errorCount: 0,
      totalPlaces: options.totalPlaces,
      processedPlaces: 0,
      verifiedPlaces: 0,
      completedPlaces: 0,
    };

    await db.transferPackSessions.add(session);
    return session;
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<TransferPackSession | undefined> {
    return db.transferPackSessions.get(sessionId);
  }

  /**
   * Get session for a transfer pack
   */
  async getSessionForPack(packId: string): Promise<TransferPackSession | undefined> {
    return db.transferPackSessions
      .where('packId')
      .equals(packId)
      .first();
  }

  /**
   * Update session status
   */
  async updateSessionStatus(
    sessionId: string,
    status: TransferSessionStatus
  ): Promise<void> {
    await db.transferPackSessions.update(sessionId, {
      status,
      updatedAt: new Date(),
    });
  }

  /**
   * Update session progress
   */
  async updateSessionProgress(options: UpdateSessionProgressOptions): Promise<void> {
    const updates: Partial<TransferPackSession> = {
      updatedAt: new Date(),
    };

    if (options.processedPlaces !== undefined) {
      updates.processedPlaces = options.processedPlaces;
    }
    if (options.verifiedPlaces !== undefined) {
      updates.verifiedPlaces = options.verifiedPlaces;
    }
    if (options.completedPlaces !== undefined) {
      updates.completedPlaces = options.completedPlaces;
    }
    if (options.apiCallsUsed !== undefined) {
      updates.apiCallsUsed = options.apiCallsUsed;
    }
    if (options.processingTimeMs !== undefined) {
      updates.processingTimeMs = options.processingTimeMs;
    }
    if (options.errorCount !== undefined) {
      updates.errorCount = options.errorCount;
    }

    await db.transferPackSessions.update(options.sessionId, updates);
  }

  /**
   * Create a place match record
   */
  async createMatchRecord(options: CreateMatchRecordOptions): Promise<PlaceMatchRecord> {
    const confidenceLevel: ConfidenceLevel = 
      options.confidenceScore >= 90 ? 'high' :
      options.confidenceScore >= 70 ? 'medium' : 'low';

    const matchRecord: PlaceMatchRecord = {
      id: `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId: options.sessionId,
      originalPlaceId: options.originalPlaceId,
      targetPlaceData: JSON.stringify(options.targetPlaceData),
      confidenceScore: options.confidenceScore,
      confidenceLevel,
      matchFactors: JSON.stringify(options.matchFactors),
      verificationStatus: 'pending',
    };

    await db.placeMatchRecords.add(matchRecord);
    return matchRecord;
  }

  /**
   * Update match record verification status
   */
  async updateMatchVerification(
    matchId: string,
    status: VerificationStatus,
    verifiedBy?: 'user' | 'bulk_action',
    userNotes?: string
  ): Promise<void> {
    const updates: Partial<PlaceMatchRecord> = {
      verificationStatus: status,
      verifiedAt: new Date(),
    };

    if (verifiedBy) {
      updates.verifiedBy = verifiedBy;
    }
    if (userNotes) {
      updates.userNotes = userNotes;
    }

    await db.placeMatchRecords.update(matchId, updates);
  }

  /**
   * Set manual search data for a match record
   */
  async setManualSearchData(
    matchId: string,
    searchQuery: string,
    selectedPlace?: any
  ): Promise<void> {
    const updates: Partial<PlaceMatchRecord> = {
      manualSearchQuery: searchQuery,
      verificationStatus: 'manual',
      verifiedAt: new Date(),
      verifiedBy: 'user',
    };

    if (selectedPlace) {
      updates.manualSelectedPlace = JSON.stringify(selectedPlace);
    }

    await db.placeMatchRecords.update(matchId, updates);
  }

  /**
   * Get all match records for a session
   */
  async getMatchRecordsForSession(sessionId: string): Promise<PlaceMatchRecord[]> {
    return db.placeMatchRecords
      .where('sessionId')
      .equals(sessionId)
      .toArray();
  }

  /**
   * Get match records by verification status
   */
  async getMatchRecordsByStatus(
    sessionId: string,
    status: VerificationStatus
  ): Promise<PlaceMatchRecord[]> {
    return db.placeMatchRecords
      .where('[sessionId+verificationStatus]')
      .equals([sessionId, status])
      .toArray();
  }

  /**
   * Get match records by confidence level
   */
  async getMatchRecordsByConfidence(
    sessionId: string,
    confidenceLevel: ConfidenceLevel
  ): Promise<PlaceMatchRecord[]> {
    return db.placeMatchRecords
      .where('[sessionId+confidenceLevel]')
      .equals([sessionId, confidenceLevel])
      .toArray();
  }

  /**
   * Bulk update match records (for bulk actions)
   */
  async bulkUpdateMatchRecords(
    matchIds: string[],
    updates: Partial<PlaceMatchRecord>
  ): Promise<void> {
    const updateData = {
      ...updates,
      verifiedAt: new Date(),
      verifiedBy: 'bulk_action' as const,
    };

    await db.transaction('rw', db.placeMatchRecords, async () => {
      for (const matchId of matchIds) {
        await db.placeMatchRecords.update(matchId, updateData);
      }
    });
  }

  /**
   * Get session progress summary
   */
  async getSessionProgress(sessionId: string): Promise<{
    session: TransferPackSession | undefined;
    matchCounts: {
      total: number;
      pending: number;
      accepted: number;
      rejected: number;
      manual: number;
      highConfidence: number;
      mediumConfidence: number;
      lowConfidence: number;
    };
  }> {
    const session = await this.getSession(sessionId);
    const matches = await this.getMatchRecordsForSession(sessionId);

    const matchCounts = {
      total: matches.length,
      pending: matches.filter(m => m.verificationStatus === 'pending').length,
      accepted: matches.filter(m => m.verificationStatus === 'accepted').length,
      rejected: matches.filter(m => m.verificationStatus === 'rejected').length,
      manual: matches.filter(m => m.verificationStatus === 'manual').length,
      highConfidence: matches.filter(m => m.confidenceLevel === 'high').length,
      mediumConfidence: matches.filter(m => m.confidenceLevel === 'medium').length,
      lowConfidence: matches.filter(m => m.confidenceLevel === 'low').length,
    };

    return {
      session,
      matchCounts,
    };
  }

  /**
   * Delete a session and all related records
   */
  async deleteSession(sessionId: string): Promise<void> {
    await db.transaction('rw', [db.transferPackSessions, db.placeMatchRecords, db.apiUsageLog], async () => {
      // Delete match records
      await db.placeMatchRecords
        .where('sessionId')
        .equals(sessionId)
        .delete();

      // Delete API usage logs for this session
      await db.apiUsageLog
        .where('sessionId')
        .equals(sessionId)
        .delete();

      // Delete the session
      await db.transferPackSessions.delete(sessionId);
    });
  }

  /**
   * Get all active sessions
   */
  async getActiveSessions(): Promise<TransferPackSession[]> {
    return db.transferPackSessions
      .where('status')
      .anyOf(['processing', 'verifying', 'paused'])
      .toArray();
  }

  /**
   * Pause a session
   */
  async pauseSession(sessionId: string): Promise<void> {
    await this.updateSessionStatus(sessionId, 'paused');
  }

  /**
   * Resume a paused session
   */
  async resumeSession(sessionId: string): Promise<void> {
    await this.updateSessionStatus(sessionId, 'processing');
  }

  /**
   * Complete a session
   */
  async completeSession(sessionId: string): Promise<void> {
    await this.updateSessionStatus(sessionId, 'completed');
  }

  /**
   * Mark a session as failed
   */
  async failSession(sessionId: string): Promise<void> {
    await this.updateSessionStatus(sessionId, 'failed');
  }
}

// Export singleton instance
export const transferSessionService = new TransferSessionService();