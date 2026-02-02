'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { 
  Filter, 
  ChevronDown, 
  ChevronUp, 
  X, 
  Save, 
  Search,
  MapPin,
  Star,
  Clock,
  Tag
} from 'lucide-react';
import type { VerificationStatus, ConfidenceLevel } from '@/types';

export interface AdvancedFilterOptions {
  // Basic filters
  search: string;
  status: VerificationStatus | 'all';
  confidence: ConfidenceLevel | 'all';
  
  // Advanced filters
  confidenceRange: [number, number];
  hasCoordinates: boolean | null;
  hasAddress: boolean | null;
  hasRating: boolean | null;
  
  // Geographic filters
  distanceRange: [number, number]; // in kilometers
  
  // Temporal filters
  verifiedAfter: Date | null;
  verifiedBefore: Date | null;
  
  // Match quality filters
  nameMatchThreshold: number;
  addressMatchThreshold: number;
  
  // Category filters
  categories: string[];
  excludeCategories: string[];
}

interface AdvancedFiltersProps {
  filters: AdvancedFilterOptions;
  onFiltersChange: (filters: AdvancedFilterOptions) => void;
  availableCategories: string[];
  savedFilters: SavedFilter[];
  onSaveFilter: (name: string, filters: AdvancedFilterOptions) => void;
  onLoadFilter: (filter: SavedFilter) => void;
  onDeleteFilter: (filterId: string) => void;
}

interface SavedFilter {
  id: string;
  name: string;
  filters: AdvancedFilterOptions;
  createdAt: Date;
}

const DEFAULT_FILTERS: AdvancedFilterOptions = {
  search: '',
  status: 'all',
  confidence: 'all',
  confidenceRange: [0, 100],
  hasCoordinates: null,
  hasAddress: null,
  hasRating: null,
  distanceRange: [0, 50],
  verifiedAfter: null,
  verifiedBefore: null,
  nameMatchThreshold: 0,
  addressMatchThreshold: 0,
  categories: [],
  excludeCategories: [],
};

export function AdvancedFilters({
  filters,
  onFiltersChange,
  availableCategories,
  savedFilters,
  onSaveFilter,
  onLoadFilter,
  onDeleteFilter
}: AdvancedFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [saveFilterName, setSaveFilterName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const updateFilter = <K extends keyof AdvancedFilterOptions>(
    key: K,
    value: AdvancedFilterOptions[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const resetFilters = () => {
    onFiltersChange(DEFAULT_FILTERS);
  };

  const hasActiveFilters = () => {
    return (
      filters.search !== '' ||
      filters.status !== 'all' ||
      filters.confidence !== 'all' ||
      filters.confidenceRange[0] > 0 ||
      filters.confidenceRange[1] < 100 ||
      filters.hasCoordinates !== null ||
      filters.hasAddress !== null ||
      filters.hasRating !== null ||
      filters.distanceRange[0] > 0 ||
      filters.distanceRange[1] < 50 ||
      filters.verifiedAfter !== null ||
      filters.verifiedBefore !== null ||
      filters.nameMatchThreshold > 0 ||
      filters.addressMatchThreshold > 0 ||
      filters.categories.length > 0 ||
      filters.excludeCategories.length > 0
    );
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.search) count++;
    if (filters.status !== 'all') count++;
    if (filters.confidence !== 'all') count++;
    if (filters.confidenceRange[0] > 0 || filters.confidenceRange[1] < 100) count++;
    if (filters.hasCoordinates !== null) count++;
    if (filters.hasAddress !== null) count++;
    if (filters.hasRating !== null) count++;
    if (filters.distanceRange[0] > 0 || filters.distanceRange[1] < 50) count++;
    if (filters.verifiedAfter || filters.verifiedBefore) count++;
    if (filters.nameMatchThreshold > 0) count++;
    if (filters.addressMatchThreshold > 0) count++;
    if (filters.categories.length > 0) count++;
    if (filters.excludeCategories.length > 0) count++;
    return count;
  };

  const handleSaveFilter = () => {
    if (saveFilterName.trim()) {
      onSaveFilter(saveFilterName.trim(), filters);
      setSaveFilterName('');
      setShowSaveDialog(false);
    }
  };

  const toggleCategory = (category: string, isExclude = false) => {
    const targetArray = isExclude ? filters.excludeCategories : filters.categories;
    const otherArray = isExclude ? filters.categories : filters.excludeCategories;
    
    // Remove from other array if present
    const newOtherArray = otherArray.filter(c => c !== category);
    
    // Toggle in target array
    const newTargetArray = targetArray.includes(category)
      ? targetArray.filter(c => c !== category)
      : [...targetArray, category];
    
    if (isExclude) {
      onFiltersChange({
        ...filters,
        excludeCategories: newTargetArray,
        categories: newOtherArray
      });
    } else {
      onFiltersChange({
        ...filters,
        categories: newTargetArray,
        excludeCategories: newOtherArray
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Advanced Filters</span>
            {hasActiveFilters() && (
              <Badge variant="secondary" className="ml-2">
                {getActiveFilterCount()} active
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center space-x-2">
            {/* Saved Filters */}
            {savedFilters.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Save className="h-4 w-4 mr-2" />
                    Saved
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64">
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Saved Filters</h4>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {savedFilters.map((savedFilter) => (
                        <div key={savedFilter.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                          <button
                            onClick={() => onLoadFilter(savedFilter)}
                            className="text-sm text-left flex-1 hover:text-blue-600"
                          >
                            {savedFilter.name}
                          </button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => onDeleteFilter(savedFilter.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {/* Save Current Filter */}
            <Popover open={showSaveDialog} onOpenChange={setShowSaveDialog}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" disabled={!hasActiveFilters()}>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64">
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Save Filter</h4>
                  <Input
                    placeholder="Filter name..."
                    value={saveFilterName}
                    onChange={(e) => setSaveFilterName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSaveFilter()}
                  />
                  <div className="flex space-x-2">
                    <Button size="sm" onClick={handleSaveFilter} disabled={!saveFilterName.trim()}>
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowSaveDialog(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Reset Filters */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={resetFilters}
              disabled={!hasActiveFilters()}
            >
              <X className="h-4 w-4 mr-2" />
              Reset
            </Button>

            {/* Expand/Collapse */}
            <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </Collapsible>
          </div>
        </div>
      </CardHeader>

      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleContent>
          <CardContent className="space-y-6">
            {/* Basic Filters Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Search */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search places..."
                    value={filters.search}
                    onChange={(e) => updateFilter('search', e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Status</Label>
                <Select value={filters.status} onValueChange={(value) => updateFilter('status', value as VerificationStatus | 'all')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="accepted">Accepted</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Confidence Level */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Confidence Level</Label>
                <Select value={filters.confidence} onValueChange={(value) => updateFilter('confidence', value as ConfidenceLevel | 'all')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Confidence</SelectItem>
                    <SelectItem value="high">High (90%+)</SelectItem>
                    <SelectItem value="medium">Medium (70-89%)</SelectItem>
                    <SelectItem value="low">Low (&lt;70%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Confidence Range */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Confidence Score Range: {filters.confidenceRange[0]}% - {filters.confidenceRange[1]}%
              </Label>
              <Slider
                value={filters.confidenceRange}
                onValueChange={(value) => updateFilter('confidenceRange', value as [number, number])}
                max={100}
                min={0}
                step={5}
                className="w-full"
              />
            </div>

            {/* Data Quality Filters */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Data Quality</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="has-coordinates"
                    checked={filters.hasCoordinates === true}
                    onCheckedChange={(checked) => 
                      updateFilter('hasCoordinates', checked ? true : null)
                    }
                  />
                  <Label htmlFor="has-coordinates" className="text-sm flex items-center space-x-1">
                    <MapPin className="h-3 w-3" />
                    <span>Has Coordinates</span>
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="has-address"
                    checked={filters.hasAddress === true}
                    onCheckedChange={(checked) => 
                      updateFilter('hasAddress', checked ? true : null)
                    }
                  />
                  <Label htmlFor="has-address" className="text-sm">Has Address</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="has-rating"
                    checked={filters.hasRating === true}
                    onCheckedChange={(checked) => 
                      updateFilter('hasRating', checked ? true : null)
                    }
                  />
                  <Label htmlFor="has-rating" className="text-sm flex items-center space-x-1">
                    <Star className="h-3 w-3" />
                    <span>Has Rating</span>
                  </Label>
                </div>
              </div>
            </div>

            {/* Match Quality Thresholds */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Min Name Match: {filters.nameMatchThreshold}%
                </Label>
                <Slider
                  value={[filters.nameMatchThreshold]}
                  onValueChange={(value) => updateFilter('nameMatchThreshold', value[0])}
                  max={100}
                  min={0}
                  step={5}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Min Address Match: {filters.addressMatchThreshold}%
                </Label>
                <Slider
                  value={[filters.addressMatchThreshold]}
                  onValueChange={(value) => updateFilter('addressMatchThreshold', value[0])}
                  max={100}
                  min={0}
                  step={5}
                />
              </div>
            </div>

            {/* Distance Range */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Distance Range: {filters.distanceRange[0]}km - {filters.distanceRange[1]}km
              </Label>
              <Slider
                value={filters.distanceRange}
                onValueChange={(value) => updateFilter('distanceRange', value as [number, number])}
                max={50}
                min={0}
                step={1}
                className="w-full"
              />
            </div>

            {/* Categories */}
            {availableCategories.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Categories</Label>
                <div className="space-y-2">
                  <div className="text-xs text-gray-600">Include categories:</div>
                  <div className="flex flex-wrap gap-2">
                    {availableCategories.map((category) => (
                      <Badge
                        key={category}
                        variant={filters.categories.includes(category) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleCategory(category, false)}
                      >
                        <Tag className="h-3 w-3 mr-1" />
                        {category}
                      </Badge>
                    ))}
                  </div>
                  
                  <div className="text-xs text-gray-600 mt-3">Exclude categories:</div>
                  <div className="flex flex-wrap gap-2">
                    {availableCategories.map((category) => (
                      <Badge
                        key={`exclude-${category}`}
                        variant={filters.excludeCategories.includes(category) ? "destructive" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleCategory(category, true)}
                      >
                        <X className="h-3 w-3 mr-1" />
                        {category}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Temporal Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center space-x-1">
                  <Clock className="h-3 w-3" />
                  <span>Verified After</span>
                </Label>
                <Input
                  type="datetime-local"
                  value={filters.verifiedAfter?.toISOString().slice(0, 16) || ''}
                  onChange={(e) => 
                    updateFilter('verifiedAfter', e.target.value ? new Date(e.target.value) : null)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center space-x-1">
                  <Clock className="h-3 w-3" />
                  <span>Verified Before</span>
                </Label>
                <Input
                  type="datetime-local"
                  value={filters.verifiedBefore?.toISOString().slice(0, 16) || ''}
                  onChange={(e) => 
                    updateFilter('verifiedBefore', e.target.value ? new Date(e.target.value) : null)
                  }
                />
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}