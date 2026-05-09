import { runMistralAgent } from '../ai/mistralAgent.js';
import { AgentFinding, SpamFindings, SearchResult } from '../types/index.js';

const getSystemPrompt = (input: string) => `You are a Spam & Fraud Intelligence Agent. Your job is to find ALL public reports, complaints, and evidence of fraudulent activity linked to an entity.

CRITICAL DIRECTIVES - DO NOT HALLUCINATE:
1. ONLY use information explicitly found in the web_search tool results.
2. If there are no spam reports found, set totalReportsFound to 0 and confidence to "None".
3. NEVER invent fake reports, names, comments, or spam categories.
4. If no results are found, state clearly that no spam/fraud activity was detected.

Search AGGRESSIVELY using OSINT Pivots depending on the entity type:
- For Phone Numbers: \`site:shouldianswer.com "${input}"\`, \`site:quora.com "${input} scam"\`, Reddit, caller forums.
- For Emails: scamwarners, \`site:stopforumspam.com "${input}"\`, phishing databases.
- For Names: \`"${input}" (fraud OR scam OR arrested OR FIR OR absconding)\`, fugitive lists, court records.
- For Businesses: \`site:glassdoor.com "${input} fraud"\`, \`site:consumercomplaints.in "${input}"\`, scam company alerts, Reddit.

DO NOT give up if the first query returns nothing. Try variations:
- \`"${input} scam"\`
- \`"${input} fake"\`
- \`"${input} fraud"\`
- \`"${input} complaints"\`

For EACH source found, extract:
- How many people reported it
- What category of fraud (KYC, loan, lottery, fake police, tech support, etc.)
- What names/scripts callers used
- When it was first/last reported

Return JSON:
{
  "totalReportsFound": number,
  "spamScore": 0-100,
  "confidence": 0-100,
  "confidence_label": "None|Low|Medium|High|Confirmed",
  "categories": ["Banking / KYC Fraud", "Loan Fraud", etc],
  "sourceSummaries": [
    {
      "source": "site name",
      "url": "actual URL found",
      "reportCount": number,
      "category": "fraud type",
      "excerpt": "what victims said"
    }
  ],
  "firstSeen": "date or null",
  "lastSeen": "date or null",
  "knownNames": ["names the caller gave"],
  "modus": "description of how the scam works",
  "searchSummary": "overall summary"
}`;

export async function runSpamAgent(
  input: string,
  inputType: 'phone' | 'email' | 'name' | 'business',
  onSearch?: (q: string, r: SearchResult[]) => void
): Promise<AgentFinding & { parsed: SpamFindings }> {
  let exactDorks = '';
  if (inputType === 'phone') {
    exactDorks = `
YOU MUST EXECUTE THESE EXACT SEARCH QUERIES ONE BY ONE:
1. \`site:reddit.com "${input}" scam OR fraud\`
2. \`site:shouldianswer.com "${input}"\`
3. \`site:quora.com "${input}" fraud OR scam\`
4. \`site:twitter.com "${input}" fake OR scam\`
5. \`"${input}" consumer complaints\`
`;
  } else if (inputType === 'business') {
    exactDorks = `
YOU MUST EXECUTE THESE EXACT SEARCH QUERIES ONE BY ONE:
1. \`site:glassdoor.com "${input} fraud"\`
2. \`site:consumercomplaints.in "${input}"\`
3. \`site:reddit.com "${input}" scam\`
4. \`"${input}" (fake OR scam OR fraud OR complaint)\`
`;
  } else {
    exactDorks = `
YOU MUST EXECUTE THESE EXACT SEARCH QUERIES ONE BY ONE:
1. \`"${input}" (fraud OR scam OR arrested OR FIR OR absconding)\`
2. \`site:reddit.com "${input}" scam\`
3. \`site:stopforumspam.com "${input}"\`
`;
  }

  const result = await runMistralAgent({
    agentId: 2,
    agentName: 'Spam & Complaint Intelligence',
    systemPrompt: getSystemPrompt(input),
    userMessage: `Find ALL spam reports, complaints, scam warnings, and fraud history for this ${inputType}: ${input}

${exactDorks}

Use the web_search tool dynamically and creatively. You MUST perform deep OSINT searching. 
Do not rely on a fixed list of queries. Surf the open internet. 

Search across forums, Reddit, Truecaller, consumer complaint boards, news sites, etc.
If a search yields nothing, ALTER your query and try advanced search operators like "site:domain.com".
Example: Search for \`"swiggy scam"\` -> Read a complaint -> Search for the specific phone number or email mentioned in that complaint to verify it.

After exhaustive searching (use at least 10 iterations if needed), determine: Is this entity a scam/fraud? What type? How many victims/complaints? Return JSON.`,
    maxSearchIterations: 18,
    onSearch,
  });

  const f = result.findings as Partial<SpamFindings & { confidence_label: string }>;
  const parsed: SpamFindings = {
    totalReportsFound: (f.totalReportsFound as number) ?? 0,
    spamScore: (f.spamScore as number) ?? 0,
    confidence: (f.confidence_label ?? f.confidence ?? 'None') as SpamFindings['confidence'],
    categories: (f.categories as string[]) ?? [],
    sourceSummaries: (f.sourceSummaries as SpamFindings['sourceSummaries']) ?? [],
    firstSeen: f.firstSeen ?? null,
    lastSeen: f.lastSeen ?? null,
    knownNames: (f.knownNames as string[]) ?? [],
    modus: f.modus ?? null,
  };

  return { ...result, parsed };
}
