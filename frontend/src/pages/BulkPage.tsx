import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, Download, X, AlertCircle, CheckCircle, Clock, Loader2, BarChart3 } from 'lucide-react';
import Papa from 'papaparse';
import { Link } from 'react-router-dom';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BulkRow {
  input: string;
  inputType?: 'phone' | 'email' | 'name' | 'business';
}

interface BulkResult {
  input: string;
  inputType: string;
  reportId: string | null;
  riskLevel: string | null;
  riskScore: number | null;
  status: 'complete' | 'failed';
  error?: string;
}

interface BulkJob {
  jobId: string;
  total: number;
  completed: number;
  failed: number;
  status: 'running' | 'done';
  results: BulkResult[];
  createdAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RISK_COLORS: Record<string, string> = {
  safe: 'text-green-400',
  suspicious: 'text-yellow-400',
  high_risk: 'text-orange-400',
  confirmed_scam: 'text-red-400',
};

const RISK_BG: Record<string, string> = {
  safe: 'bg-green-400/10 border-green-400/30',
  suspicious: 'bg-yellow-400/10 border-yellow-400/30',
  high_risk: 'bg-orange-400/10 border-orange-400/30',
  confirmed_scam: 'bg-red-400/10 border-red-400/30',
};

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

// ─── CSV Parser ───────────────────────────────────────────────────────────────

function parseRows(text: string): BulkRow[] {
  const result = Papa.parse<string[]>(text, { skipEmptyLines: true });
  const validTypes = ['phone', 'email', 'name', 'business'] as const;
  return result.data.map((row) => {
    const input = (row[0] ?? '').trim();
    const raw = (row[1] ?? '').trim().toLowerCase();
    const inputType = validTypes.includes(raw as typeof validTypes[number])
      ? (raw as BulkRow['inputType'])
      : undefined;
    return { input, inputType };
  }).filter((r) => r.input.length > 1);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BulkPage() {
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [job, setJob] = useState<BulkJob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── File handling ──────────────────────────────────────────────────────────
  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseRows(text);
      if (parsed.length === 0) { setError('No valid rows found in CSV'); return; }
      if (parsed.length > 50) { setError('Maximum 50 inputs per batch'); return; }
      setRows(parsed);
      setError('');
      setJob(null);
    };
    reader.readAsText(file);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  // ── Submit job ─────────────────────────────────────────────────────────────
  const submit = async () => {
    if (!rows.length) return;
    setSubmitting(true);
    setError('');
    try {
      const resp = await fetch(`${API_BASE}/api/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: rows }),
      });
      if (!resp.ok) throw new Error((await resp.json()).error ?? 'Bulk submit failed');
      const data: BulkJob = await resp.json();
      setJob(data);
      startPolling(data.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  const startPolling = (jobId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/bulk/${jobId}`);
        const data: BulkJob = await resp.json();
        setJob(data);
        if (data.status === 'done') {
          clearInterval(pollRef.current!);
          pollRef.current = null;
        }
      } catch {}
    }, 2000);
  };

  // ── Download results ───────────────────────────────────────────────────────
  const downloadCsv = () => {
    if (!job) return;
    const header = 'input,inputType,riskLevel,riskScore,reportId,status,error\n';
    const rows = job.results.map(r =>
      [r.input, r.inputType, r.riskLevel ?? '', r.riskScore ?? '', r.reportId ?? '', r.status, r.error ?? ''].join(',')
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `bulk-results-${job.jobId.slice(0,8)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadJson = () => {
    if (!job) return;
    const blob = new Blob([JSON.stringify(job.results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `bulk-results-${job.jobId.slice(0,8)}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const progress = job ? Math.round(((job.completed + job.failed) / job.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-bg text-text">
      {/* Header */}
      <header className="border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-dim hover:text-text transition-colors">← Back</Link>
            <span className="text-border">|</span>
            <span className="font-bold text-accent mono">BULK LOOKUP</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/analytics" className="flex items-center gap-1.5 text-xs text-dim hover:text-text transition-colors">
              <BarChart3 className="w-4 h-4" />Analytics
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold mb-1">Bulk CSV Lookup</h1>
          <p className="text-dim text-sm">Upload a CSV file with up to 50 inputs. One per line, or two columns: <code className="mono bg-surface px-1 rounded">input,type</code></p>
        </div>

        {/* Drop zone */}
        {!job && (
          <motion.div
            className={`relative rounded-2xl border-2 border-dashed p-12 text-center transition-colors cursor-pointer ${
              dragging ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/50 bg-surface'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              id="bulk-file-input"
            />
            <Upload className="w-10 h-10 text-dim mx-auto mb-4" />
            <p className="font-semibold text-text mb-1">Drop CSV here or click to browse</p>
            <p className="text-dim text-sm">Max 50 inputs · .csv or .txt · one per line</p>
            {rows.length > 0 && (
              <motion.div
                className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent/10 border border-accent/30 text-accent"
                initial={{ scale: 0.9 }} animate={{ scale: 1 }}
              >
                <FileText className="w-4 h-4" />
                <span className="font-semibold">{rows.length} rows loaded</span>
                <button onClick={(e) => { e.stopPropagation(); setRows([]); }} className="ml-2 hover:text-text">
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              className="flex items-center gap-3 p-4 rounded-xl border border-red-400/30 bg-red-400/10 text-red-400"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Preview table */}
        {rows.length > 0 && !job && (
          <motion.div className="rounded-xl border border-border bg-surface overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="p-4 border-b border-border flex items-center justify-between">
              <span className="font-semibold text-sm">{rows.length} inputs queued</span>
              <button
                id="bulk-submit-btn"
                onClick={submit}
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-accent text-black font-bold text-sm hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {submitting ? 'Submitting…' : 'Start Investigation'}
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-surface border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-2 text-dim mono">#</th>
                    <th className="text-left px-4 py-2 text-dim mono">INPUT</th>
                    <th className="text-left px-4 py-2 text-dim mono">TYPE</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-border/30 hover:bg-white/2">
                      <td className="px-4 py-2 text-dim mono">{i + 1}</td>
                      <td className="px-4 py-2 font-mono text-text">{r.input}</td>
                      <td className="px-4 py-2 text-dim">{r.inputType ?? 'auto'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Job progress */}
        {job && (
          <motion.div className="space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Progress bar */}
            <div className="rounded-xl border border-border bg-surface p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {job.status === 'running'
                    ? <Loader2 className="w-4 h-4 animate-spin text-accent" />
                    : <CheckCircle className="w-4 h-4 text-green-400" />}
                  <span className="font-semibold">{job.status === 'running' ? 'Processing…' : 'Complete'}</span>
                </div>
                <div className="text-sm text-dim">
                  {job.completed + job.failed} / {job.total} · {job.failed > 0 && <span className="text-red-400">{job.failed} failed</span>}
                </div>
              </div>
              <div className="h-2 bg-bg rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-accent rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <div className="mt-2 text-xs text-dim mono text-right">{progress}%</div>
            </div>

            {/* Download buttons */}
            {job.status === 'done' && (
              <div className="flex gap-3">
                <button onClick={downloadCsv}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-white/5 transition-colors text-sm"
                  id="bulk-download-csv">
                  <Download className="w-4 h-4" />Download CSV
                </button>
                <button onClick={downloadJson}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-white/5 transition-colors text-sm"
                  id="bulk-download-json">
                  <Download className="w-4 h-4" />Download JSON
                </button>
                <button onClick={() => { setJob(null); setRows([]); }}
                  className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-white/5 transition-colors text-sm text-dim">
                  New Batch
                </button>
              </div>
            )}

            {/* Results table */}
            {job.results.length > 0 && (
              <div className="rounded-xl border border-border bg-surface overflow-hidden">
                <div className="p-4 border-b border-border">
                  <span className="font-semibold text-sm">Results</span>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-surface border-b border-border">
                      <tr>
                        <th className="text-left px-4 py-2 text-dim mono">INPUT</th>
                        <th className="text-left px-4 py-2 text-dim mono">RISK</th>
                        <th className="text-left px-4 py-2 text-dim mono">SCORE</th>
                        <th className="text-left px-4 py-2 text-dim mono">STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {job.results.map((r, i) => (
                        <tr key={i} className="border-b border-border/30">
                          <td className="px-4 py-2 mono text-text">{r.input}</td>
                          <td className="px-4 py-2">
                            {r.riskLevel ? (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs mono ${RISK_BG[r.riskLevel] ?? 'border-border text-dim'}`}>
                                <span className={RISK_COLORS[r.riskLevel] ?? 'text-dim'}>
                                  {r.riskLevel.replace(/_/g, ' ')}
                                </span>
                              </span>
                            ) : <span className="text-dim">—</span>}
                          </td>
                          <td className="px-4 py-2 mono">{r.riskScore ?? '—'}</td>
                          <td className="px-4 py-2">
                            {r.status === 'complete'
                              ? <span className="text-green-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" />OK</span>
                              : <span className="text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{r.error ?? 'Failed'}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Running placeholder rows */}
            {job.status === 'running' && (
              <div className="text-center text-dim text-sm py-4 flex items-center justify-center gap-2">
                <Clock className="w-4 h-4" />
                Agents are working… results appear as each investigation completes
              </div>
            )}
          </motion.div>
        )}
      </main>
    </div>
  );
}
