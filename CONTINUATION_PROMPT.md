# Phone Intel v2.0 — Continuation Prompt for Claude

## Context

You are continuing the development of **Phone Intel**, a multi-agent OSINT tool built with:
- **Backend**: Node.js + Express + TypeScript (ESM)
- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS + Recharts + Framer Motion
- **AI**: Mistral AI (`mistral-large-latest`) — 5 independent agents each running an agentic loop with web_search tool
- **Search**: Serper (Google) → Tavily → DuckDuckGo fallback

## What Is Already Built (35 files, COMPLETE and working)

### Backend (`/backend/src/`)
| File | Status | What it does |
|------|--------|--------------|
| `ai/mistralAgent.ts` | ✅ COMPLETE | Core agentic loop engine. Runs Mistral with web_search tool, handles tool calls, iterates until Mistral is done, returns structured JSON findings |
| `agents/agent1-telecom.ts` | ✅ COMPLETE | Mistral agent — searches TRAI, carrier lookup, MNP portability, telecom circle |
| `agents/agent2-spam.ts` | ✅ COMPLETE | Mistral agent — searches shouldianswer, truecaller, consumer forums, Reddit, news |
| `agents/agent3-identity.ts` | ✅ COMPLETE | Mistral agent — searches OLX, Quikr, JustDial, IndiaMart, WHOIS, Pastebin for emails/names/domains |
| `agents/agent4-social.ts` | ✅ COMPLETE | Mistral agent — searches LinkedIn, MCA21, GST, eCourts, Google News, YouTube |
| `agents/agent5-location.ts` | ✅ COMPLETE | Mistral agent — triangulates area from all prior findings, checks scam clusters |
| `orchestrator/index.ts` | ✅ COMPLETE | Phase 1 (agents 1+2 parallel) → Phase 2 (agents 3+4 parallel, enriched) → Phase 3 (agent 5 with all context) → Mistral synthesis → risk score |
| `config/index.ts` | ✅ COMPLETE | Env config with MISTRAL_API_KEY, SERPER_API_KEY, TAVILY_API_KEY |
| `types/index.ts` | ✅ COMPLETE | All TypeScript types for all 5 agent findings + final report |
| `index.ts` | ✅ COMPLETE | Express server with SSE streaming endpoint POST /api/investigate |
| `utils/logger.ts` | ✅ COMPLETE | Winston logger |

### Frontend (`/frontend/src/`)
| File | Status | What it does |
|------|--------|--------------|
| `hooks/useInvestigation.ts` | ✅ COMPLETE | SSE stream consumer, updates 5 AgentState objects live |
| `components/ui/AgentPanel.tsx` | ✅ COMPLETE | Live agent cards showing running/done/failed state with search feed |
| `components/charts/RiskMeter.tsx` | ✅ COMPLETE | SVG gauge chart for risk score |
| `components/report/ReportPanel.tsx` | ✅ COMPLETE | Full report: telecom + spam + identity + social + location + radar chart + source index |
| `pages/InvestigatePage.tsx` | ✅ COMPLETE | Main page: search form + type selector + live agent panel + report |
| `pages/ReportPage.tsx` | ✅ COMPLETE | Shareable report page via /report/:id |
| `types/index.ts` | ✅ COMPLETE | Frontend TypeScript types |
| `main.tsx` | ✅ COMPLETE | App entry + routing |

### Config/Infra
| File | Status |
|------|--------|
| `backend/package.json` | ✅ COMPLETE |
| `backend/tsconfig.json` | ✅ COMPLETE |
| `frontend/package.json` | ✅ COMPLETE |
| `frontend/tsconfig.json` | ✅ COMPLETE |
| `frontend/vite.config.ts` | ✅ COMPLETE |
| `frontend/tailwind.config.js` | ✅ COMPLETE |
| `frontend/postcss.config.js` | ✅ COMPLETE |
| `frontend/index.html` | ✅ COMPLETE |
| `frontend/nginx.conf` | ✅ COMPLETE — proxy_buffering off for SSE |
| `frontend/Dockerfile` | ✅ COMPLETE |
| `backend/Dockerfile` | ✅ COMPLETE |
| `docker-compose.yml` | ✅ COMPLETE |
| `.env.example` | ✅ COMPLETE |
| `.gitignore` | ✅ COMPLETE |
| `README.md` | ✅ COMPLETE |

---

## What Is MISSING — Build These Next

### PRIORITY 1: Persistence Layer (currently everything is in-memory, lost on restart)

**1A. Redis cache** — Currently reports are stored in a `Map<string, unknown>` in process memory. Add Redis so reports survive restarts and can be shared across instances.

```
File to create: backend/src/cache/redis.ts
- Connect to Redis using `ioredis`
- Functions: setReport(key, report, ttlSeconds), getReport(key), deleteReport(key)
- Key format: `report:{inputType}:{normalizedInput}`  
- TTL: 86400 (24 hours)
- Graceful fallback to in-memory Map if Redis is not configured

File to update: backend/src/index.ts
- Replace the in-memory reportCache Map with Redis calls
- On POST /api/investigate: check Redis first, return cached if hit
- On report_ready event: save to Redis
- On GET /api/report/:id: query Redis by report ID (store an ID → key mapping too)
```

**1B. PostgreSQL audit log** — Every investigation should be logged for analysis.

```
File to create: backend/src/db/postgres.ts  
- Connect using `pg` pool
- Function: logInvestigation(input, inputType, reportId, riskLevel, riskScore, executionMs, agentCount, searchCount, ipAddress)
- Function: getStats() → returns { totalInvestigations, avgRiskScore, topRiskLevels, commonInputTypes }
- Graceful skip if DATABASE_URL is not set

SQL schema to create: docker/init.sql
CREATE TABLE investigations (
  id UUID PRIMARY KEY,
  input_hash VARCHAR(64),   -- SHA-256 of input, NOT the raw value
  input_type VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  risk_level VARCHAR(30),
  risk_score INTEGER,
  execution_ms INTEGER,
  agent_count INTEGER,
  search_count INTEGER,
  source_count INTEGER,
  ip_address INET
);
```

---

### PRIORITY 2: PDF Export

**File to create: backend/src/services/pdfExport.ts**
```
- Accept an InvestigationReport object
- Build a clean HTML string with all sections (telecom, spam, identity, social, location, sources)
- Use puppeteer to render it to PDF buffer
- Return buffer

File to update: backend/src/index.ts
- Add: GET /api/report/:id/pdf
- Fetch report from cache, call pdfExport, stream PDF back with Content-Type: application/pdf
```

**File to update: frontend/src/components/report/ReportPanel.tsx**
```
- Add "Export PDF" button that calls GET /api/report/:id/pdf and triggers browser download
- Show loading spinner while PDF generates
```

---

### PRIORITY 3: Bulk CSV Lookup (Phase 3)

**File to create: backend/src/services/bulkQueue.ts**
```
- Accept array of { input, inputType } pairs (max 50)
- Process in batches of 3 (to respect rate limits)
- Store job status in Redis: { jobId, total, completed, failed, results[] }
- Emit progress updates
```

**Files to create:**
```
backend/src/api/routes/bulk.ts
- POST /api/bulk { inputs: [{input, inputType}] } → returns { jobId, total }
- GET /api/bulk/:jobId → returns job status + completed results

frontend/src/pages/BulkPage.tsx
- CSV upload component (drag & drop)
- Parse CSV (one number per line, or two columns: input,type)
- Show progress: X/Y completed with individual risk levels
- Download results as JSON or CSV
- Add route /bulk to main.tsx
```

---

### PRIORITY 4: Analytics Dashboard

**File to create: frontend/src/pages/AnalyticsPage.tsx**
```
Uses GET /api/stats endpoint (add to backend) to show:
- Total investigations run
- Risk level distribution (pie chart using Recharts PieChart)
- Top fraud categories found (bar chart)  
- Average spam score trend over time (line chart)
- Top telecom circles seen
- Known scam zone hit rate
- Agent performance: avg execution time per agent (bar chart)

Add route /analytics to main.tsx
Add link to Analytics in the header
```

**File to create: backend/src/api/routes/stats.ts**
```
GET /api/stats
- Query postgres for aggregated stats
- Return JSON matching what AnalyticsPage expects
- Cache result for 5 minutes in Redis
```

---

### PRIORITY 5: Input Validation & Security Hardening

**File to create: backend/src/middleware/validate.ts**
```
- Phone number normalisation: strip spaces/dashes, detect country code, validate length
- Email validation with RFC 5321 compliance
- Business name sanitisation (strip SQL/HTML injection)
- Block obviously invalid inputs before they reach Mistral
- Reject inputs that look like SSRF attempts (IP addresses, localhost, internal domains)
```

**File to create: backend/src/middleware/rateLimitByKey.ts**
```
- Per-IP rate limiting (already exists via express-rate-limit)
- Add: API key-based rate limiting for future public API
- Track usage per IP in Redis with sliding window
- Return Retry-After header when limited
```

---

### PRIORITY 6: Missing Config & Type Fixes

**File to update: backend/src/config/index.ts**
```
Add these missing env vars:
- REDIS_URL (for cache)
- DATABASE_URL (for postgres audit log)
- PUPPETEER_EXECUTABLE_PATH (for PDF export on Docker)
- MAX_SEARCH_ITERATIONS (override default 12 per agent, for cost control)
- REPORT_TTL_SECONDS (default 86400)
```

**File to update: backend/package.json**
```
Add missing dependencies:
- "ioredis": "^5.4.1"           (Redis client)
- "pg": "^8.12.0"               (PostgreSQL)
- "@types/pg": "^8.11.6"
- "puppeteer": "^22.0.0"        (PDF export)
- "papaparse": "^5.4.1"         (CSV parsing for bulk)
- "@types/papaparse": "^5.3.14"

Add to frontend/package.json:
- "papaparse": "^5.4.1"         (CSV parsing)
- "@types/papaparse": "^5.3.14"
```

---

### PRIORITY 7: Error UX & Empty States

**File to update: frontend/src/components/report/ReportPanel.tsx**
```
Handle these cases currently showing blank:
- telecom is null → show "Telecom data unavailable" with reason
- spam.totalReportsFound === 0 → show green "No complaints found" with explanation
- digitalIdentity has no emails/names → show "No public digital identity found"
- social has no profiles → show "No public social profiles found"
- location.city is null → show "Location could not be determined" with what signals were found
- Agent failed entirely → show agent error message and what partial data was recovered
```

---

### PRIORITY 8: GitHub Actions CI

**File to create: .github/workflows/ci.yml**
```yaml
name: CI
on: [push, pull_request]
jobs:
  backend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm install
      - run: npx tsc --noEmit

  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm install
      - run: npx tsc --noEmit
      - run: npm run build
```

---

## Architecture to Keep in Mind

```
POST /api/investigate (SSE stream)
    │
    ├─ Check Redis cache first → return immediately if cached
    │
    ▼
Orchestrator (orchestrator/index.ts)
    │
    ├── Phase 1 PARALLEL: Agent1 + Agent2
    │       Each = runMistralAgent() in ai/mistralAgent.ts
    │       Mistral calls web_search tool repeatedly until done
    │       Returns structured JSON findings
    │
    ├── Phase 2 PARALLEL: Agent3 + Agent4 (enriched with Phase 1 context)
    │
    ├── Phase 3: Agent5 (enriched with ALL previous findings)
    │
    ├── Mistral synthesis call (not agentic, single call, JSON output)
    │
    └── computeRisk() → riskLevel + riskScore
    │
    ├─ Save to Redis
    ├─ Log to PostgreSQL (audit)
    └─ Emit report_ready SSE event → client renders ReportPanel
```

## Key Patterns Used (do not change these)

1. **SSE streaming**: `res.write('data: {...}\n\n')` — nginx has `proxy_buffering off`
2. **Agentic loop**: Mistral calls `web_search` tool → we execute real search → return results as `role: 'tool'` → loop until `finishReason !== 'tool_calls'`
3. **Context enrichment**: Agent 5 receives `names[]`, `businessNames[]`, `domains[]` from agents 3+4 so it can search `"[real name] address India"` not just the phone number
4. **Parallel phases**: `Promise.allSettled()` so one agent failing never blocks others
5. **Type safety**: All agent findings are typed in `types/index.ts` — keep adding to these types as new fields are added

## How to Run Locally

```bash
# 1. Add keys to .env
cp .env.example .env
# MISTRAL_API_KEY=...
# SERPER_API_KEY=...  (or TAVILY_API_KEY)

# 2. Backend
cd backend && npm install && npm run dev

# 3. Frontend (separate terminal)
cd frontend && npm install && npm run dev

# App → http://localhost:5173
# API → http://localhost:3001
```

## Environment Variables Reference

| Variable | Required | Where to get |
|----------|----------|--------------|
| `MISTRAL_API_KEY` | YES | https://console.mistral.ai/ |
| `SERPER_API_KEY` | Recommended | https://serper.dev (2500 free/month) |
| `TAVILY_API_KEY` | Alternative | https://tavily.com (1000 free/month) |
| `MISTRAL_MODEL` | No (default: mistral-large-latest) | — |
| `REDIS_URL` | No (falls back to in-memory) | Redis Cloud free tier |
| `DATABASE_URL` | No (skips audit log) | Supabase free tier |
| `PORT` | No (default: 3001) | — |
| `RATE_LIMIT_MAX` | No (default: 5/min) | — |

## Cost Per Investigation

- ~50-70 web searches (Serper: $0.001 each = ~$0.05-0.07)
- ~10,000 Mistral tokens (mistral-large: $0.008/1K = ~$0.08)
- **Total per investigation: ~$0.13-0.15**
