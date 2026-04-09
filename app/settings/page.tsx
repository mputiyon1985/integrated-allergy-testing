'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { Layout, LayoutItem, ResponsiveLayouts } from 'react-grid-layout';
import UsersManagement from '@/components/settings/UsersManagement';

const DashboardGrid = dynamic(() => import('@/components/DashboardGrid'), { ssr: false });

const SETTINGS_LAYOUT_KEY = 'iat-settings-layout-v1';

// 17 sections, each w:6 in a 2-column layout (12-col grid)
const SECTION_IDS = [
  'clinic-info',
  'system-status',
  'app-version',
  'quick-links',
] as const;

type SectionId = typeof SECTION_IDS[number];

interface MutableLayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

function buildDefaultLayouts(): ResponsiveLayouts {
  const lg: MutableLayoutItem[] = SECTION_IDS.map((id, i) => ({
    i: id,
    x: (i % 2) * 6,
    y: Math.floor(i / 2) * 12,
    w: 6,
    h: 12,
    minW: 3,
    minH: 6,
  }));
  // Override full-width sections
  const fullWidth: SectionId[] = [];
  lg.forEach(item => {
    if (fullWidth.includes(item.i as SectionId)) {
      item.x = 0;
      item.w = 12;
      item.h = 18;
    }
  });
  // Recalculate Y positions
  let currentY = 0;
  let pendingHalf: MutableLayoutItem | null = null;
  const result: MutableLayoutItem[] = [];
  for (const item of lg) {
    if (item.w === 12) {
      if (pendingHalf) {
        pendingHalf.y = currentY;
        result.push(pendingHalf);
        currentY += pendingHalf.h;
        pendingHalf = null;
      }
      item.y = currentY;
      result.push(item);
      currentY += item.h;
    } else {
      if (!pendingHalf) {
        item.x = 0;
        item.y = currentY;
        pendingHalf = item;
      } else {
        item.x = 6;
        item.y = currentY;
        result.push(pendingHalf);
        result.push(item);
        currentY += Math.max(pendingHalf.h, item.h);
        pendingHalf = null;
      }
    }
  }
  if (pendingHalf) {
    result.push(pendingHalf);
  }

  let smY = 0;
  const smResult: MutableLayoutItem[] = result.map(item => {
    const r: MutableLayoutItem = { ...item, x: 0, w: 6, y: smY };
    smY += item.h;
    return r;
  });

  return { lg: result as unknown as Layout, sm: smResult as unknown as Layout };
}

const DEFAULT_SETTINGS_LAYOUTS = buildDefaultLayouts();

function loadSettingsLayouts(): ResponsiveLayouts {
  try {
    const saved = localStorage.getItem(SETTINGS_LAYOUT_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return DEFAULT_SETTINGS_LAYOUTS;
}

type AuditLogEntry = {
  id: string;
  action: string;
  performedBy: string | null;
  entity: string | null;
  entityId: string | null;
  patientId: string | null;
  patientName: string | null;
  details: string | null;
  createdAt: string;
  patient?: { id: string; patientId: string; name: string } | null;
};

function getActionColor(action: string): string {
  const upper = action.toUpperCase();
  if (upper.includes('CREATED') || upper.includes('REGISTER') || upper.includes('SIGN')) {
    return '#16a34a';
  }
  if (upper.includes('VIEW') || upper.includes('READ') || upper.includes('ACCESS') || upper.includes('LOGIN') || upper.includes('LOOKUP')) {
    return '#2563eb';
  }
  if (upper.includes('UPDATED') || upper.includes('MODIFIED') || upper.includes('CHANGED')) {
    return '#d97706';
  }
  if (upper.includes('DELETED') || upper.includes('REMOVED') || upper.includes('LOGOUT')) {
    return '#dc2626';
  }
  return '#64748b';
}

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return ts;
  }
}

function AuditLogContent() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  function fetchLogs() {
    setLoading(true);
    setLoadError(null);
    fetch('/api/audit?limit=200')
      .then(async r => {
        if (!r.ok) throw new Error(r.status === 401 ? 'session_expired' : `HTTP ${r.status}`);
        return r.json();
      })
      .then(d => {
        setLogs(Array.isArray(d) ? d : (d.logs ?? d.entries ?? []));
        setLoading(false);
      })
      .catch(err => {
        console.error('[AuditLogContent] fetch error:', err.message);
        setLoadError(err.message === 'session_expired' ? 'Session expired — please refresh and log in again' : `Failed to load audit log: ${err.message}`);
        setLoading(false);
      });
  }

  useEffect(() => {
    fetchLogs();
  }, []);

  const filtered = logs.filter(l =>
    !filter ||
    l.action.toLowerCase().includes(filter.toLowerCase()) ||
    (l.entity || '').toLowerCase().includes(filter.toLowerCase()) ||
    (l.details || '').toLowerCase().includes(filter.toLowerCase()) ||
    (l.patientId || '').toLowerCase().includes(filter.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <>
      <div className="card-title">Audit Log</div>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
        HIPAA compliance audit trail — recent activity across the system.
      </p>

      {loadError && (
        <div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:8,padding:'12px 16px',marginBottom:16,color:'#b91c1c',fontSize:13}}>
          🔐 {loadError}
          <button onClick={fetchLogs} style={{marginLeft:12,padding:'2px 10px',borderRadius:6,border:'1px solid #fecaca',background:'#fff',color:'#b91c1c',fontSize:12,cursor:'pointer',fontWeight:700}}>Retry</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <input
          type="text"
          className="form-input"
          placeholder="Filter by action, entity, or details…"
          value={filter}
          onChange={e => { setFilter(e.target.value); setPage(0); }}
          style={{ maxWidth: 360 }}
        />
        <span style={{ fontSize: 13, color: '#64748b' }}>
          {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      {loading ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: '#64748b' }}>Loading audit log…</div>
      ) : paginated.length === 0 ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: '#64748b' }}>
          {filter ? 'No matching entries.' : 'No audit log entries found.'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>Timestamp</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Action</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Entity</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Details</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Patient</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((log, i) => (
                <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                  <td style={{ padding: '8px 12px', color: '#64748b', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 12 }}>
                    {formatTimestamp(log.createdAt)}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#fff',
                      background: getActionColor(log.action),
                      letterSpacing: '0.03em',
                    }}>
                      {log.action}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', color: '#475569' }}>{log.entity ?? '—'}</td>
                  <td style={{ padding: '8px 12px', color: '#334155', maxWidth: 320 }}>
                    <span title={log.details ?? undefined} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.details ?? '—'}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    {log.patientName ? (
                      <span style={{ color: '#374151', fontSize: 12, fontWeight: 500 }}>{log.patientName}</span>
                    ) : log.patient ? (
                      <Link href={`/patients/${log.patient.id}`} style={{ color: '#2563eb', textDecoration: 'underline', fontSize: 12 }}>
                        {log.patient.name || log.patient.patientId}
                      </Link>
                    ) : (
                      <span style={{ color: '#cbd5e1' }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center', justifyContent: 'flex-end' }}>
          <button
            className="btn btn-secondary"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{ padding: '6px 14px', fontSize: 13 }}
          >
            ← Prev
          </button>
          <span style={{ fontSize: 13, color: '#64748b' }}>
            Page {page + 1} of {totalPages}
          </span>
          <button
            className="btn btn-secondary"
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            style={{ padding: '6px 14px', fontSize: 13 }}
          >
            Next →
          </button>
        </div>
      )}
    </>
  );
}

function Icd10CodesContent() {
  const [codes, setCodes] = useState<{ id: string; code: string; description: string; category?: string; active: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ code: '', description: '', category: '' });
  const [saving, setSaving] = useState(false);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editingRowData, setEditingRowData] = useState({ description: '', category: '' });

  function load() {
    setLoadError(null);
    fetch('/api/icd10-codes?all=true')
      .then(async r => {
        if (!r.ok) throw new Error(r.status === 401 ? 'session_expired' : `HTTP ${r.status}`);
        return r.json();
      })
      .then(d => { setCodes(d.codes ?? (Array.isArray(d) ? d : [])); setLoading(false); })
      .catch(err => {
        console.error('[Icd10CodesContent] fetch error:', err.message);
        setLoadError(err.message === 'session_expired' ? 'Session expired — please refresh and log in again' : `Failed to load ICD-10 codes: ${err.message}`);
        setLoading(false);
      });
  }

  useEffect(() => { load(); }, []);

  async function toggleActive(id: string, active: boolean) {
    await fetch(`/api/icd10-codes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !active }),
    }).catch(() => {});
    load();
  }

  async function addCode() {
    if (!addForm.code.trim() || !addForm.description.trim()) return;
    setSaving(true);
    await fetch('/api/icd10-codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(addForm),
    }).catch(() => {});
    setSaving(false);
    setAddForm({ code: '', description: '', category: '' });
    setShowAdd(false);
    load();
  }

  function startEditRow(c: { id: string; description: string; category?: string }) {
    setEditingRowId(c.id);
    setEditingRowData({ description: c.description, category: c.category ?? '' });
  }

  async function saveEditRow(id: string) {
    await fetch(`/api/icd10-codes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: editingRowData.description, category: editingRowData.category }),
    }).catch(() => {});
    setEditingRowId(null);
    load();
  }

  async function deleteCode(id: string, code: string) {
    if (!confirm(`Delete ${code}? This action cannot be undone.`)) return;
    await fetch(`/api/icd10-codes/${id}`, { method: 'DELETE' }).catch(() => {});
    load();
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>🏷️ ICD-10 Diagnosis Codes</div>
        <button onClick={() => setShowAdd(v => !v)}
          style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#0d9488', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          + Add Code
        </button>
      </div>
      {loadError && (
        <div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:8,padding:'12px 16px',marginBottom:16,color:'#b91c1c',fontSize:13}}>
          🔐 {loadError}
          <button onClick={load} style={{marginLeft:12,padding:'2px 10px',borderRadius:6,border:'1px solid #fecaca',background:'#fff',color:'#b91c1c',fontSize:12,cursor:'pointer',fontWeight:700}}>Retry</button>
        </div>
      )}
      {showAdd && (
        <div style={{ background: '#f0fdf4', borderRadius: 10, padding: 16, marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Code *</label>
            <input className="form-input" value={addForm.code} onChange={e => setAddForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. J30.1" style={{ width: 120 }} />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Description *</label>
            <input className="form-input" value={addForm.description} onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Allergic rhinitis due to pollen" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Category</label>
            <input className="form-input" value={addForm.category} onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Allergic Rhinitis" style={{ width: 160 }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={addCode} disabled={saving || !addForm.code.trim() || !addForm.description.trim()}
              style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#0d9488', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              {saving ? '⏳' : '💾 Save'}
            </button>
            <button onClick={() => setShowAdd(false)}
              style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
          </div>
        </div>
      )}
      {loading ? (
        <div style={{ padding: '16px 0', textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
      ) : codes.length === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>No ICD-10 codes configured yet. Click &quot;+ Add Code&quot; to add one.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                {['Code', 'Description', 'Category', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {codes.map((c, i) => (
                <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0d9488', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{c.code}</td>
                  {editingRowId === c.id ? (
                    <>
                      <td style={{ padding: '6px 12px' }}>
                        <input
                          className="form-input"
                          value={editingRowData.description}
                          onChange={e => setEditingRowData(d => ({ ...d, description: e.target.value }))}
                          style={{ width: '100%', minWidth: 180 }}
                          autoFocus
                        />
                      </td>
                      <td style={{ padding: '6px 12px' }}>
                        <input
                          className="form-input"
                          value={editingRowData.category}
                          onChange={e => setEditingRowData(d => ({ ...d, category: e.target.value }))}
                          style={{ width: '100%', minWidth: 120 }}
                        />
                      </td>
                      <td style={{ padding: '6px 12px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => saveEditRow(c.id)}
                            style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: '#0d9488', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                            💾 Save
                          </button>
                          <button onClick={() => setEditingRowId(null)}
                            style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', fontSize: 12, cursor: 'pointer' }}>
                            Cancel
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ padding: '8px 12px', color: '#374151' }}>{c.description}</td>
                      <td style={{ padding: '8px 12px', color: '#64748b', fontSize: 12 }}>{c.category ?? '—'}</td>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <button onClick={() => startEditRow(c)}
                            style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', fontSize: 12, cursor: 'pointer' }}
                            title="Edit">
                            ✏️
                          </button>
                          <button onClick={() => deleteCode(c.id, c.code)}
                            style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #fecaca', background: '#fff7f7', fontSize: 12, cursor: 'pointer' }}
                            title="Delete">
                            🗑️
                          </button>
                          <button onClick={() => toggleActive(c.id, c.active)}
                            style={{ padding: '3px 12px', borderRadius: 999, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                              background: c.active ? '#dcfce7' : '#f3f4f6', color: c.active ? '#15803d' : '#64748b' }}>
                            {c.active ? '✅ Active' : '⬜ Inactive'}
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function CptCodesContent() {
  const [codes, setCodes] = useState<{ id: string; code: string; description: string; category?: string; defaultFee?: number | null; nonFacilityFee?: number | null; facilityFee?: number | null; maximumAllowable?: number | null; active: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ code: '', description: '', category: '' });
  const [saving, setSaving] = useState(false);
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null);
  const [editingFeeVal, setEditingFeeVal] = useState('');
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editingRowData, setEditingRowData] = useState({ description: '', category: '' });

  function load() {
    setLoadError(null);
    fetch('/api/cpt-codes?all=true')
      .then(async r => {
        if (!r.ok) throw new Error(r.status === 401 ? 'session_expired' : `HTTP ${r.status}`);
        return r.json();
      })
      .then(d => { setCodes(d.codes ?? (Array.isArray(d) ? d : [])); setLoading(false); })
      .catch(err => {
        console.error('[CptCodesContent] fetch error:', err.message);
        setLoadError(err.message === 'session_expired' ? 'Session expired — please refresh and log in again' : `Failed to load CPT codes: ${err.message}`);
        setLoading(false);
      });
  }

  useEffect(() => { load(); }, []);

  async function toggleActive(id: string, active: boolean) {
    await fetch(`/api/cpt-codes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !active }),
    }).catch(() => {});
    load();
  }

  async function addCode() {
    if (!addForm.code.trim() || !addForm.description.trim()) return;
    setSaving(true);
    await fetch('/api/cpt-codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(addForm),
    }).catch(() => {});
    setSaving(false);
    setAddForm({ code: '', description: '', category: '' });
    setShowAdd(false);
    load();
  }

  async function saveFee(id: string) {
    const fee = editingFeeVal ? parseFloat(editingFeeVal) : null;
    await fetch(`/api/cpt-codes/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ defaultFee: fee }),
    }).catch(() => {});
    setEditingFeeId(null); setEditingFeeVal(''); load();
  }

  function startEditRow(c: { id: string; description: string; category?: string }) {
    setEditingRowId(c.id);
    setEditingRowData({ description: c.description, category: c.category ?? '' });
    setEditingFeeId(null);
  }

  async function saveEditRow(id: string) {
    await fetch(`/api/cpt-codes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: editingRowData.description, category: editingRowData.category }),
    }).catch(() => {});
    setEditingRowId(null);
    load();
  }

  async function deleteCode(id: string, code: string) {
    if (!confirm(`Delete ${code}? This action cannot be undone.`)) return;
    await fetch(`/api/cpt-codes/${id}`, { method: 'DELETE' }).catch(() => {});
    load();
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>💊 CPT Procedure Codes</div>
        <button onClick={() => setShowAdd(v => !v)}
          style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#7c3aed', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          + Add Code
        </button>
      </div>
      {loadError && (
        <div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:8,padding:'12px 16px',marginBottom:16,color:'#b91c1c',fontSize:13}}>
          🔐 {loadError}
          <button onClick={load} style={{marginLeft:12,padding:'2px 10px',borderRadius:6,border:'1px solid #fecaca',background:'#fff',color:'#b91c1c',fontSize:12,cursor:'pointer',fontWeight:700}}>Retry</button>
        </div>
      )}
      {showAdd && (
        <div style={{ background: '#f5f3ff', borderRadius: 10, padding: 16, marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Code *</label>
            <input className="form-input" value={addForm.code} onChange={e => setAddForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. 95004" style={{ width: 110 }} />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Description *</label>
            <input className="form-input" value={addForm.description} onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Allergy skin tests, percutaneous" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Category</label>
            <input className="form-input" value={addForm.category} onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Allergy Testing" style={{ width: 150 }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={addCode} disabled={saving || !addForm.code.trim() || !addForm.description.trim()}
              style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#7c3aed', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              {saving ? '⏳' : '💾 Save'}
            </button>
            <button onClick={() => setShowAdd(false)}
              style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
          </div>
        </div>
      )}
      {loading ? (
        <div style={{ padding: '16px 0', textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
      ) : codes.length === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>No CPT codes configured yet. Click &quot;+ Add Code&quot; to add one.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                {['Code', 'Description', 'Category', '2026 Medicare NF', '2026 Medicare FAC', 'NoVA MAC (Max Allowable)', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {codes.map((c, i) => (
                <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 700, color: '#7c3aed', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{c.code}</td>
                  {editingRowId === c.id ? (
                    <>
                      <td style={{ padding: '6px 12px' }}>
                        <input
                          className="form-input"
                          value={editingRowData.description}
                          onChange={e => setEditingRowData(d => ({ ...d, description: e.target.value }))}
                          style={{ width: '100%', minWidth: 180 }}
                          autoFocus
                        />
                      </td>
                      <td style={{ padding: '6px 12px' }}>
                        <input
                          className="form-input"
                          value={editingRowData.category}
                          onChange={e => setEditingRowData(d => ({ ...d, category: e.target.value }))}
                          style={{ width: '100%', minWidth: 120 }}
                        />
                      </td>
                      <td style={{ padding: '8px 12px', color: '#64748b', fontSize: 12 }}>
                        {c.defaultFee != null ? `$${Number(c.defaultFee).toFixed(2)}` : '—'}
                      </td>
                      <td style={{ padding: '6px 12px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => saveEditRow(c.id)}
                            style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: '#7c3aed', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                            💾 Save
                          </button>
                          <button onClick={() => setEditingRowId(null)}
                            style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', fontSize: 12, cursor: 'pointer' }}>
                            Cancel
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ padding: '8px 12px', color: '#374151' }}>{c.description}</td>
                      <td style={{ padding: '8px 12px', color: '#64748b', fontSize: 12 }}>{c.category ?? '—'}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12, color: c.nonFacilityFee ? '#15803d' : '#94a3b8', fontWeight: c.nonFacilityFee ? 600 : 400 }}>
                        {c.nonFacilityFee ? `$${Number(c.nonFacilityFee).toFixed(2)}` : '—'}
                      </td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12, color: c.facilityFee ? '#0369a1' : '#94a3b8', fontWeight: c.facilityFee ? 600 : 400 }}>
                        {c.facilityFee ? `$${Number(c.facilityFee).toFixed(2)}` : '—'}
                      </td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 12, color: c.maximumAllowable ? '#7c3aed' : '#94a3b8', fontWeight: c.maximumAllowable ? 700 : 400 }}>
                        {c.maximumAllowable ? `$${Number(c.maximumAllowable).toFixed(2)}` : '—'}
                      </td>
                      {/* Your Fee ($) hidden from display but kept in DB */}
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <button onClick={() => startEditRow(c)}
                            style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', fontSize: 12, cursor: 'pointer' }}
                            title="Edit">
                            ✏️
                          </button>
                          <button onClick={() => deleteCode(c.id, c.code)}
                            style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #fecaca', background: '#fff7f7', fontSize: 12, cursor: 'pointer' }}
                            title="Delete">
                            🗑️
                          </button>
                          <button onClick={() => toggleActive(c.id, c.active)}
                            style={{ padding: '3px 12px', borderRadius: 999, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                              background: c.active ? '#dcfce7' : '#f3f4f6', color: c.active ? '#15803d' : '#64748b' }}>
                            {c.active ? '✅ Active' : '⬜ Inactive'}
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

type BillingRuleRow = {
  id: string;
  name: string;
  description: string;
  insuranceType: string;
  ruleType: string;
  cptCode?: string | null;
  relatedCptCode?: string | null;
  maxUnits?: number | null;
  requiresModifier?: string | null;
  requiresDxMatch: boolean;
  warningMessage: string;
  active: boolean;
  sortOrder: number;
};

const INSURANCE_BADGE_COLORS: Record<string, { bg: string; color: string }> = {
  medicare:   { bg: '#dbeafe', color: '#1d4ed8' },
  medicaid:   { bg: '#dcfce7', color: '#15803d' },
  all:        { bg: '#f1f5f9', color: '#475569' },
  bcbs:       { bg: '#e0e7ff', color: '#4338ca' },
  commercial: { bg: '#f3e8ff', color: '#7c3aed' },
  tricare:    { bg: '#ffedd5', color: '#c2410c' },
  aetna:      { bg: '#fce7f3', color: '#be185d' },
  united:     { bg: '#fef3c7', color: '#b45309' },
  cigna:      { bg: '#d1fae5', color: '#065f46' },
};

function InsuranceBadge({ type }: { type: string }) {
  const style = INSURANCE_BADGE_COLORS[type.toLowerCase()] ?? INSURANCE_BADGE_COLORS.all;
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 700,
      background: style.bg,
      color: style.color,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
    }}>
      {type}
    </span>
  );
}

const EMPTY_RULE_FORM = {
  name: '',
  description: '',
  insuranceType: 'all',
  ruleType: 'documentation',
  cptCode: '',
  relatedCptCode: '',
  maxUnits: '',
  requiresModifier: '',
  requiresDxMatch: false,
  warningMessage: '',
  sortOrder: '0',
};

interface PracticeData {
  id: string;
  name: string;
  shortName: string | null;
  phone: string | null;
  fax: string | null;
  email: string | null;
  website: string | null;
  npi: string | null;
  taxId: string | null;
  locations?: { id: string; name: string; key: string; active: boolean; city?: string; state?: string }[];
}


function BillingRulesContent() {
  const [rules, setRules] = useState<BillingRuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_RULE_FORM);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_RULE_FORM);

  function load() {
    setLoadError(null);
    fetch('/api/billing-rules?all=true')
      .then(async r => {
        if (!r.ok) throw new Error(r.status === 401 ? 'session_expired' : `HTTP ${r.status}`);
        return r.json();
      })
      .then(d => { setRules(d.rules ?? []); setLoading(false); })
      .catch(err => {
        console.error('[BillingRulesContent] fetch error:', err.message);
        setLoadError(err.message === 'session_expired' ? 'Session expired — please refresh and log in again' : `Failed to load billing rules: ${err.message}`);
        setLoading(false);
      });
  }

  useEffect(() => { load(); }, []);

  async function toggleActive(id: string, active: boolean) {
    await fetch(`/api/billing-rules/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !active }),
    }).catch(() => {});
    load();
  }

  async function addRule() {
    if (!addForm.name.trim() || !addForm.warningMessage.trim() || !addForm.ruleType.trim()) return;
    setSaving(true);
    await fetch('/api/billing-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...addForm,
        maxUnits: addForm.maxUnits ? parseInt(addForm.maxUnits) : null,
        sortOrder: addForm.sortOrder ? parseInt(addForm.sortOrder) : 0,
        cptCode: addForm.cptCode || null,
        relatedCptCode: addForm.relatedCptCode || null,
        requiresModifier: addForm.requiresModifier || null,
      }),
    }).catch(() => {});
    setSaving(false);
    setAddForm(EMPTY_RULE_FORM);
    setShowAdd(false);
    load();
  }

  function startEdit(r: BillingRuleRow) {
    setEditingId(r.id);
    setEditForm({
      name: r.name,
      description: r.description,
      insuranceType: r.insuranceType,
      ruleType: r.ruleType,
      cptCode: r.cptCode ?? '',
      relatedCptCode: r.relatedCptCode ?? '',
      maxUnits: r.maxUnits != null ? String(r.maxUnits) : '',
      requiresModifier: r.requiresModifier ?? '',
      requiresDxMatch: r.requiresDxMatch,
      warningMessage: r.warningMessage,
      sortOrder: String(r.sortOrder),
    });
  }

  async function saveEdit(id: string) {
    await fetch(`/api/billing-rules/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...editForm,
        maxUnits: editForm.maxUnits ? parseInt(editForm.maxUnits) : null,
        sortOrder: editForm.sortOrder ? parseInt(editForm.sortOrder) : 0,
        cptCode: editForm.cptCode || null,
        relatedCptCode: editForm.relatedCptCode || null,
        requiresModifier: editForm.requiresModifier || null,
      }),
    }).catch(() => {});
    setEditingId(null);
    load();
  }

  async function deleteRule(id: string, name: string) {
    if (!confirm(`Deactivate rule "${name}"?`)) return;
    await fetch(`/api/billing-rules/${id}`, { method: 'DELETE' }).catch(() => {});
    load();
  }

  const RULE_TYPES = [
    'same_day_conflict', 'requires_modifier', 'max_units', 'lifetime_limit',
    'dx_required', 'prior_auth', 'specialist_required', 'supervision',
    'documentation', 'unbundling', 'in_person_required',
  ];

  const INSURANCE_TYPES = ['all', 'medicare', 'medicaid', 'bcbs', 'commercial', 'tricare', 'aetna', 'united', 'cigna'];

  function RuleForm({ form, onChange, onSave, onCancel, saveLabel }: {
    form: typeof EMPTY_RULE_FORM;
    onChange: (f: typeof EMPTY_RULE_FORM) => void;
    onSave: () => void;
    onCancel: () => void;
    saveLabel: string;
  }) {
    return (
      <div style={{ background: '#fefce8', borderRadius: 10, padding: 16, marginBottom: 16, border: '1px solid #fde68a' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Rule Name *</label>
            <input className="form-input" value={form.name} onChange={e => onChange({ ...form, name: e.target.value })} placeholder="e.g. 95004 + 95024 Same Day" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Insurance Type *</label>
            <select className="form-input" value={form.insuranceType} onChange={e => onChange({ ...form, insuranceType: e.target.value })}>
              {INSURANCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Rule Type *</label>
            <select className="form-input" value={form.ruleType} onChange={e => onChange({ ...form, ruleType: e.target.value })}>
              {RULE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>CPT Code</label>
            <input className="form-input" value={form.cptCode} onChange={e => onChange({ ...form, cptCode: e.target.value })} placeholder="e.g. 95004" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Related CPT Code</label>
            <input className="form-input" value={form.relatedCptCode} onChange={e => onChange({ ...form, relatedCptCode: e.target.value })} placeholder="e.g. 95024" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Requires Modifier</label>
            <input className="form-input" value={form.requiresModifier} onChange={e => onChange({ ...form, requiresModifier: e.target.value })} placeholder="e.g. 25" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Max Units</label>
            <input className="form-input" type="number" value={form.maxUnits} onChange={e => onChange({ ...form, maxUnits: e.target.value })} placeholder="e.g. 10" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Sort Order</label>
            <input className="form-input" type="number" value={form.sortOrder} onChange={e => onChange({ ...form, sortOrder: e.target.value })} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
            <input type="checkbox" id="requiresDx" checked={form.requiresDxMatch} onChange={e => onChange({ ...form, requiresDxMatch: e.target.checked })} />
            <label htmlFor="requiresDx" style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Requires Dx Match</label>
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Description</label>
          <input className="form-input" value={form.description} onChange={e => onChange({ ...form, description: e.target.value })} placeholder="Short internal description" />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Warning Message * (shown to staff)</label>
          <textarea className="form-input" rows={3} value={form.warningMessage} onChange={e => onChange({ ...form, warningMessage: e.target.value })} placeholder="Enter the warning message staff will see…" style={{ resize: 'vertical' }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onSave} disabled={saving || !form.name.trim() || !form.warningMessage.trim()}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#f59e0b', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            {saving ? '⏳' : `💾 ${saveLabel}`}
          </button>
          <button onClick={onCancel}
            style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>⚕️ Billing Rules</div>
        <button onClick={() => { setShowAdd(v => !v); setEditingId(null); }}
          style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#f59e0b', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          + Add Rule
        </button>
      </div>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
        Per-encounter billing compliance rules. Soft warnings only — staff are alerted but can proceed.
      </p>

      {loadError && (
        <div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:8,padding:'12px 16px',marginBottom:16,color:'#b91c1c',fontSize:13}}>
          🔐 {loadError}
          <button onClick={load} style={{marginLeft:12,padding:'2px 10px',borderRadius:6,border:'1px solid #fecaca',background:'#fff',color:'#b91c1c',fontSize:12,cursor:'pointer',fontWeight:700}}>Retry</button>
        </div>
      )}

      {showAdd && (
        <RuleForm
          form={addForm}
          onChange={setAddForm}
          onSave={addRule}
          onCancel={() => setShowAdd(false)}
          saveLabel="Save Rule"
        />
      )}

      {loading ? (
        <div style={{ padding: '16px 0', textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
      ) : rules.length === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
          No billing rules configured yet. Click &quot;+ Add Rule&quot; to add one.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                {['Rule Name', 'Insurance Type', 'CPT Code', 'Rule Type', 'Active', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rules.map((r, i) => (
                <>
                  <tr key={r.id} style={{ borderBottom: editingId === r.id ? 'none' : '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: '#334155', maxWidth: 240 }}>
                      <span title={r.description}>{r.name}</span>
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <InsuranceBadge type={r.insuranceType} />
                    </td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#7c3aed', fontWeight: 700 }}>
                      {r.cptCode ?? '—'}
                      {r.relatedCptCode && <span style={{ color: '#94a3b8', fontWeight: 400 }}> + {r.relatedCptCode}</span>}
                    </td>
                    <td style={{ padding: '8px 12px', color: '#64748b', fontSize: 12 }}>{r.ruleType}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <button onClick={() => toggleActive(r.id, r.active)}
                        style={{ padding: '3px 12px', borderRadius: 999, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                          background: r.active ? '#dcfce7' : '#f3f4f6', color: r.active ? '#15803d' : '#64748b' }}>
                        {r.active ? '✅ Active' : '⬜ Inactive'}
                      </button>
                    </td>
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => { startEdit(r); setShowAdd(false); }}
                          style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', fontSize: 12, cursor: 'pointer' }}
                          title="Edit">✏️</button>
                        <button onClick={() => deleteRule(r.id, r.name)}
                          style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #fecaca', background: '#fff7f7', fontSize: 12, cursor: 'pointer' }}
                          title="Deactivate">🗑️</button>
                      </div>
                    </td>
                  </tr>
                  {editingId === r.id && (
                    <tr key={`${r.id}-edit`} style={{ background: '#fefce8' }}>
                      <td colSpan={6} style={{ padding: '0 12px 12px 12px' }}>
                        <RuleForm
                          form={editForm}
                          onChange={setEditForm}
                          onSave={() => saveEdit(r.id)}
                          onCancel={() => setEditingId(null)}
                          saveLabel="Update Rule"
                        />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

type ServiceRow = {
  id: string;
  name: string;
  color: string;
  duration: number;
  sortOrder: number;
  active: boolean;
};

const EMPTY_SERVICE_FORM = {
  name: '',
  color: '#0d9488',
  duration: 30,
  sortOrder: 0,
  active: true,
};

function ServicesManagement() {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<ServiceRow | null>(null);
  const [form, setForm] = useState(EMPTY_SERVICE_FORM);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoadError(null);
    setLoading(true);
    fetch('/api/appointment-reasons?all=true')
      .then(async r => {
        if (!r.ok) throw new Error(r.status === 401 ? 'session_expired' : `HTTP ${r.status}`);
        return r.json();
      })
      .then(d => { setServices(d.reasons ?? []); setLoading(false); })
      .catch(err => {
        setLoadError(err.message === 'session_expired' ? 'Session expired — please refresh and log in again' : `Failed to load services: ${err.message}`);
        setLoading(false);
      });
  }

  useEffect(() => { load(); }, []);

  function openAddModal() {
    setEditingService(null);
    setForm(EMPTY_SERVICE_FORM);
    setShowModal(true);
  }

  function openEditModal(svc: ServiceRow) {
    setEditingService(svc);
    setForm({ name: svc.name, color: svc.color, duration: svc.duration, sortOrder: svc.sortOrder, active: svc.active });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingService(null);
    setForm(EMPTY_SERVICE_FORM);
  }

  async function saveService() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editingService) {
        await fetch(`/api/appointment-reasons/${editingService.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: form.name.trim(), color: form.color, duration: form.duration, sortOrder: form.sortOrder, active: form.active }),
        });
      } else {
        await fetch('/api/appointment-reasons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: form.name.trim(), color: form.color, duration: form.duration, sortOrder: form.sortOrder, active: form.active }),
        });
      }
    } catch {}
    setSaving(false);
    closeModal();
    load();
  }

  async function toggleActive(svc: ServiceRow) {
    await fetch(`/api/appointment-reasons/${svc.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !svc.active }),
    }).catch(() => {});
    load();
  }

  async function deleteService(svc: ServiceRow) {
    if (!confirm(`Delete "${svc.name}"? This will deactivate the service.`)) return;
    await fetch(`/api/appointment-reasons/${svc.id}`, { method: 'DELETE' }).catch(() => {});
    load();
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div className="card-title" style={{ marginBottom: 4 }}>🎨 Services</div>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
            Manage appointment services shown on the kiosk and used for color-coded waiting room badges.
          </p>
        </div>
        <button
          onClick={openAddModal}
          style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#0d9488', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>
          + Add Service
        </button>
      </div>

      {loadError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#b91c1c', fontSize: 13 }}>
          🔐 {loadError}
          <button onClick={load} style={{ marginLeft: 12, padding: '2px 10px', borderRadius: 6, border: '1px solid #fecaca', background: '#fff', color: '#b91c1c', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>Retry</button>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: '#94a3b8' }}>Loading services…</div>
      ) : services.length === 0 ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
          No services configured yet. Click &quot;+ Add Service&quot; to get started.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                {['Color', 'Service Name', 'Duration', 'Sort Order', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {services.map((svc, i) => (
                <tr key={svc.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ display: 'inline-block', width: 24, height: 24, borderRadius: '50%', background: svc.color, border: '2px solid rgba(0,0,0,0.1)', flexShrink: 0 }} title={svc.color} />
                  </td>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1e293b' }}>{svc.name}</td>
                  <td style={{ padding: '10px 12px', color: '#475569' }}>{svc.duration} min</td>
                  <td style={{ padding: '10px 12px', color: '#64748b' }}>{svc.sortOrder}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <button
                      onClick={() => toggleActive(svc)}
                      style={{ padding: '3px 12px', borderRadius: 999, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        background: svc.active ? '#dcfce7' : '#f3f4f6', color: svc.active ? '#15803d' : '#64748b' }}>
                      {svc.active ? '✅ Active' : '⬜ Inactive'}
                    </button>
                  </td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => openEditModal(svc)}
                        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', fontSize: 12, cursor: 'pointer' }}
                        title="Edit">
                        ✏️
                      </button>
                      <button
                        onClick={() => deleteService(svc)}
                        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #fecaca', background: '#fff7f7', fontSize: 12, cursor: 'pointer' }}
                        title="Delete">
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 20 }}>
              {editingService ? '✏️ Edit Service' : '➕ Add Service'}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>
                  Service Name *
                </label>
                <input
                  className="form-input"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Allergy Shot, Testing, Intake"
                  autoFocus
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>
                  Color
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 36, height: 36, borderRadius: '50%', background: form.color, border: '2px solid rgba(0,0,0,0.15)', flexShrink: 0, display: 'inline-block' }} />
                  <input
                    type="color"
                    value={form.color}
                    onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                    style={{ width: 60, height: 36, border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', padding: 2 }}
                  />
                  <span style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>{form.color}</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>
                    Duration (minutes)
                  </label>
                  <input
                    className="form-input"
                    type="number"
                    min={1}
                    value={form.duration}
                    onChange={e => setForm(f => ({ ...f, duration: parseInt(e.target.value) || 1 }))}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>
                    Sort Order
                  </label>
                  <input
                    className="form-input"
                    type="number"
                    min={0}
                    value={form.sortOrder}
                    onChange={e => setForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  id="service-active"
                  checked={form.active}
                  onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                <label htmlFor="service-active" style={{ fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
                  Active (visible on kiosk and waiting room)
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
              <button
                onClick={closeModal}
                style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={saveService}
                disabled={saving || !form.name.trim()}
                style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: saving || !form.name.trim() ? '#94a3b8' : '#0d9488', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving || !form.name.trim() ? 'not-allowed' : 'pointer' }}>
                {saving ? '⏳ Saving…' : editingService ? '💾 Update Service' : '➕ Add Service'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

type CurrentUser = { id: string; role: string; email: string; name: string };
type SettingsTab = 'dashboard' | 'users' | 'audit' | 'services' | 'doctors' | 'nurses' | 'videos';

// ── Doctors Tab ──────────────────────────────────────────────────────────────

interface Doctor {
  id: string;
  name: string;
  title?: string;
  specialty?: string;
  phone?: string;
  email?: string;
  clinicLocation?: string;
  active: boolean;
}

const DOCTOR_TITLE_OPTIONS = ['MD', 'DO', 'NP', 'PA'];
const EMPTY_DOCTOR_FORM = { name: '', title: '', specialty: '', email: '', phone: '', clinicLocation: '' };

function DoctorsTab() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editDoctor, setEditDoctor] = useState<Doctor | null>(null);
  const [form, setForm] = useState({ ...EMPTY_DOCTOR_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  async function loadDoctors() {
    setLoading(true); setLoadError(null);
    try {
      const res = await fetch('/api/doctors?all=1');
      if (!res.ok) throw new Error(res.status === 401 ? 'session_expired' : `HTTP ${res.status}`);
      const data = await res.json();
      setDoctors(Array.isArray(data) ? data : (data.doctors ?? []));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load';
      setLoadError(msg === 'session_expired' ? 'Session expired — please refresh and log in again.' : `Failed to load doctors: ${msg}`);
    } finally { setLoading(false); }
  }

  useEffect(() => { loadDoctors(); }, []);

  function openAdd() { setEditDoctor(null); setForm({ ...EMPTY_DOCTOR_FORM }); setFormError(''); setShowModal(true); }
  function openEdit(doc: Doctor) {
    setEditDoctor(doc);
    setForm({ name: doc.name, title: doc.title ?? '', specialty: doc.specialty ?? '', email: doc.email ?? '', phone: doc.phone ?? '', clinicLocation: doc.clinicLocation ?? '' });
    setFormError(''); setShowModal(true);
  }
  function closeModal() { setShowModal(false); setEditDoctor(null); setFormError(''); }
  function setField(field: string, value: string) { setForm(prev => ({ ...prev, [field]: value })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setFormError('');
    if (!form.name.trim()) { setFormError('Name is required'); return; }
    setSaving(true);
    try {
      const url = editDoctor ? `/api/doctors/${editDoctor.id}` : '/api/doctors';
      const res = await fetch(url, { method: editDoctor ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: form.name.trim(), title: form.title || undefined, specialty: form.specialty || undefined, email: form.email || undefined, phone: form.phone || undefined, clinicLocation: form.clinicLocation || undefined }) });
      if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.error ?? `Request failed: ${res.status}`); }
      closeModal(); await loadDoctors();
    } catch (e: unknown) { setFormError(e instanceof Error ? e.message : 'Failed to save'); }
    finally { setSaving(false); }
  }

  async function toggleActive(doc: Doctor) {
    await fetch(`/api/doctors/${doc.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !doc.active }) }).catch(() => {});
    loadDoctors();
  }

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>👨‍⚕️ Doctors</div>
        <button className="btn" onClick={openAdd}>+ Add Doctor</button>
      </div>
      {loadError && <div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:8,padding:'12px 16px',marginBottom:16,color:'#b91c1c',fontSize:13}}>🔐 {loadError} <button onClick={() => { setLoadError(null); loadDoctors(); }} style={{marginLeft:12,padding:'3px 10px',background:'#b91c1c',color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontSize:12}}>Retry</button></div>}
      {loading ? (
        <div className="loading-center"><div className="spinner" /><span>Loading doctors…</span></div>
      ) : doctors.length === 0 ? (
        <div className="empty-state"><div className="empty-state-icon">🩺</div><div className="empty-state-title">No doctors yet</div><div style={{ marginTop: 16 }}><button className="btn" onClick={openAdd}>Add First Doctor</button></div></div>
      ) : (
        <div className="table-container">
          <table><thead><tr><th>Name</th><th>Title</th><th>Specialty</th><th>Phone</th><th>Email</th><th>Location</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{doctors.map(doc => (
            <tr key={doc.id}>
              <td><div style={{ fontWeight: 600 }}>{doc.name}</div></td>
              <td>{doc.title ?? '—'}</td><td>{doc.specialty ?? '—'}</td><td>{doc.phone ?? '—'}</td><td>{doc.email ?? '—'}</td><td>{doc.clinicLocation ?? '—'}</td>
              <td><span className={`badge ${doc.active ? 'badge-green' : 'badge-gray'}`}>{doc.active ? 'Active' : 'Inactive'}</span></td>
              <td><div className="flex gap-2"><button className="btn btn-sm btn-secondary" onClick={() => openEdit(doc)}>Edit</button><button className={`btn btn-sm ${doc.active ? 'btn-danger' : 'btn-secondary'}`} onClick={() => toggleActive(doc)}>{doc.active ? 'Deactivate' : 'Activate'}</button></div></td>
            </tr>
          ))}</tbody></table>
        </div>
      )}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2 className="modal-title">{editDoctor ? 'Edit Doctor' : 'Add Doctor'}</h2><button className="modal-close" onClick={closeModal}>✕</button></div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {formError && <div className="alert alert-error" style={{ marginBottom: 16 }}>⚠️ {formError}</div>}
                <div className="form-group"><label className="form-label">Name <span className="required">*</span></label><input type="text" className="form-input" placeholder="Dr. Jane Smith" value={form.name} onChange={e => setField('name', e.target.value)} required /></div>
                <div className="form-row form-row-2">
                  <div className="form-group"><label className="form-label">Title</label><select className="form-input" value={form.title} onChange={e => setField('title', e.target.value)}><option value="">Select…</option>{DOCTOR_TITLE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                  <div className="form-group"><label className="form-label">Specialty</label><input type="text" className="form-input" placeholder="e.g. Allergist" value={form.specialty} onChange={e => setField('specialty', e.target.value)} /></div>
                </div>
                <div className="form-row form-row-2">
                  <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-input" placeholder="doctor@clinic.com" value={form.email} onChange={e => setField('email', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Phone</label><input type="tel" className="form-input" placeholder="(555) 555-0100" value={form.phone} onChange={e => setField('phone', e.target.value)} /></div>
                </div>
                <div className="form-group"><label className="form-label">Clinic Location</label><input type="text" className="form-input" placeholder="e.g. Main Street Clinic" value={form.clinicLocation} onChange={e => setField('clinicLocation', e.target.value)} /></div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button><button type="submit" className="btn" disabled={saving}>{saving ? 'Saving…' : editDoctor ? 'Save Changes' : 'Add Doctor'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Nurses Tab ───────────────────────────────────────────────────────────────

interface Nurse {
  id: string;
  name: string;
  title?: string;
  phone?: string;
  email?: string;
  clinicLocation?: string;
  active: boolean;
}

const NURSE_TITLE_OPTIONS = ['RN', 'LPN', 'CMA', 'MA'];
const EMPTY_NURSE_FORM = { name: '', title: '', email: '', phone: '', clinicLocation: '' };

function NursesTab() {
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editNurse, setEditNurse] = useState<Nurse | null>(null);
  const [form, setForm] = useState({ ...EMPTY_NURSE_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  async function loadNurses() {
    setLoading(true); setLoadError(null);
    try {
      const res = await fetch('/api/nurses?all=1');
      if (!res.ok) throw new Error(res.status === 401 ? 'session_expired' : `HTTP ${res.status}`);
      const data = await res.json();
      setNurses(Array.isArray(data) ? data : (data.nurses ?? []));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load';
      setLoadError(msg === 'session_expired' ? 'Session expired — please refresh and log in again.' : `Failed to load nurses: ${msg}`);
    } finally { setLoading(false); }
  }

  useEffect(() => { loadNurses(); }, []);

  function openAdd() { setEditNurse(null); setForm({ ...EMPTY_NURSE_FORM }); setFormError(''); setShowModal(true); }
  function openEdit(nurse: Nurse) {
    setEditNurse(nurse);
    setForm({ name: nurse.name, title: nurse.title ?? '', email: nurse.email ?? '', phone: nurse.phone ?? '', clinicLocation: nurse.clinicLocation ?? '' });
    setFormError(''); setShowModal(true);
  }
  function closeModal() { setShowModal(false); setEditNurse(null); setFormError(''); }
  function setField(field: string, value: string) { setForm(prev => ({ ...prev, [field]: value })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setFormError('');
    if (!form.name.trim()) { setFormError('Name is required'); return; }
    setSaving(true);
    try {
      const url = editNurse ? `/api/nurses/${editNurse.id}` : '/api/nurses';
      const res = await fetch(url, { method: editNurse ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: form.name.trim(), title: form.title || undefined, email: form.email || undefined, phone: form.phone || undefined, clinicLocation: form.clinicLocation || undefined }) });
      if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.error ?? `Request failed: ${res.status}`); }
      closeModal(); await loadNurses();
    } catch (e: unknown) { setFormError(e instanceof Error ? e.message : 'Failed to save'); }
    finally { setSaving(false); }
  }

  async function toggleActive(nurse: Nurse) {
    await fetch(`/api/nurses/${nurse.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !nurse.active }) }).catch(() => {});
    loadNurses();
  }

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>👩‍⚕️ Nurses</div>
        <button className="btn" onClick={openAdd}>+ Add Nurse</button>
      </div>
      {loadError && <div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:8,padding:'12px 16px',marginBottom:16,color:'#b91c1c',fontSize:13}}>🔐 {loadError} <button onClick={() => { setLoadError(null); loadNurses(); }} style={{marginLeft:12,padding:'3px 10px',background:'#b91c1c',color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontSize:12}}>Retry</button></div>}
      {loading ? (
        <div className="loading-center"><div className="spinner" /><span>Loading nurses…</span></div>
      ) : nurses.length === 0 ? (
        <div className="empty-state"><div className="empty-state-icon">👩‍⚕️</div><div className="empty-state-title">No nurses yet</div><div style={{ marginTop: 16 }}><button className="btn" onClick={openAdd}>Add First Nurse</button></div></div>
      ) : (
        <div className="table-container">
          <table><thead><tr><th>Name</th><th>Title</th><th>Phone</th><th>Email</th><th>Location</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{nurses.map(nurse => (
            <tr key={nurse.id}>
              <td><div style={{ fontWeight: 600 }}>{nurse.name}</div></td>
              <td>{nurse.title ?? '—'}</td><td>{nurse.phone ?? '—'}</td><td>{nurse.email ?? '—'}</td><td>{nurse.clinicLocation ?? '—'}</td>
              <td><span className={`badge ${nurse.active ? 'badge-green' : 'badge-gray'}`}>{nurse.active ? 'Active' : 'Inactive'}</span></td>
              <td><div className="flex gap-2"><button className="btn btn-sm btn-secondary" onClick={() => openEdit(nurse)}>Edit</button><button className={`btn btn-sm ${nurse.active ? 'btn-danger' : 'btn-secondary'}`} onClick={() => toggleActive(nurse)}>{nurse.active ? 'Deactivate' : 'Activate'}</button></div></td>
            </tr>
          ))}</tbody></table>
        </div>
      )}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2 className="modal-title">{editNurse ? 'Edit Nurse' : 'Add Nurse'}</h2><button className="modal-close" onClick={closeModal}>✕</button></div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {formError && <div className="alert alert-error" style={{ marginBottom: 16 }}>⚠️ {formError}</div>}
                <div className="form-group"><label className="form-label">Name <span className="required">*</span></label><input type="text" className="form-input" placeholder="Full name" value={form.name} onChange={e => setField('name', e.target.value)} required /></div>
                <div className="form-group"><label className="form-label">Title</label><select className="form-input" value={form.title} onChange={e => setField('title', e.target.value)}><option value="">Select…</option>{NURSE_TITLE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                <div className="form-row form-row-2">
                  <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-input" placeholder="nurse@clinic.com" value={form.email} onChange={e => setField('email', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Phone</label><input type="tel" className="form-input" placeholder="(555) 555-0100" value={form.phone} onChange={e => setField('phone', e.target.value)} /></div>
                </div>
                <div className="form-group"><label className="form-label">Clinic Location</label><input type="text" className="form-input" placeholder="e.g. Main Street Clinic" value={form.clinicLocation} onChange={e => setField('clinicLocation', e.target.value)} /></div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button><button type="submit" className="btn" disabled={saving}>{saving ? 'Saving…' : editNurse ? 'Save Changes' : 'Add Nurse'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Videos Tab ───────────────────────────────────────────────────────────────

interface VideoItem {
  id: string;
  title: string;
  url?: string;
  description?: string;
  category?: string;
  duration?: string;
  active?: boolean;
  createdAt?: string;
  order?: number;
}

const EMPTY_VIDEO_FORM = { title: '', url: '', description: '', category: '', duration: '' };

function VideosTab() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingVideo, setEditingVideo] = useState<VideoItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [form, setVForm] = useState({ ...EMPTY_VIDEO_FORM });

  function setVField(field: string, value: string) { setVForm(prev => ({ ...prev, [field]: value })); }

  function loadVideos() {
    setLoading(true);
    fetch('/api/videos').then(r => r.ok ? r.json() : []).then(d => setVideos(Array.isArray(d) ? d : (d.videos ?? []))).catch(e => setError(e.message)).finally(() => setLoading(false));
  }

  useEffect(() => { loadVideos(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required'); return; }
    setSaving(true); setError('');
    try {
      const r = await fetch('/api/videos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: form.title, url: form.url || undefined, description: form.description || undefined, category: form.category || undefined, duration: form.duration || undefined }) });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed to add video');
      setSuccess('Video added successfully!'); setVForm({ ...EMPTY_VIDEO_FORM }); setShowForm(false); loadVideos();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to add video'); }
    finally { setSaving(false); }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingVideo) return;
    setSaving(true); setError('');
    try {
      const r = await fetch(`/api/videos/${editingVideo.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: form.title, url: form.url || null, description: form.description || null, category: form.category || null, duration: form.duration || null }) });
      if (!r.ok) throw new Error('Failed to update video');
      setSuccess('Video updated!'); setEditingVideo(null); loadVideos();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to update'); }
    finally { setSaving(false); }
  }

  function openEdit(v: VideoItem) {
    setEditingVideo(v);
    setVForm({ title: v.title, url: v.url ?? '', description: v.description ?? '', category: v.category ?? '', duration: v.duration ?? '' });
  }

  const categories = [...new Set(videos.map(v => v.category).filter(Boolean))] as string[];

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>🎬 Video Library</div>
        <button className="btn" onClick={() => setShowForm(v => !v)}>{showForm ? '✕ Cancel' : '+ Add Video'}</button>
      </div>
      {error && <div className="alert alert-error">⚠️ {error} <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c', fontSize: 16 }}>✕</button></div>}
      {success && <div className="alert alert-success">✓ {success} <button onClick={() => setSuccess('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#166534', fontSize: 16 }}>✕</button></div>}
      {showForm && (
        <div className="card mb-6">
          <div className="card-title">Add New Video</div>
          <form onSubmit={handleAdd}>
            <div className="form-row form-row-2">
              <div className="form-group"><label className="form-label">Title <span className="required">*</span></label><input type="text" className="form-input" placeholder="Video title" value={form.title} onChange={e => setVField('title', e.target.value)} required /></div>
              <div className="form-group"><label className="form-label">Category</label><input type="text" className="form-input" placeholder="e.g. Allergy Education" value={form.category} onChange={e => setVField('category', e.target.value)} /></div>
            </div>
            <div className="form-row form-row-2">
              <div className="form-group"><label className="form-label">Video URL</label><input type="url" className="form-input" placeholder="https://..." value={form.url} onChange={e => setVField('url', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Duration</label><input type="text" className="form-input" placeholder="e.g. 5:30" value={form.duration} onChange={e => setVField('duration', e.target.value)} /></div>
            </div>
            <div className="form-group"><label className="form-label">Description</label><textarea className="form-input" placeholder="Brief description…" rows={3} value={form.description} onChange={e => setVField('description', e.target.value)} style={{ resize: 'vertical' }} /></div>
            <div className="flex gap-3" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary btn" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn" disabled={saving}>{saving ? 'Adding…' : '+ Add Video'}</button>
            </div>
          </form>
        </div>
      )}
      {loading ? (
        <div className="loading-center"><div className="spinner" /><span>Loading videos…</span></div>
      ) : videos.length === 0 ? (
        <div className="empty-state"><div className="empty-state-icon">🎬</div><div className="empty-state-title">No videos yet</div><div>Add instructional videos for patients to watch before testing.</div><div style={{ marginTop: 16 }}><button className="btn" onClick={() => setShowForm(true)}>Add First Video</button></div></div>
      ) : (
        <>
          {(categories.length > 0 ? categories : [undefined]).map(cat => {
            const catVideos = cat ? videos.filter(v => v.category === cat) : videos.filter(v => !v.category);
            if (catVideos.length === 0) return null;
            return (
              <div key={cat ?? 'uncategorized'} className="mb-6">
                {categories.length > 0 && <div style={{ fontSize: 13, fontWeight: 700, color: '#0055A5', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid #e2e8f0' }}>{cat ?? 'Uncategorized'}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                  {catVideos.map(v => (
                    <div key={v.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                      <div style={{ background: 'linear-gradient(135deg, #0055A5, #2EC4B6)', height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>🎬</div>
                      <div style={{ padding: 16 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6, color: '#1a2233' }}>{v.title}</div>
                        {v.description && <div style={{ fontSize: 13, color: '#64748b', marginBottom: 10, lineHeight: 1.5 }}>{v.description}</div>}
                        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                          {v.category && <span className="badge badge-blue">{v.category}</span>}
                          {v.duration && <span className="badge badge-gray">⏱ {v.duration}</span>}
                        </div>
                        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                          {v.url ? <a href={v.url} target="_blank" rel="noopener noreferrer" style={{ padding: '6px 14px', borderRadius: 8, background: '#0d9488', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>▶ Watch Video</a> : <span style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>No URL set</span>}
                          <button onClick={() => openEdit(v)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>✏️ Edit</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}
      {editingVideo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>✏️ Edit Video</h2>
              <button onClick={() => setEditingVideo(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>
            <form onSubmit={handleEdit}>
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div><label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Title *</label><input className="form-input" value={form.title} onChange={e => setVField('title', e.target.value)} required /></div>
                <div><label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Video URL</label><input className="form-input" type="url" placeholder="https://www.youtube.com/watch?v=..." value={form.url} onChange={e => setVField('url', e.target.value)} /><div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>YouTube, Vimeo, or any direct video URL</div></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div><label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Category</label><input className="form-input" placeholder="what, how, why..." value={form.category} onChange={e => setVField('category', e.target.value)} /></div>
                  <div><label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Duration</label><input className="form-input" placeholder="e.g. 5:30" value={form.duration} onChange={e => setVField('duration', e.target.value)} /></div>
                </div>
                <div><label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Description</label><textarea className="form-input" rows={3} value={form.description} onChange={e => setVField('description', e.target.value)} style={{ resize: 'vertical' }} /></div>
              </div>
              <div style={{ padding: '14px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setEditingVideo(null)} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#374151', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#0d9488', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>{saving ? '⏳ Saving…' : '💾 Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const [editMode, setEditMode] = useState(false);
  const [layouts, setLayouts] = useState<ResponsiveLayouts>(DEFAULT_SETTINGS_LAYOUTS);
  const [activeTab, setActiveTab] = useState<SettingsTab>('dashboard');
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    setLayouts(loadSettingsLayouts());
    // Fetch current user for role-based UI
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(u => { if (u) setCurrentUser(u); })
      .catch(() => {});
  }, []);

  function handleLayoutChange(_layout: Layout, allLayouts: ResponsiveLayouts): void {
    setLayouts(allLayouts);
    try { localStorage.setItem(SETTINGS_LAYOUT_KEY, JSON.stringify(allLayouts)); } catch {}
  }

  const tileStyle = (overrideColor?: string): React.CSSProperties => ({
    height: '100%',
    overflow: 'auto',
    border: editMode ? `2px dashed ${overrideColor ?? '#f59e0b'}` : '1px solid #e2e8f0',
    borderRadius: 12,
    background: '#fff',
    padding: 20,
    boxSizing: 'border-box',
  });

  const isAdmin = currentUser?.role === 'admin';

  const TAB_STYLE = (active: boolean): React.CSSProperties => ({
    padding: '8px 18px',
    borderRadius: '8px 8px 0 0',
    border: '1px solid #e2e8f0',
    borderBottom: active ? '1px solid #fff' : '1px solid #e2e8f0',
    background: active ? '#fff' : '#f8fafc',
    color: active ? '#1e293b' : '#64748b',
    fontWeight: active ? 700 : 500,
    fontSize: 13,
    cursor: 'pointer',
    marginBottom: -1,
    transition: 'all 0.15s',
  });

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Settings</div>
          <div className="page-subtitle">System configuration and administration</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {activeTab === 'dashboard' && (
            <button onClick={() => setEditMode(v => !v)}
              style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${editMode ? '#f59e0b' : '#e2e8f0'}`, background: editMode ? '#fefce8' : '#fff', color: editMode ? '#b45309' : '#374151', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {editMode ? '✅ Done' : '⊞ Edit Layout'}
            </button>
          )}
        </div>
      </div>

      <div className="page-body">
        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e2e8f0', marginBottom: 20 }}>
          <button style={TAB_STYLE(activeTab === 'dashboard')} onClick={() => setActiveTab('dashboard')}>
            ⚙️ Dashboard
          </button>
          {isAdmin && (
            <button style={TAB_STYLE(activeTab === 'users')} onClick={() => setActiveTab('users')}>
              👥 Users
            </button>
          )}
          <button style={TAB_STYLE(activeTab === 'audit')} onClick={() => setActiveTab('audit')}>
            📋 Audit Log
          </button>
          <button style={TAB_STYLE(activeTab === 'services')} onClick={() => setActiveTab('services')}>
            🎨 Services
          </button>
          <button style={TAB_STYLE(activeTab === 'doctors')} onClick={() => setActiveTab('doctors')}>
            👨‍⚕️ Doctors
          </button>
          <button style={TAB_STYLE(activeTab === 'nurses')} onClick={() => setActiveTab('nurses')}>
            👩‍⚕️ Nurses
          </button>
          <button style={TAB_STYLE(activeTab === 'videos')} onClick={() => setActiveTab('videos')}>
            🎬 Videos
          </button>
        </div>

        {/* Users Tab */}
        {activeTab === 'users' && currentUser && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24 }}>
            <UsersManagement currentUser={currentUser} />
          </div>
        )}

        {/* Audit Log Tab */}
        {activeTab === 'audit' && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24 }}>
            <AuditLogContent />
          </div>
        )}

        {/* Services Tab */}
        {activeTab === 'services' && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24 }}>
            <ServicesManagement />
          </div>
        )}

        {/* Doctors Tab */}
        {activeTab === 'doctors' && <DoctorsTab />}

        {/* Nurses Tab */}
        {activeTab === 'nurses' && <NursesTab />}

        {/* Videos Tab */}
        {activeTab === 'videos' && <VideosTab />}

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <>
        {editMode && (
          <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 16px', marginBottom: 8, fontSize: 13, color: '#92400e', fontWeight: 600 }}>
            ⊞ Drag tiles to move · Drag bottom-right corner to resize · Click <strong>&quot;✅ Done&quot;</strong> to save
          </div>
        )}

        <DashboardGrid
          layouts={layouts}
          editMode={editMode}
          onLayoutChange={handleLayoutChange}
          tiles={[
            {
              id: 'system-status',
              content: (
                <div style={tileStyle()}>
                  <div className="card-title">System Status</div>
                  <div className="flex flex-col gap-3">
                    {[
                      { label: 'API Server', status: 'Operational', badge: 'badge-teal' },
                      { label: 'Database', status: 'Operational', badge: 'badge-teal' },
                      { label: 'Allergen Data', status: 'Loaded', badge: 'badge-green' },
                      { label: 'Video Service', status: 'Operational', badge: 'badge-teal' },
                    ].map(s => (
                      <div key={s.label} className="flex justify-between items-center" style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ fontSize: 14 }}>{s.label}</span>
                        <span className={`badge ${s.badge}`}>{s.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ),
            },
            {
              id: 'app-version',
              content: (
                <div style={tileStyle()}>
                  <div className="card-title">Application Version</div>
                  <div className="flex flex-col gap-2">
                    {[
                      { label: 'Version', value: '3.1.0' },
                      { label: 'Environment', value: 'Production' },
                      { label: 'Last Updated', value: new Date().toLocaleDateString() },
                    ].map(r => (
                      <div key={r.label} className="flex justify-between items-center" style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: 14 }}>
                        <span style={{ color: '#64748b', fontWeight: 600 }}>{r.label}</span>
                        <span>{r.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ),
            },
            {
              id: 'quick-links',
              content: (
                <div style={tileStyle()}>
                  <div className="card-title">Quick Links</div>
                  <div className="flex flex-col gap-2">
                    <Link href="/patients/new" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>👤 Register New Patient</Link>
                    <Link href="/testing" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>🧪 Start Testing Session</Link>
                    <Link href="/videos" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>🎬 Manage Videos</Link>
                  </div>
                </div>
              ),
            },
          ]}
        />
          </>
        )}
      </div>
    </>
  );
}
