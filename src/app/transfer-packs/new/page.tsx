'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useTransferPacksStore } from '@/stores/transfer-packs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, ArrowRight, AlertCircle } from 'lucide-react';
import type { TransferTarget, Collection } from '@/types';

type Step = 'target' | 'scope' | 'review';

export default function NewTransferPackPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('target');
  const [target, setTarget] = useState<TransferTarget>('apple');
  const [scopeType, setScopeType] = useState<'library' | 'collection'>('library');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [excludeMissingCoords, setExcludeMissingCoords] = useState(true);
  const [packName, setPackName] = useState('');

  const { createPack } = useTransferPacksStore();

  const places = useLiveQuery(() => db.places.toArray(), []);
  const collections = useLiveQuery(() => db.collections.toArray(), []);

  // Calculate eligible places
  const eligiblePlaces = places?.filter((place) => {
    if (excludeMissingCoords && (place.latitude === undefined || place.longitude === undefined)) {
      return false;
    }
    if (scopeType === 'collection' && selectedCollectionId) {
      // Would need to check membership - simplified for now
      return true;
    }
    return true;
  });

  const missingCoordsCount =
    places?.filter((p) => p.latitude === undefined || p.longitude === undefined).length ?? 0;

  useEffect(() => {
    // Set default pack name
    const targetName = target === 'apple' ? 'Apple Maps' : 'Google Maps';
    setPackName(`Transfer to ${targetName}`);
  }, [target]);

  const handleCreate = async () => {
    if (!places) return;

    const placeIds = eligiblePlaces?.map((p) => p.id) ?? [];

    const pack = await createPack(
      packName,
      target,
      placeIds,
      scopeType,
      scopeType === 'collection' ? selectedCollectionId ?? undefined : undefined
    );

    router.push(`/transfer-packs/${pack.id}/run`);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">New Transfer Pack</h1>
          <p className="text-muted-foreground">
            Step {step === 'target' ? 1 : step === 'scope' ? 2 : 3} of 3
          </p>
        </div>
      </div>

      {/* Step 1: Choose Target */}
      {step === 'target' && (
        <Card>
          <CardHeader>
            <CardTitle>Choose Target App</CardTitle>
            <CardDescription>
              Where do you want to transfer your places? You&apos;ll still need to tap
              &quot;Save&quot; in the target app.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-accent">
              <input
                type="radio"
                name="target"
                value="apple"
                checked={target === 'apple'}
                onChange={() => setTarget('apple')}
                className="w-4 h-4"
              />
              <div>
                <p className="font-medium">Apple Maps</p>
                <p className="text-sm text-muted-foreground">
                  Opens maps.apple.com links (works best on iOS/macOS)
                </p>
              </div>
            </label>
            <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-accent">
              <input
                type="radio"
                name="target"
                value="google"
                checked={target === 'google'}
                onChange={() => setTarget('google')}
                className="w-4 h-4"
              />
              <div>
                <p className="font-medium">Google Maps</p>
                <p className="text-sm text-muted-foreground">
                  Opens Google Maps URLs (works on all platforms)
                </p>
              </div>
            </label>
            <div className="pt-4">
              <Button onClick={() => setStep('scope')}>
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Choose Scope */}
      {step === 'scope' && (
        <Card>
          <CardHeader>
            <CardTitle>Choose What to Transfer</CardTitle>
            <CardDescription>
              Select which places to include in this transfer pack
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-accent">
              <input
                type="radio"
                name="scope"
                value="library"
                checked={scopeType === 'library'}
                onChange={() => setScopeType('library')}
                className="w-4 h-4"
              />
              <div>
                <p className="font-medium">Entire Library</p>
                <p className="text-sm text-muted-foreground">{places?.length ?? 0} places total</p>
              </div>
            </label>

            {collections && collections.length > 0 && (
              <>
                <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-accent">
                  <input
                    type="radio"
                    name="scope"
                    value="collection"
                    checked={scopeType === 'collection'}
                    onChange={() => setScopeType('collection')}
                    className="w-4 h-4"
                  />
                  <div className="flex-1">
                    <p className="font-medium">A Collection</p>
                    {scopeType === 'collection' && (
                      <select
                        className="mt-2 w-full px-3 py-2 border rounded-md bg-background"
                        value={selectedCollectionId ?? ''}
                        onChange={(e) => setSelectedCollectionId(e.target.value)}
                      >
                        <option value="">Select a collection</option>
                        {collections.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </label>
              </>
            )}

            <div className="border-t pt-4">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={excludeMissingCoords}
                  onChange={(e) => setExcludeMissingCoords(e.target.checked)}
                  className="w-4 h-4"
                />
                <div>
                  <p className="font-medium">Exclude places missing coordinates</p>
                  <p className="text-sm text-muted-foreground">
                    {missingCoordsCount} places would be excluded (recommended)
                  </p>
                </div>
              </label>
            </div>

            <div className="pt-4 flex gap-2">
              <Button variant="outline" onClick={() => setStep('target')}>
                Back
              </Button>
              <Button
                onClick={() => setStep('review')}
                disabled={scopeType === 'collection' && !selectedCollectionId}
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Review */}
      {step === 'review' && (
        <Card>
          <CardHeader>
            <CardTitle>Review & Create</CardTitle>
            <CardDescription>Confirm your transfer pack settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Pack Name</label>
              <input
                type="text"
                value={packName}
                onChange={(e) => setPackName(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-md bg-background"
              />
            </div>

            <div className="border rounded-lg p-4 space-y-2 bg-muted/50">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Target</span>
                <span className="font-medium">
                  {target === 'apple' ? 'Apple Maps' : 'Google Maps'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Scope</span>
                <span className="font-medium">
                  {scopeType === 'library'
                    ? 'Entire library'
                    : collections?.find((c) => c.id === selectedCollectionId)?.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Places included</span>
                <span className="font-medium">{eligiblePlaces?.length ?? 0}</span>
              </div>
            </div>

            {!excludeMissingCoords && missingCoordsCount > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 text-amber-800">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p className="text-sm">
                  {missingCoordsCount} places are missing coordinates and will use address-based
                  links (may be less accurate)
                </p>
              </div>
            )}

            <div className="pt-4 flex gap-2">
              <Button variant="outline" onClick={() => setStep('scope')}>
                Back
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!packName.trim() || (eligiblePlaces?.length ?? 0) === 0}
              >
                Create Pack
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
