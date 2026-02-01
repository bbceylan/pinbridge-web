'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { linkListService } from '@/lib/services/link-list';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, ExternalLink, Trash2, QrCode } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import type { LinkList } from '@/types';

export default function LinkListsPage() {
  const linkLists = useLiveQuery(() => db.linkLists.orderBy('updatedAt').reverse().toArray(), []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Link Lists</h1>
          <p className="text-muted-foreground">Shareable pages with clickable links to your places</p>
        </div>
        <Link href="/link-list/create">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Link List
          </Button>
        </Link>
      </div>

      {linkLists && linkLists.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No link lists yet</p>
            <Link href="/link-list/create">
              <Button>Create your first link list</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {linkLists?.map((linkList) => (
            <LinkListCard key={linkList.id} linkList={linkList} />
          ))}
        </div>
      )}
    </div>
  );
}

function LinkListCard({ linkList }: { linkList: LinkList }) {
  // Calculate place count from live query
  const placeCount = useMemo(() => {
    return linkList.placeIds.length;
  }, [linkList.placeIds]);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (confirm('Delete this link list?')) {
      await linkListService.deleteLinkList(linkList.id);
    }
  };

  return (
    <Link href={`/link-list/${linkList.id}`}>
      <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium">{linkList.title}</h3>
                {linkList.isPublic && (
                  <span className="px-2 py-0.5 text-xs rounded bg-green-100 text-green-700">
                    Public
                  </span>
                )}
              </div>
              {linkList.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {linkList.description}
                </p>
              )}
              <p className="text-sm text-muted-foreground mt-1">
                {placeCount} place{placeCount !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Last updated {formatDateTime(linkList.updatedAt)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline">
                <ExternalLink className="w-4 h-4 mr-1" />
                View
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