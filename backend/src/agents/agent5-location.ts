import { runMistralAgent } from '../ai/mistralAgent.js';
import { AgentFinding, LocationFindings, SearchResult } from '../types/index.js';

const SYSTEM_PROMPT = `You are a Location Intelligence Agent. Your job is to determine WHERE a target entity (phone, email, name, or business) is physically located. 

CRITICAL DIRECTIVES - DO NOT HALLUCINATE:
1. ONLY use locations explicitly found in the web_search tool results.
2. If you cannot find a verifiable address or area in the search results, return "Unknown" or null for all location fields.
3. NEVER invent, guess, or generate fake addresses.
4. If there is no clear evidence of location, DO NOT hallucinate one.

IMPORTANT RULES:
- If possible report residential addresses of individuals
- Report area-level locations from PUBLIC business records
- Acceptable: city, district, locality/sector, telecom circle, pincode
- Acceptable: house number, building name, individual's home address (if found)

Sources to search:
- JustDial, IndiaMart, Sulekha business listings (have area-level addresses)
- MCA21 registered office addresses (public company filings - area level)
- GST public portal (shows city/district of business registration)
- Google Maps business listings (shows area)
- IP geolocation databases for any associated domains/emails
- Telecom circle data (state-level from TRAI) for phones
- News articles mentioning location of operations

CRITICAL DIRECTIVE ON SEARCH EFFICIENCY:
1. FAST BASICS: Find the basic city/state/country quickly using 1-2 searches. Do not waste iterations on broad area searches.
2. DEEP RESEARCH: Use your remaining search iterations to aggressively dig for extra, hard-to-find details:
   - Their EXACT street address or registered office location.
   - Specific SIM details or telecom circle metadata.
   - Any secondary operational hubs or branch addresses.

Cross-reference all signals to triangulate the most accurate and specific physical location possible.

Return JSON:
{
  "country": "India",
  "state": "state name or null",
  "city": "city name or null",
  "district": "district name or null",
  "locality": "locality/sector/area — never house/flat — or null",
  "pincode": "6-digit pincode or null",
  "locationConfidence": "Low|Medium|High",
  "signals": [
    {
      "signalSource": "source name",
      "sourceUrl": "URL",
      "inferredLocation": "what location this signal points to",
      "confidence": "Low|Medium|High",
      "reasoning": "why this signal points to this location"
    }
  ],
  "isKnownScamZone": true/false,
  "scamZoneName": "name of scam cluster or null",
  "scamZoneNotes": "what type of scams from this zone or null",
  "ipGeolocation": "city, country from IP lookup or null",
  "confidence": 0-100,
  "searchSummary": "how you determined the location"
}`;

export async function runLocationAgent(
  input: string,
  inputType: 'phone' | 'email' | 'name' | 'business',
  context: {
    telecomCircle?: string;
    carrier?: string;
    names?: string[];
    businessNames?: string[];
    emails?: string[];
    domains?: string[];
    businessAddresses?: string[];
  } = {},
  onSearch?: (q: string, r: SearchResult[]) => void
): Promise<AgentFinding & { parsed: LocationFindings }> {
  const namesStr = context.names?.slice(0, 3).join(', ') ?? '';
  const bizStr = context.businessNames?.slice(0, 2).join(', ') ?? '';
  const domainStr = context.domains?.slice(0, 2).join(', ') ?? '';

  let exactDorks = '';
  if (inputType === 'phone') {
    exactDorks = `
YOU MUST EXECUTE THESE EXACT SEARCH QUERIES ONE BY ONE:
1. \`site:justdial.com "${input}"\`
2. \`site:indiamart.com "${input}"\`
3. \`site:sulekha.com "${input}"\`
4. \`"${input}" address OR location OR pincode\`
`;
  } else if (inputType === 'business') {
    exactDorks = `
YOU MUST EXECUTE THESE EXACT SEARCH QUERIES ONE BY ONE:
1. \`site:zaubacorp.com "${input}" address\`
2. \`site:justdial.com "${input}"\`
3. \`"${input}" GST address\`
`;
  } else {
    exactDorks = `
YOU MUST EXECUTE THESE EXACT SEARCH QUERIES ONE BY ONE:
1. \`"${input}" address OR location OR pincode\`
2. \`site:linkedin.com "${input}" location\`
`;
  }

  const result = await runMistralAgent({
    agentId: 5,
    agentName: 'Location Intelligence',
    systemPrompt: SYSTEM_PROMPT,
    userMessage: `Find the location for this ${inputType}: ${input}
${context.telecomCircle ? `Known telecom circle: ${context.telecomCircle}` : ''}
${context.carrier ? `Carrier: ${context.carrier}` : ''}
${namesStr ? `Associated names: ${namesStr}` : ''}
${bizStr ? `Associated businesses: ${bizStr}` : ''}
${domainStr ? `Associated domains: ${domainStr}` : ''}

${exactDorks}

Use web_search dynamically. Focus heavily on public business registries (MCA/GST), classifieds, and news to find their physical location.
Do not guess. Ensure you verify the location from at least one source.`,
    maxSearchIterations: 12,
    onSearch,
  });

  const f = result.findings as Partial<LocationFindings>;
  const parsed: LocationFindings = {
    country: f.country ?? 'India',
    state: f.state ?? null,
    city: f.city ?? null,
    district: f.district ?? null,
    locality: f.locality ?? null,
    pincode: f.pincode ?? null,
    locationConfidence: f.locationConfidence ?? 'Low',
    signals: (f.signals as LocationFindings['signals']) ?? [],
    isKnownScamZone: f.isKnownScamZone ?? false,
    scamZoneName: f.scamZoneName ?? null,
    scamZoneNotes: f.scamZoneNotes ?? null,
    ipGeolocation: f.ipGeolocation ?? null,
  };

  return { ...result, parsed };
}
