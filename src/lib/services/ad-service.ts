/**
 * Ad Service for PinBridge Web Monetization
 * 
 * Manages ad display, tracking, and revenue optimization
 * with strategic placement and user experience considerations.
 */

import { authService } from './auth-service';

export interface AdConfig {
  enabled: boolean;
  adSenseClientId: string;
  adBlockDetection: boolean;
  respectUserPreferences: boolean;
  maxAdsPerPage: number;
  adRefreshInterval: number; // in seconds
}

export interface AdPlacement {
  id: string;
  type: 'banner' | 'sidebar' | 'interstitial' | 'native' | 'video';
  size: 'small' | 'medium' | 'large' | 'responsive';
  position: 'header' | 'footer' | 'sidebar' | 'content' | 'modal';
  priority: number; // 1-10, higher = more important
  minViewTime: number; // minimum time on page before showing ad
  frequency: 'always' | 'once-per-session' | 'once-per-day';
  targetPages: string[]; // page patterns where ad should show
  excludePages: string[]; // pages where ad should not show
}

export interface AdMetrics {
  impressions: number;
  clicks: number;
  revenue: number;
  ctr: number; // click-through rate
  cpm: number; // cost per mille
  viewability: number;
  adBlockRate: number;
}

const DEFAULT_CONFIG: AdConfig = {
  enabled: true,
  adSenseClientId: process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID || '',
  adBlockDetection: true,
  respectUserPreferences: true,
  maxAdsPerPage: 3,
  adRefreshInterval: 30,
};

// Strategic ad placements for PinBridge
const AD_PLACEMENTS: AdPlacement[] = [
  {
    id: 'header-banner',
    type: 'banner',
    size: 'responsive',
    position: 'header',
    priority: 8,
    minViewTime: 2,
    frequency: 'always',
    targetPages: ['/', '/transfer-packs', '/places'],
    excludePages: ['/transfer-packs/*/verify'], // Don't interrupt verification flow
  },
  {
    id: 'sidebar-travel',
    type: 'sidebar',
    size: 'medium',
    position: 'sidebar',
    priority: 7,
    minViewTime: 5,
    frequency: 'always',
    targetPages: ['/transfer-packs', '/places', '/collections'],
    excludePages: [],
  },
  {
    id: 'content-native',
    type: 'native',
    size: 'responsive',
    position: 'content',
    priority: 6,
    minViewTime: 10,
    frequency: 'once-per-session',
    targetPages: ['/transfer-packs', '/places'],
    excludePages: ['/transfer-packs/*/verify'],
  },
  {
    id: 'completion-interstitial',
    type: 'interstitial',
    size: 'large',
    position: 'modal',
    priority: 9,
    minViewTime: 0,
    frequency: 'once-per-session',
    targetPages: ['/transfer-packs/*/run'],
    excludePages: [],
  },
  {
    id: 'footer-banner',
    type: 'banner',
    size: 'responsive',
    position: 'footer',
    priority: 5,
    minViewTime: 15,
    frequency: 'always',
    targetPages: ['*'], // All pages
    excludePages: ['/transfer-packs/*/verify'],
  },
];

class AdService {
  private config: AdConfig;
  private metrics: Map<string, AdMetrics> = new Map();
  private adBlockDetected = false;
  private userPreferences: { adsEnabled: boolean } = { adsEnabled: true };
  private pageViewTime = 0;
  private viewTimeInterval?: NodeJS.Timeout;

  constructor(config: Partial<AdConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loadUserPreferences();
    this.initializeAdTracking();
  }

  /**
   * Initialize ad tracking and detection
   */
  private initializeAdTracking(): void {
    if (typeof window === 'undefined') return;

    // Start page view timer
    this.startViewTimeTracking();

    // Detect ad blockers
    if (this.config.adBlockDetection) {
      this.detectAdBlocker();
    }

    // Load Google AdSense
    if (this.config.enabled && this.config.adSenseClientId) {
      this.loadGoogleAdSense();
    }
  }

  /**
   * Load Google AdSense script
   */
  private loadGoogleAdSense(): void {
    if (typeof window === 'undefined') return;

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${this.config.adSenseClientId}`;
    script.crossOrigin = 'anonymous';
    
    script.onerror = () => {
      console.warn('AdSense failed to load - ad blocker detected');
      this.adBlockDetected = true;
    };

    document.head.appendChild(script);
  }

  /**
   * Detect ad blocker presence
   */
  private detectAdBlocker(): void {
    if (typeof window === 'undefined') return;

    // Create a test ad element
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
        this.adBlockDetected = true;
        this.trackEvent('adblock_detected');
      }
      document.body.removeChild(testAd);
    }, 100);
  }

  /**
   * Start tracking page view time
   */
  private startViewTimeTracking(): void {
    this.pageViewTime = 0;
    this.viewTimeInterval = setInterval(() => {
      this.pageViewTime++;
    }, 1000);

    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
      if (this.viewTimeInterval) {
        clearInterval(this.viewTimeInterval);
      }
    });
  }

  /**
   * Check if ads should be shown
   */
  shouldShowAds(): boolean {
    return (
      this.config.enabled &&
      this.userPreferences.adsEnabled &&
      !this.isPremiumUser() &&
      !this.isLoggedInUser() &&
      !this.adBlockDetected &&
      this.config.adSenseClientId !== ''
    );
  }

  /**
   * Get ad placements for current page
   */
  getAdPlacementsForPage(pathname: string): AdPlacement[] {
    if (!this.shouldShowAds()) return [];

    return AD_PLACEMENTS
      .filter(placement => this.shouldShowPlacement(placement, pathname))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, this.config.maxAdsPerPage);
  }

  /**
   * Check if specific ad placement should be shown
   */
  private shouldShowPlacement(placement: AdPlacement, pathname: string): boolean {
    // Check minimum view time
    if (this.pageViewTime < placement.minViewTime) {
      return false;
    }

    // Check target pages
    const matchesTarget = placement.targetPages.some(pattern => {
      if (pattern === '*') return true;
      return pathname.match(new RegExp(pattern.replace('*', '.*')));
    });

    if (!matchesTarget) return false;

    // Check exclude pages
    const matchesExclude = placement.excludePages.some(pattern => {
      return pathname.match(new RegExp(pattern.replace('*', '.*')));
    });

    if (matchesExclude) return false;

    // Check frequency restrictions
    return this.checkFrequencyRestriction(placement);
  }

  /**
   * Check frequency restrictions for ad placement
   */
  private checkFrequencyRestriction(placement: AdPlacement): boolean {
    const storageKey = `ad_frequency_${placement.id}`;
    
    switch (placement.frequency) {
      case 'always':
        return true;
      
      case 'once-per-session':
        return !sessionStorage.getItem(storageKey);
      
      case 'once-per-day':
        const lastShown = localStorage.getItem(storageKey);
        if (!lastShown) return true;
        
        const lastShownDate = new Date(lastShown);
        const now = new Date();
        return now.getDate() !== lastShownDate.getDate();
      
      default:
        return true;
    }
  }

  /**
   * Mark ad placement as shown
   */
  markAdAsShown(placementId: string): void {
    const placement = AD_PLACEMENTS.find(p => p.id === placementId);
    if (!placement) return;

    const storageKey = `ad_frequency_${placementId}`;
    const now = new Date().toISOString();

    switch (placement.frequency) {
      case 'once-per-session':
        sessionStorage.setItem(storageKey, now);
        break;
      
      case 'once-per-day':
        localStorage.setItem(storageKey, now);
        break;
    }

    this.trackEvent('ad_impression', { placementId });
  }

  /**
   * Track ad click
   */
  trackAdClick(placementId: string): void {
    this.trackEvent('ad_click', { placementId });
  }

  /**
   * Get ad unit configuration for AdSense
   */
  getAdUnitConfig(placement: AdPlacement): {
    'data-ad-client': string;
    'data-ad-slot'?: string;
    'data-ad-format': string;
    'data-full-width-responsive'?: string;
    style: React.CSSProperties;
  } {
    const baseConfig = {
      'data-ad-client': this.config.adSenseClientId,
      'data-ad-format': 'auto',
      'data-full-width-responsive': 'true',
    };

    const sizeStyles: Record<string, React.CSSProperties> = {
      small: { width: '320px', height: '100px' },
      medium: { width: '728px', height: '90px' },
      large: { width: '970px', height: '250px' },
      responsive: { width: '100%', height: 'auto', minHeight: '90px' },
    };

    return {
      ...baseConfig,
      style: sizeStyles[placement.size] || sizeStyles.responsive,
    };
  }

  /**
   * Load user preferences
   */
  private loadUserPreferences(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem('pinbridge_ad_preferences');
      if (stored) {
        this.userPreferences = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load ad preferences:', error);
    }
  }

  /**
   * Update user ad preferences
   */
  updateUserPreferences(preferences: { adsEnabled: boolean }): void {
    this.userPreferences = preferences;
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('pinbridge_ad_preferences', JSON.stringify(preferences));
    }
  }

  /**
   * Track ad events for analytics
   */
  private trackEvent(event: string, data?: Record<string, any>): void {
    // Integration with analytics service
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', event, {
        event_category: 'ads',
        ...data,
      });
    }

    // Store metrics locally
    const placementId = data?.placementId;
    if (placementId) {
      const metrics = this.metrics.get(placementId) || {
        impressions: 0,
        clicks: 0,
        revenue: 0,
        ctr: 0,
        cpm: 0,
        viewability: 0,
        adBlockRate: 0,
      };

      if (event === 'ad_impression') {
        metrics.impressions++;
      } else if (event === 'ad_click') {
        metrics.clicks++;
      }

      metrics.ctr = metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0;
      this.metrics.set(placementId, metrics);
    }
  }

  /**
   * Get ad performance metrics
   */
  getMetrics(placementId?: string): AdMetrics | Map<string, AdMetrics> {
    if (placementId) {
      return this.metrics.get(placementId) || {
        impressions: 0,
        clicks: 0,
        revenue: 0,
        ctr: 0,
        cpm: 0,
        viewability: 0,
        adBlockRate: 0,
      };
    }
    return this.metrics;
  }

  /**
   * Show ad block message to users
   */
  getAdBlockMessage(): string {
    return "We notice you're using an ad blocker. PinBridge is free thanks to ads. Please consider disabling your ad blocker to support us!";
  }

  /**
   * Check if user is premium (no ads)
   */
  isPremiumUser(): boolean {
    // This integrates with the payment service
    if (typeof window === 'undefined') return false;
    
    try {
      // Import payment service dynamically to avoid circular dependencies
      const premiumStatus = localStorage.getItem('pinbridge_premium');
      return premiumStatus === 'true';
    } catch (error) {
      return false;
    }
  }

  private isLoggedInUser(): boolean {
    return authService.isLoggedIn();
  }
}

export const adService = new AdService();
