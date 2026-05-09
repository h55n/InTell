-- Phone Intel — PostgreSQL audit schema
-- Run once on fresh database (or mount as Docker initdb script)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS investigations (
  id           UUID         PRIMARY KEY,
  input_hash   VARCHAR(64)  NOT NULL,   -- SHA-256 of raw input, never store raw value
  input_type   VARCHAR(20)  NOT NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  risk_level   VARCHAR(30),
  risk_score   INTEGER,
  execution_ms INTEGER,
  agent_count  SMALLINT,
  search_count SMALLINT,
  source_count SMALLINT,
  ip_address   INET
);

CREATE INDEX IF NOT EXISTS idx_investigations_created_at  ON investigations (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_investigations_risk_level  ON investigations (risk_level);
CREATE INDEX IF NOT EXISTS idx_investigations_input_type  ON investigations (input_type);
