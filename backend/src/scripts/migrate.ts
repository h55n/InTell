// Applies docker/init.sql schema to Neon PostgreSQL
import pg from 'pg';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../../.env') });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) { console.error('DATABASE_URL not set'); process.exit(1); }

const sql = readFileSync(resolve(__dirname, '../../../docker/init.sql'), 'utf8');

const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
try {
  await pool.query(sql);
  console.log('✅ Schema applied to Neon PostgreSQL');
} catch (e) {
  console.error('❌ Migration failed:', e);
  process.exit(1);
} finally {
  await pool.end();
}
