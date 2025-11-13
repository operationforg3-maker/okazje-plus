import { LRUCache } from 'lru-cache';

// Lazy-load ioredis at runtime only when REDIS_URL is configured.
// This avoids bundling Node-only modules (net/dns/tls) into the client/server build.
let redis: any = null;
if (process.env.REDIS_URL) {
  try {
    // Require at runtime so bundlers don't try to resolve node-only deps during client builds.
  // Load ioredis via an indirection so bundlers don't statically analyze the 'ioredis' import
  const ioredisName = 'ioredis';
  const RedisModule = require(ioredisName);
    const RedisCtor = RedisModule?.default ?? RedisModule;
    redis = new RedisCtor(process.env.REDIS_URL);
    // prevent unhandled error events from crashing processes
    redis.on('error', (err: any) => {
      console.warn('Redis client error:', err);
    });
  } catch (e) {
    console.warn('Failed to initialize Redis client, falling back to LRU:', e);
    redis = null;
  }
} else {
  console.info('REDIS_URL not set — using in-memory LRU cache as fallback. For production set REDIS_URL to enable shared caching and rate-limiter.');
}

const lru = new LRUCache<string, any>({ max: 1000, ttl: 1000 * 60 * 2 });

export async function cacheGet(key: string): Promise<any | null> {
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
