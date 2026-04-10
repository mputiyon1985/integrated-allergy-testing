'use client';

import { useState, useEffect } from 'react';

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

export default function ServicesTab() {
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
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24 }}>
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
    </div>
  );
}
