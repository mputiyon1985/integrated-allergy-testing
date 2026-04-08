'use client';

import { useEffect, useState } from 'react';

interface Location {
  id: string;
  name: string;
  key: string;
  suite?: string | null;
  street: string;
  city: string;
  state: string;
  zip: string;
  active: boolean;
}

const EMPTY_FORM = {
  name: '',
  key: '',
  suite: '',
  street: '',
  city: '',
  state: '',
  zip: '',
};

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editLocation, setEditLocation] = useState<Location | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  async function loadLocations() {
    setLoading(true);
    try {
      const res = await fetch('/api/locations?all=1');
      if (!res.ok) throw new Error('Failed to load locations');
      const data = await res.json() as Location[];
      setLocations(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadLocations(); }, []);

  function openAdd() {
    setEditLocation(null);
    setForm({ ...EMPTY_FORM });
    setFormError('');
    setShowModal(true);
  }

  function openEdit(loc: Location) {
    setEditLocation(loc);
    setForm({
      name: loc.name,
      key: loc.key,
      suite: loc.suite ?? '',
      street: loc.street,
      city: loc.city,
      state: loc.state,
      zip: loc.zip,
    });
    setFormError('');
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditLocation(null);
    setFormError('');
  }

  function setField(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');

    if (!form.name.trim()) { setFormError('Name is required'); return; }
    if (!form.key.trim()) { setFormError('Key is required'); return; }
    if (!form.street.trim()) { setFormError('Street is required'); return; }
    if (!form.city.trim()) { setFormError('City is required'); return; }
    if (!form.state.trim()) { setFormError('State is required'); return; }
    if (!form.zip.trim()) { setFormError('ZIP is required'); return; }

    setSaving(true);
    try {
      const url = editLocation ? `/api/locations/${editLocation.id}` : '/api/locations';
      const method = editLocation ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          key: form.key.trim(),
          suite: form.suite.trim() || null,
          street: form.street.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          zip: form.zip.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? `Request failed: ${res.status}`);
      }
      closeModal();
      await loadLocations();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(loc: Location) {
    try {
      const res = await fetch(`/api/locations/${loc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !loc.active }),
      });
      if (!res.ok) throw new Error('Failed to update');
      await loadLocations();
    } catch {
      alert('Failed to update location status');
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Locations</div>
          <div className="page-subtitle">
            {loading ? 'Loading…' : `${locations.length} location${locations.length !== 1 ? 's' : ''}`}
          </div>
        </div>
        <button className="btn" onClick={openAdd}>+ Add Location</button>
      </div>

      <div className="page-body">
        {error && <div className="alert alert-error">⚠️ {error}</div>}

        {loading ? (
          <div className="loading-center"><div className="spinner" /><span>Loading locations…</span></div>
        ) : locations.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📍</div>
            <div className="empty-state-title">No locations yet</div>
            <div style={{ marginTop: 16 }}>
              <button className="btn" onClick={openAdd}>Add First Location</button>
            </div>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Key</th>
                  <th>Suite</th>
                  <th>Street</th>
                  <th>City</th>
                  <th>State</th>
                  <th>ZIP</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {locations.map((loc) => (
                  <tr key={loc.id}>
                    <td><div style={{ fontWeight: 600 }}>{loc.name}</div></td>
                    <td><code style={{ fontSize: 12, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>{loc.key}</code></td>
                    <td>{loc.suite ?? '—'}</td>
                    <td>{loc.street}</td>
                    <td>{loc.city}</td>
                    <td>{loc.state}</td>
                    <td>{loc.zip}</td>
                    <td>
                      <span className={`badge ${loc.active ? 'badge-green' : 'badge-gray'}`}>
                        {loc.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-sm btn-secondary" onClick={() => openEdit(loc)}>Edit</button>
                        <button
                          className={`btn btn-sm ${loc.active ? 'btn-danger' : 'btn-secondary'}`}
                          onClick={() => void toggleActive(loc)}
                        >
                          {loc.active ? 'Deactivate' : 'Activate'}
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
              <h2 className="modal-title">{editLocation ? 'Edit Location' : 'Add Location'}</h2>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <form onSubmit={e => void handleSubmit(e)}>
              <div className="modal-body">
                {formError && <div className="alert alert-error" style={{ marginBottom: 16 }}>⚠️ {formError}</div>}

                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Name <span className="required">*</span></label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Main Street Clinic"
                      value={form.name}
                      onChange={e => setField('name', e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Key <span className="required">*</span></label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. IAT-001"
                      value={form.key}
                      onChange={e => setField('key', e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Street <span className="required">*</span></label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="123 Main St"
                      value={form.street}
                      onChange={e => setField('street', e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Suite</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Suite 100"
                      value={form.suite}
                      onChange={e => setField('suite', e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-row form-row-3">
                  <div className="form-group">
                    <label className="form-label">City <span className="required">*</span></label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Springfield"
                      value={form.city}
                      onChange={e => setField('city', e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">State <span className="required">*</span></label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="VA"
                      maxLength={2}
                      value={form.state}
                      onChange={e => setField('state', e.target.value.toUpperCase())}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">ZIP <span className="required">*</span></label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="22101"
                      value={form.zip}
                      onChange={e => setField('zip', e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn" disabled={saving}>
                  {saving ? 'Saving…' : editLocation ? 'Save Changes' : 'Add Location'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
