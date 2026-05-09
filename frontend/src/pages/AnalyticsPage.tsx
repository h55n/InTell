import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, Legend,
} from 'recharts';
import { Link } from 'react-router-dom';
import { TrendingUp, Shield, AlertTriangle, Database, ChevronRight } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatsData {
  totalInvestigations: number;
  avgRiskScore: number;
  topRiskLevels: Array<{ riskLevel: string; count: number }>;
  commonInputTypes: Array<{ inputType: string; count: number }>;
  dataAvailable: boolean;
}

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

// ─── Colors ───────────────────────────────────────────────────────────────────

const RISK_PALETTE: Record<string, string> = {
  safe: '#22c55e',
  suspicious: '#eab308',
  high_risk: '#f97316',
  confirmed_scam: '#ef4444',
};

const TYPE_PALETTE = ['#00ff88', '#38bdf8', '#a78bfa', '#fb923c'];

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

const ChartTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-xl">
      {label && <div className="text-dim mono mb-1">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="font-semibold text-text">{p.name ?? ''}: {p.value}</div>
      ))}
    </div>
  );
};

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <motion.div
      className="rounded-xl border border-border bg-surface p-5"
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 rounded-lg bg-accent/10 text-accent">{icon}</div>
      </div>
      <div className="text-3xl font-bold mono text-text mb-1">{value}</div>
      <div className="text-xs text-dim">{label}</div>
      {sub && <div className="text-xs text-dim/60 mt-0.5">{sub}</div>}
    </motion.div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function AnalyticsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/api/stats`)
      .then((r) => r.json())
      .then((d: StatsData) => setStats(d))
      .catch(() => setError('Failed to load analytics'))
      .finally(() => setLoading(false));
  }, []);

  // Risk level pie data
  const pieData = (stats?.topRiskLevels ?? []).map((r) => ({
    name: r.riskLevel.replace(/_/g, ' '),
    value: r.count,
    fill: RISK_PALETTE[r.riskLevel] ?? '#71717a',
  }));

  // Input type bar data
  const typeData = (stats?.commonInputTypes ?? []).map((t) => ({
    name: t.inputType,
    count: t.count,
  }));

  return (
    <div className="min-h-screen bg-bg text-text">
      {/* Header */}
      <header className="border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-dim hover:text-text transition-colors">← Back</Link>
            <span className="text-border">|</span>
            <span className="font-bold text-accent mono">ANALYTICS</span>
          </div>
          <Link to="/bulk" className="flex items-center gap-1 text-xs text-dim hover:text-text transition-colors">
            Bulk Lookup <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">Investigation Analytics</h1>
          <p className="text-dim text-sm">Aggregated statistics from the audit log (requires PostgreSQL)</p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center text-dim py-20">
            <div className="inline-block w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mb-3" />
            <p>Loading analytics…</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-6 rounded-xl border border-red-400/30 bg-red-400/10 text-red-400 text-center">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
            {error}
          </div>
        )}

        {stats && !stats.dataAvailable && (
          <motion.div
            className="p-8 rounded-2xl border border-border bg-surface text-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          >
            <Database className="w-12 h-12 text-dim mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Database Not Connected</h2>
            <p className="text-dim text-sm max-w-md mx-auto">
              Set <code className="mono bg-bg px-1.5 py-0.5 rounded text-accent">DATABASE_URL</code> in your <code className="mono bg-bg px-1.5 py-0.5 rounded">.env</code> to
              enable the PostgreSQL audit log. Once enabled, every investigation is logged and analytics appear here.
            </p>
          </motion.div>
        )}

        {stats?.dataAvailable && (
          <motion.div className="space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard
                icon={<Shield className="w-5 h-5" />}
                label="Total Investigations"
                value={stats.totalInvestigations.toLocaleString()}
              />
              <StatCard
                icon={<TrendingUp className="w-5 h-5" />}
                label="Avg Risk Score"
                value={stats.avgRiskScore.toFixed(1)}
                sub="out of 100"
              />
              <StatCard
                icon={<AlertTriangle className="w-5 h-5" />}
                label="Highest Risk Category"
                value={stats.topRiskLevels[0]?.riskLevel.replace(/_/g, ' ') ?? 'N/A'}
                sub={`${stats.topRiskLevels[0]?.count ?? 0} cases`}
              />
            </div>

            {/* Risk level distribution */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-border bg-surface p-5">
                <div className="text-xs text-dim mono mb-4">RISK LEVEL DISTRIBUTION</div>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={45}
                      paddingAngle={3}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      formatter={(value) => <span className="text-xs text-dim">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Input type breakdown */}
              <div className="rounded-xl border border-border bg-surface p-5">
                <div className="text-xs text-dim mono mb-4">INPUT TYPE BREAKDOWN</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={typeData} margin={{ left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#71717a', fontFamily: 'JetBrains Mono' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#71717a' }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="count" radius={4}>
                      {typeData.map((_, i) => (
                        <Cell key={i} fill={TYPE_PALETTE[i % TYPE_PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Risk level table */}
            {stats.topRiskLevels.length > 0 && (
              <div className="rounded-xl border border-border bg-surface overflow-hidden">
                <div className="p-4 border-b border-border">
                  <span className="text-xs text-dim mono">RISK LEVEL DETAILS</span>
                </div>
                <table className="w-full text-sm">
                  <thead className="border-b border-border">
                    <tr>
                      <th className="text-left px-4 py-2 text-dim mono text-xs">RISK LEVEL</th>
                      <th className="text-right px-4 py-2 text-dim mono text-xs">COUNT</th>
                      <th className="text-right px-4 py-2 text-dim mono text-xs">% OF TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.topRiskLevels.map((r, i) => (
                      <tr key={i} className="border-b border-border/30">
                        <td className="px-4 py-3">
                          <span style={{ color: RISK_PALETTE[r.riskLevel] ?? '#71717a' }} className="font-medium">
                            {r.riskLevel.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right mono">{r.count.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right mono text-dim">
                          {stats.totalInvestigations > 0
                            ? ((r.count / stats.totalInvestigations) * 100).toFixed(1)
                            : '0.0'}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}
      </main>
    </div>
  );
}
