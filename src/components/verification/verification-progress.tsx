'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Target,
  Play,
  TrendingUp
} from 'lucide-react';

interface ProgressStats {
  total: number;
  pending: number;
  accepted: number;
  rejected: number;
  manual: number;
  completed: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
}

interface VerificationProgressProps {
  stats: ProgressStats;
  onAcceptHighConfidence: () => Promise<void>;
  onProcessingResume?: () => Promise<void>;
  hasUnprocessedPlaces: boolean;
}

export function VerificationProgress({ 
  stats, 
  onAcceptHighConfidence,
  onProcessingResume,
  hasUnprocessedPlaces 
}: VerificationProgressProps) {
  const completionPercentage = stats.total > 0 
    ? Math.round((stats.completed / stats.total) * 100) 
    : 0;

  const highConfidencePending = stats.highConfidence - 
    (stats.accepted + stats.rejected + stats.manual);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Overall Progress */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5 text-blue-600" />
            <span>Verification Progress</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Overall Completion</span>
              <span className="text-2xl font-bold text-blue-600">{completionPercentage}%</span>
            </div>
            <Progress value={completionPercentage} className="h-3" />
            <div className="flex justify-between text-xs text-gray-500">
              <span>{stats.completed} of {stats.total} verified</span>
              <span>{stats.pending} remaining</span>
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-1" />
              <div className="text-lg font-semibold text-green-700">{stats.accepted}</div>
              <div className="text-xs text-green-600">Accepted</div>
            </div>

            <div className="text-center p-3 bg-red-50 rounded-lg">
              <XCircle className="h-6 w-6 text-red-600 mx-auto mb-1" />
              <div className="text-lg font-semibold text-red-700">{stats.rejected}</div>
              <div className="text-xs text-red-600">Rejected</div>
            </div>

            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-blue-600 mx-auto mb-1" />
              <div className="text-lg font-semibold text-blue-700">{stats.manual}</div>
              <div className="text-xs text-blue-600">Manual</div>
            </div>

            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <Clock className="h-6 w-6 text-yellow-600 mx-auto mb-1" />
              <div className="text-lg font-semibold text-yellow-700">{stats.pending}</div>
              <div className="text-xs text-yellow-600">Pending</div>
            </div>
          </div>

          {/* Confidence Level Breakdown */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Confidence Levels</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm">High Confidence (90%+)</span>
                </div>
                <Badge variant="secondary">{stats.highConfidence}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <span className="text-sm">Medium Confidence (70-89%)</span>
                </div>
                <Badge variant="secondary">{stats.mediumConfidence}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-sm">Low Confidence (&lt;70%)</span>
                </div>
                <Badge variant="secondary">{stats.lowConfidence}</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-purple-600" />
            <span>Quick Actions</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Accept High Confidence */}
          {highConfidencePending > 0 && (
            <div className="space-y-2">
              <Button 
                onClick={onAcceptHighConfidence}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Accept {highConfidencePending} High Confidence
              </Button>
              <p className="text-xs text-gray-600">
                Automatically accept matches with 90%+ confidence
              </p>
            </div>
          )}

          {/* Resume Processing */}
          {hasUnprocessedPlaces && onProcessingResume && (
            <div className="space-y-2">
              <Button 
                onClick={onProcessingResume}
                variant="outline"
                className="w-full"
              >
                <Play className="h-4 w-4 mr-2" />
                Resume Processing
              </Button>
              <p className="text-xs text-gray-600">
                Continue processing remaining places
              </p>
            </div>
          )}

          {/* Tips */}
          <div className="pt-4 border-t">
            <h4 className="font-medium text-gray-900 mb-2">Tips</h4>
            <div className="space-y-2 text-xs text-gray-600">
              <p>• Review medium confidence matches carefully</p>
              <p>• Use manual search for low confidence matches</p>
              <p>• Bulk actions save time on similar matches</p>
              <p>• You can pause and resume anytime</p>
            </div>
          </div>

          {/* Progress Insights */}
          {stats.total > 0 && (
            <div className="pt-4 border-t">
              <h4 className="font-medium text-gray-900 mb-2">Insights</h4>
              <div className="space-y-1 text-xs text-gray-600">
                <p>
                  Match Quality: {Math.round((stats.highConfidence / stats.total) * 100)}% high confidence
                </p>
                <p>
                  Completion: {completionPercentage}% verified
                </p>
                {stats.accepted > 0 && (
                  <p>
                    Success Rate: {Math.round((stats.accepted / stats.completed) * 100)}% accepted
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}