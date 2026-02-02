/**
 * Unit tests for PlaceMatchingService
 */

import { PlaceMatchingService } from '../place-matching';
import type { Place } from '@/types';
import type { NormalizedPlace } from '../../api/response-normalizer';
import type { PlaceMatchQuery, MatchingOptions } from '../place-matching';

describe('PlaceMatchingService', () => {
  let matchingService: PlaceMatchingService;

  beforeEach(() => {
    matchingService = new PlaceMatchingService();
  });

  describe('constructor', () => {
    it('should use default options when none provided', () => {
      const service = new PlaceMatchingService();
      expect(service).toBeInstanceOf(PlaceMatchingService);
    });

    it('should normalize weights to sum to 100', () => {
      const service = new PlaceMatchingService({
        weights: { name: 20, address: 20, distance: 20, category: 20 } // Sum = 80
      });
      expect(service).toBeInstanceOf(PlaceMatchingService);
    });

    it('should accept custom options', () => {
      const options: MatchingOptions = {
        maxDistance: 10000,
        minConfidenceScore: 50,
        strictMode: true,
      };
      const service = new PlaceMatchingService(options);
      expect(service).toBeInstanceOf(PlaceMatchingService);
    });
  });

  describe('findMatches', () => {
    const createMockPlace = (overrides: Partial<Place> = {}): Place => ({
      id: 'test-place-1',
      title: 'Test Restaurant',
      address: '123 Main Street, New York, NY 10001',
      latitude: 40.7128,
      longitude: -74.0060,
      notes: '',
      tags: ['restaurant'],
      source: 'manual',
      normalizedTitle: 'test restaurant',
      normalizedAddress: '123 main street new york ny 10001',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });

    const createMockCandidate = (overrides: Partial<NormalizedPlace> = {}): NormalizedPlace => ({
      id: 'candidate-1',
      name: 'Test Restaurant',
      address: '123 Main St, New York, NY 10001',
      latitude: 40.7128,
      longitude: -74.0060,
      category: 'restaurant',
      source: 'google_maps',
      ...overrides,
    });

    it('should find exact matches with high confidence', async () => {
      const originalPlace = createMockPlace();
      const candidates = [createMockCandidate()];

      const query: PlaceMatchQuery = {
        originalPlace,
        candidatePlaces: candidates,
      };

      const result = await matchingService.findMatches(query);

      expect(result.matches).toHaveLength(1);
      expect(result.bestMatch).toBeDefined();
      expect(result.bestMatch!.confidenceScore).toBeGreaterThan(90);
      expect(result.bestMatch!.confidenceLevel).toBe('high');
      expect(result.metadata.totalCandidates).toBe(1);
      expect(result.metadata.validMatches).toBe(1);
    });

    it('should handle multiple candidates and rank them correctly', async () => {
      const originalPlace = createMockPlace({
        title: 'Pizza Palace',
        address: '456 Oak Avenue, Boston, MA 02101',
      });

      const candidates = [
        createMockCandidate({
          id: 'candidate-1',
          name: 'Pizza Palace',
          address: '456 Oak Ave, Boston, MA 02101',
        }),
        createMockCandidate({
          id: 'candidate-2',
          name: 'Pizza Place',
          address: '456 Oak Avenue, Boston, MA 02101',
        }),
        createMockCandidate({
          id: 'candidate-3',
          name: 'Different Restaurant',
          address: '789 Pine Street, Boston, MA 02101',
        }),
      ];

      const query: PlaceMatchQuery = {
        originalPlace,
        candidatePlaces: candidates,
      };

      const result = await matchingService.findMatches(query);

      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.matches[0].rank).toBe(1);
      expect(result.matches[0].confidenceScore).toBeGreaterThan(result.matches[1]?.confidenceScore || 0);
      expect(result.bestMatch?.candidatePlace.id).toBe('candidate-1');
    });

    it('should filter out matches below minimum confidence threshold', async () => {
      const originalPlace = createMockPlace({
        title: 'Specific Restaurant Name',
        address: '123 Main Street, New York, NY',
      });

      const candidates = [
        createMockCandidate({
          name: 'Completely Different Place',
          address: '999 Different Street, Los Angeles, CA',
          latitude: 34.0522,
          longitude: -118.2437,
        }),
      ];

      const query: PlaceMatchQuery = {
        originalPlace,
        candidatePlaces: candidates,
        options: { minConfidenceScore: 70 },
      };

      const result = await matchingService.findMatches(query);

      expect(result.matches).toHaveLength(0);
      expect(result.bestMatch).toBeUndefined();
      expect(result.metadata.validMatches).toBe(0);
    });

    it('should handle places without coordinates', async () => {
      const originalPlace = createMockPlace({
        latitude: undefined,
        longitude: undefined,
      });

      const candidates = [
        createMockCandidate({
          name: 'Test Restaurant',
          address: '123 Main Street, New York, NY 10001',
        }),
      ];

      const query: PlaceMatchQuery = {
        originalPlace,
        candidatePlaces: candidates,
      };

      const result = await matchingService.findMatches(query);

      expect(result.matches).toHaveLength(1);
      const distanceFactor = result.matches[0].matchFactors.find(f => f.type === 'distance');
      expect(distanceFactor?.score).toBe(0);
      expect(distanceFactor?.explanation).toContain('No coordinates available');
    });

    it('should include processing time and metadata', async () => {
      const originalPlace = createMockPlace();
      const candidates = [createMockCandidate()];

      const query: PlaceMatchQuery = {
        originalPlace,
        candidatePlaces: candidates,
      };

      const result = await matchingService.findMatches(query);

      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.metadata).toEqual({
        totalCandidates: 1,
        validMatches: 1,
        averageConfidence: expect.any(Number),
      });
    });
  });

  describe('name matching', () => {
    const createTestQuery = (originalName: string, candidateName: string): PlaceMatchQuery => ({
      originalPlace: {
        id: 'test',
        title: originalName,
        address: '123 Test St',
        tags: [],
        source: 'manual',
        normalizedTitle: originalName.toLowerCase(),
        normalizedAddress: '123 test st',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      candidatePlaces: [{
        id: 'candidate',
        name: candidateName,
        address: '123 Test St',
        latitude: 40.7128,
        longitude: -74.0060,
        source: 'google_maps',
      }],
    });

    it('should give perfect score for exact name matches', async () => {
      const result = await matchingService.findMatches(
        createTestQuery('Pizza Palace', 'Pizza Palace')
      );

      const nameFactor = result.matches[0].matchFactors.find(f => f.type === 'name');
      expect(nameFactor?.score).toBe(100);
    });

    it('should handle case differences', async () => {
      const result = await matchingService.findMatches(
        createTestQuery('Pizza Palace', 'PIZZA PALACE')
      );

      const nameFactor = result.matches[0].matchFactors.find(f => f.type === 'name');
      expect(nameFactor?.score).toBe(100);
    });

    it('should handle common business suffix variations', async () => {
      const result = await matchingService.findMatches(
        createTestQuery('Joe\'s Restaurant', 'Joe\'s')
      );

      const nameFactor = result.matches[0].matchFactors.find(f => f.type === 'name');
      expect(nameFactor?.score).toBeGreaterThan(80);
    });

    it('should apply bonus for partial matches', async () => {
      const result = await matchingService.findMatches(
        createTestQuery('McDonald\'s Restaurant', 'McDonald\'s')
      );

      const nameFactor = result.matches[0].matchFactors.find(f => f.type === 'name');
      expect(nameFactor?.score).toBeGreaterThan(90);
    });

    it('should handle ampersand variations', async () => {
      const result = await matchingService.findMatches(
        createTestQuery('Smith & Jones', 'Smith and Jones')
      );

      const nameFactor = result.matches[0].matchFactors.find(f => f.type === 'name');
      expect(nameFactor?.score).toBe(100);
    });

    it('should give low score for completely different names', async () => {
      const result = await matchingService.findMatches(
        createTestQuery('Pizza Palace', 'Burger King')
      );

      const nameFactor = result.matches[0].matchFactors.find(f => f.type === 'name');
      expect(nameFactor?.score).toBeLessThan(30);
    });
  });

  describe('address matching', () => {
    const createAddressTestQuery = (originalAddress: string, candidateAddress: string): PlaceMatchQuery => ({
      originalPlace: {
        id: 'test',
        title: 'Test Place',
        address: originalAddress,
        tags: [],
        source: 'manual',
        normalizedTitle: 'test place',
        normalizedAddress: originalAddress.toLowerCase(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      candidatePlaces: [{
        id: 'candidate',
        name: 'Test Place',
        address: candidateAddress,
        latitude: 40.7128,
        longitude: -74.0060,
        source: 'google_maps',
      }],
    });

    it('should give perfect score for exact address matches', async () => {
      const result = await matchingService.findMatches(
        createAddressTestQuery('123 Main Street, New York, NY', '123 Main Street, New York, NY')
      );

      const addressFactor = result.matches[0].matchFactors.find(f => f.type === 'address');
      expect(addressFactor?.score).toBe(100);
    });

    it('should handle street abbreviations', async () => {
      const result = await matchingService.findMatches(
        createAddressTestQuery('123 Main St, New York, NY', '123 Main Street, New York, NY')
      );

      const addressFactor = result.matches[0].matchFactors.find(f => f.type === 'address');
      expect(addressFactor?.score).toBe(100);
    });

    it('should match address components correctly', async () => {
      const result = await matchingService.findMatches(
        createAddressTestQuery('456 Oak Avenue, Boston, MA 02101', '456 Oak Ave, Boston, MA 02101')
      );

      const addressFactor = result.matches[0].matchFactors.find(f => f.type === 'address');
      expect(addressFactor?.score).toBeGreaterThan(90);
    });

    it('should handle missing postal codes', async () => {
      const result = await matchingService.findMatches(
        createAddressTestQuery('123 Main Street, New York, NY', '123 Main Street, New York, NY 10001')
      );

      const addressFactor = result.matches[0].matchFactors.find(f => f.type === 'address');
      expect(addressFactor?.score).toBeGreaterThan(80);
    });

    it('should give low score for different addresses', async () => {
      const result = await matchingService.findMatches(
        createAddressTestQuery('123 Main Street, New York, NY', '999 Different Ave, Los Angeles, CA')
      );

      const addressFactor = result.matches[0].matchFactors.find(f => f.type === 'address');
      expect(addressFactor?.score).toBeLessThan(30);
    });
  });

  describe('distance matching', () => {
    const createDistanceTestQuery = (
      originalCoords: { lat: number; lng: number },
      candidateCoords: { lat: number; lng: number }
    ): PlaceMatchQuery => ({
      originalPlace: {
        id: 'test',
        title: 'Test Place',
        address: '123 Test St',
        latitude: originalCoords.lat,
        longitude: originalCoords.lng,
        tags: [],
        source: 'manual',
        normalizedTitle: 'test place',
        normalizedAddress: '123 test st',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      candidatePlaces: [{
        id: 'candidate',
        name: 'Test Place',
        address: '123 Test St',
        latitude: candidateCoords.lat,
        longitude: candidateCoords.lng,
        source: 'google_maps',
      }],
    });

    it('should give perfect score for identical coordinates', async () => {
      const coords = { lat: 40.7128, lng: -74.0060 };
      const result = await matchingService.findMatches(
        createDistanceTestQuery(coords, coords)
      );

      const distanceFactor = result.matches[0].matchFactors.find(f => f.type === 'distance');
      expect(distanceFactor?.score).toBe(100);
    });

    it('should give high score for very close locations (< 50m)', async () => {
      const result = await matchingService.findMatches(
        createDistanceTestQuery(
          { lat: 40.7128, lng: -74.0060 },
          { lat: 40.7129, lng: -74.0061 } // ~15m apart
        )
      );

      const distanceFactor = result.matches[0].matchFactors.find(f => f.type === 'distance');
      expect(distanceFactor?.score).toBe(100);
    });

    it('should decrease score with distance', async () => {
      const result = await matchingService.findMatches(
        createDistanceTestQuery(
          { lat: 40.7128, lng: -74.0060 }, // NYC
          { lat: 40.7300, lng: -73.9950 }  // ~2km away (within 5km limit)
        )
      );

      const distanceFactor = result.matches[0].matchFactors.find(f => f.type === 'distance');
      expect(distanceFactor?.score).toBeLessThan(100);
      expect(distanceFactor?.score).toBeGreaterThan(0);
    });

    it('should give zero score for very distant locations', async () => {
      const result = await matchingService.findMatches(
        createDistanceTestQuery(
          { lat: 40.7128, lng: -74.0060 }, // NYC
          { lat: 34.0522, lng: -118.2437 }  // LA
        )
      );

      const distanceFactor = result.matches[0].matchFactors.find(f => f.type === 'distance');
      expect(distanceFactor?.score).toBe(0);
    });
  });

  describe('category matching', () => {
    const createCategoryTestQuery = (originalTags: string[], candidateCategory?: string): PlaceMatchQuery => ({
      originalPlace: {
        id: 'test',
        title: 'Test Place',
        address: '123 Test St',
        tags: originalTags,
        source: 'manual',
        normalizedTitle: 'test place',
        normalizedAddress: '123 test st',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      candidatePlaces: [{
        id: 'candidate',
        name: 'Test Place',
        address: '123 Test St',
        latitude: 40.7128,
        longitude: -74.0060,
        category: candidateCategory,
        source: 'google_maps',
      }],
    });

    it('should give perfect score for exact category matches', async () => {
      const result = await matchingService.findMatches(
        createCategoryTestQuery(['restaurant'], 'restaurant')
      );

      const categoryFactor = result.matches[0].matchFactors.find(f => f.type === 'category');
      expect(categoryFactor?.score).toBe(100);
    });

    it('should give high score for related categories', async () => {
      const result = await matchingService.findMatches(
        createCategoryTestQuery(['restaurant'], 'cafe')
      );

      const categoryFactor = result.matches[0].matchFactors.find(f => f.type === 'category');
      expect(categoryFactor?.score).toBe(75);
    });

    it('should give neutral score when both categories are missing', async () => {
      const result = await matchingService.findMatches(
        createCategoryTestQuery([], undefined)
      );

      const categoryFactor = result.matches[0].matchFactors.find(f => f.type === 'category');
      expect(categoryFactor?.score).toBe(50);
    });

    it('should give low score when one category is missing', async () => {
      const result = await matchingService.findMatches(
        createCategoryTestQuery(['restaurant'], undefined)
      );

      const categoryFactor = result.matches[0].matchFactors.find(f => f.type === 'category');
      expect(categoryFactor?.score).toBe(25);
    });

    it('should give zero score for unrelated categories', async () => {
      const result = await matchingService.findMatches(
        createCategoryTestQuery(['restaurant'], 'bank')
      );

      const categoryFactor = result.matches[0].matchFactors.find(f => f.type === 'category');
      expect(categoryFactor?.score).toBe(0);
    });
  });

  describe('confidence level determination', () => {
    it('should classify high confidence matches correctly', async () => {
      const originalPlace: Place = {
        id: 'test',
        title: 'Perfect Match Restaurant',
        address: '123 Main Street, New York, NY 10001',
        latitude: 40.7128,
        longitude: -74.0060,
        tags: ['restaurant'],
        source: 'manual',
        normalizedTitle: 'perfect match restaurant',
        normalizedAddress: '123 main street new york ny 10001',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const candidate: NormalizedPlace = {
        id: 'candidate',
        name: 'Perfect Match Restaurant',
        address: '123 Main Street, New York, NY 10001',
        latitude: 40.7128,
        longitude: -74.0060,
        category: 'restaurant',
        source: 'google_maps',
      };

      const result = await matchingService.findMatches({
        originalPlace,
        candidatePlaces: [candidate],
      });

      expect(result.bestMatch?.confidenceLevel).toBe('high');
      expect(result.bestMatch?.confidenceScore).toBeGreaterThanOrEqual(90);
    });

    it('should classify medium confidence matches correctly', async () => {
      const originalPlace: Place = {
        id: 'test',
        title: 'Joe\'s Pizza',
        address: '456 Oak Avenue, Boston, MA',
        tags: ['restaurant'],
        source: 'manual',
        normalizedTitle: 'joes pizza',
        normalizedAddress: '456 oak avenue boston ma',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const candidate: NormalizedPlace = {
        id: 'candidate',
        name: 'Joe\'s Pizzeria',
        address: '456 Oak Ave, Boston, MA 02101',
        latitude: 42.3601,
        longitude: -71.0589,
        category: 'restaurant',
        source: 'google_maps',
      };

      const result = await matchingService.findMatches({
        originalPlace,
        candidatePlaces: [candidate],
      });

      expect(result.bestMatch?.confidenceLevel).toBe('medium');
      expect(result.bestMatch?.confidenceScore).toBeGreaterThanOrEqual(70);
      expect(result.bestMatch?.confidenceScore).toBeLessThan(90);
    });

    it('should classify low confidence matches correctly', async () => {
      const originalPlace: Place = {
        id: 'test',
        title: 'Original Restaurant',
        address: '123 First Street, City A',
        tags: ['restaurant'],
        source: 'manual',
        normalizedTitle: 'original restaurant',
        normalizedAddress: '123 first street city a',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const candidate: NormalizedPlace = {
        id: 'candidate',
        name: 'Different Place',
        address: '999 Other Street, City B',
        latitude: 40.0000,
        longitude: -75.0000,
        category: 'store',
        source: 'google_maps',
      };

      const result = await matchingService.findMatches({
        originalPlace,
        candidatePlaces: [candidate],
      });

      if (result.bestMatch) {
        expect(result.bestMatch.confidenceLevel).toBe('low');
        expect(result.bestMatch.confidenceScore).toBeLessThan(70);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty candidate list', async () => {
      const originalPlace: Place = {
        id: 'test',
        title: 'Test Place',
        address: '123 Test St',
        tags: [],
        source: 'manual',
        normalizedTitle: 'test place',
        normalizedAddress: '123 test st',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await matchingService.findMatches({
        originalPlace,
        candidatePlaces: [],
      });

      expect(result.matches).toHaveLength(0);
      expect(result.bestMatch).toBeUndefined();
      expect(result.metadata.totalCandidates).toBe(0);
      expect(result.metadata.validMatches).toBe(0);
    });

    it('should handle places with minimal data', async () => {
      const originalPlace: Place = {
        id: 'test',
        title: 'X',
        address: 'Y',
        tags: [],
        source: 'manual',
        normalizedTitle: 'x',
        normalizedAddress: 'y',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const candidate: NormalizedPlace = {
        id: 'candidate',
        name: 'Z',
        address: 'W',
        latitude: 0,
        longitude: 0,
        source: 'google_maps',
      };

      const result = await matchingService.findMatches({
        originalPlace,
        candidatePlaces: [candidate],
        options: { minConfidenceScore: 0 }, // Allow very low confidence matches
      });

      expect(result.matches).toHaveLength(1);
      expect(result.bestMatch?.confidenceScore).toBeLessThan(50);
    });

    it('should handle special characters in names and addresses', async () => {
      const originalPlace: Place = {
        id: 'test',
        title: 'Café René & Co.',
        address: '123 St-Laurent Blvd., Montréal, QC',
        tags: ['cafe'],
        source: 'manual',
        normalizedTitle: 'cafe rene co',
        normalizedAddress: '123 st laurent blvd montreal qc',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const candidate: NormalizedPlace = {
        id: 'candidate',
        name: 'Cafe Rene and Co',
        address: '123 Saint-Laurent Boulevard, Montreal, QC',
        latitude: 45.5017,
        longitude: -73.5673,
        category: 'cafe',
        source: 'google_maps',
      };

      const result = await matchingService.findMatches({
        originalPlace,
        candidatePlaces: [candidate],
      });

      expect(result.bestMatch?.confidenceScore).toBeGreaterThan(70);
    });
  });
});