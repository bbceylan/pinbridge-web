'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AdBanner } from './ad-banner';
import { AdSidebar } from './ad-sidebar';
import { AdInterstitial } from './ad-interstitial';
import { adService } from '@/lib/services/ad-service';
import type { AdPlacement } from '@/lib/services/ad-service';

interface AdManagerProps {
  children: React.ReactNode;
  showInterstitial?: boolean;
  onInterstitialClose?: () => void;
  completedTransfers?: number;
}

export function AdManager({ 
  children, 
  showInterstitial = false, 
  onInterstitialClose,
  completedTransfers = 0 
}: AdManagerProps) {
  const pathname = usePathname();
  const [placements, setPlacements] = useState<AdPlacement[]>([]);
  const [interstitialOpen, setInterstitialOpen] = useState(false);

  useEffect(() => {
    // Get ad placements for current page
    const pagePlacements = adService.getAdPlacementsForPage(pathname);
    setPlacements(pagePlacements);
  }, [pathname]);

  useEffect(() => {
    if (showInterstitial) {
      setInterstitialOpen(true);
    }
  }, [showInterstitial]);

  const handleInterstitialClose = () => {
    setInterstitialOpen(false);
    onInterstitialClose?.();
  };

  const handleInterstitialContinue = () => {
    setInterstitialOpen(false);
    onInterstitialClose?.();
  };

  // Get placements by position
  const headerAds = placements.filter(p => p.position === 'header');
  const sidebarAds = placements.filter(p => p.position === 'sidebar');
  const footerAds = placements.filter(p => p.position === 'footer');
  const interstitialAds = placements.filter(p => p.position === 'modal');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Ads */}
      {headerAds.map(placement => (
        <div key={placement.id} className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 py-2">
            <AdBanner placement={placement} className="text-center" />
          </div>
        </div>
      ))}

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {children}
          </div>

          {/* Sidebar Ads */}
          {sidebarAds.length > 0 && (
            <div className="w-80 flex-shrink-0 hidden lg:block">
              <div className="sticky top-6 space-y-4">
                {sidebarAds.map(placement => (
                  <AdSidebar key={placement.id} placement={placement} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Ads */}
      {footerAds.map(placement => (
        <div key={placement.id} className="bg-white border-t mt-8">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <AdBanner placement={placement} className="text-center" />
          </div>
        </div>
      ))}

      {/* Interstitial Ads */}
      {interstitialAds.map(placement => (
        <AdInterstitial
          key={placement.id}
          placement={placement}
          isOpen={interstitialOpen}
          onClose={handleInterstitialClose}
          onContinue={handleInterstitialContinue}
          completedTransfers={completedTransfers}
        />
      ))}
    </div>
  );
}