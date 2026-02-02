'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsItem 
} from '@/components/ui/tabs';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Clock, 
  Target, 
  Users, 
  Zap,
  AlertTriangle,
  CheckCircle,
  RefreshCw
} from 'lucide-react';
import { analyticsService } from '@/lib/services/analytics-service';
import type { 
  UsageInsights, 
  MatchAccuracyReport, 
  PerformanceReport, 
  UserBehaviorReport 
} from '@/lib/services/analytics-service';

interface AnalyticsDashboardProps {
  className?: string;
}

type DateRange = '7d' | '30d' | '90d' | 'custom';

export function AnalyticsDashboard({ className = '' }: AnalyticsDashboardProps) {
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Analytics data
  const [usageInsights, setUsageInsights] = useState<UsageInsights | null>(null);
  const [accuracyReport, setAccuracyReport] = useState<MatchAccuracyReport | null>(null);
  const [performanceReport, setPerformanceReport] = useState<PerformanceReport | null>(null);
  const [behaviorReport, setBehaviorReport] = useState<UserBehaviorReport | null>(null);

  // Load analytics data
  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      const { startDate, endDate, previousStart, previousEnd } = getDateRanges(dateRange);
      
      const [usage, accuracy, performance, behavior] = await Promise.all([
        analyticsService.getUsageInsights(startDate, endDate, previousStart, previousEnd),
        analyticsService.getMatchAccuracyReport(startDate, endDate),
        analyticsService.getPerformanceReport(startDate, endDate),
        analyticsService.getUserBehaviorReport(startDate, endDate),
      ]);

      setUsageInsights(usage);
      setAccuracyReport(accuracy);
      setPerformanceReport(performance);
      setBehaviorReport(behavior);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [dateRange]);

  const getDateRanges = (range: DateRange) => {
    const now = new Date();
    const endDate = new Date(now);
    let startDate: Date;
    let previousStart: Date;
    let previousEnd: Date;

    switch (range) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        previousEnd = new Date(startDate);
        previousStart = new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        previousEnd = new Date(startDate);
        previousStart = new Date(startDate.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        previousEnd = new Date(startDate);
        previousStart = new Date(startDate.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        previousEnd = new Date(startDate);
        previousStart = new Date(startDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return { startDate, endDate, previousStart, previousEnd };
  };

  const formatNumber = (num: number, decimals = 0): string => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const getTrendIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (change < 0) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Activity className="h-4 w-4 text-gray-400" />;
  };

  const getTrendColor = (change: number) => {
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-600">Loading analytics...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h2>
          <p className="text-gray-600">
            Insights into automated transfer performance and usage patterns
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Select value={dateRange} onValueChange={(value) => setDateRange(value as DateRange)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={loadAnalytics}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      {usageInsights && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Sessions</p>
                  <p className="text-2xl font-bold">{formatNumber(usageInsights.totalSessions)}</p>
                </div>
                <Users className="h-8 w-8 text-blue-600" />
              </div>
              <div className="flex items-center mt-2">
                {getTrendIcon(usageInsights.trends.sessionsChange)}
                <span className={`text-sm ml-1 ${getTrendColor(usageInsights.trends.sessionsChange)}`}>
                  {formatNumber(Math.abs(usageInsights.trends.sessionsChange), 1)}%
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Match Accuracy</p>
                  <p className="text-2xl font-bold">{formatNumber(usageInsights.matchAccuracyRate, 1)}%</p>
                </div>
                <Target className="h-8 w-8 text-green-600" />
              </div>
              <div className="flex items-center mt-2">
                {getTrendIcon(usageInsights.trends.accuracyChange)}
                <span className={`text-sm ml-1 ${getTrendColor(usageInsights.trends.accuracyChange)}`}>
                  {formatNumber(Math.abs(usageInsights.trends.accuracyChange), 1)}%
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Processing Time</p>
                  <p className="text-2xl font-bold">{formatDuration(usageInsights.averageProcessingTime)}</p>
                </div>
                <Clock className="h-8 w-8 text-orange-600" />
              </div>
              <div className="flex items-center mt-2">
                {getTrendIcon(-usageInsights.trends.performanceChange)} {/* Negative because lower is better */}
                <span className={`text-sm ml-1 ${getTrendColor(-usageInsights.trends.performanceChange)}`}>
                  {formatNumber(Math.abs(usageInsights.trends.performanceChange), 1)}%
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Completion Rate</p>
                  <p className="text-2xl font-bold">{formatNumber(usageInsights.completionRate, 1)}%</p>
                </div>
                <CheckCircle className="h-8 w-8 text-purple-600" />
              </div>
              <div className="flex items-center mt-2">
                <Badge variant="outline" className="text-xs">
                  {formatNumber(usageInsights.completedSessions)} completed
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detailed Analytics */}
      <Tabs defaultValue="accuracy" className="space-y-4">
        <TabsList>
          <TabsItem value="accuracy">Match Accuracy</TabsItem>
          <TabsItem value="performance">Performance</TabsItem>
          <TabsItem value="behavior">User Behavior</TabsItem>
        </TabsList>

        {/* Match Accuracy Tab */}
        <TabsContent value="accuracy" className="space-y-4">
          {accuracyReport && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Confidence Level Accuracy */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Accuracy by Confidence Level</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <div>
                        <Badge className="bg-green-100 text-green-800 border-green-300 mb-1">High (90%+)</Badge>
                        <p className="text-sm text-gray-600">
                          {formatNumber(accuracyReport.byConfidenceLevel.high.total)} matches
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-800">
                          {formatNumber(accuracyReport.byConfidenceLevel.high.accuracy, 1)}%
                        </p>
                        <p className="text-xs text-green-600">
                          {formatNumber(accuracyReport.byConfidenceLevel.high.accepted)} accepted
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                      <div>
                        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 mb-1">Medium (70-89%)</Badge>
                        <p className="text-sm text-gray-600">
                          {formatNumber(accuracyReport.byConfidenceLevel.medium.total)} matches
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-yellow-800">
                          {formatNumber(accuracyReport.byConfidenceLevel.medium.accuracy, 1)}%
                        </p>
                        <p className="text-xs text-yellow-600">
                          {formatNumber(accuracyReport.byConfidenceLevel.medium.accepted)} accepted
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                      <div>
                        <Badge className="bg-red-100 text-red-800 border-red-300 mb-1">Low (&lt;70%)</Badge>
                        <p className="text-sm text-gray-600">
                          {formatNumber(accuracyReport.byConfidenceLevel.low.total)} matches
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-red-800">
                          {formatNumber(accuracyReport.byConfidenceLevel.low.accuracy, 1)}%
                        </p>
                        <p className="text-xs text-red-600">
                          {formatNumber(accuracyReport.byConfidenceLevel.low.accepted)} accepted
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Service Comparison */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Accuracy by Service</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <h4 className="font-medium">Apple Maps</h4>
                        <p className="text-sm text-gray-600">
                          {formatNumber(accuracyReport.byService.apple.total)} matches
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">
                          {formatNumber(accuracyReport.byService.apple.accuracy, 1)}%
                        </p>
                        <p className="text-xs text-gray-600">
                          {formatNumber(accuracyReport.byService.apple.accepted)} accepted
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <h4 className="font-medium">Google Maps</h4>
                        <p className="text-sm text-gray-600">
                          {formatNumber(accuracyReport.byService.google.total)} matches
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">
                          {formatNumber(accuracyReport.byService.google.accuracy, 1)}%
                        </p>
                        <p className="text-xs text-gray-600">
                          {formatNumber(accuracyReport.byService.google.accepted)} accepted
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Category Performance */}
              {accuracyReport.byCategory.length > 0 && (
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-lg">Accuracy by Category</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {accuracyReport.byCategory
                        .sort((a, b) => b.total - a.total)
                        .slice(0, 10)
                        .map((category) => (
                          <div key={category.category} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                            <div>
                              <span className="font-medium">{category.category}</span>
                              <span className="text-sm text-gray-600 ml-2">
                                ({formatNumber(category.total)} matches)
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="font-bold">{formatNumber(category.accuracy, 1)}%</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          {performanceReport && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Processing Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Processing Performance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Average Time/Place</p>
                      <p className="text-lg font-bold">
                        {formatDuration(performanceReport.processingMetrics.averageTimePerPlace)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">95th Percentile</p>
                      <p className="text-lg font-bold">
                        {formatDuration(performanceReport.processingMetrics.p95TimePerPlace)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* API Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">API Performance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Total API Calls</p>
                      <p className="text-lg font-bold">
                        {formatNumber(performanceReport.apiMetrics.totalApiCalls)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Error Rate</p>
                      <p className="text-lg font-bold">
                        {formatNumber(performanceReport.apiMetrics.errorRate, 1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Apple Maps</p>
                      <p className="text-lg font-bold">
                        {formatNumber(performanceReport.apiMetrics.callsByService.apple)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Google Maps</p>
                      <p className="text-lg font-bold">
                        {formatNumber(performanceReport.apiMetrics.callsByService.google)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Cache Performance */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Cache Performance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Hit Rate</p>
                      <p className="text-lg font-bold text-green-600">
                        {formatNumber(performanceReport.cacheMetrics.hitRate, 1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Miss Rate</p>
                      <p className="text-lg font-bold text-red-600">
                        {formatNumber(performanceReport.cacheMetrics.missRate, 1)}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Worker Performance */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Worker Performance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Utilization</p>
                      <p className="text-lg font-bold">
                        {formatNumber(performanceReport.workerMetrics.averageUtilization, 1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Completion Rate</p>
                      <p className="text-lg font-bold">
                        {formatNumber(performanceReport.workerMetrics.taskCompletionRate, 1)}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* User Behavior Tab */}
        <TabsContent value="behavior" className="space-y-4">
          {behaviorReport && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Verification Patterns */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Verification Patterns</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Avg Time per Match</span>
                      <span className="font-medium">
                        {formatDuration(behaviorReport.verificationPatterns.averageTimePerMatch)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Bulk Actions Used</span>
                      <span className="font-medium">
                        {formatNumber(behaviorReport.verificationPatterns.bulkActionUsage)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Manual Searches</span>
                      <span className="font-medium">
                        {formatNumber(behaviorReport.verificationPatterns.manualSearchUsage)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Session Patterns */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Session Patterns</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Avg Session Length</span>
                      <span className="font-medium">
                        {formatDuration(behaviorReport.sessionPatterns.averageSessionLength)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Abandonment Rate</span>
                      <span className="font-medium">
                        {formatNumber(behaviorReport.sessionPatterns.abandonmentRate, 1)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Pause/Resume Frequency</span>
                      <span className="font-medium">
                        {formatNumber(behaviorReport.sessionPatterns.pauseResumeFrequency)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Error Recovery */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg">Error Recovery</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-red-50 rounded-lg">
                      <AlertTriangle className="h-8 w-8 text-red-600 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">Error Rate</p>
                      <p className="text-lg font-bold text-red-600">
                        {formatNumber(behaviorReport.errorRecovery.errorEncounterRate, 2)}
                      </p>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">Recovery Rate</p>
                      <p className="text-lg font-bold text-green-600">
                        {formatNumber(behaviorReport.errorRecovery.recoverySuccessRate, 1)}%
                      </p>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <BarChart3 className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">Error Types</p>
                      <p className="text-lg font-bold text-blue-600">
                        {behaviorReport.errorRecovery.commonErrorTypes.length}
                      </p>
                    </div>
                  </div>

                  {behaviorReport.errorRecovery.commonErrorTypes.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-medium mb-2">Common Error Types</h4>
                      <div className="space-y-1">
                        {behaviorReport.errorRecovery.commonErrorTypes.slice(0, 5).map((error, index) => (
                          <div key={index} className="flex justify-between text-sm">
                            <span className="text-gray-600">{error.type}</span>
                            <span className="font-medium">{error.frequency}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Last Updated */}
      {lastUpdated && (
        <div className="text-center text-sm text-gray-500">
          Last updated: {lastUpdated.toLocaleString()}
        </div>
      )}
    </div>
  );
}