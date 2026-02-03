'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Plane, Hotel, Car, Star, ExternalLink, X } from 'lucide-react';
import { adService } from '@/lib/services/ad-service';
import type { AdPlacement } from '@/lib/services/ad-service';

interface AdNativeProps {
  placement: AdPlacement;
  className?: string;
  variant?: 'travel' | 'productivity' | 'general';
}

const TRAVEL_ADS = [
  {
    title: "Find Amazing Flight Deals",
    description: "Compare prices from 500+ airlines and save up to 60% on your next trip",
    icon: Plane,
    badge: "Up to 60% off",
    color: "blue",
    cta: "Search Flights"
  },
  {
    title: "Book Hotels with Free Cancellation",
    description: "Over 1 million properties worldwide with flexible booking options",
    icon: Hotel,
    badge: "Free cancellation",
    color: "green",
    cta: "Find Hotels"
  },
  {
    title: "Rent a Car for Your Journey",
    description: "Compare car rental prices and find the perfect vehicle for your trip",
    icon: Car,
    badge: "Best prices",
    color: "purple",
    cta: "Rent Now"
  }
];

const PRODUCTIVITY_ADS = [
  {
    title: "Organize Your Travel Plans",
    description: "Keep all your bookings, itineraries, and documents in one place",
    icon: MapPin,
    badge: "Free trial",
    color: "indigo",
    cta: "Try Free"
  }
];

export function AdNative({ placement, className = '', variant = 'travel' }: AdNativeProps) {
  const adRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [selectedAd, setSelectedAd] = useState(0);

  useEffect(() => {
    if (!adService.shouldShowAds() || adService.isPremiumUser()) {
      return;
    }

    // Mark ad as shown
    adService.markAdAsShown(placement.id);

    // Rotate ads every 10 seconds
    const interval = setInterval(() => {
      const ads = variant === 'travel' ? TRAVEL_ADS : PRODUCTIVITY_ADS;
      setSelectedAd(prev => (prev + 1) % ads.length);
    }, 10000);

    // Initialize AdSense ad
    const initializeAd = () => {
      if (adRef.current && (window as any).adsbygoogle) {
        try {
          ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
          setIsLoaded(true);
        } catch (error) {
          console.warn('Native ad initialization failed:', error);
        }
      }
    };

    const checkAdSense = setInterval(() => {
      if ((window as any).adsbygoogle) {
        initializeAd();
        clearInterval(checkAdSense);
      }
    }, 100);

    return () => {
      clearInterval(interval);
      clearInterval(checkAdSense);
    };
  }, [placement.id, variant]);

  const handleAdClick = () => {
    adService.trackAdClick(placement.id);
  };

  const handleDismiss = () => {
    setIsVisible(false);
  };

  if (!isVisible || !adService.shouldShowAds() || adService.isPremiumUser()) {
    return null;
  }

  const ads = variant === 'travel' ? TRAVEL_ADS : PRODUCTIVITY_ADS;
  const currentAd = ads[selectedAd];
  const adConfig = adService.getAdUnitConfig(placement);

  const getColorClasses = (color: string) => {
    const colors = {
      blue: 'from-blue-50 to-blue-100 border-blue-200 text-blue-900',
      green: 'from-green-50 to-green-100 border-green-200 text-green-900',
      purple: 'from-purple-50 to-purple-100 border-purple-200 text-purple-900',
      indigo: 'from-indigo-50 to-indigo-100 border-indigo-200 text-indigo-900',
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  return (
    <Card className={`${className} border-2 bg-gradient-to-r ${getColorClasses(currentAd.color)}`}>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between mb-3">
          <div className="text-xs text-gray-600 bg-white px-2 py-1 rounded">
            Sponsored
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-white/50"
            onClick={handleDismiss}
            aria-label="Close"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>

        {/* AdSense Native Ad */}
        <div ref={adRef} onClick={handleAdClick} className="mb-4">
          <ins
            className="adsbygoogle"
            style={{ 
              display: 'block',
              width: '100%',
              height: '120px'
            }}
            data-ad-client={adConfig['data-ad-client']}
            data-ad-format="fluid"
            data-ad-layout-key="-6t+ed+2i-1n-4w"
          />
        </div>

        {/* Fallback Native Ad Content */}
        {!isLoaded && (
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className={`p-2 rounded-lg bg-white/50`}>
                <currentAd.icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <h3 className="font-semibold text-sm">{currentAd.title}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {currentAd.badge}
                  </Badge>
                </div>
                <p className="text-xs opacity-90 mb-3">
                  {currentAd.description}
                </p>
                <Button 
                  size="sm" 
                  className="bg-white/20 hover:bg-white/30 text-current border-current/20"
                  onClick={handleAdClick}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  {currentAd.cta}
                </Button>
              </div>
            </div>

            {/* Trust indicators */}
            <div className="flex items-center justify-between text-xs opacity-75 pt-2 border-t border-white/20">
              <div className="flex items-center space-x-1">
                <Star className="h-3 w-3 fill-current" />
                <span>4.8/5 rating</span>
              </div>
              <div>
                <span>Trusted by 1M+ travelers</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
