type CacheStatus = "INTERVAL" | "TTL";

interface CacheEntry<T> {
  value: T;
  updatedAt: number;
  sourceIntervalMs: number;
}

interface IngestCacheOptions {
  ttlMs: number;
}

interface SetOptions {
  sourceIntervalMs: number;
  now?: number;
}

interface GetOptions {
  now?: number;
}

export class IngestCache<T = unknown> {
  private readonly ttlMs: number;
  private readonly store = new Map<string, CacheEntry<T>>();

  constructor(options: IngestCacheOptions) {
    this.ttlMs = options.ttlMs;
  }

  set(key: string, value: T, options: SetOptions): void {
    this.store.set(key, {
      value,
      updatedAt: options.now ?? Date.now(),
      sourceIntervalMs: options.sourceIntervalMs
    });
  }

  get(key: string, options?: GetOptions): { value: T; cacheStatus: CacheStatus } | undefined {
    const cached = this.store.get(key);
    if (!cached) {
      return undefined;
    }

    const now = options?.now ?? Date.now();
    const age = now - cached.updatedAt;

    if (age <= cached.sourceIntervalMs) {
      return { value: cached.value, cacheStatus: "INTERVAL" };
    }

    if (age <= this.ttlMs) {
      return { value: cached.value, cacheStatus: "TTL" };
    }

    this.store.delete(key);
    return undefined;
  }
}
