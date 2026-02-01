import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { v4 as uuidv4 } from 'uuid';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(): string {
  return uuidv4();
}

/**
 * Normalize a string for deduplication comparison
 * - Lowercase
 * - Remove punctuation
 * - Collapse whitespace
 * - Trim
 */
export function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if two places are likely duplicates
 * Based on normalized title/address match or coordinate proximity
 */
export function areLikelyDuplicates(
  place1: { normalizedTitle: string; normalizedAddress: string; latitude?: number; longitude?: number },
  place2: { normalizedTitle: string; normalizedAddress: string; latitude?: number; longitude?: number }
): boolean {
  // Exact normalized match
  if (
    place1.normalizedTitle === place2.normalizedTitle &&
    place1.normalizedAddress === place2.normalizedAddress
  ) {
    return true;
  }

  // Coordinate proximity (within ~100 meters)
  if (
    place1.latitude !== undefined &&
    place1.longitude !== undefined &&
    place2.latitude !== undefined &&
    place2.longitude !== undefined
  ) {
    const distance = haversineDistance(
      place1.latitude,
      place1.longitude,
      place2.latitude,
      place2.longitude
    );
    if (distance < 0.1) {
      // 100 meters
      return true;
    }
  }

  return false;
}

/**
 * Calculate haversine distance between two points in kilometers
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Format a date for display
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

/**
 * Format a date with time for display
 */
export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

/**
 * Debounce a function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}
