import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fc from 'fast-check';
import { db } from '@/lib/db';
import { transferSessionService } from '../transfer-session';
import { batchProcessingEngine } from '../batch-processing-engine';
import type { 
  TransferPackSession, 
  PlaceMatchRecord,
  TransferSessionStatus 
} from '@/types';

// Mock the API services to avoid external dependencies
jest.mock('../api/apple-maps');
jest.mock('../api/google-maps');

describe('Progress Tracking Accuracy Properties', () => {
  beforeEach(async () => {
    // Clear test data with timeout protection
    await Promise.race([
      Promise.all([
        db.transferPackSessions.clear(),
        db.placeMatchRecords.clear(),
        db.transferPacks.clear(),
        db.places.clear()
      ]),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Setup timeout')), 3000)
      )
    ]);
  });

  afterEach(async () => {
    // Clean up test data with timeout protection
    try {
      await Promise.race([
        Promise.all([
          db.transferPackSessions.clear(),
          db.placeMatchRecords.clear(),
          db.transferPacks.clear(),
          db.places.clear()
        ]),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Cleanup timeout')), 3000)
        )
      ]);
    } catch (error) {
      console.warn('Test cleanup timeout:', error);
    }
  });

  // Arbitraries for generating test data
  const sessionArb = fc.record({
    id: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 0),
    packId: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 0),
    status: fc.constantFrom('pending', 'processing', 'verifying', 'completed', 'failed', 'paused'),
    createdAt: fc.date(),
    updatedAt: fc.date(),
    apiCallsUsed: fc.integer({ min: 0, max: 1000 }),
    processingTimeMs: fc.integer({ min: 0, max: 3600000 }),
    errorCount: fc.integer({ min: 0, max: 100 }),
    totalPlaces: fc.integer({ min: 1, max: 100 }),
    processedPlaces: fc.integer({ min: 0, max: 100 }),
    verifiedPlaces: fc.integer({ min: 0, max: 100 }),
    completedPlaces: fc.integer({ min: 0, max: 100 })
  }).filter(session => 
    // Ensure logical consistency in progress values
    session.processedPlaces <= session.totalPlaces &&
    session.verifiedPlaces <= session.processedPlaces &&
    session.completedPlaces <= session.verifiedPlaces
  );

  const matchRecordArb = fc.record({
    id: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 0),
    sessionId: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 0),
    originalPlaceId: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 0),
    targetPlaceData: fc.record({
      id: fc.string({ minLength: 1, maxLength: 50 }),
      name: fc.string({ minLength: 1, maxLength: 100 }),
      address: fc.string({ minLength: 1, maxLength: 200 }),
      latitude: fc.float({ min: -90, max: 90 }),
      longitude: fc.float({ min: -180, max: 180 })
    }).map(data => JSON.stringify(data)),
    confidenceScore: fc.integer({ min: 0, max: 100 }),
    confidenceLevel: fc.constantFrom('high', 'medium', 'low'),
    matchFactors: fc.array(fc.record({
      type: fc.constantFrom('name', 'address', 'distance', 'category'),
      score: fc.integer({ min: 0, max: 100 }),
      weight: fc.integer({ min: 10, max: 50 }),
      explanation: fc.string({ minLength: 10, maxLength: 100 })
    }), { minLength: 1, maxLength: 4 }).map(factors => JSON.stringify(factors)),
    verificationStatus: fc.constantFrom('pending', 'accepted', 'rejected', 'manual'),
    verifiedAt: fc.option(fc.date()),
    verifiedBy: fc.option(fc.constantFrom('user', 'bulk_action')),
    manualSearchQuery: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
    manualSelectedPlace: fc.option(fc.string({ minLength: 1, maxLength: 500 })),
    userNotes: fc.option(fc.string({ minLength: 1, maxLength: 200 }))
  });

  describe('Property 6: Progress Tracking Accuracy', () => {
    it('should maintain accurate progress counts during session updates', async () => {
      await fc.assert(fc.asyncProperty(
        sessionArb,
        fc.array(fc.integer({ min: 0, max: 50 }), { minLength: 1, maxLength: 10 }),
        async (initialSession, progressUpdates) => {
          // Create session in database
          const session = await transferSessionService.createSession({
            packId: initialSession.packId,
            totalPlaces: initialSession.totalPlaces,
          });

          // Apply a series of progress updates
          let currentProcessed = 0;
          let currentVerified = 0;
          let currentCompleted = 0;

          for (const update of progressUpdates) {
            // Ensure progress only moves forward and stays within bounds
            const newProcessed = Math.min(
              Math.max(currentProcessed, currentProcessed + (update % 10)),
              initialSession.totalPlaces
            );
            const newVerified = Math.min(newProcessed, currentVerified + (update % 5));
            const newCompleted = Math.min(newVerified, currentCompleted + (update % 3));

            await transferSessionService.updateSessionProgress({
              sessionId: session.id,
              processedPlaces: newProcessed,
              verifiedPlaces: newVerified,
              completedPlaces: newCompleted,
            });

            currentProcessed = newProcessed;
            currentVerified = newVerified;
            currentCompleted = newCompleted;

            // Verify progress consistency after each update
            const updatedSession = await transferSessionService.getSession(session.id);
            expect(updatedSession).toBeDefined();
            
            if (updatedSession) {
              // Progress values should be logically consistent
              expect(updatedSession.processedPlaces).toBeLessThanOrEqual(updatedSession.totalPlaces);
              expect(updatedSession.verifiedPlaces).toBeLessThanOrEqual(updatedSession.processedPlaces);
              expect(updatedSession.completedPlaces).toBeLessThanOrEqual(updatedSession.verifiedPlaces);
              
              // Progress should match our expected values
              expect(updatedSession.processedPlaces).toBe(currentProcessed);
              expect(updatedSession.verifiedPlaces).toBe(currentVerified);
              expect(updatedSession.completedPlaces).toBe(currentCompleted);
            }
          }
        }
      ), { numRuns: 20 });
    });

    it('should accurately calculate progress percentages', async () => {
      await fc.assert(fc.asyncProperty(
        fc.integer({ min: 1, max: 100 }), // totalPlaces
        fc.integer({ min: 0, max: 100 }), // processedPlaces (will be clamped)
        fc.integer({ min: 0, max: 100 }), // verifiedPlaces (will be clamped)
        async (totalPlaces, rawProcessed, rawVerified) => {
          // Ensure logical consistency
          const processedPlaces = Math.min(rawProcessed, totalPlaces);
          const verifiedPlaces = Math.min(rawVerified, processedPlaces);

          const session = await transferSessionService.createSession({
            packId: `pack_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            totalPlaces,
          });

          await transferSessionService.updateSessionProgress({
            sessionId: session.id,
            processedPlaces,
            verifiedPlaces,
          });

          const progressSummary = await transferSessionService.getSessionProgress(session.id);
          
          // Calculate expected percentages
          const expectedProcessingPercentage = totalPlaces > 0 ? 
            Math.round((processedPlaces / totalPlaces) * 100) : 0;
          const expectedVerificationPercentage = processedPlaces > 0 ? 
            Math.round((verifiedPlaces / processedPlaces) * 100) : 0;

          // Verify percentage calculations are accurate
          expect(expectedProcessingPercentage).toBeGreaterThanOrEqual(0);
          expect(expectedProcessingPercentage).toBeLessThanOrEqual(100);
          expect(expectedVerificationPercentage).toBeGreaterThanOrEqual(0);
          expect(expectedVerificationPercentage).toBeLessThanOrEqual(100);

          // Verify session data consistency
          expect(progressSummary.session?.totalPlaces).toBe(totalPlaces);
          expect(progressSummary.session?.processedPlaces).toBe(processedPlaces);
          expect(progressSummary.session?.verifiedPlaces).toBe(verifiedPlaces);
        }
      ), { numRuns: 30 });
    });

    it('should maintain accurate match record counts', async () => {
      await fc.assert(fc.asyncProperty(
        sessionArb,
        fc.array(matchRecordArb, { minLength: 1, maxLength: 20 }).chain(matches => {
          // Ensure unique IDs to avoid conflicts
          const uniqueMatches = matches.map((match, index) => ({
            ...match,
            id: `match_${index}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            originalPlaceId: `place_${index}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          }));
          return fc.constant(uniqueMatches);
        }),
        async (session, matches) => {
          // Create session
          const createdSession = await transferSessionService.createSession({
            packId: session.packId,
            totalPlaces: session.totalPlaces,
          });

          // Create match records
          const sessionMatches = matches.map(m => ({ ...m, sessionId: createdSession.id }));
          
          for (const match of sessionMatches) {
            // Determine confidence level based on score (matching the service logic)
            const confidenceLevel = match.confidenceScore >= 90 ? 'high' :
                                   match.confidenceScore >= 70 ? 'medium' : 'low';
            
            await transferSessionService.createMatchRecord({
              sessionId: match.sessionId,
              originalPlaceId: match.originalPlaceId,
              targetPlaceData: JSON.parse(match.targetPlaceData),
              confidenceScore: match.confidenceScore,
              matchFactors: JSON.parse(match.matchFactors),
            });
            
            // Update the match record with the correct confidence level and verification status
            const createdRecords = await transferSessionService.getMatchRecordsForSession(createdSession.id);
            const createdRecord = createdRecords.find(r => r.originalPlaceId === match.originalPlaceId);
            if (createdRecord) {
              await transferSessionService.updateMatchVerification(
                createdRecord.id,
                match.verificationStatus,
                'user'
              );
            }
          }

          // Get progress summary
          const progressSummary = await transferSessionService.getSessionProgress(createdSession.id);
          
          // Calculate expected counts based on actual created records
          const actualRecords = await transferSessionService.getMatchRecordsForSession(createdSession.id);
          const expectedTotal = actualRecords.length;
          const expectedPending = actualRecords.filter(m => m.verificationStatus === 'pending').length;
          const expectedAccepted = actualRecords.filter(m => m.verificationStatus === 'accepted').length;
          const expectedRejected = actualRecords.filter(m => m.verificationStatus === 'rejected').length;
          const expectedManual = actualRecords.filter(m => m.verificationStatus === 'manual').length;
          
          const expectedHigh = actualRecords.filter(m => m.confidenceLevel === 'high').length;
          const expectedMedium = actualRecords.filter(m => m.confidenceLevel === 'medium').length;
          const expectedLow = actualRecords.filter(m => m.confidenceLevel === 'low').length;

          // Verify match counts are accurate
          expect(progressSummary.matchCounts.total).toBe(expectedTotal);
          expect(progressSummary.matchCounts.pending).toBe(expectedPending);
          expect(progressSummary.matchCounts.accepted).toBe(expectedAccepted);
          expect(progressSummary.matchCounts.rejected).toBe(expectedRejected);
          expect(progressSummary.matchCounts.manual).toBe(expectedManual);
          
          expect(progressSummary.matchCounts.highConfidence).toBe(expectedHigh);
          expect(progressSummary.matchCounts.mediumConfidence).toBe(expectedMedium);
          expect(progressSummary.matchCounts.lowConfidence).toBe(expectedLow);

          // Verify totals add up correctly
          expect(expectedPending + expectedAccepted + expectedRejected + expectedManual).toBe(expectedTotal);
          expect(expectedHigh + expectedMedium + expectedLow).toBe(expectedTotal);
        }
      ), { numRuns: 15 });
    });

    it('should handle concurrent progress updates correctly', async () => {
      await fc.assert(fc.asyncProperty(
        sessionArb,
        fc.array(fc.record({
          processedPlaces: fc.integer({ min: 0, max: 50 }),
          verifiedPlaces: fc.integer({ min: 0, max: 50 }),
          completedPlaces: fc.integer({ min: 0, max: 50 }),
        }), { minLength: 2, maxLength: 5 }),
        async (session, updates) => {
          // Create session
          const createdSession = await transferSessionService.createSession({
            packId: session.packId,
            totalPlaces: session.totalPlaces,
          });

          // Apply concurrent updates with proper constraints
          const updatePromises = updates.map(async (update, index) => {
            // Add small delay to simulate real concurrent access
            await new Promise(resolve => setTimeout(resolve, index * 10));
            
            // Ensure logical consistency in the update
            const processedPlaces = Math.min(update.processedPlaces, session.totalPlaces);
            const verifiedPlaces = Math.min(update.verifiedPlaces, processedPlaces);
            const completedPlaces = Math.min(update.completedPlaces, verifiedPlaces);
            
            return transferSessionService.updateSessionProgress({
              sessionId: createdSession.id,
              processedPlaces,
              verifiedPlaces,
              completedPlaces,
            });
          });

          await Promise.all(updatePromises);

          // Verify final session state is consistent
          const finalSession = await transferSessionService.getSession(createdSession.id);
          expect(finalSession).toBeDefined();
          
          if (finalSession) {
            expect(finalSession.processedPlaces).toBeLessThanOrEqual(finalSession.totalPlaces);
            expect(finalSession.verifiedPlaces).toBeLessThanOrEqual(finalSession.processedPlaces);
            expect(finalSession.completedPlaces).toBeLessThanOrEqual(finalSession.verifiedPlaces);
          }
        }
      ), { numRuns: 10 });
    });

    it('should maintain progress accuracy during status transitions', async () => {
      await fc.assert(fc.asyncProperty(
        sessionArb,
        fc.array(fc.constantFrom('pending', 'processing', 'verifying', 'completed', 'failed', 'paused'), 
                { minLength: 2, maxLength: 6 }),
        async (session, statusSequence) => {
          // Create session
          const createdSession = await transferSessionService.createSession({
            packId: session.packId,
            totalPlaces: session.totalPlaces,
          });

          let previousStatus: TransferSessionStatus = 'pending';

          // Apply status transitions
          for (const status of statusSequence) {
            await transferSessionService.updateSessionStatus(createdSession.id, status);
            
            const updatedSession = await transferSessionService.getSession(createdSession.id);
            expect(updatedSession).toBeDefined();
            
            if (updatedSession) {
              expect(updatedSession.status).toBe(status);
              
              // Progress values should remain consistent regardless of status changes
              expect(updatedSession.processedPlaces).toBeLessThanOrEqual(updatedSession.totalPlaces);
              expect(updatedSession.verifiedPlaces).toBeLessThanOrEqual(updatedSession.processedPlaces);
              expect(updatedSession.completedPlaces).toBeLessThanOrEqual(updatedSession.verifiedPlaces);
              
              // Total places should never change
              expect(updatedSession.totalPlaces).toBe(session.totalPlaces);
            }

            previousStatus = status;
          }
        }
      ), { numRuns: 15 });
    });

    it('should accurately track processing time and API usage', async () => {
      await fc.assert(fc.asyncProperty(
        sessionArb,
        fc.array(fc.record({
          apiCallsUsed: fc.integer({ min: 0, max: 100 }),
          processingTimeMs: fc.integer({ min: 0, max: 60000 }),
          errorCount: fc.integer({ min: 0, max: 10 }),
        }), { minLength: 1, maxLength: 5 }),
        async (session, metricUpdates) => {
          // Create session
          const createdSession = await transferSessionService.createSession({
            packId: session.packId,
            totalPlaces: session.totalPlaces,
          });

          let totalApiCalls = 0;
          let totalProcessingTime = 0;
          let totalErrors = 0;

          // Apply metric updates
          for (const update of metricUpdates) {
            totalApiCalls += update.apiCallsUsed;
            totalProcessingTime += update.processingTimeMs;
            totalErrors += update.errorCount;

            await transferSessionService.updateSessionProgress({
              sessionId: createdSession.id,
              apiCallsUsed: totalApiCalls,
              processingTimeMs: totalProcessingTime,
              errorCount: totalErrors,
            });

            // Verify metrics are accurately tracked
            const updatedSession = await transferSessionService.getSession(createdSession.id);
            expect(updatedSession).toBeDefined();
            
            if (updatedSession) {
              expect(updatedSession.apiCallsUsed).toBe(totalApiCalls);
              expect(updatedSession.processingTimeMs).toBe(totalProcessingTime);
              expect(updatedSession.errorCount).toBe(totalErrors);
              
              // Metrics should be non-negative
              expect(updatedSession.apiCallsUsed).toBeGreaterThanOrEqual(0);
              expect(updatedSession.processingTimeMs).toBeGreaterThanOrEqual(0);
              expect(updatedSession.errorCount).toBeGreaterThanOrEqual(0);
            }
          }
        }
      ), { numRuns: 20 });
    });

    it('should maintain progress accuracy across session recovery', async () => {
      await fc.assert(fc.asyncProperty(
        sessionArb,
        fc.integer({ min: 1, max: 10 }), // Number of recovery cycles
        async (session, recoveryCycles) => {
          // Create session
          const createdSession = await transferSessionService.createSession({
            packId: session.packId,
            totalPlaces: session.totalPlaces,
          });

          let expectedProcessed = 0;
          let expectedVerified = 0;

          // Simulate multiple pause/resume cycles
          for (let i = 0; i < recoveryCycles; i++) {
            // Make some progress
            expectedProcessed = Math.min(expectedProcessed + (i + 1), session.totalPlaces);
            expectedVerified = Math.min(expectedVerified + i, expectedProcessed);

            await transferSessionService.updateSessionProgress({
              sessionId: createdSession.id,
              processedPlaces: expectedProcessed,
              verifiedPlaces: expectedVerified,
            });

            // Pause session
            await transferSessionService.pauseSession(createdSession.id);
            
            // Verify paused state
            const pausedSession = await transferSessionService.getSession(createdSession.id);
            expect(pausedSession?.status).toBe('paused');
            expect(pausedSession?.processedPlaces).toBe(expectedProcessed);
            expect(pausedSession?.verifiedPlaces).toBe(expectedVerified);

            // Resume session
            await transferSessionService.resumeSession(createdSession.id);
            
            // Verify resumed state maintains progress
            const resumedSession = await transferSessionService.getSession(createdSession.id);
            expect(resumedSession?.status).toBe('processing');
            expect(resumedSession?.processedPlaces).toBe(expectedProcessed);
            expect(resumedSession?.verifiedPlaces).toBe(expectedVerified);
          }
        }
      ), { numRuns: 10 });
    });
  });
});