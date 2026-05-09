import { runMistralAgent } from '../ai/mistralAgent.js';
import { AgentFinding, TelecomFindings, SearchResult } from '../types/index.js';

const getSystemPrompt = () => `You are a Telecom Intelligence Agent specializing in phone number analysis.

Your job: Given a phone number, find out EVERYTHING about its telecom characteristics using web search.

Search for:
1. The carrier/operator (Jio, Airtel, Vi, BSNL, AT&T, Verizon, Vodafone, etc.)
2. The telecom circle (state, region, or area code location)
3. The number type (mobile, landline, VoIP, toll-free)
4. The registered city/state/country

Return JSON EXACTLY:
{
  "carrier": "string or null",
  "telecomCircle": "string or null",
  "numberType": "mobile | landline | voip | toll_free | unknown",
  "country": "string or null",
  "isPorted": true | false,
  "portedFrom": "string or null",
  "registeredCity": "string or null",
  "registeredState": "string or null",
  "isActive": true | false | null,
  "traiData": "string or null",
  "confidence": 0-100,
  "searchSummary": "string"
}`;

export async function runTelecomAgent(
  input: string,
  inputType: 'phone' | 'email' | 'name' | 'business',
  onSearch?: (q: string, r: SearchResult[]) => void
): Promise<AgentFinding & { parsed: TelecomFindings }> {
  if (inputType !== 'phone') {
    return {
      agentId: 1,
      agentName: 'Telecom Intelligence',
      status: 'complete',
      searchQueries: [],
      rawSearchResults: [],
      findings: {},
      confidence: 100,
      executionMs: 0,
      parsed: {
        carrier: null, telecomCircle: null, numberType: 'unknown', country: null,
        isPorted: false, portedFrom: null, registeredCity: null, registeredState: null,
        isActive: null, traiData: null
      }
    };
  }

  const cleanInput = input.replace(/\D/g, '');
  const isIndian = cleanInput.length === 10 || (cleanInput.length === 12 && cleanInput.startsWith('91'));
  const prefix = isIndian ? (cleanInput.length === 12 ? cleanInput.substring(2, 6) : cleanInput.substring(0, 4)) : cleanInput.substring(0, 5);

  const result = await runMistralAgent({
    agentId: 1,
    agentName: 'Telecom Intelligence',
    systemPrompt: getSystemPrompt(),
    userMessage: `Investigate this phone number for telecom details: ${input}

You MUST run these EXACT web_search queries:
1. "trace mobile number ${input}"
2. "${prefix} mobile series operator circle" (This checks the telecom prefix registry)
3. "${input} carrier lookup"

Do not just guess. Execute the searches, read the snippets, and extract the carrier/operator and the location. Return JSON.`,
    maxSearchIterations: 10,
    onSearch,
  });

  const f = result.findings as Partial<TelecomFindings>;
  const parsed: TelecomFindings = {
    carrier: f.carrier ?? null,
    telecomCircle: f.telecomCircle ?? null,
    numberType: f.numberType ?? 'unknown',
    country: f.country ?? 'India',
    isPorted: f.isPorted ?? false,
    portedFrom: f.portedFrom ?? null,
    registeredCity: f.registeredCity ?? null,
    registeredState: f.registeredState ?? null,
    isActive: f.isActive ?? null,
    traiData: f.traiData ?? null,
  };

  return { ...result, parsed };
}
