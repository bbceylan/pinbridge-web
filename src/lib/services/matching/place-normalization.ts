/**
 * Place normalization utilities for intelligent matching
 * 
 * This module provides comprehensive normalization functions for place data
 * to support accurate matching between different mapping services.
 * Handles various edge cases and international formats while maintaining
 * consistency across different mapping services.
 */

import type { Place } from '@/types';
import type { NormalizedPlace } from '../api/response-normalizer';

// Coordinate validation constants
const LATITUDE_MIN = -90;
const LATITUDE_MAX = 90;
const LONGITUDE_MIN = -180;
const LONGITUDE_MAX = 180;

// Common business suffixes to remove during name normalization
const BUSINESS_SUFFIXES = [
  'llc', 'inc', 'corp', 'ltd', 'co', 'company', 'corporation', 'limited',
  'restaurant', 'cafe', 'coffee', 'shop', 'store', 'market', 'deli',
  'bar', 'pub', 'grill', 'bistro', 'eatery', 'kitchen', 'house',
  'center', 'centre', 'plaza', 'mall', 'outlet', 'emporium',
  'services', 'service', 'group', 'associates', 'partners',
  'solutions', 'systems', 'technologies', 'tech'
];

// Street type abbreviations mapping
const STREET_ABBREVIATIONS: Record<string, string> = {
  // English abbreviations
  'st': 'street',
  'ave': 'avenue',
  'blvd': 'boulevard',
  'dr': 'drive',
  'rd': 'road',
  'ln': 'lane',
  'ct': 'court',
  'pl': 'place',
  'pkwy': 'parkway',
  'hwy': 'highway',
  'fwy': 'freeway',
  'expy': 'expressway',
  'trl': 'trail',
  'cir': 'circle',
  'sq': 'square',
  'ter': 'terrace',
  'way': 'way',
  'walk': 'walk',
  'path': 'path',
  'row': 'row',
  'mews': 'mews',
  'gdns': 'gardens',
  'pk': 'park',
  'est': 'estate',
  'cl': 'close',
  'crescent': 'crescent',
  'cres': 'crescent',
  
  // French abbreviations
  'rue': 'rue',
  'av': 'avenue',
  'boul': 'boulevard',
  'ch': 'chemin',
  'rte': 'route',
  'autoroute': 'autoroute',
  
  // Directional abbreviations
  'n': 'north',
  'ne': 'northeast',
  'e': 'east',
  'se': 'southeast',
  's': 'south',
  'sw': 'southwest',
  'w': 'west',
  'nw': 'northwest',
};

// Category mapping between different service taxonomies
const CATEGORY_MAPPINGS: Record<string, string[]> = {
  // Food & Dining
  'restaurant': ['restaurant', 'food', 'meal_takeaway', 'meal_delivery', 'establishment'],
  'cafe': ['cafe', 'coffee_shop', 'bakery', 'establishment'],
  'bar': ['bar', 'night_club', 'liquor_store', 'establishment'],
  'fast_food': ['meal_takeaway', 'restaurant', 'food', 'establishment'],
  'bakery': ['bakery', 'cafe', 'food', 'establishment'],
  
  // Shopping
  'store': ['store', 'establishment', 'point_of_interest'],
  'shopping_mall': ['shopping_mall', 'store', 'establishment'],
  'supermarket': ['grocery_or_supermarket', 'food', 'store', 'establishment'],
  'grocery': ['grocery_or_supermarket', 'supermarket', 'food', 'store'],
  'gas_station': ['gas_station', 'establishment'],
  'clothing_store': ['clothing_store', 'store', 'establishment'],
  'electronics_store': ['electronics_store', 'store', 'establishment'],
  
  // Services
  'bank': ['bank', 'atm', 'finance', 'establishment'],
  'hospital': ['hospital', 'health', 'establishment'],
  'pharmacy': ['pharmacy', 'health', 'establishment'],
  'post_office': ['post_office', 'establishment'],
  'police': ['police', 'establishment'],
  'fire_station': ['fire_station', 'establishment'],
  'library': ['library', 'establishment'],
  'school': ['school', 'university', 'establishment'],
  'gym': ['gym', 'health', 'establishment'],
  
  // Entertainment & Recreation
  'movie_theater': ['movie_theater', 'entertainment', 'establishment'],
  'amusement_park': ['amusement_park', 'tourist_attraction', 'establishment'],
  'museum': ['museum', 'tourist_attraction', 'establishment'],
  'park': ['park', 'tourist_attraction', 'establishment'],
  'zoo': ['zoo', 'tourist_attraction', 'establishment'],
  'stadium': ['stadium', 'establishment'],
  
  // Transportation
  'airport': ['airport', 'establishment'],
  'subway_station': ['subway_station', 'transit_station', 'establishment'],
  'train_station': ['train_station', 'transit_station', 'establishment'],
  'bus_station': ['bus_station', 'transit_station', 'establishment'],
  'taxi_stand': ['taxi_stand', 'establishment'],
  
  // Lodging
  'lodging': ['lodging', 'establishment'],
  'hotel': ['lodging', 'establishment'],
  'motel': ['lodging', 'establishment'],
  
  // Religious
  'church': ['church', 'place_of_worship', 'establishment'],
  'mosque': ['mosque', 'place_of_worship', 'establishment'],
  'synagogue': ['synagogue', 'place_of_worship', 'establishment'],
  'temple': ['hindu_temple', 'place_of_worship', 'establishment'],
  
  // Government
  'city_hall': ['city_hall', 'local_government_office', 'establishment'],
  'courthouse': ['courthouse', 'establishment'],
  'embassy': ['embassy', 'establishment'],
  
  // Default
  'establishment': ['establishment', 'point_of_interest'],
};

// Postal code patterns for different countries/regions
const POSTAL_CODE_PATTERNS = [
  // US ZIP codes (12345 or 12345-6789)
  /\b\d{5}(?:-\d{4})?\b/,
  // Canadian postal codes (A1A 1A1 or A1A1A1)
  /\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/i,
  // UK postal codes (various formats)
  /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/i,
  // German postal codes (12345)
  /\b\d{5}\b/,
  // French postal codes (12345)
  /\b\d{5}\b/,
  // Australian postal codes (1234)
  /\b\d{4}\b/,
];

/**
 * Normalized place data structure for matching
 */
export interface NormalizedPlaceData {
  name: string;
  address: string;
  coordinates?: {
    latitude: number;
    longitude: number;
    isValid: boolean;
    precision?: 'exact' | 'approximate' | 'city' | 'region';
  };
  category: string;
  addressComponents: AddressComponents;
  searchTokens: string[];
  metadata: {
    originalName: string;
    originalAddress: string;
    originalCategory?: string;
    normalizationFlags: string[];
  };
}

/**
 * Address components for detailed matching
 */
export interface AddressComponents {
  streetNumber?: string;
  streetName?: string;
  city?: string;
  region?: string; // State/Province
  country?: string;
  postalCode?: string;
  neighborhood?: string;
  sublocality?: string;
}

/**
 * Text cleaning and preprocessing options
 */
export interface TextCleaningOptions {
  removeAccents?: boolean;
  removePunctuation?: boolean;
  normalizeWhitespace?: boolean;
  toLowerCase?: boolean;
  removeBusinessSuffixes?: boolean;
  expandAbbreviations?: boolean;
}

/**
 * Coordinate validation result
 */
export interface CoordinateValidation {
  isValid: boolean;
  latitude?: number;
  longitude?: number;
  errors: string[];
  precision?: 'exact' | 'approximate' | 'city' | 'region';
}

/**
 * Name normalization utilities
 */
export class NameNormalizer {
  /**
   * Normalize place name for matching
   */
  static normalize(name: string, options: TextCleaningOptions = {}): string {
    if (!name || typeof name !== 'string') {
      return '';
    }

    const defaultOptions: Required<TextCleaningOptions> = {
      removeAccents: true,
      removePunctuation: true,
      normalizeWhitespace: true,
      toLowerCase: true,
      removeBusinessSuffixes: true,
      expandAbbreviations: false,
    };

    const opts = { ...defaultOptions, ...options };
    let normalized = name.trim();

    // Convert to lowercase
    if (opts.toLowerCase) {
      normalized = normalized.toLowerCase();
    }

    // Remove accents and diacritics
    if (opts.removeAccents) {
      normalized = this.removeAccents(normalized);
    }

    // Normalize whitespace
    if (opts.normalizeWhitespace) {
      normalized = normalized.replace(/\s+/g, ' ').trim();
    }

    // Standardize common symbols
    normalized = this.standardizeSymbols(normalized);

    // Remove business suffixes
    if (opts.removeBusinessSuffixes) {
      normalized = this.removeBusinessSuffixes(normalized);
    }

    // Remove punctuation (after business suffix removal to preserve abbreviations)
    if (opts.removePunctuation) {
      normalized = this.removePunctuation(normalized);
    }

    // Expand abbreviations
    if (opts.expandAbbreviations) {
      normalized = this.expandCommonAbbreviations(normalized);
    }

    return normalized.trim();
  }

  /**
   * Remove accents and diacritics from text
   */
  private static removeAccents(text: string): string {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove combining diacritical marks
      // Handle specific character replacements
      .replace(/[àáâãäå]/g, 'a')
      .replace(/[èéêë]/g, 'e')
      .replace(/[ìíîï]/g, 'i')
      .replace(/[òóôõö]/g, 'o')
      .replace(/[ùúûü]/g, 'u')
      .replace(/[ýÿ]/g, 'y')
      .replace(/[ñ]/g, 'n')
      .replace(/[ç]/g, 'c')
      .replace(/[ß]/g, 'ss')
      .replace(/[æ]/g, 'ae')
      .replace(/[œ]/g, 'oe')
      .replace(/[ø]/g, 'o')
      .replace(/[å]/g, 'a')
      // Handle Cyrillic characters (basic transliteration)
      .replace(/[а]/g, 'a')
      .replace(/[б]/g, 'b')
      .replace(/[в]/g, 'v')
      .replace(/[г]/g, 'g')
      .replace(/[д]/g, 'd')
      .replace(/[е]/g, 'e')
      .replace(/[ё]/g, 'e')
      .replace(/[ж]/g, 'zh')
      .replace(/[з]/g, 'z')
      .replace(/[и]/g, 'i')
      .replace(/[й]/g, 'y')
      .replace(/[к]/g, 'k')
      .replace(/[л]/g, 'l')
      .replace(/[м]/g, 'm')
      .replace(/[н]/g, 'n')
      .replace(/[о]/g, 'o')
      .replace(/[п]/g, 'p')
      .replace(/[р]/g, 'r')
      .replace(/[с]/g, 's')
      .replace(/[т]/g, 't')
      .replace(/[у]/g, 'u')
      .replace(/[ф]/g, 'f')
      .replace(/[х]/g, 'h')
      .replace(/[ц]/g, 'ts')
      .replace(/[ч]/g, 'ch')
      .replace(/[ш]/g, 'sh')
      .replace(/[щ]/g, 'sch')
      .replace(/[ъ]/g, '')
      .replace(/[ы]/g, 'y')
      .replace(/[ь]/g, '')
      .replace(/[э]/g, 'e')
      .replace(/[ю]/g, 'yu')
      .replace(/[я]/g, 'ya');
  }

  /**
   * Standardize common symbols and characters
   */
  private static standardizeSymbols(text: string): string {
    return text
      // Remove emoji and other symbols first
      .replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
      // Standardize ampersands
      .replace(/\s*&\s*/g, ' and ')
      .replace(/\s*\+\s*/g, ' and ')
      // Standardize apostrophes
      .replace(/['']/g, "'")
      // Standardize quotes
      .replace(/[""]/g, '"')
      // Standardize dashes
      .replace(/[–—]/g, '-')
      // Remove trademark symbols
      .replace(/[™®©]/g, '')
      // Clean up extra spaces
      .replace(/\s+/g, ' ');
  }

  /**
   * Remove common business suffixes
   */
  private static removeBusinessSuffixes(text: string): string {
    const suffixPattern = new RegExp(
      `\\b(${BUSINESS_SUFFIXES.join('|')})\\b\\.?\\s*$`,
      'gi'
    );
    return text.replace(suffixPattern, '').trim();
  }

  /**
   * Remove punctuation while preserving apostrophes and hyphens in words
   */
  private static removePunctuation(text: string): string {
    return text
      // Remove all punctuation except letters, numbers, spaces, apostrophes, and hyphens
      .replace(/[^\w\s'-]/g, '')
      // Remove apostrophes (they were preserved for business suffix removal)
      .replace(/'/g, '')
      // Remove standalone punctuation
      .replace(/\s+[-]\s+/g, ' ')
      .replace(/^[-]+|[-]+$/g, '');
  }

  /**
   * Expand common abbreviations
   */
  private static expandCommonAbbreviations(text: string): string {
    const abbreviations: Record<string, string> = {
      'st': 'saint',
      'mt': 'mount',
      'ft': 'fort',
      'pt': 'point',
      'intl': 'international',
      'natl': 'national',
      'univ': 'university',
      'hosp': 'hospital',
      'med': 'medical',
      'ctr': 'center',
      'bldg': 'building',
    };

    let expanded = text;
    for (const [abbrev, full] of Object.entries(abbreviations)) {
      const pattern = new RegExp(`\\b${abbrev}\\b`, 'gi');
      expanded = expanded.replace(pattern, full);
    }

    return expanded;
  }

  /**
   * Generate search tokens from normalized name
   */
  static generateSearchTokens(name: string): string[] {
    const normalized = this.normalize(name);
    const tokens = new Set<string>();

    // Add full normalized name
    tokens.add(normalized);

    // Add individual words (minimum 2 characters)
    const words = normalized.split(/\s+/).filter(word => word.length >= 2);
    words.forEach(word => tokens.add(word));

    // Add word combinations for multi-word names
    if (words.length > 1) {
      for (let i = 0; i < words.length - 1; i++) {
        for (let j = i + 1; j <= words.length; j++) {
          const combination = words.slice(i, j).join(' ');
          if (combination.length >= 3) {
            tokens.add(combination);
          }
        }
      }
    }

    return Array.from(tokens).sort((a, b) => b.length - a.length);
  }
}

/**
 * Address normalization and standardization utilities
 */
export class AddressNormalizer {
  /**
   * Normalize address for matching
   */
  static normalize(address: string, options: TextCleaningOptions = {}): string {
    if (!address || typeof address !== 'string') {
      return '';
    }

    const defaultOptions: Required<TextCleaningOptions> = {
      removeAccents: true,
      removePunctuation: false, // Keep some punctuation for addresses
      normalizeWhitespace: true,
      toLowerCase: true,
      removeBusinessSuffixes: false,
      expandAbbreviations: true,
    };

    const opts = { ...defaultOptions, ...options };
    let normalized = address.trim();

    // Convert to lowercase
    if (opts.toLowerCase) {
      normalized = normalized.toLowerCase();
    }

    // Remove accents
    if (opts.removeAccents) {
      normalized = NameNormalizer['removeAccents'](normalized);
    }

    // Normalize whitespace
    if (opts.normalizeWhitespace) {
      normalized = normalized.replace(/\s+/g, ' ').trim();
    }

    // Expand street abbreviations
    if (opts.expandAbbreviations) {
      normalized = this.expandStreetAbbreviations(normalized);
    }

    // Standardize directional indicators
    normalized = this.standardizeDirectionals(normalized);

    // Remove trailing punctuation
    normalized = normalized.replace(/[,.]$/, '');

    return normalized.trim();
  }

  /**
   * Expand street type abbreviations
   */
  private static expandStreetAbbreviations(address: string): string {
    let expanded = address;

    // Create a sorted list of abbreviations by length (longest first) to avoid partial replacements
    const sortedAbbrevs = Object.entries(STREET_ABBREVIATIONS)
      .sort(([a], [b]) => b.length - a.length);

    for (const [abbrev, full] of sortedAbbrevs) {
      const escaped = abbrev.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Match abbreviation with period (e.g., "St.") followed by whitespace or end
      const patternWithPeriod = new RegExp(`\\b${escaped}\\.(?=\\s|$)`, 'gi');
      expanded = expanded.replace(patternWithPeriod, full);

      // Then match abbreviation without period at word boundaries
      const patternNoPeriod = new RegExp(`\\b${escaped}\\b`, 'gi');
      expanded = expanded.replace(patternNoPeriod, full);
    }

    return expanded;
  }

  /**
   * Standardize directional indicators
   */
  private static standardizeDirectionals(address: string): string {
    const directionals: Record<string, string> = {
      'n': 'north',
      'ne': 'northeast', 
      'e': 'east',
      'se': 'southeast',
      's': 'south',
      'sw': 'southwest',
      'w': 'west',
      'nw': 'northwest',
    };

    let standardized = address;
    for (const [abbrev, full] of Object.entries(directionals)) {
      // Match at word boundaries, optionally with periods
      const pattern = new RegExp(`\\b${abbrev}\\.(?=\\s|$)|\\b${abbrev}\\b`, 'gi');
      standardized = standardized.replace(pattern, full);
    }

    return standardized;
  }

  /**
   * Extract address components for detailed matching
   */
  static extractComponents(address: string): AddressComponents {
    const components: AddressComponents = {};

    // Extract postal code first (various international formats)
    const postalCode = this.extractPostalCode(address);
    if (postalCode) {
      components.postalCode = postalCode;
    }

    // Extract street number (typically at the beginning)
    const streetNumberMatch = address.match(/^(\d+[a-z]?(?:-\d+[a-z]?)?)[\s,]+/i);
    if (streetNumberMatch) {
      components.streetNumber = streetNumberMatch[1];
    }

    // Normalize the address for further processing
    const normalized = this.normalize(address);

    // Extract street name (after street number, before first comma)
    let streetPart = address.split(',')[0]; // Get first part before comma
    if (components.streetNumber) {
      streetPart = streetPart.replace(new RegExp(`^${components.streetNumber}[\\s,]+`, 'i'), '');
    }
    let inferredCity: string | undefined;
    if (streetPart.trim()) {
      let normalizedStreet = this.normalize(streetPart.trim());
      // Remove trailing street numbers (e.g., "Unter den Linden 1")
      normalizedStreet = normalizedStreet.replace(/\s+\d+[a-z]?$/i, '').trim();

      const streetTokens = normalizedStreet.split(/\s+/).filter(Boolean);
      const suffixes = new Set([
        'street',
        'avenue',
        'boulevard',
        'drive',
        'road',
        'lane',
        'court',
        'place',
        'parkway',
        'highway',
        'trail',
        'terrace',
        'square',
        'way',
      ]);
      const suffixIndex = streetTokens.findIndex(token => suffixes.has(token));

      if (suffixIndex >= 0 && suffixIndex < streetTokens.length - 1) {
        components.streetName = streetTokens.slice(0, suffixIndex + 1).join(' ');
        inferredCity = streetTokens.slice(suffixIndex + 1).join(' ');
      } else {
        components.streetName = normalizedStreet;
      }
    }

    // Extract city, region, country from comma-separated parts
    const addressParts = address.split(',').map(part => part.trim()).filter(part => part.length > 0);
    
    if (addressParts.length >= 2) {
      if (!components.streetName && addressParts.length >= 2) {
        const fallbackStreet = addressParts[1];
        if (fallbackStreet) {
          components.streetName = this.normalize(fallbackStreet);
        }
      }
      // Remove the street part (first element)
      const locationParts = addressParts.slice(1);
      
      // Last part might be country or postal code
      const lastPart = locationParts[locationParts.length - 1];
      const secondLastPart = locationParts.length >= 2 ? locationParts[locationParts.length - 2] : undefined;
      
      // Handle format with trailing country and region+postal in the previous part
      if (secondLastPart) {
        const regionPostalMatch = secondLastPart.match(/^([A-Za-z]{2,3})\s+([A-Za-z0-9\s-]+)$/);
        if (regionPostalMatch && this.looksLikePostalCode(regionPostalMatch[2])) {
          components.region = regionPostalMatch[1];
          components.postalCode = regionPostalMatch[2].replace(/\s/g, '');
          components.city = locationParts[0];
          components.country = lastPart;
          return components;
        }
      }

      // Handle combined region + postal code (e.g., "NY 10001")
      const regionPostalMatch = lastPart.match(/^([A-Za-z]{2,3})\s+([A-Za-z0-9\s-]+)$/);
      if (regionPostalMatch && this.looksLikePostalCode(regionPostalMatch[2])) {
        components.region = regionPostalMatch[1];
        components.postalCode = regionPostalMatch[2].replace(/\s/g, '');
        if (locationParts.length >= 2) {
          components.city = locationParts[0];
        }
        return components;
      }

      // If last part looks like a postal code, previous parts are city/region
      if (this.looksLikePostalCode(lastPart)) {
        if (locationParts.length >= 3) {
          components.city = locationParts[locationParts.length - 3];
          components.region = locationParts[locationParts.length - 2];
        } else if (locationParts.length === 2) {
          components.city = locationParts[0];
        }
      } else {
        // Assume format: [street], [city], [region/country]
        if (locationParts.length >= 2) {
          components.city = locationParts[0];
          components.region = locationParts[1];
        } else if (locationParts.length === 1) {
          components.city = locationParts[0];
        }
      }
    }

    if (!components.city && inferredCity) {
      components.city = inferredCity;
    }

    return components;
  }

  /**
   * Extract postal code from address using international patterns
   */
  private static extractPostalCode(address: string): string | undefined {
    for (const pattern of POSTAL_CODE_PATTERNS) {
      const match = address.match(pattern);
      if (match) {
        return match[0].replace(/\s/g, ''); // Remove spaces for consistency
      }
    }
    return undefined;
  }

  /**
   * Check if a string looks like a postal code
   */
  private static looksLikePostalCode(text: string): boolean {
    return POSTAL_CODE_PATTERNS.some(pattern => pattern.test(text));
  }
}

/**
 * Coordinate validation and normalization utilities
 */
export class CoordinateValidator {
  /**
   * Validate and normalize coordinates
   */
  static validate(
    latitude?: number | string | null,
    longitude?: number | string | null
  ): CoordinateValidation {
    const result: CoordinateValidation = {
      isValid: false,
      errors: [],
    };

    // Handle null/undefined values
    if (latitude == null || longitude == null) {
      result.errors.push('Missing coordinate values');
      return result;
    }

    // Convert strings to numbers
    let lat: number;
    let lng: number;

    try {
      lat = typeof latitude === 'string' ? parseFloat(latitude) : latitude;
      lng = typeof longitude === 'string' ? parseFloat(longitude) : longitude;
    } catch (error) {
      result.errors.push('Invalid coordinate format');
      return result;
    }

    // Check for NaN
    if (isNaN(lat) || isNaN(lng)) {
      result.errors.push('Coordinates are not valid numbers');
      return result;
    }

    // Validate latitude range
    if (lat < LATITUDE_MIN || lat > LATITUDE_MAX) {
      result.errors.push(`Latitude must be between ${LATITUDE_MIN} and ${LATITUDE_MAX}`);
    }

    // Validate longitude range
    if (lng < LONGITUDE_MIN || lng > LONGITUDE_MAX) {
      result.errors.push(`Longitude must be between ${LONGITUDE_MIN} and ${LONGITUDE_MAX}`);
    }

    // Check for obviously invalid coordinates (0,0 is suspicious unless in Gulf of Guinea)
    if (lat === 0 && lng === 0) {
      result.errors.push('Coordinates (0,0) are likely invalid');
    }

    // If no errors, coordinates are valid
    if (result.errors.length === 0) {
      result.isValid = true;
      result.latitude = this.normalizeCoordinate(lat, 'latitude');
      result.longitude = this.normalizeCoordinate(lng, 'longitude');
      result.precision = this.estimatePrecision(lat, lng);
    }

    return result;
  }

  /**
   * Normalize coordinate to appropriate precision
   */
  private static normalizeCoordinate(coord: number, type: 'latitude' | 'longitude'): number {
    // Round to 6 decimal places (~0.1 meter precision)
    return Math.round(coord * 1000000) / 1000000;
  }

  /**
   * Estimate coordinate precision based on decimal places
   */
  private static estimatePrecision(lat: number, lng: number): 'exact' | 'approximate' | 'city' | 'region' {
    const latStr = lat.toString();
    const lngStr = lng.toString();
    
    const latDecimals = latStr.includes('.') ? latStr.split('.')[1].length : 0;
    const lngDecimals = lngStr.includes('.') ? lngStr.split('.')[1].length : 0;
    
    const maxDecimals = Math.max(latDecimals, lngDecimals);

    if (maxDecimals >= 5) return 'exact'; // ~1 meter precision
    if (maxDecimals >= 3) return 'approximate'; // ~100 meter precision
    if (maxDecimals >= 2) return 'city'; // ~1 km precision
    if (maxDecimals >= 1) return 'city'; // ~10 km precision - still city level
    return 'region'; // ~100+ km precision
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  static calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
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
}

/**
 * Category mapping utilities for different service taxonomies
 */
export class CategoryMapper {
  /**
   * Normalize category to standard taxonomy
   */
  static normalize(category?: string): string {
    if (!category || typeof category !== 'string') {
      return 'establishment';
    }

    const normalized = category.toLowerCase().replace(/\s+/g, '_');
    
    // Handle special cases first
    if (normalized === 'fast_food') {
      return 'restaurant';
    }
    
    // Find direct mapping
    if (CATEGORY_MAPPINGS[normalized]) {
      return normalized;
    }

    // Find reverse mapping (category appears in another category's mapping)
    for (const [standardCategory, mappings] of Object.entries(CATEGORY_MAPPINGS)) {
      if (mappings.includes(normalized)) {
        return standardCategory;
      }
    }

    // Fuzzy matching for similar categories
    const fuzzyMatch = this.findFuzzyMatch(normalized);
    if (fuzzyMatch) {
      return fuzzyMatch;
    }

    return 'establishment';
  }

  /**
   * Get all possible category variations for a normalized category
   */
  static getVariations(category: string): string[] {
    const normalized = this.normalize(category);
    return CATEGORY_MAPPINGS[normalized] || [normalized];
  }

  /**
   * Calculate category similarity score
   */
  static calculateSimilarity(category1?: string, category2?: string): number {
    if (!category1 && !category2) return 50; // Neutral when both missing
    if (!category1 || !category2) return 25; // Low when one missing

    const norm1 = this.normalize(category1);
    const norm2 = this.normalize(category2);

    // Exact match
    if (norm1 === norm2) return 100;

    // Check if categories are in each other's variation lists
    const variations1 = this.getVariations(norm1);
    const variations2 = this.getVariations(norm2);

    if (variations1.includes(norm2) || variations2.includes(norm1)) {
      return 75; // Related categories
    }

    // Check for common variations
    const commonVariations = variations1.filter(v => variations2.includes(v));
    const meaningfulCommon = commonVariations.filter(v => v !== 'establishment');
    if (meaningfulCommon.length > 0) {
      return 60; // Some overlap
    }

    // Special case relationships
    const relationshipScore = this.getRelationshipScore(norm1, norm2);
    if (relationshipScore > 0) {
      return relationshipScore;
    }

    return 0; // No relationship
  }

  /**
   * Get relationship score for special category pairs
   */
  private static getRelationshipScore(category1: string, category2: string): number {
    const relationships: Record<string, Record<string, number>> = {
      'restaurant': { 'cafe': 75, 'bar': 60 },
      'cafe': { 'restaurant': 75, 'bakery': 75 },
      'bar': { 'restaurant': 60 },
      'store': { 'shopping_mall': 75, 'grocery': 60 },
      'shopping_mall': { 'store': 75 },
      'grocery': { 'store': 60, 'supermarket': 100 },
      'supermarket': { 'grocery': 100 },
      'hospital': { 'pharmacy': 60 },
      'pharmacy': { 'hospital': 60 },
    };

    // Check direct relationships first
    const directScore = relationships[category1]?.[category2] || relationships[category2]?.[category1];
    if (directScore) return directScore;

    // For unrelated categories, return 0 instead of fuzzy matching score
    const unrelatedPairs = [
      ['restaurant', 'hospital'],
      ['hospital', 'restaurant'],
    ];
    
    const isUnrelated = unrelatedPairs.some(([cat1, cat2]) => 
      (category1 === cat1 && category2 === cat2) || (category1 === cat2 && category2 === cat1)
    );
    
    if (isUnrelated) return 0;

    return 0; // Default for unknown relationships
  }

  /**
   * Find fuzzy match for unknown categories
   */
  private static findFuzzyMatch(category: string): string | null {
    const threshold = 0.7; // Minimum similarity threshold
    let bestMatch: string | null = null;
    let bestScore = 0;

    for (const standardCategory of Object.keys(CATEGORY_MAPPINGS)) {
      const score = this.calculateStringSimilarity(category, standardCategory);
      if (score > bestScore && score >= threshold) {
        bestScore = score;
        bestMatch = standardCategory;
      }

      // Also check variations
      for (const variation of CATEGORY_MAPPINGS[standardCategory]) {
        const variationScore = this.calculateStringSimilarity(category, variation);
        if (variationScore > bestScore && variationScore >= threshold) {
          bestScore = variationScore;
          bestMatch = standardCategory;
        }
      }
    }

    return bestMatch;
  }

  /**
   * Calculate string similarity using Jaro-Winkler algorithm
   */
  private static calculateStringSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;
    if (str1.length === 0 || str2.length === 0) return 0;

    const matchWindow = Math.floor(Math.max(str1.length, str2.length) / 2) - 1;
    if (matchWindow < 0) return 0;

    const str1Matches = new Array(str1.length).fill(false);
    const str2Matches = new Array(str2.length).fill(false);

    let matches = 0;
    let transpositions = 0;

    // Find matches
    for (let i = 0; i < str1.length; i++) {
      const start = Math.max(0, i - matchWindow);
      const end = Math.min(i + matchWindow + 1, str2.length);

      for (let j = start; j < end; j++) {
        if (str2Matches[j] || str1[i] !== str2[j]) continue;
        str1Matches[i] = true;
        str2Matches[j] = true;
        matches++;
        break;
      }
    }

    if (matches === 0) return 0;

    // Find transpositions
    let k = 0;
    for (let i = 0; i < str1.length; i++) {
      if (!str1Matches[i]) continue;
      while (!str2Matches[k]) k++;
      if (str1[i] !== str2[k]) transpositions++;
      k++;
    }

    const jaro = (matches / str1.length + matches / str2.length + 
                  (matches - transpositions / 2) / matches) / 3;

    // Jaro-Winkler prefix bonus
    let prefix = 0;
    for (let i = 0; i < Math.min(str1.length, str2.length, 4); i++) {
      if (str1[i] === str2[i]) prefix++;
      else break;
    }

    return jaro + (0.1 * prefix * (1 - jaro));
  }
}

/**
 * Main place normalization service
 */
export class PlaceNormalizer {
  /**
   * Normalize a Place object for matching
   */
  static normalizePlaceData(place: Place): NormalizedPlaceData {
    const normalizationFlags: string[] = [];

    // Normalize name
    const normalizedName = NameNormalizer.normalize(place.title);
    if (normalizedName !== place.title.toLowerCase().trim()) {
      normalizationFlags.push('name_normalized');
    }

    // Normalize address
    const normalizedAddress = AddressNormalizer.normalize(place.address);
    if (normalizedAddress !== place.address.toLowerCase().trim()) {
      normalizationFlags.push('address_normalized');
    }

    // Validate and normalize coordinates
    let coordinates: NormalizedPlaceData['coordinates'];
    if (place.latitude !== undefined && place.longitude !== undefined) {
      const validation = CoordinateValidator.validate(place.latitude, place.longitude);
      if (validation.isValid && validation.latitude !== undefined && validation.longitude !== undefined) {
        coordinates = {
          latitude: validation.latitude,
          longitude: validation.longitude,
          isValid: true,
          precision: validation.precision,
        };
      } else {
        normalizationFlags.push('invalid_coordinates');
      }
    }

    // Normalize category
    const originalCategory = place.tags?.[0];
    const normalizedCategory = CategoryMapper.normalize(originalCategory);
    if (originalCategory && normalizedCategory !== originalCategory.toLowerCase()) {
      normalizationFlags.push('category_normalized');
    }

    // Extract address components
    const addressComponents = AddressNormalizer.extractComponents(place.address);

    // Generate search tokens
    const searchTokens = NameNormalizer.generateSearchTokens(place.title);

    return {
      name: normalizedName,
      address: normalizedAddress,
      coordinates,
      category: normalizedCategory,
      addressComponents,
      searchTokens,
      metadata: {
        originalName: place.title,
        originalAddress: place.address,
        originalCategory,
        normalizationFlags,
      },
    };
  }

  /**
   * Normalize a NormalizedPlace object from API response
   */
  static normalizeApiPlace(place: NormalizedPlace): NormalizedPlaceData {
    const normalizationFlags: string[] = [];

    // Normalize name
    const normalizedName = NameNormalizer.normalize(place.name);
    if (normalizedName !== place.name.toLowerCase().trim()) {
      normalizationFlags.push('name_normalized');
    }

    // Normalize address
    const normalizedAddress = AddressNormalizer.normalize(place.address);
    if (normalizedAddress !== place.address.toLowerCase().trim()) {
      normalizationFlags.push('address_normalized');
    }

    // Validate and normalize coordinates
    let coordinates: NormalizedPlaceData['coordinates'];
    if (place.latitude !== undefined && place.longitude !== undefined) {
      const validation = CoordinateValidator.validate(place.latitude, place.longitude);
      if (validation.isValid && validation.latitude !== undefined && validation.longitude !== undefined) {
        coordinates = {
          latitude: validation.latitude,
          longitude: validation.longitude,
          isValid: true,
          precision: validation.precision,
        };
      } else {
        normalizationFlags.push('invalid_coordinates');
      }
    }

    // Normalize category
    const normalizedCategory = CategoryMapper.normalize(place.category);
    if (place.category && normalizedCategory !== place.category.toLowerCase()) {
      normalizationFlags.push('category_normalized');
    }

    // Extract address components
    const addressComponents = AddressNormalizer.extractComponents(place.address);

    // Generate search tokens
    const searchTokens = NameNormalizer.generateSearchTokens(place.name);

    return {
      name: normalizedName,
      address: normalizedAddress,
      coordinates,
      category: normalizedCategory,
      addressComponents,
      searchTokens,
      metadata: {
        originalName: place.name,
        originalAddress: place.address,
        originalCategory: place.category,
        normalizationFlags,
      },
    };
  }

  /**
   * Clean and preprocess text for general use
   */
  static cleanText(
    text: string,
    options: TextCleaningOptions = {}
  ): string {
    return NameNormalizer.normalize(text, options);
  }

  /**
   * Batch normalize multiple places
   */
  static batchNormalize(places: Place[]): NormalizedPlaceData[] {
    return places.map(place => this.normalizePlaceData(place));
  }

  /**
   * Compare two normalized places for similarity
   */
  static calculateSimilarity(
    place1: NormalizedPlaceData,
    place2: NormalizedPlaceData
  ): {
    overall: number;
    factors: {
      name: number;
      address: number;
      distance: number;
      category: number;
    };
  } {
    // Name similarity using Levenshtein distance
    const nameSimilarity = this.calculateStringSimilarity(place1.name, place2.name);

    // Address similarity
    const addressSimilarity = this.calculateStringSimilarity(place1.address, place2.address);

    // Distance similarity
    let distanceSimilarity = 0;
    if (place1.coordinates?.isValid && place2.coordinates?.isValid) {
      const distance = CoordinateValidator.calculateDistance(
        place1.coordinates.latitude,
        place1.coordinates.longitude,
        place2.coordinates.latitude,
        place2.coordinates.longitude
      );
      // Convert distance to similarity score (closer = higher score)
      distanceSimilarity = Math.max(0, 100 - (distance / 50)); // 50m = 0 similarity
    }

    // Category similarity
    const categorySimilarity = CategoryMapper.calculateSimilarity(place1.category, place2.category);

    // Calculate weighted overall similarity
    const weights = { name: 0.4, address: 0.3, distance: 0.2, category: 0.1 };
    const overall = Math.round(
      nameSimilarity * weights.name +
      addressSimilarity * weights.address +
      distanceSimilarity * weights.distance +
      categorySimilarity * weights.category
    );

    return {
      overall,
      factors: {
        name: Math.round(nameSimilarity),
        address: Math.round(addressSimilarity),
        distance: Math.round(distanceSimilarity),
        category: Math.round(categorySimilarity),
      },
    };
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private static calculateStringSimilarity(str1: string, str2: string): number {
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
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    return matrix[str2.length][str1.length];
  }
}
