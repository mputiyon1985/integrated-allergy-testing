'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

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
    return '#16a34a'; // green
  }
  if (upper.includes('VIEW') || upper.includes('READ') || upper.includes('ACCESS') || upper.includes('LOGIN') || upper.includes('LOOKUP')) {
    return '#2563eb'; // blue
  }
  if (upper.includes('UPDATED') || upper.includes('MODIFIED') || upper.includes('CHANGED')) {
    return '#d97706'; // orange
  }
  if (upper.includes('DELETED') || upper.includes('REMOVED') || upper.includes('LOGOUT')) {
    return '#dc2626'; // red
  }
  return '#64748b'; // gray default
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

function AuditLogSection() {
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
    <div className="card" style={{ gridColumn: '1 / -1' }}>
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

          <div className="card">
            <div className="card-title">Quick Links</div>
            <div className="flex flex-col gap-2">
              <Link href="/patients/new" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>👤 Register New Patient</Link>
              <Link href="/testing" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>🧪 Start Testing Session</Link>
              <Link href="/videos" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>🎬 Manage Videos</Link>
            </div>
          </div>

          <AuditLogSection />
        </div>
      </div>
    </>
  );
}
