'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, Crown, X, Heart } from 'lucide-react';
import { adService } from '@/lib/services/ad-service';

interface AdBlockerNoticeProps {
  onDismiss?: () => void;
  showUpgradeOption?: boolean;
}

export function AdBlockerNotice({ onDismiss, showUpgradeOption = true }: AdBlockerNoticeProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if ad blocker is detected and user hasn't dismissed
    const checkAdBlocker = () => {
      const dismissed = localStorage.getItem('pinbridge_adblocker_dismissed');
      if (dismissed) {
        setIsDismissed(true);
        return;
      }

      // Simple ad blocker detection
      const testAd = document.createElement('div');
      testAd.innerHTML = '&nbsp;';
      testAd.className = 'adsbox';
      testAd.style.position = 'absolute';
      testAd.style.left = '-10000px';
      testAd.style.width = '1px';
      testAd.style.height = '1px';
      
      document.body.appendChild(testAd);

      setTimeout(() => {
        if (testAd.offsetHeight === 0) {
          setIsVisible(true);
        }
        document.body.removeChild(testAd);
      }, 100);
    };

    // Only check if ads should be shown and user is not premium
    if (adService.shouldShowAds() && !adService.isPremiumUser()) {
      checkAdBlocker();
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    localStorage.setItem('pinbridge_adblocker_dismissed', 'true');
    onDismiss?.();
  };

  const handleUpgrade = () => {
    window.location.href = '/premium';
  };

  if (!isVisible || isDismissed || adService.isPremiumUser()) {
    return null;
  }

  return (
    <Card className="border-orange-200 bg-gradient-to-r from-orange-50 to-yellow-50 mb-6">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 flex-1">
            <Shield className="h-6 w-6 text-orange-600 mt-1 flex-shrink-0" />
            <div className="space-y-3">
              <div>
                <h3 className="font-semibold text-orange-900 mb-1">
                  Ad Blocker Detected
                </h3>
                <p className="text-sm text-orange-800">
                  We notice you're using an ad blocker. PinBridge is free thanks to ads that help cover our costs for map APIs and hosting.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-orange-300 text-orange-800 hover:bg-orange-100"
                  onClick={handleDismiss}
                >
                  <Heart className="h-4 w-4 mr-1" />
                  I'll support PinBridge
                </Button>
                
                {showUpgradeOption && (
                  <Button
                    size="sm"
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                    onClick={handleUpgrade}
                  >
                    <Crown className="h-4 w-4 mr-1" />
                    Go Ad-Free with Premium
                  </Button>
                )}
              </div>

              <div className="text-xs text-orange-700">
                <p className="mb-1">
                  <strong>Why we show ads:</strong>
                </p>
                <ul className="space-y-0.5 ml-4">
                  <li>• Map API costs (Google Maps, Apple Maps)</li>
                  <li>• Server hosting and maintenance</li>
                  <li>• Keeping PinBridge completely free</li>
                  <li>• No personal data is sold or shared</li>
                </ul>
              </div>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-orange-600 hover:bg-orange-100 ml-2"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}