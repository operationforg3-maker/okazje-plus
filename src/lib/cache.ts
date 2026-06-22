import { LRUCache } from 'lru-cache';

// Initialize Redis client only on server-side
let redis: any = null;
let redisInitPromise: Promise<void> | null = null;
let redisChecked = false; // Zapobiega spamowaniu logami

// Lazy init redis only when needed (avoids webpack bundling node modules)
async function initRedis() {
  if (redis || redisInitPromise || redisChecked) return;
  if (typeof window !== 'undefined') return; // Client-side bail
  
  // Set flag immediately to prevent concurrent init attempts
  redisChecked = true;

  // Local development fallback: do not use remote Redis to prevent network latency
  if (
    process.env.NODE_ENV === 'development' &&
    process.env.REDIS_URL &&
    !process.env.REDIS_URL.includes('localhost') &&
    !process.env.REDIS_URL.includes('127.0.0.1')
  ) {
    console.info('ℹ️ Local development: Bypassing remote Redis to avoid network latency. Using local in-memory LRU cache.');
    return;
  }

  if (!process.env.REDIS_URL) {
    if (process.env.NODE_ENV === 'production') {
      console.info('REDIS_URL not set — using in-memory LRU cache as fallback.');
    }
    return;
  }

  redisInitPromise = (async () => {
    try {
      // Dynamic import only on server-side at runtime
      const Redis = (await import('ioredis')).default;
      
      // Use defensive config to fail fast if Redis is unreachable
      const client = new Redis(process.env.REDIS_URL!, {
        connectTimeout: 2000,         // 2s timeout for initial connection
        maxRetriesPerRequest: 1,      // Don't retry requests endlessly
        lazyConnect: true,             // Don't connect immediately
        retryStrategy: (times) => {    // Stop reconnecting after 3 attempts
            if (times > 3) return null;
            return Math.min(times * 100, 1000);
        }
      });

      // Handle errors silently
      client.on('error', (err: any) => {
        // Suppress initial connection errors
      });

      try {
        await client.connect();
        redis = client;
        console.log('✅ Redis connected successfully');
      } catch (connErr) {
        try { await client.quit(); } catch {} 
        redis = null;
      }
      
    } catch (e) {
      console.warn('Failed to initialize Redis client, falling back to LRU:', e);
      redis = null;
    }
  })();

  await redisInitPromise;
}

const lru = new LRUCache<string, any>({
  max: 1000, // Zwiększamy max limit dla lepszego L1 cachu
  ttl: 1000 * 3600,
  updateAgeOnGet: true,
});

export async function cacheGet(key: string): Promise<any | null> {
  // L1 Cache: Sprawdź najpierw lokalną pamięć podręczną (0ms)
  const cachedVal = lru.get(key);
  if (cachedVal !== undefined) {
    return cachedVal;
  }

  await initRedis();
  if (redis) {
    try {
      const v = await redis.get(key);
      if (v) {
        const parsed = JSON.parse(v);
        // Zapisz do L1 Cache
        lru.set(key, parsed);
        return parsed;
      }
      return null;
    } catch (e) {
      return null;
    }
  }
  return null;
}

export async function cacheSet(key: string, value: any, ttlSeconds = 60): Promise<void> {
  // L1 Cache: Zapisz lokalnie natychmiast
  lru.set(key, value, { ttl: ttlSeconds * 1000 });

  await initRedis();
  if (redis) {
    try {
      // L2 Cache: Zapisz w Redis asynchronicznie (brak await, nie blokujemy żądania)
      redis.set(key, JSON.stringify(value), 'EX', Math.max(1, Math.floor(ttlSeconds))).catch(() => {});
      return;
    } catch (e) {
      return;
    }
  }
}

export async function cacheDel(key: string): Promise<void> {
  // L1 Cache: Usuń lokalnie natychmiast
  lru.delete(key);

  await initRedis();
  if (redis) {
    try {
      // L2 Cache: Usuń z Redis asynchronicznie (brak await)
      redis.del(key).catch(() => {});
      return;
    } catch (e) {
      return;
    }
  }
}

// Simple Redis-backed rate limiter (per-key). Returns true if allowed, false if rate limited.
// When Redis is not configured, the limiter is a no-op (allows requests).
export async function rateLimit(key: string, limit = 60, windowSeconds = 60): Promise<boolean> {
  await initRedis();
  if (!redis) return true;
  try {
    const redisKey = `rl:${key}`;
    const cur = await redis.incr(redisKey);
    if (cur === 1) {
      await redis.expire(redisKey, windowSeconds).catch(() => {});
    }
    return cur <= limit;
  } catch (e) {
    return true;
  }
}
