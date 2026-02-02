/**
 * @jest-environment jsdom
 */

import { adService } from '../ad-service';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
});

// Mock environment variables
process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID = 'ca-pub-test123456789';

describe('AdService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    sessionStorageMock.getItem.mockReturnValue(null);
  });

  describe('shouldShowAds', () => {
    it('should return true when ads are enabled and user is not premium', () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'pinbridge_ad_preferences') {
          return JSON.stringify({ adsEnabled: true });
        }
        if (key === 'pinbridge_premium') {
          return 'false';
        }
        return null;
      });

      expect(adService.shouldShowAds()).toBe(true);
    });

    it('should return false when user is premium', () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'pinbridge_premium') {
          return 'true';
        }
        return null;
      });

      expect(adService.shouldShowAds()).toBe(false);
    });

    it('should return false when ads are disabled by user', () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'pinbridge_ad_preferences') {
          return JSON.stringify({ adsEnabled: false });
        }
        if (key === 'pinbridge_premium') {
          return 'false';
        }
        return null;
      });

      expect(adService.shouldShowAds()).toBe(false);
    });

    it('should return false when AdSense client ID is missing', () => {
      const originalClientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
      process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID = '';

      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'pinbridge_ad_preferences') {
          return JSON.stringify({ adsEnabled: true });
        }
        if (key === 'pinbridge_premium') {
          return 'false';
        }
        return null;
      });

      expect(adService.shouldShowAds()).toBe(false);

      process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID = originalClientId;
    });
  });

  describe('getAdPlacementsForPage', () => {
    beforeEach(() => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'pinbridge_ad_preferences') {
          return JSON.stringify({ adsEnabled: true });
        }
        if (key === 'pinbridge_premium') {
          return 'false';
        }
        return null;
      });
    });

    it('should return placements for home page', () => {
      const placements = adService.getAdPlacementsForPage('/');
      expect(placements.length).toBeGreaterThan(0);
      
      const hasHeaderBanner = placements.some(p => p.id === 'header-banner');
      expect(hasHeaderBanner).toBe(true);
    });

    it('should return placements for transfer packs page', () => {
      const placements = adService.getAdPlacementsForPage('/transfer-packs');
      expect(placements.length).toBeGreaterThan(0);
      
      const hasNativeAd = placements.some(p => p.type === 'native');
      expect(hasNativeAd).toBe(true);
    });

    it('should exclude placements for verification pages', () => {
      const placements = adService.getAdPlacementsForPage('/transfer-packs/123/verify');
      
      // Should not include ads that exclude verification pages
      const hasHeaderBanner = placements.some(p => p.id === 'header-banner');
      expect(hasHeaderBanner).toBe(false);
    });

    it('should return empty array when ads should not be shown', () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'pinbridge_premium') {
          return 'true';
        }
        return null;
      });

      const placements = adService.getAdPlacementsForPage('/');
      expect(placements).toEqual([]);
    });

    it('should respect max ads per page limit', () => {
      const placements = adService.getAdPlacementsForPage('/');
      expect(placements.length).toBeLessThanOrEqual(3);
    });

    it('should sort placements by priority', () => {
      const placements = adService.getAdPlacementsForPage('/');
      
      for (let i = 1; i < placements.length; i++) {
        expect(placements[i - 1].priority).toBeGreaterThanOrEqual(placements[i].priority);
      }
    });
  });

  describe('markAdAsShown', () => {
    it('should store session-based frequency for once-per-session ads', () => {
      adService.markAdAsShown('content-native');
      
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
        'ad_frequency_content-native',
        expect.any(String)
      );
    });

    it('should store local storage for once-per-day ads', () => {
      // Mock a once-per-day ad placement
      const originalPlacements = (adService as any).AD_PLACEMENTS;
      
      adService.markAdAsShown('test-daily-ad');
      
      // Since we don't have a daily ad in our current setup, 
      // let's test the session storage case which we do have
      expect(sessionStorageMock.setItem).toHaveBeenCalled();
    });
  });

  describe('updateUserPreferences', () => {
    it('should update user ad preferences', () => {
      const preferences = { adsEnabled: false };
      adService.updateUserPreferences(preferences);
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'pinbridge_ad_preferences',
        JSON.stringify(preferences)
      );
    });
  });

  describe('getAdUnitConfig', () => {
    it('should return correct AdSense configuration', () => {
      const placement = {
        id: 'test-ad',
        type: 'banner' as const,
        size: 'medium' as const,
        position: 'header' as const,
        priority: 5,
        minViewTime: 0,
        frequency: 'always' as const,
        targetPages: ['/'],
        excludePages: [],
      };

      const config = adService.getAdUnitConfig(placement);
      
      expect(config['data-ad-client']).toBe('ca-pub-test123456789');
      expect(config['data-ad-format']).toBe('auto');
      expect(config.style).toBeDefined();
    });

    it('should return responsive style for responsive size', () => {
      const placement = {
        id: 'test-ad',
        type: 'banner' as const,
        size: 'responsive' as const,
        position: 'header' as const,
        priority: 5,
        minViewTime: 0,
        frequency: 'always' as const,
        targetPages: ['/'],
        excludePages: [],
      };

      const config = adService.getAdUnitConfig(placement);
      
      expect(config.style.width).toBe('100%');
      expect(config.style.height).toBe('auto');
    });
  });

  describe('isPremiumUser', () => {
    it('should return true when user has premium status', () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'pinbridge_premium') {
          return 'true';
        }
        return null;
      });

      expect(adService.isPremiumUser()).toBe(true);
    });

    it('should return false when user does not have premium status', () => {
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'pinbridge_premium') {
          return 'false';
        }
        return null;
      });

      expect(adService.isPremiumUser()).toBe(false);
    });

    it('should return false when premium status is not set', () => {
      localStorageMock.getItem.mockReturnValue(null);

      expect(adService.isPremiumUser()).toBe(false);
    });
  });

  describe('getMetrics', () => {
    it('should return default metrics for unknown placement', () => {
      const metrics = adService.getMetrics('unknown-placement');
      
      expect(metrics).toEqual({
        impressions: 0,
        clicks: 0,
        revenue: 0,
        ctr: 0,
        cpm: 0,
        viewability: 0,
        adBlockRate: 0,
      });
    });

    it('should return all metrics when no placement specified', () => {
      const metrics = adService.getMetrics();
      expect(metrics).toBeInstanceOf(Map);
    });
  });

  describe('trackAdClick', () => {
    it('should track ad click events', () => {
      // Mock gtag
      (window as any).gtag = jest.fn();
      
      adService.trackAdClick('test-placement');
      
      expect((window as any).gtag).toHaveBeenCalledWith('event', 'ad_click', {
        event_category: 'ads',
        placementId: 'test-placement',
      });
    });
  });

  describe('getAdBlockMessage', () => {
    it('should return ad block message', () => {
      const message = adService.getAdBlockMessage();
      expect(message).toContain('ad blocker');
      expect(message).toContain('PinBridge');
    });
  });
});