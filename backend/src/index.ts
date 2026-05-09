import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createHash } from 'crypto';
import { z } from 'zod';
import { orchestrate } from './orchestrator/index.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { validateInput } from './middleware/validate.js';
import { setReport, getReport, setIdMapping, getKeyById } from './cache/redis.js';
import { logInvestigation } from './db/postgres.js';
import { generatePdf } from './services/pdfExport.js';
import bulkRouter from './api/routes/bulk.js';
import statsRouter from './api/routes/stats.js';
import type { StreamEvent, InvestigationReport } from './types/index.js';

const app = express();

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: config.frontendUrl, credentials: true }));
app.use(express.json({ limit: '1mb' }));

const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  message: { error: 'Rate limit exceeded. Investigations are expensive — please wait.' },
});

// ─── Sub-routers ──────────────────────────────────────────────────────────────
app.use('/api/bulk', bulkRouter);
app.use('/api/stats', statsRouter);

// ─── POST /api/investigate  (SSE streaming) ───────────────────────────────────

const InvestigateSchema = z.object({
  input: z.string().min(2).max(300).trim(),
  inputType: z.enum(['phone', 'email', 'name', 'business']).optional(),
});

app.post('/api/investigate', limiter, validateInput, async (req, res) => {
  const parsed = InvestigateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }

  const { input, inputType } = parsed.data;

  // Auto-detect type if not provided
  let resolvedType: 'phone' | 'email' | 'name' | 'business' = inputType ?? 'phone';
  if (!inputType) {
    if (/^\+?\d[\d\s\-]{7,15}$/.test(input)) resolvedType = 'phone';
    else if (/@/.test(input)) resolvedType = 'email';
    else if (/\b(pvt|ltd|llc|inc|corp|limited|private|technologies|consultancy)\b/i.test(input)) resolvedType = 'business';
    else resolvedType = 'name';
  }

  // Cache key (normalised)
  const cacheKey = `report:${resolvedType}:${input.toLowerCase().replace(/\s+/g, '')}`;

  // ── Redis cache check ──
  const cached = await getReport(cacheKey);
  if (cached) {
    logger.info('[API] Returning cached report', { input });
    return res.json({ status: 'cached', report: cached });
  }

  // ── SSE setup ──────────────────────────────────────────────────────────────
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (event: StreamEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  const startMs = Date.now();

  try {
    const report = await orchestrate(input, resolvedType, send);

    // ── Persist ────────────────────────────────────────────────────────────
    await Promise.all([
      setReport(cacheKey, report, config.reportTtlSeconds),
      setIdMapping(report.id, cacheKey, config.reportTtlSeconds),
    ]);

    // ── Audit log (fire-and-forget) ────────────────────────────────────────
    void logInvestigation({
      id: report.id,
      inputHash: createHash('sha256').update(input).digest('hex'),
      inputType: resolvedType,
      safetyVerdict: report.safetyVerdict,
      rating: report.rating,
      executionMs: Date.now() - startMs,
      agentCount: report.agentLogs.length,
      searchCount: report.agentLogs.reduce((s: number, a) => s + a.searchQueries.length, 0),
      sourceCount: report.sources.length,
      ipAddress: req.ip,
    });

    res.write(`data: ${JSON.stringify({ type: 'done', reportId: report.id, timestamp: new Date().toISOString() })}\n\n`);
    res.end();
  } catch (err) {
    logger.error('[API] Investigation failed', { err });
    send({ type: 'error', message: err instanceof Error ? err.message : 'Investigation failed', timestamp: new Date().toISOString() });
    res.end();
  }
});

// ─── GET /api/report/:id ──────────────────────────────────────────────────────

app.get('/api/report/:id', async (req, res) => {
  const { id } = req.params;
  const cacheKey = await getKeyById(id);
  if (!cacheKey) return res.status(404).json({ error: 'Report not found or expired' });
  const report = await getReport(cacheKey);
  if (!report) return res.status(404).json({ error: 'Report not found or expired' });
  return res.json({ status: 'ok', report });
});

// ─── GET /api/report/:id/pdf ──────────────────────────────────────────────────

app.get('/api/report/:id/pdf', async (req, res) => {
  const { id } = req.params;
  const cacheKey = await getKeyById(id);
  if (!cacheKey) return res.status(404).json({ error: 'Report not found or expired' });
  const report = await getReport(cacheKey) as InvestigationReport | null;
  if (!report) return res.status(404).json({ error: 'Report not found or expired' });

  try {
    const pdfBuffer = await generatePdf(report);
    const filename = `phone-intel-${report.id.slice(0, 8)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.end(pdfBuffer);
  } catch (err) {
    logger.error('[PDF] Generation failed', { err });
    return res.status(500).json({ error: 'PDF generation failed', detail: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// ─── GET /api/health ──────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    mistral: !!config.mistralApiKey,
    search: config.serperApiKey ? 'serper' : config.tavilyApiKey ? 'tavily' : 'duckduckgo',
    model: config.mistralModel,
    redis: !!config.redisUrl,
    postgres: !!config.databaseUrl,
  });
});

app.listen(config.port, () => {
  logger.info(`Phone Intel API running on :${config.port}`, {
    model: config.mistralModel,
    search: config.serperApiKey ? 'Serper (Google)' : config.tavilyApiKey ? 'Tavily' : 'DuckDuckGo (free)',
    redis: config.redisUrl ? 'enabled' : 'in-memory fallback',
    postgres: config.databaseUrl ? 'enabled' : 'disabled',
  });
});
