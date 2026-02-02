'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Pause, 
  Play, 
  Clock, 
  MapPin, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Activity
} from 'lucide-react';
import type { ProcessingProgress } from '@/lib/services/batch-processing-engine';

interface ProcessingStatusProps {
  progress: ProcessingProgress | null;
  onPause: () => Promise<void>;
  onResume: () => Promise<void>;
  isProcessing: boolean;
}

export function ProcessingStatus({ 
  progress, 
  onPause, 
  onResume, 
  isProcessing 
}: ProcessingStatusProps) {
  const [actionLoading, setActionLoading] = useState(false);

  const handlePause = async () => {
    setActionLoading(true);
    try {
      await onPause();
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    setActionLoading(true);
    try {
      await onResume();
    } finally {
      setActionLoading(false);
    }
  };

  if (!progress) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Initializing processing...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const progressPercentage = progress.totalPlaces > 0 
    ? Math.round((progress.processedPlaces / progress.totalPlaces) * 100)
    : 0;

  const formatTime = (ms: number) => {
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.round((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const formatRate = (rate: number) => {
    if (rate < 1) return `${(rate * 60).toFixed(1)}/min`;
    return `${rate.toFixed(1)}/sec`;
  };

  return (
    <div className="space-y-6">
      {/* Main Progress Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5 text-blue-600" />
              <span>Processing Places</span>
            </CardTitle>
            <div className="flex items-center space-x-2">
              {progress.status === 'paused' ? (
                <Button 
                  onClick={handleResume} 
                  disabled={actionLoading}
                  size="sm"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Resume
                </Button>
              ) : (
                <Button 
                  onClick={handlePause} 
                  disabled={actionLoading}
                  variant="outline"
                  size="sm"
                >
                  <Pause className="h-4 w-4 mr-2" />
                  Pause
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Overall Progress</span>
              <span className="font-medium">{progressPercentage}%</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
            <div className="flex justify-between text-xs text-gray-500">
              <span>{progress.processedPlaces} of {progress.totalPlaces} places</span>
              <span>Batch {progress.currentBatch} of {progress.totalBatches}</span>
            </div>
          </div>

          {/* Current Operation */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <div className="animate-pulse h-2 w-2 bg-blue-600 rounded-full"></div>
              <span className="font-medium text-blue-900">Current Operation</span>
            </div>
            <p className="text-blue-800 text-sm">{progress.currentOperation}</p>
          </div>

          {/* Statistics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-1" />
              <div className="text-lg font-semibold text-green-700">
                {progress.successfulMatches}
              </div>
              <div className="text-xs text-green-600">Successful</div>
            </div>

            <div className="text-center p-3 bg-red-50 rounded-lg">
              <XCircle className="h-6 w-6 text-red-600 mx-auto mb-1" />
              <div className="text-lg font-semibold text-red-700">
                {progress.failedMatches}
              </div>
              <div className="text-xs text-red-600">Failed</div>
            </div>

            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <MapPin className="h-6 w-6 text-blue-600 mx-auto mb-1" />
              <div className="text-lg font-semibold text-blue-700">
                {progress.apiCallsUsed}
              </div>
              <div className="text-xs text-blue-600">API Calls</div>
            </div>

            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <Clock className="h-6 w-6 text-purple-600 mx-auto mb-1" />
              <div className="text-lg font-semibold text-purple-700">
                {formatRate(progress.processingRate)}
              </div>
              <div className="text-xs text-purple-600">Processing Rate</div>
            </div>
          </div>

          {/* Time Estimates */}
          {progress.estimatedTimeRemaining && (
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-gray-600" />
                <span className="text-sm text-gray-700">Estimated time remaining:</span>
              </div>
              <Badge variant="secondary">
                {formatTime(progress.estimatedTimeRemaining)}
              </Badge>
            </div>
          )}

          {/* Status Messages */}
          {progress.status === 'paused' && (
            <div className="flex items-center space-x-2 p-3 bg-yellow-50 rounded-lg">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <span className="text-sm text-yellow-800">
                Processing is paused. Click Resume to continue.
              </span>
            </div>
          )}

          {progress.errorCount > 0 && (
            <div className="flex items-center space-x-2 p-3 bg-red-50 rounded-lg">
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm text-red-800">
                {progress.errorCount} error{progress.errorCount !== 1 ? 's' : ''} encountered during processing
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Processing Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-gray-700">
            Processing Tips
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-gray-600">
            <p>• Processing runs in the background - you can safely navigate away from this page</p>
            <p>• High-confidence matches will be automatically flagged for quick verification</p>
            <p>• Places that can't be matched will be available for manual search</p>
            <p>• You can pause processing at any time and resume later</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}