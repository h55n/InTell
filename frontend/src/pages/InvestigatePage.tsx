import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Shield, Loader2, X, ChevronRight, AlertCircle } from 'lucide-react';
import { useInvestigation } from '../hooks/useInvestigation';
import { AgentPanel } from '../components/ui/AgentPanel';
import { ReportPanel } from '../components/report/ReportPanel';

const EXAMPLES = [
  { label: 'Phone', value: '+919876543210', type: 'phone' },
  { label: 'Business', value: 'Skyline Consultancy Pvt Ltd', type: 'business' },
  { label: 'Email', value: 'contact@suspiciousdomain.com', type: 'email' },
];

const INPUT_TYPES = [
  { value: 'phone', label: '📱 Phone' },
  { value: 'email', label: '📧 Email' },
  { value: 'name', label: '👤 Name' },
  { value: 'business', label: '🏢 Business' },
];

export function InvestigatePage() {
  const [input, setInput] = useState('');
  const [inputType, setInputType] = useState<'phone' | 'email' | 'name' | 'business'>('phone');
  const { agents, report, status, error, eventLog, run, cancel } = useInvestigation();

  const isRunning = status === 'running';
  const isDone = status === 'complete';
  const totalSearches = agents.reduce((s, a) => s + a.searchCount, 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isRunning) return;
    run(input.trim(), inputType);
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      {/* Header */}
      <header className="border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg border border-accent/40 bg-accent/10 flex items-center justify-center">
              <Shield className="w-4 h-4 text-accent" />
            </div>
            <span className="mono text-sm font-bold tracking-widest">
              IN<span className="text-accent">TELL</span>
            </span>
            <span className="mono text-xs text-dim hidden sm:block">v2.0 · Mistral Multi-Agent</span>
          </div>
          {isRunning && (
            <button onClick={cancel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-danger/40 text-danger text-xs mono hover:bg-danger/10 transition-colors">
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
          )}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Hero + Search */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          {!isRunning && !isDone && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-accent/20 bg-accent/5 mb-6">
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                <span className="mono text-xs text-accent tracking-widest">5 INDEPENDENT MISTRAL AGENTS · REAL WEB SEARCH</span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold text-text mb-4 leading-tight tracking-tight">
                Investigate Any Target.
                <br />
                <span className="text-accent" style={{ textShadow: '0 0 30px rgba(0,255,136,0.4)' }}>
                  Find The Truth.
                </span>
              </h1>
              <p className="text-dim text-lg leading-relaxed">
                Five specialized Mistral AI agents search the internet simultaneously —
                each hunting for telecom data, fraud reports, digital identity, social profiles,
                and location intel. All findings cross-referenced and synthesized.
              </p>
            </motion.div>
          )}

          {/* Search form */}
          <form onSubmit={handleSubmit} className="mt-8 space-y-3">
            {/* Type selector */}
            <div className="flex rounded-xl border border-border overflow-hidden bg-surface">
              {INPUT_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setInputType(t.value as typeof inputType)}
                  className={`flex-1 py-2.5 text-xs mono transition-all ${
                    inputType === t.value
                      ? 'bg-accent/10 text-accent border-b-2 border-accent'
                      : 'text-dim hover:text-text hover:bg-white/3'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 mono text-accent text-sm pointer-events-none">$</span>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  inputType === 'phone' ? '+91 98765 43210' :
                  inputType === 'email' ? 'suspect@domain.com' :
                  inputType === 'business' ? 'Skyline Consultancy Pvt Ltd' :
                  'Rajesh Kumar Sharma'
                }
                disabled={isRunning}
                autoFocus
                className="w-full bg-surface border border-border rounded-xl pl-10 pr-36 py-4 mono text-sm text-text placeholder-dim focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={isRunning || !input.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2 px-4 py-2.5 bg-accent text-bg rounded-lg mono text-sm font-bold hover:bg-accent/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isRunning ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Scanning</>
                ) : (
                  <><Search className="w-4 h-4" /> Investigate</>
                )}
              </button>
            </div>

            {/* Examples */}
            {!isRunning && !isDone && (
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <span className="mono text-xs text-dim">Try:</span>
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex.value}
                    type="button"
                    onClick={() => { setInput(ex.value); setInputType(ex.type as typeof inputType); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:border-accent/30 mono text-xs text-dim hover:text-accent transition-all bg-surface"
                  >
                    <ChevronRight className="w-3 h-3" />
                    <span className="text-dim/60">[{ex.label}]</span> {ex.value}
                  </button>
                ))}
              </div>
            )}
          </form>
        </div>

        {/* Error */}
        {error && (
          <div className="max-w-2xl mx-auto mb-6 flex items-center gap-3 p-4 rounded-xl border border-danger/30 bg-danger/10 mono text-sm text-danger">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Main content area */}
        <AnimatePresence mode="wait">
          {(isRunning || isDone) && (
            <motion.div
              key="workspace"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6"
            >
              {/* Left: Agent panel (always visible while running or done) */}
              <div className="xl:sticky xl:top-20 xl:h-fit">
                <AgentPanel agents={agents} isRunning={isRunning} totalSearches={totalSearches} />

                {/* Live search log */}
                {isRunning && eventLog.filter((e) => e.type === 'agent_search').length > 0 && (
                  <div className="mt-4 rounded-xl border border-border bg-surface p-4">
                    <div className="mono text-xs text-dim mb-3">LIVE SEARCH FEED</div>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {[...eventLog]
                        .filter((e) => e.type === 'agent_search')
                        .slice(-20)
                        .reverse()
                        .map((e, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -4 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="mono text-xs text-dim flex items-start gap-2"
                          >
                            <span className={`flex-shrink-0 ${
                              e.agentId === 1 ? 'text-blue-400' :
                              e.agentId === 2 ? 'text-red-400' :
                              e.agentId === 3 ? 'text-purple-400' :
                              e.agentId === 4 ? 'text-yellow-400' : 'text-green-400'
                            }`}>A{e.agentId}</span>
                            <span className="truncate">"{e.query}"</span>
                          </motion.div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Stats when done */}
                {isDone && report && (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {[
                      { label: 'Searches', value: report.agentLogs.reduce((s, a) => s + a.searchQueries.length, 0) },
                      { label: 'Sources', value: report.sources.length },
                      { label: 'Time', value: `${(report.executionMs / 1000).toFixed(1)}s` },
                      { label: 'Agents', value: `${report.agentLogs.filter((a) => a.status === 'complete').length}/5` },
                    ].map((stat) => (
                      <div key={stat.label} className="p-3 rounded-xl border border-border bg-surface text-center">
                        <div className="mono text-lg font-bold text-accent">{stat.value}</div>
                        <div className="mono text-xs text-dim">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: Report */}
              <div>
                {isDone && report ? (
                  <ReportPanel report={report} />
                ) : isRunning ? (
                  <div className="flex flex-col items-center justify-center h-64 rounded-xl border border-border bg-surface">
                    <Loader2 className="w-8 h-8 text-accent animate-spin mb-4" />
                    <p className="mono text-sm text-dim">Agents searching the internet...</p>
                    <p className="mono text-xs text-dim/60 mt-2">{totalSearches} searches completed so far</p>
                  </div>
                ) : null}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* How it works — visible when idle */}
        {!isRunning && !isDone && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-12 max-w-4xl mx-auto"
          >
            <div className="text-center mono text-xs text-dim mb-8 tracking-widest">HOW IT WORKS</div>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              {[
                { id: 1, icon: '📡', name: 'Telecom Agent', desc: 'Queries TRAI data, carrier lookup, MNP portability, circle detection' },
                { id: 2, icon: '🚨', name: 'Spam Agent', desc: 'Searches shouldianswer, truecaller, consumer forums, Reddit, news' },
                { id: 3, icon: '🔍', name: 'Identity Agent', desc: 'Finds emails, names, classified ads, business listings, domains' },
                { id: 4, icon: '🌐', name: 'Social Agent', desc: 'Scrapes LinkedIn, MCA21, GST, news, court records, YouTube' },
                { id: 5, icon: '📍', name: 'Location Agent', desc: 'Triangulates area from business records, IP geo, cluster matching' },
              ].map((agent, i) => (
                <div key={agent.id} className="relative">
                  <div className="p-4 rounded-xl border border-border bg-surface hover:border-accent/30 transition-all text-center h-full">
                    <div className="text-2xl mb-2">{agent.icon}</div>
                    <div className="mono text-xs text-accent mb-1">AGENT {agent.id}</div>
                    <div className="text-sm font-semibold text-text mb-2">{agent.name}</div>
                    <p className="text-xs text-dim leading-relaxed">{agent.desc}</p>
                  </div>
                  {i < 4 && (
                    <div className="hidden sm:flex absolute -right-2 top-1/2 -translate-y-1/2 z-10 w-4 items-center justify-center">
                      <ChevronRight className="w-3 h-3 text-dim" />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 rounded-xl border border-border bg-surface text-center">
              <p className="mono text-xs text-dim">
                Each agent is an independent <span className="text-accent">Mistral AI instance</span> with web search access.
                Agents 1+2 run in parallel → findings feed into Agents 3+4 (also parallel) → Location Agent uses all context → Orchestrator synthesizes final risk report.
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
