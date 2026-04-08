'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface TodayAppointment {
  id: string;
  title: string;
  patientName?: string | null;
  patientId?: string | null;
  startTime: string;
  endTime: string;
  type: string;
  status: string;
  notes?: string | null;
  reasonName?: string | null;
}

const APPT_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  'allergy-test': { bg: '#e8f9f7', text: '#0d9488' },
  'consultation': { bg: '#eff6ff', text: '#1d4ed8' },
  'follow-up':   { bg: '#f5f3ff', text: '#7c3aed' },
};

function formatApptTime(iso: string) {
  const d = new Date(iso);
  const h = d.getHours() % 12 || 12;
  const m = d.getMinutes();
  const ampm = d.getHours() >= 12 ? 'pm' : 'am';
  return m > 0 ? `${h}:${String(m).padStart(2,'0')}${ampm}` : `${h}${ampm}`;
}

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

  const [nurseCount, setNurseCount] = useState<number | null>(null);
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);
  const [waiting, setWaiting] = useState<WaitingEntry[]>([]);
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [todayAppts, setTodayAppts] = useState<TodayAppointment[]>([]);
  const [selectedAppt, setSelectedAppt] = useState<TodayAppointment | null>(null);
  const [editingAppt, setEditingAppt] = useState<TodayAppointment | null>(null);
  const [editApptTitle, setEditApptTitle] = useState('');
  const [editApptStart, setEditApptStart] = useState('');
  const [editApptEnd, setEditApptEnd] = useState('');
  const [editApptNotes, setEditApptNotes] = useState('');
  const [savingAppt, setSavingAppt] = useState(false);
  const [deletingApptId, setDeletingApptId] = useState<string | null>(null);
  const [showAddApptModal, setShowAddApptModal] = useState(false);
  const [newApptTitle, setNewApptTitle] = useState('');
  const [newApptTime, setNewApptTime] = useState('09:00');
  const [newApptEndTime, setNewApptEndTime] = useState('10:00');
  const [addingAppt, setAddingAppt] = useState(false);

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
        const [patientsRes, , nursesRes, meRes] = await Promise.allSettled([
          fetch('/api/patients'), fetch('/api/doctors'), fetch('/api/nurses'), fetch('/api/auth/me'),
        ]);
        if (patientsRes.status === 'fulfilled' && patientsRes.value.ok) {
          const d = await patientsRes.value.json();
          setPatientCount((Array.isArray(d) ? d : d.patients ?? []).length);
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
    // Auto-refresh waiting room every 10s
    const interval = setInterval(loadWaiting, 10000);
    return () => clearInterval(interval);
  }, [loadWaiting]);

  // Load today's appointments
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    fetch(`/api/iat-appointments?date=${today}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const arr: TodayAppointment[] = Array.isArray(data) ? data : [];
        const todayStr = new Date().toDateString();
        setTodayAppts(arr.filter(a => new Date(a.startTime).toDateString() === todayStr));
      })
      .catch(() => {});
  }, []);

  async function handleQuickAddAppt() {
    if (!newApptTitle.trim()) return;
    setAddingAppt(true);
    const today = new Date().toISOString().slice(0, 10);
    const startIso = new Date(`${today}T${newApptTime}:00`).toISOString();
    const endIso = new Date(`${today}T${newApptEndTime}:00`).toISOString();
    try {
      const res = await fetch('/api/iat-appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newApptTitle, startTime: startIso, endTime: endIso }),
      });
      if (res.ok) {
        const todayStr = new Date().toDateString();
        const newAppt = await res.json();
        if (new Date(newAppt.startTime).toDateString() === todayStr) {
          setTodayAppts(prev => [...prev, newAppt].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()));
        }
        setShowAddApptModal(false);
        setNewApptTitle('');
        setNewApptTime('09:00');
        setNewApptEndTime('10:00');
      }
    } catch {}
    setAddingAppt(false);
  }

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
          <Link href="/calendar?action=new" className="btn btn-sm" style={{ background: '#7c3aed', color: '#fff' }}>📅 Book Appointment</Link>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="card-title" style={{ margin: 0 }}>🏥 Waiting Room</div>
              <span style={{ fontSize: 11, color: '#0d9488', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#0d9488', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                Live · refreshes every 10s
              </span>
            </div>
            <button onClick={loadWaiting} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              ↻ Now
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

        {/* Today's Schedule (mini calendar widget) */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div className="card-title" style={{ margin: 0 }}>📅 Today&apos;s Schedule</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={() => setShowAddApptModal(true)}
                style={{ padding: '5px 14px', borderRadius: 8, border: 'none', background: '#0d9488', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                + Add
              </button>
              <Link href="/calendar"
                style={{ padding: '5px 14px', borderRadius: 8, border: '1px solid #0d9488', color: '#0d9488', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
                View Full Calendar →
              </Link>
            </div>
          </div>

          {todayAppts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#94a3b8' }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>📭</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>No appointments scheduled for today</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                <button onClick={() => setShowAddApptModal(true)} style={{ background: 'none', border: 'none', color: '#0d9488', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline', fontSize: 12 }}>
                  Book one now
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {todayAppts.map(appt => {
                const c = APPT_TYPE_COLORS[appt.type] ?? APPT_TYPE_COLORS['allergy-test'];
                return (
                  <div key={appt.id}
                    onClick={() => setSelectedAppt(appt)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: c.bg, borderRadius: 10, border: `1.5px solid ${c.text}20`, cursor: 'pointer', transition: 'box-shadow 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)')}
                    onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                  >
                    <div style={{ fontWeight: 700, fontSize: 13, color: c.text, minWidth: 56 }}>
                      {formatApptTime(appt.startTime)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{appt.title}</div>
                      {appt.patientName && <div style={{ fontSize: 12, color: '#64748b' }}>{appt.patientName}</div>}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 999, background: '#fff', color: c.text, border: `1px solid ${c.text}` }}>
                      {appt.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick-add modal */}
          {showAddApptModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
              <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 400, padding: 24, boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}>
                <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 16, color: '#111827' }}>+ Quick Add Appointment</div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Title *</label>
                  <input value={newApptTitle} onChange={e => setNewApptTitle(e.target.value)}
                    placeholder="e.g. Follow-up visit"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Start</label>
                    <input type="time" value={newApptTime} onChange={e => setNewApptTime(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>End</label>
                    <input type="time" value={newApptEndTime} onChange={e => setNewApptEndTime(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setShowAddApptModal(false)}
                    style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#fff', color: '#374151', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
                    Cancel
                  </button>
                  <button onClick={handleQuickAddAppt} disabled={addingAppt || !newApptTitle.trim()}
                    style={{ flex: 2, padding: '10px 0', borderRadius: 10, border: 'none', background: '#0d9488', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14, opacity: addingAppt ? 0.7 : 1 }}>
                    {addingAppt ? 'Saving…' : 'Book for Today'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Appointment Detail/Edit/Delete Modal */}
        {selectedAppt && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ background: APPT_TYPE_COLORS[selectedAppt.type]?.bg ?? '#e8f9f7', padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: APPT_TYPE_COLORS[selectedAppt.type]?.text ?? '#0d9488' }}>{selectedAppt.title}</div>
                <button onClick={() => setSelectedAppt(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}>✕</button>
              </div>
              {/* Details */}
              <div style={{ padding: '16px 20px' }}>
                {[
                  { label: 'Patient', value: selectedAppt.patientName || '—' },
                  { label: 'Time', value: `${formatApptTime(selectedAppt.startTime)} – ${formatApptTime(selectedAppt.endTime)}` },
                  { label: 'Type', value: selectedAppt.type },
                  { label: 'Status', value: selectedAppt.status },
                  { label: 'Notes', value: selectedAppt.notes || '—' },
                ].map(r => (
                  <div key={r.label} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ width: 70, fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{r.label}</div>
                    <div style={{ fontSize: 14, color: '#111827' }}>{r.value}</div>
                  </div>
                ))}
              </div>
              {/* Actions */}
              <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    const t = selectedAppt;
                    setEditApptTitle(t.title);
                    setEditApptStart(t.startTime ? new Date(t.startTime).toISOString().slice(0,16) : '');
                    setEditApptEnd(t.endTime ? new Date(t.endTime).toISOString().slice(0,16) : '');
                    setEditApptNotes(t.notes || '');
                    setEditingAppt(t);
                    setSelectedAppt(null);
                  }}
                  style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  ✏️ Edit
                </button>
                <button
                  disabled={deletingApptId === selectedAppt.id}
                  onClick={async () => {
                    if (!confirm('Delete this appointment?')) return;
                    setDeletingApptId(selectedAppt.id);
                    await fetch(`/api/iat-appointments/${selectedAppt.id}`, { method: 'DELETE' });
                    setTodayAppts(prev => prev.filter(a => a.id !== selectedAppt.id));
                    setSelectedAppt(null);
                    setDeletingApptId(null);
                  }}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#fef2f2', color: '#b91c1c', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {deletingApptId === selectedAppt.id ? '⏳' : '🗑️ Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Inline Edit Appointment Modal */}
        {editingAppt && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>✏️ Edit Appointment</div>
                <button onClick={() => setEditingAppt(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}>✕</button>
              </div>
              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Title</label>
                  <input className="form-input" value={editApptTitle} onChange={e => setEditApptTitle(e.target.value)} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Start</label>
                    <input className="form-input" type="datetime-local" value={editApptStart} onChange={e => setEditApptStart(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>End</label>
                    <input className="form-input" type="datetime-local" value={editApptEnd} onChange={e => setEditApptEnd(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Notes</label>
                  <textarea className="form-input" rows={2} value={editApptNotes} onChange={e => setEditApptNotes(e.target.value)} style={{ resize: 'vertical' }} />
                </div>
              </div>
              <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setEditingAppt(null)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Cancel</button>
                <button disabled={savingAppt} onClick={async () => {
                  setSavingAppt(true);
                  await fetch(`/api/iat-appointments/${editingAppt.id}`, {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: editApptTitle, startTime: editApptStart, endTime: editApptEnd, notes: editApptNotes }),
                  });
                  setSavingAppt(false); setEditingAppt(null);
                  const today = new Date().toISOString().split('T')[0];
                  fetch(`/api/iat-appointments?date=${today}`).then(r => r.json()).then(d => setTodayAppts(d.appointments ?? d ?? []));
                }}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#0d9488', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                  {savingAppt ? '⏳' : '💾 Save'}
                </button>
              </div>
            </div>
          </div>
        )}

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
