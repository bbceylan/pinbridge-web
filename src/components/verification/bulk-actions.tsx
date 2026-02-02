'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { CheckCircle, XCircle, X, Users } from 'lucide-react';

interface BulkActionsProps {
  selectedCount: number;
  onAccept: () => Promise<void>;
  onReject: () => Promise<void>;
  onClear: () => void;
  loading: boolean;
}

export function BulkActions({ 
  selectedCount, 
  onAccept, 
  onReject, 
  onClear, 
  loading 
}: BulkActionsProps) {
  const [actionType, setActionType] = useState<'accept' | 'reject' | null>(null);

  const handleAction = async (action: 'accept' | 'reject') => {
    setActionType(action);
    try {
      if (action === 'accept') {
        await onAccept();
      } else {
        await onReject();
      }
    } finally {
      setActionType(null);
    }
  };

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-blue-600" />
              <span className="font-medium text-blue-900">
                {selectedCount} match{selectedCount !== 1 ? 'es' : ''} selected
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Accept All */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  size="sm" 
                  className="bg-green-600 hover:bg-green-700"
                  disabled={loading}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Accept All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Accept Selected Matches</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to accept {selectedCount} selected match{selectedCount !== 1 ? 'es' : ''}? 
                    This action will mark them as verified and ready for transfer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => handleAction('accept')}
                    className="bg-green-600 hover:bg-green-700"
                    disabled={loading || actionType === 'accept'}
                  >
                    {actionType === 'accept' ? 'Accepting...' : 'Accept All'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Reject All */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  size="sm" 
                  variant="destructive"
                  disabled={loading}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reject Selected Matches</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to reject {selectedCount} selected match{selectedCount !== 1 ? 'es' : ''}? 
                    This action will exclude them from the transfer and they will need to be handled manually.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => handleAction('reject')}
                    className="bg-red-600 hover:bg-red-700"
                    disabled={loading || actionType === 'reject'}
                  >
                    {actionType === 'reject' ? 'Rejecting...' : 'Reject All'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Clear Selection */}
            <Button 
              size="sm" 
              variant="ghost"
              onClick={onClear}
              disabled={loading}
            >
              <X className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>
        </div>

        {/* Action Status */}
        {loading && (
          <div className="mt-3 flex items-center space-x-2 text-sm text-blue-700">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span>
              {actionType === 'accept' ? 'Accepting' : 'Rejecting'} {selectedCount} match{selectedCount !== 1 ? 'es' : ''}...
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}