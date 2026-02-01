'use client';

import React, { useState, Suspense, lazy } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QrCode, Loader2, AlertCircle } from 'lucide-react';

// Lazy load the QR code generator to reduce initial bundle size
const QRCodeGenerator = lazy(() => 
  import('./qr-code-generator').then(module => ({ 
    default: module.QRCodeGenerator 
  }))
);

const QRCodeInline = lazy(() => 
  import('./qr-code-generator').then(module => ({ 
    default: module.QRCodeInline 
  }))
);

interface LazyQRCodeProps {
  url: string;
  title?: string;
  size?: number;
  inline?: boolean;
  autoLoad?: boolean;
}

export function LazyQRCode({ 
  url, 
  title = 'QR Code',
  size = 200,
  inline = false,
  autoLoad = false
}: LazyQRCodeProps) {
  const [shouldLoad, setShouldLoad] = useState(autoLoad);
  const [hasError, setHasError] = useState(false);

  const handleLoadQRCode = () => {
    setShouldLoad(true);
  };

  const handleError = () => {
    setHasError(true);
  };

  // Inline version for small QR codes
  if (inline) {
    return (
      <div className="inline-block">
        {shouldLoad ? (
          <Suspense 
            fallback={
              <div className="inline-flex items-center justify-center w-24 h-24 border rounded bg-muted">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            }
          >
            <ErrorBoundary onError={handleError}>
              {hasError ? (
                <div className="inline-flex items-center justify-center w-24 h-24 border rounded bg-muted">
                  <AlertCircle className="w-4 h-4 text-muted-foreground" />
                </div>
              ) : (
                <QRCodeInline url={url} size={size} />
              )}
            </ErrorBoundary>
          </Suspense>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadQRCode}
            className="inline-flex items-center gap-2"
          >
            <QrCode className="w-4 h-4" />
            Show QR
          </Button>
        )}
      </div>
    );
  }

  // Full version for detailed QR code display
  return (
    <div>
      {shouldLoad ? (
        <Suspense 
          fallback={
            <Card>
              <CardHeader>
                <CardTitle className="text-center">{title}</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-center py-8">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Loading QR code generator...</span>
                </div>
              </CardContent>
            </Card>
          }
        >
          <ErrorBoundary onError={handleError}>
            {hasError ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-center">{title}</CardTitle>
                </CardHeader>
                <CardContent className="text-center py-8">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground mb-4">
                    <AlertCircle className="w-5 h-5" />
                    <span>Failed to load QR code generator</span>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setHasError(false);
                      setShouldLoad(false);
                    }}
                  >
                    Try Again
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <QRCodeGenerator
                url={url}
                title={title}
                size={size}
                downloadable={true}
                showCopyButton={true}
                showSettings={true}
              />
            )}
          </ErrorBoundary>
        </Suspense>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-center">{title}</CardTitle>
          </CardHeader>
          <CardContent className="text-center py-8">
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto bg-muted rounded-lg flex items-center justify-center">
                <QrCode className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-sm">
                Click to generate QR code for easy sharing
              </p>
              <Button
                onClick={handleLoadQRCode}
                className="min-h-[44px]"
              >
                <QrCode className="w-4 h-4 mr-2" />
                Generate QR Code
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Error boundary component for handling QR code loading errors
interface ErrorBoundaryProps {
  children: React.ReactNode;
  onError: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('QR Code loading error:', error, errorInfo);
    this.props.onError();
  }

  render() {
    if (this.state.hasError) {
      return null; // Let parent handle error display
    }

    return this.props.children;
  }
}

// Hook for managing QR code loading state
export function useQRCodeLoading() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadQRCode = () => {
    setIsLoading(true);
    setError(null);
    
    // Simulate loading time for better UX
    setTimeout(() => {
      setIsLoaded(true);
      setIsLoading(false);
    }, 100);
  };

  const reset = () => {
    setIsLoaded(false);
    setIsLoading(false);
    setError(null);
  };

  return {
    isLoaded,
    isLoading,
    error,
    loadQRCode,
    reset,
  };
}