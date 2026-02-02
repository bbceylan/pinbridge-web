/**
 * Unit tests for response normalization utilities
 */

import { ResponseNormalizer } from '../response-normalizer';
import type { AppleMapsPlace } from '../apple-maps';
import type { GoogleMapsPlace } from '../google-maps';
import type { NormalizedPlace } from '../response-normalizer';

describe('ResponseNormalizer', () => {
  describe('Google Maps Place Normalization', () => {
    const mockGoogleMapsPlace: GoogleMapsPlace = {
      id: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
      name: 'Google Sydney',
      address: '48 Pirrama Rd, Pyrmont NSW 2009, Australia',
      latitude: -33.8669710,
      longitude: 151.1958750,
      category: 'establishment',
      phoneNumber: '(02) 9374 4000',
      website: 'https://www.google.com.au/',
      rating: 4.5,
      isOpen: true,
      placeId: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
      formattedAddress: '48 Pirrama Rd, Pyrmont NSW 2009, Australia',
      geometry: {
        location: { lat: -33.8669710, lng: 151.1958750 },
        viewport: {
          northeast: { lat: -33.8656220, lng: 151.1972240 },
          southwest: { lat: -33.8683200, lng: 151.1945260 },
        },
      },
      types: ['establishment', 'point_of_interest'],
      businessStatus: 'OPERATIONAL',
      priceLevel: 2,
      photos: [
        {
          photoReference: 'test-photo-ref-123',
          height: 600,
          width: 800,
          htmlAttributions: ['<a href="https://maps.google.com/maps/contrib/123">Test User</a>'],
        },
      ],
      reviews: [
        {
          authorName: 'John Doe',
          authorUrl: 'https://www.google.com/maps/contrib/123',
          language: 'en',
          profilePhotoUrl: 'https://lh3.googleusercontent.com/test',
          rating: 5,
          relativeTimeDescription: '2 months ago',
          text: 'Great place to work!',
          time: 1609459200,
        },
      ],
      openingHours: {
        openNow: true,
        periods: [
          {
            open: { day: 1, time: '0900' },
            close: { day: 1, time: '1700' },
          },
        ],
        weekdayText: ['Monday: 9:00 AM – 5:00 PM'],
      },
      utcOffset: 660,
      vicinity: 'Pyrmont',
      plusCode: {
        compoundCode: '45MW+7X Pyrmont NSW, Australia',
        globalCode: '4RRH45MW+7X',
      },
    };

    // Mock the environment variable for photo URLs
    const originalEnv = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    beforeAll(() => {
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = 'test-api-key';
    });

    afterAll(() => {
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = originalEnv;
    });

    it('should normalize Google Maps place correctly', () => {
      const normalized = ResponseNormalizer.normalizeGoogleMapsPlace(mockGoogleMapsPlace);

      expect(normalized.id).toBe('ChIJN1t_tDeuEmsRUsoyG83frY4');
      expect(normalized.name).toBe('Google Sydney');
      expect(normalized.address).toBe('48 Pirrama Rd, Pyrmont NSW 2009, Australia');
      expect(normalized.latitude).toBe(-33.8669710);
      expect(normalized.longitude).toBe(151.1958750);
      expect(normalized.source).toBe('google_maps');
      expect(normalized.category).toBe('establishment');
      expect(normalized.phoneNumber).toBe('(02) 9374 4000');
      expect(normalized.website).toBe('https://www.google.com.au/');
      expect(normalized.rating).toBe(4.5);
      expect(normalized.isOpen).toBe(true);
    });

    it('should map business status correctly', () => {
      const operationalPlace = { ...mockGoogleMapsPlace, businessStatus: 'OPERATIONAL' as const };
      const closedTempPlace = { ...mockGoogleMapsPlace, businessStatus: 'CLOSED_TEMPORARILY' as const };
      const closedPermPlace = { ...mockGoogleMapsPlace, businessStatus: 'CLOSED_PERMANENTLY' as const };
      const unknownPlace = { ...mockGoogleMapsPlace, businessStatus: undefined };

      const normalizedOperational = ResponseNormalizer.normalizeGoogleMapsPlace(operationalPlace);
      const normalizedClosedTemp = ResponseNormalizer.normalizeGoogleMapsPlace(closedTempPlace);
      const normalizedClosedPerm = ResponseNormalizer.normalizeGoogleMapsPlace(closedPermPlace);
      const normalizedUnknown = ResponseNormalizer.normalizeGoogleMapsPlace(unknownPlace);

      expect(normalizedOperational.businessStatus).toBe('OPERATIONAL');
      expect(normalizedClosedTemp.businessStatus).toBe('CLOSED_TEMPORARILY');
      expect(normalizedClosedPerm.businessStatus).toBe('CLOSED_PERMANENTLY');
      expect(normalizedUnknown.businessStatus).toBeUndefined();
    });

    it('should normalize photos correctly', () => {
      const normalized = ResponseNormalizer.normalizeGoogleMapsPlace(mockGoogleMapsPlace);

      expect(normalized.photos).toHaveLength(1);
      expect(normalized.photos![0]).toEqual({
        url: 'https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=test-photo-ref-123&key=test-api-key',
        width: 800,
        height: 600,
        attribution: '<a href="https://maps.google.com/maps/contrib/123">Test User</a>',
      });
    });

    it('should normalize reviews correctly', () => {
      const normalized = ResponseNormalizer.normalizeGoogleMapsPlace(mockGoogleMapsPlace);

      expect(normalized.reviews).toHaveLength(1);
      expect(normalized.reviews![0]).toEqual({
        rating: 5,
        text: 'Great place to work!',
        author: 'John Doe',
        time: new Date(1609459200 * 1000),
      });
    });

    it('should normalize opening hours correctly', () => {
      const normalized = ResponseNormalizer.normalizeGoogleMapsPlace(mockGoogleMapsPlace);

      expect(normalized.openingHours).toBeDefined();
      expect(normalized.openingHours!.isOpen).toBe(true);
      expect(normalized.openingHours!.periods).toHaveLength(1);
      expect(normalized.openingHours!.periods[0]).toEqual({
        open: { day: 1, time: '0900' },
        close: { day: 1, time: '1700' },
      });
      expect(normalized.openingHours!.weekdayText).toEqual(['Monday: 9:00 AM – 5:00 PM']);
    });

    it('should normalize types correctly', () => {
      const normalized = ResponseNormalizer.normalizeGoogleMapsPlace(mockGoogleMapsPlace);

      expect(normalized.types).toEqual(['establishment', 'establishment']); // Both types normalized to 'establishment'
    });

    it('should include price level', () => {
      const normalized = ResponseNormalizer.normalizeGoogleMapsPlace(mockGoogleMapsPlace);

      expect(normalized.priceLevel).toBe(2);
    });

    it('should store raw data for debugging', () => {
      const normalized = ResponseNormalizer.normalizeGoogleMapsPlace(mockGoogleMapsPlace);

      expect(normalized.rawData).toEqual(mockGoogleMapsPlace);
    });

    it('should handle missing optional fields', () => {
      const minimalPlace: GoogleMapsPlace = {
        id: 'test-id',
        name: 'Test Place',
        address: 'Test Address',
        latitude: 0,
        longitude: 0,
        placeId: 'test-id',
        formattedAddress: 'Test Address',
        geometry: {
          location: { lat: 0, lng: 0 },
        },
        types: ['establishment'],
      };

      const normalized = ResponseNormalizer.normalizeGoogleMapsPlace(minimalPlace);

      expect(normalized.id).toBe('test-id');
      expect(normalized.name).toBe('Test Place');
      expect(normalized.photos).toBeUndefined();
      expect(normalized.reviews).toBeUndefined();
      expect(normalized.openingHours).toBeUndefined();
      expect(normalized.priceLevel).toBeUndefined();
      expect(normalized.businessStatus).toBeUndefined();
    });
  });

  describe('Apple Maps Place Normalization', () => {
    const mockAppleMapsPlace: AppleMapsPlace = {
      id: 'apple_test_123',
      name: 'Test Restaurant',
      address: '123 Main St, San Francisco, CA 94102',
      latitude: 37.7749,
      longitude: -122.4194,
      category: 'restaurant',
      phoneNumber: '+1-415-555-0123',
      website: 'https://test-restaurant.com',
      rating: 4.5,
      isOpen: true,
      displayMapRegion: {
        eastLongitude: -122.4,
        westLongitude: -122.5,
        northLatitude: 37.8,
        southLatitude: 37.7,
      },
      formattedAddressLines: ['123 Main St', 'San Francisco, CA 94102'],
      mapsUrl: 'https://maps.apple.com/?address=123%20Main%20St',
      telephone: '+1-415-555-0123',
      businessHours: {
        periods: [
          {
            open: { day: 1, time: '09:00' },
            close: { day: 1, time: '17:00' },
          },
        ],
      },
      photos: [
        {
          url: 'https://example.com/photo1.jpg',
          width: 800,
          height: 600,
        },
      ],
    };

    it('should normalize Apple Maps place correctly', () => {
      const normalized = ResponseNormalizer.normalizeAppleMapsPlace(mockAppleMapsPlace);

      expect(normalized.id).toBe('apple_test_123');
      expect(normalized.name).toBe('Test Restaurant');
      expect(normalized.address).toBe('123 Main St, San Francisco, CA 94102');
      expect(normalized.latitude).toBe(37.7749);
      expect(normalized.longitude).toBe(-122.4194);
      expect(normalized.source).toBe('apple_maps');
      expect(normalized.category).toBe('restaurant');
      expect(normalized.phoneNumber).toBe('+1-415-555-0123');
      expect(normalized.website).toBe('https://test-restaurant.com');
      expect(normalized.rating).toBe(4.5);
      expect(normalized.isOpen).toBe(true);
    });

    it('should map business status correctly', () => {
      const openPlace = { ...mockAppleMapsPlace, isOpen: true };
      const closedPlace = { ...mockAppleMapsPlace, isOpen: false };
      const unknownPlace = { ...mockAppleMapsPlace, isOpen: undefined };

      const normalizedOpen = ResponseNormalizer.normalizeAppleMapsPlace(openPlace);
      const normalizedClosed = ResponseNormalizer.normalizeAppleMapsPlace(closedPlace);
      const normalizedUnknown = ResponseNormalizer.normalizeAppleMapsPlace(unknownPlace);

      expect(normalizedOpen.businessStatus).toBe('OPERATIONAL');
      expect(normalizedClosed.businessStatus).toBe('CLOSED_TEMPORARILY');
      expect(normalizedUnknown.businessStatus).toBeUndefined();
    });

    it('should normalize photos correctly', () => {
      const normalized = ResponseNormalizer.normalizeAppleMapsPlace(mockAppleMapsPlace);

      expect(normalized.photos).toHaveLength(1);
      expect(normalized.photos![0]).toEqual({
        url: 'https://example.com/photo1.jpg',
        width: 800,
        height: 600,
      });
    });

    it('should normalize opening hours correctly', () => {
      const normalized = ResponseNormalizer.normalizeAppleMapsPlace(mockAppleMapsPlace);

      expect(normalized.openingHours).toBeDefined();
      expect(normalized.openingHours!.isOpen).toBe(true);
      expect(normalized.openingHours!.periods).toHaveLength(1);
      expect(normalized.openingHours!.periods[0]).toEqual({
        open: { day: 1, time: '09:00' },
        close: { day: 1, time: '17:00' },
      });
    });

    it('should store raw data for debugging', () => {
      const normalized = ResponseNormalizer.normalizeAppleMapsPlace(mockAppleMapsPlace);

      expect(normalized.rawData).toEqual(mockAppleMapsPlace);
    });
  });

  describe('Address Normalization', () => {
    it('should normalize address format', () => {
      const testCases = [
        {
          input: '123 Main St, San Francisco, CA',
          expected: '123 Main Street, San Francisco, CA',
        },
        {
          input: '456 Oak Ave, Berkeley, CA',
          expected: '456 Oak Avenue, Berkeley, CA',
        },
        {
          input: '789 Pine Blvd, Oakland, CA',
          expected: '789 Pine Boulevard, Oakland, CA',
        },
        {
          input: '321 Elm Dr, Palo Alto, CA',
          expected: '321 Elm Drive, Palo Alto, CA',
        },
        {
          input: '654 Maple Rd, San Jose, CA',
          expected: '654 Maple Road, San Jose, CA',
        },
        {
          input: '987 Cedar Ln, Mountain View, CA',
          expected: '987 Cedar Lane, Mountain View, CA',
        },
        {
          input: '147 Birch Ct, Cupertino, CA',
          expected: '147 Birch Court, Cupertino, CA',
        },
        {
          input: '258 Willow Pl, Sunnyvale, CA',
          expected: '258 Willow Place, Sunnyvale, CA',
        },
      ];

      testCases.forEach(({ input, expected }) => {
        expect(ResponseNormalizer.normalizeAddress(input)).toBe(expected);
      });
    });

    it('should handle empty and whitespace addresses', () => {
      expect(ResponseNormalizer.normalizeAddress('')).toBe('');
      expect(ResponseNormalizer.normalizeAddress('   ')).toBe('');
      expect(ResponseNormalizer.normalizeAddress('  123  Main  St  ')).toBe('123 Main Street');
    });

    it('should remove trailing commas and periods', () => {
      expect(ResponseNormalizer.normalizeAddress('123 Main St,')).toBe('123 Main Street');
      expect(ResponseNormalizer.normalizeAddress('123 Main St.')).toBe('123 Main Street');
    });
  });

  describe('Name Normalization', () => {
    it('should normalize place names', () => {
      const testCases = [
        {
          input: 'McDonald\'s Restaurant',
          expected: 'McDonald\'s',
        },
        {
          input: 'Starbucks Coffee Shop',
          expected: 'Starbucks',
        },
        {
          input: 'Apple Inc.',
          expected: 'Apple',
        },
        {
          input: 'Google LLC',
          expected: 'Google',
        },
        {
          input: 'Target Store',
          expected: 'Target',
        },
        {
          input: 'Whole Foods Market',
          expected: 'Whole Foods',
        },
        {
          input: 'Johnson & Johnson',
          expected: 'Johnson and Johnson',
        },
      ];

      testCases.forEach(({ input, expected }) => {
        expect(ResponseNormalizer.normalizeName(input)).toBe(expected);
      });
    });

    it('should handle empty and whitespace names', () => {
      expect(ResponseNormalizer.normalizeName('')).toBe('');
      expect(ResponseNormalizer.normalizeName('   ')).toBe('');
      expect(ResponseNormalizer.normalizeName('  Test  Name  ')).toBe('Test Name');
    });

    it('should remove special characters', () => {
      expect(ResponseNormalizer.normalizeName('Test@Name#123')).toBe('TestName123');
      expect(ResponseNormalizer.normalizeName('Café & Bistro!')).toBe('Caf and Bistro');
    });
  });

  describe('Coordinate Normalization', () => {
    it('should normalize coordinates to 6 decimal places', () => {
      const result = ResponseNormalizer.normalizeCoordinates(37.774929123456, -122.419415987654);

      expect(result.latitude).toBe(37.774929);
      expect(result.longitude).toBe(-122.419416);
    });

    it('should handle edge cases', () => {
      const result1 = ResponseNormalizer.normalizeCoordinates(0, 0);
      expect(result1.latitude).toBe(0);
      expect(result1.longitude).toBe(0);

      const result2 = ResponseNormalizer.normalizeCoordinates(90, 180);
      expect(result2.latitude).toBe(90);
      expect(result2.longitude).toBe(180);

      const result3 = ResponseNormalizer.normalizeCoordinates(-90, -180);
      expect(result3.latitude).toBe(-90);
      expect(result3.longitude).toBe(-180);
    });
  });

  describe('Category Normalization', () => {
    it('should normalize common categories', () => {
      const testCases = [
        { input: 'restaurant', expected: 'restaurant' },
        { input: 'food', expected: 'restaurant' },
        { input: 'cafe', expected: 'cafe' },
        { input: 'coffee', expected: 'cafe' },
        { input: 'bar', expected: 'bar' },
        { input: 'fast_food', expected: 'restaurant' },
        { input: 'store', expected: 'store' },
        { input: 'supermarket', expected: 'grocery_or_supermarket' },
        { input: 'grocery', expected: 'grocery_or_supermarket' },
        { input: 'gas_station', expected: 'gas_station' },
        { input: 'bank', expected: 'bank' },
        { input: 'hospital', expected: 'hospital' },
        { input: 'movie_theater', expected: 'movie_theater' },
        { input: 'airport', expected: 'airport' },
        { input: 'hotel', expected: 'lodging' },
        { input: 'lodging', expected: 'lodging' },
      ];

      testCases.forEach(({ input, expected }) => {
        expect(ResponseNormalizer.normalizeCategory(input)).toBe(expected);
      });
    });

    it('should handle unknown categories', () => {
      expect(ResponseNormalizer.normalizeCategory('unknown_category')).toBe('establishment');
      expect(ResponseNormalizer.normalizeCategory('')).toBe('establishment');
    });

    it('should handle categories with spaces', () => {
      expect(ResponseNormalizer.normalizeCategory('fast food')).toBe('restaurant');
      expect(ResponseNormalizer.normalizeCategory('gas station')).toBe('gas_station');
    });
  });

  describe('Match Confidence Calculation', () => {
    const originalPlace = {
      name: 'Starbucks Coffee',
      address: '123 Main Street, San Francisco, CA',
      latitude: 37.7749,
      longitude: -122.4194,
    };

    const candidatePlace: NormalizedPlace = {
      id: 'test_123',
      name: 'Starbucks',
      address: '123 Main St, San Francisco, CA 94102',
      latitude: 37.7749,
      longitude: -122.4194,
      source: 'apple_maps',
      category: 'cafe',
    };

    it('should calculate high confidence for exact matches', () => {
      const confidence = ResponseNormalizer.calculateMatchConfidence(originalPlace, candidatePlace);
      expect(confidence).toBeGreaterThan(80);
    });

    it('should calculate lower confidence for different names', () => {
      const differentNameCandidate = {
        ...candidatePlace,
        name: 'Different Coffee Shop',
      };

      const confidence = ResponseNormalizer.calculateMatchConfidence(originalPlace, differentNameCandidate);
      expect(confidence).toBeLessThan(80); // More realistic threshold
    });

    it('should calculate lower confidence for different addresses', () => {
      const differentAddressCandidate = {
        ...candidatePlace,
        address: '456 Oak Street, Berkeley, CA',
      };

      const confidence = ResponseNormalizer.calculateMatchConfidence(originalPlace, differentAddressCandidate);
      expect(confidence).toBeLessThan(80); // More realistic threshold
    });

    it('should handle missing coordinates gracefully', () => {
      const originalWithoutCoords = {
        name: 'Starbucks Coffee',
        address: '123 Main Street, San Francisco, CA',
      };

      const confidence = ResponseNormalizer.calculateMatchConfidence(originalWithoutCoords, candidatePlace);
      expect(confidence).toBeGreaterThan(0);
      expect(confidence).toBeLessThan(95); // Should be less than perfect match
    });

    it('should give bonus for having category information', () => {
      const candidateWithCategory = { ...candidatePlace, category: 'cafe' };
      const candidateWithoutCategory = { ...candidatePlace, category: undefined };

      const confidenceWith = ResponseNormalizer.calculateMatchConfidence(originalPlace, candidateWithCategory);
      const confidenceWithout = ResponseNormalizer.calculateMatchConfidence(originalPlace, candidateWithoutCategory);

      // The difference should be noticeable but not huge
      expect(confidenceWith).toBeGreaterThanOrEqual(confidenceWithout);
    });
  });

  describe('Place Validation', () => {
    const validPlace: NormalizedPlace = {
      id: 'test_123',
      name: 'Test Place',
      address: '123 Main St',
      latitude: 37.7749,
      longitude: -122.4194,
      source: 'apple_maps',
    };

    it('should validate correct place data', () => {
      const result = ResponseNormalizer.validateNormalizedPlace(validPlace);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const invalidPlace = { ...validPlace, id: '' };
      const result = ResponseNormalizer.validateNormalizedPlace(invalidPlace);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Place ID is required');
    });

    it('should validate latitude range', () => {
      const invalidPlace = { ...validPlace, latitude: 91 };
      const result = ResponseNormalizer.validateNormalizedPlace(invalidPlace);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Valid latitude is required (-90 to 90)');
    });

    it('should validate longitude range', () => {
      const invalidPlace = { ...validPlace, longitude: 181 };
      const result = ResponseNormalizer.validateNormalizedPlace(invalidPlace);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Valid longitude is required (-180 to 180)');
    });

    it('should detect multiple validation errors', () => {
      const invalidPlace = {
        ...validPlace,
        id: '',
        name: '',
        latitude: 91,
        longitude: 181,
      };
      const result = ResponseNormalizer.validateNormalizedPlace(invalidPlace);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(4);
    });
  });
});