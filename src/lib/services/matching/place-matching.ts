/**
 * Core place matching algorithm implementation
 * 
 * This service implements intelligent place matching between different mapping services
 * using fuzzy string matching, geographic distance, and weighted scoring.
 */

import { matchResultCache } from '../intelligent-cache';
import type { Place } from '@/types';
import type { NormalizedPlace } from '../api/response-normalizer';

export interface PlaceMatchQuery {
  originalPlace: Place;
  candidatePlaces: NormalizedPlace[];
  options?: MatchingOptions;
}

export interface MatchingOptions {
  maxDistance?: number; // Maximum distance in meters for geographic matching
  minConfidenceScore?: number; // Minimum confidence score to consider a match
  weights?: MatchingWeights; // Custom weights for different matching factors
  strictMode?: boolean; // Enable strict matching criteria
}

export interface MatchingWeights {
  name: number; // Weight for name similarity (default: 40)
  address: number; // Weight for address similarity (default: 30)
  distance: number; // Weight for geographic distance (default: 20)
  category: number; // Weight for category matching (default: 10)
}

export interface MatchFactor {
  type: 'name' | 'address' | 'distance' | 'category';
  score: number; // 0-100 score for this factor
  weight: number; // Weight applied to this factor
  weightedScore: number; // Score after applying weight
  explanation: string; // Human-readable explanation
  details?: any; // Additional details for debugging
  debugInfo?: MatchFactorDebugInfo; // Detailed debugging information
}

export interface MatchFactorDebugInfo {
  rawInputs: {
    original: string | number | object;
    candidate: string | number | object;
  };
  normalizedInputs?: {
    original: string | number | object;
    candidate: string | number | object;
  };
  calculationSteps: Array<{
    step: string;
    value: number | string;
    description: string;
  }>;
  bonuses?: Array<{
    type: string;
    value: number;
    reason: string;
  }>;
  penalties?: Array<{
    type: string;
    value: number;
    reason: string;
  }>;
}

export interface PlaceMatch {
  originalPlace: Place;
  candidatePlace: NormalizedPlace;
  confidenceScore: number; // Overall confidence score (0-100)
  confidenceLevel: 'high' | 'medium' | 'low';
  matchFactors: MatchFactor[];
  rank: number; // Ranking among all candidates (1 = best match)
  calibrationInfo: ConfidenceCalibrationInfo; // Score calibration details
  debugSummary: MatchDebugSummary; // Debugging summary
}

export interface ConfidenceCalibrationInfo {
  rawScore: number; // Score before calibration
  calibratedScore: number; // Score after calibration
  calibrationFactors: Array<{
    factor: string;
    adjustment: number;
    reason: string;
  }>;
  qualityIndicators: {
    dataCompleteness: number; // 0-100, how complete the data is
    matchConsistency: number; // 0-100, how consistent factors are
    geographicReliability: number; // 0-100, reliability of location data
  };
}

export interface MatchDebugSummary {
  totalProcessingTimeMs: number;
  factorContributions: Array<{
    factor: 'name' | 'address' | 'distance' | 'category';
    contribution: number; // Percentage contribution to final score
    reliability: 'high' | 'medium' | 'low';
  }>;
  potentialIssues: string[];
  recommendations: string[];
}

export interface MatchingResult {
  query: PlaceMatchQuery;
  matches: PlaceMatch[];
  bestMatch?: PlaceMatch;
  processingTimeMs: number;
  metadata: {
    totalCandidates: number;
    validMatches: number;
    averageConfidence: number;
  };
}

const DEFAULT_WEIGHTS: MatchingWeights = {
  name: 40,
  address: 30,
  distance: 20,
  category: 10,
};

const DEFAULT_OPTIONS: Required<MatchingOptions> = {
  maxDistance: 5000, // 5km
  minConfidenceScore: 30,
  weights: DEFAULT_WEIGHTS,
  strictMode: false,
};

export class PlaceMatchingService {
  private options: Required<MatchingOptions>;

  constructor(options?: MatchingOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    
    // Normalize weights to ensure they sum to 100
    const totalWeight = Object.values(this.options.weights).reduce((sum, weight) => sum + weight, 0);
    if (totalWeight !== 100) {
      const factor = 100 / totalWeight;
      this.options.weights = {
        name: this.options.weights.name * factor,
        address: this.options.weights.address * factor,
        distance: this.options.weights.distance * factor,
        category: this.options.weights.category * factor,
      };
    }
  }

  /**
   * Find matches for a single place (simplified interface for property tests)
   */
  findMatches(originalPlace: Place, candidatePlaces: NormalizedPlace[]): PlaceMatch[] {
    const query: PlaceMatchQuery = {
      originalPlace,
      candidatePlaces,
    };

    // Use synchronous version for property tests
    const normalizedOriginal = this.normalizeOriginalPlace(originalPlace);
    const matches: PlaceMatch[] = [];

    for (const candidate of candidatePlaces) {
      const match = this.calculateMatchSync(normalizedOriginal, candidate, this.options);
      
      if (match.confidenceScore >= this.options.minConfidenceScore) {
        matches.push(match);
      }
    }

    // Sort by confidence score
    matches.sort((a, b) => b.confidenceScore - a.confidenceScore);
    
    // Assign rankings
    matches.forEach((match, index) => {
      match.rank = index + 1;
    });

    return matches;
  }

  /**
   * Calculate confidence score for a potential match (public interface for tests)
   */
  calculateConfidenceScore(original: Place, target: NormalizedPlace): number {
    const normalizedOriginal = this.normalizeOriginalPlace(original);
    const match = this.calculateMatchSync(normalizedOriginal, target, this.options);
    return match.confidenceScore;
  }

  /**
   * Get confidence level based on score (public interface for tests)
   */
  getConfidenceLevel(score: number): 'high' | 'medium' | 'low' {
    return this.determineConfidenceLevel(score);
  }

  /**
   * Calculate name similarity (public interface for tests)
   */
  calculateNameSimilarity(name1: string, name2: string): number {
    const nameMatch = this.calculateNameMatch(name1, name2);
    return nameMatch.score;
  }

  /**
   * Find the best matches for a place among candidates (async version)
   */
  async findMatchesAsync(query: PlaceMatchQuery): Promise<MatchingResult> {
    const startTime = Date.now();
    const options = { ...this.options, ...query.options };

    // Generate cache key for this matching query
    const placeKey = matchResultCache.generatePlaceKey(
      query.originalPlace.title,
      query.originalPlace.address,
      query.originalPlace.latitude,
      query.originalPlace.longitude
    );

    // Check cache first
    const cachedMatches = await matchResultCache.getCachedMatchResult(placeKey);
    if (cachedMatches) {
      return {
        query,
        matches: cachedMatches,
        bestMatch: cachedMatches.length > 0 ? cachedMatches[0] : undefined,
        processingTimeMs: Date.now() - startTime,
        metadata: {
          totalCandidates: query.candidatePlaces.length,
          validMatches: cachedMatches.length,
          averageConfidence: cachedMatches.length > 0 
            ? Math.round(cachedMatches.reduce((sum, match) => sum + match.confidenceScore, 0) / cachedMatches.length)
            : 0,
          options,
          cached: true,
        },
      };
    }

    // Normalize the original place data
    const normalizedOriginal = this.normalizeOriginalPlace(query.originalPlace);

    // Calculate matches for each candidate
    const matches: PlaceMatch[] = [];
    
    for (const candidate of query.candidatePlaces) {
      const match = await this.calculateMatch(normalizedOriginal, candidate, options);
      
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

    // Cache the results for future use
    if (matches.length > 0) {
      await matchResultCache.cacheMatchResult(placeKey, matches);
    }

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
        options,
        cached: false,
      },
    };
  }
      },
    };
  }

  /**
   * Calculate match score between original place and candidate (synchronous version)
   */
  private calculateMatchSync(
    originalPlace: NormalizedOriginalPlace,
    candidatePlace: NormalizedPlace,
    options: Required<MatchingOptions>
  ): PlaceMatch {
    const matchStartTime = Date.now();
    const matchFactors: MatchFactor[] = [];

    // 1. Name matching
    const nameMatch = this.calculateNameMatch(originalPlace.name, candidatePlace.name);
    const nameWeightedScore = (nameMatch.score * options.weights.name) / 100;
    matchFactors.push({
      type: 'name',
      score: nameMatch.score,
      weight: options.weights.name,
      weightedScore: nameWeightedScore,
      explanation: nameMatch.explanation,
      details: nameMatch.details,
      debugInfo: nameMatch.debugInfo,
    });

    // 2. Address matching
    const addressMatch = this.calculateAddressMatch(originalPlace.address, candidatePlace.address);
    const addressWeightedScore = (addressMatch.score * options.weights.address) / 100;
    matchFactors.push({
      type: 'address',
      score: addressMatch.score,
      weight: options.weights.address,
      weightedScore: addressWeightedScore,
      explanation: addressMatch.explanation,
      details: addressMatch.details,
      debugInfo: addressMatch.debugInfo,
    });

    // 3. Distance matching (if coordinates available)
    let distanceMatch: MatchFactorResult;
    if (originalPlace.coordinates && candidatePlace.latitude && candidatePlace.longitude) {
      distanceMatch = this.calculateDistanceMatch(
        originalPlace.coordinates,
        { latitude: candidatePlace.latitude, longitude: candidatePlace.longitude },
        options.maxDistance
      );
    } else {
      distanceMatch = {
        score: 0,
        explanation: 'No coordinates available for distance calculation',
        details: { hasOriginalCoords: !!originalPlace.coordinates, hasCandidateCoords: !!(candidatePlace.latitude && candidatePlace.longitude) },
        debugInfo: {
          rawInputs: {
            original: originalPlace.coordinates || 'none',
            candidate: candidatePlace.latitude && candidatePlace.longitude 
              ? { lat: candidatePlace.latitude, lng: candidatePlace.longitude }
              : 'none'
          },
          calculationSteps: [
            { step: 'coordinate_check', value: 0, description: 'Missing coordinate data' }
          ]
        }
      };
    }
    
    const distanceWeightedScore = (distanceMatch.score * options.weights.distance) / 100;
    matchFactors.push({
      type: 'distance',
      score: distanceMatch.score,
      weight: options.weights.distance,
      weightedScore: distanceWeightedScore,
      explanation: distanceMatch.explanation,
      details: distanceMatch.details,
      debugInfo: distanceMatch.debugInfo,
    });

    // 4. Category matching
    const categoryMatch = this.calculateCategoryMatch(originalPlace.category, candidatePlace.category);
    const categoryWeightedScore = (categoryMatch.score * options.weights.category) / 100;
    matchFactors.push({
      type: 'category',
      score: categoryMatch.score,
      weight: options.weights.category,
      weightedScore: categoryWeightedScore,
      explanation: categoryMatch.explanation,
      details: categoryMatch.details,
      debugInfo: categoryMatch.debugInfo,
    });

    // Calculate raw weighted confidence score
    const rawConfidenceScore = matchFactors.reduce((sum, factor) => sum + factor.weightedScore, 0);

    // Apply score calibration
    const calibrationResult = this.calibrateConfidenceScore(rawConfidenceScore, matchFactors, originalPlace, candidatePlace);
    const finalConfidenceScore = calibrationResult.calibratedScore;
    const confidenceLevel = this.determineConfidenceLevel(finalConfidenceScore);

    // Generate debug summary
    const processingTime = Date.now() - matchStartTime;
    const debugSummary = this.generateDebugSummary(matchFactors, calibrationResult, processingTime);

    return {
      originalPlace: originalPlace.original,
      candidatePlace,
      confidenceScore: finalConfidenceScore,
      confidenceLevel,
      matchFactors,
      rank: 0, // Will be set later during sorting
      calibrationInfo: calibrationResult,
      debugSummary,
    };
  }

  /**
   * Calculate match score between original place and candidate (async version)
   */
  private async calculateMatch(
    originalPlace: NormalizedOriginalPlace,
    candidatePlace: NormalizedPlace,
    options: Required<MatchingOptions>
  ): Promise<PlaceMatch> {
    return this.calculateMatchSync(originalPlace, candidatePlace, options);
  }

  /**
   * Calculate name similarity using fuzzy string matching
   */
  private calculateNameMatch(originalName: string, candidateName: string): MatchFactorResult {
    const calculationSteps: Array<{ step: string; value: number | string; description: string }> = [];
    const bonuses: Array<{ type: string; value: number; reason: string }> = [];

    if (!originalName || !candidateName) {
      return {
        score: 0,
        explanation: 'Missing name data',
        details: { originalName, candidateName },
        debugInfo: {
          rawInputs: { original: originalName || 'null', candidate: candidateName || 'null' },
          calculationSteps: [
            { step: 'validation', value: 0, description: 'Missing name data - cannot calculate similarity' }
          ]
        }
      };
    }

    // Normalize names for comparison
    const normalizedOriginal = this.normalizeName(originalName);
    const normalizedCandidate = this.normalizeName(candidateName);
    
    calculationSteps.push({
      step: 'normalization',
      value: `"${normalizedOriginal}" vs "${normalizedCandidate}"`,
      description: 'Names normalized for comparison'
    });

    // Exact match gets full score
    if (normalizedOriginal === normalizedCandidate) {
      calculationSteps.push({
        step: 'exact_match',
        value: 100,
        description: 'Perfect match after normalization'
      });

      return {
        score: 100,
        explanation: 'Exact name match',
        details: { normalizedOriginal, normalizedCandidate, distance: 0 },
        debugInfo: {
          rawInputs: { original: originalName, candidate: candidateName },
          normalizedInputs: { original: normalizedOriginal, candidate: normalizedCandidate },
          calculationSteps,
          bonuses
        }
      };
    }

    // Calculate Levenshtein distance
    const distance = this.levenshteinDistance(normalizedOriginal, normalizedCandidate);
    const maxLength = Math.max(normalizedOriginal.length, normalizedCandidate.length);
    
    calculationSteps.push({
      step: 'levenshtein_distance',
      value: distance,
      description: `Edit distance between normalized names (max length: ${maxLength})`
    });
    
    if (maxLength === 0) {
      calculationSteps.push({
        step: 'empty_names',
        value: 0,
        description: 'Both names are empty after normalization'
      });

      return {
        score: 0,
        explanation: 'Empty names',
        details: { normalizedOriginal, normalizedCandidate },
        debugInfo: {
          rawInputs: { original: originalName, candidate: candidateName },
          normalizedInputs: { original: normalizedOriginal, candidate: normalizedCandidate },
          calculationSteps
        }
      };
    }

    // Convert distance to similarity score
    const similarity = Math.max(0, Math.round(((maxLength - distance) / maxLength) * 100));
    calculationSteps.push({
      step: 'similarity_calculation',
      value: similarity,
      description: `Base similarity: (${maxLength} - ${distance}) / ${maxLength} * 100`
    });

    // Apply bonus for partial matches
    let bonus = 0;
    if (normalizedOriginal.includes(normalizedCandidate) || normalizedCandidate.includes(normalizedOriginal)) {
      bonus = 10;
      bonuses.push({
        type: 'partial_match',
        value: 10,
        reason: 'One name contains the other'
      });
    }

    // Check for common word matches
    const originalWords = normalizedOriginal.split(/\s+/);
    const candidateWords = normalizedCandidate.split(/\s+/);
    const commonWords = originalWords.filter(word => 
      word.length > 2 && candidateWords.some(cWord => cWord.includes(word) || word.includes(cWord))
    );
    
    if (commonWords.length > 0) {
      const wordBonus = Math.min(20, commonWords.length * 5);
      bonus += wordBonus;
      bonuses.push({
        type: 'common_words',
        value: wordBonus,
        reason: `${commonWords.length} common words found: ${commonWords.join(', ')}`
      });
    }

    const finalScore = Math.min(100, similarity + bonus);
    calculationSteps.push({
      step: 'final_score',
      value: finalScore,
      description: `Final score: ${similarity} + ${bonus} (capped at 100)`
    });

    return {
      score: finalScore,
      explanation: `Name similarity: ${similarity}% (distance: ${distance}, bonus: ${bonus})`,
      details: {
        normalizedOriginal,
        normalizedCandidate,
        distance,
        similarity,
        bonus,
        commonWords,
      },
      debugInfo: {
        rawInputs: { original: originalName, candidate: candidateName },
        normalizedInputs: { original: normalizedOriginal, candidate: normalizedCandidate },
        calculationSteps,
        bonuses
      }
    };
  }

  /**
   * Calculate address similarity with component matching
   */
  private calculateAddressMatch(originalAddress: string, candidateAddress: string): MatchFactorResult {
    const calculationSteps: Array<{ step: string; value: number | string; description: string }> = [];
    const bonuses: Array<{ type: string; value: number; reason: string }> = [];

    if (!originalAddress || !candidateAddress) {
      return {
        score: 0,
        explanation: 'Missing address data',
        details: { originalAddress, candidateAddress },
        debugInfo: {
          rawInputs: { original: originalAddress || 'null', candidate: candidateAddress || 'null' },
          calculationSteps: [
            { step: 'validation', value: 0, description: 'Missing address data - cannot calculate similarity' }
          ]
        }
      };
    }

    // Normalize addresses
    const normalizedOriginal = this.normalizeAddress(originalAddress);
    const normalizedCandidate = this.normalizeAddress(candidateAddress);

    calculationSteps.push({
      step: 'normalization',
      value: `"${normalizedOriginal}" vs "${normalizedCandidate}"`,
      description: 'Addresses normalized for comparison'
    });

    // Exact match gets full score
    if (normalizedOriginal === normalizedCandidate) {
      calculationSteps.push({
        step: 'exact_match',
        value: 100,
        description: 'Perfect match after normalization'
      });

      return {
        score: 100,
        explanation: 'Exact address match',
        details: { normalizedOriginal, normalizedCandidate },
        debugInfo: {
          rawInputs: { original: originalAddress, candidate: candidateAddress },
          normalizedInputs: { original: normalizedOriginal, candidate: normalizedCandidate },
          calculationSteps,
          bonuses
        }
      };
    }

    // Extract address components
    const originalComponents = this.extractAddressComponents(normalizedOriginal);
    const candidateComponents = this.extractAddressComponents(normalizedCandidate);

    calculationSteps.push({
      step: 'component_extraction',
      value: JSON.stringify({ original: originalComponents, candidate: candidateComponents }),
      description: 'Address components extracted for detailed matching'
    });

    // Calculate component-wise similarity
    let totalScore = 0;
    let componentCount = 0;
    const componentScores: Record<string, number> = {};

    // Street number matching (high weight)
    if (originalComponents.streetNumber && candidateComponents.streetNumber) {
      const streetNumberScore = originalComponents.streetNumber === candidateComponents.streetNumber ? 100 : 0;
      componentScores.streetNumber = streetNumberScore;
      totalScore += streetNumberScore * 0.3;
      componentCount += 0.3;
      
      calculationSteps.push({
        step: 'street_number_match',
        value: streetNumberScore,
        description: `Street number: "${originalComponents.streetNumber}" vs "${candidateComponents.streetNumber}" (weight: 30%)`
      });
    }

    // Street name matching (high weight)
    if (originalComponents.streetName && candidateComponents.streetName) {
      const streetNameScore = this.calculateStringSimilarity(
        originalComponents.streetName,
        candidateComponents.streetName
      );
      componentScores.streetName = streetNameScore;
      totalScore += streetNameScore * 0.4;
      componentCount += 0.4;
      
      calculationSteps.push({
        step: 'street_name_match',
        value: streetNameScore,
        description: `Street name: "${originalComponents.streetName}" vs "${candidateComponents.streetName}" (weight: 40%)`
      });
    }

    // City matching (medium weight)
    if (originalComponents.city && candidateComponents.city) {
      const cityScore = this.calculateStringSimilarity(
        originalComponents.city,
        candidateComponents.city
      );
      componentScores.city = cityScore;
      totalScore += cityScore * 0.2;
      componentCount += 0.2;
      
      calculationSteps.push({
        step: 'city_match',
        value: cityScore,
        description: `City: "${originalComponents.city}" vs "${candidateComponents.city}" (weight: 20%)`
      });
    }

    // Postal code matching (low weight but high accuracy)
    if (originalComponents.postalCode && candidateComponents.postalCode) {
      const postalScore = originalComponents.postalCode === candidateComponents.postalCode ? 100 : 0;
      componentScores.postalCode = postalScore;
      totalScore += postalScore * 0.1;
      componentCount += 0.1;
      
      calculationSteps.push({
        step: 'postal_code_match',
        value: postalScore,
        description: `Postal code: "${originalComponents.postalCode}" vs "${candidateComponents.postalCode}" (weight: 10%)`
      });
    }

    // If no components matched, fall back to full string similarity
    if (componentCount === 0) {
      const fullStringSimilarity = this.calculateStringSimilarity(normalizedOriginal, normalizedCandidate);
      
      calculationSteps.push({
        step: 'fallback_full_string',
        value: fullStringSimilarity,
        description: 'No address components matched - using full string similarity'
      });

      return {
        score: fullStringSimilarity,
        explanation: `Full address similarity: ${fullStringSimilarity}%`,
        details: {
          normalizedOriginal,
          normalizedCandidate,
          method: 'full_string',
          similarity: fullStringSimilarity,
        },
        debugInfo: {
          rawInputs: { original: originalAddress, candidate: candidateAddress },
          normalizedInputs: { original: normalizedOriginal, candidate: normalizedCandidate },
          calculationSteps,
          bonuses
        }
      };
    }

    const finalScore = Math.round(totalScore / componentCount);
    
    calculationSteps.push({
      step: 'weighted_average',
      value: finalScore,
      description: `Weighted average: ${totalScore.toFixed(2)} / ${componentCount.toFixed(2)} = ${finalScore}`
    });

    return {
      score: finalScore,
      explanation: `Address component matching: ${finalScore}%`,
      details: {
        normalizedOriginal,
        normalizedCandidate,
        originalComponents,
        candidateComponents,
        componentScores,
        method: 'component_based',
      },
      debugInfo: {
        rawInputs: { original: originalAddress, candidate: candidateAddress },
        normalizedInputs: { original: normalizedOriginal, candidate: normalizedCandidate },
        calculationSteps,
        bonuses
      }
    };
  }

  /**
   * Calculate geographic distance match using Haversine formula
   */
  private calculateDistanceMatch(
    originalCoords: { latitude: number; longitude: number },
    candidateCoords: { latitude: number; longitude: number },
    maxDistance: number
  ): MatchFactorResult {
    const calculationSteps: Array<{ step: string; value: number | string; description: string }> = [];

    const distance = this.calculateHaversineDistance(
      originalCoords.latitude,
      originalCoords.longitude,
      candidateCoords.latitude,
      candidateCoords.longitude
    );

    calculationSteps.push({
      step: 'haversine_calculation',
      value: Math.round(distance),
      description: `Distance calculated using Haversine formula: ${Math.round(distance)}m`
    });

    // Convert distance to score (closer = higher score)
    let score: number;
    let scoreReason: string;

    if (distance <= 50) {
      // Within 50m = perfect score
      score = 100;
      scoreReason = 'Within 50m threshold - perfect score';
    } else if (distance <= maxDistance) {
      // Linear decay from 95 to 5 over maxDistance (keeping some minimum score)
      const decayRange = maxDistance - 50;
      const distanceInRange = distance - 50;
      score = Math.max(5, Math.round(95 - (distanceInRange / decayRange) * 90));
      scoreReason = `Linear decay from 95 to 5 over ${maxDistance}m range`;
    } else {
      // Beyond maxDistance = 0 score
      score = 0;
      scoreReason = `Beyond maximum distance threshold of ${maxDistance}m`;
    }

    calculationSteps.push({
      step: 'score_calculation',
      value: score,
      description: scoreReason
    });

    let explanation: string;
    if (distance < 50) {
      explanation = `Very close match (${Math.round(distance)}m)`;
    } else if (distance < 500) {
      explanation = `Close match (${Math.round(distance)}m)`;
    } else if (distance < 2000) {
      explanation = `Moderate distance (${(distance / 1000).toFixed(1)}km)`;
    } else {
      explanation = `Far distance (${(distance / 1000).toFixed(1)}km)`;
    }

    return {
      score,
      explanation,
      details: {
        distanceMeters: Math.round(distance),
        distanceKm: Math.round(distance / 1000 * 100) / 100,
        originalCoords,
        candidateCoords,
        maxDistance,
      },
      debugInfo: {
        rawInputs: {
          original: originalCoords,
          candidate: candidateCoords
        },
        calculationSteps
      }
    };
  }

  /**
   * Calculate category/type matching
   */
  private calculateCategoryMatch(originalCategory?: string, candidateCategory?: string): MatchFactorResult {
    const calculationSteps: Array<{ step: string; value: number | string; description: string }> = [];

    if (!originalCategory && !candidateCategory) {
      calculationSteps.push({
        step: 'both_missing',
        value: 50,
        description: 'Both categories missing - neutral score'
      });

      return {
        score: 50, // Neutral score when both are missing
        explanation: 'No category information available',
        details: { originalCategory, candidateCategory },
        debugInfo: {
          rawInputs: { original: 'none', candidate: 'none' },
          calculationSteps
        }
      };
    }

    if (!originalCategory || !candidateCategory) {
      calculationSteps.push({
        step: 'one_missing',
        value: 25,
        description: 'One category missing - low confidence score'
      });

      return {
        score: 25, // Low score when one is missing
        explanation: 'Partial category information',
        details: { originalCategory, candidateCategory },
        debugInfo: {
          rawInputs: { original: originalCategory || 'none', candidate: candidateCategory || 'none' },
          calculationSteps
        }
      };
    }

    // Normalize categories
    const normalizedOriginal = this.normalizeCategory(originalCategory);
    const normalizedCandidate = this.normalizeCategory(candidateCategory);

    calculationSteps.push({
      step: 'normalization',
      value: `"${normalizedOriginal}" vs "${normalizedCandidate}"`,
      description: 'Categories normalized using category mapping'
    });

    // Exact match
    if (normalizedOriginal === normalizedCandidate) {
      calculationSteps.push({
        step: 'exact_match',
        value: 100,
        description: 'Perfect category match after normalization'
      });

      return {
        score: 100,
        explanation: 'Exact category match',
        details: { normalizedOriginal, normalizedCandidate },
        debugInfo: {
          rawInputs: { original: originalCategory, candidate: candidateCategory },
          normalizedInputs: { original: normalizedOriginal, candidate: normalizedCandidate },
          calculationSteps
        }
      };
    }

    // Check for related categories
    const relatedScore = this.calculateCategoryRelation(normalizedOriginal, normalizedCandidate);
    
    calculationSteps.push({
      step: 'relation_check',
      value: relatedScore,
      description: relatedScore > 0 
        ? `Categories are related (${normalizedOriginal} <-> ${normalizedCandidate})`
        : 'Categories are not related'
    });
    
    return {
      score: relatedScore,
      explanation: relatedScore > 50 ? 'Related category match' : 'Different categories',
      details: {
        originalCategory,
        candidateCategory,
        normalizedOriginal,
        normalizedCandidate,
        relatedScore,
      },
      debugInfo: {
        rawInputs: { original: originalCategory, candidate: candidateCategory },
        normalizedInputs: { original: normalizedOriginal, candidate: normalizedCandidate },
        calculationSteps
      }
    };
  }

  /**
   * Calculate weighted confidence score from match factors
   */
  private calculateWeightedScore(matchFactors: MatchFactor[]): number {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const factor of matchFactors) {
      weightedSum += factor.score * (factor.weight / 100);
      totalWeight += factor.weight / 100;
    }

    return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
  }

  /**
   * Calibrate confidence score based on match quality indicators
   */
  private calibrateConfidenceScore(
    rawScore: number,
    matchFactors: MatchFactor[],
    originalPlace: NormalizedOriginalPlace,
    candidatePlace: NormalizedPlace
  ): ConfidenceCalibrationInfo {
    const calibrationFactors: Array<{ factor: string; adjustment: number; reason: string }> = [];
    let adjustedScore = rawScore;

    // Calculate quality indicators
    const qualityIndicators = this.calculateQualityIndicators(originalPlace, candidatePlace, matchFactors);

    // 1. Data completeness adjustment (very conservative)
    if (qualityIndicators.dataCompleteness < 20) {
      const penalty = Math.round((20 - qualityIndicators.dataCompleteness) * 0.15);
      adjustedScore -= penalty;
      calibrationFactors.push({
        factor: 'data_completeness',
        adjustment: -penalty,
        reason: `Extremely incomplete data reduces confidence (${qualityIndicators.dataCompleteness}% complete)`
      });
    }

    // 2. Match consistency adjustment (very conservative)
    const factorVariance = this.calculateFactorVariance(matchFactors);
    if (factorVariance > 50) {
      const penalty = Math.round((factorVariance - 50) * 0.1);
      adjustedScore -= penalty;
      calibrationFactors.push({
        factor: 'match_consistency',
        adjustment: -penalty,
        reason: `Extremely high variance between match factors (${factorVariance.toFixed(1)})`
      });
    } else if (factorVariance < 3 && rawScore > 85) {
      const bonus = Math.round((3 - factorVariance) * 0.1);
      adjustedScore += bonus;
      calibrationFactors.push({
        factor: 'match_consistency',
        adjustment: bonus,
        reason: `Extremely consistent match factors boost confidence (${factorVariance.toFixed(1)} variance)`
      });
    }

    // 3. Geographic reliability adjustment (very conservative)
    if (qualityIndicators.geographicReliability < 10) {
      const penalty = Math.round((10 - qualityIndicators.geographicReliability) * 0.2);
      adjustedScore -= penalty;
      calibrationFactors.push({
        factor: 'geographic_reliability',
        adjustment: -penalty,
        reason: `Extremely poor geographic data reliability (${qualityIndicators.geographicReliability}%)`
      });
    }

    // 4. Perfect match bonus (very conservative)
    if (rawScore >= 99 && qualityIndicators.dataCompleteness >= 95) {
      const bonus = 1;
      adjustedScore += bonus;
      calibrationFactors.push({
        factor: 'perfect_match_bonus',
        adjustment: bonus,
        reason: 'Perfect match with excellent data quality'
      });
    }

    // 5. Partial data penalty for high scores (very conservative)
    if (rawScore >= 95 && qualityIndicators.dataCompleteness < 30) {
      const penalty = Math.round((95 - qualityIndicators.dataCompleteness) * 0.05);
      adjustedScore -= penalty;
      calibrationFactors.push({
        factor: 'high_score_data_penalty',
        adjustment: -penalty,
        reason: 'Extremely high score with very poor data quality is less reliable'
      });
    }

    // Ensure score stays within bounds
    const finalScore = Math.max(0, Math.min(100, Math.round(adjustedScore)));

    return {
      rawScore: Math.round(rawScore),
      calibratedScore: finalScore,
      calibrationFactors,
      qualityIndicators,
    };
  }

  /**
   * Calculate quality indicators for calibration
   */
  private calculateQualityIndicators(
    originalPlace: NormalizedOriginalPlace,
    candidatePlace: NormalizedPlace,
    matchFactors: MatchFactor[]
  ): ConfidenceCalibrationInfo['qualityIndicators'] {
    // Data completeness (0-100)
    let completenessScore = 0;
    let totalFields = 0;

    // Check original place data
    if (originalPlace.name) { completenessScore += 25; }
    if (originalPlace.address) { completenessScore += 20; }
    if (originalPlace.coordinates) { completenessScore += 15; }
    if (originalPlace.category) { completenessScore += 10; }
    totalFields += 70;

    // Check candidate place data
    if (candidatePlace.name) { completenessScore += 15; }
    if (candidatePlace.address) { completenessScore += 10; }
    if (candidatePlace.latitude && candidatePlace.longitude) { completenessScore += 5; }
    totalFields += 30;

    const dataCompleteness = Math.round((completenessScore / totalFields) * 100);

    // Match consistency (0-100) - how consistent the factor scores are
    const factorScores = matchFactors.map(f => f.score);
    const mean = factorScores.reduce((sum, score) => sum + score, 0) / factorScores.length;
    const variance = factorScores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / factorScores.length;
    const standardDeviation = Math.sqrt(variance);
    const matchConsistency = Math.max(0, Math.round(100 - (standardDeviation * 2))); // Lower std dev = higher consistency

    // Geographic reliability (0-100)
    let geographicReliability = 50; // Default neutral
    const distanceFactor = matchFactors.find(f => f.type === 'distance');
    if (distanceFactor) {
      if (distanceFactor.score === 0 && distanceFactor.explanation.includes('No coordinates')) {
        geographicReliability = 0; // No geographic data
      } else if (distanceFactor.score >= 90) {
        geographicReliability = 95; // Very reliable
      } else if (distanceFactor.score >= 70) {
        geographicReliability = 80; // Good reliability
      } else if (distanceFactor.score >= 50) {
        geographicReliability = 60; // Moderate reliability
      } else {
        geographicReliability = 30; // Poor reliability
      }
    }

    return {
      dataCompleteness,
      matchConsistency,
      geographicReliability,
    };
  }

  /**
   * Calculate variance between match factor scores
   */
  private calculateFactorVariance(matchFactors: MatchFactor[]): number {
    const scores = matchFactors.map(f => f.score);
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
    return Math.sqrt(variance);
  }

  /**
   * Generate debugging summary for match decision
   */
  private generateDebugSummary(
    matchFactors: MatchFactor[],
    calibrationInfo: ConfidenceCalibrationInfo,
    processingTimeMs: number
  ): MatchDebugSummary {
    // Calculate factor contributions
    const totalWeightedScore = matchFactors.reduce((sum, factor) => sum + factor.weightedScore, 0);
    const factorContributions = matchFactors.map(factor => ({
      factor: factor.type,
      contribution: totalWeightedScore > 0 
        ? Math.round((factor.weightedScore / totalWeightedScore) * 100)
        : 0,
      reliability: this.assessFactorReliability(factor),
    }));

    // Identify potential issues
    const potentialIssues: string[] = [];
    const recommendations: string[] = [];

    // Check for data quality issues
    if (calibrationInfo.qualityIndicators.dataCompleteness < 50) {
      potentialIssues.push('Incomplete place data may affect match accuracy');
      recommendations.push('Verify place information manually if confidence is borderline');
    }

    // Check for inconsistent factors
    const factorVariance = this.calculateFactorVariance(matchFactors);
    if (factorVariance > 30) {
      potentialIssues.push('High variance between matching factors');
      recommendations.push('Review individual factor scores for conflicting signals');
    }

    // Check for missing geographic data
    const distanceFactor = matchFactors.find(f => f.type === 'distance');
    if (distanceFactor && distanceFactor.score === 0 && distanceFactor.explanation.includes('No coordinates')) {
      potentialIssues.push('No geographic coordinates available for distance matching');
      recommendations.push('Consider manual verification for places without location data');
    }

    // Check for low individual factor scores
    const lowScoreFactors = matchFactors.filter(f => f.score < 30 && f.weight > 20);
    if (lowScoreFactors.length > 0) {
      potentialIssues.push(`Low scores in important factors: ${lowScoreFactors.map(f => f.type).join(', ')}`);
      recommendations.push('Review places with low scores in critical matching factors');
    }

    // Check for calibration adjustments
    const significantAdjustments = calibrationInfo.calibrationFactors.filter(f => Math.abs(f.adjustment) > 5);
    if (significantAdjustments.length > 0) {
      potentialIssues.push('Significant calibration adjustments applied to raw score');
      recommendations.push('Review calibration reasons for score adjustments');
    }

    return {
      totalProcessingTimeMs: processingTimeMs,
      factorContributions,
      potentialIssues,
      recommendations,
    };
  }

  /**
   * Assess reliability of individual match factor
   */
  private assessFactorReliability(factor: MatchFactor): 'high' | 'medium' | 'low' {
    // Base reliability on factor type and score
    switch (factor.type) {
      case 'name':
        if (factor.score >= 90) return 'high';
        if (factor.score >= 60) return 'medium';
        return 'low';
      
      case 'address':
        if (factor.score >= 85) return 'high';
        if (factor.score >= 50) return 'medium';
        return 'low';
      
      case 'distance':
        if (factor.score === 0 && factor.explanation.includes('No coordinates')) return 'low';
        if (factor.score >= 80) return 'high';
        if (factor.score >= 40) return 'medium';
        return 'low';
      
      case 'category':
        if (factor.score >= 75) return 'high';
        if (factor.score >= 25) return 'medium';
        return 'low';
      
      default:
        return 'medium';
    }
  }

  /**
   * Determine confidence level based on score
   */
  private determineConfidenceLevel(score: number): 'high' | 'medium' | 'low' {
    if (score >= 90) return 'high';
    if (score >= 70) return 'medium';
    return 'low';
  }

  /**
   * Normalize original place data for matching
   */
  private normalizeOriginalPlace(place: Place): NormalizedOriginalPlace {
    return {
      original: place,
      name: this.normalizeName(place.title),
      address: this.normalizeAddress(place.address),
      coordinates: place.latitude && place.longitude 
        ? { latitude: place.latitude, longitude: place.longitude }
        : undefined,
      category: place.tags?.[0], // Use first tag as category
    };
  }

  /**
   * Normalize place name for matching
   */
  private normalizeName(name: string): string {
    if (!name) return '';
    
    return name
      .toLowerCase()
      .trim()
      // Normalize unicode characters
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      // Remove common business suffixes
      .replace(/\b(llc|inc|corp|ltd|co|restaurant|cafe|coffee|shop|store|market)\b\.?/gi, '')
      // Standardize ampersands
      .replace(/\s*&\s*/g, ' and ')
      // Standardize punctuation
      .replace(/['']/g, "'") // Normalize apostrophes
      .replace(/[""]/g, '"') // Normalize quotes
      // Remove special characters but preserve apostrophes and hyphens
      .replace(/[^\w\s'-]/g, '')
      .trim();
  }

  /**
   * Normalize address for matching
   */
  private normalizeAddress(address: string): string {
    if (!address) return '';
    
    return address
      .toLowerCase()
      .trim()
      // Normalize unicode characters
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      // Standardize common abbreviations
      .replace(/\bst\b\.?/gi, 'street')
      .replace(/\bave\b\.?/gi, 'avenue')
      .replace(/\bblvd\b\.?/gi, 'boulevard')
      .replace(/\bdr\b\.?/gi, 'drive')
      .replace(/\brd\b\.?/gi, 'road')
      .replace(/\bln\b\.?/gi, 'lane')
      .replace(/\bct\b\.?/gi, 'court')
      .replace(/\bpl\b\.?/gi, 'place')
      .replace(/\bpkwy\b\.?/gi, 'parkway')
      .replace(/\bhwy\b\.?/gi, 'highway')
      // Handle French abbreviations
      .replace(/\bst-/gi, 'saint-')
      .replace(/\bste-/gi, 'sainte-')
      // Remove trailing punctuation
      .replace(/[,.]$/, '')
      .trim();
  }

  /**
   * Normalize category for matching
   */
  private normalizeCategory(category: string): string {
    if (!category) return 'establishment';
    
    const categoryMap: Record<string, string> = {
      // Food & Dining
      'restaurant': 'restaurant',
      'food': 'restaurant',
      'cafe': 'cafe',
      'coffee': 'cafe',
      'bar': 'bar',
      'fast_food': 'restaurant',
      'meal_takeaway': 'restaurant',
      'bakery': 'bakery',
      
      // Shopping
      'store': 'store',
      'shopping_mall': 'shopping',
      'supermarket': 'grocery',
      'grocery': 'grocery',
      'gas_station': 'gas_station',
      
      // Services
      'bank': 'bank',
      'hospital': 'hospital',
      'pharmacy': 'pharmacy',
      'post_office': 'post_office',
      'police': 'police',
      'fire_station': 'fire_station',
      
      // Entertainment
      'movie_theater': 'entertainment',
      'amusement_park': 'entertainment',
      'museum': 'entertainment',
      'park': 'park',
      
      // Transportation
      'airport': 'transportation',
      'subway_station': 'transportation',
      'train_station': 'transportation',
      'bus_station': 'transportation',
      
      // Lodging
      'lodging': 'lodging',
      'hotel': 'lodging',
      
      // Default
      'establishment': 'establishment',
    };

    const normalized = category.toLowerCase().replace(/\s+/g, '_');
    return categoryMap[normalized] || 'establishment';
  }

  /**
   * Extract address components for detailed matching
   */
  private extractAddressComponents(address: string): AddressComponents {
    const components: AddressComponents = {};

    // Extract postal code (various formats)
    const postalMatch = address.match(/\b(\d{5}(-\d{4})?|\w\d\w\s?\d\w\d)\b/);
    if (postalMatch) {
      components.postalCode = postalMatch[1].replace(/\s/g, '');
    }

    // Extract street number (at the beginning)
    const streetNumberMatch = address.match(/^(\d+[a-z]?)\s/);
    if (streetNumberMatch) {
      components.streetNumber = streetNumberMatch[1];
    }

    // Extract street name (after street number, before city)
    let remainingAddress = address;
    if (components.streetNumber) {
      remainingAddress = address.replace(new RegExp(`^${components.streetNumber}\\s+`), '');
    }
    
    // Common street suffixes
    const streetSuffixes = ['street', 'avenue', 'boulevard', 'drive', 'road', 'lane', 'court', 'place', 'parkway', 'highway'];
    const streetMatch = remainingAddress.match(new RegExp(`^([^,]+(?:${streetSuffixes.join('|')})?)`, 'i'));
    if (streetMatch) {
      components.streetName = streetMatch[1].trim();
    }

    // Extract city (usually after first comma)
    const cityMatch = address.match(/,\s*([^,]+?)(?:\s*,|\s+\d{5}|\s+\w\d\w|$)/);
    if (cityMatch) {
      components.city = cityMatch[1].trim();
    }

    return components;
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 100;

    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    
    if (maxLength === 0) return 100;
    
    return Math.round(((maxLength - distance) / maxLength) * 100);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    // Initialize first row and column
    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }
    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    // Fill the matrix
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Calculate Haversine distance between two coordinates
   */
  private calculateHaversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  /**
   * Calculate relationship score between categories
   */
  private calculateCategoryRelation(category1: string, category2: string): number {
    // Define category relationships
    const categoryRelations: Record<string, string[]> = {
      'restaurant': ['cafe', 'bar', 'bakery', 'fast_food'],
      'cafe': ['restaurant', 'bakery'],
      'bar': ['restaurant', 'entertainment'],
      'store': ['shopping', 'grocery'],
      'grocery': ['store', 'shopping'],
      'shopping': ['store', 'grocery'],
      'hospital': ['pharmacy'],
      'pharmacy': ['hospital'],
      'entertainment': ['bar', 'park'],
      'park': ['entertainment'],
      'transportation': ['airport'],
      'airport': ['transportation'],
    };

    if (categoryRelations[category1]?.includes(category2) || 
        categoryRelations[category2]?.includes(category1)) {
      return 75; // Related categories
    }

    return 0; // Unrelated categories
  }
}

// Supporting interfaces
interface NormalizedOriginalPlace {
  original: Place;
  name: string;
  address: string;
  coordinates?: { latitude: number; longitude: number };
  category?: string;
}

interface MatchFactorResult {
  score: number;
  explanation: string;
  details?: any;
  debugInfo?: MatchFactorDebugInfo;
}

interface AddressComponents {
  streetNumber?: string;
  streetName?: string;
  city?: string;
  postalCode?: string;
}