import { motion, AnimatePresence } from 'framer-motion';
import { Search, CheckCircle2, XCircle, Clock, Loader2, Radio, Cpu } from 'lucide-react';
import type { AgentState } from '../../types';

const AGENT_ICONS: Record<number, string> = {
  1: '📡', 2: '🚨', 3: '🔍', 4: '🌐', 5: '📍',
};

const AGENT_COLORS: Record<number, string> = {
  1: 'text-blue-400 border-blue-400/30 bg-blue-400/5',
  2: 'text-red-400 border-red-400/30 bg-red-400/5',
  3: 'text-purple-400 border-purple-400/30 bg-purple-400/5',
  4: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/5',
  5: 'text-green-400 border-green-400/30 bg-green-400/5',
};

const AGENT_RUNNING: Record<number, string> = {
  1: 'border-blue-400/50 shadow-[0_0_20px_rgba(96,165,250,0.15)]',
  2: 'border-red-400/50 shadow-[0_0_20px_rgba(248,113,113,0.15)]',
  3: 'border-purple-400/50 shadow-[0_0_20px_rgba(192,132,252,0.15)]',
  4: 'border-yellow-400/50 shadow-[0_0_20px_rgba(251,191,36,0.15)]',
  5: 'border-green-400/50 shadow-[0_0_20px_rgba(74,222,128,0.15)]',
};

interface AgentCardProps {
  agent: AgentState;
}

function AgentCard({ agent }: AgentCardProps) {
  const isRunning = agent.status === 'running';
  const isDone = agent.status === 'complete';
  const isFailed = agent.status === 'failed';
  const isIdle = agent.status === 'idle';

  const latestSearch = agent.searches[agent.searches.length - 1] ?? null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: isIdle ? 0.4 : 1, y: 0 }}
      className={`rounded-xl border p-4 transition-all duration-300 ${
        isRunning ? AGENT_RUNNING[agent.id] : 'border-border'
      } bg-surface`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">{AGENT_ICONS[agent.id]}</span>
          <div>
            <div className={`mono text-xs font-semibold ${AGENT_COLORS[agent.id].split(' ')[0]}`}>
              AGENT {agent.id}
            </div>
            <div className="text-sm font-medium text-text">{agent.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isRunning && <Loader2 className="w-4 h-4 text-accent animate-spin" />}
          {isDone && <CheckCircle2 className="w-4 h-4 text-safe" />}
          {isFailed && <XCircle className="w-4 h-4 text-danger" />}
          {isIdle && <div className="w-2 h-2 rounded-full bg-dim" />}
        </div>
      </div>

      {/* Search count */}
      {agent.searchCount > 0 && (
        <div className="flex items-center gap-2 mb-2">
          <Search className="w-3 h-3 text-dim flex-shrink-0" />
          <span className="mono text-xs text-dim">{agent.searchCount} searches fired</span>
          {agent.executionMs && (
            <>
              <span className="text-dim">·</span>
              <Clock className="w-3 h-3 text-dim" />
              <span className="mono text-xs text-dim">{(agent.executionMs / 1000).toFixed(1)}s</span>
            </>
          )}
        </div>
      )}

      {/* Live search feed */}
      {isRunning && latestSearch && (
        <motion.div
          key={latestSearch}
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          className="mt-2 p-2 rounded-lg bg-bg border border-border"
        >
          <div className="flex items-start gap-1.5">
            <Radio className="w-3 h-3 text-accent mt-0.5 flex-shrink-0 animate-pulse" />
            <span className="mono text-xs text-accent break-all">"{latestSearch}"</span>
          </div>
        </motion.div>
      )}

      {/* Done summary */}
      {isDone && agent.searches.length > 0 && (
        <div className="mt-2 space-y-0.5 max-h-20 overflow-y-auto">
          {agent.searches.slice(-4).map((q, i) => (
            <div key={i} className="mono text-[10px] text-dim truncate flex items-center gap-1">
              <span className="text-safe">✓</span> {q}
            </div>
          ))}
        </div>
      )}

      {/* Status bar */}
      <div className="mt-3 h-1 rounded-full bg-bg overflow-hidden">
        {isRunning && (
          <motion.div
            className="h-full bg-accent rounded-full"
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
        {isDone && <div className="h-full bg-safe rounded-full w-full" />}
        {isFailed && <div className="h-full bg-danger rounded-full w-full" />}
      </div>
    </motion.div>
  );
}

interface AgentPanelProps {
  agents: AgentState[];
  isRunning: boolean;
  totalSearches: number;
}

export function AgentPanel({ agents, isRunning, totalSearches }: AgentPanelProps) {
  const running = agents.filter((a) => a.status === 'running').length;
  const done = agents.filter((a) => a.status === 'complete').length;

  return (
    <div>
      {/* Panel header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-accent" />
          <span className="mono text-xs text-accent tracking-widest font-semibold">AGENT DISPATCH</span>
        </div>
        {isRunning && (
          <div className="flex items-center gap-3 mono text-xs text-dim">
            <span className="text-accent">{running} active</span>
            <span>{done}/5 done</span>
            <span>{totalSearches} searches</span>
          </div>
        )}
      </div>

      {/* Agent grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
    </div>
  );
}
