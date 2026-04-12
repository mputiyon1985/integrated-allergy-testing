'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

// ── Types ────────────────────────────────────────────────────────────────────

type TabId = 'clinical' | 'billing' | 'staff' | 'testing';

interface ReportData {
  type?: string;
  from?: string;
  to?: string;
  kpi?: Record<string, unknown>;
  byDay?: Record<string, unknown>[];
  byPhysician?: Record<string, unknown>[];
  topComplaints?: Record<string, unknown>[];
  byDiagnosis?: Record<string, unknown>[];
  statusSummary?: Record<string, unknown>[];
  readyToBill?: Record<string, unknown>[];
  insuranceBreakdown?: Record<string, unknown>[];
  byNurse?: Record<string, unknown>[];
  activityByType?: Record<string, unknown>[];
  byType?: Record<string, unknown>[];
  topAllergens?: Record<string, unknown>[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: unknown): string {
  if (n === null || n === undefined || n === '') return '—';
  return String(n);
}

function fmtNum(n: unknown): string {
  const v = Number(n);
  return isNaN(v) ? '—' : v.toLocaleString();
}

function fmtDate(s: string): string {
  try {
    return new Date(s + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return s; }
}

function today(): string { return new Date().toISOString().slice(0, 10); }
function startOfWeek(): string {
  const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10);
}
function startOfMonth(): string {
  const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

// ── CSV Export ────────────────────────────────────────────────────────────────

function exportCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows || rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map(r =>
      headers.map(h => {
        const v = String(r[h] ?? '').replace(/"/g, '""');
        return v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v}"` : v;
      }).join(',')
    ),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── UI Primitives ──────────────────────────────────────────────────────────────

const TEAL = '#0d9488';
const TEAL_BG = '#f0fdfa';
const TEAL_DARK = '#0f766e';

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rpt-kpi" style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
      padding: '18px 22px', flex: '1 1 160px', minWidth: 140,
    }}>
      <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: '#1e293b', lineHeight: 1 }}>{fmtNum(value)}</div>
      {sub && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function DataTable({ columns, rows, emptyMsg = 'No data for this period' }: {
  columns: { key: string; label: string; align?: 'right' | 'left' }[];
  rows: Record<string, unknown>[];
  emptyMsg?: string;
}) {
  if (!rows || rows.length === 0) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
        {emptyMsg}
      </div>
    );
  }
  return (
    <div className="rpt-table-wrap" style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {columns.map(c => (
              <th key={c.key} style={{
                padding: '9px 14px', textAlign: c.align ?? 'left',
                background: TEAL, color: '#fff', fontWeight: 700,
                fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
              {columns.map(c => (
                <td key={c.key} style={{
                  padding: '8px 14px', borderBottom: '1px solid #e2e8f0',
                  textAlign: c.align ?? 'left', color: '#374151',
                }}>
                  {fmt(row[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({ title, children, onExport }: {
  title: string; children: React.ReactNode; onExport?: () => void;
}) {
  return (
    <div className="rpt-section" style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
      marginBottom: 20, overflow: 'hidden',
    }}>
      <div style={{
        padding: '14px 20px', borderBottom: '1px solid #e2e8f0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#f8fafc',
      }}>
        <span style={{ fontWeight: 700, color: '#1e293b', fontSize: 15 }}>{title}</span>
        {onExport && (
          <button onClick={onExport} style={{
            fontSize: 11, padding: '4px 12px', borderRadius: 6, border: `1px solid ${TEAL}`,
            color: TEAL, background: '#fff', cursor: 'pointer', fontWeight: 600,
          }}>⬇ CSV</button>
        )}
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
}

// ── Clinical Tab ─────────────────────────────────────────────────────────────

function ClinicalTab({ data }: { data: ReportData }) {
  const kpi = data.kpi ?? {};
  return (
    <>
      <div className="rpt-kpi-row" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <KpiCard label="Total Encounters" value={kpi.total as number ?? 0} />
        <KpiCard label="Open" value={kpi.openCount as number ?? 0} />
        <KpiCard label="Avg Wait Time" value={kpi.avgWait as number ?? 0} sub="minutes" />
        <KpiCard label="Avg In-Service" value={kpi.avgInService as number ?? 0} sub="minutes" />
      </div>

      <Section title="Encounters by Day"
        onExport={() => exportCSV(data.byDay ?? [], 'encounters-by-day.csv')}>
        <DataTable
          columns={[
            { key: 'day', label: 'Date' },
            { key: 'total', label: 'Total', align: 'right' },
            { key: 'openCount', label: 'Open', align: 'right' },
            { key: 'completeCount', label: 'Complete', align: 'right' },
            { key: 'avgWait', label: 'Avg Wait (min)', align: 'right' },
          ]}
          rows={(data.byDay ?? []).map(r => ({ ...r, day: fmtDate(String(r.day)) }))}
        />
      </Section>

      <Section title="Encounters by Physician"
        onExport={() => exportCSV(data.byPhysician ?? [], 'encounters-by-physician.csv')}>
        <DataTable
          columns={[
            { key: 'name', label: 'Physician' },
            { key: 'count', label: 'Encounters', align: 'right' },
            { key: 'avgWait', label: 'Avg Wait (min)', align: 'right' },
            { key: 'avgInService', label: 'Avg In-Service (min)', align: 'right' },
          ]}
          rows={data.byPhysician ?? []}
        />
      </Section>

      <Section title="Top 10 Chief Complaints"
        onExport={() => exportCSV(data.topComplaints ?? [], 'chief-complaints.csv')}>
        <DataTable
          columns={[
            { key: 'complaint', label: 'Chief Complaint' },
            { key: 'count', label: 'Frequency', align: 'right' },
          ]}
          rows={data.topComplaints ?? []}
        />
      </Section>

      <Section title="Encounters by Diagnosis (ICD-10)"
        onExport={() => exportCSV(data.byDiagnosis ?? [], 'by-diagnosis.csv')}>
        <DataTable
          columns={[
            { key: 'code', label: 'ICD-10 Code' },
            { key: 'count', label: 'Count', align: 'right' },
          ]}
          rows={data.byDiagnosis ?? []}
        />
      </Section>
    </>
  );
}

// ── Billing Tab ───────────────────────────────────────────────────────────────

function BillingTab({ data }: { data: ReportData }) {
  const kpi = data.kpi ?? {};
  return (
    <>
      <div className="rpt-kpi-row" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <KpiCard label="Signed" value={kpi.signed as number ?? 0} />
        <KpiCard label="Billed" value={kpi.billed as number ?? 0} />
        <KpiCard label="Awaiting MD" value={kpi.awaitingMd as number ?? 0} />
        <KpiCard label="Total Encounters" value={kpi.total as number ?? 0} />
      </div>

      <Section title="Billing Status Summary"
        onExport={() => exportCSV(data.statusSummary ?? [], 'billing-status.csv')}>
        <DataTable
          columns={[
            { key: 'status', label: 'Status' },
            { key: 'count', label: 'Count', align: 'right' },
          ]}
          rows={data.statusSummary ?? []}
        />
      </Section>

      <Section title="Encounters Ready to Bill (Signed, Not Yet Billed)"
        onExport={() => exportCSV(data.readyToBill ?? [], 'ready-to-bill.csv')}>
        <DataTable
          columns={[
            { key: 'patientName', label: 'Patient' },
            { key: 'date', label: 'Date' },
            { key: 'physician', label: 'Physician' },
            { key: 'diagnosisCode', label: 'Diagnosis Code' },
          ]}
          rows={(data.readyToBill ?? []).map(r => ({ ...r, date: fmtDate(String(r.date)) }))}
        />
      </Section>

      <Section title="Insurance Breakdown"
        onExport={() => exportCSV(data.insuranceBreakdown ?? [], 'insurance-breakdown.csv')}>
        <DataTable
          columns={[
            { key: 'provider', label: 'Insurance Provider' },
            { key: 'count', label: 'Encounters', align: 'right' },
          ]}
          rows={data.insuranceBreakdown ?? []}
        />
      </Section>
    </>
  );
}

// ── Staff Tab ─────────────────────────────────────────────────────────────────

function StaffTab({ data }: { data: ReportData }) {
  return (
    <>
      <Section title="Encounters by Nurse"
        onExport={() => exportCSV(data.byNurse ?? [], 'by-nurse.csv')}>
        <DataTable
          columns={[
            { key: 'nurseName', label: 'Nurse' },
            { key: 'count', label: 'Encounters', align: 'right' },
            { key: 'avgWait', label: 'Avg Wait (min)', align: 'right' },
          ]}
          rows={data.byNurse ?? []}
        />
      </Section>

      <Section title="Encounters by Physician"
        onExport={() => exportCSV(data.byPhysician ?? [], 'by-physician.csv')}>
        <DataTable
          columns={[
            { key: 'doctorName', label: 'Physician' },
            { key: 'total', label: 'Total', align: 'right' },
            { key: 'signedCount', label: 'Signed', align: 'right' },
          ]}
          rows={data.byPhysician ?? []}
        />
      </Section>

      <Section title="Encounter Activity by Type"
        onExport={() => exportCSV(data.activityByType ?? [], 'activity-by-type.csv')}>
        <DataTable
          columns={[
            { key: 'activityType', label: 'Activity Type' },
            { key: 'count', label: 'Count', align: 'right' },
          ]}
          rows={data.activityByType ?? []}
        />
      </Section>
    </>
  );
}

// ── Allergen Bar Chart ──────────────────────────────────────────────────────

function AllergenBarChart({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows || rows.length === 0) {
    return <div style={{ padding: '32px 0', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>No allergen data for this period</div>;
  }
  const maxVal = Math.max(...rows.map(r => Number(r.positiveCount ?? 0)), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.map((row, i) => {
        const tested = Number(row.tested ?? 0);
        const positive = Number(row.positiveCount ?? 0);
        const pct = tested > 0 ? Math.round((positive / tested) * 100) : 0;
        const barPct = Math.round((positive / maxVal) * 100);
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 160, fontSize: 12, fontWeight: 600, color: '#374151', flexShrink: 0, textAlign: 'right', paddingRight: 8 }}>
              {String(row.allergen ?? '—')}
            </div>
            <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 4, height: 22, overflow: 'hidden', position: 'relative' }}>
              <div style={{
                width: `${barPct}%`, height: '100%',
                background: pct >= 50 ? '#dc2626' : pct >= 25 ? '#f59e0b' : TEAL,
                borderRadius: 4, transition: 'width 0.3s ease',
                minWidth: positive > 0 ? 4 : 0,
              }} />
            </div>
            <div style={{ width: 80, fontSize: 12, color: '#64748b', flexShrink: 0 }}>
              {positive} / {tested} <span style={{ color: '#94a3b8' }}>({pct}%)</span>
            </div>
          </div>
        );
      })}
      <div style={{ marginTop: 8, fontSize: 11, color: '#94a3b8', display: 'flex', gap: 16 }}>
        <span>🟢 &lt;25% positive</span>
        <span>🟡 25–50% positive</span>
        <span>🔴 &gt;50% positive</span>
      </div>
    </div>
  );
}

// ── Testing Tab ───────────────────────────────────────────────────────────────

function TestingTab({ data }: { data: ReportData }) {
  const kpi = data.kpi ?? {};
  const total = Number(kpi.total ?? 0);
  const positive = Number(kpi.positiveCount ?? 0);
  const positiveRate = total > 0 ? `${Math.round((positive / total) * 100)}%` : '—';
  return (
    <>
      <div className="rpt-kpi-row" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <KpiCard label="Total Tests" value={total} />
        <KpiCard label="Positive Results" value={positive} sub="reaction ≥ 2" />
        <KpiCard label="Positive Rate" value={positiveRate} sub="of all tests" />
      </div>

      <Section title="Tests by Type"
        onExport={() => exportCSV(data.byType ?? [], 'tests-by-type.csv')}>
        <DataTable
          columns={[
            { key: 'testType', label: 'Test Type' },
            { key: 'count', label: 'Total', align: 'right' },
            { key: 'positiveCount', label: 'Positive', align: 'right' },
          ]}
          rows={data.byType ?? []}
        />
      </Section>

      <Section title="Most Reactive Allergens (Top 10)"
        onExport={() => exportCSV(data.topAllergens ?? [], 'top-allergens.csv')}>
        <AllergenBarChart rows={data.topAllergens ?? []} />
      </Section>

      <Section title="Testing Volume by Day"
        onExport={() => exportCSV(data.byDay ?? [], 'testing-by-day.csv')}>
        <DataTable
          columns={[
            { key: 'day', label: 'Date' },
            { key: 'count', label: 'Tests', align: 'right' },
          ]}
          rows={(data.byDay ?? []).map(r => ({ ...r, day: fmtDate(String(r.day)) }))}
        />
      </Section>
    </>
  );
}

// ── Print Stylesheet (injected into <head>) ───────────────────────────────────

const PRINT_STYLE = `
@media print {
  /* Hide chrome */
  .sidebar, .sidebar-overlay, .sidebar-toggle,
  .main-content > div:first-child,  /* TopBar */
  .rpt-filter-bar, .rpt-tabs, .rpt-no-print,
  button { display: none !important; }

  /* Reset layout */
  body, html { margin: 0; padding: 0; background: #fff !important; }
  .main-content { margin: 0 !important; padding: 0 !important; }
  .app-shell { display: block !important; }
  .rpt-content { padding: 0 !important; }

  /* Print header visible */
  .rpt-print-header { display: block !important; }

  /* KPI row */
  .rpt-kpi-row { display: flex !important; flex-wrap: wrap !important; gap: 12px !important; margin-bottom: 18px !important; }
  .rpt-kpi { border: 1px solid #cbd5e1 !important; border-radius: 8px !important; padding: 12px 16px !important; flex: 1 1 140px !important; }

  /* Sections */
  .rpt-section { break-inside: avoid; border: 1px solid #cbd5e1 !important; border-radius: 8px !important; margin-bottom: 16px !important; }

  /* Tables */
  .rpt-table-wrap { overflow: visible !important; }
  table { width: 100% !important; border-collapse: collapse !important; font-size: 11px !important; }
  th {
    background: #0d9488 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    color: #fff !important;
    padding: 6px 10px !important;
    text-align: left;
  }
  td { padding: 5px 10px !important; border-bottom: 1px solid #e2e8f0 !important; }
  tr:nth-child(even) td {
    background: #f8fafc !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* Page breaks */
  .rpt-section { page-break-inside: avoid; }

  /* Footer */
  @page {
    margin: 18mm 14mm;
    @bottom-center { content: "CONFIDENTIAL — " counter(page) " of " counter(pages); font-size: 9px; color: #64748b; }
  }
}
`;

// ── Main Reports Page ─────────────────────────────────────────────────────────

function ReportsPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [tab, setTab] = useState<TabId>('clinical');
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(today());
  const [preset, setPreset] = useState<'today' | 'week' | 'month' | 'custom'>('month');
  const [data, setData] = useState<ReportData>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [locationId, setLocationId] = useState<string | null>(null);
  const [practiceId, setPracticeId] = useState<string | null>(null);
  const [locationLabel, setLocationLabel] = useState('All Locations');

  const printStyleRef = useRef<HTMLStyleElement | null>(null);

  // Inject print stylesheet once
  useEffect(() => {
    if (printStyleRef.current) return;
    const s = document.createElement('style');
    s.textContent = PRINT_STYLE;
    document.head.appendChild(s);
    printStyleRef.current = s;
    return () => { s.remove(); printStyleRef.current = null; };
  }, []);

  // Read location from localStorage
  const readLocation = useCallback(() => {
    try {
      const locRaw = localStorage.getItem('iat_active_location');
      const pracRaw = localStorage.getItem('iat_active_practice_filter');
      if (locRaw) {
        const loc = JSON.parse(locRaw);
        setLocationId(loc.id ?? null);
        setLocationLabel(loc.name ?? 'All Locations');
        setPracticeId(null);
      } else if (pracRaw) {
        const prac = JSON.parse(pracRaw);
        setPracticeId(prac.id ?? null);
        setLocationLabel(prac.name ?? 'All Locations');
        setLocationId(null);
      } else {
        setLocationId(null); setPracticeId(null); setLocationLabel('All Locations');
      }
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    readLocation();
    const handler = () => readLocation();
    window.addEventListener('locationchange', handler);
    window.addEventListener('storage', handler);
    return () => { window.removeEventListener('locationchange', handler); window.removeEventListener('storage', handler); };
  }, [readLocation]);

  // Check ?print=1 and auto-open print dialog
  useEffect(() => {
    if (searchParams.get('print') === '1') {
      setTimeout(() => window.print(), 800);
    }
  }, [searchParams]);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ type: tab, from, to });
      if (locationId) params.set('locationId', locationId);
      if (practiceId) params.set('practiceId', practiceId);
      const res = await fetch(`/api/reports?${params}`);
      if (!res.ok) throw new Error('Failed to load report');
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [tab, from, to, locationId, practiceId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Preset handlers
  function applyPreset(p: typeof preset) {
    setPreset(p);
    if (p === 'today') { setFrom(today()); setTo(today()); }
    else if (p === 'week') { setFrom(startOfWeek()); setTo(today()); }
    else if (p === 'month') { setFrom(startOfMonth()); setTo(today()); }
  }

  // PDF export via browser print
  function handlePDF() {
    const prevTitle = document.title;
    const dateLabel = from === to ? fmtDate(from) : `${fmtDate(from)} – ${fmtDate(to)}`;
    document.title = `IAT Report — ${tab.charAt(0).toUpperCase() + tab.slice(1)} — ${dateLabel}`;
    window.print();
    setTimeout(() => { document.title = prevTitle; }, 1000);
  }

  // Export all visible tables for current tab
  function handleExportCSV() {
    const dateLabel = from === to ? from : `${from}_to_${to}`;
    const rows = getExportRows();
    if (rows.length === 0) { alert('No data to export'); return; }
    exportCSV(rows, `iat-${tab}-${dateLabel}.csv`);
  }

  function getExportRows(): Record<string, unknown>[] {
    if (tab === 'clinical') return data.byDay ?? [];
    if (tab === 'billing') return data.readyToBill ?? [];
    if (tab === 'staff') return data.byNurse ?? [];
    if (tab === 'testing') return data.topAllergens ?? [];
    return [];
  }

  const TAB_CONFIG: { id: TabId; label: string; emoji: string }[] = [
    { id: 'clinical', label: 'Clinical', emoji: '🩺' },
    { id: 'billing', label: 'Billing', emoji: '💳' },
    { id: 'staff', label: 'Staff', emoji: '👩‍⚕️' },
    { id: 'testing', label: 'Testing', emoji: '🧪' },
  ];

  const dateLabel = from === to ? fmtDate(from) : `${fmtDate(from)} – ${fmtDate(to)}`;
  const tabLabel = TAB_CONFIG.find(t => t.id === tab)?.label ?? tab;

  return (
    <div style={{ padding: 0, background: '#f8fafc', minHeight: '100vh' }}>
      {/* ── Print-only header (hidden on screen) ── */}
      <div className="rpt-print-header" style={{ display: 'none', padding: '0 0 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, borderBottom: '2px solid #0d9488', paddingBottom: 12, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#0d9488' }}>Integrated Allergy Testing</div>
            <div style={{ fontSize: 14, color: '#374151', fontWeight: 600, marginTop: 2 }}>
              {tabLabel} Report &nbsp;·&nbsp; {dateLabel}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              Location: {locationLabel} &nbsp;·&nbsp; Generated: {new Date().toLocaleString('en-US')}
            </div>
          </div>
        </div>
      </div>

      {/* ── Screen-only filter bar ── */}
      <div className="rpt-filter-bar" style={{
        background: '#fff', borderBottom: '1px solid #e2e8f0',
        padding: '14px 24px', display: 'flex', alignItems: 'center',
        gap: 12, flexWrap: 'wrap', position: 'sticky', top: 48, zIndex: 100,
      }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginRight: 8 }}>📊 Reports</div>

        {/* Presets */}
        {(['today', 'week', 'month'] as const).map(p => (
          <button key={p} onClick={() => applyPreset(p)} style={{
            padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            border: `1px solid ${preset === p ? TEAL : '#e2e8f0'}`,
            background: preset === p ? TEAL_BG : '#fff',
            color: preset === p ? TEAL_DARK : '#374151',
          }}>
            {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
          </button>
        ))}

        {/* Date range */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPreset('custom'); }}
            style={{ padding: '5px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, color: '#374151' }} />
          <span style={{ color: '#94a3b8', fontSize: 13 }}>→</span>
          <input type="date" value={to} onChange={e => { setTo(e.target.value); setPreset('custom'); }}
            style={{ padding: '5px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, color: '#374151' }} />
        </div>

        {/* Location badge */}
        <div style={{ fontSize: 12, color: '#64748b', padding: '5px 12px', background: '#f1f5f9', borderRadius: 8, fontWeight: 600 }}>
          📍 {locationLabel}
        </div>

        <div style={{ flex: 1 }} />

        {/* Export buttons */}
        <button onClick={handleExportCSV} style={{
          padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
          border: `1px solid ${TEAL}`, background: '#fff', color: TEAL,
        }}>⬇ CSV</button>

        <button onClick={handlePDF} className="rpt-no-print" style={{
          padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
          border: 'none', background: TEAL, color: '#fff',
        }}>📄 Export PDF</button>
      </div>

      {/* ── Tabs ── */}
      <div className="rpt-tabs" style={{
        background: '#fff', borderBottom: '1px solid #e2e8f0',
        padding: '0 24px', display: 'flex', gap: 4,
      }}>
        {TAB_CONFIG.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '12px 20px', fontSize: 14, fontWeight: tab === t.id ? 700 : 500,
            border: 'none', cursor: 'pointer', background: 'transparent',
            borderBottom: tab === t.id ? `3px solid ${TEAL}` : '3px solid transparent',
            color: tab === t.id ? TEAL : '#64748b',
          }}>
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div className="rpt-content" style={{ padding: '24px' }}>
        {error && (
          <div style={{ padding: 16, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, color: '#dc2626', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span>⚠️ Failed to load report data. Please try again.</span>
            <button
              onClick={fetchData}
              style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8', fontSize: 15 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            Loading report…
          </div>
        ) : (
          <>
            {tab === 'clinical' && <ClinicalTab data={data} />}
            {tab === 'billing' && <BillingTab data={data} />}
            {tab === 'staff' && <StaffTab data={data} />}
            {tab === 'testing' && <TestingTab data={data} />}
          </>
        )}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: '#94a3b8' }}>Loading…</div>}>
      <ReportsPageInner />
    </Suspense>
  );
}
