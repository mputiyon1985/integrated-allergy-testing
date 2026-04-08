'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface AppointmentReason {
  id: string;
  name: string;
  color: string;
  duration: number;
  active: boolean;
  sortOrder: number;
}

function AppointmentReasonsSection() {
  const [reasons, setReasons] = useState<AppointmentReason[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#0d9488');
  const [newDuration, setNewDuration] = useState(30);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function loadReasons() {
    setLoading(true);
    try {
      const res = await fetch('/api/appointment-reasons');
      if (res.ok) {
        const data = await res.json();
        // Also load inactive for management
        setReasons(Array.isArray(data) ? data : data.reasons ?? []);
      }
    } catch {}
    setLoading(false);
  }

  useEffect(() => { loadReasons(); }, []);

  async function toggleActive(r: AppointmentReason) {
    await fetch(`/api/appointment-reasons/${r.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !r.active }),
    });
    loadReasons();
  }

  async function handleAdd() {
    if (!newName.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    const res = await fetch('/api/appointment-reasons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), color: newColor, duration: newDuration }),
    });
    if (res.ok) {
      setShowAdd(false);
      setNewName('');
      setNewColor('#0d9488');
      setNewDuration(30);
      loadReasons();
    } else {
      const d = await res.json();
      setError(d.error ?? 'Failed to create');
    }
    setSaving(false);
  }

  return (
    <div className="card" style={{ gridColumn: '1 / -1' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="card-title" style={{ margin: 0 }}>📋 Appointment Reasons</div>
        <button onClick={() => setShowAdd(s => !s)}
          style={{ padding: '6px 16px', borderRadius: 8, border: 'none', background: '#0d9488', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
          {showAdd ? '✕ Cancel' : '+ Add Reason'}
        </button>
      </div>

      {showAdd && (
        <div style={{ background: '#f8fafc', borderRadius: 10, padding: 16, marginBottom: 16, border: '1px solid #e2e8f0' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: '#374151' }}>New Appointment Reason</div>
          {error && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 8 }}>{error}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Name *</label>
              <input value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="e.g. Allergy Shot"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Color</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)}
                  style={{ width: 40, height: 36, borderRadius: 6, border: '1.5px solid #e2e8f0', cursor: 'pointer', padding: 2 }} />
                <span style={{ fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>{newColor}</span>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Duration (min)</label>
              <input type="number" value={newDuration} onChange={e => setNewDuration(Number(e.target.value))} min={5} max={240} step={5}
                style={{ width: 80, padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button onClick={handleAdd} disabled={saving}
              style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#0d9488', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13, opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Saving…' : 'Add Reason'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px 0', color: '#94a3b8' }}>Loading…</div>
      ) : reasons.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 0', color: '#94a3b8', fontSize: 14 }}>No appointment reasons configured yet.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['Name', 'Color', 'Duration', 'Status', 'Actions'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reasons.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9', opacity: r.active ? 1 : 0.5 }}>
                <td style={{ padding: '12px 14px', fontWeight: 600 }}>{r.name}</td>
                <td style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 20, height: 20, borderRadius: 4, background: r.color, border: '1px solid rgba(0,0,0,0.1)' }} />
                    <span style={{ fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>{r.color}</span>
                  </div>
                </td>
                <td style={{ padding: '12px 14px', color: '#374151' }}>{r.duration} min</td>
                <td style={{ padding: '12px 14px' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 999, background: r.active ? '#e8f9f7' : '#f1f5f9', color: r.active ? '#0d9488' : '#9ca3af' }}>
                    {r.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <button onClick={() => toggleActive(r)}
                    style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: r.active ? '#dc2626' : '#0d9488' }}>
                    {r.active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Settings</div>
          <div className="page-subtitle">System configuration and administration</div>
        </div>
      </div>

      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div className="card">
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

          <div className="card">
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

          <div className="card">
            <div className="card-title">Application Version</div>
            <div className="flex flex-col gap-2">
              {[
                { label: 'Version', value: '1.0.0' },
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

          <div className="card">
            <div className="card-title">Quick Links</div>
            <div className="flex flex-col gap-2">
              <Link href="/patients/new" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>👤 Register New Patient</Link>
              <Link href="/testing" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>🧪 Start Testing Session</Link>
              <Link href="/videos" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>🎬 Manage Videos</Link>
            </div>
          </div>

          <AppointmentReasonsSection />
        </div>
      </div>
    </>
  );
}
