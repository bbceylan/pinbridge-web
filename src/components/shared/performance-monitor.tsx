'use client';

import { useState, useEffect } from 'react';
import { linkListCache, cacheUtils } from '@/lib/services/cache';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Activity, Wifi, WifiOff, Trash2, RefreshCw } from 'lucide-react';

interface PerformanceStats {
  cacheStats: ReturnType<typeof linkListCache.getStats>;
  connectionInfo: {
    effectiveType?: string;
    downlink?: number;
    saveData?: boolean;
  };
  memoryInfo?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

export function PerformanceMonitor() {
  const [stats, setStats] = useState<PerformanceStats | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only run in development
    if (process.env.NODE_ENV !== 'development') {
      return;
    }

    const updateStats = () => {
      const cacheStats = linkListCache.getStats();
      
      // Get connection info if available
      const connection = (navigator as any).connection;
      const connectionInfo = connection ? {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        saveData: connection.saveData,
      } : {};

      // Get memory info if available
      const performance = (window as any).performance;
      const memoryInfo = performance?.memory ? {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
      } : undefined;

      setStats({
        cacheStats,
        connectionInfo,
        memoryInfo,
      });
    };

    updateStats();
    const interval = setInterval(updateStats, 2000); // Update every 2 seconds

    return () => clearInterval(interval);
  }, []);

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const handleClearCache = () => {
    linkListCache.clearAll();
    setStats(prev => prev ? { ...prev, cacheStats: linkListCache.getStats() } : null);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getConnectionBadge = () => {
    const isSlowConnection = cacheUtils.isSlowConnection();
    const effectiveType = stats?.connectionInfo.effectiveType;
    
    return (
      <Badge variant={isSlowConnection ? 'destructive' : 'default'} className="flex items-center gap-1">
        {isSlowConnection ? <WifiOff className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}
        {effectiveType || 'Unknown'}
      </Badge>
    );
  };

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsVisible(true)}
          className="shadow-lg"
        >
          <Activity className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80">
      <Card className="shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Performance Monitor
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsVisible(false)}
              className="h-6 w-6 p-0"
            >
              ×
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          {/* Connection Info */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">Connection</span>
              {getConnectionBadge()}
            </div>
            {stats?.connectionInfo.downlink && (
              <p className="text-muted-foreground">
                Speed: {stats.connectionInfo.downlink} Mbps
              </p>
            )}
            {stats?.connectionInfo.saveData && (
              <p className="text-amber-600">Data Saver: ON</p>
            )}
          </div>

          {/* Cache Stats */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">Cache</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearCache}
                className="h-6 px-2 text-xs"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Clear
              </Button>
            </div>
            
            {stats && (
              <div className="space-y-1 text-muted-foreground">
                <div className="flex justify-between">
                  <span>Places:</span>
                  <span>{stats.cacheStats.places.entries} entries</span>
                </div>
                <div className="flex justify-between">
                  <span>URLs:</span>
                  <span>{stats.cacheStats.urls.entries} entries</span>
                </div>
                <div className="flex justify-between">
                  <span>Link Lists:</span>
                  <span>{stats.cacheStats.linkLists.entries} entries</span>
                </div>
                <div className="flex justify-between">
                  <span>Cache Size:</span>
                  <span>
                    {formatBytes(
                      stats.cacheStats.places.sizeBytes +
                      stats.cacheStats.urls.sizeBytes +
                      stats.cacheStats.linkLists.sizeBytes
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Utilization:</span>
                  <span>
                    {Math.round(
                      (stats.cacheStats.places.utilization +
                       stats.cacheStats.urls.utilization +
                       stats.cacheStats.linkLists.utilization) / 3 * 100
                    )}%
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Memory Info */}
          {stats?.memoryInfo && (
            <div>
              <span className="font-medium">Memory</span>
              <div className="space-y-1 text-muted-foreground mt-2">
                <div className="flex justify-between">
                  <span>Used:</span>
                  <span>{formatBytes(stats.memoryInfo.usedJSHeapSize)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total:</span>
                  <span>{formatBytes(stats.memoryInfo.totalJSHeapSize)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Limit:</span>
                  <span>{formatBytes(stats.memoryInfo.jsHeapSizeLimit)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Performance Tips */}
          <div className="pt-2 border-t">
            <span className="font-medium">Tips</span>
            <div className="mt-1 text-muted-foreground">
              {cacheUtils.isSlowConnection() ? (
                <p>🐌 Slow connection detected. Using compact mode and aggressive caching.</p>
              ) : (
                <p>🚀 Good connection. Full features enabled.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}