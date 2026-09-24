import { useState, useEffect, useCallback } from 'react';

/**
 * Loads a collection once and exposes a refetch. The three collection hooks were
 * byte-identical apart from the noun, so the behaviour lives here and each of them
 * is a thin wrapper that keeps its own named return value.
 */
export const useCollection = <T>(fetchAll: () => Promise<T[]>, label: string) => {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setItems(await fetchAll());
    } catch (err: any) {
      setError(err.message || `Failed to fetch ${label}`);
    } finally {
      setLoading(false);
    }
    // fetchAll is a stable service method; label never changes for a given hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { items, loading, error, refetch };
};
