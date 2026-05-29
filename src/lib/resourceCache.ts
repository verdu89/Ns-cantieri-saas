type Entry<T> = { data: T; fetchedAt: number };

const store = new Map<string, Entry<unknown>>();

export function getCached<T>(key: string, maxAgeMs: number): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > maxAgeMs) return null;
  return entry.data as T;
}

export function setCached<T>(key: string, data: T): void {
  store.set(key, { data, fetchedAt: Date.now() });
}

export function invalidateCache(prefix?: string): void {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

/**
 * Restituisce dati in cache se validi; opzionalmente aggiorna in background (SWR).
 */
export type FetchWithCacheOptions<T> = {
  /** Aggiorna in background se c'è cache valida */
  revalidate?: boolean;
  /** Ignora cache e attende dati freschi */
  forceFresh?: boolean;
  /** Chiamato quando il refresh in background termina (aggiorna UI senza logout) */
  onRevalidated?: (data: T) => void;
};

export async function fetchWithCache<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  options?: FetchWithCacheOptions<T>
): Promise<T> {
  if (options?.forceFresh) {
    const data = await fetcher();
    setCached(key, data);
    return data;
  }

  const cached = getCached<T>(key, ttlMs);
  if (cached !== null) {
    if (options?.revalidate) {
      void fetcher()
        .then((data) => {
          setCached(key, data);
          options.onRevalidated?.(data);
        })
        .catch(() => {});
    }
    return cached;
  }

  const data = await fetcher();
  setCached(key, data);
  return data;
}
