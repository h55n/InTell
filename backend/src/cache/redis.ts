import Redis from 'ioredis';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

// ─── In-memory fallback ───────────────────────────────────────────────────────

const memCache = new Map<string, { value: string; expiresAt: number }>();

function memSet(key: string, value: string, ttlSeconds: number) {
  memCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

function memGet(key: string): string | null {
  const entry = memCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { memCache.delete(key); return null; }
  return entry.value;
}

function memDel(key: string) { memCache.delete(key); }

// ─── Redis client (optional, lazy-connected) ──────────────────────────────────

let redis: Redis | null = null;
let redisReady = false;

if (config.redisUrl) {
  try {
    redis = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 2,
      connectTimeout: 5000,
      lazyConnect: true,
      enableOfflineQueue: false,
    });

    redis.on('ready', () => {
      redisReady = true;
      logger.info('[Redis] Connected');
    });

    redis.on('error', (err: Error) => {
      redisReady = false;
      logger.warn('[Redis] Error — falling back to memory', { message: err.message });
    });

    // Connect in background — don't await, don't block module init
    redis.connect().catch(() => {
      redis = null;
      redisReady = false;
    });
  } catch (err) {
    logger.warn('[Redis] Init failed — using in-memory fallback', { err });
    redis = null;
  }
} else {
  logger.info('[Redis] REDIS_URL not set — using in-memory fallback');
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function redisSet(key: string, value: string, ttlSeconds: number): Promise<boolean> {
  if (redis && redisReady) {
    try { await redis.set(key, value, 'EX', ttlSeconds); return true; } catch { return false; }
  }
  return false;
}

async function redisGet(key: string): Promise<string | null> {
  if (redis && redisReady) {
    try { return await redis.get(key); } catch { return null; }
  }
  return null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function setReport(key: string, report: unknown, ttlSeconds = config.reportTtlSeconds) {
  const value = JSON.stringify(report);
  if (!await redisSet(key, value, ttlSeconds)) {
    memSet(key, value, ttlSeconds);
  }
}

export async function getReport(key: string): Promise<unknown | null> {
  const rVal = await redisGet(key);
  if (rVal !== null) return JSON.parse(rVal);
  const mVal = memGet(key);
  return mVal ? JSON.parse(mVal) : null;
}

export async function deleteReport(key: string) {
  if (redis && redisReady) { try { await redis.del(key); } catch {} }
  memDel(key);
}

/** reportId → cacheKey mapping */
export async function setIdMapping(reportId: string, cacheKey: string, ttlSeconds = config.reportTtlSeconds) {
  const idKey = `id:${reportId}`;
  if (!await redisSet(idKey, cacheKey, ttlSeconds)) {
    memSet(idKey, cacheKey, ttlSeconds);
  }
}

export async function getKeyById(reportId: string): Promise<string | null> {
  const idKey = `id:${reportId}`;
  const rVal = await redisGet(idKey);
  if (rVal !== null) return rVal;
  return memGet(idKey);
}

/** Generic short-lived cache (bulk jobs, stats, etc.) */
export async function cacheSet(key: string, value: string, ttlSeconds: number) {
  if (!await redisSet(key, value, ttlSeconds)) {
    memSet(key, value, ttlSeconds);
  }
}

export async function cacheGet(key: string): Promise<string | null> {
  const rVal = await redisGet(key);
  if (rVal !== null) return rVal;
  return memGet(key);
}
