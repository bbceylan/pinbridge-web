'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CheckCircle, X, Star, Gift, Crown } from 'lucide-react';
import { adService } from '@/lib/services/ad-service';
import type { AdPlacement } from '@/lib/services/ad-service';

interface AdInterstitialProps {
  placement: AdPlacement;
  isOpen: boolean;
  onClose: () => void;
  onContinue: () => void;
  completedTransfers?: number;
}

export function AdInterstitial({ 
  placement, 
  isOpen, 
  onClose, 
  onContinue,
  completedTransfers = 0
}: AdInterstitialProps) {
  const [countdown, setCountdown] = useState(5);
  const [canSkip, setCanSkip] = useState(false);
  const [showPremiumOffer, setShowPremiumOffer] = useState(false);

  useEffect(() => {
    if (!isOpen || !adService.shouldShowAds() || adService.isPremiumUser()) {
      return;
    }

    // Mark ad as shown
    adService.markAdAsShown(placement.id);

    // Start countdown
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setCanSkip(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Show premium offer for frequent users
    if (completedTransfers >= 5) {
      setTimeout(() => setShowPremiumOffer(true), 2000);
    }

    return () => clearInterval(timer);
  }, [isOpen, placement.id, completedTransfers]);

  const handleAdClick = () => {
    adService.trackAdClick(placement.id);
  };

  const handleContinue = () => {
    onContinue();
    onClose();
  };

  const handleUpgradeToPremium = () => {
    // Track premium conversion attempt
    adService.trackAdClick(`${placement.id}_premium_upgrade`);
    // Redirect to premium signup
    window.open('/premium', '_blank');
  };

  if (!isOpen || !adService.shouldShowAds() || adService.isPremiumUser()) {
    return null;
  }

  const adConfig = adService.getAdUnitConfig(placement);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span>Transfer Complete!</span>
            </DialogTitle>
            <Badge variant="outline" className="text-xs">
              {completedTransfers} transfers completed
            </Badge>
          </div>
          <DialogDescription>
            Great job! Your places have been successfully transferred. 
            {completedTransfers >= 5 && " You're becoming a power user!"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Celebration message */}
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-4">
              <div className="flex items-center space-x-3">
                <div className="flex space-x-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 text-yellow-500 fill-current" />
                  ))}
                </div>
                <span className="text-sm font-medium text-green-800">
                  Transfer completed successfully!
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Premium offer for frequent users */}
          {showPremiumOffer && (
            <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center space-x-2">
                  <Crown className="h-5 w-5 text-purple-600" />
                  <span className="text-purple-900">Upgrade to Premium</span>
                  <Badge className="bg-purple-600">50% OFF</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>No ads</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>Unlimited transfers</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>Priority support</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>Advanced features</span>
                  </div>
                </div>
                <Button 
                  className="w-full bg-purple-600 hover:bg-purple-700"
                  onClick={handleUpgradeToPremium}
                >
                  <Gift className="h-4 w-4 mr-2" />
                  Upgrade Now - $4.99/month
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Ad content */}
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs text-gray-500 mb-3 text-center">Advertisement</div>
              
              <div onClick={handleAdClick}>
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

              {/* Fallback content */}
              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-center">
                  <h3 className="font-medium text-blue-900 mb-2">
                    🎉 Discover Amazing Travel Deals!
                  </h3>
                  <p className="text-sm text-blue-700 mb-3">
                    Since you love organizing your places, you might enjoy these travel offers
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white p-2 rounded border">
                      <div className="font-medium">✈️ Flights</div>
                      <div className="text-gray-600">Up to 60% off</div>
                    </div>
                    <div className="bg-white p-2 rounded border">
                      <div className="font-medium">🏨 Hotels</div>
                      <div className="text-gray-600">Free cancellation</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="flex justify-between">
          <div className="text-sm text-gray-500">
            {!canSkip ? (
              <span>Continue in {countdown} seconds...</span>
            ) : (
              <span>You can now continue</span>
            )}
          </div>
          
          <div className="flex space-x-2">
            <Button variant="outline" onClick={onClose}>
              <X className="h-4 w-4 mr-2" />
              Close
            </Button>
            <Button 
              onClick={handleContinue}
              disabled={!canSkip}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Continue
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}