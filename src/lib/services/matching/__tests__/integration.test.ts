/**
 * Integration tests for PlaceMatchingService with API services
 */

import { PlaceMatchingService } from '../place-matching';
import { ResponseNormalizer } from '../../api/response-normalizer';
import type { Place } from '@/types';
import type { GoogleMapsPlace } from '../../api/google-maps';
import type { AppleMapsPlace } from '../../api/apple-maps';

describe('PlaceMatchingService Integration', () => {
  let matchingService: PlaceMatchingService;

  beforeEach(() => {
    matchingService = new PlaceMatchingService();
  });

  describe('integration with Google Maps API responses', () => {
    it('should match places from Google Maps search results', async () => {
      const originalPlace: Place = {
        id: 'original-1',
        title: 'Central Park',
        address: 'New York, NY',
        latitude: 40.7829,
        longitude: -73.9654,
        tags: ['park'],
        source: 'manual',
        normalizedTitle: 'central park',
        normalizedAddress: 'new york ny',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock Google Maps API response
      const googleMapsPlace: GoogleMapsPlace = {
        id: 'ChIJ4zGFAZpYwokRGUGph3Mf37k',
        name: 'Central Park',
        address: 'New York, NY, USA',
        latitude: 40.7829,
        longitude: -73.9654,
        category: 'park',
        rating: 4.6,
        isOpen: true,
        placeId: 'ChIJ4zGFAZpYwokRGUGph3Mf37k',
        formattedAddress: 'New York, NY, USA',
        geometry: {
          location: { lat: 40.7829, lng: -73.9654 },
        },
        types: ['park', 'point_of_interest', 'establishment'],
        businessStatus: 'OPERATIONAL',
      };

      // Normalize the Google Maps response
      const normalizedCandidate = ResponseNormalizer.normalizeGoogleMapsPlace(googleMapsPlace);

      const result = await matchingService.findMatches({
        originalPlace,
        candidatePlaces: [normalizedCandidate],
      });

      expect(result.matches).toHaveLength(1);
      expect(result.bestMatch?.confidenceScore).toBeGreaterThan(90);
      expect(result.bestMatch?.confidenceLevel).toBe('high');
      
      // Check that all match factors are present
      const matchFactors = result.bestMatch!.matchFactors;
      expect(matchFactors).toHaveLength(4);
      expect(matchFactors.find(f => f.type === 'name')).toBeDefined();
      expect(matchFactors.find(f => f.type === 'address')).toBeDefined();
      expect(matchFactors.find(f => f.type === 'distance')).toBeDefined();
      expect(matchFactors.find(f => f.type === 'category')).toBeDefined();
    });

    it('should handle Google Maps places with detailed information', async () => {
      const originalPlace: Place = {
        id: 'original-2',
        title: 'Joe\'s Pizza',
        address: '123 Broadway, New York, NY 10001',
        latitude: 40.7505,
        longitude: -73.9934,
        tags: ['restaurant'],
        source: 'manual',
        normalizedTitle: 'joes pizza',
        normalizedAddress: '123 broadway new york ny 10001',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const googleMapsPlace: GoogleMapsPlace = {
        id: 'test-place-id',
        name: 'Joe\'s Pizza Restaurant',
        address: '123 Broadway, New York, NY 10001, USA',
        latitude: 40.7505,
        longitude: -73.9934,
        category: 'restaurant',
        phoneNumber: '+1 212-555-0123',
        website: 'https://joespizza.com',
        rating: 4.2,
        isOpen: true,
        placeId: 'test-place-id',
        formattedAddress: '123 Broadway, New York, NY 10001, USA',
        geometry: {
          location: { lat: 40.7505, lng: -73.9934 },
        },
        types: ['restaurant', 'food', 'point_of_interest', 'establishment'],
        businessStatus: 'OPERATIONAL',
        priceLevel: 2,
      };

      const normalizedCandidate = ResponseNormalizer.normalizeGoogleMapsPlace(googleMapsPlace);

      const result = await matchingService.findMatches({
        originalPlace,
        candidatePlaces: [normalizedCandidate],
      });

      expect(result.matches).toHaveLength(1);
      expect(result.bestMatch?.confidenceScore).toBeGreaterThan(85);
      
      // Verify that the normalized data is properly used
      expect(result.bestMatch?.candidatePlace.source).toBe('google_maps');
      expect(result.bestMatch?.candidatePlace.phoneNumber).toBe('+1 212-555-0123');
      expect(result.bestMatch?.candidatePlace.website).toBe('https://joespizza.com');
    });
  });

  describe('integration with Apple Maps API responses', () => {
    it('should match places from Apple Maps search results', async () => {
      const originalPlace: Place = {
        id: 'original-3',
        title: 'Apple Park',
        address: 'Cupertino, CA',
        latitude: 37.3349,
        longitude: -122.0090,
        tags: ['establishment'], // Use a more generic tag
        source: 'manual',
        normalizedTitle: 'apple park',
        normalizedAddress: 'cupertino ca',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock Apple Maps API response
      const appleMapsPlace: AppleMapsPlace = {
        id: 'apple_applepark_373349_1220090',
        name: 'Apple Park',
        address: '1 Apple Park Way, Cupertino, CA 95014',
        latitude: 37.3349,
        longitude: -122.0090,
        category: 'establishment', // Use a more generic category
        rating: 4.5,
        isOpen: true,
        displayMapRegion: {
          eastLongitude: -122.0080,
          westLongitude: -122.0100,
          northLatitude: 37.3359,
          southLatitude: 37.3339,
        },
        formattedAddressLines: ['1 Apple Park Way', 'Cupertino, CA 95014'],
        mapsUrl: 'https://maps.apple.com/?q=Apple%20Park',
      };

      const normalizedCandidate = ResponseNormalizer.normalizeAppleMapsPlace(appleMapsPlace);

      const result = await matchingService.findMatches({
        originalPlace,
        candidatePlaces: [normalizedCandidate],
      });

      expect(result.matches).toHaveLength(1);
      expect(result.bestMatch?.confidenceScore).toBeGreaterThanOrEqual(75);
      expect(result.bestMatch?.confidenceLevel).toBe('medium');
      
      // Verify Apple Maps specific data is preserved
      expect(result.bestMatch?.candidatePlace.source).toBe('apple_maps');
      expect(result.bestMatch?.candidatePlace.rawData).toBeDefined();
    });
  });

  describe('cross-platform matching scenarios', () => {
    it('should rank multiple candidates from different sources correctly', async () => {
      const originalPlace: Place = {
        id: 'original-4',
        title: 'Starbucks Coffee',
        address: '456 Market Street, San Francisco, CA',
        latitude: 37.7749,
        longitude: -122.4194,
        tags: ['cafe'],
        source: 'manual',
        normalizedTitle: 'starbucks coffee',
        normalizedAddress: '456 market street san francisco ca',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Google Maps candidate (exact match)
      const googleCandidate: GoogleMapsPlace = {
        id: 'google-starbucks-1',
        name: 'Starbucks',
        address: '456 Market St, San Francisco, CA 94102',
        latitude: 37.7749,
        longitude: -122.4194,
        category: 'cafe',
        rating: 4.1,
        placeId: 'google-starbucks-1',
        formattedAddress: '456 Market St, San Francisco, CA 94102',
        geometry: { location: { lat: 37.7749, lng: -122.4194 } },
        types: ['cafe', 'food', 'point_of_interest'],
        businessStatus: 'OPERATIONAL',
      };

      // Apple Maps candidate (slightly different address)
      const appleCandidate: AppleMapsPlace = {
        id: 'apple-starbucks-1',
        name: 'Starbucks Coffee',
        address: '456 Market Street, San Francisco, CA 94102',
        latitude: 37.7750, // Slightly different coordinates
        longitude: -122.4195,
        category: 'cafe',
        rating: 4.0,
        displayMapRegion: {
          eastLongitude: -122.4185,
          westLongitude: -122.4205,
          northLatitude: 37.7760,
          southLatitude: 37.7740,
        },
        formattedAddressLines: ['456 Market Street', 'San Francisco, CA 94102'],
      };

      // Different place (should rank lower)
      const differentPlace: GoogleMapsPlace = {
        id: 'different-cafe',
        name: 'Blue Bottle Coffee',
        address: '789 Mission Street, San Francisco, CA',
        latitude: 37.7849,
        longitude: -122.4094,
        category: 'cafe',
        rating: 4.3,
        placeId: 'different-cafe',
        formattedAddress: '789 Mission Street, San Francisco, CA',
        geometry: { location: { lat: 37.7849, lng: -122.4094 } },
        types: ['cafe', 'food'],
        businessStatus: 'OPERATIONAL',
      };

      const candidates = [
        ResponseNormalizer.normalizeGoogleMapsPlace(googleCandidate),
        ResponseNormalizer.normalizeAppleMapsPlace(appleCandidate),
        ResponseNormalizer.normalizeGoogleMapsPlace(differentPlace),
      ];

      const result = await matchingService.findMatches({
        originalPlace,
        candidatePlaces: candidates,
      });

      expect(result.matches.length).toBeGreaterThanOrEqual(2);
      
      // The Google candidate should rank highest (exact coordinates)
      expect(result.bestMatch?.candidatePlace.source).toBe('google_maps');
      expect(result.bestMatch?.candidatePlace.id).toBe('google-starbucks-1');
      
      // Apple candidate should rank second
      expect(result.matches[1].candidatePlace.source).toBe('apple_maps');
      expect(result.matches[1].candidatePlace.id).toBe('apple-starbucks-1');
      
      // Different place should rank lowest
      const differentMatch = result.matches.find(m => m.candidatePlace.id === 'different-cafe');
      expect(differentMatch?.rank).toBeGreaterThan(2);
    });

    it('should handle places with missing coordinate data', async () => {
      const originalPlace: Place = {
        id: 'original-5',
        title: 'Local Business',
        address: '123 Main Street, Anytown, USA',
        // No coordinates
        tags: ['business'],
        source: 'manual',
        normalizedTitle: 'local business',
        normalizedAddress: '123 main street anytown usa',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const candidateWithCoords: GoogleMapsPlace = {
        id: 'candidate-with-coords',
        name: 'Local Business',
        address: '123 Main St, Anytown, USA',
        latitude: 40.0000,
        longitude: -75.0000,
        category: 'establishment',
        placeId: 'candidate-with-coords',
        formattedAddress: '123 Main St, Anytown, USA',
        geometry: { location: { lat: 40.0000, lng: -75.0000 } },
        types: ['establishment'],
      };

      const result = await matchingService.findMatches({
        originalPlace,
        candidatePlaces: [ResponseNormalizer.normalizeGoogleMapsPlace(candidateWithCoords)],
      });

      expect(result.matches).toHaveLength(1);
      
      // Should still get a good match based on name and address
      expect(result.bestMatch?.confidenceScore).toBeGreaterThan(70);
      
      // Distance factor should have 0 score due to missing original coordinates
      const distanceFactor = result.bestMatch?.matchFactors.find(f => f.type === 'distance');
      expect(distanceFactor?.score).toBe(0);
      expect(distanceFactor?.explanation).toContain('No coordinates available');
    });
  });

  describe('performance with realistic data volumes', () => {
    it('should handle multiple candidates efficiently', async () => {
      const originalPlace: Place = {
        id: 'perf-test',
        title: 'McDonald\'s',
        address: 'Times Square, New York, NY',
        latitude: 40.7589,
        longitude: -73.9851,
        tags: ['restaurant'],
        source: 'manual',
        normalizedTitle: 'mcdonalds',
        normalizedAddress: 'times square new york ny',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Generate 20 candidates with varying similarity
      const candidates = Array.from({ length: 20 }, (_, i) => {
        const googlePlace: GoogleMapsPlace = {
          id: `candidate-${i}`,
          name: i < 5 ? 'McDonald\'s' : `Restaurant ${i}`,
          address: i < 5 ? `${i + 1} Times Square, New York, NY` : `${i + 100} Random St, New York, NY`,
          latitude: 40.7589 + (Math.random() - 0.5) * 0.01, // Within ~500m
          longitude: -73.9851 + (Math.random() - 0.5) * 0.01,
          category: 'restaurant',
          placeId: `candidate-${i}`,
          formattedAddress: i < 5 ? `${i + 1} Times Square, New York, NY` : `${i + 100} Random St, New York, NY`,
          geometry: { 
            location: { 
              lat: 40.7589 + (Math.random() - 0.5) * 0.01, 
              lng: -73.9851 + (Math.random() - 0.5) * 0.01 
            } 
          },
          types: ['restaurant', 'food'],
        };
        return ResponseNormalizer.normalizeGoogleMapsPlace(googlePlace);
      });

      const startTime = Date.now();
      const result = await matchingService.findMatches({
        originalPlace,
        candidatePlaces: candidates,
      });
      const endTime = Date.now();

      // Should complete within reasonable time (< 100ms for 20 candidates)
      expect(endTime - startTime).toBeLessThan(100);
      
      // Should find matches and rank them correctly
      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.bestMatch?.candidatePlace.name).toBe('McDonald\'s');
      
      // Processing time should be recorded
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.metadata.totalCandidates).toBe(20);
    });
  });
});
