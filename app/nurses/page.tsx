'use client';

import { useEffect, useState } from 'react';

interface Nurse {
  id: string;
  name: string;
  title?: string;
  phone?: string;
  email?: string;
  clinicLocation?: string;
  active: boolean;
}

const TITLE_OPTIONS = ['RN', 'LPN', 'CMA', 'MA'];

const EMPTY_FORM = {
  name: '',
  title: '',
  email: '',
  phone: '',
  clinicLocation: '',
};

export default function NursesPage() {
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editNurse, setEditNurse] = useState<Nurse | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  async function loadNurses() {
    setLoading(true);
    try {
      const res = await fetch('/api/nurses?all=1');
      if (!res.ok) throw new Error('Failed to load nurses');
      const data = await res.json();
      setNurses(Array.isArray(data) ? data : (data.nurses ?? []));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadNurses(); }, []);

  function openAdd() {
    setEditNurse(null);
    setForm({ ...EMPTY_FORM });
    setFormError('');
    setShowModal(true);
  }

  function openEdit(nurse: Nurse) {
    setEditNurse(nurse);
    setForm({
      name: nurse.name,
      title: nurse.title ?? '',
      email: nurse.email ?? '',
      phone: nurse.phone ?? '',
      clinicLocation: nurse.clinicLocation ?? '',
    });
    setFormError('');
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditNurse(null);
    setFormError('');
  }

  function setField(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim()) { setFormError('Name is required'); return; }

    setSaving(true);
    try {
      const url = editNurse ? `/api/nurses/${editNurse.id}` : '/api/nurses';
      const method = editNurse ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          title: form.title || undefined,
          email: form.email || undefined,
          phone: form.phone || undefined,
          clinicLocation: form.clinicLocation || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed: ${res.status}`);
      }
      closeModal();
      await loadNurses();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(nurse: Nurse) {
    try {
      const res = await fetch(`/api/nurses/${nurse.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !nurse.active }),
      });
      if (!res.ok) throw new Error('Failed to update');
      await loadNurses();
    } catch {
      alert('Failed to update nurse status');
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Nurses</div>
          <div className="page-subtitle">
            {loading ? 'Loading…' : `${nurses.length} nurse${nurses.length !== 1 ? 's' : ''}`}
          </div>
        </div>
        <button className="btn" onClick={openAdd}>+ Add Nurse</button>
      </div>

      <div className="page-body">
        {error && <div className="alert alert-error">⚠️ {error}</div>}

        {loading ? (
          <div className="loading-center"><div className="spinner" /><span>Loading nurses…</span></div>
        ) : nurses.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👩‍⚕️</div>
            <div className="empty-state-title">No nurses yet</div>
            <div style={{ marginTop: 16 }}>
              <button className="btn" onClick={openAdd}>Add First Nurse</button>
            </div>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Title</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {nurses.map((nurse) => (
                  <tr key={nurse.id}>
                    <td><div style={{ fontWeight: 600 }}>{nurse.name}</div></td>
                    <td>{nurse.title ?? '—'}</td>
                    <td>{nurse.phone ?? '—'}</td>
                    <td>{nurse.email ?? '—'}</td>
                    <td>{nurse.clinicLocation ?? '—'}</td>
                    <td>
                      <span className={`badge ${nurse.active ? 'badge-green' : 'badge-gray'}`}>
                        {nurse.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-sm btn-secondary" onClick={() => openEdit(nurse)}>Edit</button>
                        <button
                          className={`btn btn-sm ${nurse.active ? 'btn-danger' : 'btn-secondary'}`}
                          onClick={() => toggleActive(nurse)}
                        >
                          {nurse.active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editNurse ? 'Edit Nurse' : 'Add Nurse'}</h2>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {formError && <div className="alert alert-error" style={{ marginBottom: 16 }}>⚠️ {formError}</div>}

                <div className="form-group">
                  <label className="form-label">Name <span className="required">*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Full name"
                    value={form.name}
                    onChange={e => setField('name', e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Title</label>
                  <select className="form-input" value={form.title} onChange={e => setField('title', e.target.value)}>
                    <option value="">Select…</option>
                    {TITLE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="nurse@clinic.com"
                      value={form.email}
                      onChange={e => setField('email', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input
                      type="tel"
                      className="form-input"
                      placeholder="(555) 555-0100"
                      value={form.phone}
                      onChange={e => setField('phone', e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Clinic Location</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Main Street Clinic"
                    value={form.clinicLocation}
                    onChange={e => setField('clinicLocation', e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn" disabled={saving}>
                  {saving ? 'Saving…' : editNurse ? 'Save Changes' : 'Add Nurse'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
