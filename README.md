# Phone Intel v2.0 — Real Multi-Agent OSINT

> Five independent Mistral AI agents that **actually search the internet** and cross-reference findings to build a verified identity and risk profile for any phone number, email, or business.

---

## What Makes This Different

**Old way (broken):** Scrape 3 websites, call it "AI agents."

**This way:** Each agent is an independent Mistral AI instance with web search access. Mistral decides what to search, fires 10-15 queries autonomously, reads the results, and decides if it needs to search more. The orchestrator passes findings from earlier agents into later ones so each one knows what the others found.

```
User Input
    │
    ▼
ORCHESTRATOR (Mistral)
    │
    ├─── PARALLEL ─────────────────────────────────────────────────┐
    │                                                               │
    ▼                                                               ▼
Agent 1: Telecom (Mistral)              Agent 2: Spam (Mistral)
→ Searches TRAI, carrier lookup         → Searches shouldianswer,
→ MNP portability, circle detection       truecaller, consumer forums
→ Number type, registration city          Reddit, news, YouTube
→ 8-12 web searches                     → 12-15 web searches
    │                                               │
    └──────────────────┬────────────────────────────┘
                       │ Findings passed to Phase 2
                       ▼
    ├─── PARALLEL ─────────────────────────────────────────────────┐
    │                                                               │
    ▼                                                               ▼
Agent 3: Digital Identity (Mistral)     Agent 4: Social (Mistral)
→ Searches OLX, Quikr, JustDial         → Searches LinkedIn, Facebook
→ Pastebin, GitHub, WHOIS               → MCA21, GST, eCourts
→ Finds emails, names, domains          → News, YouTube, Google Maps
→ 12-15 web searches                    → 12-15 web searches
    │                                               │
    └──────────────────┬────────────────────────────┘
                       │ ALL findings passed to Agent 5
                       ▼
          Agent 5: Location (Mistral)
          → Uses names, businesses, domains from Agents 3+4
          → Triangulates area from business records
          → Checks against known scam clusters (Jamtara, Mewat, etc.)
          → 10-12 web searches
                       │
                       ▼
          ORCHESTRATOR SYNTHESIS (Mistral)
          → Reads all 5 agent findings
          → Computes risk score (0-100)
          → Writes executive summary
          → Key facts + recommendations
                       │
                       ▼
          FINAL REPORT (streamed live to UI)
```

---

## Quick Start

### 1. Get API Keys

**Required:**
- **Mistral API key** → https://console.mistral.ai/ (pay-per-use, ~$0.008/1K tokens for mistral-large)

**Recommended (pick one):**
- **Serper** → https://serper.dev (2,500 free searches/month — Google results)
- **Tavily** → https://tavily.com (1,000 free searches/month — AI-optimized)

> Without a search key, agents fall back to DuckDuckGo's free instant API. Results will be significantly more limited.

### 2. Configure

```bash
git clone https://github.com/your-org/phone-intel.git
cd phone-intel
cp .env.example .env
```

Edit `.env`:
```env
MISTRAL_API_KEY=your_key_here
SERPER_API_KEY=your_key_here   # or TAVILY_API_KEY
```

### 3. Run

**Docker (recommended):**
```bash
docker-compose up -d
# App: http://localhost
# API: http://localhost:3001
```

**Local dev:**
```bash
# Terminal 1: Backend
cd backend && npm install && npm run dev

# Terminal 2: Frontend  
cd frontend && npm install && npm run dev
# → http://localhost:5173
```

---

## API

### POST /api/investigate

Streams Server-Sent Events (SSE) showing each agent's activity in real-time.

```bash
curl -X POST http://localhost:3001/api/investigate \
  -H "Content-Type: application/json" \
  -d '{"input": "+919876543210", "inputType": "phone"}' \
  --no-buffer
```

**SSE Event types:**
| Event | Description |
|-------|-------------|
| `agent_start` | Agent launched |
| `agent_search` | Agent fired a web search query |
| `agent_complete` | Agent done, findings attached |
| `agent_error` | Agent failed (investigation continues) |
| `report_ready` | Full synthesized report ready |
| `done` | Stream closing |

### GET /api/report/:id

Retrieve a cached report (cached 24h in memory).

### GET /api/health

Returns service status, search provider, and model in use.

---

## Cost Estimate

One investigation (typical):
- ~50-70 web searches across 5 agents
- ~8,000-12,000 Mistral tokens
- **Mistral Large**: ~$0.07-0.12 per investigation
- **Serper searches**: ~$0.01 per 1,000 (free tier covers hundreds of investigations)

---

## What Each Agent Finds

| Agent | Searches | Finds |
|-------|----------|-------|
| **Telecom** | TRAI, carrier lookups, MNP | Operator, telecom circle, city, number type, porting status |
| **Spam** | shouldianswer, truecaller, consumer forums, Reddit, news | Complaint count, fraud categories, caller scripts, modus operandi |
| **Digital Identity** | OLX, Quikr, JustDial, IndiaMart, WHOIS, Pastebin | Emails, real names, usernames, business listings, domains |
| **Social** | LinkedIn, MCA21, GST, eCourts, Google News, YouTube | Social profiles, company registrations, news mentions, court records |
| **Location** | Business directories, IP geo, scam cluster DB | City, district, locality (never residential), scam zone flags |

---

## Privacy Policy

- Only public data searched and displayed
- No residential addresses ever retrieved or stored
- Location intel is area/locality level from public **business** records only
- All reports purged from memory after 24 hours
- Rate limited to 5 investigations/minute per IP

---

## Stack

| Layer | Tech |
|-------|------|
| AI | Mistral AI (mistral-large-latest) |
| Search | Serper (Google) / Tavily / DuckDuckGo |
| Backend | Node.js + Express + TypeScript |
| Streaming | Server-Sent Events (SSE) |
| Frontend | React 18 + Vite + TypeScript + Tailwind |
| Charts | Recharts (radar, bar, gauge) |
| Animation | Framer Motion |
| Deploy | Docker Compose |
