import type { Request, Response, NextFunction } from 'express';
import { cacheSet, cacheGet } from '../cache/redis.js';
import { logger } from '../utils/logger.js';

interface RateLimitOptions {
  windowSeconds: number;
  maxRequests: number;
}

export function rateLimitByKey({ windowSeconds, maxRequests }: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const key = `rl:${ip}`;

    try {
      const raw = await cacheGet(key);
      const current = raw ? parseInt(raw, 10) : 0;

      if (current >= maxRequests) {
        res.setHeader('Retry-After', String(windowSeconds));
        return res.status(429).json({
          error: 'Too many requests',
          retryAfter: windowSeconds,
        });
      }

      // Increment — set with TTL only on first request (sliding window)
      await cacheSet(key, String(current + 1), windowSeconds);
      next();
    } catch (err) {
      // If Redis fails, don't block the request
      logger.warn('[RateLimit] Redis error — skipping limit check', { err });
      next();
    }
  };
}
