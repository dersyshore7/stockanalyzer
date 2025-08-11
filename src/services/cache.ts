interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class Cache {
  private cache = new Map<string, CacheEntry<any>>();

  set<T>(key: string, data: T, ttlMs: number = 300000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  clear(): void {
    this.cache.clear();
  }

  delete(key: string): void {
    this.cache.delete(key);
  }
}

export const apiCache = new Cache();
export const technicalCache = new Cache();

export async function withCache<T>(
  key: string, 
  fetcher: () => Promise<T>, 
  ttlMs: number = 300000
): Promise<T> {
  const cached = apiCache.get<T>(key);
  if (cached) return cached;

  const result = await fetcher();
  apiCache.set(key, result, ttlMs);
  return result;
}
