'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface Encounter {
  id: string;
  patientId: string;
  encounterDate: string;
  doctorName?: string;
  nurseName?: string;
  chiefComplaint: string;
  status: string;
  signedBy?: string;
  signedAt?: string;
  billedAt?: string;
  mdAttestation?: string;
  cptSummary?: string;
  diagnosisCode?: string;
  subjectiveNotes?: string;
  objectiveNotes?: string;
  assessment?: string;
  plan?: string;
  locationId?: string;
  createdAt?: string;
}

interface CPTEntry {
  code: string;
  description: string;
  units: number;
  fee: number;
  total: number;
}

interface ICD10Option {
  id: string;
  code: string;
  description: string;
}

interface Patient {
  id: string;
  name: string;
  patientId?: string;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; border: string; emoji: string }> = {
  open:        { label: 'In Progress',      bg: '#fef9c3', color: '#b45309', border: '#fde68a', emoji: '🟡' },
  awaiting_md: { label: 'Awaiting MD',      bg: '#ffedd5', color: '#c2410c', border: '#fed7aa', emoji: '🟠' },
  signed:      { label: 'Signed',           bg: '#dcfce7', color: '#15803d', border: '#86efac', emoji: '🟢' },
  billed:      { label: 'Billed',           bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd', emoji: '💙' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.open;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 999,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      whiteSpace: 'nowrap',
    }}>
      {cfg.emoji} {cfg.label}
    </span>
  );
}

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 1) return 'just now';
  if (diff < 60) return `${diff}m`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h`;
  return `${Math.floor(diff / 1440)}d`;
}

export default function EncountersPage() {
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [patients, setPatients] = useState<Record<string, Patient>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [dateFilter, setDateFilter] = useState(() => new Date().toISOString().slice(0, 10));
  const [statusFilter, setStatusFilter] = useState('all');

  // Sign modal state
  const [signModalEnc, setSignModalEnc] = useState<Encounter | null>(null);
  const [mdName, setMdName] = useState('');
  const [icd10Options, setIcd10Options] = useState<ICD10Option[]>([]);
  const [selectedIcd, setSelectedIcd] = useState('');
  const [cptData, setCptData] = useState<{ cptCodes: CPTEntry[]; grandTotal: number } | null>(null);
  const [loadingCpt, setLoadingCpt] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState('');

  const fetchEncounters = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ limit: '200' });
    fetch(`/api/encounters?${params}`)
      .then(async r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(async d => {
        const all: Encounter[] = d.encounters ?? [];

        // Filter by date
        const filtered = all.filter(e => {
          const encDate = new Date(e.encounterDate).toISOString().slice(0, 10);
          if (dateFilter && encDate !== dateFilter) return false;
          if (statusFilter !== 'all' && e.status !== statusFilter) return false;
          return true;
        });

        setEncounters(filtered);

        // Fetch patient names for unique patientIds
        const uniqueIds = [...new Set(filtered.map(e => e.patientId))];
        const patMap: Record<string, Patient> = {};
        await Promise.allSettled(
          uniqueIds.map(pid =>
            fetch(`/api/patients/${pid}`)
              .then(r => r.ok ? r.json() : null)
              .then(d => { if (d?.patient || d?.id) patMap[pid] = d.patient ?? d; })
          )
        );
        setPatients(patMap);
        setLoading(false);
      })
      .catch(err => {
        setError(`Failed to load encounters: ${err.message}`);
        setLoading(false);
      });
  }, [dateFilter, statusFilter]);

  useEffect(() => { fetchEncounters(); }, [fetchEncounters]);

  // Load ICD-10 options once
  useEffect(() => {
    fetch('/api/icd10-codes?limit=200')
      .then(r => r.ok ? r.json() : { codes: [] })
      .then(d => setIcd10Options(d.codes ?? d.icd10Codes ?? []))
      .catch(() => {});
  }, []);

  // Stats
  const stats = {
    open: encounters.filter(e => e.status === 'open').length,
    awaiting_md: encounters.filter(e => e.status === 'awaiting_md').length,
    signed: encounters.filter(e => e.status === 'signed').length,
    billed: encounters.filter(e => e.status === 'billed').length,
  };

  // Open sign modal
  async function openSignModal(enc: Encounter) {
    setSignModalEnc(enc);
    setMdName(enc.signedBy ?? enc.doctorName ?? '');
    setSelectedIcd(enc.diagnosisCode ?? '');
    setSignError('');
    setCptData(null);
    setLoadingCpt(true);

    try {
      const r = await fetch(`/api/encounters/${enc.id}/cpt`, { method: 'POST' });
      if (r.ok) setCptData(await r.json());
    } catch { /* ignore */ } finally {
      setLoadingCpt(false);
    }
  }

  async function handleSign() {
    if (!signModalEnc || !mdName.trim()) {
      setSignError('MD name is required');
      return;
    }
    setSigning(true);
    setSignError('');
    try {
      const attestation = `I have personally reviewed and approve the clinical documentation for this encounter. ${mdName.trim()} — ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
      const r = await fetch(`/api/encounters/${signModalEnc.id}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mdName: mdName.trim(), attestation, diagnosisCode: selectedIcd || undefined }),
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.error ?? 'Sign failed');
      }
      setSignModalEnc(null);
      fetchEncounters();
    } catch (e: unknown) {
      setSignError(e instanceof Error ? e.message : 'Sign failed');
    } finally {
      setSigning(false);
    }
  }

  async function handleBill(enc: Encounter) {
    if (!confirm(`Mark encounter for ${patients[enc.patientId]?.name ?? enc.patientId} as BILLED?`)) return;
    try {
      const r = await fetch(`/api/encounters/${enc.id}/bill`, { method: 'POST' });
      if (!r.ok) {
        const e = await r.json();
        alert(e.error ?? 'Failed to bill');
        return;
      }
      fetchEncounters();
    } catch { alert('Failed to bill encounter'); }
  }

  function handleSuperbill(enc: Encounter) {
    window.open(`/api/encounters/${enc.id}/pdf`, '_blank');
  }

  const statBox = (label: string, count: number, color: string, emoji: string) => (
    <div style={{
      flex: 1, minWidth: 100, background: '#fff', borderRadius: 10, padding: '12px 16px',
      border: `1px solid #e2e8f0`, display: 'flex', flexDirection: 'column', gap: 2,
    }}>
      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>{emoji} {label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{count}</div>
    </div>
  );

  return (
    <>
      {/* Sign Modal */}
      {signModalEnc && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 620,
            maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>✍️ MD Sign-Off</div>
              <button onClick={() => setSignModalEnc(null)} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            {/* SOAP Summary */}
            <div style={{ background: '#f8fafc', borderRadius: 8, padding: 14, marginBottom: 16, fontSize: 12 }}>
              <div style={{ fontWeight: 700, color: '#374151', marginBottom: 8 }}>📋 Encounter Summary</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div><span style={{ color: '#64748b' }}>Patient ID:</span> <span style={{ fontFamily: 'monospace' }}>{signModalEnc.patientId.slice(0, 12)}</span></div>
                <div><span style={{ color: '#64748b' }}>Date:</span> {new Date(signModalEnc.encounterDate).toLocaleDateString('en-US')}</div>
                <div><span style={{ color: '#64748b' }}>RN:</span> {signModalEnc.nurseName ?? '—'}</div>
                <div><span style={{ color: '#64748b' }}>Status:</span> <StatusBadge status={signModalEnc.status} /></div>
              </div>
              <div style={{ marginTop: 8 }}>
                <div style={{ color: '#64748b', fontWeight: 600 }}>Chief Complaint:</div>
                <div>{signModalEnc.chiefComplaint}</div>
              </div>
              {signModalEnc.subjectiveNotes && <div style={{ marginTop: 6 }}><span style={{ color: '#64748b', fontWeight: 600 }}>S: </span>{signModalEnc.subjectiveNotes}</div>}
              {signModalEnc.objectiveNotes && <div style={{ marginTop: 4 }}><span style={{ color: '#64748b', fontWeight: 600 }}>O: </span>{signModalEnc.objectiveNotes}</div>}
              {signModalEnc.assessment && <div style={{ marginTop: 4 }}><span style={{ color: '#64748b', fontWeight: 600 }}>A: </span>{signModalEnc.assessment}</div>}
              {signModalEnc.plan && <div style={{ marginTop: 4 }}><span style={{ color: '#64748b', fontWeight: 600 }}>P: </span>{signModalEnc.plan}</div>}
            </div>

            {/* CPT Codes */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, color: '#374151', fontSize: 13, marginBottom: 8 }}>🧾 CPT Codes</div>
              {loadingCpt ? (
                <div style={{ color: '#64748b', fontSize: 12 }}>Calculating CPT codes…</div>
              ) : cptData && cptData.cptCodes.length > 0 ? (
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        {['Code', 'Description', 'Units', 'Fee', 'Total'].map(h => (
                          <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: '#374151', fontSize: 11 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cptData.cptCodes.map(c => (
                        <tr key={c.code} style={{ borderTop: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px 10px', fontWeight: 700, fontFamily: 'monospace' }}>{c.code}</td>
                          <td style={{ padding: '6px 10px', color: '#374151' }}>{c.description}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'center' }}>{c.units}</td>
                          <td style={{ padding: '6px 10px' }}>${c.fee.toFixed(2)}</td>
                          <td style={{ padding: '6px 10px', fontWeight: 700, color: '#0d9488' }}>${c.total.toFixed(2)}</td>
                        </tr>
                      ))}
                      <tr style={{ background: '#f0fdf4', borderTop: '2px solid #0d9488' }}>
                        <td colSpan={4} style={{ padding: '8px 10px', fontWeight: 800, color: '#0d9488', textAlign: 'right' }}>TOTAL CHARGES:</td>
                        <td style={{ padding: '8px 10px', fontWeight: 800, color: '#0d9488' }}>${cptData.grandTotal.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ color: '#64748b', fontSize: 12, fontStyle: 'italic' }}>No CPT codes found for this encounter date. Check test results.</div>
              )}
            </div>

            {/* ICD-10 Selector */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontWeight: 700, color: '#374151', fontSize: 13, display: 'block', marginBottom: 6 }}>📑 Primary Diagnosis (ICD-10)</label>
              <select
                value={selectedIcd}
                onChange={e => setSelectedIcd(e.target.value)}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0',
                  fontSize: 13, background: '#fff', color: '#111827',
                }}
              >
                <option value="">— Select ICD-10 Code —</option>
                {icd10Options.map(opt => (
                  <option key={opt.id} value={opt.code}>{opt.code} — {opt.description}</option>
                ))}
              </select>
            </div>

            {/* MD Name */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontWeight: 700, color: '#374151', fontSize: 13, display: 'block', marginBottom: 6 }}>👨‍⚕️ MD Name (Signing Provider)</label>
              <input
                type="text"
                value={mdName}
                onChange={e => setMdName(e.target.value)}
                placeholder="Dr. [Full Name]"
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 8,
                  border: '1px solid #e2e8f0', fontSize: 13, boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Attestation preview */}
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12, color: '#15803d' }}>
              📝 Attestation: "I have personally reviewed and approve the clinical documentation for this encounter. {mdName.trim() || '[MD Name]'} — {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}"
            </div>

            {signError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 12, color: '#b91c1c' }}>
                ❌ {signError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setSignModalEnc(null)} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
                Cancel
              </button>
              <button
                onClick={handleSign}
                disabled={signing || !mdName.trim()}
                style={{
                  padding: '8px 18px', borderRadius: 8, border: 'none',
                  background: signing || !mdName.trim() ? '#94a3b8' : '#0d9488',
                  color: '#fff', cursor: signing || !mdName.trim() ? 'not-allowed' : 'pointer',
                  fontWeight: 700, fontSize: 13,
                }}
              >
                {signing ? '⏳ Signing…' : '✅ Sign & Lock Encounter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="page-title">📋 Encounters</div>
          <div className="page-subtitle">{loading ? 'Loading…' : `${encounters.length} encounter${encounters.length !== 1 ? 's' : ''}`}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, color: '#111827' }}
          />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, color: '#111827' }}
          >
            <option value="all">All Statuses</option>
            <option value="open">🟡 Open</option>
            <option value="awaiting_md">🟠 Awaiting MD</option>
            <option value="signed">🟢 Signed</option>
            <option value="billed">💙 Billed</option>
          </select>
          <button
            onClick={() => { setDateFilter(''); setStatusFilter('all'); }}
            style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', fontSize: 12, cursor: 'pointer', color: '#64748b' }}
          >
            Clear
          </button>
        </div>
      </div>

      <div className="page-body">
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#b91c1c', fontSize: 13 }}>
            🔐 {error}
            <button onClick={fetchEncounters} style={{ marginLeft: 12, padding: '2px 10px', borderRadius: 6, border: '1px solid #fecaca', background: '#fff', color: '#b91c1c', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>Retry</button>
          </div>
        )}

        {/* Stats Bar */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          {statBox('Open', stats.open, '#b45309', '🟡')}
          {statBox('Awaiting MD', stats.awaiting_md, '#c2410c', '🟠')}
          {statBox('Signed', stats.signed, '#15803d', '🟢')}
          {statBox('Billed', stats.billed, '#1d4ed8', '💙')}
        </div>

        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : encounters.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 48 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#374151', marginBottom: 8 }}>No encounters found</div>
            <div style={{ color: '#64748b', marginBottom: 20 }}>
              {dateFilter ? `No encounters on ${dateFilter}` : 'Create encounters from the patient detail page'}
            </div>
            <Link href="/patients" className="btn">Go to Patients</Link>
          </div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Time', 'Patient', 'Provider', 'Chief Complaint', 'Status', 'Wait', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {encounters.map(e => {
                    const pat = patients[e.patientId];
                    const encTime = new Date(e.encounterDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                    return (
                      <tr
                        key={e.id}
                        style={{ borderBottom: '1px solid #f1f5f9' }}
                        onMouseEnter={ev => (ev.currentTarget.style.background = '#f8fafc')}
                        onMouseLeave={ev => (ev.currentTarget.style.background = '')}
                      >
                        <td style={{ padding: '10px 14px', color: '#64748b', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 12 }}>{encTime}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{pat?.name ?? '—'}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>{e.patientId.slice(0, 10)}</div>
                        </td>
                        <td style={{ padding: '10px 14px', color: '#374151' }}>
                          <div>{e.doctorName ?? '—'}</div>
                          {e.nurseName && <div style={{ fontSize: 11, color: '#64748b' }}>RN: {e.nurseName}</div>}
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: 600, maxWidth: 180 }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.chiefComplaint}</div>
                          {e.diagnosisCode && <div style={{ fontSize: 11, color: '#0d9488', fontFamily: 'monospace' }}>{e.diagnosisCode}</div>}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <StatusBadge status={e.status} />
                          {e.signedBy && <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>by {e.signedBy}</div>}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: 12, whiteSpace: 'nowrap' }}>
                          {e.createdAt ? timeAgo(e.createdAt) : '—'}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {/* View always */}
                            <Link
                              href={`/patients/${e.patientId}`}
                              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#374151', textDecoration: 'none', fontWeight: 600, whiteSpace: 'nowrap' }}
                            >
                              👁 View
                            </Link>

                            {/* Open → Document */}
                            {e.status === 'open' && (
                              <Link
                                href={`/patients/${e.patientId}#encounters`}
                                style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: 'none', background: '#0d9488', color: '#fff', textDecoration: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}
                              >
                                📝 Document
                              </Link>
                            )}

                            {/* Awaiting MD → Sign */}
                            {e.status === 'awaiting_md' && (
                              <button
                                onClick={() => openSignModal(e)}
                                style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: 'none', background: '#ea580c', color: '#fff', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                              >
                                ✍️ Sign
                              </button>
                            )}

                            {/* Signed → Superbill + Bill */}
                            {e.status === 'signed' && (
                              <>
                                <button
                                  onClick={() => handleSuperbill(e)}
                                  style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: 'none', background: '#15803d', color: '#fff', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                >
                                  🧾 Superbill
                                </button>
                                <button
                                  onClick={() => handleBill(e)}
                                  style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: 'none', background: '#1d4ed8', color: '#fff', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                >
                                  💙 Bill
                                </button>
                              </>
                            )}

                            {/* Billed → Superbill only */}
                            {e.status === 'billed' && (
                              <button
                                onClick={() => handleSuperbill(e)}
                                style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid #93c5fd', background: '#eff6ff', color: '#1d4ed8', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                              >
                                🧾 Superbill
                              </button>
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
