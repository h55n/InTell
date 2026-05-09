import { useState, useCallback, useRef } from 'react';
import type { StreamEvent, AgentState, InvestigationReport } from '../types';

const AGENT_DEFS = [
  { id: 1, name: 'Telecom Intelligence' },
  { id: 2, name: 'Spam & Complaint Intelligence' },
  { id: 3, name: 'Digital Identity' },
  { id: 4, name: 'Social & Web Presence' },
  { id: 5, name: 'Location Intelligence' },
];

function initAgents(): AgentState[] {
  return AGENT_DEFS.map((a) => ({ ...a, status: 'idle', searches: [], searchCount: 0 }));
}

export function useInvestigation() {
  const [agents, setAgents] = useState<AgentState[]>(initAgents());
  const [report, setReport] = useState<InvestigationReport | null>(null);
  const [status, setStatus] = useState<'idle' | 'running' | 'complete' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [eventLog, setEventLog] = useState<StreamEvent[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const updateAgent = useCallback((id: number, patch: Partial<AgentState>) => {
    setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }, []);

  const run = useCallback(async (input: string, inputType?: string) => {
    // Reset
    setAgents(initAgents());
    setReport(null);
    setError(null);
    setEventLog([]);
    setStatus('running');

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const res = await fetch('/api/investigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, inputType }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' })) as { error: string };
        throw new Error(err.error);
      }

      // If cached result (non-SSE JSON)
      const contentType = res.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        const data = await res.json() as { status: string; report: InvestigationReport };
        setReport(data.report);
        // Populate all agents as complete from cached report
        setAgents((prev) => prev.map((a) => {
          const log = data.report.agentLogs.find((l) => l.agentId === a.id);
          if (log) return { ...a, status: 'complete', searches: log.searchQueries, searchCount: log.searchQueries.length, finding: log.findings, executionMs: log.executionMs };
          return a;
        }));
        setStatus('complete');
        return;
      }

      // SSE stream
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6)) as StreamEvent;
            setEventLog((prev) => [...prev.slice(-200), event]); // keep last 200 events

            switch (event.type) {
              case 'agent_start':
                if (event.agentId) updateAgent(event.agentId, { status: 'running' });
                break;
              case 'agent_search':
              if (event.agentId && event.query) {
                  setAgents((all) => all.map((a) => {
                    if (a.id !== event.agentId) return a;
                    return { ...a, searches: [...a.searches, event.query!].slice(-50), searchCount: a.searchCount + 1 };
                  }));
                }
                break;
              case 'agent_complete':
                if (event.agentId) updateAgent(event.agentId, { status: 'complete', finding: event.result });
                break;
              case 'agent_error':
                if (event.agentId) updateAgent(event.agentId, { status: 'failed' });
                break;
              case 'report_ready':
                if (event.report) {
                  setReport(event.report);
                  // Sync agent execution times from final report
                  setAgents((all) => all.map((a) => {
                    const log = event.report!.agentLogs.find((l) => l.agentId === a.id);
                    if (log) return { ...a, status: 'complete', executionMs: log.executionMs };
                    return a;
                  }));
                }
                break;
              case 'done':
                setStatus('complete');
                break;
              case 'error':
                setError(event.message ?? 'Unknown error');
                setStatus('error');
                break;
            }
          } catch { /* ignore parse errors */ }
        }
      }

      setStatus('complete');
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Investigation failed');
      setStatus('error');
    }
  }, [updateAgent]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setStatus('idle');
  }, []);

  return { agents, report, status, error, eventLog, run, cancel };
}
