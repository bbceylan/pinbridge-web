import { describe, it, expect } from '@jest/globals';
import fc from 'fast-check';
import { PlaceMatchingService } from '../place-matching';
import { PlaceNormalizer } from '../place-normalization';
import type { Place } from '../../../../types';
import type { NormalizedPlace } from '../../api/response-normalizer';

describe('Confidence Scoring Consistency Properties', () => {
  const matchingService = new PlaceMatchingService();
  const normalizationService = new PlaceNormalizer();

  // Arbitraries for generating test data
  const placeArb = fc.record({
    id: fc.string({ minLength: 1 }),
    title: fc.string({ minLength: 1, maxLength: 100 }),
    address: fc.string({ minLength: 1, maxLength: 200 }),
    latitude: fc.option(fc.float({ min: -90, max: 90 }), { nil: undefined }),
    longitude: fc.option(fc.float({ min: -180, max: 180 }), { nil: undefined }),
    notes: fc.option(fc.string(), { nil: undefined }),
    tags: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 3 }),
    source: fc.constantFrom('apple', 'google', 'manual', 'other'),
    sourceUrl: fc.option(fc.string(), { nil: undefined }),
    normalizedTitle: fc.string({ minLength: 1, maxLength: 100 }),
    normalizedAddress: fc.string({ minLength: 1, maxLength: 200 }),
    createdAt: fc.date(),
    updatedAt: fc.date()
  });

  const targetPlaceArb = fc.record({
    id: fc.string({ minLength: 1 }),
    name: fc.string({ minLength: 1, maxLength: 100 }),
    address: fc.string({ minLength: 1, maxLength: 200 }),
    latitude: fc.float({ min: -90, max: 90 }),
    longitude: fc.float({ min: -180, max: 180 }),
    category: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
    rating: fc.option(fc.float({ min: 0, max: 5 }), { nil: undefined }),
    isOpen: fc.option(fc.boolean(), { nil: undefined }),
    source: fc.constantFrom('apple_maps' as const, 'google_maps' as const)
  });

  describe('Property 3: Confidence Scoring Consistency', () => {
    it('should always return scores between 0 and 100', () => {
      fc.assert(fc.property(
        placeArb,
        targetPlaceArb,
        (originalPlace: Place, targetPlace: NormalizedPlace) => {
          const score = matchingService.calculateConfidenceScore(originalPlace, targetPlace);
          
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(100);
          expect(Number.isFinite(score)).toBe(true);
        }
      ), { numRuns: 1000 });
    });

    it('should be symmetric for identical places', () => {
      fc.assert(fc.property(
        placeArb.filter(p => p.title.trim().length > 0 && p.address.trim().length > 0),
        (originalPlace: Place) => {
          // Create identical target place
          const targetPlace: NormalizedPlace = {
            id: 'target-' + originalPlace.id,
            name: originalPlace.title,
            address: originalPlace.address,
            latitude: originalPlace.latitude || 0,
            longitude: originalPlace.longitude || 0,
            category: originalPlace.tags?.[0],
            source: 'apple_maps'
          };

          const score = matchingService.calculateConfidenceScore(originalPlace, targetPlace);
          
          // Identical places should have very high confidence (>= 85)
          expect(score).toBeGreaterThanOrEqual(85);
        }
      ), { numRuns: 500 });
    });

    it('should be monotonic with respect to name similarity', () => {
      fc.assert(fc.property(
        placeArb,
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 100 }),
        (originalPlace: Place, name1: string, name2: string) => {
          const targetPlace1: NormalizedPlace = {
            id: 'target-1',
            name: name1,
            address: 'Test Address',
            latitude: 0,
            longitude: 0,
            source: 'apple_maps'
          };

          const targetPlace2: NormalizedPlace = {
            id: 'target-2',
            name: name2,
            address: 'Test Address',
            latitude: 0,
            longitude: 0,
            source: 'apple_maps'
          };

          const score1 = matchingService.calculateConfidenceScore(originalPlace, targetPlace1);
          const score2 = matchingService.calculateConfidenceScore(originalPlace, targetPlace2);

          // Calculate name similarities
          const nameSim1 = matchingService.calculateNameSimilarity(originalPlace.title, name1);
          const nameSim2 = matchingService.calculateNameSimilarity(originalPlace.title, name2);

          // If name1 is more similar to original, score1 should be >= score2
          if (nameSim1 > nameSim2) {
            expect(score1).toBeGreaterThanOrEqual(score2);
          } else if (nameSim2 > nameSim1) {
            expect(score2).toBeGreaterThanOrEqual(score1);
          }
          // Equal similarities may have equal scores (within tolerance)
        }
      ), { numRuns: 500 });
    });

    it('should decrease with increasing geographic distance', () => {
      fc.assert(fc.property(
        placeArb.filter(p => p.latitude != null && p.longitude != null),
        fc.float({ min: Math.fround(0.001), max: Math.fround(0.1) }), // Small distance
        fc.float({ min: Math.fround(1), max: Math.fround(10) }), // Large distance
        (originalPlace: Place, smallDist: number, largeDist: number) => {
          const baseCoords = { latitude: originalPlace.latitude!, longitude: originalPlace.longitude! };
          
          const nearPlace: NormalizedPlace = {
            id: 'near',
            name: originalPlace.title,
            address: 'Near Address',
            latitude: baseCoords.latitude + smallDist,
            longitude: baseCoords.longitude + smallDist,
            source: 'apple_maps'
          };

          const farPlace: NormalizedPlace = {
            id: 'far',
            name: originalPlace.title,
            address: 'Far Address',
            latitude: baseCoords.latitude + largeDist,
            longitude: baseCoords.longitude + largeDist,
            source: 'apple_maps'
          };

          const nearScore = matchingService.calculateConfidenceScore(originalPlace, nearPlace);
          const farScore = matchingService.calculateConfidenceScore(originalPlace, farPlace);

          // Nearer place should have higher or equal confidence
          expect(nearScore).toBeGreaterThanOrEqual(farScore);
        }
      ), { numRuns: 300 });
    });

    it('should have consistent confidence level categorization', () => {
      fc.assert(fc.property(
        placeArb,
        targetPlaceArb,
        (originalPlace: Place, targetPlace: NormalizedPlace) => {
          const score = matchingService.calculateConfidenceScore(originalPlace, targetPlace);
          const level = matchingService.getConfidenceLevel(score);

          // Verify confidence level boundaries
          if (score >= 90) {
            expect(level).toBe('high');
          } else if (score >= 70) {
            expect(level).toBe('medium');
          } else {
            expect(level).toBe('low');
          }
        }
      ), { numRuns: 1000 });
    });

    it('should be stable for repeated calculations', () => {
      fc.assert(fc.property(
        placeArb,
        targetPlaceArb,
        (originalPlace: Place, targetPlace: NormalizedPlace) => {
          const score1 = matchingService.calculateConfidenceScore(originalPlace, targetPlace);
          const score2 = matchingService.calculateConfidenceScore(originalPlace, targetPlace);
          const score3 = matchingService.calculateConfidenceScore(originalPlace, targetPlace);

          // All scores should be identical (deterministic)
          expect(score1).toBe(score2);
          expect(score2).toBe(score3);
        }
      ), { numRuns: 500 });
    });

    it('should handle edge cases gracefully', () => {
      fc.assert(fc.property(
        fc.oneof(
          // Empty strings
          fc.record({
            id: fc.constant('test'),
            title: fc.constant(''),
            address: fc.constant(''),
            latitude: fc.constant(undefined),
            longitude: fc.constant(undefined),
            notes: fc.constant(undefined),
            tags: fc.constant<string[]>([]),
            source: fc.constant('manual' as const),
            sourceUrl: fc.constant(undefined),
            normalizedTitle: fc.constant(''),
            normalizedAddress: fc.constant(''),
            createdAt: fc.date(),
            updatedAt: fc.date()
          }),
          // Very long strings
          fc.record({
            id: fc.constant('test'),
            title: fc.string({ minLength: 1000, maxLength: 2000 }),
            address: fc.string({ minLength: 1000, maxLength: 2000 }),
            latitude: fc.option(fc.float({ min: -90, max: 90 }), { nil: undefined }),
            longitude: fc.option(fc.float({ min: -180, max: 180 }), { nil: undefined }),
            notes: fc.option(fc.string(), { nil: undefined }),
            tags: fc.array(fc.string()),
            source: fc.constant('manual' as const),
            sourceUrl: fc.option(fc.string(), { nil: undefined }),
            normalizedTitle: fc.string({ minLength: 1000, maxLength: 2000 }),
            normalizedAddress: fc.string({ minLength: 1000, maxLength: 2000 }),
            createdAt: fc.date(),
            updatedAt: fc.date()
          }),
          // Special characters
          fc.record({
            id: fc.constant('test'),
            title: fc.string().map(s => s + '!@#$%^&*()'),
            address: fc.string().map(s => s + '!@#$%^&*()'),
            latitude: fc.option(fc.float({ min: -90, max: 90 }), { nil: undefined }),
            longitude: fc.option(fc.float({ min: -180, max: 180 }), { nil: undefined }),
            notes: fc.option(fc.string(), { nil: undefined }),
            tags: fc.array(fc.string()),
            source: fc.constant('manual' as const),
            sourceUrl: fc.option(fc.string(), { nil: undefined }),
            normalizedTitle: fc.string().map(s => s + '!@#$%^&*()'),
            normalizedAddress: fc.string().map(s => s + '!@#$%^&*()'),
            createdAt: fc.date(),
            updatedAt: fc.date()
          })
        ),
        targetPlaceArb,
        (originalPlace: Place, targetPlace: NormalizedPlace) => {
          // Should not throw and should return valid score
          expect(() => {
            const score = matchingService.calculateConfidenceScore(originalPlace, targetPlace);
            expect(score).toBeGreaterThanOrEqual(0);
            expect(score).toBeLessThanOrEqual(100);
            expect(Number.isFinite(score)).toBe(true);
          }).not.toThrow();
        }
      ), { numRuns: 200 });
    });

    it('should respect component weights in scoring', () => {
      fc.assert(fc.property(
        placeArb.filter(p => p.title.trim().length > 2 && p.address.trim().length > 2),
        (originalPlace: Place) => {
          // Create target places that differ in only one component
          const perfectNameMatch: NormalizedPlace = {
            id: 'perfect-name',
            name: originalPlace.title, // Perfect match
            address: 'Completely Different Address 12345',
            latitude: 90, // Far away
            longitude: 180,
            source: 'apple_maps'
          };

          const perfectAddressMatch: NormalizedPlace = {
            id: 'perfect-address',
            name: 'Completely Different Name XYZ',
            address: originalPlace.address, // Perfect match
            latitude: 90, // Far away
            longitude: 180,
            source: 'apple_maps'
          };

          const nameScore = matchingService.calculateConfidenceScore(originalPlace, perfectNameMatch);
          const addressScore = matchingService.calculateConfidenceScore(originalPlace, perfectAddressMatch);

          // Name should have higher weight than address (typically 40% vs 30%)
          // Allow for some tolerance due to normalization effects
          if (originalPlace.address && originalPlace.latitude && originalPlace.longitude) {
            expect(nameScore).toBeGreaterThanOrEqual(addressScore - 2);
          }
        }
      ), { numRuns: 300 });
    });

    it('should normalize input consistently', () => {
      fc.assert(fc.property(
        fc.string({ minLength: 3 }).map(s => s.toUpperCase()),
        fc.string({ minLength: 3 }).map(s => s.toLowerCase()),
        (upperName: string, lowerName: string) => {
          // Skip if the names are too different after case conversion
          if (upperName.toLowerCase() !== lowerName.toLowerCase()) {
            return true; // Skip this test case
          }

          const upperPlace: Place = {
            id: 'upper',
            title: upperName,
            address: 'Test Address',
            notes: undefined,
            tags: [],
            source: 'manual',
            sourceUrl: undefined,
            normalizedTitle: upperName.toLowerCase(),
            normalizedAddress: 'test address',
            createdAt: new Date(),
            updatedAt: new Date()
          };

          const lowerPlace: Place = {
            id: 'lower',
            title: lowerName,
            address: 'Test Address',
            notes: undefined,
            tags: [],
            source: 'manual',
            sourceUrl: undefined,
            normalizedTitle: lowerName.toLowerCase(),
            normalizedAddress: 'test address',
            createdAt: new Date(),
            updatedAt: new Date()
          };

          const targetPlace: NormalizedPlace = {
            id: 'target',
            name: upperName.toLowerCase(), // Should match both after normalization
            address: 'Test Address',
            latitude: 0,
            longitude: 0,
            source: 'apple_maps'
          };

          const upperScore = matchingService.calculateConfidenceScore(upperPlace, targetPlace);
          const lowerScore = matchingService.calculateConfidenceScore(lowerPlace, targetPlace);

          // Case differences should not affect scoring significantly
          expect(Math.abs(upperScore - lowerScore)).toBeLessThan(10);
        }
      ), { numRuns: 300 });
    });
  });

  describe('Match Factor Consistency', () => {
    it('should always provide match factors that sum to the total score', () => {
      fc.assert(fc.property(
        placeArb,
        targetPlaceArb,
        (originalPlace: Place, targetPlace: NormalizedPlace) => {
          const matches = matchingService.findMatches(originalPlace, [targetPlace]);
          
          if (matches.length > 0) {
            const match = matches[0];
            const factorSum = match.matchFactors.reduce((sum, factor) => {
              return sum + (factor.score * factor.weight / 100);
            }, 0);

            // Total weighted score should approximately equal confidence score
            expect(Math.abs(factorSum - match.confidenceScore)).toBeLessThan(5);
          }
        }
      ), { numRuns: 500 });
    });

    it('should provide explanations for all match factors', () => {
      fc.assert(fc.property(
        placeArb,
        targetPlaceArb,
        (originalPlace: Place, targetPlace: NormalizedPlace) => {
          const matches = matchingService.findMatches(originalPlace, [targetPlace]);
          
          if (matches.length > 0) {
            const match = matches[0];
            
            match.matchFactors.forEach(factor => {
              expect(factor.explanation).toBeDefined();
              expect(factor.explanation.length).toBeGreaterThan(0);
              expect(factor.type).toMatch(/^(name|address|distance|category)$/);
              expect(factor.score).toBeGreaterThanOrEqual(0);
              expect(factor.score).toBeLessThanOrEqual(100);
              expect(factor.weight).toBeGreaterThan(0);
              expect(factor.weight).toBeLessThanOrEqual(100);
            });
          }
        }
      ), { numRuns: 500 });
    });
  });
});
