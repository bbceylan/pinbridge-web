'use client';

import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { linkListService, type LinkListCreationData } from '@/lib/services/link-list';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { MapPin, Folder as CollectionIcon, Plus } from 'lucide-react';
import type { Place, Collection } from '@/types';

export interface LinkListCreatorProps {
  onLinkListCreated?: (linkListId: string) => void;
  onCancel?: () => void;
}

export function LinkListCreator({ onLinkListCreated, onCancel }: LinkListCreatorProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPlaceIds, setSelectedPlaceIds] = useState<Set<string>>(new Set());
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load data from database
  const places = useLiveQuery(() => db.places.orderBy('title').toArray(), []);
  const collections = useLiveQuery(() => db.collections.orderBy('name').toArray(), []);
  const placeCollections = useLiveQuery(() => db.placeCollections.toArray(), []);

  // Calculate selected places including those from collections
  const effectivePlaces = useMemo(() => {
    if (!places || !placeCollections) return [];

    const selectedPlaces = places.filter(place => selectedPlaceIds.has(place.id));
    
    // Add places from selected collections
    const collectionPlaceIds = new Set<string>();
    for (const collectionId of Array.from(selectedCollectionIds)) {
      const collectionPlaces = placeCollections
        .filter(pc => pc.collectionId === collectionId)
        .map(pc => pc.placeId);
      
      collectionPlaces.forEach(placeId => collectionPlaceIds.add(placeId));
    }

    const collectionPlaces = places.filter(place => collectionPlaceIds.has(place.id));
    
    // Merge and deduplicate
    const allPlaces = [...selectedPlaces];
    for (const place of collectionPlaces) {
      if (!selectedPlaces.some(p => p.id === place.id)) {
        allPlaces.push(place);
      }
    }

    return allPlaces.sort((a, b) => a.title.localeCompare(b.title));
  }, [places, placeCollections, selectedPlaceIds, selectedCollectionIds]);

  // Helper function to check if a place is included via collection selection
  const isPlaceIncludedViaCollection = useMemo(() => {
    if (!placeCollections) return new Set<string>();
    
    const collectionPlaceIds = new Set<string>();
    for (const collectionId of Array.from(selectedCollectionIds)) {
      const collectionPlaces = placeCollections
        .filter(pc => pc.collectionId === collectionId)
        .map(pc => pc.placeId);
      
      collectionPlaces.forEach(placeId => collectionPlaceIds.add(placeId));
    }
    
    return collectionPlaceIds;
  }, [placeCollections, selectedCollectionIds]);

  // Helper function to get collection names for a place
  const getCollectionNamesForPlace = useMemo(() => {
    if (!collections || !placeCollections) return new Map<string, string[]>();
    
    const placeToCollections = new Map<string, string[]>();
    
    for (const place of places || []) {
      const placeCollectionIds = placeCollections
        .filter(pc => pc.placeId === place.id)
        .map(pc => pc.collectionId);
      
      const collectionNames = collections
        .filter(c => placeCollectionIds.includes(c.id))
        .map(c => c.name);
      
      placeToCollections.set(place.id, collectionNames);
    }
    
    return placeToCollections;
  }, [places, collections, placeCollections]);

  // Generate default title based on selections
  const defaultTitle = useMemo(() => {
    if (!collections) return '';

    const selectedCollections = collections.filter(c => selectedCollectionIds.has(c.id));
    
    if (selectedCollections.length === 1) {
      return selectedCollections[0].name;
    } else if (selectedCollections.length === 2) {
      return `${selectedCollections[0].name} & ${selectedCollections[1].name}`;
    } else if (selectedCollections.length === 3) {
      return `${selectedCollections[0].name}, ${selectedCollections[1].name} & ${selectedCollections[2].name}`;
    } else if (selectedCollections.length > 3) {
      return `${selectedCollections[0].name}, ${selectedCollections[1].name} & ${selectedCollections.length - 2} more`;
    } else if (effectivePlaces.length > 0) {
      return `${effectivePlaces.length} Selected Places`;
    }
    
    return '';
  }, [collections, selectedCollectionIds, effectivePlaces.length]);

  const handlePlaceToggle = (placeId: string) => {
    const newSelected = new Set(selectedPlaceIds);
    if (newSelected.has(placeId)) {
      newSelected.delete(placeId);
    } else {
      newSelected.add(placeId);
    }
    setSelectedPlaceIds(newSelected);
  };

  const handleCollectionToggle = (collectionId: string) => {
    const newSelected = new Set(selectedCollectionIds);
    if (newSelected.has(collectionId)) {
      newSelected.delete(collectionId);
    } else {
      newSelected.add(collectionId);
    }
    setSelectedCollectionIds(newSelected);
  };

  // Helper function to get place count for a collection
  const getCollectionPlaceCount = (collectionId: string): number => {
    if (!placeCollections) return 0;
    return placeCollections.filter(pc => pc.collectionId === collectionId).length;
  };

  const handleCreate = async () => {
    if (effectivePlaces.length === 0) {
      setError('Please select at least one place or collection');
      return;
    }

    if (!title.trim()) {
      setError('Please enter a title for your link list');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const selectedPlaces = places?.filter(place => selectedPlaceIds.has(place.id)) || [];
      const selectedCollections = collections?.filter(c => selectedCollectionIds.has(c.id)) || [];

      const creationData: LinkListCreationData = {
        title: title.trim(),
        description: description.trim() || undefined,
        selectedPlaces,
        selectedCollections,
      };

      const linkList = await linkListService.createLinkList(creationData);
      onLinkListCreated?.(linkList.id);
    } catch (error) {
      console.error('Failed to create link list:', error);
      setError('Failed to create link list. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const isValid = effectivePlaces.length > 0 && title.trim().length > 0;

  return (
    <div className="space-y-6">
      {/* Title and Description */}
      <Card>
        <CardHeader>
          <CardTitle>Link List Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
              placeholder={defaultTitle || 'Enter a title for your link list'}
              className="mt-1"
            />
          </div>
          
          <div>
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
              placeholder="Add a description for your link list"
              className="mt-1"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Collection Selection */}
      {collections && collections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CollectionIcon className="w-5 h-5" />
              Collections
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {collections.map((collection) => {
                const placeCount = getCollectionPlaceCount(collection.id);
                return (
                  <div key={collection.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent">
                    <Checkbox
                      id={`collection-${collection.id}`}
                      checked={selectedCollectionIds.has(collection.id)}
                      onCheckedChange={() => handleCollectionToggle(collection.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <Label 
                        htmlFor={`collection-${collection.id}`}
                        className="font-medium cursor-pointer"
                      >
                        {collection.name}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {placeCount} place{placeCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Individual Place Selection */}
      {places && places.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Individual Places
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {places.map((place) => {
                const isIncludedViaCollection = isPlaceIncludedViaCollection.has(place.id);
                const isIndividuallySelected = selectedPlaceIds.has(place.id);
                const collectionNames = getCollectionNamesForPlace.get(place.id) || [];
                const selectedCollectionNames = collectionNames.filter(name => 
                  collections?.some(c => c.name === name && selectedCollectionIds.has(c.id))
                );

                return (
                  <div key={place.id} className={`flex items-start gap-3 p-3 border rounded-lg hover:bg-accent transition-colors ${
                    isIncludedViaCollection && !isIndividuallySelected ? 'bg-blue-50 border-blue-200' : ''
                  }`}>
                    <Checkbox
                      id={`place-${place.id}`}
                      checked={isIndividuallySelected}
                      onCheckedChange={() => handlePlaceToggle(place.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Label 
                          htmlFor={`place-${place.id}`}
                          className="font-medium cursor-pointer"
                        >
                          {place.title}
                        </Label>
                        {isIncludedViaCollection && !isIndividuallySelected && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                            Via collection
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {place.address}
                      </p>
                      {selectedCollectionNames.length > 0 && (
                        <p className="text-xs text-blue-600 mt-1">
                          From: {selectedCollectionNames.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="border rounded-lg p-4 space-y-2 bg-muted/50">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Places included</span>
              <span className="font-medium">{effectivePlaces.length}</span>
            </div>
            {selectedCollectionIds.size > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Collections</span>
                <span className="font-medium">{selectedCollectionIds.size}</span>
              </div>
            )}
            {selectedPlaceIds.size > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Individual places</span>
                <span className="font-medium">{selectedPlaceIds.size}</span>
              </div>
            )}
          </div>
          {selectedCollectionIds.size > 0 && selectedPlaceIds.size > 0 && (
            <p className="text-xs text-blue-600 mt-2">
              Some places may be included both individually and via collections
            </p>
          )}
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-800 text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 justify-end">
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button 
          onClick={handleCreate} 
          disabled={!isValid || isCreating}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {isCreating ? 'Creating...' : 'Create Link List'}
        </Button>
      </div>
    </div>
  );
}