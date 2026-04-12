'use client';
import PageErrorBoundary from '@/components/PageErrorBoundary';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-fetch';

interface ClaimRow {
  id: string;
  patientName: string;
  patientId: string;
  dateOfService: string;
  insuranceProvider: string;
  cptCodes: string;
  diagnosisCode: string;
  totalCharges: number;
  status: 'billed' | 'signed';
  doctorName: string;
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return iso; }
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function StatusBadge({ status }: { status: 'billed' | 'signed' }) {
  const cfg = status === 'billed'
    ? { label: 'Billed', bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd' }
    : { label: 'Pending', bg: '#fef9c3', color: '#b45309', border: '#fde68a' };
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 999,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  );
}

function GenerateClaimButton({ row, onBilled }: { row: ClaimRow; onBilled: (id: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function handleGenerate(e: React.MouseEvent) {
    e.stopPropagation();
    setLoading(true);
    setError('');
    apiFetch(`/api/encounters/${row.id}/claim`, { method: 'POST' })
      .then(async r => {
        if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? 'Failed'); }
        return r.json();
      })
      .then(claim => {
        // Download the JSON
        const blob = new Blob([JSON.stringify(claim, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `claim-${claim.claimId}-${(claim.dateOfService as string)?.replace(/\//g, '-') ?? 'unknown'}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setLoading(false);
        onBilled(row.id);
      })
      .catch(err => { setError(err.message); setLoading(false); });
  }

  if (error) return <span style={{ fontSize: 11, color: '#b91c1c' }} title={error}>❌ Error</span>;
  return (
    <button
      onClick={handleGenerate}
      disabled={loading}
      style={{
        fontSize: 11, padding: '3px 10px', borderRadius: 6, border: 'none',
        background: '#7c3aed', color: '#fff', fontWeight: 700, whiteSpace: 'nowrap',
        cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
      }}
    >
      {loading ? '⏳' : '📋 Generate'}
    </button>
  );
}

export default function ClaimsPage() {
  const router = useRouter();
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const today = new Date().toISOString().slice(0, 10);
  const [rangePreset, setRangePreset] = useState<'today' | 'week' | 'month'>('month');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(today);
  const [statusFilter, setStatusFilter] = useState<'all' | 'billed' | 'signed'>('all');
  const [search, setSearch] = useState('');

  const applyPreset = useCallback((preset: 'today' | 'week' | 'month') => {
    const now = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    setRangePreset(preset);
    if (preset === 'today') {
      setDateFrom(fmt(now)); setDateTo(fmt(now));
    } else if (preset === 'week') {
      const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      setDateFrom(fmt(mon)); setDateTo(fmt(sun));
    } else if (preset === 'month') {
      setDateFrom(fmt(new Date(now.getFullYear(), now.getMonth(), 1)));
      setDateTo(fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
    }
  }, []);

  const loadClaims = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: '500', from: dateFrom, to: dateTo });
      const [res1, res2] = await Promise.all([
        apiFetch(`/api/encounters?${params}&status=billed`),
        apiFetch(`/api/encounters?${params}&status=signed`),
      ]);
      const d1 = res1.ok ? await res1.json() : { encounters: [] };
      const d2 = res2.ok ? await res2.json() : { encounters: [] };
      const all: Record<string, unknown>[] = [...(d1.encounters ?? []), ...(d2.encounters ?? [])];

      const rows: ClaimRow[] = all.map((e) => {
        let cptCodes = '';
        let totalCharges = 0;
        try {
          const cpt = JSON.parse((e.cptSummary as string) ?? '[]') as Array<{ code: string; total?: number }>;
          cptCodes = cpt.map((c) => c.code).join(', ');
          totalCharges = cpt.reduce((s, c) => s + (c.total ?? 0), 0);
        } catch { /* ignore */ }
        return {
          id: e.id as string,
          patientName: (e.patientName as string) ?? '—',
          patientId: (e.patientId as string) ?? '—',
          dateOfService: (e.encounterDate as string) ?? '',
          insuranceProvider: (e.insuranceProvider as string) ?? '—',
          cptCodes: cptCodes || '—',
          diagnosisCode: (e.diagnosisCode as string) ?? '—',
          totalCharges,
          status: (e.status as 'billed' | 'signed'),
          doctorName: (e.doctorName as string) ?? '—',
        };
      });

      rows.sort((a, b) => new Date(b.dateOfService).getTime() - new Date(a.dateOfService).getTime());
      setClaims(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load claims');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => { loadClaims(); }, [loadClaims]);

  // Mark a row as billed locally after generating claim
  const handleBilled = useCallback((id: string) => {
    setClaims(prev => prev.map(c => c.id === id ? { ...c, status: 'billed' } : c));
  }, []);

  // Filtered view
  const filtered = claims.filter(c => {
    if (statusFilter === 'billed' && c.status !== 'billed') return false;
    if (statusFilter === 'signed' && c.status !== 'signed') return false;
    if (search && !c.patientName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Stats
  const totalBilled = claims.filter(c => c.status === 'billed').length;
  const totalPending = claims.filter(c => c.status === 'signed').length;
  const estCharges = claims.reduce((s, c) => s + c.totalCharges, 0);

  const statCards = [
    { label: 'Total', value: claims.length, color: '#0d9488' },
    { label: 'Billed', value: totalBilled, color: '#1d4ed8' },
    { label: 'Pending', value: totalPending, color: '#b45309' },
    { label: 'Est. Charges', value: fmtCurrency(estCharges), color: '#7c3aed' },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">💳 Claims</div>
          <div className="page-subtitle">Billing &amp; claim management</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={loadClaims}
            style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#374151' }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      <div className="page-body">
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#b91c1c', fontSize: 13 }}>
            ❌ {error}
            <button onClick={() => { setError(''); loadClaims(); }} style={{ marginLeft: 12, padding: '2px 10px', borderRadius: 6, border: '1px solid #fecaca', background: '#fff', color: '#b91c1c', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>Retry</button>
          </div>
        )}

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
          {statCards.map(s => (
            <div key={s.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 18px' }}>
              <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Filter Bar */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 18px', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Date presets */}
            {(['today', 'week', 'month'] as const).map(p => (
              <button
                key={p}
                onClick={() => applyPreset(p)}
                style={{
                  padding: '5px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  border: `1px solid ${rangePreset === p ? '#0d9488' : '#e2e8f0'}`,
                  background: rangePreset === p ? '#0d9488' : '#fff',
                  color: rangePreset === p ? '#fff' : '#374151',
                  cursor: 'pointer',
                }}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}

            <div style={{ width: 1, height: 24, background: '#e2e8f0' }} />

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as 'all' | 'billed' | 'signed')}
              style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, fontWeight: 600, color: '#374151', cursor: 'pointer' }}
            >
              <option value="all">All Status</option>
              <option value="billed">Billed</option>
              <option value="signed">Pending</option>
            </select>

            {/* Search */}
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search patient…"
              style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, minWidth: 180 }}
            />

            {search && (
              <button onClick={() => setSearch('')} style={{ fontSize: 12, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}>✕ Clear</button>
            )}

            <div style={{ marginLeft: 'auto', fontSize: 12, color: '#6b7280', fontWeight: 600 }}>
              {filtered.length} of {claims.length} claim{claims.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Claims Table */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#6b7280', fontSize: 14 }}>
              ⏳ Loading claims…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#6b7280', fontSize: 14 }}>
              {claims.length === 0
                ? 'No signed or billed encounters found for this period.'
                : 'No claims match your filters.'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {['Claim ID', 'Patient', 'Date of Service', 'Insurance', 'CPT Codes', 'ICD-10', 'Charges', 'Status', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, i) => (
                    <tr
                      key={row.id}
                      onClick={() => router.push(`/encounters/${row.id}`)}
                      style={{ borderBottom: i < filtered.length - 1 ? '1px solid #f1f5f9' : 'none', transition: 'background 0.1s', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}
                    >
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 11, color: '#7c3aed', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        CLM-{row.id.slice(-6).toUpperCase()}
                      </td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600, color: '#111827' }}>{row.patientName}</div>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>{row.doctorName}</div>
                      </td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: '#374151' }}>
                        {fmtDate(row.dateOfService)}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#374151', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.insuranceProvider}>
                        {row.insuranceProvider}
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 11, color: '#374151' }}>
                        {row.cptCodes}
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 11, color: '#374151' }}>
                        {row.diagnosisCode}
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0d9488', whiteSpace: 'nowrap' }}>
                        {row.totalCharges > 0 ? fmtCurrency(row.totalCharges) : '—'}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <StatusBadge status={row.status} />
                      </td>
                      <td style={{ padding: '10px 14px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <GenerateClaimButton row={row} onBilled={handleBilled} />
                          <a
                            href={`/encounters/${row.id}`}
                            style={{
                              fontSize: 11, padding: '3px 10px', borderRadius: 6,
                              border: '1px solid #e2e8f0', background: '#f8fafc',
                              color: '#374151', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap',
                            }}
                          >
                            👁️ View
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
