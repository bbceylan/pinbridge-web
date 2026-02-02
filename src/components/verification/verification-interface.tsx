'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { MatchComparison } from './match-comparison';
import { BulkActions } from './bulk-actions';
import { VerificationProgress } from './verification-progress';
import { transferSessionService } from '@/lib/services/transfer-session';
import { transferExecutionEngine } from '@/lib/services/transfer-execution-engine';
import { 
  Search, 
  Filter, 
  CheckCircle, 
  AlertCircle, 
  XCircle, 
  Clock,
  ArrowUpDown,
  Play,
  ExternalLink
} from 'lucide-react';
import type { 
  TransferPackSession, 
  PlaceMatchRecord, 
  TransferPack,
  VerificationStatus,
  ConfidenceLevel 
} from '@/types';

interface VerificationInterfaceProps {
  session: TransferPackSession;
  matches: PlaceMatchRecord[];
  transferPack: TransferPack;
  onProcessingResume?: () => Promise<void>;
}

type SortOption = 'confidence' | 'name' | 'status' | 'created';
type SortDirection = 'asc' | 'desc';

interface FilterOptions {
  status: VerificationStatus | 'all';
  confidence: ConfidenceLevel | 'all';
  search: string;
}

export function VerificationInterface({ 
  session, 
  matches, 
  transferPack,
  onProcessingResume 
}: VerificationInterfaceProps) {
  // State management
  const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterOptions>({
    status: 'all',
    confidence: 'all',
    search: ''
  });
  const [sortBy, setSortBy] = useState<SortOption>('confidence');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [executionLoading, setExecutionLoading] = useState(false);

  // Calculate progress statistics
  const progressStats = useMemo(() => {
    const total = matches.length;
    const pending = matches.filter(m => m.verificationStatus === 'pending').length;
    const accepted = matches.filter(m => m.verificationStatus === 'accepted').length;
    const rejected = matches.filter(m => m.verificationStatus === 'rejected').length;
    const manual = matches.filter(m => m.verificationStatus === 'manual').length;
    
    const highConfidence = matches.filter(m => m.confidenceLevel === 'high').length;
    const mediumConfidence = matches.filter(m => m.confidenceLevel === 'medium').length;
    const lowConfidence = matches.filter(m => m.confidenceLevel === 'low').length;

    return {
      total,
      pending,
      accepted,
      rejected,
      manual,
      completed: accepted + rejected + manual,
      highConfidence,
      mediumConfidence,
      lowConfidence
    };
  }, [matches]);

  // Filter and sort matches
  const filteredAndSortedMatches = useMemo(() => {
    let filtered = matches;

    // Apply filters
    if (filters.status !== 'all') {
      filtered = filtered.filter(m => m.verificationStatus === filters.status);
    }

    if (filters.confidence !== 'all') {
      filtered = filtered.filter(m => m.confidenceLevel === filters.confidence);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(m => {
        const targetData = JSON.parse(m.targetPlaceData);
        return targetData.name?.toLowerCase().includes(searchLower) ||
               targetData.address?.toLowerCase().includes(searchLower);
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'confidence':
          comparison = a.confidenceScore - b.confidenceScore;
          break;
        case 'name':
          const aData = JSON.parse(a.targetPlaceData);
          const bData = JSON.parse(b.targetPlaceData);
          comparison = (aData.name || '').localeCompare(bData.name || '');
          break;
        case 'status':
          const statusOrder = { pending: 0, accepted: 1, rejected: 2, manual: 3 };
          comparison = statusOrder[a.verificationStatus] - statusOrder[b.verificationStatus];
          break;
        case 'created':
          comparison = new Date(a.verifiedAt || 0).getTime() - new Date(b.verifiedAt || 0).getTime();
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [matches, filters, sortBy, sortDirection]);

  // Handle bulk actions
  const handleBulkAction = async (action: 'accept' | 'reject', matchIds: string[]) => {
    setBulkActionLoading(true);
    try {
      const status: VerificationStatus = action === 'accept' ? 'accepted' : 'rejected';
      await transferSessionService.bulkUpdateMatchRecords(matchIds, {
        verificationStatus: status
      });
      setSelectedMatches(new Set());
    } catch (error) {
      console.error('Bulk action failed:', error);
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Handle individual match actions
  const handleMatchAction = async (
    matchId: string, 
    action: 'accept' | 'reject' | 'manual',
    notes?: string
  ) => {
    try {
      const status: VerificationStatus = action === 'manual' ? 'manual' : 
                                        action === 'accept' ? 'accepted' : 'rejected';
      await transferSessionService.updateMatchVerification(matchId, status, 'user', notes);
    } catch (error) {
      console.error('Match action failed:', error);
    }
  };

  // Handle selection changes
  const handleSelectMatch = (matchId: string, selected: boolean) => {
    const newSelection = new Set(selectedMatches);
    if (selected) {
      newSelection.add(matchId);
    } else {
      newSelection.delete(matchId);
    }
    setSelectedMatches(newSelection);
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedMatches(new Set(filteredAndSortedMatches.map(m => m.id)));
    } else {
      setSelectedMatches(new Set());
    }
  };

  // Quick actions for high confidence matches
  const handleAcceptHighConfidence = async () => {
    const highConfidenceMatches = matches
      .filter(m => m.confidenceLevel === 'high' && m.verificationStatus === 'pending')
      .map(m => m.id);
    
    if (highConfidenceMatches.length > 0) {
      await handleBulkAction('accept', highConfidenceMatches);
    }
  };

  // Handle transfer execution
  const handleCompleteTransfer = async () => {
    setExecutionLoading(true);
    try {
      const result = await transferExecutionEngine.executeTransfers(session.id, {
        openInBrowser: true,
        batchSize: 5,
        delayBetweenBatches: 2000,
      });

      if (result.success) {
        // Show success message or redirect
        console.log(`Transfer completed! ${result.successfulTransfers} places transferred.`);
      } else {
        console.error('Transfer completed with errors:', result.errors);
      }
    } catch (error) {
      console.error('Transfer execution failed:', error);
    } finally {
      setExecutionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <VerificationProgress 
        stats={progressStats}
        onAcceptHighConfidence={handleAcceptHighConfidence}
        onProcessingResume={onProcessingResume}
        hasUnprocessedPlaces={session.processedPlaces < session.totalPlaces}
      />

      {/* Filters and Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Review Matches</CardTitle>
            <div className="flex items-center space-x-2">
              <Badge variant="outline">
                {filteredAndSortedMatches.length} of {matches.length} matches
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search places..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>

            <Select 
              value={filters.status} 
              onValueChange={(value) => setFilters(prev => ({ ...prev, status: value as VerificationStatus | 'all' }))}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>

            <Select 
              value={filters.confidence} 
              onValueChange={(value) => setFilters(prev => ({ ...prev, confidence: value as ConfidenceLevel | 'all' }))}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Confidence" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Confidence</SelectItem>
                <SelectItem value="high">High (90%+)</SelectItem>
                <SelectItem value="medium">Medium (70-89%)</SelectItem>
                <SelectItem value="low">Low (&lt;70%)</SelectItem>
              </SelectContent>
            </Select>

            <Select 
              value={`${sortBy}-${sortDirection}`} 
              onValueChange={(value) => {
                const [sort, direction] = value.split('-');
                setSortBy(sort as SortOption);
                setSortDirection(direction as SortDirection);
              }}
            >
              <SelectTrigger className="w-48">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="confidence-desc">Confidence (High to Low)</SelectItem>
                <SelectItem value="confidence-asc">Confidence (Low to High)</SelectItem>
                <SelectItem value="name-asc">Name (A to Z)</SelectItem>
                <SelectItem value="name-desc">Name (Z to A)</SelectItem>
                <SelectItem value="status-asc">Status</SelectItem>
                <SelectItem value="created-desc">Recently Updated</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bulk Actions */}
          {selectedMatches.size > 0 && (
            <BulkActions
              selectedCount={selectedMatches.size}
              onAccept={() => handleBulkAction('accept', Array.from(selectedMatches))}
              onReject={() => handleBulkAction('reject', Array.from(selectedMatches))}
              onClear={() => setSelectedMatches(new Set())}
              loading={bulkActionLoading}
            />
          )}

          {/* Select All */}
          <div className="flex items-center space-x-2 py-2 border-b">
            <Checkbox
              checked={selectedMatches.size === filteredAndSortedMatches.length && filteredAndSortedMatches.length > 0}
              onCheckedChange={handleSelectAll}
            />
            <span className="text-sm text-gray-600">
              Select all {filteredAndSortedMatches.length} matches
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Match List */}
      <div className="space-y-4">
        {filteredAndSortedMatches.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Filter className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No matches found</h3>
                <p className="text-gray-600">
                  Try adjusting your filters or search terms to see more results.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredAndSortedMatches.map((match) => (
            <MatchComparison
              key={match.id}
              match={match}
              transferPack={transferPack}
              isSelected={selectedMatches.has(match.id)}
              isExpanded={expandedMatch === match.id}
              onSelect={(selected) => handleSelectMatch(match.id, selected)}
              onExpand={() => setExpandedMatch(expandedMatch === match.id ? null : match.id)}
              onAction={(action, notes) => handleMatchAction(match.id, action, notes)}
            />
          ))
        )}
      </div>

      {/* Completion Actions */}
      {progressStats.pending === 0 && progressStats.total > 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-6 w-6 text-green-600" />
                <div>
                  <h3 className="font-medium text-green-900">Verification Complete!</h3>
                  <p className="text-sm text-green-700">
                    All matches have been reviewed. Ready to complete the transfer.
                  </p>
                </div>
              </div>
              <Button 
                className="bg-green-600 hover:bg-green-700"
                onClick={handleCompleteTransfer}
                disabled={executionLoading}
              >
                {executionLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Executing...
                  </>
                ) : (
                  <>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Complete Transfer
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}