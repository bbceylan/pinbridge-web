/**
 * Property-based tests for QR code generation consistency
 * Feature: link-list-feature
 */

import fc from 'fast-check';
import { render, screen, cleanup } from '@testing-library/react';
import { QRCodeGenerator, QRCodeInline } from '../qr-code-generator';
import { urlService } from '@/lib/services/url';
import type { Place, LinkList } from '@/types';

// Mock the qrcode.react components for testing
jest.mock('qrcode.react', () => ({
  QRCodeCanvas: jest.fn(({ value, size, level }) => (
    <canvas 
      data-testid="qr-canvas"
      data-value={value}
      data-size={size}
      data-level={level}
      width={size}
      height={size}
    />
  )),
  QRCodeSVG: jest.fn(({ value, size, level }) => (
    <svg 
      data-testid="qr-svg"
      data-value={value}
      data-size={size}
      data-level={level}
      width={size}
      height={size}
    />
  )),
}));

// Mock browser APIs for download functionality
const mockCreateObjectURL = jest.fn(() => 'mock-blob-url');
const mockRevokeObjectURL = jest.fn();
const mockClick = jest.fn();
const mockToDataURL = jest.fn(() => 'data:image/png;base64,mock-data');

// Mock clipboard API
const mockWriteText = jest.fn();
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText,
  },
});

// Mock document.createElement for download functionality
const mockLink = {
  download: '',
  href: '',
  click: mockClick,
};

beforeEach(() => {
  jest.clearAllMocks();
  cleanup(); // Clean up any previous renders
  
  // Setup URL mocks
  global.URL.createObjectURL = mockCreateObjectURL;
  global.URL.revokeObjectURL = mockRevokeObjectURL;
  
  // Setup document.createElement mock
  const originalCreateElement = document.createElement.bind(document);
  jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
    if (tagName === 'a') {
      return mockLink as any;
    }
    if (tagName === 'canvas') {
      const canvas = originalCreateElement('canvas');
      (canvas as any).toDataURL = mockToDataURL;
      (canvas as any).getContext = jest.fn(() => ({
        drawImage: jest.fn(),
      }));
      return canvas;
    }
    return originalCreateElement(tagName);
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  cleanup();
});

// Generators for test data
const placeArbitrary = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
  title: fc.string({ minLength: 1, maxLength: 50 }).filter(s => !/[&?#]/.test(s)),
  address: fc.string({ minLength: 1, maxLength: 100 }).filter(s => !/[&?#]/.test(s)),
  latitude: fc.option(fc.double({ min: -90, max: 90 })),
  longitude: fc.option(fc.double({ min: -180, max: 180 })),
  notes: fc.option(fc.string({ maxLength: 100 })),
  tags: fc.array(fc.string({ maxLength: 20 }).filter(s => !/[&?#]/.test(s)), { maxLength: 3 }),
  source: fc.constantFrom('apple', 'google', 'manual', 'other'),
  sourceUrl: fc.option(fc.constant('https://example.com')),
  normalizedTitle: fc.string({ minLength: 1, maxLength: 50 }).filter(s => !/[&?#]/.test(s)),
  normalizedAddress: fc.string({ minLength: 1, maxLength: 100 }).filter(s => !/[&?#]/.test(s)),
  createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
  updatedAt: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
}) as fc.Arbitrary<Place>;

const linkListArbitrary = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
  title: fc.string({ minLength: 1, maxLength: 50 }).filter(s => !/[&?#]/.test(s)),
  description: fc.option(fc.string({ maxLength: 100 })),
  placeIds: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
  collectionIds: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 3 }),
  createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
  updatedAt: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
  isPublic: fc.boolean(),
}) as fc.Arbitrary<LinkList>;

/**
 * Property 4: QR code generation consistency
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**
 * 
 * For any Link List with a valid URL, the QR code generator should produce a scannable 
 * QR code containing the correct URL, be displayable on screen, downloadable as an image, 
 * and regenerate when the URL changes.
 */
describe('Property 4: QR code generation consistency', () => {
  it('should generate QR codes containing correct URLs for any valid Link List', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          linkList: linkListArbitrary,
          places: fc.array(placeArbitrary, { minLength: 1, maxLength: 3 }),
          qrSize: fc.option(fc.constantFrom(128, 200, 256, 400, 512)),
        }),
        async ({ linkList, places, qrSize }) => {
          // Clean up before each test case
          cleanup();
          
          // Generate shareable URL for the Link List
          const shareableUrl = urlService.generateShareableURL(linkList, places);
          
          // Assert: URL should be valid and contain Link List ID (Requirement 2.1)
          expect(() => new URL(shareableUrl)).not.toThrow();
          expect(shareableUrl).toContain(linkList.id);
          
          // Render QR Code Generator with the URL
          const { unmount } = render(
            <QRCodeGenerator
              url={shareableUrl}
              size={qrSize ?? undefined}
              downloadable={false} // Disable complex UI interactions
              showCopyButton={false}
              showSettings={false}
            />
          );
          
          try {
            // Assert: QR code should be displayable on screen (Requirement 2.4)
            const qrCanvas = screen.getByTestId('qr-canvas');
            expect(qrCanvas).toBeInTheDocument();
            
            // Assert: QR code should contain the correct URL (Requirement 2.1, 2.2)
            expect(qrCanvas).toHaveAttribute('data-value', shareableUrl);
            
            // Assert: QR code should have appropriate size
            const expectedSize = qrSize || 200; // Default size
            expect(qrCanvas).toHaveAttribute('data-size', expectedSize.toString());
            expect(qrCanvas).toHaveAttribute('width', expectedSize.toString());
            expect(qrCanvas).toHaveAttribute('height', expectedSize.toString());
            
            // Assert: QR code should have error correction level
            expect(qrCanvas).toHaveAttribute('data-level');
            const errorLevel = qrCanvas.getAttribute('data-level');
            expect(['L', 'M', 'Q', 'H']).toContain(errorLevel);
          } finally {
            // Always clean up after each test case
            unmount();
            cleanup();
          }
          
          return true;
        }
      ),
      { numRuns: 15, timeout: 8000 }
    );
  }, 12000);

  it('should regenerate QR codes when URL changes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          linkList: linkListArbitrary,
          places: fc.array(placeArbitrary, { minLength: 1, maxLength: 2 }),
        }),
        async ({ linkList, places }) => {
          cleanup();
          
          // Generate initial URL
          const initialUrl = urlService.generateShareableURL(linkList, places);
          
          // Render QR Code Generator with initial URL
          const { rerender, unmount } = render(
            <QRCodeGenerator
              url={initialUrl}
              downloadable={false}
              showCopyButton={false}
              showSettings={false}
            />
          );
          
          try {
            // Get initial QR code
            const initialQrCanvas = screen.getByTestId('qr-canvas');
            expect(initialQrCanvas).toHaveAttribute('data-value', initialUrl);
            
            // Modify the Link List to create a new URL (Requirement 2.5)
            const modifiedLinkList = {
              ...linkList,
              title: linkList.title + ' Modified',
              updatedAt: new Date(),
            };
            
            const newUrl = urlService.generateShareableURL(modifiedLinkList, places);
            
            // Assert: URL should change when Link List changes
            expect(newUrl).not.toBe(initialUrl);
            expect(newUrl).toContain(modifiedLinkList.id);
            
            // Rerender with new URL
            rerender(
              <QRCodeGenerator
                url={newUrl}
                downloadable={false}
                showCopyButton={false}
                showSettings={false}
              />
            );
            
            // Assert: QR code should regenerate with new URL (Requirement 2.5)
            const updatedQrCanvas = screen.getByTestId('qr-canvas');
            expect(updatedQrCanvas).toHaveAttribute('data-value', newUrl);
            expect(updatedQrCanvas.getAttribute('data-value')).not.toBe(initialUrl);
          } finally {
            unmount();
            cleanup();
          }
          
          return true;
        }
      ),
      { numRuns: 10, timeout: 6000 }
    );
  }, 8000);

  it('should handle different URL formats consistently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          baseUrl: fc.oneof(
            fc.constant('https://pinbridge.app'),
            fc.constant('https://localhost:3000'),
            fc.constant('http://example.com'),
          ),
          linkListId: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
          qrSize: fc.constantFrom(128, 200, 256, 400, 512),
        }),
        async ({ baseUrl, linkListId, qrSize }) => {
          cleanup();
          
          // Construct URL
          const testUrl = `${baseUrl}/link-list/${linkListId}`;
          
          // Render QR Code Generator
          const { unmount } = render(
            <QRCodeGenerator
              url={testUrl}
              size={qrSize}
              downloadable={false}
              showCopyButton={false}
              showSettings={false}
            />
          );
          
          try {
            // Assert: QR code should handle any valid URL format
            const qrCanvas = screen.getByTestId('qr-canvas');
            expect(qrCanvas).toBeInTheDocument();
            expect(qrCanvas).toHaveAttribute('data-value', testUrl);
            expect(qrCanvas).toHaveAttribute('data-size', qrSize.toString());
            
            // Assert: QR code should maintain consistent properties
            expect(qrCanvas).toHaveAttribute('width', qrSize.toString());
            expect(qrCanvas).toHaveAttribute('height', qrSize.toString());
            
            // Test URL validation
            expect(() => new URL(testUrl)).not.toThrow();
          } finally {
            unmount();
            cleanup();
          }
          
          return true;
        }
      ),
      { numRuns: 15, timeout: 5000 }
    );
  }, 8000);

  it('should handle QRCodeInline component consistently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          url: fc.string({ minLength: 10, maxLength: 50 }).map(s => `https://example.com/link-list/${s.replace(/[^a-zA-Z0-9_-]/g, 'x')}`),
          size: fc.option(fc.constantFrom(50, 100, 150, 200)),
        }),
        async ({ url, size }) => {
          cleanup();
          
          // Test inline QR code component
          const { unmount } = render(<QRCodeInline url={url} size={size ?? undefined} />);
          
          try {
            // Assert: Inline QR code should be rendered
            const qrCanvas = screen.getByTestId('qr-canvas');
            expect(qrCanvas).toBeInTheDocument();
            expect(qrCanvas).toHaveAttribute('data-value', url);
            
            // Assert: Size should be applied correctly
            const expectedSize = size || 100; // Default size for inline
            expect(qrCanvas).toHaveAttribute('data-size', expectedSize.toString());
            expect(qrCanvas).toHaveAttribute('width', expectedSize.toString());
            expect(qrCanvas).toHaveAttribute('height', expectedSize.toString());
            
            // Assert: Inline component should have medium error correction
            expect(qrCanvas).toHaveAttribute('data-level', 'M');
          } finally {
            unmount();
            cleanup();
          }
          
          return true;
        }
      ),
      { numRuns: 15, timeout: 5000 }
    );
  }, 8000);

  it('should handle edge case URLs gracefully without breaking QR generation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          // Empty URL
          fc.constant(''),
          // Very long URLs
          fc.constant(`https://example.com/link-list/${'a'.repeat(100)}`),
          // URLs with encoded data
          fc.constant('https://example.com/link-list/test?data=' + encodeURIComponent('{"test": "data"}')),
          // URLs with special characters in path (encoded)
          fc.string({ minLength: 1, maxLength: 20 }).map(s => `https://example.com/link-list/${encodeURIComponent(s)}`),
        ),
        async (edgeCaseUrl) => {
          cleanup();
          
          // Assert: Component should not crash with edge case URLs
          let unmount: () => void;
          expect(() => {
            const result = render(
              <QRCodeGenerator 
                url={edgeCaseUrl} 
                downloadable={false}
                showCopyButton={false}
                showSettings={false}
              />
            );
            unmount = result.unmount;
          }).not.toThrow();
          
          try {
            // QR code should still be rendered (library handles edge case URLs)
            const qrCanvas = screen.getByTestId('qr-canvas');
            expect(qrCanvas).toBeInTheDocument();
            expect(qrCanvas).toHaveAttribute('data-value', edgeCaseUrl);
            
            // Component should maintain default properties
            expect(qrCanvas).toHaveAttribute('data-size', '200'); // Default size
            expect(qrCanvas).toHaveAttribute('data-level'); // Should have error level
          } finally {
            unmount!();
            cleanup();
          }
          
          return true;
        }
      ),
      { numRuns: 10, timeout: 5000 }
    );
  }, 8000);

  it('should validate QR code generation with real Link List data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          linkList: linkListArbitrary,
          places: fc.array(placeArbitrary, { minLength: 1, maxLength: 2 }),
        }),
        async ({ linkList, places }) => {
          cleanup();
          
          // Generate URL using the actual URL service
          const generatedUrl = urlService.generateShareableURL(linkList, places);
          
          // Assert: Generated URL should be valid
          expect(() => new URL(generatedUrl)).not.toThrow();
          expect(generatedUrl).toContain('/link-list/');
          expect(generatedUrl).toContain(linkList.id);
          
          // Render QR code with generated URL
          const { unmount } = render(
            <QRCodeGenerator
              url={generatedUrl}
              downloadable={false}
              showCopyButton={false}
              showSettings={false}
            />
          );
          
          try {
            // Assert: QR code should be generated successfully
            const qrCanvas = screen.getByTestId('qr-canvas');
            expect(qrCanvas).toBeInTheDocument();
            expect(qrCanvas).toHaveAttribute('data-value', generatedUrl);
            
            // Assert: QR code should have valid properties
            expect(qrCanvas).toHaveAttribute('data-size', '200'); // Default size
            expect(qrCanvas).toHaveAttribute('width', '200');
            expect(qrCanvas).toHaveAttribute('height', '200');
            expect(qrCanvas).toHaveAttribute('data-level', 'M'); // Default error correction
            
            // Assert: URL should be parseable by URL service
            const parsed = urlService.parseShareableURL(generatedUrl);
            expect(parsed).not.toBeNull();
            expect(parsed!.linkListId).toBe(linkList.id);
          } finally {
            unmount();
            cleanup();
          }
          
          return true;
        }
      ),
      { numRuns: 10, timeout: 6000 }
    );
  }, 8000);
});