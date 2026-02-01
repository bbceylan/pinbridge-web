'use client';

import { generateAppleMapsUrl, generateGoogleMapsUrl } from '@/lib/links';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, ExternalLink, AlertCircle } from 'lucide-react';
import type { Place } from '@/types';

export interface PlaceLinkProps {
  place: Place;
  showBothLinks?: boolean;
}

export function PlaceLink({ place, showBothLinks = true }: PlaceLinkProps) {
  const handleOpenInAppleMaps = () => {
    try {
      const url = generateAppleMapsUrl(place);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Failed to open in Apple Maps:', error);
    }
  };

  const handleOpenInGoogleMaps = () => {
    try {
      const url = generateGoogleMapsUrl(place);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Failed to open in Google Maps:', error);
    }
  };

  const hasCoordinates = place.latitude !== undefined && place.longitude !== undefined;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Place Icon */}
          <div className="flex-shrink-0 mt-1">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
          </div>

          {/* Place Information */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg leading-tight mb-1">
              {place.title}
            </h3>
            
            <p className="text-muted-foreground text-sm mb-3">
              {place.address}
            </p>

            {/* Coordinates Warning */}
            {!hasCoordinates && (
              <div className="flex items-center gap-2 text-amber-600 text-sm mb-3">
                <AlertCircle className="w-4 h-4" />
                <span>Using address search (coordinates missing)</span>
              </div>
            )}

            {/* Tags */}
            {place.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {place.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 text-xs rounded-full bg-secondary text-secondary-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2">
              {showBothLinks ? (
                <>
                  <Button
                    variant="default"
                    size="default"
                    onClick={handleOpenInAppleMaps}
                    className="flex items-center gap-2 flex-1 min-h-[44px]"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open in Apple Maps
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="default"
                    onClick={handleOpenInGoogleMaps}
                    className="flex items-center gap-2 flex-1 min-h-[44px]"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open in Google Maps
                  </Button>
                </>
              ) : (
                <Button
                  variant="default"
                  size="default"
                  onClick={handleOpenInAppleMaps}
                  className="flex items-center gap-2 min-h-[44px]"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open in Maps
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Compact version for dense lists
export function PlaceLinkCompact({ place }: { place: Place }) {
  const handleOpenInAppleMaps = () => {
    try {
      const url = generateAppleMapsUrl(place);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Failed to open in Apple Maps:', error);
    }
  };

  const handleOpenInGoogleMaps = () => {
    try {
      const url = generateGoogleMapsUrl(place);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Failed to open in Google Maps:', error);
    }
  };

  const hasCoordinates = place.latitude !== undefined && place.longitude !== undefined;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
      <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{place.title}</p>
        <p className="text-sm text-muted-foreground truncate">{place.address}</p>
        {!hasCoordinates && (
          <p className="text-xs text-amber-600">Address search only</p>
        )}
      </div>

      <div className="flex gap-1 flex-shrink-0">
        <Button
          variant="ghost"
          size="default"
          onClick={handleOpenInAppleMaps}
          className="min-h-[44px] min-w-[44px] p-2"
          title="Open in Apple Maps"
        >
          <ExternalLink className="w-4 h-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="default"
          onClick={handleOpenInGoogleMaps}
          className="min-h-[44px] min-w-[44px] p-2"
          title="Open in Google Maps"
        >
          <ExternalLink className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}