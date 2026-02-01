'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useTransferPacksStore } from '@/stores/transfer-packs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Play, Trash2, MoreHorizontal } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import type { TransferPack } from '@/types';

export default function TransferPacksPage() {
  const packs = useLiveQuery(() => db.transferPacks.orderBy('updatedAt').reverse().toArray(), []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transfer Packs</h1>
          <p className="text-muted-foreground">Guided migrations to your target map app</p>
        </div>
        <Link href="/transfer-packs/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Pack
          </Button>
        </Link>
      </div>

      {packs && packs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No transfer packs yet</p>
            <Link href="/transfer-packs/new">
              <Button>Create your first pack</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {packs?.map((pack) => (
            <PackCard key={pack.id} pack={pack} />
          ))}
        </div>
      )}
    </div>
  );
}

function PackCard({ pack }: { pack: TransferPack }) {
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const { getPackProgress, deletePack } = useTransferPacksStore();

  useEffect(() => {
    getPackProgress(pack.id).then(setProgress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pack.id]);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (confirm('Delete this transfer pack?')) {
      await deletePack(pack.id);
    }
  };

  const isComplete = progress.done === progress.total && progress.total > 0;
  const progressPercent = progress.total > 0 ? (progress.done / progress.total) * 100 : 0;

  return (
    <Link href={`/transfer-packs/${pack.id}/run`}>
      <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium">{pack.name}</h3>
                <span
                  className={`px-2 py-0.5 text-xs rounded ${
                    pack.target === 'apple'
                      ? 'bg-gray-100 text-gray-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  → {pack.target === 'apple' ? 'Apple Maps' : 'Google Maps'}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {progress.done}/{progress.total} places
                {isComplete && ' (Complete)'}
              </p>
              <div className="mt-2 h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Last updated {formatDateTime(pack.updatedAt)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant={isComplete ? 'outline' : 'default'}>
                <Play className="w-4 h-4 mr-1" />
                {isComplete ? 'Review' : 'Resume'}
              </Button>
              <Button size="icon" variant="ghost" onClick={handleDelete}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
