/**
 * Web Worker for Place Matching Operations
 * 
 * Handles CPU-intensive fuzzy matching algorithms in a separate thread
 * to avoid blocking the main UI thread during batch processing.
 */

import type { Place } from '@/types';
import type { NormalizedPlace } from '@/lib/services/api/response-normalizer';
import type { 
  PlaceMatchQuery, 
  MatchingOptions, 
  PlaceMatch, 
  MatchingResult,
  MatchFactor,
  MatchingWeights 
} from '@/lib/services/matching/place-matching';

// Worker message types
export interface WorkerMessage {
  id: string;
  type: 'MATCH_PLACES' | 'CALCULATE_SIMILARITY' | 'BATCH_MATCH';
  payload: any;
}

export interface WorkerResponse {
  id: string;
  type: 'MATCH_RESULT' | 'SIMILARITY_RESULT' | 'BATCH_RESULT' | 'ERROR' | 'PROGRESS';
  payload: any;
  error?: string;
}

export interface BatchMatchRequest {
  queries: PlaceMatchQuery[];
  options?: MatchingOptions;
}

export interface BatchMatchProgress {
  completed: number;
  total: number;
  currentQuery: number;
  processingTimeMs: number;
}

// Default matching options
const DEFAULT_OPTIONS: Required<MatchingOptions> = {
  maxDistance: 1000, // 1km
  minConfidenceScore: 30,
  weights: {
    name: 40,
    address: 30,
    distance: 20,
    category: 10,
  },
  strictMode: false,
};

/**
 * Levenshtein distance calculation for string similarity
 */
function calculateLevenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  const len1 = str1.length;
  const len2 = str2.length;

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,     // deletion
        matrix[i][j - 1] + 1,     // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate string similarity percentage
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  
  const normalized1 = str1.toLowerCase().trim();
  const normalized2 = str2.toLowerCase().trim();
  
  if (normalized1 === normalized2) return 100;
  
  const maxLength = Math.max(normalized1.length, normalized2.length);
  if (maxLength === 0) return 100;
  
  const distance = calculateLevenshteinDistance(normalized1, normalized2);
  return Math.round(((maxLength - distance) / maxLength) * 100);
}

/**
 * Calculate geographic distance using Haversine formula
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Calculate name similarity factor
 */
function calculateNameFactor(originalName: string, candidateName: string, weight: number): MatchFactor {
  const similarity = calculateStringSimilarity(originalName, candidateName);
  
  return {
    type: 'name',
    score: similarity,
    weight,
    weightedScore: (similarity * weight) / 100,
    explanation: `Name similarity: ${similarity}% (${originalName} vs ${candidateName})`,
  };
}

/**
 * Calculate address similarity factor
 */
function calculateAddressFactor(originalAddress: string, candidateAddress: string, weight: number): MatchFactor {
  const similarity = calculateStringSimilarity(originalAddress, candidateAddress);
  
  return {
    type: 'address',
    score: similarity,
    weight,
    weightedScore: (similarity * weight) / 100,
    explanation: `Address similarity: ${similarity}% (${originalAddress} vs ${candidateAddress})`,
  };
}

/**
 * Calculate distance factor
 */
function calculateDistanceFactor(
  originalLat: number, 
  originalLng: number, 
  candidateLat: number, 
  candidateLng: number, 
  weight: number,
  maxDistance: number
): MatchFactor {
  const distance = calculateDistance(originalLat, originalLng, candidateLat, candidateLng);
  const score = Math.max(0, Math.round(((maxDistance - distance) / maxDistance) * 100));
  
  return {
    type: 'distance',
    score,
    weight,
    weightedScore: (score * weight) / 100,
    explanation: `Distance: ${Math.round(distance)}m (score: ${score}%)`,
  };
}

/**
 * Calculate category similarity factor
 */
function calculateCategoryFactor(originalTypes: string[], candidateTypes: string[], weight: number): MatchFactor {
  if (!originalTypes?.length || !candidateTypes?.length) {
    return {
      type: 'category',
      score: 50, // Neutral score when categories are missing
      weight,
      weightedScore: (50 * weight) / 100,
      explanation: 'Category information not available',
    };
  }

  // Find common categories
  const commonCategories = originalTypes.filter(type => 
    candidateTypes.some(candidateType => 
      candidateType.toLowerCase().includes(type.toLowerCase()) ||
      type.toLowerCase().includes(candidateType.toLowerCase())
    )
  );

  const similarity = commonCategories.length > 0 ? 
    Math.round((commonCategories.length / Math.max(originalTypes.length, candidateTypes.length)) * 100) : 0;

  return {
    type: 'category',
    score: similarity,
    weight,
    weightedScore: (similarity * weight) / 100,
    explanation: `Category match: ${commonCategories.length} common categories (${similarity}%)`,
  };
}

/**
 * Calculate match between original place and candidate
 */
function calculateMatch(originalPlace: Place, candidate: NormalizedPlace, options: Required<MatchingOptions>): PlaceMatch {
  const factors: MatchFactor[] = [];

  // Name similarity
  factors.push(calculateNameFactor(originalPlace.title, candidate.name, options.weights.name));

  // Address similarity
  if (originalPlace.address && candidate.address) {
    factors.push(calculateAddressFactor(originalPlace.address, candidate.address, options.weights.address));
  }

  // Distance similarity (if coordinates available)
  if (originalPlace.latitude && originalPlace.longitude && candidate.latitude && candidate.longitude) {
    factors.push(calculateDistanceFactor(
      originalPlace.latitude,
      originalPlace.longitude,
      candidate.latitude,
      candidate.longitude,
      options.weights.distance,
      options.maxDistance
    ));
  }

  // Category similarity
  const originalTypes = originalPlace.tags || [];
  const candidateTypes = candidate.types || [];
  factors.push(calculateCategoryFactor(originalTypes, candidateTypes, options.weights.category));

  // Calculate overall confidence score
  const totalWeightedScore = factors.reduce((sum, factor) => sum + factor.weightedScore, 0);
  const totalWeight = factors.reduce((sum, factor) => sum + factor.weight, 0);
  const confidenceScore = totalWeight > 0 ? Math.round(totalWeightedScore) : 0;

  // Determine confidence level
  const confidenceLevel = confidenceScore >= 90 ? 'high' : 
                         confidenceScore >= 70 ? 'medium' : 'low';

  return {
    originalPlace,
    candidatePlace: candidate,
    confidenceScore,
    confidenceLevel,
    matchFactors: factors,
    rank: 0, // Will be set later when sorting
    calibrationInfo: {
      rawScore: confidenceScore,
      calibratedScore: confidenceScore,
      calibrationFactors: [],
      qualityIndicators: {
        dataCompleteness: 100,
        matchConsistency: 100,
        geographicReliability: originalPlace.latitude && originalPlace.longitude ? 100 : 50,
      },
    },
    debugSummary: {
      totalProcessingTimeMs: 0,
      factorContributions: factors.map((factor) => ({
        factor: factor.type,
        contribution: Math.round((factor.weightedScore / (confidenceScore || 1)) * 100),
        reliability: factor.score >= 75 ? 'high' : factor.score >= 40 ? 'medium' : 'low',
      })),
      potentialIssues: [],
      recommendations: [],
    },
  };
}

/**
 * Process a single matching query
 */
function processMatchQuery(query: PlaceMatchQuery): MatchingResult {
  const startTime = Date.now();
  const options = { ...DEFAULT_OPTIONS, ...query.options };

  // Calculate matches for each candidate
  const matches: PlaceMatch[] = [];
  
  for (const candidate of query.candidatePlaces) {
    const match = calculateMatch(query.originalPlace, candidate, options);
    
    // Only include matches that meet minimum confidence threshold
    if (match.confidenceScore >= options.minConfidenceScore) {
      matches.push(match);
    }
  }

  // Sort matches by confidence score (highest first)
  matches.sort((a, b) => b.confidenceScore - a.confidenceScore);

  // Assign rankings
  matches.forEach((match, index) => {
    match.rank = index + 1;
  });

  const processingTime = Date.now() - startTime;
  const bestMatch = matches.length > 0 ? matches[0] : undefined;
  const averageConfidence = matches.length > 0 
    ? matches.reduce((sum, match) => sum + match.confidenceScore, 0) / matches.length 
    : 0;

  return {
    query,
    matches,
    bestMatch,
    processingTimeMs: processingTime,
    metadata: {
      totalCandidates: query.candidatePlaces.length,
      validMatches: matches.length,
      averageConfidence: Math.round(averageConfidence),
      cached: false,
    },
  };
}

/**
 * Process batch matching queries with progress reporting
 */
function processBatchMatch(request: BatchMatchRequest, messageId: string): void {
  const startTime = Date.now();
  const results: MatchingResult[] = [];
  const total = request.queries.length;

  for (let i = 0; i < request.queries.length; i++) {
    const query = request.queries[i];
    const result = processMatchQuery(query);
    results.push(result);

    // Send progress update
    const progress: BatchMatchProgress = {
      completed: i + 1,
      total,
      currentQuery: i + 1,
      processingTimeMs: Date.now() - startTime,
    };

    self.postMessage({
      id: messageId,
      type: 'PROGRESS',
      payload: progress,
    } as WorkerResponse);
  }

  // Send final result
  self.postMessage({
    id: messageId,
    type: 'BATCH_RESULT',
    payload: {
      results,
      totalProcessingTime: Date.now() - startTime,
      totalQueries: total,
    },
  } as WorkerResponse);
}

// Worker message handler
self.onmessage = function(event: MessageEvent<WorkerMessage>) {
  const { id, type, payload } = event.data;

  try {
    switch (type) {
      case 'MATCH_PLACES':
        const result = processMatchQuery(payload as PlaceMatchQuery);
        self.postMessage({
          id,
          type: 'MATCH_RESULT',
          payload: result,
        } as WorkerResponse);
        break;

      case 'CALCULATE_SIMILARITY':
        const { str1, str2 } = payload;
        const similarity = calculateStringSimilarity(str1, str2);
        self.postMessage({
          id,
          type: 'SIMILARITY_RESULT',
          payload: similarity,
        } as WorkerResponse);
        break;

      case 'BATCH_MATCH':
        processBatchMatch(payload as BatchMatchRequest, id);
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    self.postMessage({
      id,
      type: 'ERROR',
      payload: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    } as WorkerResponse);
  }
};

// Export types for TypeScript (avoid conflicts)
