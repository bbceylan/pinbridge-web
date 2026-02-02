/**
 * Tests for enhanced confidence scoring system
 * 
 * **Validates: Requirements 2.2, 2.3, 2.4**
 */

import { PlaceMatchingService } from '../place-matching';
import type { Place } from '@/types';
import type { NormalizedPlace } from '../../api/response-normalizer';

describe('Enhanced Confidence Scoring System', () => {
  let matchingService: PlaceMatchingService;

  beforeEach(() => {
    matchingService = new PlaceMatchingService();
  });

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

  describe('Score Calibration', () => {
    it('should include calibration information in match results', async () => {
      const originalPlace = createMockPlace();
      const candidate = createMockCandidate();

      const result = await matchingService.findMatches({
        originalPlace,
        candidatePlaces: [candidate],
      });

      expect(result.bestMatch?.calibrationInfo).toBeDefined();
      expect(result.bestMatch?.calibrationInfo.rawScore).toBeGreaterThan(0);
      expect(result.bestMatch?.calibrationInfo.calibratedScore).toBeGreaterThan(0);
      expect(result.bestMatch?.calibrationInfo.qualityIndicators).toBeDefined();
      expect(result.bestMatch?.calibrationInfo.calibrationFactors).toBeInstanceOf(Array);
    });

    it('should apply minimal calibration for high-quality matches', async () => {
      const originalPlace = createMockPlace({
        title: 'Perfect Match Restaurant',
        address: '123 Main Street, New York, NY 10001',
        latitude: 40.7128,
        longitude: -74.0060,
      });

      const candidate = createMockCandidate({
        name: 'Perfect Match Restaurant',
        address: '123 Main Street, New York, NY 10001',
        latitude: 40.7128,
        longitude: -74.0060,
      });

      const result = await matchingService.findMatches({
        originalPlace,
        candidatePlaces: [candidate],
      });

      const calibrationInfo = result.bestMatch?.calibrationInfo;
      expect(calibrationInfo?.rawScore).toBeGreaterThan(95);
      expect(Math.abs(calibrationInfo!.calibratedScore - calibrationInfo!.rawScore)).toBeLessThan(5);
    });

    it('should calculate quality indicators correctly', async () => {
      const originalPlace = createMockPlace();
      const candidate = createMockCandidate();

      const result = await matchingService.findMatches({
        originalPlace,
        candidatePlaces: [candidate],
      });

      const qualityIndicators = result.bestMatch?.calibrationInfo.qualityIndicators;
      expect(qualityIndicators?.dataCompleteness).toBeGreaterThanOrEqual(0);
      expect(qualityIndicators?.dataCompleteness).toBeLessThanOrEqual(100);
      expect(qualityIndicators?.matchConsistency).toBeGreaterThanOrEqual(0);
      expect(qualityIndicators?.matchConsistency).toBeLessThanOrEqual(100);
      expect(qualityIndicators?.geographicReliability).toBeGreaterThanOrEqual(0);
      expect(qualityIndicators?.geographicReliability).toBeLessThanOrEqual(100);
    });
  });

  describe('Match Factor Debugging', () => {
    it('should include detailed debugging information for each match factor', async () => {
      const originalPlace = createMockPlace();
      const candidate = createMockCandidate();

      const result = await matchingService.findMatches({
        originalPlace,
        candidatePlaces: [candidate],
      });

      const matchFactors = result.bestMatch?.matchFactors;
      expect(matchFactors).toHaveLength(4); // name, address, distance, category

      matchFactors?.forEach(factor => {
        expect(factor.type).toMatch(/^(name|address|distance|category)$/);
        expect(factor.score).toBeGreaterThanOrEqual(0);
        expect(factor.score).toBeLessThanOrEqual(100);
        expect(factor.weight).toBeGreaterThan(0);
        expect(factor.weightedScore).toBeGreaterThanOrEqual(0);
        expect(factor.explanation).toBeTruthy();
        expect(factor.debugInfo).toBeDefined();
        expect(factor.debugInfo?.rawInputs).toBeDefined();
        expect(factor.debugInfo?.calculationSteps).toBeInstanceOf(Array);
      });
    });

    it('should provide detailed calculation steps for name matching', async () => {
      const originalPlace = createMockPlace({
        title: 'Joe\'s Pizza Palace',
      });

      const candidate = createMockCandidate({
        name: 'Joe\'s Pizza',
      });

      const result = await matchingService.findMatches({
        originalPlace,
        candidatePlaces: [candidate],
      });

      const nameFactor = result.bestMatch?.matchFactors.find(f => f.type === 'name');
      expect(nameFactor?.debugInfo?.calculationSteps).toBeDefined();
      expect(nameFactor?.debugInfo?.calculationSteps.length).toBeGreaterThan(0);
      
      const steps = nameFactor?.debugInfo?.calculationSteps;
      expect(steps?.some(step => step.step === 'normalization')).toBe(true);
      expect(steps?.some(step => step.step === 'final_score')).toBe(true);
    });

    it('should track bonuses and penalties in debugging info', async () => {
      const originalPlace = createMockPlace({
        title: 'McDonald\'s Big Mac Restaurant',
      });

      const candidate = createMockCandidate({
        name: 'McDonald\'s',
      });

      const result = await matchingService.findMatches({
        originalPlace,
        candidatePlaces: [candidate],
      });

      const nameFactor = result.bestMatch?.matchFactors.find(f => f.type === 'name');
      expect(nameFactor?.debugInfo?.bonuses).toBeDefined();
      
      // This should trigger a partial match bonus since "McDonald's" is contained in "McDonald's Big Mac Restaurant"
      expect(nameFactor?.debugInfo?.bonuses?.length).toBeGreaterThan(0);
      
      // Should specifically have a partial match bonus
      const hasPartialMatchBonus = nameFactor?.debugInfo?.bonuses?.some(b => b.type === 'partial_match');
      expect(hasPartialMatchBonus).toBe(true);
    });
  });

  describe('Debug Summary Generation', () => {
    it('should generate comprehensive debug summary', async () => {
      const originalPlace = createMockPlace();
      const candidate = createMockCandidate();

      const result = await matchingService.findMatches({
        originalPlace,
        candidatePlaces: [candidate],
      });

      const debugSummary = result.bestMatch?.debugSummary;
      expect(debugSummary).toBeDefined();
      expect(debugSummary?.totalProcessingTimeMs).toBeGreaterThanOrEqual(0);
      expect(debugSummary?.factorContributions).toHaveLength(4);
      expect(debugSummary?.potentialIssues).toBeInstanceOf(Array);
      expect(debugSummary?.recommendations).toBeInstanceOf(Array);
    });

    it('should calculate factor contributions correctly', async () => {
      const originalPlace = createMockPlace();
      const candidate = createMockCandidate();

      const result = await matchingService.findMatches({
        originalPlace,
        candidatePlaces: [candidate],
      });

      const factorContributions = result.bestMatch?.debugSummary.factorContributions;
      expect(factorContributions).toHaveLength(4);

      const totalContribution = factorContributions?.reduce((sum, fc) => sum + fc.contribution, 0);
      expect(totalContribution).toBe(100); // Should sum to 100%

      factorContributions?.forEach(fc => {
        expect(fc.factor).toMatch(/^(name|address|distance|category)$/);
        expect(fc.contribution).toBeGreaterThanOrEqual(0);
        expect(fc.contribution).toBeLessThanOrEqual(100);
        expect(fc.reliability).toMatch(/^(high|medium|low)$/);
      });
    });

    it('should identify potential issues with incomplete data', async () => {
      const originalPlace = createMockPlace({
        title: 'X', // Minimal data
        address: 'Y',
        latitude: undefined,
        longitude: undefined,
        tags: [],
      });

      const candidate = createMockCandidate({
        name: 'Z',
        address: 'W',
        latitude: undefined,
        longitude: undefined,
        category: undefined,
      });

      const result = await matchingService.findMatches({
        originalPlace,
        candidatePlaces: [candidate],
        options: { minConfidenceScore: 0 },
      });

      const debugSummary = result.bestMatch?.debugSummary;
      expect(debugSummary?.potentialIssues.length).toBeGreaterThan(0);
      expect(debugSummary?.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Confidence Level Categorization', () => {
    it('should correctly categorize high confidence matches (90-100)', async () => {
      const originalPlace = createMockPlace({
        title: 'Exact Match Place',
        address: '123 Perfect Street, City, State 12345',
        latitude: 40.7128,
        longitude: -74.0060,
      });

      const candidate = createMockCandidate({
        name: 'Exact Match Place',
        address: '123 Perfect Street, City, State 12345',
        latitude: 40.7128,
        longitude: -74.0060,
      });

      const result = await matchingService.findMatches({
        originalPlace,
        candidatePlaces: [candidate],
      });

      expect(result.bestMatch?.confidenceLevel).toBe('high');
      expect(result.bestMatch?.confidenceScore).toBeGreaterThanOrEqual(90);
    });

    it('should correctly categorize medium confidence matches (70-89)', async () => {
      const originalPlace = createMockPlace({
        title: 'Tony\'s Italian Restaurant',
        address: '456 Oak Street, Boston, MA',
        latitude: undefined, // No coordinates to reduce confidence
        longitude: undefined,
        tags: ['restaurant'],
      });

      const candidate = createMockCandidate({
        name: 'Tony\'s Italian Bistro',
        address: '456 Oak St, Boston, MA 02101',
        latitude: undefined,
        longitude: undefined,
        category: 'restaurant',
      });

      const result = await matchingService.findMatches({
        originalPlace,
        candidatePlaces: [candidate],
      });

      // Should be medium confidence due to similar but not identical names
      expect(result.bestMatch?.confidenceLevel).toBe('medium');
      expect(result.bestMatch?.confidenceScore).toBeGreaterThanOrEqual(70);
      expect(result.bestMatch?.confidenceScore).toBeLessThan(90);
    });

    it('should correctly categorize low confidence matches (0-69)', async () => {
      const originalPlace = createMockPlace({
        title: 'Original Place',
        address: '123 First Street, City A',
      });

      const candidate = createMockCandidate({
        name: 'Different Place',
        address: '999 Other Street, City B',
      });

      const result = await matchingService.findMatches({
        originalPlace,
        candidatePlaces: [candidate],
        options: { minConfidenceScore: 0 },
      });

      if (result.bestMatch) {
        expect(result.bestMatch.confidenceLevel).toBe('low');
        expect(result.bestMatch.confidenceScore).toBeLessThan(70);
      }
    });
  });

  describe('Match Factor Explanation Generation', () => {
    it('should provide clear explanations for each match factor', async () => {
      const originalPlace = createMockPlace();
      const candidate = createMockCandidate();

      const result = await matchingService.findMatches({
        originalPlace,
        candidatePlaces: [candidate],
      });

      const matchFactors = result.bestMatch?.matchFactors;
      matchFactors?.forEach(factor => {
        expect(factor.explanation).toBeTruthy();
        expect(typeof factor.explanation).toBe('string');
        expect(factor.explanation.length).toBeGreaterThan(10); // Should be descriptive
      });
    });

    it('should explain distance calculations when coordinates are available', async () => {
      const originalPlace = createMockPlace({
        latitude: 40.7128,
        longitude: -74.0060,
      });

      const candidate = createMockCandidate({
        latitude: 40.7130,
        longitude: -74.0062,
      });

      const result = await matchingService.findMatches({
        originalPlace,
        candidatePlaces: [candidate],
      });

      const distanceFactor = result.bestMatch?.matchFactors.find(f => f.type === 'distance');
      expect(distanceFactor?.explanation).toContain('match');
      expect(distanceFactor?.details?.distanceMeters).toBeDefined();
    });

    it('should explain when distance calculation is not possible', async () => {
      const originalPlace = createMockPlace({
        latitude: undefined,
        longitude: undefined,
      });

      const candidate = createMockCandidate({
        latitude: undefined,
        longitude: undefined,
      });

      const result = await matchingService.findMatches({
        originalPlace,
        candidatePlaces: [candidate],
      });

      const distanceFactor = result.bestMatch?.matchFactors.find(f => f.type === 'distance');
      expect(distanceFactor?.explanation).toContain('No coordinates available');
      expect(distanceFactor?.score).toBe(0);
    });
  });
});