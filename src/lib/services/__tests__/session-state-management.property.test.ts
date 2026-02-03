import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fc from 'fast-check';
import { TransferSessionService } from '../transfer-session';
import { db } from '@/lib/db';
import type { 
  TransferPackSession, 
  TransferSessionStatus, 
  VerificationStatus,
  MatchFactor 
} from '@/types';

describe('Session State Management Properties', () => {
  jest.setTimeout(20000);
  let sessionService: TransferSessionService;
  const toTime = (value: Date | string | number | undefined | null): number => {
    if (!value) {
      return 0;
    }
    return value instanceof Date ? value.getTime() : new Date(value).getTime();
  };

  beforeEach(async () => {
    sessionService = new TransferSessionService();
    // Clear test data
    await db.transferPackSessions.clear();
    await db.placeMatchRecords.clear();
  });

  afterEach(async () => {
    // Clean up test data
    await db.transferPackSessions.clear();
    await db.placeMatchRecords.clear();
  });

  // Arbitraries for generating test data
  const sessionStatusArb = fc.constantFrom(
    'pending', 'processing', 'verifying', 'completed', 'failed', 'paused'
  ) as fc.Arbitrary<TransferSessionStatus>;

  const verificationStatusArb = fc.constantFrom(
    'pending', 'accepted', 'rejected', 'manual'
  ) as fc.Arbitrary<VerificationStatus>;

  const sessionOptionsArb = fc.record({
    packId: fc.string({ minLength: 1, maxLength: 50 }),
    totalPlaces: fc.integer({ min: 1, max: 1000 })
  });

  const matchFactorArb = fc.record({
    type: fc.constantFrom('name', 'address', 'distance', 'category'),
    score: fc.integer({ min: 0, max: 100 }),
    weight: fc.integer({ min: 1, max: 100 }),
    explanation: fc.string({ minLength: 1, maxLength: 200 })
  }) as fc.Arbitrary<MatchFactor>;

  const matchRecordOptionsArb = fc.record({
    originalPlaceId: fc.string({ minLength: 1, maxLength: 50 }),
    targetPlaceData: fc.record({
      id: fc.string({ minLength: 1 }),
      name: fc.string({ minLength: 1 }),
      address: fc.string({ minLength: 1 })
    }),
    confidenceScore: fc.integer({ min: 0, max: 100 }),
    matchFactors: fc.array(matchFactorArb, { minLength: 1, maxLength: 4 })
  });

  describe('Property 4: Session State Consistency', () => {
    it('should maintain session state consistency through lifecycle', () => {
      return fc.assert(fc.asyncProperty(
        sessionOptionsArb,
        async (options) => {
          // Create session
          const session = await sessionService.createSession(options);
          
          // Verify initial state
          expect(session.status).toBe('pending');
          expect(session.packId).toBe(options.packId);
          expect(session.totalPlaces).toBe(options.totalPlaces);
          expect(session.processedPlaces).toBe(0);
          expect(session.verifiedPlaces).toBe(0);
          expect(session.completedPlaces).toBe(0);
          expect(session.apiCallsUsed).toBe(0);
          expect(session.processingTimeMs).toBe(0);
          expect(session.errorCount).toBe(0);
          
          // Verify session can be retrieved
          const retrievedSession = await sessionService.getSession(session.id);
          expect(retrievedSession).toBeDefined();
          expect(retrievedSession!.id).toBe(session.id);
          expect(retrievedSession!.status).toBe('pending');
        }
      ), { numRuns: 25 });
    });

    it('should handle status transitions correctly', () => {
      return fc.assert(fc.asyncProperty(
        sessionOptionsArb,
        fc.array(sessionStatusArb, { minLength: 1, maxLength: 10 }),
        async (options, statusSequence) => {
          // Create session
          const session = await sessionService.createSession(options);
          let currentStatus: TransferSessionStatus = 'pending';
          
          // Apply status changes
          for (const newStatus of statusSequence) {
            await sessionService.updateSessionStatus(session.id, newStatus);
            currentStatus = newStatus;
            
            // Verify status was updated
            const updatedSession = await sessionService.getSession(session.id);
            expect(updatedSession).toBeDefined();
            expect(updatedSession!.status).toBe(currentStatus);
            expect(toTime(updatedSession!.updatedAt)).toBeGreaterThanOrEqual(toTime(session.createdAt));
          }
          
          // Final verification
          const finalSession = await sessionService.getSession(session.id);
          expect(finalSession!.status).toBe(currentStatus);
        }
      ), { numRuns: 20 });
    });

    it('should maintain progress consistency', () => {
      return fc.assert(fc.asyncProperty(
        sessionOptionsArb,
        fc.record({
          processedPlaces: fc.option(fc.integer({ min: 0, max: 1000 }), { nil: undefined }),
          verifiedPlaces: fc.option(fc.integer({ min: 0, max: 1000 }), { nil: undefined }),
          completedPlaces: fc.option(fc.integer({ min: 0, max: 1000 }), { nil: undefined }),
          apiCallsUsed: fc.option(fc.integer({ min: 0, max: 10000 }), { nil: undefined }),
          processingTimeMs: fc.option(fc.integer({ min: 0, max: 3600000 }), { nil: undefined }),
          errorCount: fc.option(fc.integer({ min: 0, max: 100 }), { nil: undefined })
        }),
        async (options, progressUpdate) => {
          // Create session
          const session = await sessionService.createSession(options);
          
          // Update progress
          await sessionService.updateSessionProgress({
            sessionId: session.id,
            ...progressUpdate
          });
          
          // Verify progress was updated correctly
          const updatedSession = await sessionService.getSession(session.id);
          expect(updatedSession).toBeDefined();
          
          if (progressUpdate.processedPlaces !== undefined) {
            expect(updatedSession!.processedPlaces).toBe(progressUpdate.processedPlaces);
          }
          if (progressUpdate.verifiedPlaces !== undefined) {
            expect(updatedSession!.verifiedPlaces).toBe(progressUpdate.verifiedPlaces);
          }
          if (progressUpdate.completedPlaces !== undefined) {
            expect(updatedSession!.completedPlaces).toBe(progressUpdate.completedPlaces);
          }
          if (progressUpdate.apiCallsUsed !== undefined) {
            expect(updatedSession!.apiCallsUsed).toBe(progressUpdate.apiCallsUsed);
          }
          if (progressUpdate.processingTimeMs !== undefined) {
            expect(updatedSession!.processingTimeMs).toBe(progressUpdate.processingTimeMs);
          }
          if (progressUpdate.errorCount !== undefined) {
            expect(updatedSession!.errorCount).toBe(progressUpdate.errorCount);
          }
          
          // Progress values should never be negative
          expect(updatedSession!.processedPlaces).toBeGreaterThanOrEqual(0);
          expect(updatedSession!.verifiedPlaces).toBeGreaterThanOrEqual(0);
          expect(updatedSession!.completedPlaces).toBeGreaterThanOrEqual(0);
          expect(updatedSession!.apiCallsUsed).toBeGreaterThanOrEqual(0);
          expect(updatedSession!.processingTimeMs).toBeGreaterThanOrEqual(0);
          expect(updatedSession!.errorCount).toBeGreaterThanOrEqual(0);
        }
      ), { numRuns: 25 });
    });

    it('should handle match record creation and updates consistently', () => {
      return fc.assert(fc.asyncProperty(
        sessionOptionsArb,
        matchRecordOptionsArb,
        verificationStatusArb,
        fc.option(fc.string({ minLength: 1, maxLength: 500 }), { nil: undefined }),
        async (sessionOptions, matchOptions, verificationStatus, userNotes) => {
          // Create session
          const session = await sessionService.createSession(sessionOptions);
          
          // Create match record
          const matchRecord = await sessionService.createMatchRecord({
            sessionId: session.id,
            ...matchOptions
          });
          
          // Verify match record was created correctly
          expect(matchRecord.sessionId).toBe(session.id);
          expect(matchRecord.originalPlaceId).toBe(matchOptions.originalPlaceId);
          expect(matchRecord.confidenceScore).toBe(matchOptions.confidenceScore);
          expect(matchRecord.verificationStatus).toBe('pending');
          
          // Verify confidence level is set correctly
          if (matchOptions.confidenceScore >= 90) {
            expect(matchRecord.confidenceLevel).toBe('high');
          } else if (matchOptions.confidenceScore >= 70) {
            expect(matchRecord.confidenceLevel).toBe('medium');
          } else {
            expect(matchRecord.confidenceLevel).toBe('low');
          }
          
          // Update verification status
          await sessionService.updateMatchVerification(
            matchRecord.id,
            verificationStatus,
            'user',
            userNotes || undefined
          );
          
          // Verify update
          const matches = await sessionService.getMatchRecordsForSession(session.id);
          expect(matches).toHaveLength(1);
          expect(matches[0].verificationStatus).toBe(verificationStatus);
          expect(matches[0].verifiedBy).toBe('user');
          expect(matches[0].verifiedAt).toBeDefined();
          
          if (userNotes) {
            expect(matches[0].userNotes).toBe(userNotes);
          }
        }
      ), { numRuns: 20 });
    });

    it('should maintain referential integrity between sessions and match records', () => {
      return fc.assert(fc.asyncProperty(
        fc.array(sessionOptionsArb, { minLength: 1, maxLength: 5 }),
        fc.array(matchRecordOptionsArb, { minLength: 1, maxLength: 10 }),
        async (sessionOptionsList, matchOptionsList) => {
          await db.transferPackSessions.clear();
          await db.placeMatchRecords.clear();

          // Create multiple sessions
          const sessions: TransferPackSession[] = [];
          for (const options of sessionOptionsList) {
            const session = await sessionService.createSession(options);
            sessions.push(session);
          }
          
          // Create match records for random sessions
          const matchRecords = [];
          for (const matchOptions of matchOptionsList) {
            const randomSession = sessions[Math.floor(Math.random() * sessions.length)];
            const matchRecord = await sessionService.createMatchRecord({
              sessionId: randomSession.id,
              ...matchOptions
            });
            matchRecords.push({ matchRecord, sessionId: randomSession.id });
          }
          
          // Verify each session has the correct match records
          for (const session of sessions) {
            const sessionMatches = await sessionService.getMatchRecordsForSession(session.id);
            const expectedMatches = matchRecords.filter(m => m.sessionId === session.id);
            
            expect(sessionMatches).toHaveLength(expectedMatches.length);
            
            for (const match of sessionMatches) {
              expect(match.sessionId).toBe(session.id);
            }
          }
          
          // Verify total match count
          const allMatches = await db.placeMatchRecords.toArray();
          expect(allMatches).toHaveLength(matchRecords.length);
        }
      ), { numRuns: 10 });
    });

    it('should handle bulk operations atomically', () => {
      return fc.assert(fc.asyncProperty(
        sessionOptionsArb,
        fc.array(matchRecordOptionsArb, { minLength: 2, maxLength: 10 }),
        verificationStatusArb,
        async (sessionOptions, matchOptionsList, bulkStatus) => {
          // Create session
          const session = await sessionService.createSession(sessionOptions);
          
          // Create multiple match records
          const matchRecords = [];
          for (const matchOptions of matchOptionsList) {
            const matchRecord = await sessionService.createMatchRecord({
              sessionId: session.id,
              ...matchOptions
            });
            matchRecords.push(matchRecord);
          }
          
          // Perform bulk update on subset of records
          const recordsToUpdate = matchRecords.slice(0, Math.ceil(matchRecords.length / 2));
          const idsToUpdate = recordsToUpdate.map(r => r.id);
          
          await sessionService.bulkUpdateMatchRecords(idsToUpdate, {
            verificationStatus: bulkStatus
          });
          
          // Verify bulk update was applied correctly
          const updatedMatches = await sessionService.getMatchRecordsForSession(session.id);
          
          for (const match of updatedMatches) {
            if (idsToUpdate.includes(match.id)) {
              expect(match.verificationStatus).toBe(bulkStatus);
              expect(match.verifiedBy).toBe('bulk_action');
              expect(match.verifiedAt).toBeDefined();
            } else {
              expect(match.verificationStatus).toBe('pending');
              expect(match.verifiedBy).toBeUndefined();
            }
          }
        }
      ), { numRuns: 15 });
    });

    it('should handle session deletion with cascade cleanup', () => {
      return fc.assert(fc.asyncProperty(
        sessionOptionsArb,
        fc.array(matchRecordOptionsArb, { minLength: 1, maxLength: 5 }),
        async (sessionOptions, matchOptionsList) => {
          // Create session
          const session = await sessionService.createSession(sessionOptions);
          
          // Create match records
          for (const matchOptions of matchOptionsList) {
            await sessionService.createMatchRecord({
              sessionId: session.id,
              ...matchOptions
            });
          }
          
          // Verify records exist
          const matchesBefore = await sessionService.getMatchRecordsForSession(session.id);
          expect(matchesBefore).toHaveLength(matchOptionsList.length);
          
          // Delete session
          await sessionService.deleteSession(session.id);
          
          // Verify session and all related records are deleted
          const sessionAfter = await sessionService.getSession(session.id);
          expect(sessionAfter).toBeUndefined();
          
          const matchesAfter = await sessionService.getMatchRecordsForSession(session.id);
          expect(matchesAfter).toHaveLength(0);
        }
      ), { numRuns: 15 });
    });

    it('should maintain session progress summary consistency', () => {
      return fc.assert(fc.asyncProperty(
        sessionOptionsArb,
        fc.array(matchRecordOptionsArb, { minLength: 1, maxLength: 20 }),
        fc.array(verificationStatusArb, { minLength: 1, maxLength: 20 }),
        async (sessionOptions, matchOptionsList, statusList) => {
          // Create session
          const session = await sessionService.createSession(sessionOptions);
          
          // Create match records with various statuses
          const matchRecords = [];
          for (let i = 0; i < matchOptionsList.length; i++) {
            const matchOptions = matchOptionsList[i];
            const matchRecord = await sessionService.createMatchRecord({
              sessionId: session.id,
              ...matchOptions
            });
            
            // Update some records with verification status
            if (i < statusList.length) {
              await sessionService.updateMatchVerification(
                matchRecord.id,
                statusList[i],
                'user'
              );
            }
            
            matchRecords.push(matchRecord);
          }
          
          // Get progress summary
          const progress = await sessionService.getSessionProgress(session.id);
          
          // Verify summary consistency
          expect(progress.session).toBeDefined();
          expect(progress.session!.id).toBe(session.id);
          expect(progress.matchCounts.total).toBe(matchRecords.length);
          
          // Verify counts add up
          const totalCounted = progress.matchCounts.pending + 
                              progress.matchCounts.accepted + 
                              progress.matchCounts.rejected + 
                              progress.matchCounts.manual;
          expect(totalCounted).toBe(progress.matchCounts.total);
          
          // Verify confidence level counts
          const confidenceCounted = progress.matchCounts.highConfidence + 
                                   progress.matchCounts.mediumConfidence + 
                                   progress.matchCounts.lowConfidence;
          expect(confidenceCounted).toBe(progress.matchCounts.total);
        }
      ), { numRuns: 15 });
    });

    it('should handle concurrent session operations safely', () => {
      return fc.assert(fc.asyncProperty(
        sessionOptionsArb,
        fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 5, maxLength: 20 }),
        async (sessionOptions, progressUpdates) => {
          // Create session
          const session = await sessionService.createSession(sessionOptions);
          
          // Perform concurrent progress updates
          const updatePromises = progressUpdates.map(async (value, index) => {
            await sessionService.updateSessionProgress({
              sessionId: session.id,
              processedPlaces: value,
              apiCallsUsed: index,
            });
          });
          
          await Promise.all(updatePromises);
          
          // Verify final state is consistent
          const finalSession = await sessionService.getSession(session.id);
          expect(finalSession).toBeDefined();
          expect(finalSession!.processedPlaces).toBeGreaterThanOrEqual(0);
          expect(finalSession!.apiCallsUsed).toBeGreaterThanOrEqual(0);
          expect(toTime(finalSession!.updatedAt)).toBeGreaterThanOrEqual(toTime(session.createdAt));
        }
      ), { numRuns: 10 });
    });
  });
});
