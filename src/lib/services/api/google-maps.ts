/**
 * Google Maps API integration service
 */

import { BaseAPIService } from './base-service';
import { APIConfigManager } from './config';
import { GoogleMapsErrorHandler } from './google-maps-errors';
import { ResponseNormalizer } from './response-normalizer';
import { apiResponseCache } from '../intelligent-cache';
import type { 
  APIConfig, 
  APIResponse, 
  PlaceSearchQuery, 
  BasePlace 
} from './types';
import type { NormalizedPlace } from './response-normalizer';

export interface GoogleMapsPlace extends BasePlace {
  // Google Maps specific fields
  placeId: string;
  formattedAddress: string;
  geometry: {
    location: { lat: number; lng: number };
    viewport?: {
      northeast: { lat: number; lng: number };
      southwest: { lat: number; lng: number };
    };
  };
  types: string[];
  businessStatus?: 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY';
  priceLevel?: number; // 0-4 scale
  photos?: Array<{
    photoReference: string;
    height: number;
    width: number;
    htmlAttributions: string[];
  }>;
  reviews?: Array<{
    authorName: string;
    authorUrl?: string;
    language: string;
    profilePhotoUrl?: string;
    rating: number;
    relativeTimeDescription: string;
    text: string;
    time: number;
  }>;
  openingHours?: {
    openNow?: boolean;
    periods?: Array<{
      close?: { day: number; time: string };
      open: { day: number; time: string };
    }>;
    weekdayText?: string[];
  };
  utcOffset?: number;
  vicinity?: string;
  plusCode?: {
    compoundCode: string;
    globalCode: string;
  };
}

export interface GoogleMapsSearchResponse {
  results: Array<{
    place_id: string;
    name: string;
    formatted_address: string;
    geometry: {
      location: { lat: number; lng: number };
      viewport?: {
        northeast: { lat: number; lng: number };
        southwest: { lat: number; lng: number };
      };
    };
    types: string[];
    business_status?: string;
    price_level?: number;
    rating?: number;
    user_ratings_total?: number;
    photos?: Array<{
      photo_reference: string;
      height: number;
      width: number;
      html_attributions: string[];
    }>;
    opening_hours?: {
      open_now?: boolean;
    };
    plus_code?: {
      compound_code: string;
      global_code: string;
    };
    vicinity?: string;
  }>;
  status: string;
  error_message?: string;
  info_messages?: string[];
  next_page_token?: string;
}

export interface GoogleMapsPlaceDetailsResponse {
  result: {
    place_id: string;
    name: string;
    formatted_address: string;
    formatted_phone_number?: string;
    international_phone_number?: string;
    website?: string;
    url?: string;
    geometry: {
      location: { lat: number; lng: number };
      viewport?: {
        northeast: { lat: number; lng: number };
        southwest: { lat: number; lng: number };
      };
    };
    types: string[];
    business_status?: string;
    price_level?: number;
    rating?: number;
    user_ratings_total?: number;
    photos?: Array<{
      photo_reference: string;
      height: number;
      width: number;
      html_attributions: string[];
    }>;
    reviews?: Array<{
      author_name: string;
      author_url?: string;
      language: string;
      profile_photo_url?: string;
      rating: number;
      relative_time_description: string;
      text: string;
      time: number;
    }>;
    opening_hours?: {
      open_now?: boolean;
      periods?: Array<{
        close?: { day: number; time: string };
        open: { day: number; time: string };
      }>;
      weekday_text?: string[];
    };
    utc_offset?: number;
    vicinity?: string;
    plus_code?: {
      compound_code: string;
      global_code: string;
    };
  };
  status: string;
  error_message?: string;
  info_messages?: string[];
}

export class GoogleMapsService extends BaseAPIService {
  constructor(config?: APIConfig) {
    const resolvedConfig = config ?? APIConfigManager.getInstance().getConfig('google_maps');
    super(resolvedConfig, 'google_maps');
  }

  protected getAuthHeaders(): Record<string, string> {
    return {
      // Google Maps API uses API key in query params, not headers
    };
  }

  /**
   * Search for places using Google Maps Places API Text Search
   */
  async searchPlaces(query: PlaceSearchQuery): Promise<APIResponse<GoogleMapsPlace[]>> {
    // Generate cache key for this query
    const searchParams = this.buildTextSearchParams(query);
    const queryString = searchParams.toString();
    
    // Check intelligent cache first
    const cachedResponse = await apiResponseCache.getCachedApiResponse('google', queryString);
    if (cachedResponse) {
      return {
        success: true,
        data: cachedResponse.map(place => this.convertFromNormalized(place)),
        rateLimitInfo: {
          limit: this.config.rateLimitPerSecond,
          remaining: 1000,
          resetTime: new Date(),
        }, // Cached response
      };
    }

    const cacheKey = this.generateCacheKey('/place/textsearch/json', searchParams);
    
    const response = await this.makeRequestWithRetry<GoogleMapsSearchResponse>(
      `/place/textsearch/json?${searchParams.toString()}`,
      { method: 'GET' },
      cacheKey,
      24 * 60 * 60 * 1000 // 24 hour cache
    );

    if (!response.success || !response.data) {
      return { success: false, error: response.error };
    }

    // Check Google Maps API status
    if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
      const error = GoogleMapsErrorHandler.handleAPIStatus(response.data.status, response.data.error_message);
      return { success: false, error };
    }

    const normalizedPlaces = response.data.results.map(result => 
      this.normalizeSearchResult(result)
    );

    // Cache the normalized response in intelligent cache
    const normalizedResults = normalizedPlaces.map(place => 
      ResponseNormalizer.normalizeGoogleMapsPlace(place)
    );
    await apiResponseCache.cacheApiResponse('google', queryString, normalizedResults);

    return {
      success: true,
      data: normalizedPlaces,
      rateLimitInfo: response.rateLimitInfo
    };
  }

  /**
   * Convert normalized place back to Google Maps format
   */
  private convertFromNormalized(normalized: NormalizedPlace): GoogleMapsPlace {
    return {
      id: normalized.id,
      name: normalized.name,
      address: normalized.address,
      latitude: normalized.latitude,
      longitude: normalized.longitude,
      category: normalized.category,
      phoneNumber: normalized.phoneNumber,
      website: normalized.website,
      rating: normalized.rating,
      isOpen: normalized.isOpen,
      placeId: normalized.id,
      formattedAddress: normalized.address,
      geometry: {
        location: {
          lat: normalized.latitude,
          lng: normalized.longitude,
        },
      },
      types: normalized.types || [],
      businessStatus: 'OPERATIONAL',
    };
  }

  /**
   * Get detailed information about a specific place
   */
  async getPlaceDetails(placeId: string): Promise<APIResponse<GoogleMapsPlace>> {
    const searchParams = this.buildPlaceDetailsParams(placeId);
    const cacheKey = this.generateCacheKey('/place/details/json', { place_id: placeId });
    
    const response = await this.makeRequestWithRetry<GoogleMapsPlaceDetailsResponse>(
      `/place/details/json?${searchParams.toString()}`,
      { method: 'GET' },
      cacheKey,
      24 * 60 * 60 * 1000 // 24 hour cache
    );

    if (!response.success || !response.data) {
      return { success: false, error: response.error };
    }

    // Check Google Maps API status
    if (response.data.status !== 'OK') {
      const error = GoogleMapsErrorHandler.handleAPIStatus(response.data.status, response.data.error_message);
      return { success: false, error };
    }

    const normalizedPlace = this.normalizePlaceDetails(response.data.result);

    return {
      success: true,
      data: normalizedPlace,
      rateLimitInfo: response.rateLimitInfo
    };
  }

  /**
   * Search for places near a specific coordinate using Nearby Search
   */
  async searchNearby(
    latitude: number, 
    longitude: number, 
    radius: number = 1000,
    query?: string
  ): Promise<APIResponse<GoogleMapsPlace[]>> {
    const searchParams = this.buildNearbySearchParams(latitude, longitude, radius, query);
    const cacheKey = this.generateCacheKey('/place/nearbysearch/json', searchParams);
    
    const response = await this.makeRequestWithRetry<GoogleMapsSearchResponse>(
      `/place/nearbysearch/json?${searchParams.toString()}`,
      { method: 'GET' },
      cacheKey,
      24 * 60 * 60 * 1000 // 24 hour cache
    );

    if (!response.success || !response.data) {
      return { success: false, error: response.error };
    }

    // Check Google Maps API status
    if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
      const error = GoogleMapsErrorHandler.handleAPIStatus(response.data.status, response.data.error_message);
      return { success: false, error };
    }

    const normalizedPlaces = response.data.results.map(result => 
      this.normalizeSearchResult(result)
    );

    return {
      success: true,
      data: normalizedPlaces,
      rateLimitInfo: response.rateLimitInfo
    };
  }

  /**
   * Search for places using Google Maps API and return normalized results
   */
  async searchPlacesNormalized(query: PlaceSearchQuery): Promise<APIResponse<NormalizedPlace[]>> {
    const response = await this.searchPlaces(query);
    
    if (!response.success || !response.data) {
      return { success: false, error: response.error };
    }

    const normalizedPlaces = response.data.map(place => 
      ResponseNormalizer.normalizeGoogleMapsPlace(place)
    );

    return {
      success: true,
      data: normalizedPlaces,
      rateLimitInfo: response.rateLimitInfo
    };
  }

  /**
   * Get detailed information about a specific place and return normalized result
   */
  async getPlaceDetailsNormalized(placeId: string): Promise<APIResponse<NormalizedPlace>> {
    const response = await this.getPlaceDetails(placeId);
    
    if (!response.success || !response.data) {
      return { success: false, error: response.error };
    }

    const normalizedPlace = ResponseNormalizer.normalizeGoogleMapsPlace(response.data);

    return {
      success: true,
      data: normalizedPlace,
      rateLimitInfo: response.rateLimitInfo
    };
  }

  /**
   * Validate API key by making a test request
   */
  async validateApiKey(): Promise<boolean> {
    try {
      const testQuery: PlaceSearchQuery = {
        name: 'Googleplex',
        address: 'Mountain View, CA'
      };
      
      const response = await this.searchPlaces(testQuery);
      return response.success;
    } catch (error) {
      console.warn('Google Maps API key validation failed:', error);
      return false;
    }
  }

  private buildTextSearchParams(query: PlaceSearchQuery): URLSearchParams {
    const params = new URLSearchParams();
    
    // Add API key
    params.append('key', this.config.apiKey);
    
    // Build search query string
    const queryParts: string[] = [];
    if (query.name) {
      queryParts.push(query.name);
    }
    if (query.address) {
      queryParts.push(query.address);
    }
    
    if (queryParts.length > 0) {
      params.append('query', queryParts.join(' '));
    }

    // Add location bias if coordinates are provided
    if (query.latitude !== undefined && query.longitude !== undefined) {
      params.append('location', `${query.latitude},${query.longitude}`);
      
      if (query.radius) {
        params.append('radius', query.radius.toString());
      }
    }

    // Request additional fields
    params.append('fields', 'place_id,name,formatted_address,geometry,types,business_status,price_level,rating,user_ratings_total,photos,opening_hours,plus_code,vicinity');

    return params;
  }

  private buildNearbySearchParams(
    latitude: number, 
    longitude: number, 
    radius: number, 
    keyword?: string
  ): URLSearchParams {
    const params = new URLSearchParams();
    
    // Add API key
    params.append('key', this.config.apiKey);
    
    // Location and radius are required for nearby search
    params.append('location', `${latitude},${longitude}`);
    params.append('radius', radius.toString());
    
    // Add keyword if provided
    if (keyword) {
      params.append('keyword', keyword);
    }

    // Request additional fields
    params.append('fields', 'place_id,name,formatted_address,geometry,types,business_status,price_level,rating,user_ratings_total,photos,opening_hours,plus_code,vicinity');

    return params;
  }

  private buildPlaceDetailsParams(placeId: string): URLSearchParams {
    const params = new URLSearchParams();
    
    // Add API key
    params.append('key', this.config.apiKey);
    
    // Place ID
    params.append('place_id', placeId);
    
    // Request comprehensive fields
    params.append('fields', 'place_id,name,formatted_address,formatted_phone_number,international_phone_number,website,url,geometry,types,business_status,price_level,rating,user_ratings_total,photos,reviews,opening_hours,utc_offset,vicinity,plus_code');

    return params;
  }

  private normalizeSearchResult(result: GoogleMapsSearchResponse['results'][0]): GoogleMapsPlace {
    return {
      id: result.place_id,
      name: result.name,
      address: result.formatted_address,
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      category: result.types?.[0],
      phoneNumber: undefined, // Not available in search results
      website: undefined, // Not available in search results
      rating: result.rating,
      isOpen: result.opening_hours?.open_now,
      
      // Google Maps specific fields
      placeId: result.place_id,
      formattedAddress: result.formatted_address,
      geometry: result.geometry,
      types: result.types,
      businessStatus: this.mapBusinessStatus(result.business_status),
      priceLevel: result.price_level,
      photos: result.photos?.map(photo => ({
        photoReference: photo.photo_reference,
        height: photo.height,
        width: photo.width,
        htmlAttributions: photo.html_attributions,
      })),
      openingHours: result.opening_hours ? {
        openNow: result.opening_hours.open_now,
      } : undefined,
      vicinity: result.vicinity,
      plusCode: result.plus_code ? {
        compoundCode: result.plus_code.compound_code,
        globalCode: result.plus_code.global_code,
      } : undefined,
    };
  }

  private normalizePlaceDetails(place: GoogleMapsPlaceDetailsResponse['result']): GoogleMapsPlace {
    return {
      id: place.place_id,
      name: place.name,
      address: place.formatted_address,
      latitude: place.geometry.location.lat,
      longitude: place.geometry.location.lng,
      category: place.types?.[0],
      phoneNumber: place.formatted_phone_number || place.international_phone_number,
      website: place.website,
      rating: place.rating,
      isOpen: place.opening_hours?.open_now,
      
      // Google Maps specific fields
      placeId: place.place_id,
      formattedAddress: place.formatted_address,
      geometry: place.geometry,
      types: place.types,
      businessStatus: this.mapBusinessStatus(place.business_status),
      priceLevel: place.price_level,
      photos: place.photos?.map(photo => ({
        photoReference: photo.photo_reference,
        height: photo.height,
        width: photo.width,
        htmlAttributions: photo.html_attributions,
      })),
      reviews: place.reviews?.map(review => ({
        authorName: review.author_name,
        authorUrl: review.author_url,
        language: review.language,
        profilePhotoUrl: review.profile_photo_url,
        rating: review.rating,
        relativeTimeDescription: review.relative_time_description,
        text: review.text,
        time: review.time,
      })),
      openingHours: place.opening_hours ? {
        openNow: place.opening_hours.open_now,
        periods: place.opening_hours.periods,
        weekdayText: place.opening_hours.weekday_text,
      } : undefined,
      utcOffset: place.utc_offset,
      vicinity: place.vicinity,
      plusCode: place.plus_code ? {
        compoundCode: place.plus_code.compound_code,
        globalCode: place.plus_code.global_code,
      } : undefined,
    };
  }

  private mapBusinessStatus(status?: string): GoogleMapsPlace['businessStatus'] {
    switch (status) {
      case 'OPERATIONAL':
        return 'OPERATIONAL';
      case 'CLOSED_TEMPORARILY':
        return 'CLOSED_TEMPORARILY';
      case 'CLOSED_PERMANENTLY':
        return 'CLOSED_PERMANENTLY';
      default:
        return undefined;
    }
  }

  /**
   * Override base validation to use Google Maps specific health check
   */
  async validateConnection(): Promise<boolean> {
    try {
      // Google Maps doesn't have a dedicated health endpoint
      // Use a simple place search as a connection test
      const params = new URLSearchParams();
      params.append('key', this.config.apiKey);
      params.append('query', 'Google');
      params.append('fields', 'place_id');
      
      const testResponse = await this.makeRequest<GoogleMapsSearchResponse>(
        `/place/textsearch/json?${params.toString()}`,
        { method: 'GET' }
      );
      
      return testResponse.success && testResponse.data?.status === 'OK';
    } catch (error) {
      console.warn('Google Maps connection validation failed:', error);
      return false;
    }
  }

  /**
   * Override makeRequest to use Google Maps specific error handling
   */
  protected async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    cacheKey?: string,
    cacheTTL?: number
  ): Promise<APIResponse<T>> {
    // Check cache first
    if (cacheKey) {
      const cached = await this.cache.get<T>(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }
    }

    const startTime = Date.now();
    let responseStatus = 0;

    try {
      const response = await this.rateLimiter.execute(async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        try {
          const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
            ...options,
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              ...this.getAuthHeaders(),
              ...options.headers,
            },
          });

          clearTimeout(timeoutId);
          return response;
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      });

      responseStatus = response.status;
      const responseTime = Date.now() - startTime;

      // Log API usage
      await this.logAPIUsage(endpoint, options.body, responseStatus, responseTime);

      if (!response.ok) {
        const errorBody = await response.text();
        let parsedBody;
        try {
          parsedBody = errorBody ? JSON.parse(errorBody) : null;
        } catch {
          parsedBody = null;
        }
        const error = GoogleMapsErrorHandler.handleHTTPError(
          response.status,
          response.statusText,
          parsedBody
        );
        return { success: false, error };
      }

      const responseText = await response.text();
      let data: T | undefined = undefined;
      try {
        data = responseText ? JSON.parse(responseText) : undefined;
      } catch (error) {
        console.warn('Failed to parse JSON response:', error);
      }
      
      // Cache successful responses
      if (cacheKey && data) {
        await this.cache.set(cacheKey, data, cacheTTL);
      }

      return { success: true, data };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      await this.logAPIUsage(endpoint, options.body, responseStatus || 0, responseTime);
      
      const apiError = GoogleMapsErrorHandler.handleNetworkError(error);
      return { success: false, error: apiError };
    }
  }

}
