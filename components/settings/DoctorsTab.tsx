'use client';

import { useState, useEffect } from 'react';

interface Doctor {
  id: string; name: string; title?: string; specialty?: string;
  phone?: string; email?: string; npi?: string; clinicLocation?: string;
  active: boolean; practiceId?: string | null; locationId?: string | null;
}
interface Practice { id: string; name: string; shortName: string | null; active: boolean; }
interface Location { id: string; name: string; key: string; city: string; state: string; active: boolean; practiceId?: string | null; }

const DOCTOR_TITLE_OPTIONS = ['MD', 'DO', 'NP', 'PA'];
const EMPTY_FORM = { name:'', title:'', specialty:'', email:'', phone:'', npi:'', clinicLocation:'', practiceId:'', locationId:'' };

export default function DoctorsTab() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [practices, setPractices] = useState<Practice[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editDoctor, setEditDoctor] = useState<Doctor | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Filtered locations based on selected practice
  const filteredLocations = form.practiceId
    ? locations.filter(l => l.practiceId === form.practiceId && l.active)
    : locations.filter(l => l.active);

  async function loadAll() {
    setLoading(true); setLoadError(null);
    try {
      const [docRes, practiceRes, locRes] = await Promise.all([
        fetch('/api/doctors?all=1'),
        fetch('/api/practices'),
        fetch('/api/locations?all=1'),
      ]);
      if (!docRes.ok) throw new Error(docRes.status === 401 ? 'session_expired' : `HTTP ${docRes.status}`);
      const docData = await docRes.json();
      const practiceData = await practiceRes.json().catch(() => ({}));
      const locData = await locRes.json().catch(() => []);
      setDoctors(Array.isArray(docData) ? docData : (docData.doctors ?? []));
      setPractices(practiceData?.practices ?? (Array.isArray(practiceData) ? practiceData : []));
      setLocations(Array.isArray(locData) ? locData : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load';
      setLoadError(msg === 'session_expired' ? 'Session expired — please refresh.' : `Failed to load: ${msg}`);
    } finally { setLoading(false); }
  }

  useEffect(() => { void loadAll(); }, []);

  function getPracticeName(id?: string | null) {
    if (!id) return '—';
    return practices.find(p => p.id === id)?.shortName ?? practices.find(p => p.id === id)?.name ?? '—';
  }
  function getLocationName(id?: string | null) {
    if (!id) return '—';
    const loc = locations.find(l => l.id === id);
    if (!loc) return '—';
    return loc.city ? `${loc.name} — ${loc.city}, ${loc.state}` : loc.name;
  }

  function openAdd() {
    setEditDoctor(null); setForm({ ...EMPTY_FORM }); setFormError(''); setShowModal(true);
  }
  function openEdit(doc: Doctor) {
    setEditDoctor(doc);
    setForm({
      name: doc.name, title: doc.title ?? '', specialty: doc.specialty ?? '',
      email: doc.email ?? '', phone: doc.phone ?? '', npi: doc.npi ?? '',
      clinicLocation: doc.clinicLocation ?? '',
      practiceId: doc.practiceId ?? '', locationId: doc.locationId ?? '',
    });
    setFormError(''); setShowModal(true);
  }
  function closeModal() { setShowModal(false); setEditDoctor(null); setFormError(''); }
  function setField(field: string, value: string) {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      // Clear location if practice changes
      if (field === 'practiceId') next.locationId = '';
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setFormError('');
    if (!form.name.trim()) { setFormError('Name is required'); return; }
    setSaving(true);
    try {
      const url = editDoctor ? `/api/doctors/${editDoctor.id}` : '/api/doctors';
      const res = await fetch(url, {
        method: editDoctor ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          title: form.title || undefined,
          specialty: form.specialty || undefined,
          email: form.email || undefined,
          phone: form.phone || undefined,
          npi: form.npi || undefined,
          clinicLocation: form.clinicLocation || undefined,
          practiceId: form.practiceId || null,
          locationId: form.locationId || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? `Request failed: ${res.status}`);
      }
      closeModal(); await loadAll();
    } catch (e) { setFormError(e instanceof Error ? e.message : 'Failed to save'); }
    finally { setSaving(false); }
  }

  async function toggleActive(doc: Doctor) {
    await fetch(`/api/doctors/${doc.id}`, {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ active: !doc.active })
    }).catch(() => {});
    void loadAll();
  }

  return (
    <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', padding:24 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div className="card-title" style={{ marginBottom:0 }}>👨‍⚕️ Doctors</div>
        <button className="btn" onClick={openAdd}>+ Add Doctor</button>
      </div>

      {loadError && (
        <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'12px 16px', marginBottom:16, color:'#b91c1c', fontSize:13 }}>
          🔐 {loadError}
          <button onClick={() => { setLoadError(null); void loadAll(); }}
            style={{ marginLeft:12, padding:'3px 10px', background:'#b91c1c', color:'#fff', border:'none', borderRadius:6, cursor:'pointer', fontSize:12 }}>Retry</button>
        </div>
      )}

      {loading ? (
        <div className="loading-center"><div className="spinner" /><span>Loading doctors…</span></div>
      ) : doctors.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🩺</div>
          <div className="empty-state-title">No doctors yet</div>
          <div style={{ marginTop:16 }}><button className="btn" onClick={openAdd}>Add First Doctor</button></div>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Title</th><th>Specialty</th>
                <th>Practice</th><th>Location</th>
                <th>Phone</th><th>NPI</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {doctors.map(doc => (
                <tr key={doc.id}>
                  <td><div style={{ fontWeight:600 }}>{doc.name}</div></td>
                  <td>{doc.title ?? '—'}</td>
                  <td>{doc.specialty ?? '—'}</td>
                  <td>
                    {doc.practiceId ? (
                      <span style={{ fontSize:12, background:'#eff6ff', color:'#1d4ed8', padding:'2px 8px', borderRadius:4, fontWeight:600 }}>
                        {getPracticeName(doc.practiceId)}
                      </span>
                    ) : '—'}
                  </td>
                  <td>
                    {doc.locationId ? (
                      <span style={{ fontSize:12 }}>{getLocationName(doc.locationId)}</span>
                    ) : (doc.clinicLocation ?? '—')}
                  </td>
                  <td>{doc.phone ?? '—'}</td>
                  <td>{doc.npi ? <code style={{ fontSize:11, background:'#f1f5f9', padding:'1px 5px', borderRadius:3 }}>{doc.npi}</code> : '—'}</td>
                  <td><span className={`badge ${doc.active ? 'badge-green' : 'badge-gray'}`}>{doc.active ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-sm btn-secondary" onClick={() => openEdit(doc)}>Edit</button>
                      <button className={`btn btn-sm ${doc.active ? 'btn-danger' : 'btn-secondary'}`} onClick={() => void toggleActive(doc)}>
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

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" style={{ maxWidth:620 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editDoctor ? 'Edit Doctor' : 'Add Doctor'}</h2>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <form onSubmit={e => void handleSubmit(e)}>
              <div className="modal-body" style={{ overflowY:'auto', maxHeight:'calc(90vh - 130px)' }}>
                {formError && <div className="alert alert-error" style={{ marginBottom:16 }}>⚠️ {formError}</div>}

                {/* Name */}
                <div className="form-group">
                  <label className="form-label">Name <span className="required">*</span></label>
                  <input type="text" className="form-input" placeholder="Dr. Jane Smith"
                    value={form.name} onChange={e => setField('name', e.target.value)} required />
                </div>

                {/* Title + Specialty */}
                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Title</label>
                    <select className="form-input" value={form.title} onChange={e => setField('title', e.target.value)}>
                      <option value="">Select…</option>
                      {DOCTOR_TITLE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Specialty</label>
                    <input type="text" className="form-input" placeholder="e.g. Allergy & Immunology"
                      value={form.specialty} onChange={e => setField('specialty', e.target.value)} />
                  </div>
                </div>

                {/* Practice + Location */}
                <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, padding:'14px 16px', marginBottom:16 }}>
                  <div style={{ fontWeight:700, fontSize:13, color:'#166534', marginBottom:10 }}>🏥 Practice Assignment</div>
                  <div className="form-row form-row-2">
                    <div className="form-group" style={{ marginBottom:0 }}>
                      <label className="form-label">Practice</label>
                      <select className="form-input" value={form.practiceId} onChange={e => setField('practiceId', e.target.value)}>
                        <option value="">— Not assigned —</option>
                        {practices.filter(p => p.active).map(p => (
                          <option key={p.id} value={p.id}>{p.shortName ?? p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom:0 }}>
                      <label className="form-label">Location</label>
                      <select className="form-input" value={form.locationId} onChange={e => setField('locationId', e.target.value)}
                        disabled={filteredLocations.length === 0}>
                        <option value="">— Not assigned —</option>
                        {filteredLocations.map(l => (
                          <option key={l.id} value={l.id}>
                            {l.name}{l.city ? ` — ${l.city}, ${l.state}` : ''}
                          </option>
                        ))}
                      </select>
                      {form.practiceId && filteredLocations.length === 0 && (
                        <div style={{ fontSize:11, color:'#92400e', marginTop:3 }}>No active locations for this practice</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Email + Phone */}
                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input type="email" className="form-input" placeholder="doctor@clinic.com"
                      value={form.email} onChange={e => setField('email', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input type="tel" className="form-input" placeholder="(555) 555-0100"
                      value={form.phone} onChange={e => setField('phone', e.target.value)} />
                  </div>
                </div>

                {/* NPI */}
                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">
                      Type 1 NPI <span style={{ fontSize:11, color:'#94a3b8', fontWeight:400 }}>(Individual)</span>
                    </label>
                    <input type="text" className="form-input" placeholder="10-digit NPI"
                      value={form.npi} onChange={e => setField('npi', e.target.value)} />
                    <div style={{ fontSize:11, color:'#94a3b8', marginTop:3 }}>Individual provider NPI for claims</div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Clinic Location <span style={{ fontSize:11, color:'#94a3b8', fontWeight:400 }}>(text override)</span></label>
                    <input type="text" className="form-input" placeholder="e.g. Main Street Clinic"
                      value={form.clinicLocation} onChange={e => setField('clinicLocation', e.target.value)} />
                    <div style={{ fontSize:11, color:'#94a3b8', marginTop:3 }}>Optional free-text if not in location list</div>
                  </div>
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
    </div>
  );
}
