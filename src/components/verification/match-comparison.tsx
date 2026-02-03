'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ManualSearch } from './manual-search';
import { transferSessionService } from '@/lib/services/transfer-session';
import { 
  CheckCircle, 
  XCircle, 
  Search, 
  ChevronDown, 
  ChevronRight,
  MapPin,
  Star,
  Clock,
  ExternalLink,
  AlertTriangle
} from 'lucide-react';
import type { PlaceMatchRecord, TransferPack, MatchFactor } from '@/types';
import type { NormalizedPlace } from '@/lib/services/api/response-normalizer';

interface MatchComparisonProps {
  match: PlaceMatchRecord;
  transferPack: TransferPack;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: (selected: boolean) => void;
  onExpand: () => void;
  onAction: (action: 'accept' | 'reject' | 'manual', notes?: string) => void;
}

export function MatchComparison({
  match,
  transferPack,
  isSelected,
  isExpanded,
  onSelect,
  onExpand,
  onAction
}: MatchComparisonProps) {
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [showManualSearch, setShowManualSearch] = useState(false);

  const safeParse = <T,>(value: string, fallback: T): T => {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  };

  // Parse match data safely
  const targetPlace = safeParse(match.targetPlaceData, {
    name: 'Unknown place',
    address: '',
    rating: null,
    latitude: null,
    longitude: null,
    category: '',
    website: '',
  } as any);
  const matchFactors: MatchFactor[] = safeParse(match.matchFactors, []);

  // Get confidence styling
  const getConfidenceStyle = (level: string) => {
    switch (level) {
      case 'high':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Get status styling
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'manual':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Handle manual search
  const handleManualSearchSelect = async (place: NormalizedPlace, searchNotes?: string) => {
    try {
      await transferSessionService.setManualSearchData(
        match.id,
        place.name,
        place
      );
      
      if (searchNotes) {
        await transferSessionService.updateMatchVerification(
          match.id,
          'manual',
          'user',
          searchNotes
        );
      }
    } catch (error) {
      console.error('Failed to save manual search:', error);
    }
  };

  // Handle manual search not found
  const handleManualSearchNotFound = async (searchNotes?: string) => {
    try {
      await transferSessionService.updateMatchVerification(
        match.id,
        'rejected',
        'user',
        searchNotes || 'Place not found in target service'
      );
    } catch (error) {
      console.error('Failed to mark as not found:', error);
    }
  };

  // Handle action with notes
  const handleActionWithNotes = (action: 'accept' | 'reject' | 'manual') => {
    if (action === 'manual') {
      setShowManualSearch(true);
    } else {
      onAction(action, notes || undefined);
      setNotes('');
      setShowNotes(false);
    }
  };

  return (
    <Card className={`transition-all duration-200 ${
      isSelected ? 'ring-2 ring-blue-500 border-blue-200' : ''
    } ${
      match.verificationStatus !== 'pending' ? 'opacity-75' : ''
    }`}>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Header Row */}
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              {/* Selection Checkbox */}
              <Checkbox
                checked={isSelected}
                onCheckedChange={onSelect}
                className="mt-1"
              />

              {/* Place Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <h3 className="font-medium text-gray-900 truncate">
                    {targetPlace.name}
                  </h3>
                  <Badge className={getConfidenceStyle(match.confidenceLevel)}>
                    {match.confidenceScore}% {match.confidenceLevel}
                  </Badge>
                  {match.verificationStatus !== 'pending' && (
                    <Badge className={getStatusStyle(match.verificationStatus)}>
                      {match.verificationStatus}
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <div className="flex items-center space-x-1">
                    <MapPin className="h-4 w-4" />
                    <span className="truncate">{targetPlace.address}</span>
                  </div>
                  {targetPlace.rating && (
                    <div className="flex items-center space-x-1">
                      <Star className="h-4 w-4 fill-current text-yellow-400" />
                      <span>{targetPlace.rating}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-2">
              {match.verificationStatus === 'pending' && (
                <>
                  <Button
                    size="sm"
                    onClick={() => handleActionWithNotes('accept')}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleActionWithNotes('reject')}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleActionWithNotes('manual')}
                  >
                    <Search className="h-4 w-4 mr-1" />
                    Manual
                  </Button>
                </>
              )}

              {/* Expand/Collapse */}
              <Button
                size="sm"
                variant="ghost"
                onClick={onExpand}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Expanded Details */}
          <Collapsible open={isExpanded}>
            <CollapsibleContent className="space-y-4">
              {/* Side-by-side Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Original Place */}
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900 flex items-center space-x-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span>Original Place</span>
                  </h4>
                  <div className="bg-blue-50 p-4 rounded-lg space-y-2">
                    <div>
                      <span className="text-sm font-medium text-blue-900">Name:</span>
                      <p className="text-blue-800">{targetPlace.name}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-blue-900">Address:</span>
                      <p className="text-blue-800">{targetPlace.address}</p>
                    </div>
                    {targetPlace.latitude && targetPlace.longitude && (
                      <div>
                        <span className="text-sm font-medium text-blue-900">Coordinates:</span>
                        <p className="text-blue-800 font-mono text-xs">
                          {targetPlace.latitude.toFixed(6)}, {targetPlace.longitude.toFixed(6)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Matched Place */}
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900 flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span>Matched Place ({transferPack.target === 'apple' ? 'Apple Maps' : 'Google Maps'})</span>
                  </h4>
                  <div className="bg-green-50 p-4 rounded-lg space-y-2">
                    <div>
                      <span className="text-sm font-medium text-green-900">Name:</span>
                      <p className="text-green-800">{targetPlace.name}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-green-900">Address:</span>
                      <p className="text-green-800">{targetPlace.address}</p>
                    </div>
                    {targetPlace.latitude && targetPlace.longitude && (
                      <div>
                        <span className="text-sm font-medium text-green-900">Coordinates:</span>
                        <p className="text-green-800 font-mono text-xs">
                          {targetPlace.latitude.toFixed(6)}, {targetPlace.longitude.toFixed(6)}
                        </p>
                      </div>
                    )}
                    {targetPlace.rating && (
                      <div>
                        <span className="text-sm font-medium text-green-900">Rating:</span>
                        <p className="text-green-800">{targetPlace.rating} stars</p>
                      </div>
                    )}
                    {targetPlace.category && (
                      <div>
                        <span className="text-sm font-medium text-green-900">Category:</span>
                        <p className="text-green-800">{targetPlace.category}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Match Factors */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">Match Analysis</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {matchFactors.map((factor, index) => (
                    <div key={index} className="bg-gray-50 p-3 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium capitalize text-gray-700">
                          {factor.type}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {factor.score}%
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-600">{factor.explanation}</p>
                      <div className="mt-2">
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div 
                            className={`h-1.5 rounded-full ${
                              factor.score >= 80 ? 'bg-green-500' :
                              factor.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${factor.score}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Additional Actions */}
              {match.verificationStatus === 'pending' && (
                <div className="flex items-center justify-between pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowNotes(!showNotes)}
                  >
                    Add Notes
                  </Button>

                  {targetPlace.website && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(targetPlace.website, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View in {transferPack.target === 'apple' ? 'Apple Maps' : 'Google Maps'}
                    </Button>
                  )}
                </div>
              )}

              {/* Notes Section */}
              {showNotes && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Add verification notes (optional):
                  </label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any notes about this match..."
                    rows={3}
                  />
                </div>
              )}

              {/* Verification History */}
              {match.verificationStatus !== 'pending' && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Verification History</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    <p>
                      Status: <span className="font-medium">{match.verificationStatus}</span>
                      {match.verifiedBy && (
                        <span> by {match.verifiedBy}</span>
                      )}
                    </p>
                    {match.verifiedAt && (
                      <p>
                        Date: {new Date(match.verifiedAt).toLocaleString()}
                      </p>
                    )}
                    {match.userNotes && (
                      <div className="mt-2">
                        <span className="font-medium">Notes:</span>
                        <p className="mt-1 p-2 bg-white rounded border text-gray-800">
                          {match.userNotes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Low Confidence Warning */}
              {match.confidenceLevel === 'low' && match.verificationStatus === 'pending' && (
                <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm font-medium text-yellow-800">Low Confidence Match</span>
                  </div>
                  <p className="text-sm text-yellow-700 mt-1">
                    This match has low confidence. Consider using manual search to find a better match 
                    or verify the details carefully before accepting.
                  </p>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </CardContent>

      {/* Manual Search Dialog */}
      <ManualSearch
        match={match}
        target={transferPack.target}
        isOpen={showManualSearch}
        onClose={() => setShowManualSearch(false)}
        onSelectPlace={handleManualSearchSelect}
        onMarkNotFound={handleManualSearchNotFound}
      />
    </Card>
  );
}
