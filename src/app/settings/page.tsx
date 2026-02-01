'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { clearAllData, getPlaceCount } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Download, AlertTriangle } from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();
  const [placeCount, setPlaceCount] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    getPlaceCount().then(setPlaceCount);
  }, []);

  const handleDeleteAll = async () => {
    await clearAllData();
    setShowDeleteConfirm(false);
    router.push('/');
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your data and preferences</p>
      </div>

      {/* Data Storage */}
      <Card>
        <CardHeader>
          <CardTitle>Data Storage</CardTitle>
          <CardDescription>
            All your data is stored locally in your browser by default
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
            <div>
              <p className="font-medium">Local Database</p>
              <p className="text-sm text-muted-foreground">{placeCount} places stored</p>
            </div>
          </div>

          <Button variant="outline" onClick={() => router.push('/export')}>
            <Download className="w-4 h-4 mr-2" />
            Export Backup
          </Button>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>These actions cannot be undone</CardDescription>
        </CardHeader>
        <CardContent>
          {!showDeleteConfirm ? (
            <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete All Local Data
            </Button>
          ) : (
            <div className="space-y-4 p-4 border border-red-200 rounded-lg bg-red-50">
              <p className="text-sm text-red-800">
                This will permanently delete all {placeCount} places, collections, and transfer
                packs from your browser. This cannot be undone.
              </p>
              <div className="flex gap-2">
                <Button variant="destructive" onClick={handleDeleteAll}>
                  Yes, Delete Everything
                </Button>
                <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle>About PinBridge</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>PinBridge helps you transfer saved places between Apple Maps and Google Maps.</p>
          <p>
            This is a guided migration tool - you&apos;ll need to manually save each place in the
            target app because neither Apple nor Google provide public APIs to add places to your
            saved lists.
          </p>
          <p className="pt-2">
            <strong>Privacy:</strong> Your data stays on your device by default. No account
            required.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
