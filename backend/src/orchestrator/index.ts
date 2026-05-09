import { Mistral } from '@mistralai/mistralai';
import { v4 as uuidv4 } from 'uuid';
import {
  InvestigationReport, AgentFinding, SearchResult, StreamEvent, RiskLevel,
} from '../types/index.js';
import { runTelecomAgent } from '../agents/agent1-telecom.js';
import { runSpamAgent } from '../agents/agent2-spam.js';
import { runDigitalIdentityAgent } from '../agents/agent3-identity.js';
import { runSocialAgent } from '../agents/agent4-social.js';
import { runLocationAgent } from '../agents/agent5-location.js';
import { runFinancialAgent } from '../agents/agent6-financial.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

// ─── Retry helper ─────────────────────────────────────────────────────────────

async function sleep(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)); }

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 6): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try { return await fn(); }
    catch (err: unknown) {
      lastErr = err;
      const statusCode = (err as { statusCode?: number }).statusCode;
      const msg = err instanceof Error ? err.message : String(err);
      const is429 = statusCode === 429 || msg.includes('429') || msg.toLowerCase().includes('rate limit');
      if (!is429 || attempt === maxRetries) throw err;
      const delay = Math.min(2000 * Math.pow(2, attempt), 60000);
      logger.warn(`[Mistral/Orchestrator] 429 — retrying in ${Math.round(delay / 1000)}s`);
      await sleep(delay);
    }
  }
  throw lastErr;
}

const mistral = new Mistral({ apiKey: config.mistralApiKey });

// ─── Trust Rating Scorer ────────────────────────────────────────────────────────

function computeRating(
  spamScore: number,
  isScamZone: boolean,
  reportCount: number,
  hasCompanyStruckOff: boolean,
  hasCourtRecord: boolean,
  hasOfficialWebsite: boolean,
  hasFunding: boolean
): { rating: number; safetyVerdict: 'safe' | 'unsafe' } {
  // Start with a perfect 5.0 rating
  let rating = 5.0;

  // Deductions based on negative signals
  if (spamScore > 50) rating -= 1.5;
  else if (spamScore > 20) rating -= 0.5;

  if (reportCount > 50) rating -= 1.0;
  else if (reportCount > 5) rating -= 0.5;

  if (isScamZone) rating -= 1.0;
  if (hasCompanyStruckOff) rating -= 2.0;
  if (hasCourtRecord) rating -= 1.5;

  // Bonuses for transparency
  if (hasOfficialWebsite && rating < 5.0) rating += 0.5;
  if (hasFunding && rating < 5.0) rating += 0.5;

  // Bound between 1.0 and 5.0
  rating = Math.max(1.0, Math.min(5.0, rating));
  
  // Round to nearest 0.5
  rating = Math.round(rating * 2) / 2;

  const safetyVerdict = rating >= 3.0 ? 'safe' : 'unsafe';

  return { rating, safetyVerdict };
}

// ─── Final Synthesis (Mistral summarises all findings) ────────────────────────

async function synthesize(
  input: string,
  agents: AgentFinding[],
): Promise<{ summary: string; summaryPoints: string[]; inferredProvider: string | null; inferredLocation: string | null; profileImageUrls: string[]; extractedContacts: Array<{ type: 'phone' | 'email' | 'social'; value: string }>; keyFacts: string[]; recommendations: string[] }> {
  const allFindings = agents.map((a) => ({
    agent: a.agentName,
    status: a.status,
    findings: a.findings,
    searchCount: a.searchQueries.length,
  }));

  try {
    const response = await withRetry(() => mistral.chat.complete({
      model: config.mistralModel,
      messages: [
        {
          role: 'system',
          content: `You are an OSINT Intelligence Analyst. Given findings from 6 specialized investigation agents about a target entity, write a clear, point-wise synthesis dossier.
          
CRITICAL DIRECTIVES - DO NOT HALLUCINATE:
1. Extract ALL image URLs found in the findings and place them in 'profileImageUrls'.
2. Extract ALL unique emails, phone numbers, and social media handles into 'extractedContacts'.
3. Keep the summary SHORT and POINT-WISE. Use bullet points (using hyphens) in the summary field.

Output JSON:
{
  "summaryPoints": ["Short, crisp bullet point 1", "Short bullet point 2", "Short bullet point 3"],
  "inferredProvider": "Provider/Carrier/Company Category or 'Unknown'",
  "inferredLocation": "City/Area or 'Unknown'",
  "profileImageUrls": ["url1", "url2"],
  "extractedContacts": [
    { "type": "phone", "value": "..." },
    { "type": "email", "value": "..." },
    { "type": "social", "value": "..." }
  ],
  "keyFacts": ["fact 1", "fact 2", ... up to 5 short key facts],
  "recommendations": ["recommendation 1", "recommendation 2", ... up to 3 short actionable items"]
}`,
        },
        {
          role: 'user',
          content: `Synthesize these investigation findings for the target: ${input}

${JSON.stringify(allFindings, null, 2)}

Write a very short, point-wise summary of their complete profile, financials, and scam risks. Do not hallucinate.`,
        },
      ],
      responseFormat: { type: 'json_object' },
      temperature: 0.2,
      maxTokens: 2048,
    }));

    const raw = response.choices?.[0]?.message?.content as string ?? '{}';
    const parsed = JSON.parse(raw) as { summaryPoints?: string[]; inferredProvider?: string | null; inferredLocation?: string | null; profileImageUrls?: string[]; extractedContacts?: Array<{ type: 'phone' | 'email' | 'social'; value: string }>; keyFacts?: string[]; recommendations?: string[] };
    return {
      summary: parsed.summaryPoints?.join('\n') ?? 'Investigation complete.',
      summaryPoints: parsed.summaryPoints ?? [],
      inferredProvider: parsed.inferredProvider ?? null,
      inferredLocation: parsed.inferredLocation ?? null,
      profileImageUrls: parsed.profileImageUrls ?? [],
      extractedContacts: parsed.extractedContacts ?? [],
      keyFacts: parsed.keyFacts ?? [],
      recommendations: parsed.recommendations ?? [],
    };
  } catch {
    return {
      summary: 'Investigation complete. See individual agent findings for details.',
      summaryPoints: [],
      inferredProvider: null,
      inferredLocation: null,
      profileImageUrls: [],
      extractedContacts: [],
      keyFacts: [],
      recommendations: ['Review each agent\'s findings carefully.'],
    };
  }
}

// ─── Main Orchestrator ────────────────────────────────────────────────────────

export async function orchestrate(
  input: string,
  inputType: 'phone' | 'email' | 'name' | 'business',
  emit: (event: StreamEvent) => void,
): Promise<InvestigationReport> {
  const reportId = uuidv4();
  const startTime = Date.now();
  const allSources: SearchResult[] = [];
  const agentLogs: AgentFinding[] = [];

  const ts = () => new Date().toISOString();
  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  logger.info('[Orchestrator] Investigation started', { reportId, input, inputType });

  // ── Helper: emit agent search events ────────────────────────────────────────
  function makeOnSearch(agentId: number, agentName: string) {
    return (query: string, results: SearchResult[]) => {
      allSources.push(...results);
      emit({ type: 'agent_search', agentId, agentName, query, result: { count: results.length }, timestamp: ts() });
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 1: Agent 1 (Telecom) starts first, Agent 2 (Spam) 1.5s later
  // Staggered to avoid simultaneous Mistral API rate limiting
  // ════════════════════════════════════════════════════════════════════════════

  emit({ type: 'agent_start', agentId: 1, agentName: 'Telecom Intelligence', timestamp: ts() });

  const telecomPromise = runTelecomAgent(input, inputType, makeOnSearch(1, 'Telecom Intelligence'));

  // 1.5s gap before Agent 2 fires its first Mistral call
  await wait(1500);
  emit({ type: 'agent_start', agentId: 2, agentName: 'Spam & Complaint Intelligence', timestamp: ts() });
  const spamPromise = runSpamAgent(input, inputType, makeOnSearch(2, 'Spam & Complaint Intelligence'));

  const [telecomResult, spamResult] = await Promise.allSettled([telecomPromise, spamPromise]);

  const telecom = telecomResult.status === 'fulfilled' ? telecomResult.value : null;
  const spam = spamResult.status === 'fulfilled' ? spamResult.value : null;

  if (telecom) { agentLogs.push(telecom); emit({ type: 'agent_complete', agentId: 1, agentName: 'Telecom Intelligence', result: telecom.parsed, timestamp: ts() }); }
  if (spam) { agentLogs.push(spam); emit({ type: 'agent_complete', agentId: 2, agentName: 'Spam & Complaint Intelligence', result: spam.parsed, timestamp: ts() }); }

  // Extract context to enrich downstream agents
  const telecomCtx = {
    carrier: telecom?.parsed.carrier ?? undefined,
    telecomCircle: telecom?.parsed.telecomCircle ?? undefined,
  };

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 2: Agent 3 (Digital Identity) + Agent 4 (Social) — 2s gap after Phase 1
  // ════════════════════════════════════════════════════════════════════════════

  await wait(2000); // let Mistral rate limiter recover after Phase 1

  emit({ type: 'agent_start', agentId: 3, agentName: 'Digital Identity', timestamp: ts() });
  const identityPromise = runDigitalIdentityAgent(input, inputType, telecomCtx, makeOnSearch(3, 'Digital Identity'));

  await wait(1500); // stagger agent 4
  emit({ type: 'agent_start', agentId: 4, agentName: 'Social & Web Presence', timestamp: ts() });
  
  const socialCtx = {
    names: inputType === 'name' ? [input] : [],
    businessNames: inputType === 'business' ? [input] : []
  };

  const socialPromise = runSocialAgent(
    input,
    inputType,
    socialCtx,
    makeOnSearch(4, 'Social & Web Presence')
  );

  const [identityResult, socialResult] = await Promise.allSettled([identityPromise, socialPromise]);

  const identity = identityResult.status === 'fulfilled' ? identityResult.value : null;
  const social = socialResult.status === 'fulfilled' ? socialResult.value : null;

  if (identity) { agentLogs.push(identity); emit({ type: 'agent_complete', agentId: 3, agentName: 'Digital Identity', result: identity.parsed, timestamp: ts() }); }
  if (social) { agentLogs.push(social); emit({ type: 'agent_complete', agentId: 4, agentName: 'Social & Web Presence', result: social.parsed, timestamp: ts() }); }

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 3: Agent 5 (Location) — enriched with ALL previous findings
  // ════════════════════════════════════════════════════════════════════════════

  const namesFromIdentity = identity?.parsed.associatedNames.map((n) => n.name) ?? [];
  const namesFromSocial = social?.parsed.socialProfiles.map((p) => p.name).filter(Boolean) as string[] ?? [];
  const allNames = [...new Set([...namesFromIdentity, ...namesFromSocial])];

  const bizFromIdentity = identity?.parsed.businessListings.map((b) => b.name) ?? [];
  const bizFromSocial = social?.parsed.companyRegistrations.map((c) => c.name) ?? [];
  const allBiz = [...new Set([...bizFromIdentity, ...bizFromSocial])];

  const domainsFromIdentity = identity?.parsed.associatedDomains.map((d) => d.domain) ?? [];

  emit({ type: 'agent_start', agentId: 5, agentName: 'Location Intelligence', timestamp: ts() });

  const locationResult = await runLocationAgent(
    input,
    inputType,
    {
      telecomCircle: telecom?.parsed.telecomCircle ?? undefined,
      carrier: telecom?.parsed.carrier ?? undefined,
      names: allNames,
      businessNames: allBiz,
      domains: domainsFromIdentity,
    },
    makeOnSearch(5, 'Location Intelligence')
  );

  agentLogs.push(locationResult);
  emit({ type: 'agent_complete', agentId: 5, agentName: 'Location Intelligence', result: locationResult.parsed, timestamp: ts() });

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 4: Agent 6 (Financial)
  // ════════════════════════════════════════════════════════════════════════════

  emit({ type: 'agent_start', agentId: 6, agentName: 'Financial Intelligence', timestamp: ts() });

  const financialResult = await runFinancialAgent(
    input,
    inputType,
    {
      names: allNames,
      businessNames: allBiz,
      domains: domainsFromIdentity,
    },
    makeOnSearch(6, 'Financial Intelligence')
  );

  agentLogs.push(financialResult);
  emit({ type: 'agent_complete', agentId: 6, agentName: 'Financial Intelligence', result: financialResult.parsed, timestamp: ts() });

  // ════════════════════════════════════════════════════════════════════════════
  // COMPUTE RATING + SYNTHESIZE
  // ════════════════════════════════════════════════════════════════════════════

  const spamScore = spam?.parsed.spamScore ?? 0;
  const isScamZone = locationResult.parsed.isKnownScamZone ?? false;
  const reportCount = spam?.parsed.totalReportsFound ?? 0;
  const hasStruckOff = social?.parsed.companyRegistrations.some((c) => c.status?.toLowerCase().includes('struck')) ?? false;
  const hasCourtRecord = (social?.parsed.courtRecords.length ?? 0) > 0;
  const hasOfficialWebsite = (social?.parsed.socialProfiles.length ?? 0) > 0 || domainsFromIdentity.length > 0;
  const hasFunding = (financialResult.parsed.fundingRounds ?? 0) > 0;

  const { rating, safetyVerdict } = computeRating(
    spamScore,
    isScamZone,
    reportCount,
    hasStruckOff,
    hasCourtRecord,
    hasOfficialWebsite,
    hasFunding
  );

  const synthesis = await synthesize(input, agentLogs);

  // Deduplicate sources
  const seenUrls = new Set<string>();
  const dedupedSources = allSources.filter((s) => {
    if (seenUrls.has(s.url)) return false;
    seenUrls.add(s.url);
    return true;
  });

  const report: InvestigationReport = {
    id: reportId,
    input,
    inputType,
    createdAt: new Date().toISOString(),
    status: agentLogs.some((a) => a.status === 'complete') ? 'complete' : 'partial',
    executionMs: Date.now() - startTime,
    rating,
    safetyVerdict,
    riskReasoning: synthesis.summary,
    telecom: telecom?.parsed ?? null,
    spam: spam?.parsed ?? null,
    digitalIdentity: identity?.parsed ?? null,
    social: social?.parsed ?? null,
    location: locationResult.parsed,
    financial: financialResult.parsed,
    agentLogs,
    sources: dedupedSources,
    summary: synthesis.summary,
    summaryPoints: synthesis.summaryPoints,
    inferredProvider: synthesis.inferredProvider,
    inferredLocation: synthesis.inferredLocation,
    profileImageUrls: synthesis.profileImageUrls,
    extractedContacts: synthesis.extractedContacts,
    keyFacts: synthesis.keyFacts,
    recommendations: synthesis.recommendations,
  };

  logger.info('[Orchestrator] Complete', { reportId, rating, safetyVerdict, executionMs: report.executionMs });

  emit({ type: 'report_ready', report, timestamp: ts() });
  return report;
}
