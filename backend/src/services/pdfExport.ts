import puppeteer from 'puppeteer';
import { config } from '../config/index.js';
import type { InvestigationReport } from '../types/index.js';

// ─── HTML builder ─────────────────────────────────────────────────────────────

function buildHtml(report: InvestigationReport): string {
  const riskThemes: Record<string, { bg: string; border: string; color: string }> = {
    safe: {
      bg: '#22c55e',
      border: '#16a34a',
      color: '#ffffff',
    },
    suspicious: {
      bg: '#eab308',
      border: '#ca8a04',
      color: '#ffffff',
    },
    high_risk: {
      bg: '#f97316',
      border: '#ea580c',
      color: '#ffffff',
    },
    confirmed_scam: {
      bg: '#ef4444',
      border: '#dc2626',
      color: '#ffffff',
    },
  };

  const theme = riskThemes[report.safetyVerdict] ?? { bg: '#71717a', border: '#52525b', color: '#ffffff' };

  const esc = (s: string | null | undefined) =>
    String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const section = (title: string, body: string) => `
    <div class="section">
      <h2>${esc(title)}</h2>
      ${body}
    </div>`;

  const row = (label: string, value: string | null | undefined) =>
    value ? `<tr><td class="label">${esc(label)}</td><td>${esc(value)}</td></tr>` : '';

  // Build telecom block
  const telecomBlock = report.telecom
    ? section('📡 Telecom Intelligence', `<table>
        ${row('Carrier', report.telecom.carrier)}
        ${row('Circle', report.telecom.telecomCircle)}
        ${row('Number Type', report.telecom.numberType)}
        ${row('Registered City', report.telecom.registeredCity)}
        ${row('Registered State', report.telecom.registeredState)}
        ${row('Ported', report.telecom.isPorted ? `Yes — from ${report.telecom.portedFrom ?? '?'}` : 'No')}
        ${row('Active', report.telecom.isActive === null ? 'Unknown' : report.telecom.isActive ? 'Yes' : 'No')}
        ${row('TRAI Notes', report.telecom.traiData)}
      </table>`)
    : section('📡 Telecom Intelligence', '<p class="empty">No telecom data available.</p>');

  // Build spam block
  const spamBlock = report.spam
    ? section('🚨 Spam & Complaint Intelligence', `
        <div class="score-container">
          <div class="score-box" style="flex: 1; border-color: #e5e7eb;">
            <div class="score-value">${report.rating.toFixed(1)} / 5.0</div>
            <div class="score-label">Trust Rating</div>
          </div>
          <div class="score-box" style="flex: 2; border-color: ${theme.border}; background-color: ${theme.bg}15">
            <div class="score-value" style="color: ${theme.bg}">${report.safetyVerdict.replace(/_/g, ' ').toUpperCase()}</div>
            <div class="score-label">Safety Verdict</div>
          </div>
        </div>
        ${report.spam.categories.length ? `<p><strong>Categories:</strong> ${report.spam.categories.map(esc).join(', ')}</p>` : ''}
        ${report.spam.modus ? `<p><strong>Modus Operandi:</strong> ${esc(report.spam.modus)}</p>` : ''}
        ${report.spam.sourceSummaries.map(s => `<p><a href="${esc(s.url)}">${esc(s.source)}</a> — ${s.reportCount} reports (${esc(s.category)}): ${esc(s.excerpt)}</p>`).join('')}
      `)
    : section('🚨 Spam Intelligence', '<p class="empty">No spam data available.</p>');

  // Build identity block
  const identityBlock = report.digitalIdentity
    ? section('🔍 Digital Identity', `
        ${report.digitalIdentity.associatedNames.map(n => `<p>Name: <strong>${esc(n.name)}</strong> — <a href="${esc(n.url)}">${esc(n.source)}</a></p>`).join('')}
        ${report.digitalIdentity.associatedEmails.map(e => `<p>Email: <code>${esc(e.email)}</code> — <a href="${esc(e.url)}">${esc(e.source)}</a></p>`).join('')}
        ${report.digitalIdentity.businessListings.map(b => `<p>Business: <strong>${esc(b.name)}</strong> on ${esc(b.platform)}${b.address ? ` — ${esc(b.address)}` : ''}</p>`).join('')}
        ${report.digitalIdentity.classifiedAds.map(a => `<p>Ad: <a href="${esc(a.url)}">${esc(a.title)}</a> (${esc(a.platform)})</p>`).join('')}
      `)
    : section('🔍 Digital Identity', '<p class="empty">No digital identity data available.</p>');

  // Build social block
  const socialBlock = report.social
    ? section('🌐 Social & Web Presence', `
        ${report.social.socialProfiles.map(p => `<p>Profile: <a href="${esc(p.url)}">${esc(p.name ?? p.platform)}</a> on ${esc(p.platform)}${p.followers ? ` (${esc(p.followers)} followers)` : ''}</p>`).join('')}
        ${report.social.newsArticles.map(n => `<p>News: <a href="${esc(n.url)}">${esc(n.title)}</a>${n.date ? ` (${esc(n.date)})` : ''}</p>`).join('')}
        ${report.social.courtRecords.map(c => `<p>⚖️ Court: <strong>${esc(c.case)}</strong> — ${esc(c.court)}: ${esc(c.summary)}</p>`).join('')}
      `)
    : section('🌐 Social & Web Presence', '<p class="empty">No social data available.</p>');

  // Build location block
  const locationBlock = report.location
    ? section('📍 Location Intelligence', `<table>
        ${row('Country', report.location.country)}
        ${row('State', report.location.state)}
        ${row('City', report.location.city)}
        ${row('District', report.location.district)}
        ${row('Locality', report.location.locality)}
        ${row('Pincode', report.location.pincode)}
        ${row('Confidence', report.location.locationConfidence)}
        ${report.location.isKnownScamZone ? `<tr><td class="label">Scam Zone</td><td style="color:#ef4444">⚠️ ${esc(report.location.scamZoneName)}</td></tr>` : ''}
      </table>`)
    : section('📍 Location Intelligence', '<p class="empty">Location could not be determined.</p>');

  // Source index
  const sourcesBlock = report.sources.length > 0
    ? section('Sources', report.sources.slice(0, 50).map((s, i) =>
        `<p>[${i + 1}] <a href="${esc(s.url)}">${esc(s.title || s.url)}</a> — ${esc(s.source)}</p>`
      ).join(''))
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Phone Intel Report — ${esc(report.input)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #111; font-size: 13px; line-height: 1.6; padding: 32px; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    h2 { font-size: 15px; margin: 0 0 10px; color: #333; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
    .meta { color: #666; font-size: 11px; margin-bottom: 24px; }
    .risk-badge { display: inline-block; padding: 4px 14px; border-radius: 20px; font-weight: 700; font-size: 13px; color: #fff; background: ${theme.bg}; margin-bottom: 16px; }
    .summary-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; margin-bottom: 24px; }
    .summary-box p { margin-bottom: 8px; }
    .facts ul { list-style: disc; padding-left: 20px; }
    .facts li { margin-bottom: 4px; }
    .section { margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 5px 8px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
    td.label { color: #666; font-size: 11px; text-transform: uppercase; width: 130px; }
    .stats-row { display: flex; gap: 24px; margin-bottom: 12px; }
    .stat { text-align: center; }
    .stat .big { display: block; font-size: 24px; font-weight: 700; }
    .empty { color: #999; font-style: italic; }
    a { color: #2563eb; }
    code { background: #f3f4f6; padding: 0 4px; border-radius: 3px; }
    .page-break { page-break-before: always; }
  </style>
</head>
<body>
  <h1>Phone Intel Report</h1>
  <div class="meta">
    Input: <strong>${esc(report.input)}</strong> (${esc(report.inputType)}) ·
    ID: ${esc(report.id)} ·
    Generated: ${new Date(report.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST ·
    ${(report.executionMs / 1000).toFixed(1)}s · ${report.sources.length} sources
  </div>

  <div class="risk-badge">${report.safetyVerdict.toUpperCase()} — ${report.rating.toFixed(1)} / 5.0</div>

  <div class="summary-box">
    <div class="meta" style="margin:0 0 6px">EXECUTIVE SUMMARY</div>
    <p>${esc(report.summary)}</p>
    ${report.keyFacts.length > 0 ? `
      <div class="meta" style="margin:10px 0 4px">KEY FACTS</div>
      <div class="facts"><ul>${report.keyFacts.map(f => `<li>${esc(f)}</li>`).join('')}</ul></div>
    ` : ''}
    ${report.recommendations.length > 0 ? `
      <div class="meta" style="margin:10px 0 4px">RECOMMENDATIONS</div>
      <div class="facts"><ul>${report.recommendations.map(r => `<li>${esc(r)}</li>`).join('')}</ul></div>
    ` : ''}
  </div>

  ${telecomBlock}
  ${spamBlock}
  ${identityBlock}
  <div class="page-break"></div>
  ${socialBlock}
  ${locationBlock}
  ${sourcesBlock}
</body>
</html>`;
}

// ─── PDF generator ────────────────────────────────────────────────────────────

export async function generatePdf(report: InvestigationReport): Promise<Buffer> {
  const launchOptions: Parameters<typeof puppeteer.launch>[0] = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  };
  if (config.puppeteerExecutablePath) {
    launchOptions.executablePath = config.puppeteerExecutablePath;
  }

  const browser = await puppeteer.launch(launchOptions);
  try {
    const page = await browser.newPage();
    await page.setContent(buildHtml(report), { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      margin: { top: '20mm', bottom: '20mm', left: '16mm', right: '16mm' },
      printBackground: true,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
