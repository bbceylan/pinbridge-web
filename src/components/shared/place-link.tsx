'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, ExternalLink, Apple, Navigation } from 'lucide-react';
import { generateAppleMapsUrl, generateGoogleMapsUrl } from '@/lib/links';
import type { Place } from '@/types';

export interface PlaceLinkProps {
  place: Place;
  showBothLinks?: boolean;
  className?: string;
}

export function PlaceLink({ place, showBothLinks = true, className = '' }: PlaceLinkProps) {
  const [linkError, setLinkError] = useState<string | null>(null);

  const handleLinkClick = (url: string, type: 'apple' | 'google') => {
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error(`Failed to open ${type} maps link:`, error);
      setLinkError(`Failed to open ${type === 'apple' ? 'Apple' : 'Google'} Maps`);
      setTimeout(() => setLinkError(null), 3000);
    }
  };

  const appleMapsUrl = generateAppleMapsUrl(place);
  const googleMapsUrl = generateGoogleMapsUrl(place);

  return (
    <Card className={`hover:shadow-md transition-shadow ${className}`}>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Place Info */}
          <div className="space-y-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium text-lg leading-tight">{place.title}</h3>
              <MapPin className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            </div>
            <p className="text-muted-foreground text-sm">{place.address}</p>
            
            {/* Tags */}
            {place.tags && place.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {place.tags.slice(0, 3).map((tag, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {place.tags.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{place.tags.length - 3} more
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Error Display */}
          {linkError && (
            <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
              {linkError}
            </div>
          )}

          {/* Map Links */}
          <div className="flex gap-2">
            {showBothLinks ? (
              <>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => handleLinkClick(appleMapsUrl, 'apple')}
                  className="flex-1 flex items-center gap-2"
                >
                  <Apple className="w-4 h-4" />
                  Apple Maps
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => handleLinkClick(googleMapsUrl, 'google')}
                  className="flex-1 flex items-center gap-2"
                >
                  <Navigation className="w-4 h-4" />
                  Google Maps
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  // Prefer Apple Maps on iOS, Google Maps otherwise
                  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                  const url = isIOS ? appleMapsUrl : googleMapsUrl;
                  const type = isIOS ? 'apple' : 'google';
                  handleLinkClick(url, type);
                }}
                className="flex-1 flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Open in Maps
              </Button>
            )}
          </div>

          {/* Coordinates (for debugging, only in development) */}
          {process.env.NODE_ENV === 'development' && place.latitude && place.longitude && (
            <div className="text-xs text-muted-foreground">
              {place.latitude.toFixed(6)}, {place.longitude.toFixed(6)}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Compact version for dense lists
export function PlaceLinkCompact({ place, className = '' }: PlaceLinkProps) {
  const [linkError, setLinkError] = useState<string | null>(null);

  const handleLinkClick = (url: string, type: 'apple' | 'google') => {
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error(`Failed to open ${type} maps link:`, error);
      setLinkError(`Failed to open ${type === 'apple' ? 'Apple' : 'Google'} Maps`);
      setTimeout(() => setLinkError(null), 3000);
    }
  };

  const appleMapsUrl = generateAppleMapsUrl(place);
  const googleMapsUrl = generateGoogleMapsUrl(place);

  return (
    <div className={`border rounded-lg p-3 hover:bg-accent transition-colors ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <h4 className="font-medium truncate">{place.title}</h4>
              <p className="text-sm text-muted-foreground truncate">{place.address}</p>
            </div>
          </div>
          
          {linkError && (
            <div className="text-xs text-red-600 mt-1">{linkError}</div>
          )}
        </div>

        <div className="flex gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleLinkClick(appleMapsUrl, 'apple')}
            className="min-h-[44px] min-w-[44px] p-2"
            title="Open in Apple Maps"
          >
            <Apple className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleLinkClick(googleMapsUrl, 'google')}
            className="min-h-[44px] min-w-[44px] p-2"
            title="Open in Google Maps"
          >
            <Navigation className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// Hook for managing place link interactions
export function usePlaceLinks(place: Place) {
  const [error, setError] = useState<string | null>(null);

  const openInAppleMaps = () => {
    try {
      const url = generateAppleMapsUrl(place);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError('Failed to open Apple Maps');
      setTimeout(() => setError(null), 3000);
    }
  };

  const openInGoogleMaps = () => {
    try {
      const url = generateGoogleMapsUrl(place);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError('Failed to open Google Maps');
      setTimeout(() => setError(null), 3000);
    }
  };

  const openInPreferredMaps = () => {
    // Prefer Apple Maps on iOS, Google Maps otherwise
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      openInAppleMaps();
    } else {
      openInGoogleMaps();
    }
  };

  return {
    error,
    openInAppleMaps,
    openInGoogleMaps,
    openInPreferredMaps,
    appleMapsUrl: generateAppleMapsUrl(place),
    googleMapsUrl: generateGoogleMapsUrl(place),
  };
}