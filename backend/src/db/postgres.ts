import pg from 'pg';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

// ─── Connection pool (optional) ───────────────────────────────────────────────

let pool: pg.Pool | null = null;

if (config.databaseUrl) {
  pool = new Pool({ connectionString: config.databaseUrl, max: 5 });
  pool.on('error', (err) => logger.warn('[PG] Pool error', { err }));
  logger.info('[PG] Pool created');
} else {
  logger.info('[PG] DATABASE_URL not set — audit logging disabled');
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InvestigationLog {
  id: string;
  inputHash: string;
  inputType: string;
  safetyVerdict: string;
  rating: number;
  executionMs: number;
  agentCount: number;
  searchCount: number;
  sourceCount: number;
  ipAddress?: string;
}

export interface StatsResult {
  totalInvestigations: number;
  avgRiskScore: number;
  topRiskLevels: Array<{ riskLevel: string; count: number }>;
  commonInputTypes: Array<{ inputType: string; count: number }>;
  dataAvailable: boolean;
}

// ─── Public functions ─────────────────────────────────────────────────────────

export async function logInvestigation(log: InvestigationLog): Promise<void> {
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO investigations
        (id, input_hash, input_type, risk_level, risk_score, execution_ms, agent_count, search_count, source_count, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::inet)
       ON CONFLICT (id) DO NOTHING`,
      [
        log.id,
        log.inputHash,
        log.inputType,
        log.safetyVerdict,
        log.rating,
        log.executionMs,
        log.agentCount,
        log.searchCount,
        log.sourceCount,
        log.ipAddress ?? null,
      ]
    );
  } catch (err) {
    logger.warn('[PG] Failed to log investigation', { err });
  }
}

export async function getStats(): Promise<StatsResult> {
  if (!pool) {
    return {
      totalInvestigations: 0,
      avgRiskScore: 0,
      topRiskLevels: [],
      commonInputTypes: [],
      dataAvailable: false,
    };
  }
  try {
    const [totals, riskLevels, inputTypes] = await Promise.all([
      pool.query<{ total: string; avg_risk: string }>(
        `SELECT COUNT(*) as total, COALESCE(AVG(risk_score),0)::numeric(5,1) as avg_risk FROM investigations`
      ),
      pool.query<{ risk_level: string; count: string }>(
        `SELECT risk_level, COUNT(*) as count FROM investigations GROUP BY risk_level ORDER BY count DESC LIMIT 10`
      ),
      pool.query<{ input_type: string; count: string }>(
        `SELECT input_type, COUNT(*) as count FROM investigations GROUP BY input_type ORDER BY count DESC`
      ),
    ]);

    return {
      totalInvestigations: parseInt(totals.rows[0].total, 10),
      avgRiskScore: parseFloat(totals.rows[0].avg_risk),
      topRiskLevels: riskLevels.rows.map((r) => ({ riskLevel: r.risk_level, count: parseInt(r.count, 10) })),
      commonInputTypes: inputTypes.rows.map((r) => ({ inputType: r.input_type, count: parseInt(r.count, 10) })),
      dataAvailable: true,
    };
  } catch (err) {
    logger.warn('[PG] getStats failed', { err });
    return { totalInvestigations: 0, avgRiskScore: 0, topRiskLevels: [], commonInputTypes: [], dataAvailable: false };
  }
}
