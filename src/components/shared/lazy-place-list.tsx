'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { PlaceLink, PlaceLinkCompact } from './place-link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Grid, List } from 'lucide-react';
import type { Place } from '@/types';

interface LazyPlaceListProps {
  places: Place[];
  initialLoadCount?: number;
  loadMoreCount?: number;
  compact?: boolean;
  className?: string;
}

export function LazyPlaceList({ 
  places, 
  initialLoadCount = 10,
  loadMoreCount = 10,
  compact = false,
  className = ''
}: LazyPlaceListProps) {
  const [displayedPlaces, setDisplayedPlaces] = useState<Place[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [viewMode, setViewMode] = useState<'card' | 'compact'>(compact ? 'compact' : 'card');
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Initialize with first batch of places
  useEffect(() => {
    const initialPlaces = places.slice(0, initialLoadCount);
    setDisplayedPlaces(initialPlaces);
    setHasMore(places.length > initialLoadCount);
  }, [places, initialLoadCount]);

  // Load more places function
  const loadMorePlaces = useCallback(() => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    
    // Simulate network delay for better UX (remove in production if not needed)
    setTimeout(() => {
      const currentCount = displayedPlaces.length;
      const nextBatch = places.slice(currentCount, currentCount + loadMoreCount);
      
      setDisplayedPlaces(prev => [...prev, ...nextBatch]);
      setHasMore(currentCount + nextBatch.length < places.length);
      setIsLoading(false);
    }, 100);
  }, [places, displayedPlaces.length, loadMoreCount, isLoading, hasMore]);

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !isLoading) {
          loadMorePlaces();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '100px', // Start loading 100px before the element is visible
      }
    );

    observerRef.current.observe(loadMoreRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loadMorePlaces, hasMore, isLoading]);

  // Cleanup observer on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  if (places.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">No places found in this link list</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* View Mode Toggle (only show if more than 5 places) */}
      {places.length > 5 && (
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            Showing {displayedPlaces.length} of {places.length} places
          </p>
          <div className="flex gap-1 border rounded-lg p-1">
            <Button
              variant={viewMode === 'card' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('card')}
              className="h-8 w-8 p-0"
            >
              <Grid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'compact' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('compact')}
              className="h-8 w-8 p-0"
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Places List */}
      <div className={viewMode === 'compact' ? 'space-y-2' : 'space-y-3'}>
        {displayedPlaces.map((place, index) => (
          <div key={`${place.id}-${index}`}>
            {viewMode === 'compact' ? (
              <PlaceLinkCompact place={place} />
            ) : (
              <PlaceLink place={place} />
            )}
          </div>
        ))}
      </div>

      {/* Loading Indicator and Load More Trigger */}
      {hasMore && (
        <div ref={loadMoreRef} className="flex justify-center py-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading more places...</span>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={loadMorePlaces}
              className="min-h-[44px]"
            >
              Load More Places ({places.length - displayedPlaces.length} remaining)
            </Button>
          )}
        </div>
      )}

      {/* Performance Info (only in development) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-muted-foreground text-center pt-4 border-t">
          Performance: Lazy loaded {displayedPlaces.length}/{places.length} places
        </div>
      )}
    </div>
  );
}

// Hook for managing lazy loading state
export function useLazyLoading<T>(
  items: T[],
  initialCount: number = 10,
  loadMoreCount: number = 10
) {
  const [displayedItems, setDisplayedItems] = useState<T[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const initialItems = items.slice(0, initialCount);
    setDisplayedItems(initialItems);
    setHasMore(items.length > initialCount);
  }, [items, initialCount]);

  const loadMore = useCallback(() => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    
    setTimeout(() => {
      const currentCount = displayedItems.length;
      const nextBatch = items.slice(currentCount, currentCount + loadMoreCount);
      
      setDisplayedItems(prev => [...prev, ...nextBatch]);
      setHasMore(currentCount + nextBatch.length < items.length);
      setIsLoading(false);
    }, 50);
  }, [items, displayedItems.length, loadMoreCount, isLoading, hasMore]);

  return {
    displayedItems,
    hasMore,
    isLoading,
    loadMore,
    totalCount: items.length,
    displayedCount: displayedItems.length,
  };
}