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

    return allPlaces;
  }, [places, placeCollections, selectedPlaceIds, selectedCollectionIds]);

  // Generate default title based on selections
  const defaultTitle = useMemo(() => {
    if (!collections) return '';

    const selectedCollections = collections.filter(c => selectedCollectionIds.has(c.id));
    
    if (selectedCollections.length === 1) {
      return selectedCollections[0].name;
    } else if (selectedCollections.length > 1) {
      return `${selectedCollections[0].name} and ${selectedCollections.length - 1} more`;
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
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Create Link List</h1>
        <p className="text-muted-foreground">
          Create a shareable page with clickable links to your places
        </p>
      </div>

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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {collections.map((collection) => (
                <div key={collection.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`collection-${collection.id}`}
                    checked={selectedCollectionIds.has(collection.id)}
                    onCheckedChange={() => handleCollectionToggle(collection.id)}
                  />
                  <Label 
                    htmlFor={`collection-${collection.id}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {collection.name}
                  </Label>
                </div>
              ))}
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
              {places.map((place) => (
                <div key={place.id} className="flex items-start space-x-2 p-2 rounded hover:bg-accent">
                  <Checkbox
                    id={`place-${place.id}`}
                    checked={selectedPlaceIds.has(place.id)}
                    onCheckedChange={() => handlePlaceToggle(place.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <Label 
                      htmlFor={`place-${place.id}`}
                      className="text-sm font-medium leading-none cursor-pointer"
                    >
                      {place.title}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      {place.address}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">
                {effectivePlaces.length} place{effectivePlaces.length !== 1 ? 's' : ''} selected
              </p>
              <p className="text-sm text-muted-foreground">
                {selectedCollectionIds.size > 0 && 
                  `${selectedCollectionIds.size} collection${selectedCollectionIds.size !== 1 ? 's' : ''}, `}
                {selectedPlaceIds.size > 0 && 
                  `${selectedPlaceIds.size} individual place${selectedPlaceIds.size !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
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