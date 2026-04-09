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
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>Performed By</th>
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
                  <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                    {log.performedBy ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#0d9488', color: '#fff', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {log.performedBy.charAt(0).toUpperCase()}
                        </span>
                        <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>{log.performedBy}</span>
                      </span>
                    ) : <span style={{ color: '#94a3b8', fontSize: 12 }}>System</span>}
                  </td>
                  <td style={{ padding: '8px 12px', color: '#475569' }}>{log.entity ?? '—'}</td>
                  <td style={{ padding: '8px 12px', color: '#334155', maxWidth: 320 }}>
                    <span title={log.details ?? undefined} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.details ?? '—'}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    {log.patient ? (
                      <Link href={`/patients/${log.patient.id}`} style={{ color: '#2563eb', textDecoration: 'underline', fontSize: 12 }}>
                        {log.patient.name || log.patient.patientId}
                      </Link>
                    ) : log.patientId ? (
                      <span style={{ color: '#64748b', fontSize: 12 }}>{log.patientId}</span>
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
type SettingsTab = 'dashboard' | 'users' | 'audit' | 'services';

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
