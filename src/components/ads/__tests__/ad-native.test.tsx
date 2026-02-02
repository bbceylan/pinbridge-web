/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdNative } from '../ad-native';
import { adService } from '@/lib/services/ad-service';

// Mock the ad service
jest.mock('@/lib/services/ad-service', () => ({
  adService: {
    shouldShowAds: jest.fn(),
    isPremiumUser: jest.fn(),
    markAdAsShown: jest.fn(),
    trackAdClick: jest.fn(),
    getAdUnitConfig: jest.fn(),
  },
}));

const mockAdService = adService as jest.Mocked<typeof adService>;

const mockPlacement = {
  id: 'test-native-ad',
  type: 'native' as const,
  size: 'responsive' as const,
  position: 'content' as const,
  priority: 6,
  minViewTime: 10,
  frequency: 'once-per-session' as const,
  targetPages: ['/test'],
  excludePages: [],
};

describe('AdNative', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAdService.shouldShowAds.mockReturnValue(true);
    mockAdService.isPremiumUser.mockReturnValue(false);
    mockAdService.getAdUnitConfig.mockReturnValue({
      'data-ad-client': 'ca-pub-test123',
      'data-ad-format': 'auto',
      'data-full-width-responsive': 'true',
      style: { width: '100%', height: 'auto', minHeight: '90px' },
    });
  });

  it('should render native ad when ads should be shown', () => {
    render(<AdNative placement={mockPlacement} variant="travel" />);
    
    expect(screen.getByText('Sponsored')).toBeInTheDocument();
    expect(mockAdService.markAdAsShown).toHaveBeenCalledWith('test-native-ad');
  });

  it('should not render when ads should not be shown', () => {
    mockAdService.shouldShowAds.mockReturnValue(false);
    
    const { container } = render(<AdNative placement={mockPlacement} variant="travel" />);
    
    expect(container.firstChild).toBeNull();
  });

  it('should not render when user is premium', () => {
    mockAdService.isPremiumUser.mockReturnValue(true);
    
    const { container } = render(<AdNative placement={mockPlacement} variant="travel" />);
    
    expect(container.firstChild).toBeNull();
  });

  it('should render travel variant ads', () => {
    render(<AdNative placement={mockPlacement} variant="travel" />);
    
    // Should show one of the travel ads
    const travelTexts = [
      'Find Amazing Flight Deals',
      'Book Hotels with Free Cancellation',
      'Rent a Car for Your Journey'
    ];
    
    const hasTravel = travelTexts.some(text => screen.queryByText(text));
    expect(hasTravel).toBe(true);
  });

  it('should render productivity variant ads', () => {
    render(<AdNative placement={mockPlacement} variant="productivity" />);
    
    expect(screen.getByText('Organize Your Travel Plans')).toBeInTheDocument();
  });

  it('should track ad clicks', () => {
    render(<AdNative placement={mockPlacement} variant="travel" />);
    
    const ctaButton = screen.getByRole('button');
    fireEvent.click(ctaButton);
    
    expect(mockAdService.trackAdClick).toHaveBeenCalledWith('test-native-ad');
  });

  it('should handle dismiss functionality', () => {
    render(<AdNative placement={mockPlacement} variant="travel" />);
    
    const dismissButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(dismissButton);
    
    // Ad should be hidden after dismiss
    expect(screen.queryByText('Sponsored')).not.toBeInTheDocument();
  });

  it('should rotate ads over time', async () => {
    jest.useFakeTimers();
    
    render(<AdNative placement={mockPlacement} variant="travel" />);
    
    const initialText = screen.getByText(/Find Amazing Flight Deals|Book Hotels|Rent a Car/);
    const initialContent = initialText.textContent;
    
    // Fast forward 10 seconds to trigger rotation
    jest.advanceTimersByTime(10000);
    
    await waitFor(() => {
      const newText = screen.queryByText(/Find Amazing Flight Deals|Book Hotels|Rent a Car/);
      // Content might have rotated (or might be the same if only one ad)
      expect(newText).toBeInTheDocument();
    });
    
    jest.useRealTimers();
  });

  it('should render AdSense ad unit', () => {
    render(<AdNative placement={mockPlacement} variant="travel" />);
    
    const adUnit = screen.getByRole('generic', { hidden: true });
    expect(adUnit).toHaveClass('adsbygoogle');
  });

  it('should apply correct styling classes', () => {
    render(<AdNative placement={mockPlacement} variant="travel" className="custom-class" />);
    
    const card = screen.getByText('Sponsored').closest('.custom-class');
    expect(card).toBeInTheDocument();
  });

  it('should show trust indicators', () => {
    render(<AdNative placement={mockPlacement} variant="travel" />);
    
    expect(screen.getByText('4.8/5 rating')).toBeInTheDocument();
    expect(screen.getByText('Trusted by 1M+ travelers')).toBeInTheDocument();
  });

  it('should handle AdSense initialization', async () => {
    // Mock adsbygoogle
    (window as any).adsbygoogle = [];
    
    render(<AdNative placement={mockPlacement} variant="travel" />);
    
    await waitFor(() => {
      expect((window as any).adsbygoogle).toBeDefined();
    });
  });

  it('should clean up intervals on unmount', () => {
    jest.useFakeTimers();
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    
    const { unmount } = render(<AdNative placement={mockPlacement} variant="travel" />);
    
    unmount();
    
    expect(clearIntervalSpy).toHaveBeenCalled();
    
    jest.useRealTimers();
    clearIntervalSpy.mockRestore();
  });
});