import { runMistralAgent } from '../ai/mistralAgent.js';
import { AgentFinding, DigitalIdentityFindings, SearchResult } from '../types/index.js';

const SYSTEM_PROMPT = `You are an elite OSINT (Open Source Intelligence) Investigator. Your job is to find the real person or business behind the input, and map out their entire digital footprint using chained "Pivot Searching".

OSINT PIVOT SEARCHING DIRECTIVE:
1. If you find a Name -> Search for their LinkedIn/Facebook/Instagram.
2. If you find a LinkedIn -> Search for their Resume/CV (e.g., \`site:linkedin.com/in "Name" resume\`).
3. If you find a Resume or Portfolio -> Extract any Emails or Phone Numbers.
4. If you find an Email -> Search for GitHub, Pastebin leaks, or other registered accounts (\`"email" site:github.com\`).
5. NEVER GIVE UP. If a direct search fails, find alternative pathways (e.g., finding a company's director, then searching the director's name to find their contact info).

CRITICAL: Extract ALL EMAIL ADDRESSES and PHONE NUMBERS you uncover during your pivots. 

Return JSON ONLY:
{
  "associatedEmails": [{"email": "...", "source": "...", "url": "..."}],
  "associatedNames": [{"name": "...", "source": "...", "url": "..."}],
  "associatedUsernames": [{"username": "...", "platform": "...", "url": "..."}],
  "associatedDomains": [{"domain": "...", "whois": "...", "url": "..."}],
  "classifiedAds": [{"platform": "...", "title": "...", "url": "...", "snippet": "..."}],
  "businessListings": [{"name": "...", "platform": "...", "url": "...", "address": "..."}],
  "pasteFinds": [{"url": "...", "snippet": "..."}],
  "confidence": 0-100,
  "searchSummary": "Detail the chain of how you found the information."
}`;

export async function runDigitalIdentityAgent(
  input: string,
  inputType: 'phone' | 'email' | 'name' | 'business',
  enrichedContext: { carrier?: string; telecomCircle?: string } = {},
  onSearch?: (q: string, r: SearchResult[]) => void
): Promise<AgentFinding & { parsed: DigitalIdentityFindings }> {
  let exactDorks = '';
  if (inputType === 'phone') {
    const cleanInput = input.replace(/\D/g, '');
    const inFormat = cleanInput.length === 10 ? `+91${cleanInput}` : `+${cleanInput}`;
    const spacedFormat = cleanInput.length === 10 ? `${cleanInput.substring(0,5)} ${cleanInput.substring(5)}` : input;
    
    exactDorks = `
YOU MUST EXECUTE THESE EXACT SEARCH QUERIES ONE BY ONE:
1. \`site:truecaller.com "${inFormat}" OR "${input}"\`
2. \`site:facebook.com "${input}" OR "${inFormat}"\`
3. \`site:instagram.com "${input}" OR "${inFormat}"\`
4. \`site:justdial.com "${input}" OR "${spacedFormat}"\`
5. \`site:indiamart.com "${input}" OR "${spacedFormat}"\`
6. \`"${input}" resume OR cv filetype:pdf\`
`;
  } else {
    exactDorks = `
YOU MUST EXECUTE THESE EXACT SEARCH QUERIES ONE BY ONE:
1. \`"${input}"\`
2. \`site:linkedin.com/in "${input}"\`
3. \`site:facebook.com "${input}"\`
4. \`"${input}" @gmail.com OR @yahoo.com\`
5. \`site:zaubacorp.com "${input}"\`
6. \`site:pastebin.com "${input}"\`
`;
  }

  const result = await runMistralAgent({
    agentId: 3,
    agentName: 'Digital Identity',
    systemPrompt: SYSTEM_PROMPT,
    userMessage: `Perform an exhaustive OSINT investigation on this ${inputType}: ${input}
${enrichedContext.telecomCircle ? `Known telecom circle: ${enrichedContext.telecomCircle}` : ''}
${enrichedContext.carrier ? `Carrier: ${enrichedContext.carrier}` : ''}

${exactDorks}

You are required to CHAIN your searches. 
Example: Find official website -> Find "About Us" page for employee names -> Search employee names on LinkedIn -> Find their emails.

Do NOT stop until you have executed ALL the required queries above and exhausted at least 10 different search angles. You MUST populate the JSON arrays if any data exists on the public internet.`,
    maxSearchIterations: 20,
    onSearch,
  });

  const f = result.findings as Partial<DigitalIdentityFindings>;
  const parsed: DigitalIdentityFindings = {
    associatedEmails: (f.associatedEmails as DigitalIdentityFindings['associatedEmails']) ?? [],
    associatedNames: (f.associatedNames as DigitalIdentityFindings['associatedNames']) ?? [],
    associatedUsernames: (f.associatedUsernames as DigitalIdentityFindings['associatedUsernames']) ?? [],
    associatedDomains: (f.associatedDomains as DigitalIdentityFindings['associatedDomains']) ?? [],
    classifiedAds: (f.classifiedAds as DigitalIdentityFindings['classifiedAds']) ?? [],
    businessListings: (f.businessListings as DigitalIdentityFindings['businessListings']) ?? [],
    pasteFinds: (f.pasteFinds as DigitalIdentityFindings['pasteFinds']) ?? [],
  };

  return { ...result, parsed };
}
