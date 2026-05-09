import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { ReportPanel } from '../components/report/ReportPanel';
import type { InvestigationReport } from '../types';

export function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<InvestigationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/report/${id}`)
      .then((r) => r.json())
      .then((d: { report: InvestigationReport }) => setReport(d.report))
      .catch(() => setError('Report not found or expired.'))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-1.5 text-dim hover:text-text mono text-xs transition-colors">
            <ArrowLeft className="w-4 h-4" /> New Investigation
          </Link>
          <span className="text-dim">·</span>
          <span className="mono text-xs text-dim">Report {id}</span>
        </div>
      </header>
      <div className="max-w-5xl mx-auto px-4 py-8">
        {loading && (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
          </div>
        )}
        {error && (
          <div className="text-center py-16 mono text-danger">{error}</div>
        )}
        {report && <ReportPanel report={report} />}
      </div>
    </div>
  );
}
