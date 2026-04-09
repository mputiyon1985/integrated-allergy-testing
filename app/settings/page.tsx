'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { Layout, LayoutItem, ResponsiveLayouts } from 'react-grid-layout';

const DashboardGrid = dynamic(() => import('@/components/DashboardGrid'), { ssr: false });

const SETTINGS_LAYOUT_KEY = 'iat-settings-layout-v1';

// 17 sections, each w:6 in a 2-column layout (12-col grid)
const SECTION_IDS = [
  'clinic-info',
  'system-status',
  'app-version',
  'quick-links',
  'icd10-codes',
  'cpt-codes',
  'audit-log',
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
  const fullWidth: SectionId[] = ['icd10-codes', 'cpt-codes', 'audit-log'];
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
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => {
    fetch('/api/audit?limit=200')
      .then(r => r.json())
      .then(d => {
        setLogs(Array.isArray(d) ? d : (d.logs ?? d.entries ?? []));
        setLoading(false);
      })
      .catch(() => setLoading(false));
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
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ code: '', description: '', category: '' });
  const [saving, setSaving] = useState(false);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editingRowData, setEditingRowData] = useState({ description: '', category: '' });

  function load() {
    fetch('/api/icd10-codes?all=true')
      .then(r => r.json())
      .then(d => { setCodes(d.codes ?? (Array.isArray(d) ? d : [])); setLoading(false); })
      .catch(() => setLoading(false));
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
  const [codes, setCodes] = useState<{ id: string; code: string; description: string; category?: string; defaultFee?: number | null; nonFacilityFee?: number | null; facilityFee?: number | null; active: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ code: '', description: '', category: '' });
  const [saving, setSaving] = useState(false);
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null);
  const [editingFeeVal, setEditingFeeVal] = useState('');
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editingRowData, setEditingRowData] = useState({ description: '', category: '' });

  function load() {
    fetch('/api/cpt-codes?all=true')
      .then(r => r.json())
      .then(d => { setCodes(d.codes ?? (Array.isArray(d) ? d : [])); setLoading(false); })
      .catch(() => setLoading(false));
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
                {['Code', 'Description', 'Category', '2026 Medicare NF', '2026 Medicare FAC', 'Actions'].map(h => (
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

export default function SettingsPage() {
  const [editMode, setEditMode] = useState(false);
  const [layouts, setLayouts] = useState<ResponsiveLayouts>(DEFAULT_SETTINGS_LAYOUTS);

  useEffect(() => {
    setLayouts(loadSettingsLayouts());
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

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Settings</div>
          <div className="page-subtitle">System configuration and administration</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setEditMode(v => !v)}
            style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${editMode ? '#f59e0b' : '#e2e8f0'}`, background: editMode ? '#fefce8' : '#fff', color: editMode ? '#b45309' : '#374151', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {editMode ? '✅ Done' : '⊞ Edit Layout'}
          </button>
        </div>
      </div>

      <div className="page-body">
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
              id: 'clinic-info',
              content: (
                <div style={tileStyle()}>
                  <div className="card-title">Clinic Information</div>
                  <div className="flex flex-col gap-3">
                    <div className="form-group">
                      <label className="form-label">Clinic Name</label>
                      <input type="text" className="form-input" defaultValue="Integrated Allergy Testing" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Address</label>
                      <input type="text" className="form-input" placeholder="123 Medical Drive" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Phone</label>
                      <input type="tel" className="form-input" placeholder="(555) 555-0100" />
                    </div>
                    <button className="btn" style={{ alignSelf: 'flex-start' }}>Save Changes</button>
                  </div>
                </div>
              ),
            },
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
            {
              id: 'icd10-codes',
              content: (
                <div style={tileStyle('#0d9488')}>
                  <Icd10CodesContent />
                </div>
              ),
            },
            {
              id: 'cpt-codes',
              content: (
                <div style={tileStyle('#7c3aed')}>
                  <CptCodesContent />
                </div>
              ),
            },
            {
              id: 'audit-log',
              content: (
                <div style={tileStyle('#2563eb')}>
                  <AuditLogContent />
                </div>
              ),
            },
          ]}
        />
      </div>
    </>
  );
}
