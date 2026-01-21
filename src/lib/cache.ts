import { LRUCache } from 'lru-cache';

// Initialize Redis client only on server-side
let redis: any = null;
let redisInitPromise: Promise<void> | null = null;
let redisChecked = false; // Zapobiega spamowaniu logami

// Lazy init redis only when needed (avoids webpack bundling node modules)
async function initRedis() {
  if (redis || redisInitPromise || redisChecked) return;
  if (typeof window !== 'undefined') return; // Client-side bail
  
  redisChecked = true; // Oznaczamy, że sprawdziliśmy konfigurację

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
      redis = new Redis(process.env.REDIS_URL!);
      redis.on('error', (err: any) => {
        console.warn('Redis client error:', err);
      });
    } catch (e) {
      console.warn('Failed to initialize Redis client, falling back to LRU:', e);
      redis = null;
    }
  })();

  await redisInitPromise;
}

const lru = new LRUCache<string, any>({ max: 50, ttl: 1000 * 30 }); // Ultra-minimal cache for 256MB Cloud Run

export async function cacheGet(key: string): Promise<any | null> {
  await initRedis();
  if (redis) {
    try {
      const v = await redis.get(key);
      return v ? JSON.parse(v) : null;
    } catch (e) {
      console.warn('Redis GET failed, falling back to LRU:', e);
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
      console.warn('Redis SET failed, falling back to LRU:', e);
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
      console.warn('Redis DEL failed, falling back to LRU del:', e);
      lru.delete(key);
      return;
    }
  }
  lru.delete(key);
}

// Simple Redis-backed rate limiter (per-key). Returns true if allowed, false if rate limited.
// When Redis is not configured, the limiter is a no-op (allows requests).
export async function rateLimit(key: string, limit = 60, windowSeconds = 60): Promise<boolean> {
  if (!redis) return true;
  try {
    const redisKey = `rl:${key}`;
    const cur = await redis.incr(redisKey);
    if (cur === 1) {
      await redis.expire(redisKey, windowSeconds);
    }
    return cur <= limit;
  } catch (e) {
    console.warn('Redis rateLimit check failed — allowing request:', e);
    return true;
  }
}

export function closeRedis() {
  if (redis) redis.disconnect();
}
