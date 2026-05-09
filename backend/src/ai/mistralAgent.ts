import { Mistral } from '@mistralai/mistralai';
import type { ToolCall } from '@mistralai/mistralai/models/components/index.js';
import { AgentFinding, SearchResult } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

// ─── Retry helper (exponential backoff for 429) ───────────────────────────────

async function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 6): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastErr = err;
      // Mistral SDK throws SDKError with a statusCode property
      const statusCode = (err as { statusCode?: number }).statusCode;
      const msg = err instanceof Error ? err.message : String(err);
      const is429 = statusCode === 429 || msg.includes('429') ||
        msg.toLowerCase().includes('rate_limit') || msg.toLowerCase().includes('rate limit');
      if (!is429 || attempt === maxRetries) throw err;
      const delay = Math.min(2000 * Math.pow(2, attempt), 60000); // 2s, 4s, 8s, 16s, 32s, max 60s
      logger.warn(`[Mistral] 429 rate limit — retrying in ${Math.round(delay / 1000)}s (attempt ${attempt + 1}/${maxRetries})`);
      await sleep(delay);
    }
  }
  throw lastErr;
}

const mistral = new Mistral({ apiKey: config.mistralApiKey });

// ─── Tavily Web Search (real internet search) ─────────────────────────────────

async function tavilySearch(query: string, maxResults = 8): Promise<SearchResult[]> {
  if (!config.tavilyApiKey) {
    // Fallback: use DuckDuckGo instant API
    return duckduckgoSearch(query, maxResults);
  }
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: config.tavilyApiKey,
        query,
        search_depth: 'advanced',
        max_results: maxResults,
        include_answer: true,
        include_raw_content: false,
      }),
    });
    if (!res.ok) throw new Error(`Tavily ${res.status}`);
    const data = await res.json() as {
      results: Array<{ url: string; title: string; content: string }>;
    };
    return data.results.map((r) => ({
      query,
      url: r.url,
      title: r.title,
      snippet: r.content?.slice(0, 600) ?? '',
      source: new URL(r.url).hostname,
    }));
  } catch (err) {
    logger.warn('Tavily search failed, falling back to DDG', { err });
    return duckduckgoSearch(query, maxResults);
  }
}

async function duckduckgoSearch(query: string, maxResults = 8): Promise<SearchResult[]> {
  try {
    // DuckDuckGo instant answer API (no key needed)
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1&skip_disambig=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'PhoneIntel-OSINT/2.0' } });
    const data = await res.json() as {
      AbstractText?: string;
      AbstractURL?: string;
      AbstractSource?: string;
      RelatedTopics?: Array<{ Text?: string; FirstURL?: string; Name?: string }>;
      Results?: Array<{ Text?: string; FirstURL?: string }>;
    };

    const results: SearchResult[] = [];

    if (data.AbstractText && data.AbstractURL) {
      results.push({
        query,
        url: data.AbstractURL,
        title: data.AbstractSource ?? 'Web Result',
        snippet: data.AbstractText,
        source: data.AbstractSource ?? '',
      });
    }

    for (const topic of (data.RelatedTopics ?? []).slice(0, maxResults - 1)) {
      if (topic.FirstURL && topic.Text) {
        results.push({
          query,
          url: topic.FirstURL,
          title: topic.Name ?? topic.Text.slice(0, 60),
          snippet: topic.Text,
          source: new URL(topic.FirstURL).hostname,
        });
      }
    }

    return results;
  } catch {
    return [];
  }
}

// ─── Serper (Google search API - optional) ────────────────────────────────────

async function serperSearch(query: string, maxResults = 8): Promise<SearchResult[]> {
  if (!config.serperApiKey) return tavilySearch(query, maxResults);
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': config.serperApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, num: maxResults }),
    });
    if (!res.ok) throw new Error(`Serper ${res.status}`);
    const data = await res.json() as {
      organic?: Array<{ link: string; title: string; snippet: string; displayLink: string }>;
      answerBox?: { answer?: string; snippet?: string; link?: string };
    };

    const results: SearchResult[] = [];

    // Answer box first
    if (data.answerBox?.snippet && data.answerBox?.link) {
      results.push({
        query,
        url: data.answerBox.link,
        title: 'Answer Box',
        snippet: data.answerBox.snippet,
        source: new URL(data.answerBox.link).hostname,
      });
    }

    for (const r of (data.organic ?? []).slice(0, maxResults)) {
      results.push({
        query,
        url: r.link,
        title: r.title,
        snippet: r.snippet ?? '',
        source: r.displayLink,
      });
    }

    return results;
  } catch (err) {
    logger.warn('Serper failed, falling back to Tavily', { err });
    return tavilySearch(query, maxResults);
  }
}

// ─── Master search function — tries Serper → Tavily → DDG ────────────────────

export async function webSearch(query: string, maxResults = 8): Promise<SearchResult[]> {
  if (config.serperApiKey) return serperSearch(query, maxResults);
  if (config.tavilyApiKey) return tavilySearch(query, maxResults);
  return duckduckgoSearch(query, maxResults);
}

// ─── Mistral Agent Runner ─────────────────────────────────────────────────────
// Each call to runMistralAgent creates an independent Mistral conversation
// with the web search tool. Mistral decides WHAT to search, HOW MANY times,
// and synthesizes its findings autonomously.

export interface AgentRunOptions {
  agentId: number;
  agentName: string;
  systemPrompt: string;
  userMessage: string;
  maxSearchIterations?: number;
  onSearch?: (query: string, results: SearchResult[]) => void;
}

export async function runMistralAgent(opts: AgentRunOptions): Promise<AgentFinding> {
  const start = Date.now();
  const allSearchResults: SearchResult[] = [];
  const allQueries: string[] = [];

  logger.info(`[Agent ${opts.agentId}] ${opts.agentName} starting`);

  // Define the web_search tool that Mistral will call
  const tools = [
    {
      type: 'function' as const,
      function: {
        name: 'web_search',
        description: 'Search the internet for real-time information. Use multiple targeted queries to gather comprehensive data. Each search returns up to 8 results with URLs, titles, and snippets.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query. Be specific. Include the phone number, name, or identifier in the query.',
            },
            purpose: {
              type: 'string',
              description: 'Why you are running this search and what you expect to find.',
            },
          },
          required: ['query', 'purpose'],
        },
      },
    },
  ];

  // Use SDK's own message types — pushing reconstructed objects causes 400
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: any[] = [
    { role: 'system', content: opts.systemPrompt },
    { role: 'user', content: opts.userMessage },
  ];

  let iterations = 0;
  const maxIterations = opts.maxSearchIterations ?? 12;

  try {
    // Agentic loop: Mistral keeps searching until it has enough data
    while (iterations < maxIterations) {
      iterations++;

      const response = await withRetry(() => mistral.chat.complete({
        model: config.mistralModel,
        messages: messages as Parameters<typeof mistral.chat.complete>[0]['messages'],
        tools,
        toolChoice: 'auto',
        temperature: 0.1,
        maxTokens: 4096,
      }));

      const choice = response.choices?.[0];
      if (!choice) break;

      const assistantMessage = choice.message;
      // Push the original SDK AssistantMessage object directly — it contains
      // toolCalls in camelCase which the SDK serializer correctly sends as tool_calls.
      // Reconstructing with snake_case tool_calls bypasses the SDK serializer → 400.
      messages.push(assistantMessage);

      // If Mistral wants to call tools (search)
      if (choice.finishReason === 'tool_calls' && assistantMessage.toolCalls?.length) {
        for (const toolCall of assistantMessage.toolCalls) {
          if (toolCall.function.name === 'web_search') {
            const args = JSON.parse(toolCall.function.arguments as string) as { query: string; purpose: string };
            const query = args.query;

            logger.info(`[Agent ${opts.agentId}] Searching: "${query}"`);
            allQueries.push(query);

            const results = await webSearch(query, 8);
            allSearchResults.push(...results);

            if (opts.onSearch) opts.onSearch(query, results);

            // Format results for Mistral to read
            const formattedResults = results.length > 0
              ? results.map((r, i) =>
                  `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.snippet}\n`
                ).join('\n---\n')
              : 'No results found for this query.';

            messages.push({
              role: 'tool',
              content: formattedResults,
              toolCallId: toolCall.id,  // SDK uses camelCase, serializes to tool_call_id
              name: 'web_search',
            });
          } else {
            // Mistral hallucinated a tool name! We MUST push a tool message to satisfy the API message order rule.
            messages.push({
              role: 'tool',
              content: `Error: Unknown tool "${toolCall.function.name}". Only "web_search" is available.`,
              toolCallId: toolCall.id,
              name: toolCall.function.name,
            });
          }
        }
      } else {
        // Mistral is done searching and has produced its final answer
        break;
      }
    }

    // Get final response if last message was tool result
    const lastMsg = messages[messages.length - 1];
    let finalContent = '';

    if (lastMsg.role === 'tool') {
      const finalResponse = await withRetry(() => mistral.chat.complete({
        model: config.mistralModel,
        messages: messages as Parameters<typeof mistral.chat.complete>[0]['messages'],
        temperature: 0.1,
        maxTokens: 4096,
        responseFormat: { type: 'json_object' },
      }));
      finalContent = finalResponse.choices?.[0]?.message?.content as string ?? '{}';
    } else {
      finalContent = lastMsg.content ?? '{}';
    }

    // Parse JSON findings from Mistral
    let findings: Record<string, unknown> = {};
    try {
      // Strip markdown code fences if present
      const cleaned = finalContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      findings = JSON.parse(cleaned);
    } catch {
      findings = { rawText: finalContent };
    }

    logger.info(`[Agent ${opts.agentId}] ${opts.agentName} complete`, {
      queries: allQueries.length,
      results: allSearchResults.length,
      ms: Date.now() - start,
    });

    return {
      agentId: opts.agentId,
      agentName: opts.agentName,
      status: 'complete',
      searchQueries: allQueries,
      rawSearchResults: allSearchResults,
      findings,
      confidence: (findings.confidence as number) ?? 50,
      executionMs: Date.now() - start,
    };
  } catch (err) {
    logger.error(`[Agent ${opts.agentId}] Failed`, { err });
    return {
      agentId: opts.agentId,
      agentName: opts.agentName,
      status: 'failed',
      searchQueries: allQueries,
      rawSearchResults: allSearchResults,
      findings: {},
      confidence: 0,
      executionMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
