/**
 * Database initialization utilities
 * Handles database setup, migrations, and version management
 */

import { db } from './index';
import { runMigrations, validateDatabaseIntegrity } from './migrations';

/**
 * Initialize the database and run any necessary migrations
 * This should be called when the application starts
 */
export async function initializeDatabase(): Promise<void> {
  const isTest = process.env.NODE_ENV === 'test';
  const info = (...args: Parameters<typeof console.log>) => {
    if (!isTest) {
      console.log(...args);
    }
  };

  try {
    info('Initializing PinBridge database...');
    
    // Open the database (this will trigger Dexie version upgrades)
    await db.open();
    
    info(`Database opened successfully. Version: ${db.verno}`);
    
    // Check if we need to run migrations for version 4
    if (db.verno >= 4) {
      const needsMigration = await checkIfMigrationNeeded();
      
      if (needsMigration) {
        info('Running migrations for automated transfer features...');
        await runMigrations();
        
        // Validate the migration was successful
        const validation = await validateDatabaseIntegrity();
        if (!validation.isValid) {
          console.warn('Database validation found issues:', validation.issues);
          // Don't throw here - log the issues but allow the app to continue
        } else {
          info('Database migration and validation completed successfully');
        }
      } else {
        info('No migrations needed');
      }
    }
    
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

/**
 * Check if migration is needed by looking for transfer packs without sessions
 */
async function checkIfMigrationNeeded(): Promise<boolean> {
  try {
    const transferPackCount = await db.transferPacks.count();
    const sessionCount = await db.transferPackSessions.count();
    
    // If we have transfer packs but no sessions, we need migration
    return transferPackCount > 0 && sessionCount === 0;
  } catch (error) {
    console.error('Error checking migration status:', error);
    return false;
  }
}

/**
 * Get database statistics for monitoring and debugging
 */
export async function getDatabaseStats(): Promise<{
  version: number;
  tables: Record<string, number>;
  totalSize: number;
}> {
  const stats = {
    version: db.verno,
    tables: {} as Record<string, number>,
    totalSize: 0,
  };
  
  try {
    // Count records in each table
    stats.tables.places = await db.places.count();
    stats.tables.collections = await db.collections.count();
    stats.tables.placeCollections = await db.placeCollections.count();
    stats.tables.transferPacks = await db.transferPacks.count();
    stats.tables.transferPackItems = await db.transferPackItems.count();
    stats.tables.importRuns = await db.importRuns.count();
    stats.tables.linkLists = await db.linkLists.count();
    stats.tables.apiCache = await db.apiCache.count();
    stats.tables.apiUsageLog = await db.apiUsageLog.count();
    
    // New tables (version 4+)
    if (db.verno >= 4) {
      stats.tables.transferPackSessions = await db.transferPackSessions.count();
      stats.tables.placeMatchRecords = await db.placeMatchRecords.count();
    }
    
    // Calculate approximate total size
    stats.totalSize = Object.values(stats.tables).reduce((sum, count) => sum + count, 0);
    
  } catch (error) {
    console.error('Error getting database stats:', error);
  }
  
  return stats;
}

/**
 * Health check for the database
 */
export async function checkDatabaseHealth(): Promise<{
  isHealthy: boolean;
  issues: string[];
  stats: Awaited<ReturnType<typeof getDatabaseStats>>;
}> {
  const issues: string[] = [];
  let isHealthy = true;
  
  try {
    // Check if database is accessible
    await db.places.limit(1).toArray();
    
    // Get current stats
    const stats = await getDatabaseStats();
    
    // Run integrity validation if we're on version 4+
    if (db.verno >= 4) {
      const validation = await validateDatabaseIntegrity();
      if (!validation.isValid) {
        isHealthy = false;
        issues.push(...validation.issues);
      }
    }
    
    // Check for potential issues
    if (stats.tables.places === 0 && stats.tables.transferPacks > 0) {
      issues.push('Transfer packs exist but no places found');
    }
    
    if (stats.tables.transferPackItems > 0 && stats.tables.transferPacks === 0) {
      issues.push('Transfer pack items exist but no transfer packs found');
    }
    
    return {
      isHealthy: isHealthy && issues.length === 0,
      issues,
      stats,
    };
    
  } catch (error) {
    return {
      isHealthy: false,
      issues: [`Database access error: ${error instanceof Error ? error.message : 'Unknown error'}`],
      stats: await getDatabaseStats().catch(() => ({
        version: 0,
        tables: {},
        totalSize: 0,
      })),
    };
  }
}
