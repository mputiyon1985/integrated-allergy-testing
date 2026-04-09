'use client';

import { useEffect, useState } from 'react';

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

const TITLE_OPTIONS = ['MD', 'DO', 'NP', 'PA'];

const EMPTY_FORM = {
  name: '',
  title: '',
  specialty: '',
  email: '',
  phone: '',
  clinicLocation: '',
};

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editDoctor, setEditDoctor] = useState<Doctor | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  async function loadDoctors() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/doctors?all=1');
      if (!res.ok) throw new Error(res.status === 401 ? 'session_expired' : `HTTP ${res.status}`);
      const data = await res.json();
      setDoctors(Array.isArray(data) ? data : (data.doctors ?? []));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load';
      console.error('[Doctors] fetch error:', msg);
      if (msg === 'session_expired') setLoadError('Session expired — please refresh and log in again.');
      else setLoadError(`Failed to load doctors: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadDoctors(); }, []);

  function openAdd() {
    setEditDoctor(null);
    setForm({ ...EMPTY_FORM });
    setFormError('');
    setShowModal(true);
  }

  function openEdit(doc: Doctor) {
    setEditDoctor(doc);
    setForm({
      name: doc.name,
      title: doc.title ?? '',
      specialty: doc.specialty ?? '',
      email: doc.email ?? '',
      phone: doc.phone ?? '',
      clinicLocation: doc.clinicLocation ?? '',
    });
    setFormError('');
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditDoctor(null);
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
      const url = editDoctor ? `/api/doctors/${editDoctor.id}` : '/api/doctors';
      const method = editDoctor ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          title: form.title || undefined,
          specialty: form.specialty || undefined,
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
      await loadDoctors();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(doc: Doctor) {
    try {
      const res = await fetch(`/api/doctors/${doc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !doc.active }),
      });
      if (!res.ok) throw new Error('Failed to update');
      await loadDoctors();
    } catch {
      alert('Failed to update doctor status');
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Doctors</div>
          <div className="page-subtitle">
            {loading ? 'Loading…' : `${doctors.length} doctor${doctors.length !== 1 ? 's' : ''}`}
          </div>
        </div>
        <button className="btn" onClick={openAdd}>+ Add Doctor</button>
      </div>

      <div className="page-body">
        {loadError && <div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:8,padding:'12px 16px',marginBottom:16,color:'#b91c1c',fontSize:13}}>🔐 {loadError} <button onClick={() => { setLoadError(null); loadDoctors(); }} style={{marginLeft:12,padding:'3px 10px',background:'#b91c1c',color:'#fff',border:'none',borderRadius:6,cursor:'pointer',fontSize:12}}>Retry</button></div>}

        {loading ? (
          <div className="loading-center"><div className="spinner" /><span>Loading doctors…</span></div>
        ) : doctors.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🩺</div>
            <div className="empty-state-title">No doctors yet</div>
            <div style={{ marginTop: 16 }}>
              <button className="btn" onClick={openAdd}>Add First Doctor</button>
            </div>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Title</th>
                  <th>Specialty</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {doctors.map((doc) => (
                  <tr key={doc.id}>
                    <td><div style={{ fontWeight: 600 }}>{doc.name}</div></td>
                    <td>{doc.title ?? '—'}</td>
                    <td>{doc.specialty ?? '—'}</td>
                    <td>{doc.phone ?? '—'}</td>
                    <td>{doc.email ?? '—'}</td>
                    <td>{doc.clinicLocation ?? '—'}</td>
                    <td>
                      <span className={`badge ${doc.active ? 'badge-green' : 'badge-gray'}`}>
                        {doc.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-sm btn-secondary" onClick={() => openEdit(doc)}>Edit</button>
                        <button
                          className={`btn btn-sm ${doc.active ? 'btn-danger' : 'btn-secondary'}`}
                          onClick={() => toggleActive(doc)}
                        >
                          {doc.active ? 'Deactivate' : 'Activate'}
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
              <h2 className="modal-title">{editDoctor ? 'Edit Doctor' : 'Add Doctor'}</h2>
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
                    placeholder="Dr. Jane Smith"
                    value={form.name}
                    onChange={e => setField('name', e.target.value)}
                    required
                  />
                </div>

                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Title</label>
                    <select className="form-input" value={form.title} onChange={e => setField('title', e.target.value)}>
                      <option value="">Select…</option>
                      {TITLE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Specialty</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Allergist"
                      value={form.specialty}
                      onChange={e => setField('specialty', e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="doctor@clinic.com"
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
                  {saving ? 'Saving…' : editDoctor ? 'Save Changes' : 'Add Doctor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
