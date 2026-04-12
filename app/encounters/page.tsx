'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getLocationParam } from '@/lib/location-params';
import { apiFetch } from '@/lib/api-fetch';

interface Encounter {
  id: string;
  patientId: string;
  patientName?: string;
  encounterDate: string;
  doctorName?: string;
  nurseName?: string;
  chiefComplaint: string;
  status: string;
  locationId?: string;
  diagnosisCode?: string;
  insuranceProvider?: string;
  signedBy?: string;
  signedAt?: string;
  billedAt?: string;
  createdAt?: string;
  activityCount?: number;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  open:        { label: 'Open',        bg: '#fef9c3', color: '#b45309', border: '#fde68a' },
  awaiting_md: { label: 'Awaiting MD', bg: '#ffedd5', color: '#c2410c', border: '#fed7aa' },
  signed:      { label: 'Signed',      bg: '#dcfce7', color: '#15803d', border: '#86efac' },
  billed:      { label: 'Billed',      bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd' },
  complete:    { label: 'Complete',    bg: '#f3f4f6', color: '#374151', border: '#e5e7eb' },
  cancelled:   { label: 'Cancelled',   bg: '#fce7f3', color: '#9d174d', border: '#fbcfe8' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.open;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 999,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  );
}

function fmtDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return iso; }
}
function fmtTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch { return ''; }
}

function QuickClaimButton({ encounterId }: { encounterId: string }) {
  const [loading, setLoading] = useState(false);
  const [claim, setClaim] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');

  function handleGenerate(e: React.MouseEvent) {
    e.stopPropagation();
    setLoading(true);
    apiFetch(`/api/encounters/${encounterId}/claim`, { method: 'POST' })
      .then(async r => {
        if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? 'Failed'); }
        return r.json();
      })
      .then(d => { setClaim(d); setLoading(false); window.dispatchEvent(new CustomEvent('iat-reload-encounters')); })
      .catch(err => { setError(err.message); setLoading(false); });
  }

  function handleDownload(e: React.MouseEvent) {
    e.stopPropagation();
    if (!claim) return;
    const blob = new Blob([JSON.stringify(claim, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `claim-${claim.claimId}-${(claim.dateOfService as string)?.replace(/\//g, '-') ?? 'unknown'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (error) return <span style={{ fontSize: 11, color: '#b91c1c' }}>❌ {error}</span>;
  if (claim) return (
    <button onClick={handleDownload}
      style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: 'none', background: '#7c3aed', color: '#fff', textDecoration: 'none', fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer' }}>
      ⬇️ Download
    </button>
  );
  return (
    <button onClick={handleGenerate} disabled={loading}
      style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: 'none', background: '#7c3aed', color: '#fff', fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer' }}>
      {loading ? '⏳' : '📋 Claim'}
    </button>
  );
}

export default function EncountersPage() {
  const router = useRouter();
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  // ── Filters ──
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo.toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(today);
  const [rangePreset, setRangePreset] = useState<'today' | 'week' | 'month' | 'custom'>('custom');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [doctorFilter, setDoctorFilter] = useState('');
  const [nurseFilter, setNurseFilter] = useState('');
  const [insuranceFilter, setInsuranceFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');

  // ── Dropdown options ──
  const [doctorOptions, setDoctorOptions] = useState<string[]>([]);
  const [nurseOptions, setNurseOptions] = useState<string[]>([]);
  const [insuranceOptions, setInsuranceOptions] = useState<string[]>([]);
  const [serviceOptions, setServiceOptions] = useState<string[]>([]);

  // ── Range preset helper ──
  const applyPreset = useCallback((preset: 'today' | 'week' | 'month' | 'custom') => {
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

  const loadEncounters = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const locationSuffix = getLocationParam('&');
      const params = new URLSearchParams({ limit: '200', from: dateFrom, to: dateTo });
      if (locationSuffix) {
        const [key, val] = locationSuffix.slice(1).split('=');
        params.set(key, decodeURIComponent(val));
      }
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (doctorFilter) params.set('doctorName', doctorFilter);
      if (nurseFilter) params.set('nurseName', nurseFilter);
      if (search) params.set('search', search);
      if (insuranceFilter) params.set('insuranceProvider', insuranceFilter);
      if (serviceFilter) params.set('chiefComplaint', serviceFilter);

      const res = await fetch(`/api/encounters?${params}`);
      if (!res.ok) throw new Error(res.status === 401 ? 'session_expired' : `HTTP ${res.status}`);
      const data = await res.json();
      const all: Encounter[] = data.encounters ?? [];

      setEncounters(all);
      setTotalCount(all.length);

      // Build dropdown options from data
      const docs = [...new Set(all.map(e => e.doctorName).filter(Boolean) as string[])].sort();
      const nurses = [...new Set(all.map(e => e.nurseName).filter(Boolean) as string[])].sort();
      const insurers = [...new Set(all.map(e => e.insuranceProvider).filter(Boolean) as string[])].sort();
      const services = [...new Set(all.map(e => e.chiefComplaint).filter(Boolean) as string[])].sort();
      setDoctorOptions(docs);
      setNurseOptions(nurses);
      setInsuranceOptions(insurers);
      setServiceOptions(services);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load';
      setError(msg === 'session_expired' ? 'Session expired — please refresh.' : `Failed to load encounters: ${msg}`);
    } finally { setLoading(false); }
  }, [dateFrom, dateTo, statusFilter, doctorFilter, nurseFilter, search, insuranceFilter, serviceFilter]);

  useEffect(() => { loadEncounters(); }, [loadEncounters]);
  useEffect(() => {
    const handler = () => loadEncounters();
    window.addEventListener('locationchange', handler);
    window.addEventListener('iat-reload-encounters', handler);
    return () => {
      window.removeEventListener('locationchange', handler);
      window.removeEventListener('iat-reload-encounters', handler);
    };
  }, [loadEncounters]);

  // ── Stats ──
  const stats = {
    open: encounters.filter(e => e.status === 'open').length,
    awaiting: encounters.filter(e => e.status === 'awaiting_md').length,
    signed: encounters.filter(e => e.status === 'signed').length,
    billed: encounters.filter(e => e.status === 'billed').length,
    complete: encounters.filter(e => e.status === 'complete').length,
  };

  function clearFilters() {
    setSearch(''); setStatusFilter('all');
    setDoctorFilter(''); setNurseFilter(''); setInsuranceFilter(''); setServiceFilter('');
    const ago = new Date();
    ago.setDate(ago.getDate() - 30);
    setDateFrom(ago.toISOString().slice(0, 10));
    setDateTo(new Date().toISOString().slice(0, 10));
    setRangePreset('custom');
  }

  const hasActiveFilters = search || statusFilter !== 'all' || doctorFilter || nurseFilter || insuranceFilter || serviceFilter;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">📋 Encounters</div>
          <div className="page-subtitle">
            {loading ? 'Loading…' : `${encounters.length} encounter${encounters.length !== 1 ? 's' : ''} ${fmtDate(dateFrom)} – ${fmtDate(dateTo)}`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {hasActiveFilters && (
            <button onClick={clearFilters} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              ✕ Clear filters
            </button>
          )}
          <button onClick={loadEncounters} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
            ↻ Refresh
          </button>
        </div>
      </div>

      <div className="page-body">
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#b91c1c', fontSize: 13 }}>
            🔐 {error}
            <button onClick={() => { setError(null); loadEncounters(); }} style={{ marginLeft: 12, padding: '2px 10px', borderRadius: 6, border: '1px solid #fecaca', background: '#fff', color: '#b91c1c', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>Retry</button>
          </div>
        )}

        {/* ── Filter Bar ── */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>

            {/* Date range presets */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Period</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['today', 'week', 'month', 'custom'] as const).map(p => (
                  <button key={p} onClick={() => applyPreset(p)}
                    style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${rangePreset === p ? '#0d9488' : '#e2e8f0'}`,
                      background: rangePreset === p ? '#0d9488' : '#fff', color: rangePreset === p ? '#fff' : '#374151',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
                    {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'Custom'}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom date range */}
            {rangePreset === 'custom' && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>From</div>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13 }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>To</div>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13 }} />
                </div>
              </div>
            )}

            {/* Search */}
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Search Patient / Complaint</div>
              <input type="text" placeholder="Name, complaint, diagnosis…" value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13, boxSizing: 'border-box' }} />
            </div>

            {/* Status */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Status</div>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13, background: '#fff' }}>
                <option value="all">All Statuses</option>
                <option value="open">Open</option>
                <option value="awaiting_md">Awaiting MD</option>
                <option value="signed">Signed</option>
                <option value="billed">Billed</option>
                <option value="complete">Complete</option>
              </select>
            </div>

            {/* Physician */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Physician</div>
              <select value={doctorFilter} onChange={e => setDoctorFilter(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13, background: '#fff', maxWidth: 180 }}>
                <option value="">All Physicians</option>
                {doctorOptions.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            {/* Nurse */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Nurse / Tech</div>
              <select value={nurseFilter} onChange={e => setNurseFilter(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13, background: '#fff', maxWidth: 180 }}>
                <option value="">All Nurses</option>
                {nurseOptions.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>

            {/* Insurance */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Insurance</div>
              <select value={insuranceFilter} onChange={e => setInsuranceFilter(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13, background: '#fff', maxWidth: 180 }}>
                <option value="">All Insurers</option>
                {insuranceOptions.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>

            {/* Service */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Service</div>
              <select value={serviceFilter} onChange={e => setServiceFilter(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${serviceFilter ? '#0d9488' : '#e2e8f0'}`, fontSize: 13, background: serviceFilter ? '#f0fdf9' : '#fff', maxWidth: 200 }}>
                <option value="">All Services</option>
                {serviceOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* ── Stats Bar ── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'Open',        count: stats.open,     color: '#b45309', bg: '#fef9c3' },
            { label: 'Awaiting MD', count: stats.awaiting,  color: '#c2410c', bg: '#ffedd5' },
            { label: 'Signed',      count: stats.signed,   color: '#15803d', bg: '#dcfce7' },
            { label: 'Billed',      count: stats.billed,   color: '#1d4ed8', bg: '#dbeafe' },
            { label: 'Complete',    count: stats.complete,  color: '#374151', bg: '#f3f4f6' },
          ].map(s => (
            <div key={s.label} onClick={() => setStatusFilter(s.label.toLowerCase().replace(' ', '_') === 'awaiting_md' ? 'awaiting_md' : s.label.toLowerCase())}
              style={{ flex: '1 1 100px', background: s.bg, borderRadius: 10, padding: '10px 14px',
                border: `1px solid ${s.color}22`, cursor: 'pointer', transition: 'opacity 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              <div style={{ fontSize: 11, fontWeight: 600, color: s.color, textTransform: 'uppercase' }}>{s.label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.count}</div>
            </div>
          ))}
          <div style={{ flex: '1 1 100px', background: '#f8fafc', borderRadius: 10, padding: '10px 14px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Total</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#374151' }}>{encounters.length}</div>
          </div>
        </div>

        {/* ── Table ── */}
        {loading ? (
          <div className="loading-center"><div className="spinner" /><span>Loading encounters…</span></div>
        ) : encounters.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 48 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#374151', marginBottom: 8 }}>No encounters found</div>
            <div style={{ color: '#64748b', marginBottom: 20 }}>
              {hasActiveFilters ? 'Try adjusting your filters' : 'Encounters will appear here as patients are checked in'}
            </div>
            {hasActiveFilters && <button onClick={clearFilters} className="btn btn-secondary">Clear Filters</button>}
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Time', 'Patient', 'Chief Complaint', 'Physician', 'Nurse / Tech', 'Insurance', 'Status', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700,
                        color: '#374151', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {encounters
                    .filter(e => !search || [e.patientName, e.chiefComplaint, e.diagnosisCode, e.doctorName, e.nurseName]
                      .some(f => f?.toLowerCase().includes(search.toLowerCase())))
                    .map(e => {
                      const ts = e.encounterDate || e.createdAt || '';
                      return (
                        <tr key={e.id}
                          onClick={() => router.push(`/encounters/${e.id}`)}
                          style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.1s' }}
                          onMouseEnter={ev => ev.currentTarget.style.background = '#f8fafc'}
                          onMouseLeave={ev => ev.currentTarget.style.background = ''}
                        >
                          <td style={{ padding: '10px 14px', color: '#64748b', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 12 }}>
                            <div>{fmtDate(ts)}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>{fmtTime(ts)}</div>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>{e.patientName || e.patientId.slice(0, 10)}</div>
                            {e.diagnosisCode && <div style={{ fontSize: 11, color: '#0d9488', fontFamily: 'monospace', marginTop: 2 }}>{e.diagnosisCode}</div>}
                          </td>
                          <td style={{ padding: '10px 14px', maxWidth: 200 }}>
                            <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.chiefComplaint}</div>
                          </td>
                          <td style={{ padding: '10px 14px', color: '#374151', whiteSpace: 'nowrap' }}>{e.doctorName || '—'}</td>
                          <td style={{ padding: '10px 14px', color: '#374151', whiteSpace: 'nowrap' }}>{e.nurseName || '—'}</td>
                          <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 12 }}>{e.insuranceProvider || '—'}</td>
                          <td style={{ padding: '10px 14px' }}><StatusBadge status={e.status} /></td>
                          <td style={{ padding: '10px 14px' }} onClick={ev => ev.stopPropagation()}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <Link href={`/patients/${e.patientId}`}
                                style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid #e2e8f0',
                                  background: '#fff', color: '#374151', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                👤 Patient
                              </Link>
                              {e.status === 'open' && (
                                <Link href={`/patients/${e.patientId}?action=encounter`}
                                  style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: 'none',
                                    background: '#0d9488', color: '#fff', textDecoration: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                  📝 Document
                                </Link>
                              )}
                              {e.status === 'awaiting_md' && (
                                <Link href={`/patients/${e.patientId}?action=encounter`}
                                  style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: 'none',
                                    background: '#ea580c', color: '#fff', textDecoration: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                  ✍️ Sign
                                </Link>
                              )}
                              {(e.status === 'signed' || e.status === 'billed') && (
                                <>
                                  <a href={`/api/encounters/${e.id}/pdf`} target="_blank" rel="noopener noreferrer"
                                    style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: 'none',
                                      background: '#15803d', color: '#fff', textDecoration: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                    🧾 Superbill
                                  </a>
                                  <QuickClaimButton encounterId={e.id} />
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
