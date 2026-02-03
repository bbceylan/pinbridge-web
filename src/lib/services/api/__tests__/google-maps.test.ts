/**
 * @jest-environment jsdom
 */

import { GoogleMapsService } from '../google-maps';

const config = {
  apiKey: 'test-key',
  baseUrl: 'https://maps.googleapis.com/maps/api',
  timeout: 1000,
  maxRetries: 1,
  rateLimitPerSecond: 1,
};

describe('GoogleMapsService', () => {
  it('constructs with config', () => {
    const service = new GoogleMapsService(config);
    expect(service).toBeDefined();
  });
});
