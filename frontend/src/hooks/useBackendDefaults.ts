import { useState, useEffect } from 'react';

interface BackendDefaults {
  target_contractions_ch1: number;
  target_contractions_ch2: number;
  mvc_threshold_percentage: number;
  therapeutic_duration_threshold_ms: number;
  // scoring_weights removed - now fetched from database only
}

/**
 * Hook to fetch backend configuration defaults from the API.
 * This provides MVC and duration defaults from backend/config.py.
 * Scoring weights are now fetched exclusively from the database.
 */
export function useBackendDefaults() {
  const [defaults, setDefaults] = useState<BackendDefaults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDefaults = async () => {
      try {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';
        const response = await fetch(`${backendUrl}/config/defaults`);
        if (!response.ok) {
          throw new Error(`Failed to fetch defaults: ${response.statusText}`);
        }
        const data = await response.json();
        setDefaults(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching backend defaults:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        // Don't set fallback values - let the UI handle the error state
        // This maintains single source of truth in backend/config.py
        setDefaults(null);
      } finally {
        setLoading(false);
      }
    };

    fetchDefaults();
  }, []);

  return { defaults, loading, error };
}