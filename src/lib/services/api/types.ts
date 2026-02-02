/**
 * Common types for API integration layer
 */

export interface PlaceSearchQuery {
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  radius?: number; // meters
}

export interface BasePlace {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  category?: string;
  phoneNumber?: string;
  website?: string;
  rating?: number;
  isOpen?: boolean;
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: APIError;
  rateLimitInfo?: RateLimitInfo;
}

export interface APIError {
  code: string;
  message: string;
  details?: any;
  retryAfter?: number;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: Date;
}

export interface APIConfig {
  apiKey: string;
  baseUrl: string;
  timeout: number;
  maxRetries: number;
  rateLimitPerSecond: number;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: Date;
  ttl: number; // Time to live in milliseconds
}

export type APIService = 'apple_maps' | 'google_maps';

export interface APIUsageLog {
  id: string;
  service: APIService;
  endpoint: string;
  sessionId?: string;
  requestData: any;
  responseStatus: number;
  responseTimeMs: number;
  createdAt: Date;
}