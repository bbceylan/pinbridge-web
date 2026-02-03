'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { useApiAvailability } from '@/lib/hooks/use-api-availability';
import { authService } from '@/lib/services/auth-service';

export function AutomationUnavailableBanner() {
  const { status, isLoading } = useApiAvailability();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    setIsAdmin(authService.isAdmin());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('pinbridge_automation_banner_dismissed_until');
    if (stored) {
      const until = Number(stored);
      if (!Number.isNaN(until) && Date.now() < until) {
        setIsDismissed(true);
      }
    }
  }, []);

  if (isLoading || !status) return null;
  if (!isAdmin || isDismissed) return null;

  const noKeys = !status.apple.configured && !status.google.configured;
  if (!noKeys) return null;

  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 mt-0.5" />
        <div className="text-sm flex-1">
          <p className="font-medium">Automated Transfer is temporarily unavailable</p>
          <p className="text-amber-800">
            We&apos;re missing API keys for Apple Maps and Google Maps. Manual transfer is still available.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              className="text-xs font-medium text-amber-900 underline"
              onClick={() => {
                const until = Date.now() + 24 * 60 * 60 * 1000;
                localStorage.setItem(
                  'pinbridge_automation_banner_dismissed_until',
                  String(until)
                );
                setIsDismissed(true);
              }}
            >
              Remind me later
            </button>
          </div>
        </div>
        <button
          type="button"
          className="text-amber-900 hover:text-amber-700"
          aria-label="Dismiss banner"
          onClick={() => {
            const until = Date.now() + 24 * 60 * 60 * 1000;
            localStorage.setItem(
              'pinbridge_automation_banner_dismissed_until',
              String(until)
            );
            setIsDismissed(true);
          }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
