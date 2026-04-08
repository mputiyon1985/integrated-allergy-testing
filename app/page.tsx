'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface WaitingEntry {
  id: string;
  patientId: string;
  patientName: string;
  status: 'waiting' | 'in-service' | 'complete';
  checkedInAt: string;
  calledAt?: string;
  nurseName?: string;
  notes?: string;
  videosWatched?: number;
  videoAckBy?: string;
  videoAckAt?: string;
}

interface Nurse { id: string; name: string; title?: string; }

export default function DashboardPage() {
  const [patientCount, setPatientCount] = useState<number | null>(null);
  const [doctorCount, setDoctorCount] = useState<number | null>(null);
  const [nurseCount, setNurseCount] = useState<number | null>(null);
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);
  const [waiting, setWaiting] = useState<WaitingEntry[]>([]);
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadWaiting = useCallback(async () => {
    try {
      const r = await fetch('/api/waiting-room');
      const d = await r.json();
      setWaiting(d.entries ?? []);
    } catch {}
  }, []);

  useEffect(() => {
    async function loadData() {
      try {
        const [patientsRes, doctorsRes, nursesRes, meRes] = await Promise.allSettled([
          fetch('/api/patients'), fetch('/api/doctors'), fetch('/api/nurses'), fetch('/api/auth/me'),
        ]);
        if (patientsRes.status === 'fulfilled' && patientsRes.value.ok) {
          const d = await patientsRes.value.json();
          setPatientCount((Array.isArray(d) ? d : d.patients ?? []).length);
        }
        if (doctorsRes.status === 'fulfilled' && doctorsRes.value.ok) {
          const d = await doctorsRes.value.json();
          setDoctorCount((Array.isArray(d) ? d : d.doctors ?? []).filter((x: { active?: boolean }) => x.active !== false).length);
        }
        if (nursesRes.status === 'fulfilled' && nursesRes.value.ok) {
          const d = await nursesRes.value.json();
          const list = Array.isArray(d) ? d : d.nurses ?? [];
          setNurses(list);
          setNurseCount(list.filter((n: { active?: boolean }) => n.active !== false).length);
        }
        if (meRes.status === 'fulfilled' && meRes.value.ok) {
          const d = await meRes.value.json();
          setUserName(d?.user?.name ?? d?.name ?? '');
        }
      } catch {}
      finally { setLoading(false); }
    }
    loadData();
    loadWaiting();
    // Auto-refresh waiting room every 30s
    const interval = setInterval(loadWaiting, 30000);
    return () => clearInterval(interval);
  }, [loadWaiting]);

  async function updateStatus(id: string, status: string, nurseName?: string) {
    setUpdatingId(id);
    await fetch(`/api/waiting-room/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, nurseName }),
    });
    await loadWaiting();
    setUpdatingId(null);
  }

  function waitTime(checkedInAt: string) {
    const mins = Math.floor((Date.now() - new Date(checkedInAt).getTime()) / 60000);
    if (mins < 1) return 'Just arrived';
    if (mins === 1) return '1 min';
    return `${mins} mins`;
  }

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const waitingCount = waiting.filter(e => e.status === 'waiting').length;
  const inServiceCount = waiting.filter(e => e.status === 'in-service').length;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">{userName ? `Welcome, ${userName}` : 'Dashboard'}</div>
          <div className="page-subtitle">{today}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/patients/new" className="btn-secondary btn-sm btn">+ Register Patient</Link>
          <Link href="/testing" className="btn btn-sm">🧪 Start Testing</Link>
        </div>
      </div>

      <div className="page-body">
        {/* KPI Cards */}
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-icon">👥</div>
            <div className="kpi-label">Total Patients</div>
            {loading ? <div className="spinner" /> : <div className="kpi-value">{patientCount ?? 0}</div>}
          </div>
          <div className="kpi-card" style={{ borderTop: `4px solid #f59e0b` }}>
            <div className="kpi-icon">⏳</div>
            <div className="kpi-label">Waiting</div>
            <div className="kpi-value" style={{ color: waitingCount > 0 ? '#b45309' : '#64748b' }}>{waitingCount}</div>
          </div>
          <div className="kpi-card" style={{ borderTop: `4px solid #0d9488` }}>
            <div className="kpi-icon">🩺</div>
            <div className="kpi-label">In Service</div>
            <div className="kpi-value" style={{ color: inServiceCount > 0 ? '#0d9488' : '#64748b' }}>{inServiceCount}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon">👩‍⚕️</div>
            <div className="kpi-label">Nurses</div>
            {loading ? <div className="spinner" /> : <div className="kpi-value">{nurseCount ?? 0}</div>}
          </div>
        </div>

        {/* Waiting Room Board */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div className="card-title" style={{ margin: 0 }}>🏥 Waiting Room</div>
            <button onClick={loadWaiting} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              ↻ Refresh
            </button>
          </div>

          {waiting.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8' }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>Waiting room is clear</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Patients checked in via kiosk will appear here</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Patient', 'Wait Time', 'Videos', 'Status', 'Nurse', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {waiting.map(e => (
                  <tr key={e.id} style={{ borderBottom: '1px solid #f1f5f9', background: e.status === 'in-service' ? '#e8f9f7' : 'white' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 700 }}>{e.patientName}</div>
                      {e.notes && <div style={{ fontSize: 12, color: '#64748b' }}>{e.notes}</div>}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#64748b', fontSize: 13 }}>{waitTime(e.checkedInAt)}</td>
                    <td style={{ padding: '12px 14px' }}>
                      {e.videoAckBy ? (
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#15803d' }}>✅ {e.videosWatched ?? 0} watched</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>Ack: {e.videoAckBy}</div>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: (e.videosWatched ?? 0) > 0 ? '#b45309' : '#94a3b8', marginBottom: 4 }}>
                            {(e.videosWatched ?? 0) > 0 ? `📺 ${e.videosWatched} video${(e.videosWatched ?? 0) !== 1 ? 's' : ''} watched` : '—'}
                          </div>
                          {(e.videosWatched ?? 0) > 0 && (
                            <select
                              defaultValue=""
                              onChange={ev => ev.target.value && (async () => {
                                await fetch(`/api/waiting-room/${e.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoAckBy: ev.target.value }) });
                                loadWaiting();
                              })()}
                              style={{ fontSize: 11, padding: '2px 6px', borderRadius: 6, border: '1px solid #fde68a', background: '#fefce8', cursor: 'pointer', color: '#92400e' }}
                            >
                              <option value="">✓ Acknowledge</option>
                              {nurses.map(n => <option key={n.id} value={n.name}>{n.name}</option>)}
                            </select>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        fontWeight: 700, fontSize: 12, padding: '3px 10px', borderRadius: 999,
                        background: e.status === 'waiting' ? '#fef9c3' : '#d1fae5',
                        color: e.status === 'waiting' ? '#b45309' : '#065f46',
                      }}>
                        {e.status === 'waiting' ? '⏳ Waiting' : '🩺 In Service'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', color: '#64748b', fontSize: 13 }}>
                      {e.status === 'waiting' ? (
                        <select onChange={ev => ev.target.value && updateStatus(e.id, 'in-service', ev.target.value)}
                          defaultValue=""
                          style={{ fontSize: 13, padding: '4px 8px', borderRadius: 6, border: '1px solid #e2e8f0', cursor: 'pointer' }}>
                          <option value="">— Call Patient —</option>
                          {nurses.map(n => <option key={n.id} value={n.name}>{n.title ? `${n.title} ${n.name}` : n.name}</option>)}
                        </select>
                      ) : (
                        <span style={{ fontWeight: 600, color: '#0d9488' }}>{e.nurseName ?? '—'}</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {e.status === 'in-service' && (
                        <button onClick={() => updateStatus(e.id, 'complete')}
                          disabled={updatingId === e.id}
                          style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#0055A5', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                          {updatingId === e.id ? '⏳' : '✅ Complete'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Quick Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div className="card">
            <div className="card-title">Quick Actions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { href: '/patients/new', label: '👤 Register New Patient' },
                { href: '/testing', label: '🧪 Start Testing' },
                { href: '/patients', label: '👥 View All Patients' },
                { href: '/kiosk', label: '📲 Open Patient Kiosk', target: '_blank' },
                { href: '/doctors', label: '👨‍⚕️ Manage Doctors' },
                { href: '/nurses', label: '👩‍⚕️ Manage Nurses' },
              ].map(a => (
                <a key={a.href} href={a.href} target={a.target}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#374151', fontSize: 15, fontWeight: 600, textDecoration: 'none' }}>
                  {a.label}
                </a>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-title">System Status</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Patient Kiosk', status: 'Online', icon: '📲' },
                { label: 'API Server', status: 'Operational', icon: '🟢' },
                { label: 'Database', status: 'Operational', icon: '🟢' },
                { label: 'Waiting Room', status: `${waitingCount + inServiceCount} active`, icon: '🏥' },
                { label: 'Auth Service', status: 'Operational', icon: '🟢' },
                { label: 'HIPAA Compliance', status: 'Active', icon: '🔐' },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: 14, color: '#374151' }}>{s.icon} {s.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 999, background: '#e8f9f7', color: '#0d9488' }}>{s.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
