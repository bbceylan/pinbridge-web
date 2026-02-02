/**
 * Database migration utilities for PinBridge
 * Handles data migration between schema versions
 */

import { db } from './index';
import type { TransferPack, TransferPackSession } from '@/types';

/**
 * Migration for version 4: Create transfer pack sessions for existing transfer packs
 * This ensures existing transfer packs can work with the new automated transfer system
 */
export async function migrateExistingTransferPacks(): Promise<void> {
  console.log('Starting migration of existing transfer packs...');
  
  try {
    // Get all existing transfer packs that don't have sessions
    const existingPacks = await db.transferPacks.toArray();
    const existingSessions = await db.transferPackSessions.toArray();
    const existingSessionPackIds = new Set(existingSessions.map(s => s.packId));
    
    const packsNeedingSessions = existingPacks.filter(pack => 
      !existingSessionPackIds.has(pack.id)
    );
    
    if (packsNeedingSessions.length === 0) {
      console.log('No transfer packs need migration');
      return;
    }
    
    console.log(`Migrating ${packsNeedingSessions.length} transfer packs...`);
    
    // Create sessions for existing packs
    const sessionsToCreate: TransferPackSession[] = [];
    
    for (const pack of packsNeedingSessions) {
      // Get the pack items to calculate totals
      const packItems = await db.transferPackItems
        .where('packId')
        .equals(pack.id)
        .toArray();
      
      const completedItems = packItems.filter(item => item.status === 'done');
      
      // Determine session status based on pack completion
      let status: TransferPackSession['status'];
      if (completedItems.length === packItems.length && packItems.length > 0) {
        status = 'completed';
      } else if (completedItems.length > 0) {
        status = 'paused'; // Partially completed packs are considered paused
      } else {
        status = 'pending';
      }
      
      const session: TransferPackSession = {
        id: `session_${pack.id}`,
        packId: pack.id,
        status,
        createdAt: pack.createdAt,
        updatedAt: pack.updatedAt || pack.createdAt,
        apiCallsUsed: 0,
        processingTimeMs: 0,
        errorCount: 0,
        totalPlaces: packItems.length,
        processedPlaces: packItems.length, // Existing packs are considered "processed" (manually)
        verifiedPlaces: completedItems.length,
        completedPlaces: completedItems.length,
      };
      
      sessionsToCreate.push(session);
    }
    
    // Bulk insert the new sessions
    await db.transferPackSessions.bulkAdd(sessionsToCreate);
    
    console.log(`Successfully migrated ${sessionsToCreate.length} transfer pack sessions`);
    
  } catch (error) {
    console.error('Error during transfer pack migration:', error);
    throw error;
  }
}

/**
 * Clean up orphaned records that may exist due to incomplete operations
 */
export async function cleanupOrphanedRecords(): Promise<void> {
  console.log('Cleaning up orphaned records...');
  
  try {
    // Clean up place match records without valid sessions
    const allMatchRecords = await db.placeMatchRecords.toArray();
    const validSessionIds = new Set(
      (await db.transferPackSessions.toArray()).map(s => s.id)
    );
    
    const orphanedMatchRecords = allMatchRecords.filter(
      record => !validSessionIds.has(record.sessionId)
    );
    
    if (orphanedMatchRecords.length > 0) {
      await db.placeMatchRecords.bulkDelete(
        orphanedMatchRecords.map(r => r.id)
      );
      console.log(`Cleaned up ${orphanedMatchRecords.length} orphaned match records`);
    }
    
    // Clean up API usage logs without valid sessions (keep logs without sessionId)
    const allApiLogs = await db.apiUsageLog.toArray();
    const orphanedApiLogs = allApiLogs.filter(
      log => log.sessionId && !validSessionIds.has(log.sessionId)
    );
    
    if (orphanedApiLogs.length > 0) {
      await db.apiUsageLog.bulkDelete(
        orphanedApiLogs.map(l => l.id)
      );
      console.log(`Cleaned up ${orphanedApiLogs.length} orphaned API logs`);
    }
    
    console.log('Cleanup completed successfully');
    
  } catch (error) {
    console.error('Error during cleanup:', error);
    throw error;
  }
}

/**
 * Run all necessary migrations for the current database version
 */
export async function runMigrations(): Promise<void> {
  console.log('Running database migrations...');
  
  try {
    await migrateExistingTransferPacks();
    await cleanupOrphanedRecords();
    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

/**
 * Validate database integrity after migrations
 */
export async function validateDatabaseIntegrity(): Promise<{
  isValid: boolean;
  issues: string[];
}> {
  const issues: string[] = [];
  
  try {
    // Check that all transfer packs have sessions
    const packsWithoutSessions = await db.transferPacks
      .toArray()
      .then(packs => 
        Promise.all(
          packs.map(async pack => {
            const session = await db.transferPackSessions
              .where('packId')
              .equals(pack.id)
              .first();
            return session ? null : pack.id;
          })
        )
      )
      .then(results => results.filter(id => id !== null));
    
    if (packsWithoutSessions.length > 0) {
      issues.push(`Transfer packs without sessions: ${packsWithoutSessions.join(', ')}`);
    }
    
    // Check that all place match records have valid sessions
    const matchRecordsWithInvalidSessions = await db.placeMatchRecords
      .toArray()
      .then(records =>
        Promise.all(
          records.map(async record => {
            const session = await db.transferPackSessions.get(record.sessionId);
            return session ? null : record.id;
          })
        )
      )
      .then(results => results.filter(id => id !== null));
    
    if (matchRecordsWithInvalidSessions.length > 0) {
      issues.push(`Match records with invalid sessions: ${matchRecordsWithInvalidSessions.length}`);
    }
    
    // Check that all place match records reference valid places
    const matchRecordsWithInvalidPlaces = await db.placeMatchRecords
      .toArray()
      .then(records =>
        Promise.all(
          records.map(async record => {
            const place = await db.places.get(record.originalPlaceId);
            return place ? null : record.id;
          })
        )
      )
      .then(results => results.filter(id => id !== null));
    
    if (matchRecordsWithInvalidPlaces.length > 0) {
      issues.push(`Match records with invalid place references: ${matchRecordsWithInvalidPlaces.length}`);
    }
    
    return {
      isValid: issues.length === 0,
      issues,
    };
    
  } catch (error) {
    issues.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return {
      isValid: false,
      issues,
    };
  }
}