# Database Schema Extensions - Version 4

This document describes the database schema extensions added in version 4 to support automated transfer with verification functionality.

## New Tables

### 1. transfer_pack_sessions
Tracks automated transfer sessions for transfer packs.

**Schema:**
```sql
CREATE TABLE transfer_pack_sessions (
  id TEXT PRIMARY KEY,
  pack_id TEXT NOT NULL,
  status TEXT NOT NULL, -- 'pending' | 'processing' | 'verifying' | 'completed' | 'failed' | 'paused'
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  
  -- Processing metadata
  api_calls_used INTEGER DEFAULT 0,
  processing_time_ms INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  
  -- Progress tracking
  total_places INTEGER NOT NULL,
  processed_places INTEGER DEFAULT 0,
  verified_places INTEGER DEFAULT 0,
  completed_places INTEGER DEFAULT 0,
  
  FOREIGN KEY (pack_id) REFERENCES transfer_packs(id)
);
```

**Indexes:**
- `packId` - Find session for a specific transfer pack
- `[packId+status]` - Query sessions by pack and status
- `[status+updatedAt]` - Find active sessions ordered by last update

### 2. place_match_records
Stores matching results between original places and target service places.

**Schema:**
```sql
CREATE TABLE place_match_records (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  original_place_id TEXT NOT NULL,
  
  -- Matching results
  target_place_data TEXT NOT NULL, -- JSON serialized target place data
  confidence_score INTEGER NOT NULL, -- 0-100
  confidence_level TEXT NOT NULL, -- 'high' | 'medium' | 'low'
  match_factors TEXT NOT NULL, -- JSON serialized MatchFactor[]
  
  -- Verification status
  verification_status TEXT DEFAULT 'pending', -- 'pending' | 'accepted' | 'rejected' | 'manual'
  verified_at DATETIME,
  verified_by TEXT, -- 'user' | 'bulk_action'
  
  -- Manual override data
  manual_search_query TEXT,
  manual_selected_place TEXT, -- JSON serialized target place data
  user_notes TEXT,
  
  FOREIGN KEY (session_id) REFERENCES transfer_pack_sessions(id),
  FOREIGN KEY (original_place_id) REFERENCES places(id)
);
```

**Indexes:**
- `sessionId` - Get all matches for a session
- `[sessionId+verificationStatus]` - Filter matches by verification status
- `[sessionId+confidenceLevel]` - Filter matches by confidence level
- `[originalPlaceId+sessionId]` - Find match for specific place in session

### 3. Enhanced api_usage_log
Extended existing API usage logging to support session tracking.

**New Fields:**
- `session_id` - Links API calls to transfer sessions for monitoring and debugging

**New Indexes:**
- `[sessionId+createdAt]` - Get API usage for a session ordered by time

## TypeScript Interfaces

### TransferPackSession
```typescript
interface TransferPackSession {
  id: string;
  packId: string;
  status: TransferSessionStatus;
  createdAt: Date;
  updatedAt: Date;
  
  // Processing metadata
  apiCallsUsed: number;
  processingTimeMs: number;
  errorCount: number;
  
  // Progress tracking
  totalPlaces: number;
  processedPlaces: number;
  verifiedPlaces: number;
  completedPlaces: number;
}
```

### PlaceMatchRecord
```typescript
interface PlaceMatchRecord {
  id: string;
  sessionId: string;
  originalPlaceId: string;
  
  // Matching results
  targetPlaceData: string; // JSON serialized
  confidenceScore: number;
  confidenceLevel: ConfidenceLevel;
  matchFactors: string; // JSON serialized MatchFactor[]
  
  // Verification status
  verificationStatus: VerificationStatus;
  verifiedAt?: Date;
  verifiedBy?: VerifiedBy;
  
  // Manual override data
  manualSearchQuery?: string;
  manualSelectedPlace?: string; // JSON serialized
  userNotes?: string;
}
```

## Services

### TransferSessionService
Provides high-level operations for managing transfer sessions and match records:

- `createSession()` - Create new transfer session
- `updateSessionStatus()` - Update session status
- `updateSessionProgress()` - Update progress counters
- `createMatchRecord()` - Create place match record
- `updateMatchVerification()` - Update verification status
- `getSessionProgress()` - Get comprehensive progress summary
- `bulkUpdateMatchRecords()` - Bulk operations for verification

## Migration

### Automatic Migration
The system automatically migrates existing transfer packs to create corresponding sessions:

1. **Completed packs** (all items done) → `completed` status
2. **Partially completed packs** → `paused` status  
3. **Empty packs** → `pending` status

### Migration Functions
- `migrateExistingTransferPacks()` - Creates sessions for existing packs
- `cleanupOrphanedRecords()` - Removes invalid references
- `validateDatabaseIntegrity()` - Checks referential integrity

## Usage

### Initialize Database
```typescript
import { initializeDatabase } from '@/lib/db/init';

// Call during app startup
await initializeDatabase();
```

### Create Transfer Session
```typescript
import { transferSessionService } from '@/lib/services/transfer-session';

const session = await transferSessionService.createSession({
  packId: 'pack-123',
  totalPlaces: 50,
});
```

### Track Matching Results
```typescript
const matchRecord = await transferSessionService.createMatchRecord({
  sessionId: session.id,
  originalPlaceId: 'place-456',
  targetPlaceData: { name: 'Coffee Shop', address: '123 Main St' },
  confidenceScore: 85,
  matchFactors: [
    { type: 'name', score: 90, weight: 0.4, explanation: 'Exact match' },
    { type: 'address', score: 80, weight: 0.3, explanation: 'Similar address' },
  ],
});
```

### Query Progress
```typescript
const progress = await transferSessionService.getSessionProgress(session.id);
console.log(`${progress.matchCounts.accepted}/${progress.matchCounts.total} verified`);
```

## Performance Considerations

### Efficient Queries
The schema is optimized for common query patterns:
- Finding sessions by pack ID
- Filtering matches by status or confidence
- Getting API usage for debugging
- Bulk operations on match records

### Indexes
All frequently queried combinations have compound indexes to ensure fast lookups even with large datasets.

### JSON Storage
Complex data (target place data, match factors) is stored as JSON strings to maintain flexibility while keeping the schema simple.

## Requirements Satisfied

This implementation satisfies the following requirements from the specification:

- **6.1** - Progress tracking and status management
- **6.2** - Place matching and verification workflow  
- **6.3** - API usage monitoring and debugging
- **6.4** - Efficient querying and bulk operations

The schema supports the full automated transfer workflow while maintaining backward compatibility with existing transfer packs.