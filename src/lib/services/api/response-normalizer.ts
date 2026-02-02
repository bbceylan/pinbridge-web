/**
 * Response normalization utilities for consistent data structure across APIs
 */

import type { BasePlace } from './types';
import type { AppleMapsPlace } from './apple-maps';
import type { GoogleMapsPlace } from './google-maps';

export interface NormalizedPlace extends BasePlace {
  // Normalized fields that work across all APIs
  source: 'apple_maps' | 'google_maps';
  confidence?: number; // For matching algorithms
  
  // Extended fields that may not be available in all APIs
  businessStatus?: 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY';
  priceLevel?: number; // 0-4 scale
  types?: string[]; // Standardized place types
  photos?: Array<{
    url: string;
    width: number;
    height: number;
    attribution?: string;
  }>;
  reviews?: Array<{
    rating: number;
    text: string;
    author: string;
    time: Date;
  }>;
  openingHours?: {
    isOpen?: boolean;
    periods: Array<{
      open: { day: number; time: string };
      close?: { day: number; time: string };
    }>;
    weekdayText?: string[];
  };
  
  // Raw data for debugging and advanced use cases
  rawData?: any;
}

export class ResponseNormalizer {
  /**
   * Normalize Apple Maps place to standard format
   */
  static normalizeAppleMapsPlace(place: AppleMapsPlace): NormalizedPlace {
    return {
      id: place.id,
      name: place.name,
      address: place.address,
      latitude: place.latitude,
      longitude: place.longitude,
      category: place.category,
      phoneNumber: place.phoneNumber,
      website: place.website,
      rating: place.rating,
      isOpen: place.isOpen,
      source: 'apple_maps',
      
      // Map Apple Maps specific fields to normalized format
      businessStatus: this.mapAppleBusinessStatus(place.isOpen),
      types: place.category ? [this.normalizeCategory(place.category)] : undefined,
      photos: place.photos?.map(photo => ({
        url: photo.url,
        width: photo.width,
        height: photo.height,
      })),
      openingHours: place.businessHours ? {
        isOpen: place.isOpen,
        periods: place.businessHours.periods,
      } : undefined,
      
      // Store raw data for debugging
      rawData: place,
    };
  }

  /**
   * Normalize Google Maps place to standard format
   */
  static normalizeGoogleMapsPlace(place: GoogleMapsPlace): NormalizedPlace {
    return {
      id: place.id,
      name: place.name,
      address: place.address,
      latitude: place.latitude,
      longitude: place.longitude,
      category: place.category,
      phoneNumber: place.phoneNumber,
      website: place.website,
      rating: place.rating,
      isOpen: place.isOpen,
      source: 'google_maps',
      
      // Map Google Maps specific fields to normalized format
      businessStatus: place.businessStatus,
      priceLevel: place.priceLevel,
      types: place.types?.map(type => this.normalizeCategory(type)),
      photos: place.photos?.map(photo => ({
        url: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${photo.width}&photoreference=${photo.photoReference}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`,
        width: photo.width,
        height: photo.height,
        attribution: photo.htmlAttributions?.join(', '),
      })),
      reviews: place.reviews?.map(review => ({
        rating: review.rating,
        text: review.text,
        author: review.authorName,
        time: new Date(review.time * 1000), // Convert Unix timestamp to Date
      })),
      openingHours: place.openingHours ? {
        isOpen: place.openingHours.openNow,
        periods: place.openingHours.periods || [],
        weekdayText: place.openingHours.weekdayText,
      } : undefined,
      
      // Store raw data for debugging
      rawData: place,
    };
  }

  /**
   * Normalize address format across different APIs
   */
  static normalizeAddress(address: string): string {
    if (!address) return '';
    
    return address
      .trim()
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      // Standardize common abbreviations
      .replace(/\bSt\b/gi, 'Street')
      .replace(/\bAve\b/gi, 'Avenue')
      .replace(/\bBlvd\b/gi, 'Boulevard')
      .replace(/\bDr\b/gi, 'Drive')
      .replace(/\bRd\b/gi, 'Road')
      .replace(/\bLn\b/gi, 'Lane')
      .replace(/\bCt\b/gi, 'Court')
      .replace(/\bPl\b/gi, 'Place')
      // Remove trailing commas and periods
      .replace(/[,.]$/, '');
  }

  /**
   * Normalize place name for better matching
   */
  static normalizeName(name: string): string {
    if (!name) return '';
    
    return name
      .trim()
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      // Remove common business suffixes for better matching
      .replace(/\b(LLC|Inc|Corp|Ltd|Co)\b\.?/gi, '')
      .replace(/\b(Restaurant|Cafe|Coffee|Shop|Store|Market)\b/gi, '')
      // Standardize ampersands
      .replace(/\s*&\s*/g, ' and ')
      // Remove special characters that might interfere with matching, but preserve apostrophes
      .replace(/[^\w\s'-]/g, '')
      .trim();
  }

  /**
   * Normalize coordinates to ensure consistent precision
   */
  static normalizeCoordinates(lat: number, lng: number): { latitude: number; longitude: number } {
    return {
      latitude: Math.round(lat * 1000000) / 1000000, // 6 decimal places
      longitude: Math.round(lng * 1000000) / 1000000,
    };
  }

  /**
   * Normalize place categories/types across different APIs
   */
  static normalizeCategory(category: string): string {
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
      'meal_delivery': 'restaurant',
      'bakery': 'bakery',
      
      // Shopping
      'store': 'store',
      'shopping_mall': 'shopping_mall',
      'supermarket': 'grocery_or_supermarket',
      'grocery': 'grocery_or_supermarket',
      'grocery_or_supermarket': 'grocery_or_supermarket',
      'gas_station': 'gas_station',
      'clothing_store': 'clothing_store',
      'electronics_store': 'electronics_store',
      'furniture_store': 'furniture_store',
      'hardware_store': 'hardware_store',
      'jewelry_store': 'jewelry_store',
      'shoe_store': 'shoe_store',
      'book_store': 'book_store',
      'bicycle_store': 'bicycle_store',
      'car_dealer': 'car_dealer',
      'car_rental': 'car_rental',
      'car_repair': 'car_repair',
      'car_wash': 'car_wash',
      
      // Services
      'bank': 'bank',
      'atm': 'atm',
      'hospital': 'hospital',
      'pharmacy': 'pharmacy',
      'post_office': 'post_office',
      'police': 'police',
      'fire_station': 'fire_station',
      'dentist': 'dentist',
      'doctor': 'doctor',
      'veterinary_care': 'veterinary_care',
      'lawyer': 'lawyer',
      'insurance_agency': 'insurance_agency',
      'real_estate_agency': 'real_estate_agency',
      'travel_agency': 'travel_agency',
      'beauty_salon': 'beauty_salon',
      'hair_care': 'hair_care',
      'spa': 'spa',
      'gym': 'gym',
      'laundry': 'laundry',
      
      // Entertainment & Recreation
      'movie_theater': 'movie_theater',
      'amusement_park': 'amusement_park',
      'zoo': 'zoo',
      'aquarium': 'aquarium',
      'museum': 'museum',
      'art_gallery': 'art_gallery',
      'library': 'library',
      'park': 'park',
      'stadium': 'stadium',
      'bowling_alley': 'bowling_alley',
      'casino': 'casino',
      'night_club': 'night_club',
      
      // Transportation
      'airport': 'airport',
      'subway_station': 'transit_station',
      'train_station': 'transit_station',
      'bus_station': 'transit_station',
      'taxi_stand': 'taxi_stand',
      'parking': 'parking',
      
      // Lodging
      'lodging': 'lodging',
      'hotel': 'lodging',
      'campground': 'campground',
      'rv_park': 'rv_park',
      
      // Education & Government
      'school': 'school',
      'university': 'university',
      'local_government_office': 'local_government_office',
      'courthouse': 'courthouse',
      'embassy': 'embassy',
      
      // Religious
      'church': 'place_of_worship',
      'mosque': 'place_of_worship',
      'synagogue': 'place_of_worship',
      'hindu_temple': 'place_of_worship',
      'place_of_worship': 'place_of_worship',
      
      // Default
      'establishment': 'establishment',
      'point_of_interest': 'establishment',
    };

    const normalized = category.toLowerCase().replace(/\s+/g, '_');
    return categoryMap[normalized] || 'establishment';
  }

  /**
   * Calculate confidence score for place matching
   */
  static calculateMatchConfidence(
    originalPlace: { name: string; address: string; latitude?: number; longitude?: number },
    candidatePlace: NormalizedPlace
  ): number {
    let confidence = 0;
    let totalWeight = 0;

    // Name similarity (40% weight)
    const nameWeight = 40;
    const nameSimilarity = this.calculateStringSimilarity(
      this.normalizeName(originalPlace.name),
      this.normalizeName(candidatePlace.name)
    );
    confidence += nameSimilarity * nameWeight;
    totalWeight += nameWeight;

    // Address similarity (30% weight)
    const addressWeight = 30;
    const addressSimilarity = this.calculateStringSimilarity(
      this.normalizeAddress(originalPlace.address),
      this.normalizeAddress(candidatePlace.address)
    );
    confidence += addressSimilarity * addressWeight;
    totalWeight += addressWeight;

    // Distance similarity (20% weight) - if coordinates available
    if (originalPlace.latitude && originalPlace.longitude) {
      const distanceWeight = 20;
      const distance = this.calculateDistance(
        originalPlace.latitude,
        originalPlace.longitude,
        candidatePlace.latitude,
        candidatePlace.longitude
      );
      // Convert distance to similarity score (closer = higher score)
      const distanceSimilarity = Math.max(0, 100 - (distance / 100)); // 100m = 1 point reduction
      confidence += Math.min(100, distanceSimilarity) * distanceWeight;
      totalWeight += distanceWeight;
    }

    // Category bonus (10% weight)
    const categoryWeight = 10;
    if (candidatePlace.category) {
      confidence += 50 * categoryWeight; // Bonus for having category info
    }
    totalWeight += categoryWeight;

    return Math.min(100, Math.round(confidence / totalWeight));
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private static calculateStringSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 100;

    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 100;

    const distance = this.levenshteinDistance(longer, shorter);
    return Math.round(((longer.length - distance) / longer.length) * 100);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

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
   * Calculate distance between two coordinates using Haversine formula
   */
  private static calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
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
   * Map Apple Maps business status to normalized format
   */
  private static mapAppleBusinessStatus(isOpen?: boolean): NormalizedPlace['businessStatus'] {
    if (isOpen === undefined) return undefined;
    return isOpen ? 'OPERATIONAL' : 'CLOSED_TEMPORARILY';
  }

  /**
   * Validate normalized place data
   */
  static validateNormalizedPlace(place: NormalizedPlace): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!place.id) errors.push('Place ID is required');
    if (!place.name) errors.push('Place name is required');
    if (!place.address) errors.push('Place address is required');
    if (typeof place.latitude !== 'number' || place.latitude < -90 || place.latitude > 90) {
      errors.push('Valid latitude is required (-90 to 90)');
    }
    if (typeof place.longitude !== 'number' || place.longitude < -180 || place.longitude > 180) {
      errors.push('Valid longitude is required (-180 to 180)');
    }
    if (!place.source) errors.push('Place source is required');

    return { valid: errors.length === 0, errors };
  }
}