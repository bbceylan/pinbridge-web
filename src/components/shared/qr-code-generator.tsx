'use client';

import { useState, useRef } from 'react';
import { QRCodeCanvas as QRCode } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Copy, Check } from 'lucide-react';

export interface QRCodeGeneratorProps {
  url: string;
  title?: string;
  size?: number;
  downloadable?: boolean;
  showCopyButton?: boolean;
}

export function QRCodeGenerator({ 
  url, 
  title = 'QR Code',
  size = 200, 
  downloadable = true,
  showCopyButton = true 
}: QRCodeGeneratorProps) {
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const handleDownload = () => {
    if (!qrRef.current) return;

    const canvas = qrRef.current.querySelector('canvas');
    if (!canvas) return;

    // Create download link
    const link = document.createElement('a');
    link.download = `${title.toLowerCase().replace(/\s+/g, '-')}-qr-code.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy URL:', error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* QR Code Display */}
        <div className="flex justify-center">
          <div 
            ref={qrRef}
            className="p-4 bg-white rounded-lg border"
          >
            <QRCode
              value={url}
              size={size}
              level="M"
              includeMargin={true}
            />
          </div>
        </div>

        {/* URL Display */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground break-all">
            {url}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 justify-center">
          {showCopyButton && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyUrl}
              className="flex items-center gap-2"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy URL
                </>
              )}
            </Button>
          )}
          
          {downloadable && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download PNG
            </Button>
          )}
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Scan with your phone camera to open the link list
        </p>
      </CardContent>
    </Card>
  );
}

// Lightweight version for inline display
export function QRCodeInline({ 
  url, 
  size = 100 
}: { 
  url: string; 
  size?: number; 
}) {
  return (
    <div className="inline-block p-2 bg-white rounded border">
      <QRCode
        value={url}
        size={size}
        level="M"
        includeMargin={false}
      />
    </div>
  );
}