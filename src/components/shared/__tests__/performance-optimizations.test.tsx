/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { LazyPlaceList } from '../lazy-place-list';
import { LazyQRCode } from '../lazy-qr-code';
import { linkListCache, cacheUtils } from '@/lib/services/cache';
import type { Place } from '@/types';

// Mock the QR code generator to avoid loading the actual library in tests
jest.mock('../qr-code-generator', () => ({
  QRCodeGenerator: ({ url, title }: { url: string; title: string }) => (
    <div data-testid="qr-code-generator">
      <h3>{title}</h3>
      <p>{url}</p>
    </div>
  ),
  QRCodeInline: ({ url }: { url: string }) => (
    <div data-testid="qr-code-inline">{url}</div>
  ),
}));

// Mock places data
const createMockPlace = (id: string, title: string): Place => ({
  id,
  title,
  address: `Address for ${title}`,
  latitude: 40.7128,
  longitude: -74.0060,
  notes: undefined,
  tags: ['test'],
  source: 'other' as const,
  sourceUrl: undefined,
  normalizedTitle: title.toLowerCase(),
  normalizedAddress: `address for ${title}`.toLowerCase(),
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('Performance Optimizations', () => {
  beforeEach(() => {
    // Clear cache before each test
    linkListCache.clearAll();
  });

  describe('LazyPlaceList', () => {
    it('should render initial batch of places and show load more button', async () => {
      const places = Array.from({ length: 25 }, (_, i) => 
        createMockPlace(`place-${i}`, `Place ${i + 1}`)
      );

      render(
        <LazyPlaceList 
          places={places}
          initialLoadCount={10}
          loadMoreCount={5}
        />
      );

      // Should show first 10 places
      expect(screen.getByText('Place 1')).toBeInTheDocument();
      expect(screen.getByText('Place 10')).toBeInTheDocument();
      
      // Should not show places beyond initial load
      expect(screen.queryByText('Place 11')).not.toBeInTheDocument();
      
      // Should show load more button
      expect(screen.getByText(/Load More Places/)).toBeInTheDocument();
      expect(screen.getByText(/15 remaining/)).toBeInTheDocument();
    });

    it('should switch between card and compact view modes', async () => {
      const places = Array.from({ length: 10 }, (_, i) => 
        createMockPlace(`place-${i}`, `Place ${i + 1}`)
      );

      render(<LazyPlaceList places={places} />);

      // Should show view mode toggle for more than 5 places
      const viewToggle = screen.getByText('Showing 10 of 10 places');
      expect(viewToggle).toBeInTheDocument();
      
      // Should show the toggle buttons (they contain SVG icons)
      const buttons = screen.getAllByRole('button');
      const toggleButtons = buttons.filter(button => 
        button.className.includes('h-8 w-8 p-0')
      );
      expect(toggleButtons).toHaveLength(2);
    });

    it('should handle empty places list gracefully', () => {
      render(<LazyPlaceList places={[]} />);
      
      expect(screen.getByText('No places found in this link list')).toBeInTheDocument();
    });
  });

  describe('LazyQRCode', () => {
    it('should show generate button initially and load QR code on demand', async () => {
      const testUrl = 'https://example.com/link-list/123';
      
      render(
        <LazyQRCode 
          url={testUrl}
          title="Test QR Code"
          autoLoad={false}
        />
      );

      // Should show generate button initially
      expect(screen.getByText('Generate QR Code')).toBeInTheDocument();
      expect(screen.queryByTestId('qr-code-generator')).not.toBeInTheDocument();
    });

    it('should auto-load QR code when autoLoad is true', async () => {
      const testUrl = 'https://example.com/link-list/123';
      
      render(
        <LazyQRCode 
          url={testUrl}
          title="Test QR Code"
          autoLoad={true}
        />
      );

      // Should show loading state initially
      expect(screen.getByText('Loading QR code generator...')).toBeInTheDocument();
      
      // Should load QR code component
      await waitFor(() => {
        expect(screen.getByTestId('qr-code-generator')).toBeInTheDocument();
      });
    });

    it('should render inline QR code for small displays', async () => {
      const testUrl = 'https://example.com/link-list/123';
      
      render(
        <LazyQRCode 
          url={testUrl}
          inline={true}
          autoLoad={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('qr-code-inline')).toBeInTheDocument();
      });
    });
  });

  describe('Cache Service', () => {
    it('should cache and retrieve places efficiently', () => {
      const place = createMockPlace('test-place', 'Test Place');
      
      // Cache the place
      linkListCache.cachePlace(place.id, place);
      
      // Retrieve from cache
      const cachedPlace = linkListCache.getCachedPlace(place.id);
      expect(cachedPlace).toEqual(place);
    });

    it('should handle cache misses gracefully', () => {
      const placeIds = ['place-1', 'place-2', 'place-3'];
      const place1 = createMockPlace('place-1', 'Place 1');
      
      // Cache only one place
      linkListCache.cachePlace('place-1', place1);
      
      // Check cache status
      const { cached, missing } = linkListCache.getCachedPlaces(placeIds);
      
      expect(cached).toHaveLength(1);
      expect(cached[0]).toEqual(place1);
      expect(missing).toEqual(['place-2', 'place-3']);
    });

    it('should provide cache statistics', () => {
      const place = createMockPlace('test-place', 'Test Place');
      linkListCache.cachePlace(place.id, place);
      
      const stats = linkListCache.getStats();
      
      expect(stats.places.entries).toBeGreaterThan(0);
      expect(stats.places.sizeBytes).toBeGreaterThan(0);
    });
  });

  describe('Connection Detection', () => {
    it('should detect slow connections', () => {
      // Mock navigator.connection
      const mockConnection = {
        effectiveType: '2g',
        saveData: true,
      };
      
      Object.defineProperty(navigator, 'connection', {
        value: mockConnection,
        writable: true,
      });
      
      const isSlowConnection = cacheUtils.isSlowConnection();
      expect(isSlowConnection).toBe(true);
    });

    it('should provide appropriate cache strategy for slow connections', () => {
      // Mock slow connection
      Object.defineProperty(navigator, 'connection', {
        value: { effectiveType: '2g', saveData: true },
        writable: true,
      });
      
      const strategy = cacheUtils.getCacheStrategy();
      
      expect(strategy.aggressiveCaching).toBe(true);
      expect(strategy.preloadEnabled).toBe(false);
      expect(strategy.ttlMultiplier).toBe(2);
    });
  });
});