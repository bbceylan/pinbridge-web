/**
 * Tests for database schema extensions (Version 4)
 * Tests the new tables and functionality for automated transfer with verification
 */

import { db } from '../index';
import { transferSessionService } from '@/lib/services/transfer-session';
import { initializeDatabase, getDatabaseStats } from '../init';
import { runMigrations, validateDatabaseIntegrity } from '../migrations';
import type {
  TransferPack,
  TransferPackItem,
  Place,
  TransferPackSession,
  PlaceMatchRecord,
} from '@/types';

describe('Database Schema Extensions', () => {
  beforeEach(async () => {
    // Clear all data before each test
    await db.transaction('rw', db.tables, async () => {
      for (const table of db.tables) {
        await table.clear();
      }
    });
  });

  afterEach(async () => {
    // Clean up after each test
    await db.transaction('rw', db.tables, async () => {
      for (const table of db.tables) {
        await table.clear();
      }
    });
  });

  describe('New Tables Creation', () => {
    it('should create transfer_pack_sessions table', async () => {
      const session: TransferPackSession = {
        id: 'test-session-1',
        packId: 'test-pack-1',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        apiCallsUsed: 0,
        processingTimeMs: 0,
        errorCount: 0,
        totalPlaces: 10,
        processedPlaces: 0,
        verifiedPlaces: 0,
        completedPlaces: 0,
      };

      await db.transferPackSessions.add(session);
      const retrieved = await db.transferPackSessions.get('test-session-1');
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.packId).toBe('test-pack-1');
      expect(retrieved?.status).toBe('pending');
      expect(retrieved?.totalPlaces).toBe(10);
    });

    it('should create place_match_records table', async () => {
      const matchRecord: PlaceMatchRecord = {
        id: 'test-match-1',
        sessionId: 'test-session-1',
        originalPlaceId: 'test-place-1',
        targetPlaceData: JSON.stringify({ name: 'Test Place', address: '123 Test St' }),
        confidenceScore: 85,
        confidenceLevel: 'medium',
        matchFactors: JSON.stringify([
          { type: 'name', score: 90, weight: 0.4, explanation: 'Exact name match' },
          { type: 'address', score: 80, weight: 0.3, explanation: 'Similar address' },
        ]),
        verificationStatus: 'pending',
      };

      await db.placeMatchRecords.add(matchRecord);
      const retrieved = await db.placeMatchRecords.get('test-match-1');
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.sessionId).toBe('test-session-1');
      expect(retrieved?.confidenceScore).toBe(85);
      expect(retrieved?.confidenceLevel).toBe('medium');
      expect(retrieved?.verificationStatus).toBe('pending');
    });

    it('should support enhanced api_usage_log with sessionId', async () => {
      const apiLog = {
        id: 'test-log-1',
        service: 'google_maps' as const,
        endpoint: '/places/search',
        sessionId: 'test-session-1',
        requestData: { query: 'test place' },
        responseStatus: 200,
        responseTimeMs: 150,
        createdAt: new Date(),
      };

      await db.apiUsageLog.add(apiLog);
      const retrieved = await db.apiUsageLog.get('test-log-1');
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.sessionId).toBe('test-session-1');
      expect(retrieved?.service).toBe('google_maps');
    });
  });

  describe('Database Indexes', () => {
    it('should efficiently query sessions by pack ID', async () => {
      const sessions: TransferPackSession[] = [
        {
          id: 'session-1',
          packId: 'pack-1',
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
          apiCallsUsed: 0,
          processingTimeMs: 0,
          errorCount: 0,
          totalPlaces: 5,
          processedPlaces: 0,
          verifiedPlaces: 0,
          completedPlaces: 0,
        },
        {
          id: 'session-2',
          packId: 'pack-2',
          status: 'processing',
          createdAt: new Date(),
          updatedAt: new Date(),
          apiCallsUsed: 10,
          processingTimeMs: 5000,
          errorCount: 1,
          totalPlaces: 8,
          processedPlaces: 3,
          verifiedPlaces: 2,
          completedPlaces: 1,
        },
      ];

      await db.transferPackSessions.bulkAdd(sessions);

      // Test packId index
      const sessionForPack1 = await db.transferPackSessions
        .where('packId')
        .equals('pack-1')
        .first();
      expect(sessionForPack1?.id).toBe('session-1');

      // Test compound index [packId+status]
      const pendingSessions = await db.transferPackSessions
        .where('[packId+status]')
        .equals(['pack-1', 'pending'])
        .toArray();
      expect(pendingSessions).toHaveLength(1);
      expect(pendingSessions[0].id).toBe('session-1');
    });

    it('should efficiently query match records by session and status', async () => {
      const matchRecords: PlaceMatchRecord[] = [
        {
          id: 'match-1',
          sessionId: 'session-1',
          originalPlaceId: 'place-1',
          targetPlaceData: '{}',
          confidenceScore: 95,
          confidenceLevel: 'high',
          matchFactors: '[]',
          verificationStatus: 'pending',
        },
        {
          id: 'match-2',
          sessionId: 'session-1',
          originalPlaceId: 'place-2',
          targetPlaceData: '{}',
          confidenceScore: 75,
          confidenceLevel: 'medium',
          matchFactors: '[]',
          verificationStatus: 'accepted',
        },
        {
          id: 'match-3',
          sessionId: 'session-2',
          originalPlaceId: 'place-3',
          targetPlaceData: '{}',
          confidenceScore: 50,
          confidenceLevel: 'low',
          matchFactors: '[]',
          verificationStatus: 'pending',
        },
      ];

      await db.placeMatchRecords.bulkAdd(matchRecords);

      // Test compound index [sessionId+verificationStatus]
      const pendingMatches = await db.placeMatchRecords
        .where('[sessionId+verificationStatus]')
        .equals(['session-1', 'pending'])
        .toArray();
      expect(pendingMatches).toHaveLength(1);
      expect(pendingMatches[0].id).toBe('match-1');

      // Test compound index [sessionId+confidenceLevel]
      const highConfidenceMatches = await db.placeMatchRecords
        .where('[sessionId+confidenceLevel]')
        .equals(['session-1', 'high'])
        .toArray();
      expect(highConfidenceMatches).toHaveLength(1);
      expect(highConfidenceMatches[0].id).toBe('match-1');
    });

    it('should efficiently query API logs by session', async () => {
      const apiLogs = [
        {
          id: 'log-1',
          service: 'google_maps' as const,
          endpoint: '/search',
          sessionId: 'session-1',
          requestData: {},
          responseStatus: 200,
          responseTimeMs: 100,
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'log-2',
          service: 'apple_maps' as const,
          endpoint: '/search',
          sessionId: 'session-1',
          requestData: {},
          responseStatus: 200,
          responseTimeMs: 150,
          createdAt: new Date('2024-01-02'),
        },
      ];

      await db.apiUsageLog.bulkAdd(apiLogs);

      const sessionLogs = await db.apiUsageLog
        .where('sessionId')
        .equals('session-1')
        .toArray();
      expect(sessionLogs).toHaveLength(2);
    });
  });

  describe('Transfer Session Service', () => {
    it('should create and manage transfer sessions', async () => {
      const session = await transferSessionService.createSession({
        packId: 'test-pack-1',
        totalPlaces: 5,
      });

      expect(session.packId).toBe('test-pack-1');
      expect(session.totalPlaces).toBe(5);
      expect(session.status).toBe('pending');

      // Update session status
      await transferSessionService.updateSessionStatus(session.id, 'processing');
      const updated = await transferSessionService.getSession(session.id);
      expect(updated?.status).toBe('processing');

      // Update progress
      await transferSessionService.updateSessionProgress({
        sessionId: session.id,
        processedPlaces: 3,
        apiCallsUsed: 10,
      });

      const withProgress = await transferSessionService.getSession(session.id);
      expect(withProgress?.processedPlaces).toBe(3);
      expect(withProgress?.apiCallsUsed).toBe(10);
    });

    it('should create and manage match records', async () => {
      const session = await transferSessionService.createSession({
        packId: 'test-pack-1',
        totalPlaces: 1,
      });

      const matchRecord = await transferSessionService.createMatchRecord({
        sessionId: session.id,
        originalPlaceId: 'place-1',
        targetPlaceData: { name: 'Test Place', address: '123 Test St' },
        confidenceScore: 85,
        matchFactors: [
          { type: 'name', score: 90, weight: 0.4, explanation: 'Exact match' },
        ],
      });

      expect(matchRecord.sessionId).toBe(session.id);
      expect(matchRecord.confidenceLevel).toBe('medium');
      expect(matchRecord.verificationStatus).toBe('pending');

      // Update verification status
      await transferSessionService.updateMatchVerification(
        matchRecord.id,
        'accepted',
        'user',
        'Looks correct'
      );

      const updated = await db.placeMatchRecords.get(matchRecord.id);
      expect(updated?.verificationStatus).toBe('accepted');
      expect(updated?.verifiedBy).toBe('user');
      expect(updated?.userNotes).toBe('Looks correct');
    });

    it('should provide session progress summary', async () => {
      const session = await transferSessionService.createSession({
        packId: 'test-pack-1',
        totalPlaces: 4,
      });

      // Create match records with different statuses and confidence levels
      await transferSessionService.createMatchRecord({
        sessionId: session.id,
        originalPlaceId: 'place-1',
        targetPlaceData: {},
        confidenceScore: 95,
        matchFactors: [],
      });

      await transferSessionService.createMatchRecord({
        sessionId: session.id,
        originalPlaceId: 'place-2',
        targetPlaceData: {},
        confidenceScore: 75,
        matchFactors: [],
      });

      const match3 = await transferSessionService.createMatchRecord({
        sessionId: session.id,
        originalPlaceId: 'place-3',
        targetPlaceData: {},
        confidenceScore: 50,
        matchFactors: [],
      });

      // Accept one match
      await transferSessionService.updateMatchVerification(match3.id, 'accepted');

      const progress = await transferSessionService.getSessionProgress(session.id);

      expect(progress.matchCounts.total).toBe(3);
      expect(progress.matchCounts.pending).toBe(2);
      expect(progress.matchCounts.accepted).toBe(1);
      expect(progress.matchCounts.highConfidence).toBe(1);
      expect(progress.matchCounts.mediumConfidence).toBe(1);
      expect(progress.matchCounts.lowConfidence).toBe(1);
    });
  });

  describe('Database Initialization and Migration', () => {
    it('should initialize database successfully', async () => {
      await initializeDatabase();
      
      const stats = await getDatabaseStats();
      expect(stats.version).toBeGreaterThanOrEqual(4);
      expect(stats.tables).toHaveProperty('transferPackSessions');
      expect(stats.tables).toHaveProperty('placeMatchRecords');
    });

    it('should migrate existing transfer packs', async () => {
      // Create some test data that would exist before migration
      const place: Place = {
        id: 'place-1',
        title: 'Test Place',
        address: '123 Test St',
        tags: [],
        source: 'manual',
        normalizedTitle: 'test place',
        normalizedAddress: '123 test st',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const transferPack: TransferPack = {
        id: 'pack-1',
        name: 'Test Pack',
        target: 'google',
        scopeType: 'library',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const transferPackItem: TransferPackItem = {
        id: 'item-1',
        packId: 'pack-1',
        placeId: 'place-1',
        status: 'done',
        completedAt: new Date(),
      };

      await db.places.add(place);
      await db.transferPacks.add(transferPack);
      await db.transferPackItems.add(transferPackItem);

      // Run migration
      await runMigrations();

      // Check that session was created
      const session = await db.transferPackSessions
        .where('packId')
        .equals('pack-1')
        .first();

      expect(session).toBeDefined();
      expect(session?.status).toBe('completed'); // Should be completed since item is done
      expect(session?.totalPlaces).toBe(1);
      expect(session?.completedPlaces).toBe(1);
    });

    it('should validate database integrity', async () => {
      // Create valid data
      const session = await transferSessionService.createSession({
        packId: 'pack-1',
        totalPlaces: 1,
      });

      // Create a place that the match record can reference
      const place: Place = {
        id: 'place-1',
        title: 'Test Place',
        address: '123 Test St',
        tags: [],
        source: 'manual',
        normalizedTitle: 'test place',
        normalizedAddress: '123 test st',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await db.places.add(place);

      await transferSessionService.createMatchRecord({
        sessionId: session.id,
        originalPlaceId: 'place-1',
        targetPlaceData: {},
        confidenceScore: 85,
        matchFactors: [],
      });

      const validation = await validateDatabaseIntegrity();
      if (!validation.isValid) {
        console.log('Validation issues:', validation.issues);
      }
      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });
  });
});