'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

type AuditLogEntry = {
  id: string;
  action: string;
  performedBy: string | null;
  entity: string | null;
  entityId: string | null;
  patientId: string | null;
  patientName: string | null;
  details: string | null;
  createdAt: string;
  patient?: { id: string; patientId: string; name: string } | null;
};

function getActionColor(action: string): string {
  const upper = action.toUpperCase();
  if (upper.includes('CREATED') || upper.includes('REGISTER') || upper.includes('SIGN')) {
    return '#16a34a';
  }
  if (upper.includes('VIEW') || upper.includes('READ') || upper.includes('ACCESS') || upper.includes('LOGIN') || upper.includes('LOOKUP')) {
    return '#2563eb';
  }
  if (upper.includes('UPDATED') || upper.includes('MODIFIED') || upper.includes('CHANGED')) {
    return '#d97706';
  }
  if (upper.includes('DELETED') || upper.includes('REMOVED') || upper.includes('LOGOUT')) {
    return '#dc2626';
  }
  return '#64748b';
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

export default function AuditLogTab() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  function fetchLogs() {
    setLoading(true);
    setLoadError(null);
    fetch('/api/audit?limit=200')
      .then(async r => {
        if (!r.ok) throw new Error(r.status === 401 ? 'session_expired' : `HTTP ${r.status}`);
        return r.json();
      })
      .then(d => {
        setLogs(Array.isArray(d) ? d : (d.logs ?? d.entries ?? []));
        setLoading(false);
      })
      .catch(err => {
        console.error('[AuditLogTab] fetch error:', err.message);
        setLoadError(err.message === 'session_expired' ? 'Session expired — please refresh and log in again' : `Failed to load audit log: ${err.message}`);
        setLoading(false);
      });
  }

  useEffect(() => {
    fetchLogs();
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
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24 }}>
      <div className="card-title">Audit Log</div>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
        HIPAA compliance audit trail — recent activity across the system.
      </p>

      {loadError && (
        <div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:8,padding:'12px 16px',marginBottom:16,color:'#b91c1c',fontSize:13}}>
          🔐 {loadError}
          <button onClick={fetchLogs} style={{marginLeft:12,padding:'2px 10px',borderRadius:6,border:'1px solid #fecaca',background:'#fff',color:'#b91c1c',fontSize:12,cursor:'pointer',fontWeight:700}}>Retry</button>
        </div>
      )}

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
                    {log.patientName ? (
                      <span style={{ color: '#374151', fontSize: 12, fontWeight: 500 }}>{log.patientName}</span>
                    ) : log.patient ? (
                      <Link href={`/patients/${log.patient.id}`} style={{ color: '#2563eb', textDecoration: 'underline', fontSize: 12 }}>
                        {log.patient.name || log.patient.patientId}
                      </Link>
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
