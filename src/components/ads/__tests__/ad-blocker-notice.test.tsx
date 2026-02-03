/**
 * @jest-environment jsdom
 */

import React, { act } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdBlockerNotice } from '../ad-blocker-notice';
import { adService } from '@/lib/services/ad-service';

// Mock the ad service
jest.mock('@/lib/services/ad-service', () => ({
  adService: {
    shouldShowAds: jest.fn(),
    isPremiumUser: jest.fn(),
  },
}));

const mockAdService = adService as jest.Mocked<typeof adService>;

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('AdBlockerNotice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAdService.shouldShowAds.mockReturnValue(true);
    mockAdService.isPremiumUser.mockReturnValue(false);
    localStorageMock.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should not render when ads should not be shown', () => {
    mockAdService.shouldShowAds.mockReturnValue(false);
    
    const { container } = render(<AdBlockerNotice />);
    
    expect(container.firstChild).toBeNull();
  });

  it('should not render when user is premium', () => {
    mockAdService.isPremiumUser.mockReturnValue(true);
    
    const { container } = render(<AdBlockerNotice />);
    
    expect(container.firstChild).toBeNull();
  });

  it('should not render when already dismissed', () => {
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'pinbridge_adblocker_dismissed') return 'true';
      return null;
    });
    
    const { container } = render(<AdBlockerNotice />);
    
    expect(container.firstChild).toBeNull();
  });

  it('should render ad blocker notice when detected', async () => {
    jest.useFakeTimers();
    
    render(<AdBlockerNotice />);
    
    // Fast forward to trigger ad blocker detection
    act(() => {
      jest.advanceTimersByTime(200);
    });
    
    await waitFor(() => {
      expect(screen.getByText('Ad Blocker Detected')).toBeInTheDocument();
    });
    
    jest.useRealTimers();
  });

  it('should show support message', async () => {
    jest.useFakeTimers();
    
    render(<AdBlockerNotice />);
    
    act(() => {
      jest.advanceTimersByTime(200);
    });
    
    await waitFor(() => {
      expect(screen.getByText(/PinBridge is free thanks to ads/)).toBeInTheDocument();
      expect(screen.getByText(/Map API costs/)).toBeInTheDocument();
    });
    
    jest.useRealTimers();
  });

  it('should handle dismiss action', async () => {
    jest.useFakeTimers();
    const onDismiss = jest.fn();
    
    render(<AdBlockerNotice onDismiss={onDismiss} />);
    
    act(() => {
      jest.advanceTimersByTime(200);
    });
    
    await waitFor(() => {
      expect(screen.getByText('Ad Blocker Detected')).toBeInTheDocument();
    });
    
    const dismissButton = screen.getByText("I'll support PinBridge");
    fireEvent.click(dismissButton);
    
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'pinbridge_adblocker_dismissed',
      'true'
    );
    expect(onDismiss).toHaveBeenCalled();
    
    jest.useRealTimers();
  });

  it('should handle close button', async () => {
    jest.useFakeTimers();
    
    render(<AdBlockerNotice />);
    
    act(() => {
      jest.advanceTimersByTime(200);
    });
    
    await waitFor(() => {
      expect(screen.getByText('Ad Blocker Detected')).toBeInTheDocument();
    });
    
    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);
    
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'pinbridge_adblocker_dismissed',
      'true'
    );
    
    jest.useRealTimers();
  });

  it('should handle upgrade to premium', async () => {
    jest.useFakeTimers();
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    
    render(<AdBlockerNotice showUpgradeOption={true} />);
    
    act(() => {
      jest.advanceTimersByTime(200);
    });
    
    await waitFor(() => {
      expect(screen.getByText('Ad Blocker Detected')).toBeInTheDocument();
    });
    
    const upgradeButton = screen.getByText('Go Ad-Free with Premium');
    fireEvent.click(upgradeButton);
    
    expect(openSpy).toHaveBeenCalledWith('/premium', '_self');
    
    jest.useRealTimers();
  });

  it('should not show upgrade option when disabled', async () => {
    jest.useFakeTimers();
    
    render(<AdBlockerNotice showUpgradeOption={false} />);
    
    act(() => {
      jest.advanceTimersByTime(200);
    });
    
    await waitFor(() => {
      expect(screen.getByText('Ad Blocker Detected')).toBeInTheDocument();
    });
    
    expect(screen.queryByText('Go Ad-Free with Premium')).not.toBeInTheDocument();
    
    jest.useRealTimers();
  });

  it('should show explanation of why ads are shown', async () => {
    jest.useFakeTimers();
    
    render(<AdBlockerNotice />);
    
    act(() => {
      jest.advanceTimersByTime(200);
    });
    
    await waitFor(() => {
      expect(screen.getByText('Why we show ads:')).toBeInTheDocument();
      expect(screen.getByText(/Map API costs/)).toBeInTheDocument();
      expect(screen.getByText(/Server hosting/)).toBeInTheDocument();
      expect(screen.getByText(/Keeping PinBridge completely free/)).toBeInTheDocument();
      expect(screen.getByText(/No personal data is sold/)).toBeInTheDocument();
    });
    
    jest.useRealTimers();
  });

  it('should not detect ad blocker when ads load normally', async () => {
    jest.useFakeTimers();
    
    // Mock normal ad loading (offsetHeight > 0)
    const originalCreateElement = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = originalCreateElement(tagName);
      if (tagName.toLowerCase() === 'div') {
        Object.defineProperty(el, 'offsetHeight', {
          value: 100,
          configurable: true,
        });
      }
      return el;
    });
    
    render(<AdBlockerNotice />);
    
    act(() => {
      jest.advanceTimersByTime(200);
    });
    
    await waitFor(() => {
      expect(screen.queryByText('Ad Blocker Detected')).not.toBeInTheDocument();
    });
    
    jest.useRealTimers();
  });
});
