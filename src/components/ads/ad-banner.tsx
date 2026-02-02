'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Shield, Heart } from 'lucide-react';
import { adService } from '@/lib/services/ad-service';
import type { AdPlacement } from '@/lib/services/ad-service';

interface AdBannerProps {
  placement: AdPlacement;
  className?: string;
  showLabel?: boolean;
}

export function AdBanner({ placement, className = '', showLabel = true }: AdBannerProps) {
  const adRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showAdBlock, setShowAdBlock] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!adService.shouldShowAds()) {
      setShowAdBlock(true);
      return;
    }

    // Mark ad as shown for frequency tracking
    adService.markAdAsShown(placement.id);

    // Initialize AdSense ad
    const initializeAd = () => {
      if (adRef.current && (window as any).adsbygoogle) {
        try {
          ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
          setIsLoaded(true);
        } catch (error) {
          console.warn('AdSense initialization failed:', error);
          setShowAdBlock(true);
        }
      }
    };

    // Wait for AdSense to load
    const checkAdSense = setInterval(() => {
      if ((window as any).adsbygoogle) {
        initializeAd();
        clearInterval(checkAdSense);
      }
    }, 100);

    // Cleanup
    return () => {
      clearInterval(checkAdSense);
    };
  }, [placement.id]);

  const handleAdClick = () => {
    adService.trackAdClick(placement.id);
  };

  const handleDismiss = () => {
    setIsVisible(false);
  };

  const adConfig = adService.getAdUnitConfig(placement);

  if (!isVisible) return null;

  // Show ad block message for users with ad blockers
  if (showAdBlock && !adService.isPremiumUser()) {
    return (
      <Card className={`border-orange-200 bg-orange-50 ${className}`}>
        <CardContent className="pt-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <Shield className="h-5 w-5 text-orange-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-orange-900 mb-1">Support PinBridge</h4>
                <p className="text-sm text-orange-800 mb-3">
                  {adService.getAdBlockMessage()}
                </p>
                <div className="flex space-x-2">
                  <Button size="sm" variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-100">
                    <Heart className="h-3 w-3 mr-1" />
                    Disable Ad Blocker
                  </Button>
                  <Button size="sm" className="bg-orange-600 hover:bg-orange-700">
                    Go Premium
                  </Button>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-orange-600 hover:bg-orange-100"
              onClick={handleDismiss}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Don't show anything for premium users
  if (adService.isPremiumUser()) {
    return null;
  }

  return (
    <div className={`ad-container ${className}`}>
      {showLabel && (
        <div className="text-xs text-gray-500 mb-1 text-center">
          Advertisement
        </div>
      )}
      
      <div 
        ref={adRef}
        className="ad-banner"
        onClick={handleAdClick}
        style={{ 
          minHeight: placement.size === 'small' ? '100px' : 
                     placement.size === 'medium' ? '90px' : 
                     placement.size === 'large' ? '250px' : '90px'
        }}
      >
        <ins
          className="adsbygoogle"
          style={adConfig.style}
          data-ad-client={adConfig['data-ad-client']}
          data-ad-format={adConfig['data-ad-format']}
          data-full-width-responsive={adConfig['data-full-width-responsive']}
        />
      </div>

      {!isLoaded && (
        <div 
          className="flex items-center justify-center bg-gray-100 border-2 border-dashed border-gray-300 rounded"
          style={adConfig.style}
        >
          <div className="text-center text-gray-500">
            <div className="animate-pulse">
              <div className="h-4 w-24 bg-gray-300 rounded mb-2 mx-auto"></div>
              <div className="h-3 w-16 bg-gray-300 rounded mx-auto"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}