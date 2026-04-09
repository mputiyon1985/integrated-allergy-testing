'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Practice {
  id: string;
  name: string;
  shortName: string | null;
  npi: string | null;
  taxId: string | null;
  phone: string | null;
  fax: string | null;
  email: string | null;
  website: string | null;
  active: boolean;
}

interface Location {
  id: string;
  name: string;
  key: string;
  city: string;
  state: string;
  active: boolean;
  practiceId?: string | null;
}

const EMPTY_FORM = {
  name: '',
  shortName: '',
  npi: '',
  taxId: '',
  phone: '',
  fax: '',
  email: '',
  website: '',
};

type FormData = typeof EMPTY_FORM;

export default function PracticesPage() {
  const [practices, setPractices] = useState<Practice[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editPractice, setEditPractice] = useState<Practice | null>(null);
  const [form, setForm] = useState<FormData>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  async function loadData() {
    setLoading(true);
    setLoadError(null);
    try {
      const [practicesRes, locationsRes] = await Promise.all([
        fetch('/api/practices'),
        fetch('/api/locations?all=1'),
      ]);

      if (!practicesRes.ok) throw new Error(practicesRes.status === 401 ? 'session_expired' : `HTTP ${practicesRes.status}`);
      if (!locationsRes.ok) throw new Error(locationsRes.status === 401 ? 'session_expired' : `HTTP ${locationsRes.status}`);

      const practicesData = await practicesRes.json();
      const locationsData = await locationsRes.json();

      setPractices(practicesData?.practices ?? (Array.isArray(practicesData) ? practicesData : []));
      setLocations(Array.isArray(locationsData) ? locationsData : []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load';
      if (msg === 'session_expired') setLoadError('Session expired — please refresh and log in again.');
      else setLoadError(`Failed to load practices: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadData(); }, []);

  function openAdd() {
    setEditPractice(null);
    setForm({ ...EMPTY_FORM });
    setFormError('');
    setShowModal(true);
  }

  function openEdit(p: Practice) {
    setEditPractice(p);
    setForm({
      name: p.name ?? '',
      shortName: p.shortName ?? '',
      npi: p.npi ?? '',
      taxId: p.taxId ?? '',
      phone: p.phone ?? '',
      fax: p.fax ?? '',
      email: p.email ?? '',
      website: p.website ?? '',
    });
    setFormError('');
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditPractice(null);
    setFormError('');
  }

  function setField(field: keyof FormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim()) { setFormError('Practice name is required'); return; }

    setSaving(true);
    try {
      const url = editPractice ? `/api/practices/${editPractice.id}` : '/api/practices';
      const method = editPractice ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          shortName: form.shortName.trim() || null,
          npi: form.npi.trim() || null,
          taxId: form.taxId.trim() || null,
          phone: form.phone.trim() || null,
          fax: form.fax.trim() || null,
          email: form.email.trim() || null,
          website: form.website.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? `Request failed: ${res.status}`);
      }
      closeModal();
      await loadData();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p: Practice) {
    try {
      const res = await fetch(`/api/practices/${p.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !p.active }),
      });
      if (!res.ok) throw new Error('Failed to update');
      await loadData();
    } catch {
      alert('Failed to update practice status');
    }
  }

  const locationsForPractice = (practiceId: string) =>
    locations.filter(l => l.practiceId === practiceId);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Practices</div>
          <div className="page-subtitle">
            {loading ? 'Loading…' : `${practices.length} practice${practices.length !== 1 ? 's' : ''}`}
          </div>
        </div>
        <button className="btn" onClick={openAdd}>+ Add Practice</button>
      </div>

      <div className="page-body">
        {loadError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#b91c1c', fontSize: 13 }}>
            🔐 {loadError}
            <button
              onClick={() => { setLoadError(null); void loadData(); }}
              style={{ marginLeft: 12, padding: '3px 10px', background: '#b91c1c', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="loading-center"><div className="spinner" /><span>Loading practices…</span></div>
        ) : practices.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🏥</div>
            <div className="empty-state-title">No practices yet</div>
            <div style={{ marginTop: 16 }}>
              <button className="btn" onClick={openAdd}>Add First Practice</button>
            </div>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Practice Name</th>
                  <th>Short Name</th>
                  <th>NPI</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Locations</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {practices.map((p) => {
                  const practiceLocations = locationsForPractice(p.id);
                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{p.name}</div>
                        {p.taxId && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>EIN: {p.taxId}</div>}
                      </td>
                      <td>{p.shortName ?? '—'}</td>
                      <td>
                        {p.npi ? (
                          <code style={{ fontSize: 12, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>{p.npi}</code>
                        ) : '—'}
                      </td>
                      <td>{p.phone ?? '—'}</td>
                      <td>
                        {p.email ? (
                          <a href={`mailto:${p.email}`} style={{ color: '#0d9488', textDecoration: 'none', fontSize: 13 }}>{p.email}</a>
                        ) : '—'}
                      </td>
                      <td>
                        {practiceLocations.length === 0 ? (
                          <span style={{ color: '#94a3b8', fontSize: 12 }}>None</span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {practiceLocations.map(loc => (
                              <div key={loc.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{
                                  display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                                  background: loc.active ? '#0d9488' : '#94a3b8',
                                }} />
                                <span style={{ fontSize: 12 }}>{loc.name}</span>
                                {(loc.city || loc.state) && (
                                  <span style={{ fontSize: 11, color: '#9ca3af' }}>{[loc.city, loc.state].filter(Boolean).join(', ')}</span>
                                )}
                              </div>
                            ))}
                            <Link href="/locations" style={{ fontSize: 11, color: '#0d9488', textDecoration: 'none', marginTop: 2 }}>
                              Manage locations →
                            </Link>
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${p.active ? 'badge-green' : 'badge-gray'}`}>
                          {p.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button className="btn btn-sm btn-secondary" onClick={() => openEdit(p)}>Edit</button>
                          <button
                            className={`btn btn-sm ${p.active ? 'btn-danger' : 'btn-secondary'}`}
                            onClick={() => void toggleActive(p)}
                          >
                            {p.active ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editPractice ? 'Edit Practice' : 'Add Practice'}</h2>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <form onSubmit={e => void handleSubmit(e)}>
              <div className="modal-body">
                {formError && (
                  <div className="alert alert-error" style={{ marginBottom: 16 }}>⚠️ {formError}</div>
                )}

                {/* Name row */}
                <div className="form-row form-row-2">
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Practice Name <span className="required">*</span></label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Northern Virginia Allergy Associates"
                      value={form.name}
                      onChange={e => setField('name', e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Short Name / Abbreviation</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. NVAA"
                      value={form.shortName}
                      onChange={e => setField('shortName', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">NPI (Practice)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="10-digit NPI"
                      value={form.npi}
                      onChange={e => setField('npi', e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Tax ID / EIN</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="XX-XXXXXXX"
                      value={form.taxId}
                      onChange={e => setField('taxId', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="(703) 555-0100"
                      value={form.phone}
                      onChange={e => setField('phone', e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Fax</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="(703) 555-0101"
                      value={form.fax}
                      onChange={e => setField('fax', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="admin@yourpractice.com"
                      value={form.email}
                      onChange={e => setField('email', e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-row form-row-2">
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Website</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="https://yourpractice.com"
                      value={form.website}
                      onChange={e => setField('website', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn" disabled={saving}>
                  {saving ? 'Saving…' : editPractice ? 'Save Changes' : 'Add Practice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
