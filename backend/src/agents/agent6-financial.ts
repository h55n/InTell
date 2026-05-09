import { runMistralAgent } from '../ai/mistralAgent.js';
import { AgentFinding, FinancialFindings, SearchResult } from '../types/index.js';

const getSystemPrompt = (input: string) => `You are a Financial & Corporate Intelligence Agent. Your job is to extract the complete financial profile, funding history, asset declarations, and loan/charge details of the target entity.

CRITICAL OSINT PIVOT DIRECTIVE:
1. FAST BASICS: Find basic company profiles on Crunchbase, Tracxn, or ZaubaCorp quickly. 
2. DEEP RESEARCH (PIVOTING): If you find a company -> Search for its specific funding rounds (Seed, Series A/B, etc.) and investors -> Search those investors to find news articles about the funding -> Extract amounts.
3. If searching an individual -> Search for their associated companies -> Search those companies for MCA Charges (registered loans).
4. Search for financial disputes using \`site:casemine.com "${input} default"\` or \`site:indiankanoon.org "${input} loan"\`.
5. NEVER stop after 1 or 2 queries. Exhaust all possibilities to find revenue, valuation, assets, or debt.

Return JSON EXACTLY matching this structure:
{
  "fundingRounds": 0,
  "totalFundingAmount": "amount or null",
  "latestValuation": "amount or null",
  "investors": ["list of VCs/angels/banks"],
  "loansOrCharges": [
    {
      "bankOrEntity": "name of bank",
      "amount": "charge amount",
      "date": "registration date",
      "status": "Open/Closed/Unknown"
    }
  ],
  "financialHealth": "Excellent|Good|Poor|Unknown",
  "financialDisputes": ["any defaults or disputes found"],
  "confidence": 80,
  "searchSummary": "summary of financial status"
}`;

export async function runFinancialAgent(
  input: string,
  inputType: 'phone' | 'email' | 'name' | 'business',
  context: {
    names?: string[];
    businessNames?: string[];
    domains?: string[];
  } = {},
  onSearch?: (q: string, r: SearchResult[]) => void
): Promise<AgentFinding & { parsed: FinancialFindings }> {
  const namesStr = context.names?.join(', ') ?? '';
  const bizStr = context.businessNames?.join(', ') ?? '';

  const result = await runMistralAgent({
    agentId: 6,
    agentName: 'Financial Intelligence',
    systemPrompt: getSystemPrompt(input),
    userMessage: `Find all financial history, funding rounds, and loans for this ${inputType}: ${input}
${namesStr ? `Associated names: ${namesStr}` : ''}
${bizStr ? `Associated businesses: ${bizStr}` : ''}

Use web_search dynamically. You MUST perform OSINT Pivoting. 
For businesses, search Crunchbase, Tracxn, ZaubaCorp -> find news articles for funding/loans -> extract data.
For individuals, search for their companies -> check those companies' financials -> check for individual assets/defaults.

Keep searching until you have thoroughly exhausted all 15 iterations. Return a populated JSON.`,
    maxSearchIterations: 18,
    onSearch,
  });

  const f = result.findings as Partial<FinancialFindings>;
  const parsed: FinancialFindings = {
    fundingRounds: typeof f.fundingRounds === 'number' ? f.fundingRounds : 0,
    totalFundingAmount: typeof f.totalFundingAmount === 'string' ? f.totalFundingAmount : null,
    latestValuation: typeof f.latestValuation === 'string' ? f.latestValuation : null,
    investors: Array.isArray(f.investors) ? f.investors : [],
    loansOrCharges: Array.isArray(f.loansOrCharges) ? f.loansOrCharges : [],
    financialHealth: (f.financialHealth as FinancialFindings['financialHealth']) ?? 'Unknown',
    financialDisputes: Array.isArray(f.financialDisputes) ? f.financialDisputes : [],
  };

  return { ...result, parsed };
}
