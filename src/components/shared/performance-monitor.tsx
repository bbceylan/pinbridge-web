'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Activity, 
  Clock, 
  Database, 
  Cpu, 
  MemoryStick,
  TrendingUp,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';

interface PerformanceMetrics {
  processingTime: number;
  memoryUsage: number;
  apiCallsPerSecond: number;
  cacheHitRate: number;
  workerUtilization: number;
  queueLength: number;
  errorRate: number;
  timestamp: Date;
}

interface PerformanceMonitorProps {
  sessionId?: string;
  onOptimizationSuggestion?: (suggestion: OptimizationSuggestion) => void;
}

interface OptimizationSuggestion {
  type: 'memory' | 'performance' | 'api' | 'cache';
  severity: 'low' | 'medium' | 'high';
  message: string;
  action?: string;
}

export function PerformanceMonitor({ 
  sessionId, 
  onOptimizationSuggestion 
}: PerformanceMonitorProps) {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [suggestions, setSuggestions] = useState<OptimizationSuggestion[]>([]);
  const intervalRef = useRef<NodeJS.Timeout>();

  // Start/stop monitoring
  const toggleMonitoring = () => {
    if (isMonitoring) {
      stopMonitoring();
    } else {
      startMonitoring();
    }
  };

  const startMonitoring = () => {
    setIsMonitoring(true);
    
    // Collect metrics every 2 seconds
    intervalRef.current = setInterval(async () => {
      const newMetrics = await collectMetrics();
      setMetrics(newMetrics);
      
      // Analyze metrics for optimization suggestions
      const newSuggestions = analyzeMetrics(newMetrics);
      setSuggestions(newSuggestions);
      
      // Notify parent component of suggestions
      newSuggestions.forEach(suggestion => {
        if (onOptimizationSuggestion) {
          onOptimizationSuggestion(suggestion);
        }
      });
    }, 2000);
  };

  const stopMonitoring = () => {
    setIsMonitoring(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Collect performance metrics
  const collectMetrics = async (): Promise<PerformanceMetrics> => {
    // Memory usage (if available)
    let memoryUsage = 0;
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      memoryUsage = memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit * 100;
    }

    // Processing time (mock for now - would be real in production)
    const processingTime = performance.now() % 1000;

    // API calls per second (mock - would track real API calls)
    const apiCallsPerSecond = Math.random() * 10;

    // Cache hit rate (mock - would get from cache service)
    const cacheHitRate = 75 + Math.random() * 20;

    // Worker utilization (mock - would get from worker pool)
    const workerUtilization = Math.random() * 100;

    // Queue length (mock - would get from processing queue)
    const queueLength = Math.floor(Math.random() * 50);

    // Error rate (mock - would track real errors)
    const errorRate = Math.random() * 5;

    return {
      processingTime,
      memoryUsage,
      apiCallsPerSecond,
      cacheHitRate,
      workerUtilization,
      queueLength,
      errorRate,
      timestamp: new Date(),
    };
  };

  // Analyze metrics for optimization suggestions
  const analyzeMetrics = (metrics: PerformanceMetrics): OptimizationSuggestion[] => {
    const suggestions: OptimizationSuggestion[] = [];

    // Memory usage analysis
    if (metrics.memoryUsage > 80) {
      suggestions.push({
        type: 'memory',
        severity: 'high',
        message: 'High memory usage detected. Consider clearing caches or reducing batch sizes.',
        action: 'Reduce batch size or clear cache'
      });
    } else if (metrics.memoryUsage > 60) {
      suggestions.push({
        type: 'memory',
        severity: 'medium',
        message: 'Memory usage is elevated. Monitor for potential memory leaks.',
        action: 'Monitor memory usage'
      });
    }

    // Cache hit rate analysis
    if (metrics.cacheHitRate < 50) {
      suggestions.push({
        type: 'cache',
        severity: 'medium',
        message: 'Low cache hit rate. Consider adjusting cache TTL or size.',
        action: 'Optimize cache configuration'
      });
    }

    // API rate analysis
    if (metrics.apiCallsPerSecond > 8) {
      suggestions.push({
        type: 'api',
        severity: 'medium',
        message: 'High API call rate. Consider implementing request batching.',
        action: 'Implement request batching'
      });
    }

    // Worker utilization analysis
    if (metrics.workerUtilization > 90) {
      suggestions.push({
        type: 'performance',
        severity: 'medium',
        message: 'Worker pool is at high utilization. Consider increasing worker count.',
        action: 'Increase worker pool size'
      });
    }

    // Queue length analysis
    if (metrics.queueLength > 30) {
      suggestions.push({
        type: 'performance',
        severity: 'high',
        message: 'Processing queue is backing up. Consider optimizing processing speed.',
        action: 'Optimize processing algorithms'
      });
    }

    // Error rate analysis
    if (metrics.errorRate > 3) {
      suggestions.push({
        type: 'performance',
        severity: 'high',
        message: 'High error rate detected. Check API connectivity and data quality.',
        action: 'Investigate error sources'
      });
    }

    return suggestions;
  };

  // Format metrics for display
  const formatMetric = (value: number, unit: string, decimals = 1): string => {
    return `${value.toFixed(decimals)}${unit}`;
  };

  // Get status color based on value and thresholds
  const getStatusColor = (value: number, thresholds: { good: number; warning: number }): string => {
    if (value <= thresholds.good) return 'text-green-600';
    if (value <= thresholds.warning) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>Performance Monitor</span>
          </CardTitle>
          <Button
            size="sm"
            variant={isMonitoring ? "destructive" : "default"}
            onClick={toggleMonitoring}
          >
            {isMonitoring ? 'Stop' : 'Start'} Monitoring
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Metrics Grid */}
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Processing Time */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">Processing Time</span>
              </div>
              <div className={`text-lg font-bold ${getStatusColor(metrics.processingTime, { good: 100, warning: 500 })}`}>
                {formatMetric(metrics.processingTime, 'ms')}
              </div>
            </div>

            {/* Memory Usage */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <MemoryStick className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">Memory Usage</span>
              </div>
              <div className={`text-lg font-bold ${getStatusColor(metrics.memoryUsage, { good: 50, warning: 75 })}`}>
                {formatMetric(metrics.memoryUsage, '%')}
              </div>
            </div>

            {/* API Calls/sec */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">API Calls/sec</span>
              </div>
              <div className={`text-lg font-bold ${getStatusColor(metrics.apiCallsPerSecond, { good: 5, warning: 8 })}`}>
                {formatMetric(metrics.apiCallsPerSecond, '')}
              </div>
            </div>

            {/* Cache Hit Rate */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Database className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">Cache Hit Rate</span>
              </div>
              <div className={`text-lg font-bold ${getStatusColor(100 - metrics.cacheHitRate, { good: 20, warning: 40 })}`}>
                {formatMetric(metrics.cacheHitRate, '%')}
              </div>
            </div>

            {/* Worker Utilization */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Cpu className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">Worker Utilization</span>
              </div>
              <div className={`text-lg font-bold ${getStatusColor(metrics.workerUtilization, { good: 70, warning: 85 })}`}>
                {formatMetric(metrics.workerUtilization, '%')}
              </div>
            </div>

            {/* Queue Length */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Activity className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">Queue Length</span>
              </div>
              <div className={`text-lg font-bold ${getStatusColor(metrics.queueLength, { good: 10, warning: 25 })}`}>
                {metrics.queueLength}
              </div>
            </div>

            {/* Error Rate */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">Error Rate</span>
              </div>
              <div className={`text-lg font-bold ${getStatusColor(metrics.errorRate, { good: 1, warning: 3 })}`}>
                {formatMetric(metrics.errorRate, '%')}
              </div>
            </div>

            {/* Last Updated */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">Last Updated</span>
              </div>
              <div className="text-sm text-gray-600">
                {metrics.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        )}

        {/* Optimization Suggestions */}
        {suggestions.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-medium text-gray-900">Optimization Suggestions</h3>
            <div className="space-y-2">
              {suggestions.map((suggestion, index) => (
                <div 
                  key={index}
                  className={`p-3 rounded-lg border ${
                    suggestion.severity === 'high' ? 'bg-red-50 border-red-200' :
                    suggestion.severity === 'medium' ? 'bg-yellow-50 border-yellow-200' :
                    'bg-blue-50 border-blue-200'
                  }`}
                >
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className={`h-4 w-4 mt-0.5 ${
                      suggestion.severity === 'high' ? 'text-red-600' :
                      suggestion.severity === 'medium' ? 'text-yellow-600' :
                      'text-blue-600'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            suggestion.severity === 'high' ? 'border-red-300 text-red-700' :
                            suggestion.severity === 'medium' ? 'border-yellow-300 text-yellow-700' :
                            'border-blue-300 text-blue-700'
                          }`}
                        >
                          {suggestion.type.toUpperCase()}
                        </Badge>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            suggestion.severity === 'high' ? 'border-red-300 text-red-700' :
                            suggestion.severity === 'medium' ? 'border-yellow-300 text-yellow-700' :
                            'border-blue-300 text-blue-700'
                          }`}
                        >
                          {suggestion.severity.toUpperCase()}
                        </Badge>
                      </div>
                      <p className={`text-sm mt-1 ${
                        suggestion.severity === 'high' ? 'text-red-800' :
                        suggestion.severity === 'medium' ? 'text-yellow-800' :
                        'text-blue-800'
                      }`}>
                        {suggestion.message}
                      </p>
                      {suggestion.action && (
                        <p className={`text-xs mt-1 font-medium ${
                          suggestion.severity === 'high' ? 'text-red-700' :
                          suggestion.severity === 'medium' ? 'text-yellow-700' :
                          'text-blue-700'
                        }`}>
                          Recommended: {suggestion.action}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status */}
        {!isMonitoring && (
          <div className="text-center py-4">
            <Activity className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600">
              Click "Start Monitoring" to begin collecting performance metrics
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}