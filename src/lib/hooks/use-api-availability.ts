'use client';

import { useEffect, useState } from 'react';

export interface ApiAvailabilityStatus {
  apple: { configured: boolean };
  google: { configured: boolean };
}

export function useApiAvailability() {
  const [status, setStatus] = useState<ApiAvailabilityStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/maps/status', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('Failed to load API availability');
        }
        const data = (await response.json()) as ApiAvailabilityStatus;
        if (isMounted) {
          setStatus(data);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load API availability');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  return { status, isLoading, error };
}
