'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AppleMapsService } from '@/lib/services/api/apple-maps';
import { GoogleMapsService } from '@/lib/services/api/google-maps';
import { ResponseNormalizer } from '@/lib/services/api/response-normalizer';
import { 
  Search, 
  MapPin, 
  Star, 
  ExternalLink, 
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import type { PlaceMatchRecord, TransferTarget } from '@/types';
import type { NormalizedPlace } from '@/lib/services/api/response-normalizer';

interface ManualSearchProps {
  match: PlaceMatchRecord;
  target: TransferTarget;
  isOpen: boolean;
  onClose: () => void;
  onSelectPlace: (place: NormalizedPlace, notes?: string) => void;
  onMarkNotFound: (notes?: string) => void;
}

export function ManualSearch({
  match,
  target,
  isOpen,
  onClose,
  onSelectPlace,
  onMarkNotFound
}: ManualSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NormalizedPlace[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<NormalizedPlace | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Initialize search query with original place name
  useEffect(() => {
    if (isOpen && match) {
      const targetData = JSON.parse(match.targetPlaceData);
      setSearchQuery(targetData.name || '');
      setSearchResults([]);
      setSelectedPlace(null);
      setNotes('');
      setError(null);
    }
  }, [isOpen, match]);

  // Perform search
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setError(null);

    try {
      let results: NormalizedPlace[] = [];

      if (target === 'apple') {
        const appleMapsService = new AppleMapsService();
        const rawResults = await appleMapsService.searchPlaces({
          name: searchQuery,
        });
        results = rawResults.map(place => ResponseNormalizer.normalizeAppleMapsPlace(place));
      } else {
        const googleMapsService = new GoogleMapsService();
        const rawResults = await googleMapsService.searchPlaces({
          name: searchQuery,
        });
        results = rawResults.map(place => ResponseNormalizer.normalizeGoogleMapsPlace(place));
      }

      setSearchResults(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle place selection
  const handleSelectPlace = (place: NormalizedPlace) => {
    setSelectedPlace(place);
  };

  // Confirm selection
  const handleConfirmSelection = () => {
    if (selectedPlace) {
      onSelectPlace(selectedPlace, notes || undefined);
      onClose();
    }
  };

  // Mark as not found
  const handleMarkNotFound = () => {
    onMarkNotFound(notes || undefined);
    onClose();
  };

  // Handle key press for search
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isSearching) {
      handleSearch();
    }
  };

  const originalPlace = JSON.parse(match.targetPlaceData);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manual Search</DialogTitle>
          <DialogDescription>
            Search for "{originalPlace.name}" in {target === 'apple' ? 'Apple Maps' : 'Google Maps'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Original Place Info */}
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-blue-900">
                Original Place
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <span className="text-sm font-medium text-blue-900">Name:</span>
                <p className="text-blue-800">{originalPlace.name}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-blue-900">Address:</span>
                <p className="text-blue-800">{originalPlace.address}</p>
              </div>
              {originalPlace.latitude && originalPlace.longitude && (
                <div>
                  <span className="text-sm font-medium text-blue-900">Location:</span>
                  <p className="text-blue-800 font-mono text-xs">
                    {originalPlace.latitude.toFixed(6)}, {originalPlace.longitude.toFixed(6)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Search Interface */}
          <div className="space-y-4">
            <div className="flex space-x-2">
              <div className="flex-1">
                <Input
                  placeholder={`Search in ${target === 'apple' ? 'Apple Maps' : 'Google Maps'}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                />
              </div>
              <Button 
                onClick={handleSearch} 
                disabled={isSearching || !searchQuery.trim()}
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Search
              </Button>
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                <div className="flex items-center space-x-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium text-red-800">Search Error</span>
                </div>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            )}

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-medium text-gray-900">
                  Search Results ({searchResults.length})
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {searchResults.map((place, index) => (
                    <Card 
                      key={index}
                      className={`cursor-pointer transition-all ${
                        selectedPlace?.id === place.id 
                          ? 'ring-2 ring-blue-500 border-blue-200 bg-blue-50' 
                          : 'hover:border-gray-300'
                      }`}
                      onClick={() => handleSelectPlace(place)}
                    >
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <h4 className="font-medium text-gray-900 truncate">
                                {place.name}
                              </h4>
                              {selectedPlace?.id === place.id && (
                                <CheckCircle className="h-4 w-4 text-blue-600" />
                              )}
                            </div>
                            
                            <div className="space-y-1 text-sm text-gray-600">
                              <div className="flex items-center space-x-1">
                                <MapPin className="h-3 w-3" />
                                <span className="truncate">{place.address}</span>
                              </div>
                              
                              <div className="flex items-center space-x-4">
                                {place.rating && (
                                  <div className="flex items-center space-x-1">
                                    <Star className="h-3 w-3 fill-current text-yellow-400" />
                                    <span>{place.rating}</span>
                                  </div>
                                )}
                                {place.category && (
                                  <Badge variant="outline" className="text-xs">
                                    {place.category}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>

                          {place.website && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(place.website, '_blank');
                              }}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* No Results */}
            {!isSearching && searchResults.length === 0 && searchQuery && (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
                <p className="text-gray-600 mb-4">
                  Try adjusting your search terms or check if the place exists in {target === 'apple' ? 'Apple Maps' : 'Google Maps'}.
                </p>
                <Button variant="outline" onClick={() => setSearchQuery('')}>
                  Clear Search
                </Button>
              </div>
            )}
          </div>

          {/* Notes Section */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Notes (optional):
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about your manual search or selection..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={handleMarkNotFound}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Mark as Not Found
            </Button>
          </div>

          <div className="flex space-x-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmSelection}
              disabled={!selectedPlace}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Use Selected Place
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}