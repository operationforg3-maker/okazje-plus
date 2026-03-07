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
      
      // Use defensive config to fail fast if Redis is unreachable (e.g. local build vs remote Redis)
      const client = new Redis(process.env.REDIS_URL!, {
        connectTimeout: 2000,         // 2s timeout for initial connection
        maxRetriesPerRequest: 1,      // Don't retry requests endlessly
        lazyConnect: true,             // Don't connect immediately
        retryStrategy: (times) => {    // Stop reconnecting after 3 attempts
            if (times > 3) return null;
            return Math.min(times * 100, 1000);
        }
      });

      // Handle errors silentily initially
      client.on('error', (err: any) => {
        // Suppress initial connection errors to avoid console spam during build/dev
        // if we are just failing to connect to a private instance
      });

      try {
        await client.connect();
        redis = client;
        console.log('✅ Redis connected successfully');
      } catch (connErr) {
        // console.warn('⚠️ Redis connection failed (using LRU fallback):', (connErr as Error).message);
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
  max: 500,
  ttl: 1000 * 3600,
  updateAgeOnGet: true,
});

export async function cacheGet(key: string): Promise<any | null> {
  await initRedis();
  if (redis) {
    try {
      const v = await redis.get(key);
      return v ? JSON.parse(v) : null;
    } catch (e) {
      // If Redis fails mid-operation, just use LRU
      // console.warn('Redis GET failed, falling back to LRU:', e); 
      return lru.get(key) ?? null;
    }
  }
  return lru.get(key) ?? null;
}

export async function cacheSet(key: string, value: any, ttlSeconds = 60): Promise<void> {
  await initRedis();
  if (redis) {
    try {
      await redis.set(key, JSON.stringify(value), 'EX', Math.max(1, Math.floor(ttlSeconds)));
      return;
    } catch (e) {
      // console.warn('Redis SET failed, falling back to LRU:', e);
      lru.set(key, value, { ttl: ttlSeconds * 1000 });
      return;
    }
  }
  lru.set(key, value, { ttl: ttlSeconds * 1000 });
}

export async function cacheDel(key: string): Promise<void> {
  await initRedis();
  if (redis) {
    try {
      await redis.del(key);
      return;
    } catch (e) {
      // console.warn('Redis DEL failed, falling back to LRU del:', e);
      lru.delete(key);
      return;
    }
  }
  lru.delete(key);
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
      await redis.expire(redisKey, windowSeconds);
    }
    return cur <= limit;
  } catch (e) {
    // console.warn('Redis rateLimit check failed — allowing request:', e);
    return true;
  }
}
