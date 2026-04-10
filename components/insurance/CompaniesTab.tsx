'use client';

import { useState, useCallback, useEffect } from 'react';
import { InsuranceCompany, EMPTY_COMPANY } from './types';
import { InsuranceBadge } from './shared';
import { apiFetch } from '@/lib/api-fetch';

export function CompaniesTab() {
  const [companies, setCompanies] = useState<InsuranceCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCo, setEditingCo] = useState<InsuranceCompany | null>(null);
  const [form, setForm] = useState<Partial<InsuranceCompany>>(EMPTY_COMPANY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/insurance-companies?all=true').then(r => r.json())
      .then(d => setCompanies(d.companies ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = companies.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.type.toLowerCase().includes(search.toLowerCase()) ||
    (c.payerId ?? '').toLowerCase().includes(search.toLowerCase())
  );

  function openAdd() { setEditingCo(null); setForm({ ...EMPTY_COMPANY }); setModalOpen(true); }
  function openEdit(co: InsuranceCompany) { setEditingCo(co); setForm({ ...co }); setModalOpen(true); }

  async function handleSave() {
    if (!form.name) return;
    setSaving(true);
    try {
      const url = editingCo ? `/api/insurance-companies/${editingCo.id}` : '/api/insurance-companies';
      const method = editingCo ? 'PUT' : 'POST';
      await apiFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      setModalOpen(false);
      load();
    } catch { /* ignore */ } finally { setSaving(false); }
  }

  async function handleDelete(co: InsuranceCompany) {
    if (!confirm(`Deactivate "${co.name}"?`)) return;
    await apiFetch(`/api/insurance-companies/${co.id}`, { method: 'DELETE' });
    load();
  }

  async function handleToggle(co: InsuranceCompany) {
    await apiFetch(`/api/insurance-companies/${co.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !co.active }),
    });
    load();
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          placeholder="🔍 Search companies…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: '1 1 220px', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }}
        />
        <button onClick={openAdd} className="btn">+ Add Insurer</button>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  {['Company Name', 'Type', 'Payer ID', 'Phone', 'Fax', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#374151', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>No companies found</td></tr>
                ) : filtered.map((co, i) => (
                  <tr key={co.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1e293b' }}>
                      {co.name}
                      {co.notes && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, fontWeight: 400 }}>{co.notes.slice(0, 50)}</div>}
                    </td>
                    <td style={{ padding: '10px 14px' }}><InsuranceBadge type={co.type} /></td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: '#374151' }}>{co.payerId ?? '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#374151' }}>{co.phone ?? '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#374151' }}>{co.fax ?? '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <input type="checkbox" checked={co.active} onChange={() => handleToggle(co)} />
                        <span style={{ fontSize: 11, color: co.active ? '#15803d' : '#9ca3af' }}>{co.active ? 'Active' : 'Inactive'}</span>
                      </label>
                    </td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                      <button onClick={() => openEdit(co)} style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, marginRight: 6 }}>✏️ Edit</button>
                      <button onClick={() => handleDelete(co)} style={{ background: 'none', border: '1px solid #fca5a5', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, color: '#dc2626' }}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '10px 16px', borderTop: '1px solid #f1f5f9', fontSize: 12, color: '#6b7280' }}>
            {filtered.length} insurer{filtered.length !== 1 ? 's' : ''} · {companies.filter(c => c.active).length} active
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{editingCo ? '✏️ Edit Insurer' : '+ Add Insurance Company'}</h2>
              <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#6b7280' }}>×</button>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label">Company Name *</label>
                  <input className="form-input" value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. BlueCross BlueShield" />
                </div>
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select className="form-input" value={form.type ?? 'commercial'} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    {['medicare','medicaid','bcbs','commercial','tricare','aetna','united','cigna'].map(t => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label">Payer ID</label>
                  <input className="form-input" value={form.payerId ?? ''} onChange={e => setForm(f => ({ ...f, payerId: e.target.value }))} placeholder="e.g. 00570" />
                </div>
                <div className="form-group">
                  <label className="form-label">Plan Types</label>
                  <input className="form-input" value={form.planTypes ?? ''} onChange={e => setForm(f => ({ ...f, planTypes: e.target.value }))} placeholder="HMO, PPO, EPO…" />
                </div>
              </div>
              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-input" value={form.phone ?? ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Provider services #" />
                </div>
                <div className="form-group">
                  <label className="form-label">Fax</label>
                  <input className="form-input" value={form.fax ?? ''} onChange={e => setForm(f => ({ ...f, fax: e.target.value }))} placeholder="Claims fax #" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Website</label>
                <input className="form-input" value={form.website ?? ''} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://providerportal.example.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-input" rows={2} value={form.notes ?? ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any special billing notes…" />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={form.active ?? true} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
                Active
              </label>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalOpen(false)} className="btn btn-secondary">Cancel</button>
              <button onClick={handleSave} className="btn" disabled={saving || !form.name}>
                {saving ? 'Saving…' : editingCo ? 'Save Changes' : 'Add Company'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
