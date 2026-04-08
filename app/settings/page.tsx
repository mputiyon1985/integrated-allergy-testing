'use client';

import Link from 'next/link';

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
        </div>
      </div>
    </>
  );
}
