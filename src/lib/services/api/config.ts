/**
 * API configuration management
 */

import type { APIConfig, APIService } from './types';

export interface APIServiceConfig {
  apple: APIConfig;
  google: APIConfig;
}

export class APIConfigManager {
  private static instance: APIConfigManager;
  private configs: Map<APIService, APIConfig> = new Map();
  private readonly isBrowser = typeof window !== 'undefined';

  private constructor() {
    this.loadConfigs();
  }

  static getInstance(): APIConfigManager {
    if (!APIConfigManager.instance) {
      APIConfigManager.instance = new APIConfigManager();
    }
    return APIConfigManager.instance;
  }

  private loadConfigs(): void {
    const appleKey =
      process.env.APPLE_MAPS_API_KEY ||
      process.env.NEXT_PUBLIC_APPLE_MAPS_API_KEY ||
      '';
    const googleKey =
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
      '';

    // Apple Maps configuration
    this.configs.set('apple_maps', {
      apiKey: this.isBrowser ? '' : appleKey,
      baseUrl: this.isBrowser ? '/api/maps/apple' : 'https://maps-api.apple.com/v1',
      timeout: 10000,
      maxRetries: 3,
      rateLimitPerSecond: 10, // Conservative rate limit
    });

    // Google Maps configuration
    this.configs.set('google_maps', {
      apiKey: this.isBrowser ? '' : googleKey,
      baseUrl: this.isBrowser ? '/api/maps/google' : 'https://maps.googleapis.com/maps/api',
      timeout: 10000,
      maxRetries: 3,
      rateLimitPerSecond: 5, // Conservative rate limit for free tier
    });
  }

  getConfig(service: APIService): APIConfig {
    const config = this.configs.get(service);
    if (!config) {
      throw new Error(`Configuration not found for service: ${service}`);
    }
    return config;
  }

  updateConfig(service: APIService, updates: Partial<APIConfig>): void {
    const currentConfig = this.getConfig(service);
    const updatedConfig = { ...currentConfig, ...updates };
    this.configs.set(service, updatedConfig);
  }

  validateConfig(service: APIService): { valid: boolean; errors: string[] } {
    const config = this.configs.get(service);
    const errors: string[] = [];

    if (!config) {
      errors.push(`Configuration not found for service: ${service}`);
      return { valid: false, errors };
    }

    if (!config.apiKey && !this.isProxyBaseUrl(config.baseUrl)) {
      errors.push(`API key is required for ${service}`);
    }

    if (!config.baseUrl) {
      errors.push(`Base URL is required for ${service}`);
    }

    if (config.timeout <= 0) {
      errors.push(`Timeout must be positive for ${service}`);
    }

    if (config.rateLimitPerSecond <= 0) {
      errors.push(`Rate limit must be positive for ${service}`);
    }

    return { valid: errors.length === 0, errors };
  }

  getAllConfigs(): Record<APIService, APIConfig> {
    return Object.fromEntries(this.configs) as Record<APIService, APIConfig>;
  }

  isConfigured(service: APIService): boolean {
    const config = this.configs.get(service);
    return !!(config && (config.apiKey || this.isProxyBaseUrl(config.baseUrl)));
  }

  getAvailableServices(): APIService[] {
    return Array.from(this.configs.keys()).filter(service => this.isConfigured(service));
  }

  // For development/testing - allows runtime configuration
  setConfig(service: APIService, config: APIConfig): void {
    this.configs.set(service, config);
  }

  // Get configuration status for UI display
  getConfigStatus(): Record<APIService, { configured: boolean; valid: boolean; errors: string[] }> {
    const status: Record<string, any> = {};
    
    for (const service of Array.from(this.configs.keys())) {
      const validation = this.validateConfig(service);
      status[service] = {
        configured: this.isConfigured(service),
        valid: validation.valid,
        errors: validation.errors,
      };
    }

    return status as Record<APIService, { configured: boolean; valid: boolean; errors: string[] }>;
  }

  private isProxyBaseUrl(baseUrl: string): boolean {
    return baseUrl.startsWith('/api/maps/');
  }
}
