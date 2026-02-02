# Design Document: Automatized Transfer with Verification

## Overview

This design transforms the manual transfer pack workflow into an intelligent, automated system that fetches place data from target mapping services, performs fuzzy matching, and presents users with a verification interface for batch processing. The approach is inspired by successful transfer applications like SongShift and browser extensions like Mapper.

## Architecture

### Current Architecture (Manual)
```
User → Transfer Pack → Manual Process:
├── Open each place individually
├── Manual search in target app
├── Manual save in target app
└── Manual confirmation in PinBridge
```

### New Architecture (Automated with Verification)
```
User → Transfer Pack → Automated Process:
├── Batch API Fetching
│   ├── Apple Maps API / Google Maps API
│   ├── Parallel place searches
│   └── Response caching
├── Intelligent Matching
│   ├── Fuzzy matching algorithm
│   ├── Confidence scoring
│   └── Result ranking
├── Verification Interface
│   ├── Batch review UI
│   ├── Bulk operations
│   └── Manual override
└── Final Transfer Execution
```

## Components and Interfaces

### 1. API Integration Layer

**Apple Maps API Integration:**
```typescript
interface AppleMapsService {
  searchPlaces(query: PlaceSearchQuery): Promise<AppleMapsPlace[]>;
  getPlaceDetails(placeId: string): Promise<AppleMapsPlace>;
  validateApiKey(): Promise<boolean>;
}

interface PlaceSearchQuery {
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  radius?: number; // meters
}

interface AppleMapsPlace {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  category?: string;
  phoneNumber?: string;
  website?: string;
  rating?: number;
  isOpen?: boolean;
}
```

**Google Maps API Integration:**
```typescript
interface GoogleMapsService {
  searchPlaces(query: PlaceSearchQuery): Promise<GoogleMapsPlace[]>;
  getPlaceDetails(placeId: string): Promise<GoogleMapsPlace>;
  validateApiKey(): Promise<boolean>;
}

interface GoogleMapsPlace {
  placeId: string;
  name: string;
  formattedAddress: string;
  geometry: {
    location: { lat: number; lng: number };
  };
  types: string[];
  rating?: number;
  priceLevel?: number;
  businessStatus?: string;
}
```

### 2. Matching Algorithm Engine

**Fuzzy Matching Service:**
```typescript
interface PlaceMatchingService {
  findMatches(originalPlace: Place, targetPlaces: TargetPlace[]): PlaceMatch[];
  calculateConfidenceScore(original: Place, target: TargetPlace): number;
  normalizePlace(place: Place): NormalizedPlace;
}

interface PlaceMatch {
  originalPlace: Place;
  targetPlace: TargetPlace;
  confidenceScore: number; // 0-100
  confidenceLevel: 'high' | 'medium' | 'low';
  matchFactors: MatchFactor[];
}

interface MatchFactor {
  type: 'name' | 'address' | 'distance' | 'category';
  score: number;
  weight: number;
  explanation: string;
}

interface NormalizedPlace {
  normalizedName: string;
  normalizedAddress: string;
  coordinates?: { lat: number; lng: number };
  category?: string;
}
```

**Matching Algorithm Logic:**
```typescript
class FuzzyPlaceMatching {
  calculateNameSimilarity(name1: string, name2: string): number {
    // Levenshtein distance with normalization
    // Handle common variations (St. vs Street, & vs and, etc.)
    // Weight: 40%
  }

  calculateAddressSimilarity(addr1: string, addr2: string): number {
    // Address component matching
    // Handle formatting differences
    // Weight: 30%
  }

  calculateDistanceScore(coord1: Coordinates, coord2: Coordinates): number {
    // Haversine distance calculation
    // Closer = higher score
    // Weight: 20%
  }

  calculateCategoryMatch(cat1: string, cat2: string): number {
    // Category/type matching
    // Weight: 10%
  }
}
```

### 3. Verification Interface Components

**Batch Verification Page:**
```typescript
interface VerificationPageProps {
  transferPack: TransferPack;
  matches: PlaceMatch[];
  onBulkAction: (action: BulkAction, matches: PlaceMatch[]) => void;
  onIndividualAction: (match: PlaceMatch, action: VerificationAction) => void;
}

interface BulkAction {
  type: 'accept_high_confidence' | 'review_medium' | 'flag_low';
  filter?: MatchFilter;
}

interface VerificationAction {
  type: 'accept' | 'reject' | 'manual_search' | 'edit';
  data?: any;
}
```

**Match Comparison Component:**
```typescript
interface MatchComparisonProps {
  match: PlaceMatch;
  onAction: (action: VerificationAction) => void;
  showDetails?: boolean;
}

// Visual layout:
// [Original Place] [Confidence Badge] [Matched Place]
// [Match Factors] [Action Buttons]
```

### 4. Transfer Execution Engine

**Automated Transfer Service:**
```typescript
interface AutomatedTransferService {
  startTransfer(packId: string): Promise<TransferSession>;
  processMatches(session: TransferSession): Promise<MatchResult[]>;
  executeVerifiedTransfers(verifiedMatches: PlaceMatch[]): Promise<TransferResult[]>;
  pauseTransfer(sessionId: string): Promise<void>;
  resumeTransfer(sessionId: string): Promise<TransferSession>;
}

interface TransferSession {
  id: string;
  packId: string;
  status: 'processing' | 'verifying' | 'executing' | 'completed' | 'paused';
  progress: {
    total: number;
    processed: number;
    verified: number;
    completed: number;
  };
  matches: PlaceMatch[];
  startedAt: Date;
  estimatedCompletion?: Date;
}
```

## Data Models

### Enhanced Transfer Pack Models

**Transfer Pack Session:**
```typescript
interface TransferPackSession {
  id: string;
  packId: string;
  status: 'pending' | 'processing' | 'verifying' | 'completed' | 'failed';
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

**Place Match Record:**
```typescript
interface PlaceMatchRecord {
  id: string;
  sessionId: string;
  originalPlaceId: string;
  
  // Matching results
  targetPlaceData: TargetPlace;
  confidenceScore: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  matchFactors: MatchFactor[];
  
  // Verification status
  verificationStatus: 'pending' | 'accepted' | 'rejected' | 'manual';
  verifiedAt?: Date;
  verifiedBy?: 'user' | 'bulk_action';
  
  // Manual override data
  manualSearchQuery?: string;
  manualSelectedPlace?: TargetPlace;
  userNotes?: string;
}
```

### Database Schema Extensions

```sql
-- Transfer pack sessions
CREATE TABLE transfer_pack_sessions (
  id TEXT PRIMARY KEY,
  pack_id TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  
  api_calls_used INTEGER DEFAULT 0,
  processing_time_ms INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  
  total_places INTEGER NOT NULL,
  processed_places INTEGER DEFAULT 0,
  verified_places INTEGER DEFAULT 0,
  completed_places INTEGER DEFAULT 0,
  
  FOREIGN KEY (pack_id) REFERENCES transfer_packs(id)
);

-- Place match records
CREATE TABLE place_match_records (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  original_place_id TEXT NOT NULL,
  
  target_place_data TEXT NOT NULL, -- JSON
  confidence_score INTEGER NOT NULL,
  confidence_level TEXT NOT NULL,
  match_factors TEXT NOT NULL, -- JSON
  
  verification_status TEXT DEFAULT 'pending',
  verified_at DATETIME,
  verified_by TEXT,
  
  manual_search_query TEXT,
  manual_selected_place TEXT, -- JSON
  user_notes TEXT,
  
  FOREIGN KEY (session_id) REFERENCES transfer_pack_sessions(id),
  FOREIGN KEY (original_place_id) REFERENCES places(id)
);

-- API usage tracking
CREATE TABLE api_usage_log (
  id TEXT PRIMARY KEY,
  service TEXT NOT NULL, -- 'apple_maps' | 'google_maps'
  endpoint TEXT NOT NULL,
  session_id TEXT,
  request_data TEXT, -- JSON
  response_status INTEGER,
  response_time_ms INTEGER,
  created_at DATETIME NOT NULL,
  
  FOREIGN KEY (session_id) REFERENCES transfer_pack_sessions(id)
);
```

## User Interface Design

### 1. Enhanced Transfer Pack Start Flow

**Current Flow:**
```
Transfer Pack → Run → Manual place-by-place
```

**New Flow:**
```
Transfer Pack → Choose Mode:
├── Quick Transfer (Automated) → Processing → Verification → Complete
└── Manual Transfer (Original) → Manual place-by-place
```

### 2. Processing Screen

```typescript
interface ProcessingScreenProps {
  session: TransferSession;
  onPause: () => void;
  onCancel: () => void;
}

// Visual elements:
// - Progress bar with current operation
// - Real-time status updates
// - API call counter
// - Estimated time remaining
// - Pause/Cancel options
```

### 3. Verification Interface

**Main Verification Screen:**
```typescript
interface VerificationInterfaceProps {
  session: TransferSession;
  matches: PlaceMatch[];
  filters: MatchFilter[];
  onBulkAction: (action: BulkAction) => void;
}

// Layout:
// [Filter Bar] [Bulk Actions] [Progress Summary]
// [Match List with confidence indicators]
// [Pagination/Virtual scrolling for large lists]
```

**Individual Match Review:**
```typescript
interface MatchReviewProps {
  match: PlaceMatch;
  onAccept: () => void;
  onReject: () => void;
  onManualSearch: () => void;
  onEdit: () => void;
}

// Side-by-side comparison:
// Original Place | Confidence | Matched Place
// [Details] | [Score: 85%] | [Details]
// [Action Buttons]
```

### 4. Bulk Action Dialogs

**Accept High Confidence Matches:**
```
"Accept 23 high-confidence matches (90%+ confidence)?
This will automatically verify these matches and add them to your transfer queue.
You can still review them individually if needed."
[Cancel] [Accept All]
```

## API Integration Strategy

### Rate Limiting and Performance

**Apple Maps API:**
- Rate limit: 25,000 requests/day (typical tier)
- Batch processing: 10 concurrent requests
- Caching: 24-hour cache for place details
- Retry logic: Exponential backoff (1s, 2s, 4s, 8s)

**Google Maps API:**
- Rate limit: 1,000 requests/day (free tier), 100,000/day (paid)
- Batch processing: 5 concurrent requests (free tier)
- Caching: 24-hour cache for place details
- Retry logic: Exponential backoff with jitter

### Error Handling Strategy

```typescript
interface APIErrorHandler {
  handleRateLimit(service: string, retryAfter: number): Promise<void>;
  handleNetworkError(error: NetworkError): Promise<APIResponse>;
  handleInvalidResponse(response: any): APIResponse;
  fallbackToManual(place: Place): ManualSearchPrompt;
}
```

## Performance Optimizations

### 1. Parallel Processing
- Process multiple places simultaneously (respecting API limits)
- Use Web Workers for CPU-intensive matching algorithms
- Implement progressive loading for large transfer packs

### 2. Caching Strategy
- Cache API responses in IndexedDB
- Cache matching results for similar places
- Implement smart cache invalidation

### 3. UI Performance
- Virtual scrolling for large match lists
- Lazy loading of place details
- Optimistic UI updates for user actions

## Error Handling and Edge Cases

### 1. API Failures
- Network timeouts → Retry with exponential backoff
- Rate limiting → Queue requests and show progress
- Invalid API keys → Show configuration error with instructions
- Service outages → Fall back to manual search mode

### 2. Matching Edge Cases
- No matches found → Offer manual search
- Multiple high-confidence matches → Show all options
- Permanently closed places → Mark as "not available"
- Duplicate places → Highlight and allow user choice

### 3. User Experience Edge Cases
- Large transfer packs (500+ places) → Implement pagination and progress saving
- Slow network connections → Show appropriate loading states
- Browser crashes → Restore session from saved progress
- API quota exhaustion → Graceful degradation to manual mode

## Security and Privacy

### 1. API Key Management
- Store API keys server-side (if using backend)
- Use environment variables for configuration
- Implement key rotation capabilities
- Monitor API usage and costs

### 2. Data Privacy
- Minimize data sent to external APIs
- Cache responses locally to reduce API calls
- Allow users to clear cached data
- Respect user preferences for data sharing

### 3. Rate Limiting Protection
- Implement client-side rate limiting
- Show usage quotas to users
- Provide upgrade paths for heavy users
- Implement fair usage policies

## Testing Strategy

### 1. Unit Tests
- Fuzzy matching algorithm accuracy
- API response parsing and error handling
- Confidence score calculations
- Data normalization functions

### 2. Integration Tests
- End-to-end transfer pack processing
- API integration with mock services
- Database operations and caching
- UI component interactions

### 3. Performance Tests
- Large transfer pack processing (100+ places)
- Concurrent API request handling
- Memory usage during batch operations
- UI responsiveness with large datasets

### 4. User Acceptance Tests
- Complete transfer workflow validation
- Bulk operation accuracy
- Manual override functionality
- Error recovery scenarios

## Migration Strategy

### Phase 1: Core Infrastructure
- Implement API integration layer
- Build fuzzy matching algorithm
- Create basic verification interface
- Add database schema extensions

### Phase 2: User Interface
- Build processing and verification screens
- Implement bulk operations
- Add manual search capabilities
- Create progress tracking

### Phase 3: Optimization and Polish
- Add performance optimizations
- Implement advanced caching
- Add comprehensive error handling
- Conduct user testing and refinement

### Phase 4: Advanced Features
- Machine learning improvements to matching
- User feedback integration
- Advanced bulk operations
- Analytics and usage insights