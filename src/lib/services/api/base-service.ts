/**
 * Base API service with common functionality
 */

import { APICache } from './cache';
import { APIErrorHandler } from './error-handler';
import { RateLimiter } from './rate-limiter';
import type { APIConfig, APIResponse, APIUsageLog, APIService } from './types';
import { db } from '@/lib/db';

export abstract class BaseAPIService {
  protected cache: APICache;
  protected errorHandler: APIErrorHandler;
  protected rateLimiter: RateLimiter;

  constructor(
    protected config: APIConfig,
    protected serviceName: APIService
  ) {
    this.cache = new APICache();
    this.errorHandler = new APIErrorHandler();
    this.rateLimiter = new RateLimiter(
      config.rateLimitPerSecond,
      5 // max concurrent requests
    );
  }

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
        const error = this.errorHandler.handleHTTPError(
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
      
      const apiError = this.errorHandler.createAPIError(error);
      return { success: false, error: apiError };
    }
  }

  protected async makeRequestWithRetry<T>(
    endpoint: string,
    options: RequestInit = {},
    cacheKey?: string,
    cacheTTL?: number
  ): Promise<APIResponse<T>> {
    return this.errorHandler.executeWithRetry(
      () => this.makeRequest<T>(endpoint, options, cacheKey, cacheTTL)
    );
  }

  protected abstract getAuthHeaders(): Record<string, string>;

  protected generateCacheKey(endpoint: string, params: any): string {
    return this.cache.generateKey(this.serviceName, endpoint, params);
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
      const log: Omit<APIUsageLog, 'id'> = {
        service: this.serviceName,
        endpoint,
        requestData: requestData ? JSON.parse(requestData) : null,
        responseStatus,
        responseTimeMs,
        createdAt: new Date(),
      };

      await db.apiUsageLog.add({
        id: `${this.serviceName}_${Date.now()}_${Math.random()}`,
        ...log,
      });
    } catch (error) {
      console.warn('Failed to log API usage:', error);
    }
  }

  async validateConnection(): Promise<boolean> {
    try {
      const response = await this.makeRequest('/health', { method: 'GET' });
      return response.success;
    } catch (error) {
      return false;
    }
  }

  async getUsageStats(since?: Date): Promise<{
    totalRequests: number;
    successfulRequests: number;
    averageResponseTime: number;
    errorRate: number;
  }> {
    try {
      let query = db.apiUsageLog.where('service').equals(this.serviceName);
      
      if (since) {
        query = query.and(log => log.createdAt >= since);
      }

      const logs = await query.toArray();
      
      if (logs.length === 0) {
        return {
          totalRequests: 0,
          successfulRequests: 0,
          averageResponseTime: 0,
          errorRate: 0,
        };
      }

      const successfulRequests = logs.filter(log => log.responseStatus >= 200 && log.responseStatus < 300).length;
      const totalResponseTime = logs.reduce((sum, log) => sum + log.responseTimeMs, 0);
      
      return {
        totalRequests: logs.length,
        successfulRequests,
        averageResponseTime: totalResponseTime / logs.length,
        errorRate: (logs.length - successfulRequests) / logs.length,
      };
    } catch (error) {
      console.warn('Failed to get usage stats:', error);
      return {
        totalRequests: 0,
        successfulRequests: 0,
        averageResponseTime: 0,
        errorRate: 0,
      };
    }
  }

  async clearCache(): Promise<void> {
    await this.cache.clear();
  }

  async cleanupCache(): Promise<void> {
    await this.cache.cleanup();
  }
}