/**
 * Analytics Service for Automated Transfer System
 * 
 * Tracks usage patterns, match accuracy, and performance metrics
 * to provide insights for system optimization and user experience improvements.
 */

import { db } from '@/lib/db';
import type { 
  TransferPackSession, 
  PlaceMatchRecord, 
  TransferPack,
  VerificationStatus,
  ConfidenceLevel 
} from '@/types';

export interface AnalyticsEvent {
  id: string;
  type: AnalyticsEventType;
  sessionId?: string;
  userId?: string;
  data: Record<string, any>;
  timestamp: Date;
}

export type AnalyticsEventType = 
  | 'session_started'
  | 'session_completed'
  | 'session_paused'
  | 'session_resumed'
  | 'match_accepted'
  | 'match_rejected'
  | 'manual_search_performed'
  | 'bulk_action_performed'
  | 'transfer_executed'
  | 'error_occurred'
  | 'performance_metric'
  | 'user_interaction';

export interface UsageInsights {
  totalSessions: number;
  completedSessions: number;
  averageSessionDuration: number;
  averagePlacesPerSession: number;
  completionRate: number;
  
  // Match accuracy metrics
  totalMatches: number;
  acceptedMatches: number;
  rejectedMatches: number;
  manualMatches: number;
  matchAccuracyRate: number;
  
  // Confidence distribution
  highConfidenceMatches: number;
  mediumConfidenceMatches: number;
  lowConfidenceMatches: number;
  
  // Performance metrics
  averageProcessingTime: number;
  averageApiCallsPerPlace: number;
  cacheHitRate: number;
  errorRate: number;
  
  // User behavior
  bulkActionsUsed: number;
  manualSearchesPerformed: number;
  averageVerificationTime: number;
  
  // Trends (compared to previous period)
  trends: {
    sessionsChange: number;
    accuracyChange: number;
    performanceChange: number;
  };
}

export interface MatchAccuracyReport {
  byConfidenceLevel: {
    high: { total: number; accepted: number; accuracy: number };
    medium: { total: number; accepted: number; accuracy: number };
    low: { total: number; accepted: number; accuracy: number };
  };
  byService: {
    apple: { total: number; accepted: number; accuracy: number };
    google: { total: number; accepted: number; accuracy: number };
  };
  byCategory: Array<{
    category: string;
    total: number;
    accepted: number;
    accuracy: number;
  }>;
  overallAccuracy: number;
  confidenceCalibration: Array<{
    confidenceRange: [number, number];
    predictedAccuracy: number;
    actualAccuracy: number;
    calibrationError: number;
  }>;
}

export interface PerformanceReport {
  processingMetrics: {
    averageTimePerPlace: number;
    medianTimePerPlace: number;
    p95TimePerPlace: number;
    timeByBatchSize: Array<{ batchSize: number; averageTime: number }>;
  };
  apiMetrics: {
    totalApiCalls: number;
    averageResponseTime: number;
    errorRate: number;
    rateLimitHits: number;
    callsByService: { apple: number; google: number };
  };
  cacheMetrics: {
    hitRate: number;
    missRate: number;
    averageSize: number;
    evictionRate: number;
  };
  workerMetrics: {
    averageUtilization: number;
    taskCompletionRate: number;
    averageQueueTime: number;
  };
}

export interface UserBehaviorReport {
  verificationPatterns: {
    averageTimePerMatch: number;
    bulkActionUsage: number;
    manualSearchUsage: number;
    filterUsage: number;
  };
  sessionPatterns: {
    averageSessionLength: number;
    pauseResumeFrequency: number;
    abandonmentRate: number;
    completionTimeDistribution: number[];
  };
  errorRecovery: {
    errorEncounterRate: number;
    recoverySuccessRate: number;
    commonErrorTypes: Array<{ type: string; frequency: number }>;
  };
}

class AnalyticsService {
  /**
   * Track an analytics event
   */
  async trackEvent(
    type: AnalyticsEventType,
    data: Record<string, any>,
    sessionId?: string,
    userId?: string
  ): Promise<void> {
    const event: AnalyticsEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      sessionId,
      userId,
      data,
      timestamp: new Date(),
    };

    // Store in IndexedDB (you might want to add an analytics_events table)
    try {
      // For now, we'll store in localStorage as a simple implementation
      const events = this.getStoredEvents();
      events.push(event);
      
      // Keep only last 1000 events to prevent storage bloat
      if (events.length > 1000) {
        events.splice(0, events.length - 1000);
      }
      
      localStorage.setItem('pinbridge_analytics_events', JSON.stringify(events));
    } catch (error) {
      console.warn('Failed to store analytics event:', error);
    }
  }

  /**
   * Get usage insights for a date range
   */
  async getUsageInsights(
    startDate: Date,
    endDate: Date,
    previousPeriodStart?: Date,
    previousPeriodEnd?: Date
  ): Promise<UsageInsights> {
    const sessions = await this.getSessionsInRange(startDate, endDate);
    const matches = await this.getMatchesInRange(startDate, endDate);
    const events = this.getEventsInRange(startDate, endDate);

    // Calculate basic metrics
    const totalSessions = sessions.length;
    const completedSessions = sessions.filter(s => s.status === 'completed').length;
    const completionRate = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;

    const averageSessionDuration = this.calculateAverageSessionDuration(sessions);
    const averagePlacesPerSession = totalSessions > 0 ? 
      sessions.reduce((sum, s) => sum + s.totalPlaces, 0) / totalSessions : 0;

    // Match accuracy metrics
    const totalMatches = matches.length;
    const acceptedMatches = matches.filter(m => m.verificationStatus === 'accepted').length;
    const rejectedMatches = matches.filter(m => m.verificationStatus === 'rejected').length;
    const manualMatches = matches.filter(m => m.verificationStatus === 'manual').length;
    const matchAccuracyRate = totalMatches > 0 ? (acceptedMatches / totalMatches) * 100 : 0;

    // Confidence distribution
    const highConfidenceMatches = matches.filter(m => m.confidenceLevel === 'high').length;
    const mediumConfidenceMatches = matches.filter(m => m.confidenceLevel === 'medium').length;
    const lowConfidenceMatches = matches.filter(m => m.confidenceLevel === 'low').length;

    // Performance metrics
    const performanceEvents = events.filter(e => e.type === 'performance_metric');
    const averageProcessingTime = this.calculateAverageFromEvents(performanceEvents, 'processingTime');
    const averageApiCallsPerPlace = this.calculateAverageFromEvents(performanceEvents, 'apiCallsPerPlace');
    const cacheHitRate = this.calculateAverageFromEvents(performanceEvents, 'cacheHitRate');
    const errorRate = this.calculateErrorRate(events);

    // User behavior
    const bulkActionsUsed = events.filter(e => e.type === 'bulk_action_performed').length;
    const manualSearchesPerformed = events.filter(e => e.type === 'manual_search_performed').length;
    const averageVerificationTime = this.calculateAverageVerificationTime(events);

    // Calculate trends if previous period provided
    let trends = { sessionsChange: 0, accuracyChange: 0, performanceChange: 0 };
    if (previousPeriodStart && previousPeriodEnd) {
      trends = await this.calculateTrends(
        { startDate, endDate },
        { startDate: previousPeriodStart, endDate: previousPeriodEnd }
      );
    }

    return {
      totalSessions,
      completedSessions,
      averageSessionDuration,
      averagePlacesPerSession,
      completionRate,
      totalMatches,
      acceptedMatches,
      rejectedMatches,
      manualMatches,
      matchAccuracyRate,
      highConfidenceMatches,
      mediumConfidenceMatches,
      lowConfidenceMatches,
      averageProcessingTime,
      averageApiCallsPerPlace,
      cacheHitRate,
      errorRate,
      bulkActionsUsed,
      manualSearchesPerformed,
      averageVerificationTime,
      trends,
    };
  }

  /**
   * Generate match accuracy report
   */
  async getMatchAccuracyReport(startDate: Date, endDate: Date): Promise<MatchAccuracyReport> {
    const matches = await this.getMatchesInRange(startDate, endDate);
    
    // By confidence level
    const byConfidenceLevel = {
      high: this.calculateAccuracyForMatches(matches.filter(m => m.confidenceLevel === 'high')),
      medium: this.calculateAccuracyForMatches(matches.filter(m => m.confidenceLevel === 'medium')),
      low: this.calculateAccuracyForMatches(matches.filter(m => m.confidenceLevel === 'low')),
    };

    // By service (need to get transfer pack info)
    const sessions = await this.getSessionsInRange(startDate, endDate);
    const sessionsByService = await this.groupSessionsByService(sessions);
    
    const byService = {
      apple: this.calculateAccuracyForMatches(
        matches.filter(m => sessionsByService.apple.includes(m.sessionId))
      ),
      google: this.calculateAccuracyForMatches(
        matches.filter(m => sessionsByService.google.includes(m.sessionId))
      ),
    };

    // By category (extract from target place data)
    const byCategory = this.calculateAccuracyByCategory(matches);

    // Overall accuracy
    const overallAccuracy = matches.length > 0 ? 
      (matches.filter(m => m.verificationStatus === 'accepted').length / matches.length) * 100 : 0;

    // Confidence calibration
    const confidenceCalibration = this.calculateConfidenceCalibration(matches);

    return {
      byConfidenceLevel,
      byService,
      byCategory,
      overallAccuracy,
      confidenceCalibration,
    };
  }

  /**
   * Generate performance report
   */
  async getPerformanceReport(startDate: Date, endDate: Date): Promise<PerformanceReport> {
    const events = this.getEventsInRange(startDate, endDate);
    const performanceEvents = events.filter(e => e.type === 'performance_metric');

    // Processing metrics
    const processingTimes = performanceEvents
      .map(e => e.data.processingTimePerPlace)
      .filter(t => typeof t === 'number');
    
    const processingMetrics = {
      averageTimePerPlace: this.calculateAverage(processingTimes),
      medianTimePerPlace: this.calculateMedian(processingTimes),
      p95TimePerPlace: this.calculatePercentile(processingTimes, 95),
      timeByBatchSize: this.calculateTimeByBatchSize(performanceEvents),
    };

    // API metrics
    const apiEvents = events.filter(e => e.data.apiCall);
    const apiMetrics = {
      totalApiCalls: apiEvents.length,
      averageResponseTime: this.calculateAverageFromEvents(apiEvents, 'responseTime'),
      errorRate: this.calculateErrorRate(apiEvents),
      rateLimitHits: apiEvents.filter(e => e.data.rateLimited).length,
      callsByService: {
        apple: apiEvents.filter(e => e.data.service === 'apple').length,
        google: apiEvents.filter(e => e.data.service === 'google').length,
      },
    };

    // Cache metrics
    const cacheEvents = events.filter(e => e.data.cacheOperation);
    const cacheMetrics = {
      hitRate: this.calculateAverageFromEvents(cacheEvents, 'hitRate'),
      missRate: this.calculateAverageFromEvents(cacheEvents, 'missRate'),
      averageSize: this.calculateAverageFromEvents(cacheEvents, 'cacheSize'),
      evictionRate: this.calculateAverageFromEvents(cacheEvents, 'evictionRate'),
    };

    // Worker metrics
    const workerEvents = events.filter(e => e.data.workerOperation);
    const workerMetrics = {
      averageUtilization: this.calculateAverageFromEvents(workerEvents, 'utilization'),
      taskCompletionRate: this.calculateAverageFromEvents(workerEvents, 'completionRate'),
      averageQueueTime: this.calculateAverageFromEvents(workerEvents, 'queueTime'),
    };

    return {
      processingMetrics,
      apiMetrics,
      cacheMetrics,
      workerMetrics,
    };
  }

  /**
   * Generate user behavior report
   */
  async getUserBehaviorReport(startDate: Date, endDate: Date): Promise<UserBehaviorReport> {
    const events = this.getEventsInRange(startDate, endDate);
    const sessions = await this.getSessionsInRange(startDate, endDate);

    // Verification patterns
    const verificationEvents = events.filter(e => 
      ['match_accepted', 'match_rejected', 'manual_search_performed'].includes(e.type)
    );
    
    const verificationPatterns = {
      averageTimePerMatch: this.calculateAverageVerificationTime(events),
      bulkActionUsage: events.filter(e => e.type === 'bulk_action_performed').length,
      manualSearchUsage: events.filter(e => e.type === 'manual_search_performed').length,
      filterUsage: events.filter(e => e.data.filterUsed).length,
    };

    // Session patterns
    const sessionPatterns = {
      averageSessionLength: this.calculateAverageSessionDuration(sessions),
      pauseResumeFrequency: events.filter(e => e.type === 'session_paused').length,
      abandonmentRate: this.calculateAbandonmentRate(sessions),
      completionTimeDistribution: this.calculateCompletionTimeDistribution(sessions),
    };

    // Error recovery
    const errorEvents = events.filter(e => e.type === 'error_occurred');
    const errorRecovery = {
      errorEncounterRate: errorEvents.length / Math.max(sessions.length, 1),
      recoverySuccessRate: this.calculateRecoverySuccessRate(events),
      commonErrorTypes: this.getCommonErrorTypes(errorEvents),
    };

    return {
      verificationPatterns,
      sessionPatterns,
      errorRecovery,
    };
  }

  // Helper methods
  private getStoredEvents(): AnalyticsEvent[] {
    try {
      const stored = localStorage.getItem('pinbridge_analytics_events');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private getEventsInRange(startDate: Date, endDate: Date): AnalyticsEvent[] {
    const events = this.getStoredEvents();
    return events.filter(e => {
      const eventDate = new Date(e.timestamp);
      return eventDate >= startDate && eventDate <= endDate;
    });
  }

  private async getSessionsInRange(startDate: Date, endDate: Date): Promise<TransferPackSession[]> {
    return db.transferPackSessions
      .filter(session => {
        const sessionDate = new Date(session.createdAt);
        return sessionDate >= startDate && sessionDate <= endDate;
      })
      .toArray();
  }

  private async getMatchesInRange(startDate: Date, endDate: Date): Promise<PlaceMatchRecord[]> {
    const sessions = await this.getSessionsInRange(startDate, endDate);
    const sessionIds = sessions.map(s => s.id);
    
    return db.placeMatchRecords
      .filter(match => sessionIds.includes(match.sessionId))
      .toArray();
  }

  private calculateAverageSessionDuration(sessions: TransferPackSession[]): number {
    if (sessions.length === 0) return 0;
    
    const durations = sessions
      .filter(s => s.processingTimeMs > 0)
      .map(s => s.processingTimeMs);
    
    return durations.length > 0 ? durations.reduce((sum, d) => sum + d, 0) / durations.length : 0;
  }

  private calculateAverageFromEvents(events: AnalyticsEvent[], field: string): number {
    const values = events
      .map(e => e.data[field])
      .filter(v => typeof v === 'number');
    
    return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
  }

  private calculateErrorRate(events: AnalyticsEvent[]): number {
    const totalEvents = events.length;
    const errorEvents = events.filter(e => e.type === 'error_occurred').length;
    return totalEvents > 0 ? (errorEvents / totalEvents) * 100 : 0;
  }

  private calculateAverageVerificationTime(events: AnalyticsEvent[]): number {
    const verificationEvents = events.filter(e => 
      ['match_accepted', 'match_rejected'].includes(e.type) && e.data.verificationTime
    );
    
    return this.calculateAverageFromEvents(verificationEvents, 'verificationTime');
  }

  private async calculateTrends(
    currentPeriod: { startDate: Date; endDate: Date },
    previousPeriod: { startDate: Date; endDate: Date }
  ) {
    const currentInsights = await this.getUsageInsights(currentPeriod.startDate, currentPeriod.endDate);
    const previousInsights = await this.getUsageInsights(previousPeriod.startDate, previousPeriod.endDate);

    return {
      sessionsChange: this.calculatePercentageChange(previousInsights.totalSessions, currentInsights.totalSessions),
      accuracyChange: this.calculatePercentageChange(previousInsights.matchAccuracyRate, currentInsights.matchAccuracyRate),
      performanceChange: this.calculatePercentageChange(previousInsights.averageProcessingTime, currentInsights.averageProcessingTime),
    };
  }

  private calculatePercentageChange(oldValue: number, newValue: number): number {
    if (oldValue === 0) return newValue > 0 ? 100 : 0;
    return ((newValue - oldValue) / oldValue) * 100;
  }

  private calculateAccuracyForMatches(matches: PlaceMatchRecord[]) {
    const total = matches.length;
    const accepted = matches.filter(m => m.verificationStatus === 'accepted').length;
    const accuracy = total > 0 ? (accepted / total) * 100 : 0;
    
    return { total, accepted, accuracy };
  }

  private async groupSessionsByService(sessions: TransferPackSession[]) {
    const apple: string[] = [];
    const google: string[] = [];

    for (const session of sessions) {
      const pack = await db.transferPacks.get(session.packId);
      if (pack?.target === 'apple') {
        apple.push(session.id);
      } else if (pack?.target === 'google') {
        google.push(session.id);
      }
    }

    return { apple, google };
  }

  private calculateAccuracyByCategory(matches: PlaceMatchRecord[]) {
    const categoryMap = new Map<string, { total: number; accepted: number }>();

    matches.forEach(match => {
      try {
        const targetData = JSON.parse(match.targetPlaceData);
        const category = targetData.category || 'Unknown';
        
        if (!categoryMap.has(category)) {
          categoryMap.set(category, { total: 0, accepted: 0 });
        }
        
        const stats = categoryMap.get(category)!;
        stats.total++;
        if (match.verificationStatus === 'accepted') {
          stats.accepted++;
        }
      } catch {
        // Skip invalid data
      }
    });

    return Array.from(categoryMap.entries()).map(([category, stats]) => ({
      category,
      total: stats.total,
      accepted: stats.accepted,
      accuracy: stats.total > 0 ? (stats.accepted / stats.total) * 100 : 0,
    }));
  }

  private calculateConfidenceCalibration(matches: PlaceMatchRecord[]) {
    const ranges = [
      [0, 20], [20, 40], [40, 60], [60, 70], [70, 80], [80, 90], [90, 100]
    ];

    return ranges.map(([min, max]) => {
      const rangeMatches = matches.filter(m => 
        m.confidenceScore >= min && m.confidenceScore < max
      );
      
      const predictedAccuracy = (min + max) / 2;
      const actualAccuracy = rangeMatches.length > 0 ? 
        (rangeMatches.filter(m => m.verificationStatus === 'accepted').length / rangeMatches.length) * 100 : 0;
      
      return {
        confidenceRange: [min, max] as [number, number],
        predictedAccuracy,
        actualAccuracy,
        calibrationError: Math.abs(predictedAccuracy - actualAccuracy),
      };
    });
  }

  private calculateAverage(values: number[]): number {
    return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
  }

  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    return sorted.length % 2 === 0 ? 
      (sorted[mid - 1] + sorted[mid]) / 2 : 
      sorted[mid];
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    
    return sorted[Math.max(0, index)];
  }

  private calculateTimeByBatchSize(events: AnalyticsEvent[]) {
    const batchSizeMap = new Map<number, number[]>();
    
    events.forEach(event => {
      const batchSize = event.data.batchSize;
      const processingTime = event.data.processingTimePerPlace;
      
      if (typeof batchSize === 'number' && typeof processingTime === 'number') {
        if (!batchSizeMap.has(batchSize)) {
          batchSizeMap.set(batchSize, []);
        }
        batchSizeMap.get(batchSize)!.push(processingTime);
      }
    });

    return Array.from(batchSizeMap.entries()).map(([batchSize, times]) => ({
      batchSize,
      averageTime: this.calculateAverage(times),
    }));
  }

  private calculateAbandonmentRate(sessions: TransferPackSession[]): number {
    if (sessions.length === 0) return 0;
    
    const abandonedSessions = sessions.filter(s => 
      s.status === 'paused' || (s.status === 'processing' && s.processedPlaces < s.totalPlaces)
    ).length;
    
    return (abandonedSessions / sessions.length) * 100;
  }

  private calculateCompletionTimeDistribution(sessions: TransferPackSession[]): number[] {
    const completedSessions = sessions.filter(s => s.status === 'completed');
    return completedSessions.map(s => s.processingTimeMs);
  }

  private calculateRecoverySuccessRate(events: AnalyticsEvent[]): number {
    const errorEvents = events.filter(e => e.type === 'error_occurred');
    const recoveryEvents = events.filter(e => e.data.errorRecovery);
    
    return errorEvents.length > 0 ? (recoveryEvents.length / errorEvents.length) * 100 : 0;
  }

  private getCommonErrorTypes(errorEvents: AnalyticsEvent[]) {
    const errorTypeMap = new Map<string, number>();
    
    errorEvents.forEach(event => {
      const errorType = event.data.errorType || 'Unknown';
      errorTypeMap.set(errorType, (errorTypeMap.get(errorType) || 0) + 1);
    });

    return Array.from(errorTypeMap.entries())
      .map(([type, frequency]) => ({ type, frequency }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10); // Top 10 error types
  }
}

export const analyticsService = new AnalyticsService();