import type { Place } from '@/types';

/**
 * Generate Apple Maps URL for a place
 * Prefers coordinates when available, falls back to address query
 */
export function generateAppleMapsUrl(place: Place): string {
  const baseUrl = 'https://maps.apple.com/';

  if (place.latitude !== undefined && place.longitude !== undefined) {
    // Use coordinates for more accurate location
    const params = new URLSearchParams({
      ll: `${place.latitude},${place.longitude}`,
      q: place.title,
    });
    return `${baseUrl}?${params.toString()}`;
  }

  // Fall back to address/title query
  const query = place.address || place.title;
  const params = new URLSearchParams({ q: query });
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Generate Google Maps URL for a place
 * Prefers coordinates when available, falls back to address query
 */
export function generateGoogleMapsUrl(place: Place): string {
  const baseUrl = 'https://www.google.com/maps/search/';

  if (place.latitude !== undefined && place.longitude !== undefined) {
    // Use coordinates for more accurate location
    return `${baseUrl}?api=1&query=${place.latitude},${place.longitude}`;
  }

  // Fall back to address/title query
  const query = encodeURIComponent(place.address || place.title);
  return `${baseUrl}?api=1&query=${query}`;
}

/**
 * Parse an Apple Maps URL to extract place information
 */
export function parseAppleMapsUrl(url: string): Partial<Place> | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('maps.apple.com')) {
      return null;
    }

    const result: Partial<Place> = {
      sourceUrl: url,
      source: 'apple',
    };

    // Extract query parameter
    const query = parsed.searchParams.get('q');
    if (query) {
      result.title = query;
      result.address = query;
    }

    // Extract coordinates if present
    const ll = parsed.searchParams.get('ll');
    if (ll) {
      const [lat, lng] = ll.split(',').map(Number);
      if (!isNaN(lat) && !isNaN(lng)) {
        result.latitude = lat;
        result.longitude = lng;
      }
    }

    return result;
  } catch {
    return null;
  }
}

/**
 * Parse a Google Maps URL to extract place information
 */
export function parseGoogleMapsUrl(url: string): Partial<Place> | null {
  try {
    const parsed = new URL(url);
    if (
      !parsed.hostname.includes('google.com') &&
      !parsed.hostname.includes('goo.gl') &&
      !parsed.hostname.includes('maps.app.goo.gl')
    ) {
      return null;
    }

    const result: Partial<Place> = {
      sourceUrl: url,
      source: 'google',
    };

    // Try to extract from search URL
    const query = parsed.searchParams.get('query');
    if (query) {
      // Check if it's coordinates
      const coordMatch = query.match(/^(-?\d+\.?\d*),(-?\d+\.?\d*)$/);
      if (coordMatch) {
        result.latitude = parseFloat(coordMatch[1]);
        result.longitude = parseFloat(coordMatch[2]);
      } else {
        result.title = query;
        result.address = query;
      }
    }

    // Try to extract from place URL pattern: /place/Name/@lat,lng,zoom
    const placeMatch = parsed.pathname.match(/\/place\/([^/@]+)/);
    if (placeMatch) {
      result.title = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
    }

    const coordMatch = parsed.pathname.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (coordMatch) {
      result.latitude = parseFloat(coordMatch[1]);
      result.longitude = parseFloat(coordMatch[2]);
    }

    return result;
  } catch {
    return null;
  }
}

/**
 * Detect provider from URL
 */
export function detectProvider(url: string): 'apple' | 'google' | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('maps.apple.com')) {
      return 'apple';
    }
    if (
      parsed.hostname.includes('google.com') ||
      parsed.hostname.includes('goo.gl') ||
      parsed.hostname.includes('maps.app.goo.gl')
    ) {
      return 'google';
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Parse any supported map URL
 */
export function parseMapUrl(url: string): Partial<Place> | null {
  const provider = detectProvider(url);
  if (provider === 'apple') {
    return parseAppleMapsUrl(url);
  }
  if (provider === 'google') {
    return parseGoogleMapsUrl(url);
  }
  return null;
}
