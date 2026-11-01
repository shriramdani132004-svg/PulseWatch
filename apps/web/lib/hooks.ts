'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from './api';

interface QueryState<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  refetch: () => void;
}

export function useApiQuery<T>(
  path: string | null,
  options: { pollMs?: number; enabled?: boolean } = {},
): QueryState<T> {
  const { pollMs, enabled = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(Boolean(path) && enabled);
  const [version, setVersion] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refetch = useCallback(() => setVersion((current) => current + 1), []);

  useEffect(() => {
    if (!path || !enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async (initial: boolean) => {
      if (initial) setLoading(true);
      try {
        const result = await api.get<T>(path);
        if (!cancelled && mounted.current) {
          setData(result);
          setError(null);
        }
      } catch (caught) {
        if (!cancelled && mounted.current) {
          setError(caught instanceof ApiError ? caught : new ApiError(0, 'Request failed'));
        }
      } finally {
        if (!cancelled && mounted.current) setLoading(false);
      }
    };
    void load(true);
    if (!pollMs) return () => {
      cancelled = true;
    };
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load(false);
    }, pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [path, pollMs, enabled, version]);

  return { data, error, loading, refetch };
}

export function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
