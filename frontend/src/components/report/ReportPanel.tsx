import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from 'recharts';
import { ExternalLink, MapPin, Mail, Globe, Building2, AlertTriangle, Shield, ChevronDown, ChevronUp, Download, Loader2, CheckCircle, User, Star, TrendingUp, DollarSign } from 'lucide-react';
import type { InvestigationReport } from '../../types';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

function EmptyState({ icon, message, sub, queries = [] }: { icon: string; message: string; sub?: string; queries?: string[] }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 px-4 text-center rounded-xl border border-dashed border-white/10 bg-white/[0.01]">
      <span className="text-4xl opacity-50 grayscale">{icon}</span>
      <div className="text-sm font-medium text-text/70">{message}</div>
      {sub && <div className="text-xs text-dim max-w-xs">{sub}</div>}
      {queries.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/5 w-full max-w-md text-left">
          <div className="text-[10px] text-dim mono uppercase mb-2 text-center">Searches Attempted By Agent</div>
          <ul className="text-xs text-dim/60 space-y-1.5 max-h-32 overflow-y-auto pr-2 scrollbar-thin">
            {queries.slice(0, 8).map((q, i) => <li key={i} className="truncate">• {q}</li>)}
            {queries.length > 8 && <li className="text-center italic mt-1 pt-1 opacity-50">...and {queries.length - 8} more</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Section({ title, icon, children, defaultOpen = true }: {
  title: string; icon: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-white/5 bg-gradient-to-b from-surface to-bg overflow-hidden shadow-lg transition-all hover:border-white/10">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between p-4 bg-white/[0.01] hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg drop-shadow-md">{icon}</span>
          <span className="font-semibold text-text tracking-wide">{title}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-dim" /> : <ChevronDown className="w-4 h-4 text-dim" />}
      </button>
      {open && <div className="p-5 pt-1">{children}</div>}
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2 border-b border-border/40 last:border-0">
      <span className="text-xs text-dim w-32 flex-shrink-0 pt-0.5 mono">{label}</span>
      <span className={`text-sm text-text flex-1 ${mono ? 'mono' : ''}`}>{value}</span>
    </div>
  );
}

function Tag({ text, color = 'default' }: { text: string; color?: 'default' | 'red' | 'yellow' | 'green' | 'blue' }) {
  const colors = {
    default: 'border-white/10 text-dim bg-white/5', 
    red: 'border-red-500/20 text-red-400 bg-red-500/10 shadow-[0_0_10px_rgba(239,68,68,0.1)]',
    yellow: 'border-yellow-500/20 text-yellow-400 bg-yellow-500/10 shadow-[0_0_10px_rgba(234,179,8,0.1)]',
    green: 'border-green-500/20 text-green-400 bg-green-500/10 shadow-[0_0_10px_rgba(34,197,94,0.1)]',
    blue: 'border-blue-500/20 text-blue-400 bg-blue-500/10 shadow-[0_0_10px_rgba(59,130,246,0.1)]',
  };
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full border mono text-[10px] tracking-wider uppercase font-medium mr-1.5 mb-1.5 transition-all ${colors[color]}`}>{text}</span>;
}

// ─── Report Sections ──────────────────────────────────────────────────────────

function TelecomSection({ data }: { data: NonNullable<InvestigationReport['telecom']> }) {
  return (
    <div className="space-y-0 pt-3">
      <Row label="Carrier" value={<Tag text={data.carrier ?? 'Unknown'} color="blue" />} />
      <Row label="Circle" value={data.telecomCircle} mono />
      <Row label="Number Type" value={<Tag text={data.numberType} color="default" />} />
      <Row label="Registered City" value={data.registeredCity} />
      <Row label="Registered State" value={data.registeredState} />
      <Row label="Ported" value={data.isPorted ? <Tag text={`Yes — from ${data.portedFrom ?? '?'}`} color="yellow" /> : <Tag text="No" color="green" />} />
      <Row label="Active" value={data.isActive === null ? 'Unknown' : data.isActive ? <Tag text="Active" color="green" /> : <Tag text="Inactive" color="red" />} />
      {data.traiData && <Row label="TRAI Notes" value={data.traiData} />}
    </div>
  );
}

function SpamSection({ data }: { data: NonNullable<InvestigationReport['spam']> }) {
  const barData = data.sourceSummaries.map((s) => ({ name: s.source.slice(0, 12), count: s.reportCount }));

  return (
    <div className="space-y-4 pt-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-bg p-3 text-center">
          <div className="mono text-2xl font-bold text-danger">{data.totalReportsFound}</div>
          <div className="text-xs text-dim mt-1">Reports Found</div>
        </div>
        <div className="rounded-lg border border-border bg-bg p-3 text-center">
          <div className="mono text-2xl font-bold text-warn">{data.spamScore}/100</div>
          <div className="text-xs text-dim mt-1">Spam Score</div>
        </div>
        <div className="rounded-lg border border-border bg-bg p-3 text-center">
          <div className={`mono text-sm font-bold ${data.confidence === 'Confirmed' ? 'text-danger' : data.confidence === 'High' ? 'text-warn' : 'text-dim'}`}>
            {data.confidence}
          </div>
          <div className="text-xs text-dim mt-1">Confidence</div>
        </div>
      </div>

      {data.categories.length > 0 && (
        <div>
          <div className="text-xs text-dim mono mb-2">FRAUD CATEGORIES</div>
          <div>{data.categories.map((c) => <Tag key={c} text={c} color="red" />)}</div>
        </div>
      )}

      {data.knownNames.length > 0 && (
        <Row label="Caller Names Used" value={data.knownNames.map((n) => <Tag key={n} text={n} color="yellow" />)} />
      )}

      {data.modus && (
        <div className="p-3 rounded-lg border border-yellow-400/20 bg-yellow-400/5">
          <div className="text-xs text-yellow-400 mono mb-1">MODUS OPERANDI</div>
          <p className="text-sm text-text leading-relaxed">{data.modus}</p>
        </div>
      )}

      {barData.length > 0 && (
        <div>
          <div className="text-xs text-dim mono mb-2">REPORTS BY SOURCE</div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={barData} margin={{ left: -20 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#71717a', fontFamily: 'JetBrains Mono' }} />
              <YAxis tick={{ fontSize: 10, fill: '#71717a' }} />
              <Tooltip
                contentStyle={{ background: '#111113', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#fafafa' }}
              />
              <Bar dataKey="count" radius={4}>
                {barData.map((_, i) => <Cell key={i} fill="#ef4444" fillOpacity={0.8} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {data.sourceSummaries.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-dim mono">SOURCE DETAILS</div>
          {data.sourceSummaries.map((s, i) => (
            <div key={i} className="p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <a href={s.url} target="_blank" rel="noopener noreferrer"
                  className="text-info text-xs mono hover:underline flex items-center gap-1">
                  {s.source} <ExternalLink className="w-3 h-3" />
                </a>
                <Tag text={`${s.reportCount} reports`} color="red" />
              </div>
              <Tag text={s.category} color="yellow" />
              {s.excerpt && <p className="text-xs text-dim mt-2 leading-relaxed">{s.excerpt}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function IdentitySection({ data }: { data: NonNullable<InvestigationReport['digitalIdentity']> }) {
  return (
    <div className="space-y-4 pt-3">
      {data.associatedNames.length > 0 && (
        <div>
          <div className="text-xs text-dim mono mb-2">NAMES FOUND</div>
          {data.associatedNames.map((n, i) => (
            <div key={i} className="flex items-center gap-3 p-2 rounded-lg border border-border bg-bg mb-1">
              <span className="text-sm font-semibold text-text">{n.name}</span>
              <a href={n.url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-info mono hover:underline ml-auto flex items-center gap-1">
                {n.source} <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ))}
        </div>
      )}

      {data.associatedEmails.length > 0 && (
        <div>
          <div className="text-xs text-dim mono mb-2">EMAILS FOUND</div>
          {data.associatedEmails.map((e, i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-bg mb-1 mono text-sm">
              <Mail className="w-3.5 h-3.5 text-info flex-shrink-0" />
              <span className="text-text">{e.email}</span>
              <a href={e.url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-dim hover:text-info ml-auto">{e.source}</a>
            </div>
          ))}
        </div>
      )}

      {data.classifiedAds.length > 0 && (
        <div>
          <div className="text-xs text-dim mono mb-2">CLASSIFIED ADS</div>
          {data.classifiedAds.map((ad, i) => (
            <div key={i} className="p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors shadow-sm mb-2">
              <div className="flex items-center justify-between mb-1">
                <Tag text={ad.platform} color="blue" />
                <a href={ad.url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-info mono hover:underline flex items-center gap-1">
                  View <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p className="text-sm font-medium text-text">{ad.title}</p>
              {ad.snippet && <p className="text-xs text-dim mt-1">{ad.snippet}</p>}
            </div>
          ))}
        </div>
      )}

      {data.businessListings.length > 0 && (
        <div>
          <div className="text-xs text-dim mono mb-2">BUSINESS LISTINGS</div>
          {data.businessListings.map((b, i) => (
            <div key={i} className="p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors shadow-sm mb-2">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="w-4 h-4 text-yellow-400" />
                <span className="font-medium text-text">{b.name}</span>
                <Tag text={b.platform} color="default" />
              </div>
              {b.address && <div className="flex items-center gap-1 text-xs text-dim"><MapPin className="w-3 h-3" />{b.address}</div>}
            </div>
          ))}
        </div>
      )}

      {data.associatedDomains.length > 0 && (
        <div>
          <div className="text-xs text-dim mono mb-2">DOMAINS</div>
          {data.associatedDomains.map((d, i) => (
            <div key={i} className="p-2 rounded-lg border border-border bg-bg mb-1 flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-purple-400" />
              <span className="mono text-sm text-text">{d.domain}</span>
              {d.whois && <span className="text-xs text-dim truncate">{d.whois}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SocialSection({ data }: { data: NonNullable<InvestigationReport['social']> }) {
  return (
    <div className="space-y-4 pt-3">
      {data.socialProfiles.length > 0 && (
        <div>
          <div className="text-xs text-dim mono mb-2">SOCIAL PROFILES</div>
          {data.socialProfiles.map((p, i) => (
            <div key={i} className="p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors shadow-sm mb-2">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Tag text={p.platform} color="blue" />
                  {p.name && <span className="font-medium text-text text-sm">{p.name}</span>}
                  {p.isVerified && <span className="text-blue-400 text-xs">✓</span>}
                </div>
                <a href={p.url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-info mono hover:underline flex items-center gap-1">
                  View <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              {p.followers && <div className="text-xs text-dim">{p.followers} followers</div>}
              {p.bio && <p className="text-xs text-dim mt-1 line-clamp-2">{p.bio}</p>}
            </div>
          ))}
        </div>
      )}

      {data.companyRegistrations.length > 0 && (
        <div>
          <div className="text-xs text-dim mono mb-2">COMPANY REGISTRATIONS (MCA21/GST)</div>
          {data.companyRegistrations.map((c, i) => (
            <div key={i} className="p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors shadow-sm mb-2">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-text">{c.name}</span>
                <Tag text={c.status ?? 'Unknown'} color={c.status?.toLowerCase().includes('struck') ? 'red' : 'green'} />
              </div>
              {c.registrationNumber && <div className="mono text-xs text-dim">CIN: {c.registrationNumber}</div>}
              {c.address && <div className="flex items-center gap-1 text-xs text-dim mt-1"><MapPin className="w-3 h-3" />{c.address}</div>}
            </div>
          ))}
        </div>
      )}

      {data.newsArticles.length > 0 && (
        <div>
          <div className="text-xs text-dim mono mb-2">NEWS MENTIONS</div>
          {data.newsArticles.map((n, i) => (
            <div key={i} className="p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors shadow-sm mb-2">
              <a href={n.url} target="_blank" rel="noopener noreferrer"
                className="font-medium text-info hover:underline text-sm flex items-center gap-1">
                {n.title} <ExternalLink className="w-3 h-3 flex-shrink-0" />
              </a>
              {n.date && <div className="text-xs text-dim mt-0.5">{n.date}</div>}
              {n.summary && <p className="text-xs text-dim mt-1 leading-relaxed">{n.summary}</p>}
            </div>
          ))}
        </div>
      )}

      {data.courtRecords.length > 0 && (
        <div>
          <div className="text-xs text-red-400 mono mb-2">⚖️ COURT RECORDS</div>
          {data.courtRecords.map((cr, i) => (
            <div key={i} className="p-3 rounded-lg border border-red-400/30 bg-red-400/5 mb-2">
              <div className="font-medium text-red-400 text-sm">{cr.case}</div>
              <div className="text-xs text-dim">{cr.court}</div>
              <p className="text-xs text-dim mt-1">{cr.summary}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FinancialSection({ data }: { data: NonNullable<InvestigationReport['financial']> }) {
  return (
    <div className="space-y-6 pt-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg border border-border bg-bg/50">
          <div className="text-[10px] text-dim mono uppercase mb-1">Funding Rounds</div>
          <div className="text-lg font-bold text-accent mono">{data.fundingRounds}</div>
        </div>
        <div className="p-3 rounded-lg border border-border bg-bg/50">
          <div className="text-[10px] text-dim mono uppercase mb-1">Total Funding</div>
          <div className="text-lg font-bold text-text mono">{data.totalFundingAmount || 'Unknown'}</div>
        </div>
        <div className="p-3 rounded-lg border border-border bg-bg/50">
          <div className="text-[10px] text-dim mono uppercase mb-1">Latest Valuation</div>
          <div className="text-lg font-bold text-text mono">{data.latestValuation || 'Unknown'}</div>
        </div>
        <div className="p-3 rounded-lg border border-border bg-bg/50">
          <div className="text-[10px] text-dim mono uppercase mb-1">Financial Health</div>
          <Tag text={data.financialHealth} color={data.financialHealth === 'Excellent' ? 'green' : data.financialHealth === 'Good' ? 'blue' : 'red'} />
        </div>
      </div>

      {data.investors.length > 0 && (
        <div>
          <div className="text-xs text-dim mono mb-2">KEY INVESTORS</div>
          <div className="flex flex-wrap gap-2">
            {data.investors.map((inv, i) => <Tag key={i} text={inv} color="blue" />)}
          </div>
        </div>
      )}

      {data.loansOrCharges.length > 0 && (
        <div>
          <div className="text-xs text-dim mono mb-2">ACTIVE LOANS & MCA CHARGES</div>
          <div className="space-y-2">
            {data.loansOrCharges.map((loan, i) => (
              <div key={i} className="p-3 rounded-lg border border-white/5 bg-white/[0.02] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-accent/60" />
                  <span className="text-sm font-medium text-text">{loan.bankOrEntity}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-xs mono text-dim">{loan.date}</div>
                  <div className="text-sm font-bold text-text mono">{loan.amount}</div>
                  <Tag text={loan.status} color={loan.status === 'Open' ? 'yellow' : 'green'} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.financialDisputes.length > 0 && (
        <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/5">
          <div className="text-xs text-red-400 mono mb-1">FINANCIAL DISPUTES / DEFAULTS</div>
          <ul className="text-xs text-dim space-y-1">
            {data.financialDisputes.map((d, i) => <li key={i}>• {d}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function LocationSection({ data }: { data: NonNullable<InvestigationReport['location']> }) {
  const confidenceColor = data.locationConfidence === 'High'
    ? 'green'
    : data.locationConfidence === 'Medium'
    ? 'yellow'
    : 'default';
  const locationSummary = [data.locality, data.city, data.district, data.state, data.country]
    .filter((value): value is string => Boolean(value));

  return (
    <div className="space-y-5 pt-3">
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <MapPin className="h-4 w-4 text-accent" />
          <span className="text-[10px] text-dim mono uppercase tracking-wider">Location confidence</span>
          <Tag text={data.locationConfidence} color={confidenceColor} />
        </div>
        {locationSummary.length > 0 && (
          <p className="mt-2 text-sm font-medium text-text">{locationSummary.join(', ')}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
        <Row label="Country" value={data.country} />
        <Row label="State" value={data.state} />
        <Row label="City" value={data.city} />
        <Row label="District" value={data.district} />
        <Row label="Locality" value={data.locality} />
        <Row label="Pincode" value={data.pincode} mono />
        <Row label="IP Geolocation" value={data.ipGeolocation} />
      </div>

      {data.isKnownScamZone && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-red-400">
            <AlertTriangle className="h-4 w-4" />
            Reported association with a known scam zone
          </div>
          {data.scamZoneName && <div className="text-sm text-text">{data.scamZoneName}</div>}
          {data.scamZoneNotes && <p className="mt-1 text-xs leading-relaxed text-dim">{data.scamZoneNotes}</p>}
        </div>
      )}

      {data.signals.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-dim mono uppercase">
            <Globe className="h-3.5 w-3.5" /> Location signals ({data.signals.length})
          </div>
          {data.signals.map((signal, index) => {
            const hasWebSource = /^https?:\/\//i.test(signal.sourceUrl);
            const signalConfidenceColor = signal.confidence === 'High'
              ? 'green'
              : signal.confidence === 'Medium'
              ? 'yellow'
              : 'default';

            return (
              <div key={`${signal.sourceUrl}-${index}`} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    {hasWebSource ? (
                      <a href={signal.sourceUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm font-medium text-info hover:underline">
                        {signal.signalSource || 'Source'} <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      </a>
                    ) : (
                      <div className="text-sm font-medium text-text">{signal.signalSource || 'Source'}</div>
                    )}
                    <div className="mt-1 text-xs text-dim">{signal.inferredLocation}</div>
                  </div>
                  <Tag text={signal.confidence} color={signalConfidenceColor} />
                </div>
                {signal.reasoning && <p className="mt-2 text-xs leading-relaxed text-dim">{signal.reasoning}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`w-5 h-5 ${
            s <= Math.floor(rating)
              ? 'text-accent fill-accent'
              : s - 0.5 <= rating
              ? 'text-accent fill-accent opacity-50'
              : 'text-dim fill-transparent'
          }`}
        />
      ))}
      <span className="ml-2 text-xl font-bold mono text-text">{rating.toFixed(1)}</span>
    </div>
  );
}

// ─── Radar Chart for agent confidence scores ──────────────────────────────────

function ConfidenceRadar({ report }: { report: InvestigationReport }) {
  const data = report.agentLogs.map((a) => ({
    agent: a.agentName.split(' ')[0],
    confidence: a.confidence,
  }));
  if (data.length < 3) return null;

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="text-xs text-dim mono mb-3">AGENT CONFIDENCE SCORES</div>
      <ResponsiveContainer width="100%" height={200}>
        <RadarChart data={data}>
          <PolarGrid stroke="#27272a" />
          <PolarAngleAxis dataKey="agent" tick={{ fontSize: 11, fill: '#71717a', fontFamily: 'JetBrains Mono' }} />
          <Radar name="Confidence" dataKey="confidence" stroke="#00ff88" fill="#00ff88" fillOpacity={0.15} strokeWidth={2} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Source Index ─────────────────────────────────────────────────────────────

function SourceIndex({ sources }: { sources: InvestigationReport['sources'] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? sources : sources.slice(0, 20);

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="text-xs text-dim mono mb-3">SOURCE INDEX ({sources.length} URLs retrieved)</div>
      <div className="space-y-1 max-h-72 overflow-y-auto">
        {visible.map((s, i) => (
          <div key={s.url} className="flex items-start gap-2 py-1.5 border-b border-border/30 last:border-0 text-xs group">
            <span className="text-dim mono w-6 flex-shrink-0">[{i + 1}]</span>
            <div className="flex-1 min-w-0">
              <a href={s.url} target="_blank" rel="noopener noreferrer"
                className="text-info hover:underline flex items-center gap-1 break-all">
                <span className="truncate">{s.title || s.url}</span>
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
              </a>
              <div className="text-dim mt-0.5 truncate">{s.source} · "{s.query}"</div>
            </div>
          </div>
        ))}
      </div>
      {sources.length > 20 && (
        <button onClick={() => setShowAll((v) => !v)}
          className="mt-3 text-xs text-accent mono hover:underline">
          {showAll ? 'Show less' : `Show all ${sources.length} sources`}
        </button>
      )}
    </div>
  );
}

// ─── Main ReportPanel ─────────────────────────────────────────────────────────

export function ReportPanel({ report }: { report: InvestigationReport }) {
  const RISK_BORDER = report.safetyVerdict === 'safe' ? 'border-green-400/30' : 'border-red-400/50';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* Top: Dossier + Rating */}
      <div className={`rounded-2xl border ${RISK_BORDER} bg-gradient-to-br from-surface via-surface to-bg p-6 shadow-2xl relative overflow-hidden`}>
        <div className={`absolute top-0 right-0 w-96 h-96 rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none opacity-20 ${
          report.safetyVerdict === 'safe' ? 'bg-green-500' : 'bg-red-500'
        }`} />
        
        <div className="flex flex-col sm:flex-row gap-8">
          {/* Left: Score Card */}
          <div className="w-full sm:w-72 flex-shrink-0 space-y-4">
            <div className="p-6 rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-md shadow-xl">
              <div className="text-[10px] text-dim mono mb-4 uppercase tracking-widest text-center">Trust & Transparency Rating</div>
              <div className="flex flex-col items-center gap-2">
                <StarRating rating={report.rating} />
                <div className={`mt-2 px-6 py-2 rounded-full font-bold text-sm tracking-tighter shadow-lg ${
                  report.safetyVerdict === 'safe' ? 'bg-green-500/20 text-green-400 border border-green-500/40' : 'bg-red-500/20 text-red-400 border border-red-500/40'
                }`}>
                  {report.safetyVerdict === 'safe' ? 'VERIFIED SAFE' : 'UNSAFE / HIGH RISK'}
                </div>
              </div>
            </div>

            {/* Aggregated Contacts */}
            <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
              <div className="text-[10px] text-dim mono mb-3 uppercase tracking-wider">Contact Network Discovered</div>
              <div className="space-y-2">
                {report.extractedContacts.length > 0 ? (
                  report.extractedContacts.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs group">
                      <div className="w-6 h-6 rounded bg-white/5 flex items-center justify-center text-accent/60 group-hover:text-accent transition-colors">
                        {c.type === 'phone' ? '📱' : c.type === 'email' ? '📧' : '🌐'}
                      </div>
                      <span className="text-text/80 truncate flex-1 hover:text-text cursor-default">{c.value}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-[10px] text-dim italic">No associated contacts found</div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Identity Dossier */}
          <div className="flex-1 min-w-0 space-y-6">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center shadow-inner">
                  {report.inputType === 'business' ? <Building2 className="w-5 h-5 text-accent" /> : <User className="w-5 h-5 text-accent" />}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-text truncate max-w-md">{report.input}</h2>
                  <div className="text-[10px] text-dim mono uppercase tracking-widest">{report.inputType} dossier</div>
                </div>
              </div>

              {/* Image Grid */}
              {report.profileImageUrls.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {report.profileImageUrls.slice(0, 4).map((url, i) => (
                    <div key={i} className="w-16 h-16 rounded-lg overflow-hidden border border-white/10 bg-surface shadow-sm hover:scale-105 transition-transform">
                      <img src={url} alt={`Profile ${i}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}

              <div className="text-xs text-dim mono mb-2 uppercase tracking-widest">Intelligence Summary</div>
              <div className="space-y-2">
                {report.summaryPoints?.map((pt, i) => (
                  <div key={i} className="text-sm text-text/90 leading-relaxed flex items-start gap-2 group">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 opacity-40 group-hover:opacity-100 transition-opacity" />
                    <span>{pt.replace(/^- /, '')}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-white/5">
              <div>
                <div className="text-[10px] text-dim mono mb-2 uppercase tracking-widest">Key Findings</div>
                <div className="space-y-1">
                  {report.keyFacts.map((f, i) => (
                    <div key={i} className="text-xs text-text/80 flex items-start gap-2">
                      <span className="text-accent/60 mt-0.5">›</span> {f}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-accent/60 mono mb-2 uppercase tracking-widest">Actionable Intel</div>
                <div className="space-y-1">
                  {report.recommendations.map((r, i) => (
                    <div key={i} className="text-[11px] text-text/80 flex items-start gap-2">
                      <Shield className="w-3 h-3 text-accent/40 mt-0.5" /> {r}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Radar chart */}
      <ConfidenceRadar report={report} />

      {/* Agent sections */}
      {report.inputType === 'phone' && (
        <Section title="📡 Telecom Intelligence" icon="" defaultOpen>
          {report.telecom
            ? <TelecomSection data={report.telecom} />
            : <EmptyState icon="📡" message="Telecom data unavailable" sub="Carrier lookup returned no results for this input" queries={report.agentLogs.find(a => a.agentId === 1)?.searchQueries} />}
        </Section>
      )}

      <Section title="🚨 Spam & Complaint Intelligence" icon="" defaultOpen={report.inputType !== 'phone'}>
        {report.spam
          ? (report.spam.totalReportsFound === 0
            ? <EmptyState icon="✅" message="No complaints found" sub="This entity has no known spam or fraud reports across monitored sources" queries={report.agentLogs.find(a => a.agentId === 2)?.searchQueries} />
            : <SpamSection data={report.spam} />)
          : <EmptyState icon="🚨" message="Spam data unavailable" sub="Complaint lookup could not be completed" queries={report.agentLogs.find(a => a.agentId === 2)?.searchQueries} />}
      </Section>

      <Section title="🔍 Digital Identity" icon="">
        {report.digitalIdentity && (
          report.digitalIdentity.associatedEmails.length === 0 &&
          report.digitalIdentity.associatedNames.length === 0 &&
          report.digitalIdentity.classifiedAds.length === 0 &&
          report.digitalIdentity.businessListings.length === 0
            ? <EmptyState icon="🔍" message="No public digital identity found" sub="No emails, names, classified ads or business listings linked to this input" queries={report.agentLogs.find(a => a.agentId === 3)?.searchQueries} />
            : <IdentitySection data={report.digitalIdentity} />
        )}
        {!report.digitalIdentity && <EmptyState icon="🔍" message="Identity lookup unavailable" queries={report.agentLogs.find(a => a.agentId === 3)?.searchQueries} />}
      </Section>

      <Section title="🌐 Social & Web Presence" icon="">
        {report.social && (
          report.social.socialProfiles.length === 0 &&
          report.social.newsArticles.length === 0 &&
          report.social.companyRegistrations.length === 0
            ? <EmptyState icon="🌐" message="No public social profiles found" sub="No LinkedIn, MCA, GST, court records or news mentions found" queries={report.agentLogs.find(a => a.agentId === 4)?.searchQueries} />
            : <SocialSection data={report.social} />
        )}
        {!report.social && <EmptyState icon="🌐" message="Social lookup unavailable" queries={report.agentLogs.find(a => a.agentId === 4)?.searchQueries} />}
      </Section>

      <Section title="📍 Location Intelligence" icon="">
        {report.location
          ? (report.location.city === null && report.location.state === null
            ? <EmptyState icon="📍" message="Location could not be determined"
                sub={report.location.signals.length > 0 ? `${report.location.signals.length} weak signal(s) found but insufficient for triangulation` : 'No location signals found'} queries={report.agentLogs.find(a => a.agentId === 5)?.searchQueries} />
            : <LocationSection data={report.location} />)
          : <EmptyState icon="📍" message="Location lookup unavailable" queries={report.agentLogs.find(a => a.agentId === 5)?.searchQueries} />}
      </Section>

      <Section title="💰 Financial Intelligence" icon="">
        {report.financial
          ? (report.financial.fundingRounds === 0 && report.financial.loansOrCharges.length === 0
            ? <EmptyState icon="💰" message="No public financial records found" sub="No funding rounds, loans, or MCA charges discovered for this entity" queries={report.agentLogs.find(a => a.agentId === 6)?.searchQueries} />
            : <FinancialSection data={report.financial} />)
          : <EmptyState icon="💰" message="Financial lookup unavailable" queries={report.agentLogs.find(a => a.agentId === 6)?.searchQueries} />}
      </Section>

      {/* Agent errors */}
      {report.agentLogs.filter(a => a.status === 'failed').map(a => (
        <div key={a.agentId} className="p-3 rounded-lg border border-red-400/20 bg-red-400/5 text-xs text-red-400 mono">
          ⚠ Agent {a.agentName} failed: {a.error ?? 'Unknown error'}
        </div>
      ))}

      {/* Source Index */}
      {report.sources.length > 0 && <SourceIndex sources={report.sources} />}

      {/* Metadata + PDF export */}
      <div className="flex items-center justify-between gap-4">
        <div className="mono text-xs text-dim">
          Report ID: {report.id} · {report.agentLogs.reduce((s, a) => s + a.searchQueries.length, 0)} searches · {(report.executionMs / 1000).toFixed(1)}s · {report.sources.length} sources
        </div>
        <PdfButton reportId={report.id} />
      </div>
    </motion.div>
  );
}

// ─── PDF Export Button ────────────────────────────────────────────────────────

function PdfButton({ reportId }: { reportId: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');

  const download = async () => {
    setState('loading');
    try {
      const resp = await fetch(`${API_BASE}/api/report/${reportId}/pdf`);
      if (!resp.ok) throw new Error('PDF failed');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `phone-intel-${reportId.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setState('done');
      setTimeout(() => setState('idle'), 3000);
    } catch {
      setState('idle');
      alert('PDF generation failed. Is Puppeteer installed?');
    }
  };

  return (
    <button
      id="export-pdf-btn"
      onClick={download}
      disabled={state === 'loading'}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-white/5 transition-colors text-xs text-dim hover:text-text disabled:opacity-50"
    >
      {state === 'loading' && <Loader2 className="w-3 h-3 animate-spin" />}
      {state === 'done' && <CheckCircle className="w-3 h-3 text-green-400" />}
      {state === 'idle' && <Download className="w-3 h-3" />}
      {state === 'loading' ? 'Generating…' : state === 'done' ? 'Downloaded!' : 'Export PDF'}
    </button>
  );
}
