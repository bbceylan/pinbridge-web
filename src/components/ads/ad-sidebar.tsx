'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Plane, Hotel, Car, X } from 'lucide-react';
import { adService } from '@/lib/services/ad-service';
import type { AdPlacement } from '@/lib/services/ad-service';

interface AdSidebarProps {
  placement: AdPlacement;
  className?: string;
}

export function AdSidebar({ placement, className = '' }: AdSidebarProps) {
  const adRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!adService.shouldShowAds() || adService.isPremiumUser()) {
      return;
    }

    // Mark ad as shown
    adService.markAdAsShown(placement.id);

    // Initialize AdSense ad
    const initializeAd = () => {
      if (adRef.current && (window as any).adsbygoogle) {
        try {
          ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
          setIsLoaded(true);
        } catch (error) {
          console.warn('Sidebar ad initialization failed:', error);
        }
      }
    };

    const checkAdSense = setInterval(() => {
      if ((window as any).adsbygoogle) {
        initializeAd();
        clearInterval(checkAdSense);
      }
    }, 100);

    return () => clearInterval(checkAdSense);
  }, [placement.id]);

  const handleAdClick = () => {
    adService.trackAdClick(placement.id);
  };

  const handleDismiss = () => {
    setIsVisible(false);
  };

  if (!isVisible || !adService.shouldShowAds() || adService.isPremiumUser()) {
    return null;
  }

  const adConfig = adService.getAdUnitConfig(placement);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Travel-themed native ad */}
      <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-blue-900 flex items-center">
              <MapPin className="h-4 w-4 mr-2" />
              Travel Deals
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-blue-600 hover:bg-blue-100"
              onClick={handleDismiss}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-xs text-blue-700 mb-2">Sponsored</div>
          
          {/* AdSense ad unit */}
          <div ref={adRef} onClick={handleAdClick}>
            <ins
              className="adsbygoogle"
              style={{ 
                display: 'block',
                width: '100%',
                height: '250px'
              }}
              data-ad-client={adConfig['data-ad-client']}
              data-ad-format="rectangle"
            />
          </div>

          {!isLoaded && (
            <div className="space-y-3">
              {/* Fallback content while ad loads */}
              <div className="flex items-center space-x-2">
                <Plane className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Flight Deals</span>
                <Badge variant="secondary" className="text-xs">Up to 60% off</Badge>
              </div>
              
              <div className="flex items-center space-x-2">
                <Hotel className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-900">Hotels</span>
                <Badge variant="secondary" className="text-xs">Free cancellation</Badge>
              </div>
              
              <div className="flex items-center space-x-2">
                <Car className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-900">Car Rentals</span>
                <Badge variant="secondary" className="text-xs">Best prices</Badge>
              </div>

              <div className="pt-2">
                <div className="animate-pulse">
                  <div className="h-20 bg-gray-200 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-3/4 mb-1"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Secondary ad unit */}
      <Card>
        <CardContent className="pt-4">
          <div className="text-xs text-gray-500 mb-2 text-center">Advertisement</div>
          <div onClick={handleAdClick}>
            <ins
              className="adsbygoogle"
              style={{ 
                display: 'block',
                width: '100%',
                height: '200px'
              }}
              data-ad-client={adConfig['data-ad-client']}
              data-ad-format="rectangle"
            />
          </div>
          
          {!isLoaded && (
            <div 
              className="flex items-center justify-center bg-gray-100 border-2 border-dashed border-gray-300 rounded"
              style={{ height: '200px' }}
            >
              <div className="text-center text-gray-500">
                <div className="animate-pulse">
                  <div className="h-4 w-20 bg-gray-300 rounded mb-2 mx-auto"></div>
                  <div className="h-3 w-16 bg-gray-300 rounded mx-auto"></div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}