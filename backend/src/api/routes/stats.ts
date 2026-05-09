import { Router } from 'express';
import { getStats } from '../../db/postgres.js';
import { cacheGet, cacheSet } from '../../cache/redis.js';

const router = Router();
const STATS_CACHE_TTL = 300; // 5 minutes
const STATS_CACHE_KEY = 'stats:aggregated';

/** GET /api/stats — aggregated analytics */
router.get('/', async (_req, res) => {
  // Try cache first
  const cached = await cacheGet(STATS_CACHE_KEY);
  if (cached) {
    return res.json(JSON.parse(cached));
  }

  const stats = await getStats();
  const payload = JSON.stringify(stats);
  await cacheSet(STATS_CACHE_KEY, payload, STATS_CACHE_TTL);
  return res.json(stats);
});

export default router;
