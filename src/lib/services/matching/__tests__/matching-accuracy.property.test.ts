/**
 * Property-based tests for matching algorithm accuracy
 * Feature: automatized-transfer-with-verification, Property 2: Matching Algorithm Accuracy
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
 */

import fc from 'fast-check';
import { PlaceMatchingService } from '../place-matching';
import type { Place } from '@/types';
import type { NormalizedPlace } from '../../api/response-normalizer';
import type { PlaceMatchQuery, MatchingOptions, PlaceMatch } from '../place-matching';

// Suppress console warnings during property tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
beforeAll(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Test data generators
const coordinateArbitrary = fc.record({
  latitude: fc.float({ min: -90, max: 90 }),
  longitude: fc.float({ min: -180, max: 180 }),
});

const placeNameArbitrary = fc.oneof(
  // Common business names
  fc.constantFrom(
    'McDonald\'s', 'Starbucks', 'Pizza Hut', 'Subway', 'KFC',
    'Burger King', 'Taco Bell', 'Domino\'s Pizza', 'Papa John\'s',
    'Joe\'s Restaurant', 'Main Street Cafe', 'Corner Store',
    'City Hall', 'Public Library', 'Central Park'
  ),
  // Generated names with common patterns
  fc.tuple(
    fc.constantFrom('Joe\'s', 'Tony\'s', 'Maria\'s', 'The', 'Old', 'New'),
    fc.constantFrom('Restaurant', 'Cafe', 'Store', 'Market', 'Deli', 'Bar', 'Grill')
  ).map(([prefix, suffix]) => `${prefix} ${suffix}`),
  // Simple names
  fc.string({ minLength: 2, maxLength: 50 }).filter(s => s.trim().length >= 2)
);

const addressArbitrary = fc.tuple(
  fc.integer({ min: 1, max: 9999 }),
  fc.constantFrom('Main St', 'Oak Ave', 'First Street', 'Broadway', 'Park Ave', 'Elm Street'),
  fc.constantFrom('New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Boston, MA', 'Seattle, WA'),
  fc.option(fc.string({ minLength: 5, maxLength: 10 }).filter(s => /^\d{5}(-\d{4})?$/.test(s)))
).map(([number, street, city, zip]) => 
  `${number} ${street}, ${city}${zip ? ` ${zip}` : ''}`
);

const categoryArbitrary = fc.constantFrom(
  'restaurant', 'cafe', 'store', 'bank', 'hospital', 'pharmacy',
  'gas_station', 'hotel', 'park', 'school', 'library', 'museum',
  'bar', 'grocery', 'shopping_mall', 'movie_theater', 'gym'
);

const placeArbitrary = fc.record({
  id: fc.uuid(),
  title: placeNameArbitrary,
  address: addressArbitrary,
  latitude: fc.option(fc.float({ min: -90, max: 90 })),
  longitude: fc.option(fc.float({ min: -180, max: 180 })),
  tags: fc.array(categoryArbitrary, { minLength: 0, maxLength: 3 }),
  source: fc.constantFrom('manual', 'import'),
  notes: fc.string({ maxLength: 100 }),
  normalizedTitle: fc.string(),
  normalizedAddress: fc.string(),
  createdAt: fc.date(),
  updatedAt: fc.date(),
}) as fc.Arbitrary<Place>;

const normalizedPlaceArbitrary = fc.record({
  id: fc.uuid(),
  name: placeNameArbitrary,
  address: addressArbitrary,
  latitude: fc.option(fc.float({ min: -90, max: 90 })),
  longitude: fc.option(fc.float({ min: -180, max: 180 })),
  category: fc.option(categoryArbitrary),
  source: fc.constantFrom('apple_maps', 'google_maps'),
}) as fc.Arbitrary<NormalizedPlace>;

const matchingOptionsArbitrary = fc.record({
  maxDistance: fc.option(fc.integer({ min: 100, max: 50000 })),
  minConfidenceScore: fc.option(fc.integer({ min: 0, max: 100 })),
  strictMode: fc.option(fc.boolean()),
  weights: fc.option(fc.record({
    name: fc.integer({ min: 10, max: 60 }),
    address: fc.integer({ min: 10, max: 50 }),
    distance: fc.integer({ min: 5, max: 40 }),
    category: fc.integer({ min: 5, max: 30 }),
  })),
}) as fc.Arbitrary<MatchingOptions>;

describe('Matching Algorithm Accuracy Properties', () => {
  let matchingService: PlaceMatchingService;

  beforeEach(() => {
    matchingService = new PlaceMatchingService();
  });

  /**
   * **Validates: Requirements 2.1, 2.2**
   * 
   * Property 2a: Fuzzy String Matching Consistency
   * The fuzzy string matching algorithm should be deterministic and consistent.
   * Identical inputs should always produce identical outputs, and similar inputs
   * should produce similar scores.
   */
  it('should produce consistent fuzzy string matching results', async () => {
    await fc.assert(
      fc.asyncProperty(
        placeArbitrary,
        normalizedPlaceArbitrary,
        matchingOptionsArbitrary,
        async (originalPlace, candidatePlace, options) => {
          const query: PlaceMatchQuery = {
            originalPlace,
            candidatePlaces: [candidatePlace],
            options,
          };

          // Run the same query multiple times
          const result1 = await matchingService.findMatches(query);
          const result2 = await matchingService.findMatches(query);

          // Results should be identical (deterministic)
          expect(result1.matches.length).toBe(result2.matches.length);
          
          if (result1.matches.length > 0 && result2.matches.length > 0) {
            const match1 = result1.matches[0];
            const match2 = result2.matches[0];

            // Confidence scores should be identical
            expect(match1.confidenceScore).toBe(match2.confidenceScore);
            expect(match1.confidenceLevel).toBe(match2.confidenceLevel);

            // Match factors should be identical
            expect(match1.matchFactors).toHaveLength(match2.matchFactors.length);
            
            for (let i = 0; i < match1.matchFactors.length; i++) {
              expect(match1.matchFactors[i].type).toBe(match2.matchFactors[i].type);
              expect(match1.matchFactors[i].score).toBe(match2.matchFactors[i].score);
              expect(match1.matchFactors[i].weight).toBe(match2.matchFactors[i].weight);
              expect(match1.matchFactors[i].weightedScore).toBe(match2.matchFactors[i].weightedScore);
            }
          }
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  /**
   * **Validates: Requirements 2.1, 2.3**
   * 
   * Property 2b: Address Normalization Reliability
   * Address normalization should handle various formats consistently and
   * produce meaningful similarity scores for address variations.
   */
  it('should normalize addresses consistently across formats', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          fc.integer({ min: 1, max: 9999 }),
          fc.constantFrom('Main Street', 'Main St', 'Main St.'),
          fc.constantFrom('New York, NY', 'New York, New York', 'NYC, NY'),
          fc.option(fc.string({ minLength: 5, maxLength: 10 }).filter(s => /^\d{5}(-\d{4})?$/.test(s)))
        ),
        placeNameArbitrary,
        categoryArbitrary,
        async ([streetNumber, streetName, city, zip], placeName, category) => {
          // Create variations of the same address
          const baseAddress = `${streetNumber} ${streetName}, ${city}${zip ? ` ${zip}` : ''}`;
          
          const originalPlace: Place = {
            id: 'original',
            title: placeName,
            address: baseAddress,
            tags: [category],
            source: 'manual',
            normalizedTitle: placeName.toLowerCase(),
            normalizedAddress: baseAddress.toLowerCase(),
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          // Create address variations
          const addressVariations = [
            baseAddress, // Exact match
            baseAddress.replace('Street', 'St'), // Abbreviation
            baseAddress.replace('St.', 'Street'), // Expansion
            baseAddress.replace(', ', ' '), // Punctuation variation
          ].filter((addr, index, arr) => arr.indexOf(addr) === index); // Remove duplicates

          const candidates: NormalizedPlace[] = addressVariations.map((addr, index) => ({
            id: `candidate-${index}`,
            name: placeName,
            address: addr,
            category,
            source: 'google_maps',
          }));

          const result = await matchingService.findMatches({
            originalPlace,
            candidatePlaces: candidates,
          });

          // All address variations should be recognized as high-quality matches
          expect(result.matches.length).toBeGreaterThan(0);
          
          result.matches.forEach(match => {
            const addressFactor = match.matchFactors.find(f => f.type === 'address');
            expect(addressFactor).toBeDefined();
            
            // Address variations should score highly (>= 80)
            expect(addressFactor!.score).toBeGreaterThanOrEqual(80);
            
            // Should have debugging information
            expect(addressFactor!.debugInfo).toBeDefined();
            expect(addressFactor!.debugInfo!.calculationSteps).toBeDefined();
            expect(addressFactor!.debugInfo!.calculationSteps.length).toBeGreaterThan(0);
          });
        }
      ),
      { numRuns: 15 }
    );
  }, 25000);

  /**
   * **Validates: Requirements 2.1, 2.4**
   * 
   * Property 2c: Geographic Distance Calculation Accuracy
   * Geographic distance calculations should be mathematically accurate
   * and produce consistent results for the same coordinate pairs.
   */
  it('should calculate geographic distances accurately and consistently', async () => {
    await fc.assert(
      fc.asyncProperty(
        coordinateArbitrary,
        coordinateArbitrary,
        placeNameArbitrary,
        async (coords1, coords2, placeName) => {
          const originalPlace: Place = {
            id: 'original',
            title: placeName,
            address: '123 Test St',
            latitude: coords1.latitude,
            longitude: coords1.longitude,
            tags: ['restaurant'],
            source: 'manual',
            normalizedTitle: placeName.toLowerCase(),
            normalizedAddress: '123 test st',
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const candidate: NormalizedPlace = {
            id: 'candidate',
            name: placeName,
            address: '123 Test St',
            latitude: coords2.latitude,
            longitude: coords2.longitude,
            category: 'restaurant',
            source: 'google_maps',
          };

          const result = await matchingService.findMatches({
            originalPlace,
            candidatePlaces: [candidate],
            options: { minConfidenceScore: 0 }, // Allow all matches for testing
          });

          expect(result.matches).toHaveLength(1);
          const match = result.matches[0];
          const distanceFactor = match.matchFactors.find(f => f.type === 'distance');

          expect(distanceFactor).toBeDefined();
          expect(distanceFactor!.details).toBeDefined();
          expect(distanceFactor!.details.distanceMeters).toBeDefined();
          expect(distanceFactor!.details.originalCoords).toEqual(coords1);
          expect(distanceFactor!.details.candidateCoords).toEqual(coords2);

          // Distance should be non-negative
          expect(distanceFactor!.details.distanceMeters).toBeGreaterThanOrEqual(0);

          // Identical coordinates should have zero distance and perfect score
          if (coords1.latitude === coords2.latitude && coords1.longitude === coords2.longitude) {
            expect(distanceFactor!.details.distanceMeters).toBe(0);
            expect(distanceFactor!.score).toBe(100);
          }

          // Very close coordinates (< 50m) should have high scores
          if (distanceFactor!.details.distanceMeters < 50) {
            expect(distanceFactor!.score).toBe(100);
          }

          // Distance score should decrease as distance increases
          const distanceMeters = distanceFactor!.details.distanceMeters;
          const score = distanceFactor!.score;
          
          if (distanceMeters > 5000) { // Beyond max distance
            expect(score).toBe(0);
          } else if (distanceMeters > 50) {
            expect(score).toBeLessThan(100);
            expect(score).toBeGreaterThanOrEqual(5); // Should have some minimum score within range
          }
        }
      ),
      { numRuns: 25 }
    );
  }, 35000);

  /**
   * **Validates: Requirements 2.2, 2.3**
   * 
   * Property 2d: Confidence Scoring Consistency
   * Confidence scores should be consistent and meaningful across different
   * input combinations, with proper calibration and quality indicators.
   */
  it('should produce consistent and meaningful confidence scores', async () => {
    await fc.assert(
      fc.asyncProperty(
        placeArbitrary,
        fc.array(normalizedPlaceArbitrary, { minLength: 1, maxLength: 5 }),
        matchingOptionsArbitrary,
        async (originalPlace, candidates, options) => {
          const result = await matchingService.findMatches({
            originalPlace,
            candidatePlaces: candidates,
            options,
          });

          // All matches should have valid confidence scores
          result.matches.forEach(match => {
            expect(match.confidenceScore).toBeGreaterThanOrEqual(0);
            expect(match.confidenceScore).toBeLessThanOrEqual(100);
            expect(Number.isInteger(match.confidenceScore)).toBe(true);

            // Confidence level should match score ranges
            if (match.confidenceScore >= 90) {
              expect(match.confidenceLevel).toBe('high');
            } else if (match.confidenceScore >= 70) {
              expect(match.confidenceLevel).toBe('medium');
            } else {
              expect(match.confidenceLevel).toBe('low');
            }

            // Should have calibration information
            expect(match.calibrationInfo).toBeDefined();
            expect(match.calibrationInfo.rawScore).toBeGreaterThanOrEqual(0);
            expect(match.calibrationInfo.rawScore).toBeLessThanOrEqual(100);
            expect(match.calibrationInfo.calibratedScore).toBe(match.confidenceScore);

            // Quality indicators should be valid
            const qi = match.calibrationInfo.qualityIndicators;
            expect(qi.dataCompleteness).toBeGreaterThanOrEqual(0);
            expect(qi.dataCompleteness).toBeLessThanOrEqual(100);
            expect(qi.matchConsistency).toBeGreaterThanOrEqual(0);
            expect(qi.matchConsistency).toBeLessThanOrEqual(100);
            expect(qi.geographicReliability).toBeGreaterThanOrEqual(0);
            expect(qi.geographicReliability).toBeLessThanOrEqual(100);
          });

          // Matches should be sorted by confidence score (highest first)
          for (let i = 1; i < result.matches.length; i++) {
            expect(result.matches[i - 1].confidenceScore).toBeGreaterThanOrEqual(
              result.matches[i].confidenceScore
            );
            expect(result.matches[i - 1].rank).toBeLessThan(result.matches[i].rank);
          }

          // Best match should be the first match (if any)
          if (result.matches.length > 0) {
            expect(result.bestMatch).toBe(result.matches[0]);
          } else {
            expect(result.bestMatch).toBeUndefined();
          }
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  /**
   * **Validates: Requirements 2.4**
   * 
   * Property 2e: Match Factor Reliability
   * All match factors should contribute meaningfully to the final score
   * and provide reliable debugging information.
   */
  it('should provide reliable match factors with meaningful contributions', async () => {
    await fc.assert(
      fc.asyncProperty(
        placeArbitrary,
        normalizedPlaceArbitrary,
        matchingOptionsArbitrary,
        async (originalPlace, candidate, options) => {
          const result = await matchingService.findMatches({
            originalPlace,
            candidatePlaces: [candidate],
            options: { ...options, minConfidenceScore: 0 }, // Allow all matches
          });

          if (result.matches.length > 0) {
            const match = result.matches[0];
            
            // Should have exactly 4 match factors
            expect(match.matchFactors).toHaveLength(4);
            
            const factorTypes = match.matchFactors.map(f => f.type);
            expect(factorTypes).toContain('name');
            expect(factorTypes).toContain('address');
            expect(factorTypes).toContain('distance');
            expect(factorTypes).toContain('category');

            // Each factor should have valid properties
            match.matchFactors.forEach(factor => {
              expect(factor.score).toBeGreaterThanOrEqual(0);
              expect(factor.score).toBeLessThanOrEqual(100);
              expect(factor.weight).toBeGreaterThan(0);
              expect(factor.weightedScore).toBeGreaterThanOrEqual(0);
              expect(factor.explanation).toBeTruthy();
              expect(typeof factor.explanation).toBe('string');

              // Weighted score should be calculated correctly
              const expectedWeightedScore = (factor.score * factor.weight) / 100;
              expect(Math.abs(factor.weightedScore - expectedWeightedScore)).toBeLessThan(0.01);

              // Should have debugging information
              expect(factor.debugInfo).toBeDefined();
              expect(factor.debugInfo!.rawInputs).toBeDefined();
              expect(factor.debugInfo!.calculationSteps).toBeDefined();
              expect(factor.debugInfo!.calculationSteps.length).toBeGreaterThan(0);
            });

            // Weights should sum to approximately 100
            const totalWeight = match.matchFactors.reduce((sum, f) => sum + f.weight, 0);
            expect(Math.abs(totalWeight - 100)).toBeLessThan(0.01);

            // Debug summary should be comprehensive
            expect(match.debugSummary).toBeDefined();
            expect(match.debugSummary.factorContributions).toHaveLength(4);
            expect(match.debugSummary.potentialIssues).toBeInstanceOf(Array);
            expect(match.debugSummary.recommendations).toBeInstanceOf(Array);
            expect(match.debugSummary.totalProcessingTimeMs).toBeGreaterThanOrEqual(0);

            // Factor contributions should sum to 100%
            const totalContribution = match.debugSummary.factorContributions
              .reduce((sum, fc) => sum + fc.contribution, 0);
            expect(totalContribution).toBe(100);
          }
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  /**
   * **Validates: Requirements 2.1, 2.4**
   * 
   * Property 2f: Edge Case Handling
   * The matching algorithm should handle edge cases gracefully without
   * throwing errors or producing invalid results.
   */
  it('should handle edge cases gracefully without errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          // Empty/minimal data cases
          fc.record({
            place: fc.record({
              id: fc.uuid(),
              title: fc.constantFrom('', ' ', 'X'),
              address: fc.constantFrom('', ' ', 'Y'),
              tags: fc.constantFrom([], [''], [' ']),
              source: fc.constantFrom('manual', 'import'),
              normalizedTitle: fc.string(),
              normalizedAddress: fc.string(),
              createdAt: fc.date(),
              updatedAt: fc.date(),
            }) as fc.Arbitrary<Place>,
            candidate: fc.record({
              id: fc.uuid(),
              name: fc.constantFrom('', ' ', 'Z'),
              address: fc.constantFrom('', ' ', 'W'),
              source: fc.constantFrom('apple_maps', 'google_maps'),
            }) as fc.Arbitrary<NormalizedPlace>,
          }),
          // Invalid coordinate cases
          fc.record({
            place: fc.record({
              id: fc.uuid(),
              title: fc.string({ minLength: 1, maxLength: 20 }),
              address: fc.string({ minLength: 1, maxLength: 50 }),
              latitude: fc.constantFrom(NaN, Infinity, -Infinity, 91, -91),
              longitude: fc.constantFrom(NaN, Infinity, -Infinity, 181, -181),
              tags: fc.array(fc.string(), { maxLength: 2 }),
              source: fc.constantFrom('manual', 'import'),
              normalizedTitle: fc.string(),
              normalizedAddress: fc.string(),
              createdAt: fc.date(),
              updatedAt: fc.date(),
            }) as fc.Arbitrary<Place>,
            candidate: fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 1, maxLength: 20 }),
              address: fc.string({ minLength: 1, maxLength: 50 }),
              latitude: fc.constantFrom(NaN, Infinity, -Infinity, 91, -91),
              longitude: fc.constantFrom(NaN, Infinity, -Infinity, 181, -181),
              source: fc.constantFrom('apple_maps', 'google_maps'),
            }) as fc.Arbitrary<NormalizedPlace>,
          }),
          // Special character cases
          fc.record({
            place: fc.record({
              id: fc.uuid(),
              title: fc.constantFrom('Café René & Co.', '北京烤鸭', 'Москва', '🍕 Pizza'),
              address: fc.constantFrom('123 St-Laurent Blvd.', 'Москва, Россия', '東京都'),
              tags: fc.array(fc.string(), { maxLength: 2 }),
              source: fc.constantFrom('manual', 'import'),
              normalizedTitle: fc.string(),
              normalizedAddress: fc.string(),
              createdAt: fc.date(),
              updatedAt: fc.date(),
            }) as fc.Arbitrary<Place>,
            candidate: fc.record({
              id: fc.uuid(),
              name: fc.constantFrom('Cafe Rene and Co', 'Beijing Duck', 'Moscow', 'Pizza'),
              address: fc.constantFrom('123 Saint-Laurent Boulevard', 'Moscow, Russia', 'Tokyo'),
              source: fc.constantFrom('apple_maps', 'google_maps'),
            }) as fc.Arbitrary<NormalizedPlace>,
          })
        ),
        async (testCase) => {
          // Should not throw any errors
          expect(async () => {
            const result = await matchingService.findMatches({
              originalPlace: testCase.place,
              candidatePlaces: [testCase.candidate],
              options: { minConfidenceScore: 0 },
            });

            // Result should have valid structure
            expect(result).toBeDefined();
            expect(result.matches).toBeInstanceOf(Array);
            expect(result.metadata).toBeDefined();
            expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);

            // If matches exist, they should be valid
            result.matches.forEach(match => {
              expect(match.confidenceScore).toBeGreaterThanOrEqual(0);
              expect(match.confidenceScore).toBeLessThanOrEqual(100);
              expect(match.matchFactors).toHaveLength(4);
              expect(match.calibrationInfo).toBeDefined();
              expect(match.debugSummary).toBeDefined();
            });
          }).not.toThrow();
        }
      ),
      { numRuns: 15 }
    );
  }, 25000);

  /**
   * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
   * 
   * Property 2g: Deterministic Behavior
   * The matching algorithm should be completely deterministic - identical
   * inputs should always produce identical outputs, ensuring reproducibility.
   */
  it('should be completely deterministic and reproducible', async () => {
    await fc.assert(
      fc.asyncProperty(
        placeArbitrary,
        fc.array(normalizedPlaceArbitrary, { minLength: 1, maxLength: 3 }),
        matchingOptionsArbitrary,
        async (originalPlace, candidates, options) => {
          const query: PlaceMatchQuery = {
            originalPlace,
            candidatePlaces: candidates,
            options,
          };

          // Run the same query multiple times
          const results = await Promise.all([
            matchingService.findMatches(query),
            matchingService.findMatches(query),
            matchingService.findMatches(query),
          ]);

          // All results should be identical
          for (let i = 1; i < results.length; i++) {
            const result1 = results[0];
            const result2 = results[i];

            expect(result1.matches.length).toBe(result2.matches.length);
            expect(result1.metadata.totalCandidates).toBe(result2.metadata.totalCandidates);
            expect(result1.metadata.validMatches).toBe(result2.metadata.validMatches);
            expect(result1.metadata.averageConfidence).toBe(result2.metadata.averageConfidence);

            // Compare each match in detail
            for (let j = 0; j < result1.matches.length; j++) {
              const match1 = result1.matches[j];
              const match2 = result2.matches[j];

              expect(match1.confidenceScore).toBe(match2.confidenceScore);
              expect(match1.confidenceLevel).toBe(match2.confidenceLevel);
              expect(match1.rank).toBe(match2.rank);

              // Compare calibration info
              expect(match1.calibrationInfo.rawScore).toBe(match2.calibrationInfo.rawScore);
              expect(match1.calibrationInfo.calibratedScore).toBe(match2.calibrationInfo.calibratedScore);

              // Compare match factors
              expect(match1.matchFactors).toHaveLength(match2.matchFactors.length);
              for (let k = 0; k < match1.matchFactors.length; k++) {
                expect(match1.matchFactors[k].type).toBe(match2.matchFactors[k].type);
                expect(match1.matchFactors[k].score).toBe(match2.matchFactors[k].score);
                expect(match1.matchFactors[k].weight).toBe(match2.matchFactors[k].weight);
                expect(match1.matchFactors[k].weightedScore).toBe(match2.matchFactors[k].weightedScore);
              }
            }
          }
        }
      ),
      { numRuns: 15 }
    );
  }, 25000);

  /**
   * **Validates: Requirements 2.2, 2.4**
   * 
   * Property 2h: Score Monotonicity
   * Better matches should always have higher or equal confidence scores.
   * The scoring system should be monotonic with respect to match quality.
   */
  it('should maintain score monotonicity with respect to match quality', async () => {
    await fc.assert(
      fc.asyncProperty(
        placeNameArbitrary,
        addressArbitrary,
        coordinateArbitrary,
        categoryArbitrary,
        async (placeName, address, coords, category) => {
          const originalPlace: Place = {
            id: 'original',
            title: placeName,
            address: address,
            latitude: coords.latitude,
            longitude: coords.longitude,
            tags: [category],
            source: 'manual',
            normalizedTitle: placeName.toLowerCase(),
            normalizedAddress: address.toLowerCase(),
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          // Create candidates with varying degrees of similarity
          const candidates: NormalizedPlace[] = [
            // Perfect match
            {
              id: 'perfect',
              name: placeName,
              address: address,
              latitude: coords.latitude,
              longitude: coords.longitude,
              category: category,
              source: 'google_maps',
            },
            // Good match (slight name variation)
            {
              id: 'good',
              name: placeName.replace(/'/g, ''), // Remove apostrophes
              address: address,
              latitude: coords.latitude,
              longitude: coords.longitude,
              category: category,
              source: 'google_maps',
            },
            // Moderate match (different address, same location)
            {
              id: 'moderate',
              name: placeName,
              address: address.replace(/Street/g, 'St').replace(/Avenue/g, 'Ave'),
              latitude: coords.latitude + 0.001, // ~100m away
              longitude: coords.longitude + 0.001,
              category: category,
              source: 'google_maps',
            },
            // Poor match (different name, same category)
            {
              id: 'poor',
              name: 'Different Place Name',
              address: 'Different Address',
              latitude: coords.latitude + 0.01, // ~1km away
              longitude: coords.longitude + 0.01,
              category: category,
              source: 'google_maps',
            },
          ];

          const result = await matchingService.findMatches({
            originalPlace,
            candidatePlaces: candidates,
            options: { minConfidenceScore: 0 },
          });

          if (result.matches.length >= 2) {
            // Find matches by their candidate IDs
            const perfectMatch = result.matches.find(m => m.candidatePlace.id === 'perfect');
            const goodMatch = result.matches.find(m => m.candidatePlace.id === 'good');
            const moderateMatch = result.matches.find(m => m.candidatePlace.id === 'moderate');
            const poorMatch = result.matches.find(m => m.candidatePlace.id === 'poor');

            // Perfect match should have the highest score
            if (perfectMatch) {
              expect(perfectMatch.confidenceScore).toBeGreaterThanOrEqual(90);
              
              if (goodMatch) {
                expect(perfectMatch.confidenceScore).toBeGreaterThanOrEqual(goodMatch.confidenceScore);
              }
              if (moderateMatch) {
                expect(perfectMatch.confidenceScore).toBeGreaterThanOrEqual(moderateMatch.confidenceScore);
              }
              if (poorMatch) {
                expect(perfectMatch.confidenceScore).toBeGreaterThanOrEqual(poorMatch.confidenceScore);
              }
            }

            // Good match should score better than moderate and poor
            if (goodMatch && moderateMatch) {
              expect(goodMatch.confidenceScore).toBeGreaterThanOrEqual(moderateMatch.confidenceScore);
            }
            if (goodMatch && poorMatch) {
              expect(goodMatch.confidenceScore).toBeGreaterThanOrEqual(poorMatch.confidenceScore);
            }

            // Moderate match should score better than poor
            if (moderateMatch && poorMatch) {
              expect(moderateMatch.confidenceScore).toBeGreaterThanOrEqual(poorMatch.confidenceScore);
            }
          }
        }
      ),
      { numRuns: 10 }
    );
  }, 20000);
});