import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Try monorepo root first (.env lives at fonum/.env), then backend/ cwd
dotenv.config({ path: resolve(__dirname, '../../../.env') });
dotenv.config(); // fallback: cwd .env (when running from backend/)

export const config = {
  port: parseInt(process.env.PORT ?? '3001', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',

  // ── Mistral (REQUIRED) ─────────────────────────────────────────────────────
  mistralApiKey: process.env.MISTRAL_API_KEY ?? '',
  mistralModel: process.env.MISTRAL_MODEL ?? 'mistral-large-latest',

  // ── Search APIs (at least one recommended) ─────────────────────────────────
  serperApiKey: process.env.SERPER_API_KEY ?? '',
  tavilyApiKey: process.env.TAVILY_API_KEY ?? '',
  // Falls back to DuckDuckGo if neither set

  // ── Frontend ───────────────────────────────────────────────────────────────
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',

  // ── Rate limiting ──────────────────────────────────────────────────────────
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX ?? '5', 10),

  // ── Persistence (optional — graceful fallback if not set) ──────────────────
  redisUrl: process.env.REDIS_URL ?? '',
  databaseUrl: process.env.DATABASE_URL ?? '',

  // ── PDF Export ─────────────────────────────────────────────────────────────
  puppeteerExecutablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? '',

  // ── Cost control ───────────────────────────────────────────────────────────
  maxSearchIterations: parseInt(process.env.MAX_SEARCH_ITERATIONS ?? '12', 10),
  reportTtlSeconds: parseInt(process.env.REPORT_TTL_SECONDS ?? '86400', 10),
} as const;

// Validate required keys at startup
if (!config.mistralApiKey) {
  console.error('❌  MISTRAL_API_KEY is required in .env');
  process.exit(1);
}

if (!config.serperApiKey && !config.tavilyApiKey) {
  console.warn('⚠️  No search API key set (SERPER_API_KEY or TAVILY_API_KEY). Falling back to DuckDuckGo — results may be limited.');
}
