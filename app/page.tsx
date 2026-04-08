'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import type { Layout } from 'react-grid-layout';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ResponsiveGridLayout = dynamic(
  () => import('react-grid-layout').then((m: any) => m.WidthProvider(m.Responsive)),
  { ssr: false }
) as React.ComponentType<any>; // WidthProvider wraps Responsive — type as any for flexibility

const DASHBOARD_LAYOUT_KEY = 'iat-dashboard-layout-v2';

const DEFAULT_LAYOUTS = {
  lg: [
    { i: 'kpi-patients',   x: 0, y: 0,  w: 3,  h: 4  },
    { i: 'kpi-waiting',    x: 3, y: 0,  w: 3,  h: 4  },
    { i: 'kpi-inservice',  x: 6, y: 0,  w: 3,  h: 4  },
    { i: 'kpi-encounters', x: 9, y: 0,  w: 3,  h: 4  },
    { i: 'waiting-room',   x: 0, y: 4,  w: 8,  h: 12 },
    { i: 'appointments',   x: 8, y: 4,  w: 4,  h: 12 },
    { i: 'quick-actions',  x: 0, y: 16, w: 6,  h: 10 },
    { i: 'system-status',  x: 6, y: 16, w: 6,  h: 10 },
  ],
  md: [
    { i: 'kpi-patients',   x: 0, y: 0,  w: 5,  h: 4  },
    { i: 'kpi-waiting',    x: 5, y: 0,  w: 5,  h: 4  },
    { i: 'kpi-inservice',  x: 0, y: 4,  w: 5,  h: 4  },
    { i: 'kpi-encounters', x: 5, y: 4,  w: 5,  h: 4  },
    { i: 'waiting-room',   x: 0, y: 8,  w: 10, h: 12 },
    { i: 'appointments',   x: 0, y: 20, w: 10, h: 10 },
    { i: 'quick-actions',  x: 0, y: 30, w: 5,  h: 10 },
    { i: 'system-status',  x: 5, y: 30, w: 5,  h: 10 },
  ],
  sm: [
    { i: 'kpi-patients',   x: 0, y: 0,  w: 3,  h: 4  },
    { i: 'kpi-waiting',    x: 3, y: 0,  w: 3,  h: 4  },
    { i: 'kpi-inservice',  x: 0, y: 4,  w: 3,  h: 4  },
    { i: 'kpi-encounters', x: 3, y: 4,  w: 3,  h: 4  },
    { i: 'waiting-room',   x: 0, y: 8,  w: 6,  h: 12 },
    { i: 'appointments',   x: 0, y: 20, w: 6,  h: 10 },
    { i: 'quick-actions',  x: 0, y: 30, w: 6,  h: 10 },
    { i: 'system-status',  x: 0, y: 40, w: 6,  h: 10 },
  ],
};

function loadLayouts() {
  try {
    const saved = localStorage.getItem(DASHBOARD_LAYOUT_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return DEFAULT_LAYOUTS;
}

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
  'allergy-test':  { bg: '#e8f9f7', text: '#0d9488' },
  'consultation':  { bg: '#eff6ff', text: '#1d4ed8' },
  'follow-up':     { bg: '#f5f3ff', text: '#7c3aed' },
};

function formatApptTime(iso: string) {
  const d = new Date(iso);
  const h = d.getHours() % 12 || 12;
  const m = d.getMinutes();
  const ampm = d.getHours() >= 12 ? 'pm' : 'am';
  return m > 0 ? `${h}:${String(m).padStart(2, '0')}${ampm}` : `${h}${ampm}`;
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

// Card wrapper used for each grid tile
function GridCard({
  title,
  editMode,
  children,
  headerRight,
}: {
  title: React.ReactNode;
  editMode: boolean;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
}) {
  return (
    <div
      className="card"
      style={{
        height: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        border: editMode ? '2px dashed #f59e0b' : '1px solid #e2e8f0',
        transition: 'border 0.2s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {editMode && (
            <span
              className="drag-handle"
              style={{ cursor: 'grab', fontSize: 18, color: '#94a3b8', userSelect: 'none', lineHeight: 1 }}
              title="Drag to move"
            >
              ⠿
            </span>
          )}
          <div className="card-title" style={{ margin: 0 }}>{title}</div>
        </div>
        {headerRight}
      </div>
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {children}
      </div>
    </div>
  );
}

// Minimal KPI tile (no header chrome — just icon + label + value)
function KpiTile({
  icon,
  label,
  value,
  accent,
  editMode,
  loading,
}: {
  icon: string;
  label: string;
  value: React.ReactNode;
  accent?: string;
  editMode: boolean;
  loading?: boolean;
}) {
  return (
    <div
      className="kpi-card"
      style={{
        height: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderTop: accent ? `4px solid ${accent}` : undefined,
        border: editMode ? '2px dashed #f59e0b' : undefined,
        transition: 'border 0.2s',
        position: 'relative',
      }}
    >
      {editMode && (
        <span
          className="drag-handle"
          style={{ position: 'absolute', top: 6, left: 8, cursor: 'grab', fontSize: 16, color: '#94a3b8', userSelect: 'none' }}
          title="Drag to move"
        >
          ⠿
        </span>
      )}
      <div className="kpi-icon">{icon}</div>
      <div className="kpi-label">{label}</div>
      {loading ? <div className="spinner" /> : <div className="kpi-value">{value}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const [patientCount, setPatientCount] = useState<number | null>(null);
  const [encounterCount, setEncounterCount] = useState<number | null>(null);
  const [nurseCount, setNurseCount] = useState<number | null>(null);
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);
  const [waiting, setWaiting] = useState<WaitingEntry[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [layouts, setLayouts] = useState(DEFAULT_LAYOUTS);
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [quickLogEntry, setQuickLogEntry] = useState<WaitingEntry | null>(null);
  const [quickLogForm, setQuickLogForm] = useState({ activityType: 'note', notes: '' });
  const [quickLogSaving, setQuickLogSaving] = useState(false);
  const [todayAppts, setTodayAppts] = useState<TodayAppointment[]>([]);
  const [selectedAppt, setSelectedAppt] = useState<TodayAppointment | null>(null);
  const [editingAppt, setEditingAppt] = useState<TodayAppointment | null>(null);
  const [editApptTitle, setEditApptTitle] = useState('');
  const [editApptDate, setEditApptDate] = useState('');
  const [editApptStartHour, setEditApptStartHour] = useState('09');
  const [editApptStartMin, setEditApptStartMin] = useState('00');
  const [editApptEndHour, setEditApptEndHour] = useState('10');
  const [editApptEndMin, setEditApptEndMin] = useState('00');
  const [editApptPatientId, setEditApptPatientId] = useState('');
  const [editApptPatientName, setEditApptPatientName] = useState('');
  const [editApptReasonId, setEditApptReasonId] = useState('');
  const [editApptNotes, setEditApptNotes] = useState('');
  const [editApptPatients, setEditApptPatients] = useState<{ id: string; name: string }[]>([]);
  const [editApptReasons, setEditApptReasons] = useState<{ id: string; name: string; color: string }[]>([]);
  const [savingAppt, setSavingAppt] = useState(false);
  const [deletingApptId, setDeletingApptId] = useState<string | null>(null);
  const [showAddApptModal, setShowAddApptModal] = useState(false);
  const [newApptTitle, setNewApptTitle] = useState('');
  const [newApptTime, setNewApptTime] = useState('09:00');
  const [newApptEndTime, setNewApptEndTime] = useState('10:00');
  const [addingAppt, setAddingAppt] = useState(false);

  // unused ref kept to satisfy linter (was used in old drag logic)
  const _dragRef = useRef<string | null>(null);

  const loadWaiting = useCallback(async () => {
    try {
      const r = await fetch('/api/waiting-room');
      const d = await r.json();
      setWaiting(d.entries ?? []);
    } catch {}
  }, []);

  // Load saved layouts on mount
  useEffect(() => {
    setLayouts(loadLayouts());
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
        fetch('/api/encounters?limit=100').then(r => r.json()).then(d => {
          const today = new Date().toDateString();
          setEncounterCount((d.encounters ?? []).filter((e: { encounterDate: string }) => new Date(e.encounterDate).toDateString() === today).length);
        });
      } catch {}
      finally { setLoading(false); }
    }
    loadData();
    loadWaiting();
    const interval = setInterval(loadWaiting, 10000);
    return () => clearInterval(interval);
  }, [loadWaiting]);

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

  function handleLayoutChange(_layout: Layout[], allLayouts: Record<string, Layout[]>) {
    if (typeof window === 'undefined') return;
    setLayouts(allLayouts as unknown as typeof DEFAULT_LAYOUTS);
    localStorage.setItem(DASHBOARD_LAYOUT_KEY, JSON.stringify(allLayouts));
  }

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

  async function handleQuickLog() {
    if (!quickLogEntry) return;
    setQuickLogSaving(true);
    await fetch('/api/encounter-activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: quickLogEntry.patientId,
        activityType: quickLogForm.activityType,
        notes: quickLogForm.notes,
        performedBy: quickLogEntry.nurseName ?? '',
      }),
    });
    setQuickLogSaving(false);
    setQuickLogEntry(null);
    setQuickLogForm({ activityType: 'note', notes: '' });
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

  // Suppress unused ref warning
  void _dragRef;

  return (
    <>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <div className="page-title">{userName ? `Welcome, ${userName}` : 'Dashboard'}</div>
          <div className="page-subtitle">{today}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/patients/new" className="btn-secondary btn-sm btn">+ Register Patient</Link>
          <Link href="/testing" className="btn btn-sm">🧪 Start Testing</Link>
          <button
            onClick={() => setEditMode(v => !v)}
            style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${editMode ? '#f59e0b' : '#e2e8f0'}`, background: editMode ? '#fefce8' : '#fff', color: editMode ? '#b45309' : '#374151', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            {editMode ? '✅ Done' : '⊞ Edit Layout'}
          </button>
          <Link href="/calendar?action=new" className="btn btn-sm" style={{ background: '#7c3aed', color: '#fff' }}>📅 Book Appointment</Link>
        </div>
      </div>

      {/* ── Page Body ── */}
      <div className="page-body" style={{ padding: '0 24px 24px' }}>
        {editMode && (
          <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 16px', marginBottom: 8, fontSize: 13, color: '#92400e', fontWeight: 600 }}>
            ⊞ Drag tiles to move · Drag corner to resize · Click <strong>✅ Done</strong> when finished
          </div>
        )}

        <ResponsiveGridLayout
          className="layout"
          layouts={layouts}
          onLayoutChange={handleLayoutChange}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={30}
          isDraggable={editMode}
          isResizable={editMode}
          draggableHandle=".drag-handle"
          margin={[16, 16]}
          containerPadding={[0, 0]}
        >
          {/* ── KPI: Total Patients ── */}
          <div key="kpi-patients">
            <KpiTile
              icon="👥"
              label="Total Patients"
              value={patientCount ?? 0}
              editMode={editMode}
              loading={loading}
            />
          </div>

          {/* ── KPI: Waiting ── */}
          <div key="kpi-waiting">
            <KpiTile
              icon="⏳"
              label="Waiting"
              accent="#f59e0b"
              value={<span style={{ color: waitingCount > 0 ? '#b45309' : '#64748b' }}>{waitingCount}</span>}
              editMode={editMode}
            />
          </div>

          {/* ── KPI: In Service ── */}
          <div key="kpi-inservice">
            <KpiTile
              icon="🩺"
              label="In Service"
              accent="#0d9488"
              value={<span style={{ color: inServiceCount > 0 ? '#0d9488' : '#64748b' }}>{inServiceCount}</span>}
              editMode={editMode}
            />
          </div>

          {/* ── KPI: Today's Encounters ── */}
          <div key="kpi-encounters">
            <KpiTile
              icon="🏥"
              label="Today's Encounters"
              value={encounterCount ?? 0}
              editMode={editMode}
            />
          </div>

          {/* ── Waiting Room Board ── */}
          <div key="waiting-room">
            <GridCard
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  🏥 Waiting Room
                  <span style={{ fontSize: 11, color: '#0d9488', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#0d9488', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                    Live · refreshes every 10s
                  </span>
                </div>
              }
              editMode={editMode}
              headerRight={
                <button
                  onClick={loadWaiting}
                  style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  ↻ Now
                </button>
              }
            >
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
                            <select
                              onChange={ev => ev.target.value && updateStatus(e.id, 'in-service', ev.target.value)}
                              defaultValue=""
                              style={{ fontSize: 13, padding: '4px 8px', borderRadius: 6, border: '1px solid #e2e8f0', cursor: 'pointer' }}
                            >
                              <option value="">— Call Patient —</option>
                              {nurses.map(n => <option key={n.id} value={n.name}>{n.title ? `${n.title} ${n.name}` : n.name}</option>)}
                            </select>
                          ) : (
                            <span style={{ fontWeight: 600, color: '#0d9488' }}>{e.nurseName ?? '—'}</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {e.status === 'in-service' && (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                onClick={() => { setQuickLogEntry(e); setQuickLogForm({ activityType: 'note', notes: '' }); }}
                                style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #0d9488', background: '#fff', color: '#0d9488', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                              >
                                + Log
                              </button>
                              <button
                                onClick={() => updateStatus(e.id, 'complete')}
                                disabled={updatingId === e.id}
                                style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#0055A5', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                              >
                                {updatingId === e.id ? '⏳' : '✅ Complete'}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </GridCard>
          </div>

          {/* ── Today's Schedule ── */}
          <div key="appointments">
            <GridCard
              title="📅 Today's Schedule"
              editMode={editMode}
              headerRight={
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    onClick={() => setShowAddApptModal(true)}
                    style={{ padding: '5px 14px', borderRadius: 8, border: 'none', background: '#0d9488', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                  >
                    + Add
                  </button>
                  <Link
                    href="/calendar"
                    style={{ padding: '5px 14px', borderRadius: 8, border: '1px solid #0d9488', color: '#0d9488', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}
                  >
                    Full →
                  </Link>
                </div>
              }
            >
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
                      <div
                        key={appt.id}
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
            </GridCard>
          </div>

          {/* ── Quick Actions ── */}
          <div key="quick-actions">
            <GridCard title="Quick Actions" editMode={editMode}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { href: '/patients/new', label: '👤 Register New Patient' },
                  { href: '/testing',      label: '🧪 Start Testing' },
                  { href: '/patients',     label: '👥 View All Patients' },
                  { href: '/kiosk',        label: '📲 Open Patient Kiosk', target: '_blank' },
                  { href: '/doctors',      label: '👨‍⚕️ Manage Doctors' },
                  { href: '/nurses',       label: '👩‍⚕️ Manage Nurses' },
                ].map(a => (
                  <a
                    key={a.href}
                    href={a.href}
                    target={a.target}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#374151', fontSize: 15, fontWeight: 600, textDecoration: 'none' }}
                  >
                    {a.label}
                  </a>
                ))}
              </div>
            </GridCard>
          </div>

          {/* ── System Status ── */}
          <div key="system-status">
            <GridCard title="System Status" editMode={editMode}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { label: 'Patient Kiosk',    status: 'Online',                             icon: '📲' },
                  { label: 'API Server',        status: 'Operational',                        icon: '🟢' },
                  { label: 'Database',          status: 'Operational',                        icon: '🟢' },
                  { label: 'Waiting Room',      status: `${waitingCount + inServiceCount} active`, icon: '🏥' },
                  { label: 'Auth Service',      status: 'Operational',                        icon: '🟢' },
                  { label: 'HIPAA Compliance',  status: 'Active',                             icon: '🔐' },
                ].map(s => (
                  <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: 14, color: '#374151' }}>{s.icon} {s.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 999, background: '#e8f9f7', color: '#0d9488' }}>{s.status}</span>
                  </div>
                ))}
              </div>
            </GridCard>
          </div>
        </ResponsiveGridLayout>
      </div>

      {/* ── Quick-add Appointment Modal ── */}
      {showAddApptModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 400, padding: 24, boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 16, color: '#111827' }}>+ Quick Add Appointment</div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Title *</label>
              <input
                value={newApptTitle}
                onChange={e => setNewApptTitle(e.target.value)}
                placeholder="e.g. Follow-up visit"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Start</label>
                <input type="time" value={newApptTime} onChange={e => setNewApptTime(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>End</label>
                <input type="time" value={newApptEndTime} onChange={e => setNewApptEndTime(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowAddApptModal(false)} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#fff', color: '#374151', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>Cancel</button>
              <button
                onClick={handleQuickAddAppt}
                disabled={addingAppt || !newApptTitle.trim()}
                style={{ flex: 2, padding: '10px 0', borderRadius: 10, border: 'none', background: '#0d9488', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14, opacity: addingAppt ? 0.7 : 1 }}
              >
                {addingAppt ? 'Saving…' : 'Book for Today'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Appointment Detail Modal ── */}
      {selectedAppt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
            <div style={{ background: APPT_TYPE_COLORS[selectedAppt.type]?.bg ?? '#e8f9f7', padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: APPT_TYPE_COLORS[selectedAppt.type]?.text ?? '#0d9488' }}>{selectedAppt.title}</div>
              <button onClick={() => setSelectedAppt(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>
            <div style={{ padding: '16px 20px' }}>
              {[
                { label: 'Patient', value: selectedAppt.patientName || '—' },
                { label: 'Time',    value: `${formatApptTime(selectedAppt.startTime)} – ${formatApptTime(selectedAppt.endTime)}` },
                { label: 'Type',    value: selectedAppt.type },
                { label: 'Status',  value: selectedAppt.status },
                { label: 'Notes',   value: selectedAppt.notes || '—' },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ width: 70, fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{r.label}</div>
                  <div style={{ fontSize: 14, color: '#111827' }}>{r.value}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={async () => {
                  const t = selectedAppt;
                  const start = t.startTime ? new Date(t.startTime) : new Date();
                  const end   = t.endTime   ? new Date(t.endTime)   : new Date();
                  setEditApptTitle(t.title);
                  setEditApptDate(start.toISOString().split('T')[0]);
                  setEditApptStartHour(String(start.getHours()).padStart(2, '0'));
                  setEditApptStartMin(String(start.getMinutes()).padStart(2, '0'));
                  setEditApptEndHour(String(end.getHours()).padStart(2, '0'));
                  setEditApptEndMin(String(end.getMinutes()).padStart(2, '0'));
                  setEditApptPatientId(t.patientId || '');
                  setEditApptPatientName(t.patientName || '');
                  setEditApptReasonId(t.type || '');
                  setEditApptNotes(t.notes || '');
                  setEditingAppt(t);
                  setSelectedAppt(null);
                  const [pRes, rRes] = await Promise.allSettled([
                    fetch('/api/patients').then(r => r.json()),
                    fetch('/api/appointment-reasons').then(r => r.json()),
                  ]);
                  if (pRes.status === 'fulfilled') setEditApptPatients(Array.isArray(pRes.value) ? pRes.value : pRes.value.patients ?? []);
                  if (rRes.status === 'fulfilled') setEditApptReasons(rRes.value.reasons ?? []);
                }}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
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
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#fef2f2', color: '#b91c1c', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                {deletingApptId === selectedAppt.id ? '⏳' : '🗑️ Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Inline Edit Appointment Modal ── */}
      {editingAppt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>✏️ Edit Appointment</div>
              <button onClick={() => setEditingAppt(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Patient *</label>
                <select className="form-input" value={editApptPatientId} onChange={e => { const p = editApptPatients.find(x => x.id === e.target.value); setEditApptPatientId(e.target.value); setEditApptPatientName(p?.name ?? ''); }}>
                  <option value="">— Select Patient —</option>
                  {editApptPatients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Reason</label>
                <select className="form-input" value={editApptReasonId} onChange={e => setEditApptReasonId(e.target.value)}>
                  <option value="">— Select Reason —</option>
                  {editApptReasons.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Title</label>
                <input className="form-input" value={editApptTitle} onChange={e => setEditApptTitle(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Date</label>
                <input className="form-input" type="date" value={editApptDate} onChange={e => setEditApptDate(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Start Time</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <select className="form-input" value={editApptStartHour} onChange={e => setEditApptStartHour(e.target.value)}>
                      {Array.from({ length: 12 }, (_, i) => i + 7).map(h => <option key={h} value={String(h).padStart(2, '0')}>{h > 12 ? `${h - 12}PM` : h === 12 ? '12PM' : `${h}AM`}</option>)}
                    </select>
                    <select className="form-input" value={editApptStartMin} onChange={e => setEditApptStartMin(e.target.value)}>
                      {['00', '15', '30', '45'].map(m => <option key={m} value={m}>:{m}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>End Time</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <select className="form-input" value={editApptEndHour} onChange={e => setEditApptEndHour(e.target.value)}>
                      {Array.from({ length: 12 }, (_, i) => i + 7).map(h => <option key={h} value={String(h).padStart(2, '0')}>{h > 12 ? `${h - 12}PM` : h === 12 ? '12PM' : `${h}AM`}</option>)}
                    </select>
                    <select className="form-input" value={editApptEndMin} onChange={e => setEditApptEndMin(e.target.value)}>
                      {['00', '15', '30', '45'].map(m => <option key={m} value={m}>:{m}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Notes</label>
                <textarea className="form-input" rows={2} value={editApptNotes} onChange={e => setEditApptNotes(e.target.value)} style={{ resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditingAppt(null)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Cancel</button>
              <button
                disabled={savingAppt}
                onClick={async () => {
                  setSavingAppt(true);
                  const startIso = `${editApptDate}T${editApptStartHour}:${editApptStartMin}:00`;
                  const endIso   = `${editApptDate}T${editApptEndHour}:${editApptEndMin}:00`;
                  const reason   = editApptReasons.find(r => r.id === editApptReasonId);
                  await fetch(`/api/iat-appointments/${editingAppt.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      title: editApptTitle, startTime: startIso, endTime: endIso,
                      patientId: editApptPatientId, patientName: editApptPatientName,
                      type: reason?.name || editApptReasonId, notes: editApptNotes,
                    }),
                  });
                  setSavingAppt(false);
                  setEditingAppt(null);
                  const todayDate = new Date().toISOString().split('T')[0];
                  fetch(`/api/iat-appointments?date=${todayDate}`).then(r => r.json()).then(d => setTodayAppts(d.appointments ?? d ?? []));
                }}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#0d9488', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}
              >
                {savingAppt ? '⏳' : '💾 Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Quick Log Activity Modal ── */}
      {quickLogEntry && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>📝 Log Activity — {quickLogEntry.patientName}</h2>
              <button onClick={() => setQuickLogEntry(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Activity Type</label>
                <select
                  value={quickLogForm.activityType}
                  onChange={e => setQuickLogForm(p => ({ ...p, activityType: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 14 }}
                >
                  {[
                    { value: 'shot',                     label: '💊 Shot / Injection' },
                    { value: 'shot_maintenance',         label: '💉 Maintenance Shot' },
                    { value: 'allergy_test',             label: '🧪 Allergy Test (Prick)' },
                    { value: 'allergy_test_intradermal', label: '🔬 Allergy Test (Intradermal)' },
                    { value: 'consent_signed',           label: '📋 Consent Signed' },
                    { value: 'video_education',          label: '🎬 Video Watched' },
                    { value: 'phone_call',               label: '📞 Phone Call' },
                    { value: 'telehealth',               label: '💻 Telehealth Visit' },
                    { value: 'email',                    label: '📧 Email' },
                    { value: 'in_person_visit',          label: '🏥 In-Person Visit' },
                    { value: 'appointment_scheduled',    label: '📅 Appointment Scheduled' },
                    { value: 'no_show',                  label: '❌ No Show' },
                    { value: 'note',                     label: '📝 Note' },
                    { value: 'lab_order',                label: '🔬 Lab Order' },
                    { value: 'referral',                 label: '🔗 Referral' },
                    { value: 'prescription',             label: '📃 Prescription' },
                  ].map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Brief Notes</label>
                <textarea
                  rows={3}
                  value={quickLogForm.notes}
                  onChange={e => setQuickLogForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Optional notes…"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setQuickLogEntry(null)} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button
                onClick={handleQuickLog}
                disabled={quickLogSaving}
                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#0d9488', color: '#fff', cursor: 'pointer', fontWeight: 700 }}
              >
                {quickLogSaving ? '⏳ Saving…' : '💾 Log Activity'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
