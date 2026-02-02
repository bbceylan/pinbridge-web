/**
 * API service factory and main exports
 */

export * from './types';
export * from './base-service';
export * from './config';
export * from './cache';
export * from './error-handler';
export * from './rate-limiter';
export * from './apple-maps';
export * from './apple-maps-errors';
export * from './google-maps';
export * from './google-maps-errors';
export * from './response-normalizer';

import { APIConfigManager } from './config';
import { AppleMapsService } from './apple-maps';
import { GoogleMapsService } from './google-maps';
import type { APIService } from './types';

// Service factory
export class APIServiceFactory {
  private static instance: APIServiceFactory;
  private configManager: APIConfigManager;

  private constructor() {
    this.configManager = APIConfigManager.getInstance();
  }

  static getInstance(): APIServiceFactory {
    if (!APIServiceFactory.instance) {
      APIServiceFactory.instance = new APIServiceFactory();
    }
    return APIServiceFactory.instance;
  }

  async createService(service: APIService) {
    const config = this.configManager.getConfig(service);
    const validation = this.configManager.validateConfig(service);

    if (!validation.valid) {
      throw new Error(`Invalid configuration for ${service}: ${validation.errors.join(', ')}`);
    }

    switch (service) {
      case 'apple_maps':
        return new AppleMapsService(config);
      case 'google_maps':
        return new GoogleMapsService(config);
      default:
        throw new Error(`Unknown service: ${service}`);
    }
  }

  getAvailableServices(): APIService[] {
    return this.configManager.getAvailableServices();
  }

  getConfigStatus() {
    return this.configManager.getConfigStatus();
  }
}

// Convenience function for getting service factory
export function getAPIServiceFactory(): APIServiceFactory {
  return APIServiceFactory.getInstance();
}

// Convenience function for getting config manager
export function getAPIConfigManager(): APIConfigManager {
  return APIConfigManager.getInstance();
}