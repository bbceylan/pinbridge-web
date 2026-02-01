'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { LinkListCreator } from '@/components/shared/link-list-creator';

export default function CreateLinkListPage() {
  const router = useRouter();

  const handleLinkListCreated = (linkListId: string) => {
    // Navigate to the created link list
    router.push(`/link-list/${linkListId}`);
  };

  const handleCancel = () => {
    // Navigate back to export page
    router.push('/export');
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={handleCancel}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">New Link List</h1>
          <p className="text-muted-foreground">
            Create a shareable page with clickable links to your places
          </p>
        </div>
      </div>

      <LinkListCreator
        onLinkListCreated={handleLinkListCreated}
        onCancel={handleCancel}
      />
    </div>
  );
}