'use client';

import { useState, useRef } from 'react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Copy, Check, Settings } from 'lucide-react';

export interface QRCodeGeneratorProps {
  url: string;
  title?: string;
  size?: number;
  downloadable?: boolean;
  showCopyButton?: boolean;
  showSettings?: boolean;
}

type QRFormat = 'png' | 'svg';
type QRSize = 128 | 200 | 256 | 400 | 512;
type QRQuality = 'L' | 'M' | 'Q' | 'H';

export function QRCodeGenerator({ 
  url, 
  title = 'QR Code',
  size = 200, 
  downloadable = true,
  showCopyButton = true,
  showSettings = true
}: QRCodeGeneratorProps) {
  const [copied, setCopied] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState<QRFormat>('png');
  const [downloadSize, setDownloadSize] = useState<QRSize>(256);
  const [quality, setQuality] = useState<QRQuality>('M');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const handleDownload = () => {
    if (downloadFormat === 'png') {
      downloadPNG();
    } else {
      downloadSVG();
    }
  };

  const downloadPNG = () => {
    if (!qrRef.current) return;

    const canvas = qrRef.current.querySelector('canvas');
    if (!canvas) return;

    // Create a new canvas with the desired download size
    const downloadCanvas = document.createElement('canvas');
    const ctx = downloadCanvas.getContext('2d');
    if (!ctx) return;

    downloadCanvas.width = downloadSize;
    downloadCanvas.height = downloadSize;

    // Draw the QR code at the new size
    ctx.drawImage(canvas, 0, 0, downloadSize, downloadSize);

    // Create download link
    const link = document.createElement('a');
    link.download = `${title.toLowerCase().replace(/\s+/g, '-')}-qr-code-${downloadSize}px.png`;
    link.href = downloadCanvas.toDataURL('image/png', 1.0);
    link.click();
  };

  const downloadSVG = () => {
    if (!svgRef.current) return;

    // Clone the SVG and set the desired size
    const svgClone = svgRef.current.cloneNode(true) as SVGSVGElement;
    svgClone.setAttribute('width', downloadSize.toString());
    svgClone.setAttribute('height', downloadSize.toString());

    // Convert SVG to string
    const svgData = new XMLSerializer().serializeToString(svgClone);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });

    // Create download link
    const link = document.createElement('a');
    link.download = `${title.toLowerCase().replace(/\s+/g, '-')}-qr-code-${downloadSize}px.svg`;
    link.href = URL.createObjectURL(svgBlob);
    link.click();
    
    // Clean up the object URL
    setTimeout(() => URL.revokeObjectURL(link.href), 100);
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
            <QRCodeCanvas
              value={url}
              size={size}
              level={quality}
              includeMargin={true}
            />
          </div>
        </div>

        {/* Hidden SVG for download purposes */}
        <div className="hidden">
          <QRCodeSVG
            ref={svgRef}
            value={url}
            size={downloadSize}
            level={quality}
            includeMargin={true}
          />
        </div>

        {/* URL Display */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground break-all">
            {url}
          </p>
        </div>

        {/* Download Settings */}
        {downloadable && showSettings && (
          <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              <span className="text-sm font-medium">Download Options</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="ml-auto text-xs"
              >
                {showAdvanced ? 'Hide' : 'Show'} Advanced
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Format</label>
                <Select value={downloadFormat} onValueChange={(value: QRFormat) => setDownloadFormat(value)}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="png">PNG</SelectItem>
                    <SelectItem value="svg">SVG</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1">
                <label className="text-xs font-medium">Size</label>
                <Select value={downloadSize.toString()} onValueChange={(value) => setDownloadSize(parseInt(value) as QRSize)}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="128">128px</SelectItem>
                    <SelectItem value="200">200px</SelectItem>
                    <SelectItem value="256">256px</SelectItem>
                    <SelectItem value="400">400px</SelectItem>
                    <SelectItem value="512">512px</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {showAdvanced && (
              <div className="space-y-1">
                <label className="text-xs font-medium">Error Correction</label>
                <Select value={quality} onValueChange={(value: QRQuality) => setQuality(value)}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="L">Low (~7%)</SelectItem>
                    <SelectItem value="M">Medium (~15%)</SelectItem>
                    <SelectItem value="Q">Quartile (~25%)</SelectItem>
                    <SelectItem value="H">High (~30%)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Higher correction allows scanning even if partially damaged
                </p>
              </div>
            )}
          </div>
        )}

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
              Download {downloadFormat.toUpperCase()}
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
      <QRCodeCanvas
        value={url}
        size={size}
        level="M"
        includeMargin={false}
      />
    </div>
  );
}