'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { Layout } from 'react-grid-layout';
import type { ResponsiveLayouts } from 'react-grid-layout';

const DashboardGrid = dynamic(() => import('@/components/DashboardGrid'), { ssr: false });

const LAYOUT_KEY = 'iat-dashboard-layout-v3';

const DEFAULT_LAYOUTS: ResponsiveLayouts = {
  lg: [
    { i: 'kpi-patients',   x: 0,  y: 0,  w: 3, h: 4,  minW: 2, minH: 3 },
    { i: 'kpi-waiting',    x: 3,  y: 0,  w: 3, h: 4,  minW: 2, minH: 3 },
    { i: 'kpi-inservice',  x: 6,  y: 0,  w: 3, h: 4,  minW: 2, minH: 3 },
    { i: 'kpi-encounters', x: 9,  y: 0,  w: 3, h: 4,  minW: 2, minH: 3 },
    { i: 'waiting-room',   x: 0,  y: 4,  w: 8, h: 16, minW: 4, minH: 8 },
    { i: 'appointments',   x: 8,  y: 4,  w: 4, h: 16, minW: 3, minH: 6 },
    { i: 'quick-actions',  x: 0,  y: 20, w: 6, h: 10, minW: 3, minH: 5 },
    { i: 'system-status',  x: 6,  y: 20, w: 6, h: 10, minW: 3, minH: 5 },
  ],
  md: [
    { i: 'kpi-patients',   x: 0, y: 0,  w: 5,  h: 4 },
    { i: 'kpi-waiting',    x: 5, y: 0,  w: 5,  h: 4 },
    { i: 'kpi-inservice',  x: 0, y: 4,  w: 5,  h: 4 },
    { i: 'kpi-encounters', x: 5, y: 4,  w: 5,  h: 4 },
    { i: 'waiting-room',   x: 0, y: 8,  w: 10, h: 14 },
    { i: 'appointments',   x: 0, y: 22, w: 10, h: 10 },
    { i: 'quick-actions',  x: 0, y: 32, w: 5,  h: 10 },
    { i: 'system-status',  x: 5, y: 32, w: 5,  h: 10 },
  ],
  sm: [
    { i: 'kpi-patients',   x: 0, y: 0,  w: 3, h: 4 },
    { i: 'kpi-waiting',    x: 3, y: 0,  w: 3, h: 4 },
    { i: 'kpi-inservice',  x: 0, y: 4,  w: 3, h: 4 },
    { i: 'kpi-encounters', x: 3, y: 4,  w: 3, h: 4 },
    { i: 'waiting-room',   x: 0, y: 8,  w: 6, h: 14 },
    { i: 'appointments',   x: 0, y: 22, w: 6, h: 10 },
    { i: 'quick-actions',  x: 0, y: 32, w: 6, h: 10 },
    { i: 'system-status',  x: 0, y: 42, w: 6, h: 10 },
  ],
};

function loadLayouts(): ResponsiveLayouts {
  try {
    const saved = localStorage.getItem(LAYOUT_KEY);
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
  const [encounterCount, setEncounterCount] = useState<number | null>(null);
  const [nurseCount, setNurseCount] = useState<number | null>(null);
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);
  const [waiting, setWaiting] = useState<WaitingEntry[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [gridLayouts, setGridLayouts] = useState<ResponsiveLayouts>(DEFAULT_LAYOUTS);

  function handleGridLayoutChange(_layout: Layout, allLayouts: ResponsiveLayouts) {
    setGridLayouts(allLayouts);
    try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(allLayouts)); } catch {}
  }
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
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
  const [editApptPatients, setEditApptPatients] = useState<{id: string; name: string}[]>([]);
  const [editApptReasons, setEditApptReasons] = useState<{id: string; name: string; color: string}[]>([]);
  const [serviceColors, setServiceColors] = useState<Record<string, string>>({});
  const [savingAppt, setSavingAppt] = useState(false);
  const [deletingApptId, setDeletingApptId] = useState<string | null>(null);
  const [showAddApptModal, setShowAddApptModal] = useState(false);
  const [newApptTitle, setNewApptTitle] = useState('');
  const [newApptTime, setNewApptTime] = useState('09:00');
  const [newApptEndTime, setNewApptEndTime] = useState('10:00');
  const [addingAppt, setAddingAppt] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const getActiveLocation = useCallback(() => {
    try { return localStorage.getItem('iat_active_location') ?? ''; } catch { return ''; }
  }, []);

  const loadWaiting = useCallback(async () => {
    try {
      const locId = getActiveLocation();
      const url = locId ? `/api/waiting-room?locationId=${locId}` : '/api/waiting-room';
      const r = await fetch(url);
      if (!r.ok) throw new Error(r.status === 401 ? 'session_expired' : `HTTP ${r.status}`);
      const d = await r.json();
      setWaiting(d.entries ?? []);
    } catch (err) {
      const msg = (err as Error).message;
      console.error('[Dashboard] waitingRoom fetch error:', msg);
      setLoadError(msg === 'session_expired' ? 'Session expired — please refresh and log in again' : `Failed to load waiting room: ${msg}`);
    }
  }, [getActiveLocation]);

  // Re-fetch when location changes
  useEffect(() => {
    function onLocationChange() {
      loadWaiting();
      // Re-run the full data load
      const ev = new Event('iat-reload-dashboard');
      window.dispatchEvent(ev);
    }
    window.addEventListener('locationchange', onLocationChange);
    return () => window.removeEventListener('locationchange', onLocationChange);
  }, [loadWaiting]);

  useEffect(() => {
    async function loadData() {
      try {
        const locId = getActiveLocation();
        const locParam = locId ? `&locationId=${locId}` : '';
        const todayStr = new Date().toISOString().split('T')[0]
        const [patientsRes, , nursesRes, meRes, encounterCountRes, reasonsRes] = await Promise.allSettled([
          fetch(`/api/patients${locId ? `?locationId=${locId}` : ''}`),
          fetch('/api/doctors'),
          fetch('/api/nurses'),
          fetch('/api/auth/me'),
          fetch(`/api/encounters/count?date=${todayStr}${locParam}`),
          fetch('/api/appointment-reasons'),
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
        // Use fast count endpoint — no need to fetch 100 encounters client-side
        if (encounterCountRes.status === 'fulfilled' && encounterCountRes.value.ok) {
          const d = await encounterCountRes.value.json();
          setEncounterCount(d.count ?? 0);
        } else {
          setEncounterCount(0);
        }
        if (reasonsRes.status === 'fulfilled' && reasonsRes.value.ok) {
          const d = await reasonsRes.value.json();
          const reasons: {name: string; color: string}[] = d.reasons ?? [];
          const colorMap: Record<string, string> = {};
          reasons.forEach(r => { colorMap[r.name] = r.color; });
          setServiceColors(colorMap);
        }
      } catch {}
      finally { setLoading(false); }
    }
    loadData();
    loadWaiting();
    setGridLayouts(loadLayouts());
    // Auto-refresh waiting room every 10s
    const interval = setInterval(loadWaiting, 10000);
    // Also listen for manual dashboard reload trigger
    function onReload() { loadData(); }
    window.addEventListener('iat-reload-dashboard', onReload);
    return () => {
      clearInterval(interval);
      window.removeEventListener('iat-reload-dashboard', onReload);
    };
  }, [loadWaiting, getActiveLocation]);

  // Load today's appointments (location-aware)
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const locId = getActiveLocation();
    const url = `/api/iat-appointments?date=${today}${locId ? `&locationId=${locId}` : ''}`;
    fetch(url)
      .then(async r => {
        if (!r.ok) throw new Error(r.status === 401 ? 'session_expired' : `HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        const arr: TodayAppointment[] = Array.isArray(data) ? data : [];
        const todayStr = new Date().toDateString();
        setTodayAppts(arr.filter(a => new Date(a.startTime).toDateString() === todayStr));
      })
      .catch(err => {
        console.error('[Dashboard] appointments fetch error:', err.message);
        setLoadError(err.message === 'session_expired' ? 'Session expired — please refresh and log in again' : `Failed to load appointments: ${err.message}`);
      });
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

  // ─── Tile content builders ───────────────────────────────────────────────

  const waitingRoomTile = (
    <div className="card" style={{ height: '100%', overflow: 'auto', border: editMode ? '2px dashed #f59e0b' : '1px solid #e2e8f0' }}>
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
                <th key={h} style={{ padding: '5px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {waiting.map(e => {
              const isNew = (Date.now() - new Date(e.checkedInAt).getTime()) < 5 * 60 * 1000;
              const rowBg = e.status === 'in-service' ? '#e8f9f7' : isNew ? '#fffbeb' : 'white';
              const rowBorder = isNew && e.status === 'waiting' ? '2px solid #f59e0b' : '1px solid #f1f5f9';
              return (
              <tr key={e.id} style={{ borderBottom: rowBorder, background: rowBg }}>
                <td style={{ padding: '5px 10px' }}>
                  <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                    {isNew && e.status === 'waiting' && <span style={{ fontSize: 9, background: '#f59e0b', color: '#fff', borderRadius: 4, padding: '1px 5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>NEW</span>}
                    {e.patientName}
                  </div>
                  {editingNoteId === e.id ? (
                    <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
                      <input
                        autoFocus
                        value={editingNoteText}
                        onChange={ev => setEditingNoteText(ev.target.value)}
                        onKeyDown={async ev => {
                          if (ev.key === 'Enter') {
                            await fetch(`/api/waiting-room/${e.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notes: editingNoteText }) });
                            setEditingNoteId(null);
                            loadWaiting();
                          } else if (ev.key === 'Escape') {
                            setEditingNoteId(null);
                          }
                        }}
                        placeholder="Reason for visit…"
                        style={{ fontSize: 11, padding: '2px 6px', border: '1px solid #0d9488', borderRadius: 5, width: 140, outline: 'none' }}
                      />
                      <button onClick={async () => {
                        await fetch(`/api/waiting-room/${e.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notes: editingNoteText }) });
                        setEditingNoteId(null);
                        loadWaiting();
                      }} style={{ fontSize: 10, padding: '2px 6px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer' }}>✓</button>
                    </div>
                  ) : (
                    <div
                      onClick={() => { setEditingNoteId(e.id); setEditingNoteText(e.notes ?? ''); }}
                      title="Click to add/edit reason for visit"
                      style={{ marginTop: 3, cursor: 'pointer' }}
                    >
                      {e.notes ? (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10,
                          background: serviceColors[e.notes] ? `${serviceColors[e.notes]}22` : '#f1f5f9',
                          color: serviceColors[e.notes] ?? '#64748b',
                          border: `1px solid ${serviceColors[e.notes] ?? '#e2e8f0'}`,
                          whiteSpace: 'nowrap',
                        }}>
                          {e.notes}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: '#cbd5e1', fontStyle: 'italic' }}>+ reason for visit</span>
                      )}
                    </div>
                  )}
                </td>
                <td style={{ padding: '5px 10px', color: '#64748b', fontSize: 12 }}>{waitTime(e.checkedInAt)}</td>
                <td style={{ padding: '5px 10px' }}>
                  {e.videoAckBy ? (
                    <div style={{ fontSize: 11, color: '#15803d', fontWeight: 700 }}>✅ {e.videosWatched ?? 0}</div>
                  ) : (e.videosWatched ?? 0) > 0 ? (
                    <button
                      onClick={async () => {
                        const ackBy = e.nurseName ?? 'Staff';
                        await fetch(`/api/waiting-room/${e.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoAckBy: ackBy }) });
                        loadWaiting();
                      }}
                      style={{ fontSize: 11, padding: '2px 7px', borderRadius: 6, border: '1px solid #fde68a', background: '#fefce8', cursor: 'pointer', color: '#92400e', fontWeight: 700, whiteSpace: 'nowrap' }}
                    >
                      📺 {e.videosWatched} ✓
                    </button>
                  ) : (
                    <span style={{ color: '#d1d5db', fontSize: 11 }}>—</span>
                  )}
                </td>
                <td style={{ padding: '5px 10px' }}>
                  <span style={{
                    fontWeight: 700, fontSize: 11, padding: '2px 8px', borderRadius: 999,
                    background: e.status === 'waiting' ? '#fef9c3' : '#d1fae5',
                    color: e.status === 'waiting' ? '#b45309' : '#065f46',
                  }}>
                    {e.status === 'waiting' ? '⏳ Waiting' : '🩺 In Service'}
                  </span>
                </td>
                <td style={{ padding: '5px 10px', color: '#64748b', fontSize: 12 }}>
                  {e.status === 'waiting' ? (
                    <select onChange={ev => ev.target.value && updateStatus(e.id, 'in-service', ev.target.value)}
                      defaultValue=""
                      style={{ fontSize: 12, padding: '2px 6px', borderRadius: 6, border: '1px solid #e2e8f0', cursor: 'pointer' }}>
                      <option value="">— Call Patient —</option>
                      {nurses.map(n => <option key={n.id} value={n.name}>{n.title ? `${n.title} ${n.name}` : n.name}</option>)}
                    </select>
                  ) : (
                    <span style={{ fontWeight: 600, color: '#0d9488' }}>{e.nurseName ?? '—'}</span>
                  )}
                </td>
                <td style={{ padding: '5px 10px' }}>
                  {e.status === 'in-service' && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => { setQuickLogEntry(e); setQuickLogForm({ activityType: 'note', notes: '' }); }}
                        style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid #0d9488', background: '#fff', color: '#0d9488', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        + Log
                      </button>
                      <button onClick={() => updateStatus(e.id, 'complete')}
                        disabled={updatingId === e.id}
                        style={{ padding: '3px 10px', borderRadius: 6, border: 'none', background: '#0055A5', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                        {updatingId === e.id ? '⏳' : '✅ Complete'}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );

  const appointmentsTile = (
    <div className="card" style={{ height: '100%', overflow: 'auto', border: editMode ? '2px dashed #f59e0b' : '1px solid #e2e8f0' }}>
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
    </div>
  );

  const quickActionsTile = (
    <div className="card" style={{ height: '100%', overflow: 'auto', border: editMode ? '2px dashed #f59e0b' : '1px solid #e2e8f0' }}>
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
  );

  const systemStatusTile = (
    <div className="card" style={{ height: '100%', overflow: 'auto', border: editMode ? '2px dashed #f59e0b' : '1px solid #e2e8f0' }}>
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
  );

  // Suppress unused warning
  void nurseCount;

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
          <button onClick={() => setEditMode(v => !v)}
            style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${editMode ? '#f59e0b' : '#e2e8f0'}`, background: editMode ? '#fefce8' : '#fff', color: editMode ? '#b45309' : '#374151', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {editMode ? '✅ Done' : '⊞ Edit Layout'}
          </button>
          <Link href="/calendar?action=new" className="btn btn-sm" style={{ background: '#7c3aed', color: '#fff' }}>📅 Book Appointment</Link>
        </div>
      </div>

      <div className="page-body">
        {loadError && (
          <div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:8,padding:'12px 16px',marginBottom:16,color:'#b91c1c',fontSize:13}}>
            🔐 {loadError}
            <button onClick={() => { setLoadError(null); loadWaiting(); }} style={{marginLeft:12,padding:'2px 10px',borderRadius:6,border:'1px solid #fecaca',background:'#fff',color:'#b91c1c',fontSize:12,cursor:'pointer',fontWeight:600}}>↻ Retry</button>
          </div>
        )}
        {editMode && (
          <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 16px', marginBottom: 8, fontSize: 13, color: '#92400e', fontWeight: 600 }}>
            ⊞ Drag tiles to move · Drag bottom-right corner to resize · Click <strong>&quot;✅ Done&quot;</strong> to save
          </div>
        )}
        <DashboardGrid
          layouts={gridLayouts}
          editMode={editMode}
          onLayoutChange={handleGridLayoutChange}
          tiles={[
            {
              id: 'kpi-patients',
              content: (
                <div className="kpi-card" style={{ height: '100%', border: editMode ? '2px dashed #f59e0b' : undefined }}>
                  <div className="kpi-icon">👥</div>
                  <div className="kpi-label">Total Patients</div>
                  {loading ? <div className="spinner" /> : <div className="kpi-value">{patientCount ?? 0}</div>}
                </div>
              ),
            },
            {
              id: 'kpi-waiting',
              content: (
                <div className="kpi-card" style={{ height: '100%', borderTop: '4px solid #f59e0b', border: editMode ? '2px dashed #f59e0b' : undefined }}>
                  <div className="kpi-icon">⏳</div>
                  <div className="kpi-label">Waiting</div>
                  <div className="kpi-value" style={{ color: waitingCount > 0 ? '#b45309' : '#64748b' }}>{waitingCount}</div>
                </div>
              ),
            },
            {
              id: 'kpi-inservice',
              content: (
                <div className="kpi-card" style={{ height: '100%', borderTop: '4px solid #0d9488', border: editMode ? '2px dashed #f59e0b' : undefined }}>
                  <div className="kpi-icon">🩺</div>
                  <div className="kpi-label">In Service</div>
                  <div className="kpi-value" style={{ color: inServiceCount > 0 ? '#0d9488' : '#64748b' }}>{inServiceCount}</div>
                </div>
              ),
            },
            {
              id: 'kpi-encounters',
              content: (
                <div className="kpi-card" style={{ height: '100%', border: editMode ? '2px dashed #f59e0b' : undefined }}>
                  <div className="kpi-icon">🏥</div>
                  <div className="kpi-label">Today&apos;s Encounters</div>
                  {loading ? <div className="spinner" /> : <div className="kpi-value">{encounterCount ?? 0}</div>}
                </div>
              ),
            },
            { id: 'waiting-room',  content: waitingRoomTile },
            { id: 'appointments',  content: appointmentsTile },
            { id: 'quick-actions', content: quickActionsTile },
            { id: 'system-status', content: systemStatusTile },
          ]}
        />
      </div>

      {/* Quick-add appointment modal (fixed overlay) */}
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
                onClick={async () => {
                  const t = selectedAppt;
                  const start = t.startTime ? new Date(t.startTime) : new Date();
                  const end = t.endTime ? new Date(t.endTime) : new Date();
                  setEditApptTitle(t.title);
                  setEditApptDate(start.toISOString().split('T')[0]);
                  setEditApptStartHour(String(start.getHours()).padStart(2,'0'));
                  setEditApptStartMin(String(start.getMinutes()).padStart(2,'0'));
                  setEditApptEndHour(String(end.getHours()).padStart(2,'0'));
                  setEditApptEndMin(String(end.getMinutes()).padStart(2,'0'));
                  setEditApptPatientId(t.patientId || '');
                  setEditApptPatientName(t.patientName || '');
                  setEditApptReasonId(t.type || '');
                  setEditApptNotes(t.notes || '');
                  setEditingAppt(t);
                  setSelectedAppt(null);
                  // Load patients and reasons
                  const [pRes, rRes] = await Promise.allSettled([
                    fetch('/api/patients').then(r => r.json()),
                    fetch('/api/appointment-reasons').then(r => r.json()),
                  ]);
                  if (pRes.status === 'fulfilled') setEditApptPatients(Array.isArray(pRes.value) ? pRes.value : pRes.value.patients ?? []);
                  if (rRes.status === 'fulfilled') setEditApptReasons(rRes.value.reasons ?? []);
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
              {/* Patient */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Patient *</label>
                <select className="form-input" value={editApptPatientId}
                  onChange={e => { const p = editApptPatients.find(x => x.id === e.target.value); setEditApptPatientId(e.target.value); setEditApptPatientName(p?.name ?? ''); }}>
                  <option value="">— Select Patient —</option>
                  {editApptPatients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {/* Reason */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Reason</label>
                <select className="form-input" value={editApptReasonId} onChange={e => setEditApptReasonId(e.target.value)}>
                  <option value="">— Select Reason —</option>
                  {editApptReasons.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              {/* Title */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Title</label>
                <input className="form-input" value={editApptTitle} onChange={e => setEditApptTitle(e.target.value)} />
              </div>
              {/* Date + Time */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Date</label>
                <input className="form-input" type="date" value={editApptDate} onChange={e => setEditApptDate(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Start Time</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <select className="form-input" value={editApptStartHour} onChange={e => setEditApptStartHour(e.target.value)}>
                      {Array.from({length: 12}, (_, i) => i + 7).map(h => <option key={h} value={String(h).padStart(2,'0')}>{h > 12 ? `${h-12}PM` : h === 12 ? '12PM' : `${h}AM`}</option>)}
                    </select>
                    <select className="form-input" value={editApptStartMin} onChange={e => setEditApptStartMin(e.target.value)}>
                      {['00','15','30','45'].map(m => <option key={m} value={m}>:{m}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>End Time</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <select className="form-input" value={editApptEndHour} onChange={e => setEditApptEndHour(e.target.value)}>
                      {Array.from({length: 12}, (_, i) => i + 7).map(h => <option key={h} value={String(h).padStart(2,'0')}>{h > 12 ? `${h-12}PM` : h === 12 ? '12PM' : `${h}AM`}</option>)}
                    </select>
                    <select className="form-input" value={editApptEndMin} onChange={e => setEditApptEndMin(e.target.value)}>
                      {['00','15','30','45'].map(m => <option key={m} value={m}>:{m}</option>)}
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
              <button disabled={savingAppt} onClick={async () => {
                setSavingAppt(true);
                const startIso = `${editApptDate}T${editApptStartHour}:${editApptStartMin}:00`;
                const endIso = `${editApptDate}T${editApptEndHour}:${editApptEndMin}:00`;
                const reason = editApptReasons.find(r => r.id === editApptReasonId);
                await fetch(`/api/iat-appointments/${editingAppt.id}`, {
                  method: 'PUT', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    title: editApptTitle, startTime: startIso, endTime: endIso,
                    patientId: editApptPatientId, patientName: editApptPatientName,
                    type: reason?.name || editApptReasonId, notes: editApptNotes,
                  }),
                });
                setSavingAppt(false); setEditingAppt(null);
                const todayStr = new Date().toISOString().split('T')[0];
                fetch(`/api/iat-appointments?date=${todayStr}`).then(async r => {
                  if (!r.ok) throw new Error(`HTTP ${r.status}`);
                  return r.json();
                }).then(d => setTodayAppts(d.appointments ?? d ?? [])).catch(err => {
                  console.error('[Dashboard] appointment refresh error:', err.message);
                });
              }}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#0d9488', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                {savingAppt ? '⏳' : '💾 Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Log Activity Modal */}
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
              <button onClick={handleQuickLog} disabled={quickLogSaving}
                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#0d9488', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
                {quickLogSaving ? '⏳ Saving…' : '💾 Log Activity'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
