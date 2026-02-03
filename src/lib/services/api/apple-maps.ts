/**
 * Apple Maps API integration service
 */

import { BaseAPIService } from './base-service';
import { APIConfigManager } from './config';
import { AppleMapsErrorHandler } from './apple-maps-errors';
import { ResponseNormalizer } from './response-normalizer';
import { apiResponseCache } from '../intelligent-cache';
import type { 
  APIConfig, 
  APIResponse, 
  PlaceSearchQuery, 
  BasePlace,
  APIService 
} from './types';
import type { NormalizedPlace } from './response-normalizer';

export interface AppleMapsPlace extends BasePlace {
  // Apple Maps specific fields
  displayMapRegion?: {
    eastLongitude: number;
    westLongitude: number;
    northLatitude: number;
    southLatitude: number;
  };
  formattedAddressLines?: string[];
  mapsUrl?: string;
  telephone?: string;
  fax?: string;
  businessHours?: {
    periods: Array<{
      open: { day: number; time: string };
      close: { day: number; time: string };
    }>;
  };
  photos?: Array<{
    url: string;
    width: number;
    height: number;
  }>;
}

export interface AppleMapsSearchResponse {
  results: Array<{
    displayMapRegion: {
      eastLongitude: number;
      westLongitude: number;
      northLatitude: number;
      southLatitude: number;
    };
    name: string;
    coordinate: {
      latitude: number;
      longitude: number;
    };
    formattedAddressLines: string[];
    structuredAddress: {
      administrativeArea?: string;
      administrativeAreaCode?: string;
      areasOfInterest?: string[];
      country?: string;
      countryCode?: string;
      dependentLocalities?: string[];
      fullThoroughfare?: string;
      locality?: string;
      postCode?: string;
      subLocality?: string;
      subThoroughfare?: string;
      thoroughfare?: string;
    };
    telephone?: string;
    mapsUrl?: string;
    businessHours?: {
      periods: Array<{
        open: { day: number; time: string };
        close: { day: number; time: string };
      }>;
    };
    photos?: Array<{
      url: string;
      width: number;
      height: number;
    }>;
    rating?: number;
    reviewCount?: number;
    categories?: string[];
  }>;
}

export interface AppleMapsPlaceDetailsResponse {
  place: {
    displayMapRegion: {
      eastLongitude: number;
      westLongitude: number;
      northLatitude: number;
      southLatitude: number;
    };
    name: string;
    coordinate: {
      latitude: number;
      longitude: number;
    };
    formattedAddressLines: string[];
    structuredAddress: {
      administrativeArea?: string;
      administrativeAreaCode?: string;
      areasOfInterest?: string[];
      country?: string;
      countryCode?: string;
      dependentLocalities?: string[];
      fullThoroughfare?: string;
      locality?: string;
      postCode?: string;
      subLocality?: string;
      subThoroughfare?: string;
      thoroughfare?: string;
    };
    telephone?: string;
    fax?: string;
    mapsUrl?: string;
    businessHours?: {
      periods: Array<{
        open: { day: number; time: string };
        close: { day: number; time: string };
      }>;
    };
    photos?: Array<{
      url: string;
      width: number;
      height: number;
    }>;
    rating?: number;
    reviewCount?: number;
    categories?: string[];
    website?: string;
  };
}

export class AppleMapsService extends BaseAPIService {
  constructor(config?: APIConfig) {
    const resolvedConfig = config ?? APIConfigManager.getInstance().getConfig('apple_maps');
    super(resolvedConfig, 'apple_maps');
  }

  protected getAuthHeaders(): Record<string, string> {
    if (!this.config.apiKey) {
      return {};
    }
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
    };
  }

  /**
   * Search for places using Apple Maps API
   */
  async searchPlaces(query: PlaceSearchQuery): Promise<APIResponse<AppleMapsPlace[]>> {
    // Generate cache key for this query
    const queryString = this.buildSearchParams(query).toString();
    
    // Check intelligent cache first
    const cachedResponse = await apiResponseCache.getCachedApiResponse('apple', queryString);
    if (cachedResponse) {
      return {
        success: true,
        data: cachedResponse.map(place => this.convertFromNormalized(place)),
        rateLimitInfo: { remaining: 1000, resetTime: new Date() } // Cached response
      };
    }

    const searchParams = this.buildSearchParams(query);
    const cacheKey = this.generateCacheKey('/search', searchParams);
    
    const response = await this.makeRequestWithRetry<AppleMapsSearchResponse>(
      `/search?${searchParams.toString()}`,
      { method: 'GET' },
      cacheKey,
      24 * 60 * 60 * 1000 // 24 hour cache
    );

    if (!response.success || !response.data) {
      return response as APIResponse<AppleMapsPlace[]>;
    }

    const normalizedPlaces = response.data.results.map(result => 
      this.normalizeSearchResult(result)
    );

    // Cache the normalized response in intelligent cache
    const normalizedResults = normalizedPlaces.map(place => 
      ResponseNormalizer.normalizeAppleMapsPlace(place)
    );
    await apiResponseCache.cacheApiResponse('apple', queryString, normalizedResults);

    return {
      success: true,
      data: normalizedPlaces,
      rateLimitInfo: response.rateLimitInfo
    };
  }

  /**
   * Convert normalized place back to Apple Maps format
   */
  private convertFromNormalized(normalized: NormalizedPlace): AppleMapsPlace {
    return {
      id: normalized.id,
      name: normalized.name,
      coordinate: {
        latitude: normalized.latitude,
        longitude: normalized.longitude,
      },
      formattedAddressLines: [normalized.address],
      structuredAddress: {
        fullThoroughfare: normalized.address,
      },
      mapsUrl: normalized.url,
      telephone: normalized.phoneNumber,
      rating: normalized.rating,
      categories: normalized.types,
      website: normalized.website,
    };
  }

  /**
   * Get detailed information about a specific place
   */
  async getPlaceDetails(placeId: string): Promise<APIResponse<AppleMapsPlace>> {
    const cacheKey = this.generateCacheKey('/place', { id: placeId });
    
    const response = await this.makeRequestWithRetry<AppleMapsPlaceDetailsResponse>(
      `/place/${encodeURIComponent(placeId)}`,
      { method: 'GET' },
      cacheKey,
      24 * 60 * 60 * 1000 // 24 hour cache
    );

    if (!response.success || !response.data) {
      return response as APIResponse<AppleMapsPlace>;
    }

    const normalizedPlace = this.normalizePlaceDetails(response.data.place);

    return {
      success: true,
      data: normalizedPlace,
      rateLimitInfo: response.rateLimitInfo
    };
  }

  /**
   * Search for places near a specific coordinate
   */
  async searchNearby(
    latitude: number, 
    longitude: number, 
    radius: number = 1000,
    query?: string
  ): Promise<APIResponse<AppleMapsPlace[]>> {
    const searchQuery: PlaceSearchQuery = {
      name: query || '',
      latitude,
      longitude,
      radius
    };

    return this.searchPlaces(searchQuery);
  }

  /**
   * Search for places using Apple Maps API and return normalized results
   */
  async searchPlacesNormalized(query: PlaceSearchQuery): Promise<APIResponse<NormalizedPlace[]>> {
    const response = await this.searchPlaces(query);
    
    if (!response.success || !response.data) {
      return response as APIResponse<NormalizedPlace[]>;
    }

    const normalizedPlaces = response.data.map(place => 
      ResponseNormalizer.normalizeAppleMapsPlace(place)
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
      return response as APIResponse<NormalizedPlace>;
    }

    const normalizedPlace = ResponseNormalizer.normalizeAppleMapsPlace(response.data);

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
        name: 'Apple Park',
        address: 'Cupertino, CA'
      };
      
      const response = await this.searchPlaces(testQuery);
      return response.success;
    } catch (error) {
      console.warn('Apple Maps API key validation failed:', error);
      return false;
    }
  }

  private buildSearchParams(query: PlaceSearchQuery): URLSearchParams {
    const params = new URLSearchParams();
    
    // Build search query string
    const queryParts: string[] = [];
    if (query.name) {
      queryParts.push(query.name);
    }
    if (query.address) {
      queryParts.push(query.address);
    }
    
    if (queryParts.length > 0) {
      params.append('q', queryParts.join(' '));
    }

    // Add coordinate-based search if available
    if (query.latitude !== undefined && query.longitude !== undefined) {
      params.append('ll', `${query.latitude},${query.longitude}`);
      
      if (query.radius) {
        // Apple Maps uses a region parameter instead of radius
        // Convert radius to a rough region span
        const span = (query.radius / 111000) * 2; // rough conversion from meters to degrees
        params.append('spn', `${span},${span}`);
      }
    }

    // Set result limit
    params.append('limit', '25');
    
    // Request additional fields
    params.append('include', 'displayMapRegion,formattedAddress,structuredAddress,telephone,mapsUrl,businessHours,photos,rating,categories');

    return params;
  }

  private normalizeSearchResult(result: AppleMapsSearchResponse['results'][0]): AppleMapsPlace {
    return {
      id: this.generatePlaceId(result),
      name: result.name,
      address: result.formattedAddressLines?.join(', ') || '',
      latitude: result.coordinate.latitude,
      longitude: result.coordinate.longitude,
      category: result.categories?.[0],
      phoneNumber: result.telephone,
      website: undefined, // Not available in search results
      rating: result.rating,
      isOpen: this.determineOpenStatus(result.businessHours),
      
      // Apple Maps specific fields
      displayMapRegion: result.displayMapRegion,
      formattedAddressLines: result.formattedAddressLines,
      mapsUrl: result.mapsUrl,
      telephone: result.telephone,
      businessHours: result.businessHours,
      photos: result.photos,
    };
  }

  private normalizePlaceDetails(place: AppleMapsPlaceDetailsResponse['place']): AppleMapsPlace {
    return {
      id: this.generatePlaceId(place),
      name: place.name,
      address: place.formattedAddressLines?.join(', ') || '',
      latitude: place.coordinate.latitude,
      longitude: place.coordinate.longitude,
      category: place.categories?.[0],
      phoneNumber: place.telephone,
      website: place.website,
      rating: place.rating,
      isOpen: this.determineOpenStatus(place.businessHours),
      
      // Apple Maps specific fields
      displayMapRegion: place.displayMapRegion,
      formattedAddressLines: place.formattedAddressLines,
      mapsUrl: place.mapsUrl,
      telephone: place.telephone,
      fax: place.fax,
      businessHours: place.businessHours,
      photos: place.photos,
    };
  }

  private generatePlaceId(place: any): string {
    // Generate a consistent ID based on name and coordinates
    const name = place.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const lat = Math.round(place.coordinate.latitude * 100000);
    const lng = Math.round(place.coordinate.longitude * 100000);
    return `apple_${name}_${lat}_${lng}`;
  }

  private determineOpenStatus(businessHours?: AppleMapsPlace['businessHours']): boolean | undefined {
    if (!businessHours?.periods || businessHours.periods.length === 0) {
      return undefined;
    }

    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const currentTime = now.getHours() * 100 + now.getMinutes(); // HHMM format

    // Find today's hours
    const todayHours = businessHours.periods.find(period => 
      period.open.day === currentDay
    );

    if (!todayHours) {
      return false; // Closed today
    }

    const openTime = parseInt(todayHours.open.time.replace(':', ''));
    const closeTime = parseInt(todayHours.close.time.replace(':', ''));

    // Handle overnight hours (e.g., open until 2 AM next day)
    if (closeTime < openTime) {
      return currentTime >= openTime || currentTime <= closeTime;
    }

    return currentTime >= openTime && currentTime <= closeTime;
  }

  /**
   * Override base validation to use Apple Maps specific health check
   */
  async validateConnection(): Promise<boolean> {
    try {
      // Apple Maps doesn't have a dedicated health endpoint
      // Use a simple search as a connection test
      const testResponse = await this.makeRequest<AppleMapsSearchResponse>(
        '/search?q=Apple&limit=1',
        { method: 'GET' }
      );
      
      return testResponse.success;
    } catch (error) {
      console.warn('Apple Maps connection validation failed:', error);
      return false;
    }
  }

  /**
   * Override makeRequest to use Apple Maps specific error handling
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
        const errorBody = await this.safeParseJSON(response);
        const error = AppleMapsErrorHandler.handleHTTPError(
          response.status,
          response.statusText,
          errorBody
        );
        return { success: false, error };
      }

      const data = await this.safeParseJSON<T>(response);
      
      // Cache successful responses
      if (cacheKey && data) {
        await this.cache.set(cacheKey, data, cacheTTL);
      }

      return { success: true, data };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      await this.logAPIUsage(endpoint, options.body, responseStatus || 0, responseTime);
      
      const apiError = AppleMapsErrorHandler.handleNetworkError(error);
      return { success: false, error: apiError };
    }
  }

  private async safeParseJSON<T>(response: Response): Promise<T | null> {
    try {
      const text = await response.text();
      return text ? JSON.parse(text) : null;
    } catch (error) {
      console.warn('Failed to parse JSON response:', error);
      return null;
    }
  }

  private async logAPIUsage(
    endpoint: string,
    requestData: any,
    responseStatus: number,
    responseTimeMs: number
  ): Promise<void> {
    try {
      const { db } = await import('@/lib/db');
      const log = {
        id: `${this.serviceName}_${Date.now()}_${Math.random()}`,
        service: this.serviceName,
        endpoint,
        requestData: requestData ? JSON.parse(requestData) : null,
        responseStatus,
        responseTimeMs,
        createdAt: new Date(),
      };

      await db.apiUsageLog.add(log);
    } catch (error) {
      console.warn('Failed to log API usage:', error);
    }
  }
}
