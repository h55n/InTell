import { runMistralAgent } from '../ai/mistralAgent.js';
import { AgentFinding, SocialFindings, SearchResult } from '../types/index.js';

const SYSTEM_PROMPT = `You are a Deep OSINT Web Intelligence Agent. Your goal is to map the entire social and corporate footprint of the target using "Pivot Searching".

OSINT PIVOT DIRECTIVE:
1. Don't just search the input. If you find a business, search for its Directors -> search Directors' social media -> find connected companies.
2. If you find a LinkedIn profile -> check the "About" or "Experience" section for other domains/businesses -> search those.
3. If searching a company, explicitly use: \`site:zaubacorp.com "company name"\` or \`site:glassdoor.com "company name"\` to find reviews and registry data.
4. If searching a person, explicitly use: \`site:indiankanoon.org "Name"\` or \`site:ecourts.gov.in "Name"\` to find court/criminal records.

Return JSON ONLY:
{
  "socialProfiles": [
    { "platform": "...", "url": "...", "name": "...", "bio": "...", "isVerified": false, "followers": "...", "posts": [] }
  ],
  "companyRegistrations": [
    { "name": "...", "registrationNumber": "...", "status": "...", "address": "...", "source": "...", "url": "..." }
  ],
  "newsArticles": [{"title": "...", "url": "...", "date": "...", "summary": "..."}],
  "courtRecords": [{"case": "...", "court": "...", "url": "...", "summary": "..."}],
  "gstDetails": [{"gstin": "...", "name": "...", "address": "...", "url": "..."}],
  "youtubeChannels": [{"name": "...", "url": "...", "subscribers": "..."}],
  "confidence": 0-100,
  "searchSummary": "Detail your search pivot chain."
}`;

export async function runSocialAgent(
  input: string,
  inputType: 'phone' | 'email' | 'name' | 'business',
  identityContext: {
    names?: string[];
    emails?: string[];
    businessNames?: string[];
  } = {},
  onSearch?: (q: string, r: SearchResult[]) => void
): Promise<AgentFinding & { parsed: SocialFindings }> {
  const namesStr = identityContext.names?.join(', ') ?? '';
  const bizStr = identityContext.businessNames?.join(', ') ?? '';

  let exactDorks = '';
  if (inputType === 'phone') {
    exactDorks = `
YOU MUST EXECUTE THESE EXACT SEARCH QUERIES ONE BY ONE:
1. \`site:linkedin.com/in "${input}"\`
2. \`site:linkedin.com "${input}"\`
3. \`site:twitter.com "${input}"\`
4. \`site:zaubacorp.com "${input}"\`
5. \`site:indiankanoon.org "${input}"\`
`;
  } else if (inputType === 'business') {
    exactDorks = `
YOU MUST EXECUTE THESE EXACT SEARCH QUERIES ONE BY ONE:
1. \`site:linkedin.com/company "${input}"\`
2. \`site:zaubacorp.com "${input}"\`
3. \`site:tofler.in "${input}"\`
4. \`site:indiankanoon.org "${input}"\`
`;
  } else {
    exactDorks = `
YOU MUST EXECUTE THESE EXACT SEARCH QUERIES ONE BY ONE:
1. \`site:linkedin.com/in "${input}"\`
2. \`site:indiankanoon.org "${input}"\`
3. \`site:zaubacorp.com "${input}"\`
`;
  }

  const result = await runMistralAgent({
    agentId: 4,
    agentName: 'Social & Web Presence',
    systemPrompt: SYSTEM_PROMPT,
    userMessage: `Map the social and web presence for this ${inputType}: ${input}
${namesStr ? `Associated names to pivot from: ${namesStr}` : ''}
${bizStr ? `Associated businesses to pivot from: ${bizStr}` : ''}

${exactDorks}

You are an autonomous OSINT researcher. You MUST chain your searches.
Example: Search the business name -> Find a news article mentioning the CEO -> Search the CEO's name on IndianKanoon -> Find court cases -> Extract case details.

Do not stop after 1 or 2 queries. Exhaust all 15 search iterations if needed to fill the JSON with rich data.`,
    maxSearchIterations: 18,
    onSearch,
  });

  const f = result.findings as Partial<SocialFindings>;
  const parsed: SocialFindings = {
    socialProfiles: (f.socialProfiles as SocialFindings['socialProfiles']) ?? [],
    companyRegistrations: (f.companyRegistrations as SocialFindings['companyRegistrations']) ?? [],
    newsArticles: (f.newsArticles as SocialFindings['newsArticles']) ?? [],
    courtRecords: (f.courtRecords as SocialFindings['courtRecords']) ?? [],
    gstDetails: (f.gstDetails as SocialFindings['gstDetails']) ?? [],
    youtubeChannels: (f.youtubeChannels as SocialFindings['youtubeChannels']) ?? [],
  };

  return { ...result, parsed };
}
