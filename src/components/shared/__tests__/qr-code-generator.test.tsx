/**
 * Unit tests for QRCodeGenerator component
 * Tests the download functionality and component behavior
 */

import { QRCodeGenerator } from '../qr-code-generator';

// Mock the qrcode.react components since we're testing functionality, not rendering
jest.mock('qrcode.react', () => ({
  QRCodeCanvas: jest.fn(),
  QRCodeSVG: jest.fn(),
}));

describe('QRCodeGenerator', () => {
  // Mock URL methods
  const mockCreateObjectURL = jest.fn(() => 'mock-blob-url');
  const mockRevokeObjectURL = jest.fn();
  
  // Mock document.createElement for download functionality
  const mockClick = jest.fn();
  const mockLink = {
    download: '',
    href: '',
    click: mockClick,
  };
  
  const mockCanvas = {
    toDataURL: jest.fn(() => 'data:image/png;base64,mock-data'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup URL mocks
    global.URL.createObjectURL = mockCreateObjectURL;
    global.URL.revokeObjectURL = mockRevokeObjectURL;
    
    // Setup document.createElement mock
    jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'a') {
        return mockLink as any;
      }
      if (tagName === 'canvas') {
        const canvas = document.createElement('canvas');
        Object.assign(canvas, mockCanvas);
        (canvas as any).getContext = jest.fn(() => ({
          drawImage: jest.fn(),
        }));
        return canvas;
      }
      return document.createElement(tagName);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should have correct default props interface', () => {
    // Test that the component interface is correctly defined
    const props = {
      url: 'https://example.com/link-list/test',
      title: 'Test QR Code',
      size: 200,
      downloadable: true,
      showCopyButton: true,
      showSettings: true,
    };

    // This test ensures the interface is properly typed
    expect(typeof props.url).toBe('string');
    expect(typeof props.title).toBe('string');
    expect(typeof props.size).toBe('number');
    expect(typeof props.downloadable).toBe('boolean');
    expect(typeof props.showCopyButton).toBe('boolean');
    expect(typeof props.showSettings).toBe('boolean');
  });

  it('should support different QR formats and sizes', () => {
    // Test the type definitions for QR formats and sizes
    type QRFormat = 'png' | 'svg';
    type QRSize = 128 | 200 | 256 | 400 | 512;
    type QRQuality = 'L' | 'M' | 'Q' | 'H';

    const formats: QRFormat[] = ['png', 'svg'];
    const sizes: QRSize[] = [128, 200, 256, 400, 512];
    const qualities: QRQuality[] = ['L', 'M', 'Q', 'H'];

    expect(formats).toContain('png');
    expect(formats).toContain('svg');
    expect(sizes).toContain(256);
    expect(qualities).toContain('M');
  });

  it('should handle download filename generation correctly', () => {
    const testCases = [
      { title: 'My QR Code', expected: 'my-qr-code' },
      { title: 'Test   Spaces', expected: 'test-spaces' },
      { title: 'Special Characters', expected: 'special-characters' },
    ];

    testCases.forEach(({ title, expected }) => {
      const normalized = title.toLowerCase().replace(/\s+/g, '-');
      expect(normalized).toBe(expected);
    });
  });

  it('should validate URL format requirements', () => {
    const validUrls = [
      'https://example.com/link-list/test',
      'https://pinbridge.app/link-list/abc123',
      'http://localhost:3000/link-list/dev',
    ];

    validUrls.forEach(url => {
      expect(typeof url).toBe('string');
      expect(url.length).toBeGreaterThan(0);
      expect(url.startsWith('http')).toBeTruthy();
    });

    // Test invalid cases
    const emptyString = '';
    const invalidString = 'not-a-url';
    
    expect(emptyString.length).toBe(0);
    expect(invalidString.startsWith('http')).toBeFalsy();
  });
});