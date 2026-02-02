/**
 * Tests for place normalization utilities
 */

import {
  NameNormalizer,
  AddressNormalizer,
  CoordinateValidator,
  CategoryMapper,
  PlaceNormalizer,
  type NormalizedPlaceData,
  type AddressComponents,
  type CoordinateValidation,
  type TextCleaningOptions,
} from '../place-normalization';
import type { Place } from '@/types';
import type { NormalizedPlace } from '../../api/response-normalizer';

describe('NameNormalizer', () => {
  describe('normalize', () => {
    it('should handle basic name normalization', () => {
      expect(NameNormalizer.normalize('McDonald\'s Restaurant')).toBe('mcdonalds');
      expect(NameNormalizer.normalize('Starbucks Coffee')).toBe('starbucks');
      expect(NameNormalizer.normalize('Target Store')).toBe('target');
    });

    it('should remove accents and diacritics', () => {
      expect(NameNormalizer.normalize('Café René')).toBe('cafe rene');
      expect(NameNormalizer.normalize('Piñata Fiesta')).toBe('pinata fiesta');
      expect(NameNormalizer.normalize('Naïve Café')).toBe('naive');
    });

    it('should standardize symbols and punctuation', () => {
      expect(NameNormalizer.normalize('Ben & Jerry\'s')).toBe('ben and jerrys');
      expect(NameNormalizer.normalize('H&M Store')).toBe('h and m');
      expect(NameNormalizer.normalize('AT&T™ Store')).toBe('at and t');
    });

    it('should remove business suffixes', () => {
      expect(NameNormalizer.normalize('Apple Inc.')).toBe('apple');
      expect(NameNormalizer.normalize('Microsoft Corporation')).toBe('microsoft');
      expect(NameNormalizer.normalize('Joe\'s Pizza LLC')).toBe('joes pizza');
    });

    it('should handle empty and invalid inputs', () => {
      expect(NameNormalizer.normalize('')).toBe('');
      expect(NameNormalizer.normalize('   ')).toBe('');
      expect(NameNormalizer.normalize(null as any)).toBe('');
      expect(NameNormalizer.normalize(undefined as any)).toBe('');
    });

    it('should respect normalization options', () => {
      const options: TextCleaningOptions = {
        removeBusinessSuffixes: false,
        expandAbbreviations: true,
      };
      expect(NameNormalizer.normalize('St. Mary\'s Hospital Inc.', options)).toBe('saint marys hospital inc');
    });

    it('should handle international characters', () => {
      expect(NameNormalizer.normalize('Björk\'s Café')).toBe('bjorks');
      expect(NameNormalizer.normalize('José María Restaurant')).toBe('jose maria');
      expect(NameNormalizer.normalize('François Boulangerie')).toBe('francois boulangerie');
    });
  });

  describe('generateSearchTokens', () => {
    it('should generate comprehensive search tokens', () => {
      const tokens = NameNormalizer.generateSearchTokens('McDonald\'s Restaurant');
      expect(tokens).toContain('mcdonalds');
      expect(tokens.length).toBeGreaterThan(0);
    });

    it('should handle multi-word names', () => {
      const tokens = NameNormalizer.generateSearchTokens('New York Pizza Company');
      expect(tokens).toContain('new york pizza');
      expect(tokens).toContain('new york');
      expect(tokens).toContain('york pizza');
      expect(tokens).toContain('pizza');
    });

    it('should filter short tokens', () => {
      const tokens = NameNormalizer.generateSearchTokens('A B C Restaurant');
      expect(tokens).not.toContain('a');
      expect(tokens).not.toContain('b');
      expect(tokens).not.toContain('c');
    });
  });
});

describe('AddressNormalizer', () => {
  describe('normalize', () => {
    it('should normalize basic addresses', () => {
      expect(AddressNormalizer.normalize('123 Main St.')).toBe('123 main street');
      expect(AddressNormalizer.normalize('456 Oak Ave')).toBe('456 oak avenue');
      expect(AddressNormalizer.normalize('789 First Blvd.')).toBe('789 first boulevard');
    });

    it('should expand street abbreviations', () => {
      expect(AddressNormalizer.normalize('100 N. Main St.')).toBe('100 north main street');
      expect(AddressNormalizer.normalize('200 SE Oak Dr')).toBe('200 southeast oak drive');
      expect(AddressNormalizer.normalize('300 W Elm Ct.')).toBe('300 west elm court');
    });

    it('should handle international addresses', () => {
      expect(AddressNormalizer.normalize('123 Rue de la Paix')).toBe('123 rue de la paix');
      expect(AddressNormalizer.normalize('456 Boul. Saint-Laurent')).toBe('456 boulevard saint-laurent');
    });

    it('should preserve address structure', () => {
      const address = '123 Main St, New York, NY 10001';
      const normalized = AddressNormalizer.normalize(address);
      expect(normalized).toBe('123 main street, new york, ny 10001');
    });

    it('should handle empty and invalid inputs', () => {
      expect(AddressNormalizer.normalize('')).toBe('');
      expect(AddressNormalizer.normalize('   ')).toBe('');
      expect(AddressNormalizer.normalize(null as any)).toBe('');
    });
  });

  describe('extractComponents', () => {
    it('should extract US address components', () => {
      const components = AddressNormalizer.extractComponents('123 Main Street, New York, NY 10001');
      expect(components.streetNumber).toBe('123');
      expect(components.streetName).toBe('main street');
      expect(components.city).toBe('New York');
      expect(components.region).toBe('NY');
      expect(components.postalCode).toBe('10001');
    });

    it('should extract Canadian address components', () => {
      const components = AddressNormalizer.extractComponents('456 Oak Ave, Toronto, ON M5V 3A8');
      expect(components.streetNumber).toBe('456');
      expect(components.streetName).toBe('oak avenue');
      expect(components.city).toBe('Toronto');
      expect(components.region).toBe('ON');
      expect(components.postalCode).toBe('M5V3A8');
    });

    it('should handle addresses without all components', () => {
      const components = AddressNormalizer.extractComponents('Main Street, Anytown');
      expect(components.streetNumber).toBeUndefined();
      expect(components.streetName).toBeDefined();
      expect(components.city).toBe('Anytown');
    });

    it('should extract complex street numbers', () => {
      const components = AddressNormalizer.extractComponents('123A-125B Main St');
      expect(components.streetNumber).toBe('123A-125B');
    });

    it('should handle international postal codes', () => {
      const ukComponents = AddressNormalizer.extractComponents('10 Downing Street, London SW1A 2AA');
      expect(ukComponents.postalCode).toBe('SW1A2AA');

      const germanComponents = AddressNormalizer.extractComponents('Unter den Linden 1, Berlin 10117');
      expect(germanComponents.postalCode).toBe('10117');
    });
  });
});

describe('CoordinateValidator', () => {
  describe('validate', () => {
    it('should validate correct coordinates', () => {
      const result = CoordinateValidator.validate(40.7128, -74.0060);
      expect(result.isValid).toBe(true);
      expect(result.latitude).toBeCloseTo(40.7128, 6);
      expect(result.longitude).toBeCloseTo(-74.0060, 6);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid latitude', () => {
      const result = CoordinateValidator.validate(91, -74.0060);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Latitude must be between -90 and 90');
    });

    it('should reject invalid longitude', () => {
      const result = CoordinateValidator.validate(40.7128, 181);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Longitude must be between -180 and 180');
    });

    it('should handle string coordinates', () => {
      const result = CoordinateValidator.validate('40.7128', '-74.0060');
      expect(result.isValid).toBe(true);
      expect(result.latitude).toBeCloseTo(40.7128, 6);
    });

    it('should reject non-numeric strings', () => {
      const result = CoordinateValidator.validate('invalid', '-74.0060');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Coordinates are not valid numbers');
    });

    it('should handle null/undefined values', () => {
      const result = CoordinateValidator.validate(null, undefined);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing coordinate values');
    });

    it('should flag suspicious (0,0) coordinates', () => {
      const result = CoordinateValidator.validate(0, 0);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Coordinates (0,0) are likely invalid');
    });

    it('should estimate coordinate precision', () => {
      const exactResult = CoordinateValidator.validate(40.712345, -74.006789);
      expect(exactResult.precision).toBe('exact');

      const cityResult = CoordinateValidator.validate(40.71, -74.00);
      expect(cityResult.precision).toBe('city');

      const regionResult = CoordinateValidator.validate(40, -74);
      expect(regionResult.precision).toBe('region');
    });
  });

  describe('calculateDistance', () => {
    it('should calculate distance between coordinates', () => {
      // Distance between NYC and LA (approximately 3936 km)
      const distance = CoordinateValidator.calculateDistance(
        40.7128, -74.0060, // NYC
        34.0522, -118.2437  // LA
      );
      expect(distance).toBeCloseTo(3936000, -3); // Within 1km accuracy
    });

    it('should return 0 for identical coordinates', () => {
      const distance = CoordinateValidator.calculateDistance(40.7128, -74.0060, 40.7128, -74.0060);
      expect(distance).toBeCloseTo(0, 1);
    });

    it('should handle coordinates across the date line', () => {
      const distance = CoordinateValidator.calculateDistance(
        35.6762, 139.6503, // Tokyo
        21.3099, -157.8581  // Honolulu
      );
      expect(distance).toBeGreaterThan(0);
    });
  });
});

describe('CategoryMapper', () => {
  describe('normalize', () => {
    it('should normalize known categories', () => {
      expect(CategoryMapper.normalize('restaurant')).toBe('restaurant');
      expect(CategoryMapper.normalize('food')).toBe('restaurant');
      expect(CategoryMapper.normalize('meal_takeaway')).toBe('restaurant');
    });

    it('should handle case variations', () => {
      expect(CategoryMapper.normalize('RESTAURANT')).toBe('restaurant');
      expect(CategoryMapper.normalize('Restaurant')).toBe('restaurant');
      expect(CategoryMapper.normalize('Fast Food')).toBe('restaurant');
    });

    it('should return establishment for unknown categories', () => {
      expect(CategoryMapper.normalize('unknown_category')).toBe('establishment');
      expect(CategoryMapper.normalize('')).toBe('establishment');
      expect(CategoryMapper.normalize(null as any)).toBe('establishment');
    });

    it('should handle fuzzy matching', () => {
      expect(CategoryMapper.normalize('restaurante')).toBe('restaurant'); // Spanish
      expect(CategoryMapper.normalize('pharmacie')).toBe('pharmacy'); // French
    });
  });

  describe('getVariations', () => {
    it('should return all variations for a category', () => {
      const variations = CategoryMapper.getVariations('restaurant');
      expect(variations).toContain('restaurant');
      expect(variations).toContain('food');
      expect(variations).toContain('meal_takeaway');
    });

    it('should handle unknown categories', () => {
      const variations = CategoryMapper.getVariations('unknown');
      expect(variations).toContain('establishment');
    });
  });

  describe('calculateSimilarity', () => {
    it('should return 100 for identical categories', () => {
      expect(CategoryMapper.calculateSimilarity('restaurant', 'restaurant')).toBe(100);
    });

    it('should return 75 for related categories', () => {
      expect(CategoryMapper.calculateSimilarity('restaurant', 'cafe')).toBe(75);
      expect(CategoryMapper.calculateSimilarity('store', 'shopping_mall')).toBe(75);
    });

    it('should return 0 for unrelated categories', () => {
      expect(CategoryMapper.calculateSimilarity('restaurant', 'hospital')).toBe(0);
    });

    it('should handle missing categories', () => {
      expect(CategoryMapper.calculateSimilarity(undefined, undefined)).toBe(50);
      expect(CategoryMapper.calculateSimilarity('restaurant', undefined)).toBe(25);
    });
  });
});

describe('PlaceNormalizer', () => {
  const mockPlace: Place = {
    id: '1',
    title: 'McDonald\'s Restaurant',
    address: '123 Main St, New York, NY 10001',
    latitude: 40.7128,
    longitude: -74.0060,
    notes: 'Great burgers',
    tags: ['restaurant', 'fast_food'],
    source: 'google',
    sourceUrl: 'https://example.com',
    normalizedTitle: 'mcdonalds restaurant',
    normalizedAddress: '123 main st new york ny 10001',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockApiPlace: NormalizedPlace = {
    id: 'api-1',
    name: 'McDonald\'s',
    address: '123 Main Street, New York, NY 10001',
    latitude: 40.7128,
    longitude: -74.0060,
    category: 'restaurant',
    rating: 4.2,
    priceLevel: 1,
    phoneNumber: '+1-555-0123',
    website: 'https://mcdonalds.com',
    businessStatus: 'OPERATIONAL',
  };

  describe('normalizePlaceData', () => {
    it('should normalize a Place object', () => {
      const normalized = PlaceNormalizer.normalizePlaceData(mockPlace);
      
      expect(normalized.name).toBe('mcdonalds');
      expect(normalized.address).toBe('123 main street, new york, ny 10001');
      expect(normalized.category).toBe('restaurant');
      expect(normalized.coordinates?.isValid).toBe(true);
      expect(normalized.coordinates?.latitude).toBeCloseTo(40.7128, 6);
      expect(normalized.addressComponents.streetNumber).toBe('123');
      expect(normalized.searchTokens).toContain('mcdonalds');
      expect(normalized.metadata.originalName).toBe('McDonald\'s Restaurant');
    });

    it('should handle places without coordinates', () => {
      const placeWithoutCoords = { ...mockPlace, latitude: undefined, longitude: undefined };
      const normalized = PlaceNormalizer.normalizePlaceData(placeWithoutCoords);
      
      expect(normalized.coordinates).toBeUndefined();
      expect(normalized.metadata.normalizationFlags).not.toContain('invalid_coordinates');
    });

    it('should flag invalid coordinates', () => {
      const placeWithInvalidCoords = { ...mockPlace, latitude: 91, longitude: 181 };
      const normalized = PlaceNormalizer.normalizePlaceData(placeWithInvalidCoords);
      
      expect(normalized.coordinates).toBeUndefined();
      expect(normalized.metadata.normalizationFlags).toContain('invalid_coordinates');
    });

    it('should handle places without categories', () => {
      const placeWithoutCategory = { ...mockPlace, tags: [] };
      const normalized = PlaceNormalizer.normalizePlaceData(placeWithoutCategory);
      
      expect(normalized.category).toBe('establishment');
      expect(normalized.metadata.originalCategory).toBeUndefined();
    });
  });

  describe('normalizeApiPlace', () => {
    it('should normalize an API place object', () => {
      const normalized = PlaceNormalizer.normalizeApiPlace(mockApiPlace);
      
      expect(normalized.name).toBe('mcdonalds');
      expect(normalized.address).toBe('123 main street, new york, ny 10001');
      expect(normalized.category).toBe('restaurant');
      expect(normalized.coordinates?.isValid).toBe(true);
      expect(normalized.metadata.originalName).toBe('McDonald\'s');
    });
  });

  describe('cleanText', () => {
    it('should clean text with default options', () => {
      const cleaned = PlaceNormalizer.cleanText('McDonald\'s Restaurant Inc.');
      expect(cleaned).toBe('mcdonalds restaurant');
    });

    it('should clean text with custom options', () => {
      const cleaned = PlaceNormalizer.cleanText('McDonald\'s Restaurant Inc.', {
        removeBusinessSuffixes: false,
      });
      expect(cleaned).toBe('mcdonalds restaurant inc');
    });
  });

  describe('batchNormalize', () => {
    it('should normalize multiple places', () => {
      const places = [mockPlace, { ...mockPlace, id: '2', title: 'Starbucks Coffee' }];
      const normalized = PlaceNormalizer.batchNormalize(places);
      
      expect(normalized).toHaveLength(2);
      expect(normalized[0].name).toBe('mcdonalds');
      expect(normalized[1].name).toBe('starbucks');
    });
  });

  describe('calculateSimilarity', () => {
    it('should calculate similarity between normalized places', () => {
      const place1 = PlaceNormalizer.normalizePlaceData(mockPlace);
      const place2 = PlaceNormalizer.normalizeApiPlace(mockApiPlace);
      
      const similarity = PlaceNormalizer.calculateSimilarity(place1, place2);
      
      expect(similarity.overall).toBeGreaterThan(80); // Should be very similar
      expect(similarity.factors.name).toBeGreaterThan(80);
      expect(similarity.factors.address).toBeGreaterThan(80);
      expect(similarity.factors.distance).toBeGreaterThan(90); // Same coordinates
      expect(similarity.factors.category).toBe(100); // Same category
    });

    it('should handle places without coordinates', () => {
      const place1 = PlaceNormalizer.normalizePlaceData({
        ...mockPlace,
        latitude: undefined,
        longitude: undefined,
      });
      const place2 = PlaceNormalizer.normalizeApiPlace({
        ...mockApiPlace,
        latitude: undefined,
        longitude: undefined,
      });
      
      const similarity = PlaceNormalizer.calculateSimilarity(place1, place2);
      
      expect(similarity.factors.distance).toBe(0); // No coordinates
      expect(similarity.overall).toBeGreaterThan(0); // Still some similarity from other factors
    });
  });
});

describe('Edge Cases and International Support', () => {
  describe('International addresses', () => {
    it('should handle UK addresses', () => {
      const components = AddressNormalizer.extractComponents('10 Downing Street, Westminster, London SW1A 2AA, UK');
      expect(components.streetNumber).toBe('10');
      expect(components.streetName).toBe('downing street');
      expect(components.postalCode).toBe('SW1A2AA');
    });

    it('should handle German addresses', () => {
      const components = AddressNormalizer.extractComponents('Unter den Linden 1, 10117 Berlin, Germany');
      expect(components.streetName).toBe('unter den linden');
      expect(components.postalCode).toBe('10117');
    });

    it('should handle French addresses', () => {
      const normalized = AddressNormalizer.normalize('123 Rue de la République, Paris');
      expect(normalized).toBe('123 rue de la republique, paris');
    });
  });

  describe('Special characters and encoding', () => {
    it('should handle various Unicode characters', () => {
      const normalized = NameNormalizer.normalize('Москва́ Restaurant'); // Russian
      expect(normalized).toBeDefined();
      expect(normalized.length).toBeGreaterThan(0);
    });

    it('should handle emoji and special symbols', () => {
      const normalized = NameNormalizer.normalize('Pizza 🍕 Palace ™');
      expect(normalized).toBe('pizza palace');
    });

    it('should handle mixed scripts', () => {
      const normalized = NameNormalizer.normalize('Tokyo 東京 Sushi');
      expect(normalized).toContain('tokyo');
      expect(normalized).toContain('sushi');
    });
  });

  describe('Performance with large inputs', () => {
    it('should handle very long place names', () => {
      const longName = 'A'.repeat(1000) + ' Restaurant';
      const normalized = NameNormalizer.normalize(longName);
      expect(normalized).toBeDefined();
      expect(normalized.length).toBeLessThan(longName.length);
    });

    it('should handle very long addresses', () => {
      const longAddress = '123 ' + 'Very Long Street Name '.repeat(50) + ', City';
      const normalized = AddressNormalizer.normalize(longAddress);
      expect(normalized).toBeDefined();
    });
  });

  describe('Malformed data handling', () => {
    it('should handle malformed coordinates gracefully', () => {
      const result = CoordinateValidator.validate('not-a-number', 'also-not-a-number');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle addresses with unusual formatting', () => {
      const components = AddressNormalizer.extractComponents('123,,, Main St,,,, City');
      expect(components.streetNumber).toBe('123');
      expect(components.streetName).toBeDefined();
    });

    it('should handle names with excessive punctuation', () => {
      const normalized = NameNormalizer.normalize('!!!McDonald\'s!!! Restaurant???');
      expect(normalized).toBe('mcdonalds restaurant');
    });
  });
});