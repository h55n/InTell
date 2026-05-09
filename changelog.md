# Fonum Intelligence Platform - Changelog

## [v2.5.0] - 2026-05-09
### Major Architectural Pivot: Financial & OSINT Dossier Engine
- **Agent 6 (Financial Intelligence)**: Specialized agent for tracking corporate/personal financial health (Funding, Loans, MCA Charges).
- **5-Star Trust Rating System**: Intuitive 1.0–5.0 star rating replacing 0-100 risk scores.
- **Safety Verdict**: Added "SAFE" / "UNSAFE" badges for instant verification.
- **Intelligence Dossier UI**: New layout with Image Grids, Discovered Contact Networks, and Financial Panels.
- **Agent Hardening**: Simplified prompts for Agent 3 (Identity) and Agent 4 (Social) to ensure populated reports and strict JSON extraction.
- **Orchestrator v2**: Enhanced data synthesis to aggregate multi-vector contact details and image arrays.

## [v2.0.0] - 2026-05-08
### Universal Intelligence Upgrade
- **Universal Target Support**: Transitioned from phone-only to support Phone, Email, Name, and Business entities.
- **Mistral AI Integration**: Successfully migrated to `Mistral-large-latest` for high-fidelity reasoning.
- **Google Dorking Matrix**: Implemented aggressive dorking strategies to bypass API restrictions on Truecaller, Eyecon, and Sync.me.
- **Conditional Masking**: Logic implemented to hide irrelevant panels (e.g., Telecom) for non-phone inputs.
- **Error Resolution**: Fixed SDK message-ordering issues (`user -> assistant -> tool`) and 400 Bad Request errors.

## [v1.5.0] - 2026-05-07
### OSINT Orchestration Layer
- **Multi-Agent Pipeline**: Deployed the first 5 agents (Telecom, Spam, Identity, Social, Location).
- **Search Layer Abstraction**: Integrated Serper, Tavily, and DuckDuckGo for resilient internet research.
- **Streaming UI**: Implemented real-time investigation updates via Server-Sent Events (SSE).
- **PDF Generation**: Added Puppeteer-based report export functionality.

## [v1.0.0] - 2026-04-30
### Initial Prototype
- Core architecture setup with Vite (Frontend) and Express (Backend).
- Basic phone number lookup via local data providers.
- Initial UI design with dark-mode aesthetic.

---
