'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { apiFetch } from '@/lib/api-fetch';
import { getAuthUser } from '@/lib/auth-cache';
import type { Layout } from 'react-grid-layout';
import type { ResponsiveLayouts } from 'react-grid-layout';
import WaitingRoomTile from '@/components/dashboard/WaitingRoomTile';
import AppointmentsTile from '@/components/dashboard/AppointmentsTile';

const DashboardGrid = dynamic(() => import('@/components/DashboardGrid'), { ssr: false });

const LAYOUT_KEY = 'iat-dashboard-layout-v11'; // v11: schedule starts at y=0, side by side with KPIs

const DEFAULT_LAYOUTS: ResponsiveLayouts = {
  lg: [
    { i: 'kpi-patients',   x: 0,  y: 0,  w: 2, h: 5,  minW: 2, minH: 3 },
    { i: 'kpi-waiting',    x: 2,  y: 0,  w: 2, h: 5,  minW: 2, minH: 3 },
    { i: 'kpi-inservice',  x: 4,  y: 0,  w: 2, h: 5,  minW: 2, minH: 3 },
    { i: 'waiting-room',   x: 0,  y: 5,  w: 6, h: 8,  minW: 3, minH: 4 },
    { i: 'appointments',   x: 6,  y: 0,  w: 6, h: 24, minW: 3, minH: 6 },
  ],
  md: [
    { i: 'kpi-patients',   x: 0, y: 0,  w: 2, h: 5 },
    { i: 'kpi-waiting',    x: 2, y: 0,  w: 2, h: 5 },
    { i: 'kpi-inservice',  x: 4, y: 0,  w: 2, h: 5 },
    { i: 'waiting-room',   x: 0, y: 5,  w: 6, h: 8 },
    { i: 'appointments',   x: 6, y: 0,  w: 4, h: 24 },
  ],
  sm: [
    { i: 'kpi-patients',   x: 0, y: 0,  w: 2, h: 4 },
    { i: 'kpi-waiting',    x: 2, y: 0,  w: 2, h: 4 },
    { i: 'kpi-inservice',  x: 4, y: 0,  w: 2, h: 4 },
    { i: 'waiting-room',   x: 0, y: 4,  w: 4, h: 6 },
    { i: 'appointments',   x: 4, y: 0,  w: 2, h: 24 },
  ],
  xs: [
    { i: 'kpi-patients',   x: 0, y: 0,  w: 2, h: 4 },
    { i: 'kpi-waiting',    x: 2, y: 0,  w: 2, h: 4 },
    { i: 'kpi-inservice',  x: 0, y: 4,  w: 4, h: 4 },
    { i: 'waiting-room',   x: 0, y: 8,  w: 4, h: 5 },
    { i: 'appointments',   x: 0, y: 13, w: 4, h: 20 },
  ],
  xxs: [
    { i: 'kpi-patients',   x: 0, y: 0,  w: 2, h: 4 },
    { i: 'kpi-waiting',    x: 0, y: 4,  w: 2, h: 4 },
    { i: 'kpi-inservice',  x: 0, y: 8,  w: 2, h: 4 },
    { i: 'waiting-room',   x: 0, y: 12, w: 2, h: 5 },
    { i: 'appointments',   x: 0, y: 17, w: 2, h: 20 },
  ],
};

function loadLayouts(): ResponsiveLayouts {
  // Always start with the default layout for all users
  // Purge any previously saved layouts
  try {
    for (let v = 1; v <= 11; v++) {
      try { localStorage.removeItem(`iat-dashboard-layout-v${v}`); } catch {}
    }
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
  providerName?: string | null;
  locationId?: string | null;
  locationName?: string | null;
}

function formatApptTime(iso: string) {
  const d = new Date(iso);
  const h = d.getHours() % 12 || 12;
  const m = d.getMinutes();
  const ampm = d.getHours() >= 12 ? 'pm' : 'am';
  return m > 0 ? `${h}:${String(m).padStart(2,'0')}${ampm}` : `${h}${ampm}`;
}

const APPT_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  'allergy-test': { bg: '#e8f9f7', text: '#0d9488' },
  'consultation': { bg: '#eff6ff', text: '#1d4ed8' },
  'follow-up':   { bg: '#f5f3ff', text: '#7c3aed' },
};

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
interface Doctor { id: string; name: string; title?: string; active?: boolean; locationId?: string | null; }

export default function DashboardPage() {
  const router = useRouter();
  const [patientCount, setPatientCount] = useState<number | null>(null);
  const [encounterCount, setEncounterCount] = useState<number | null>(null);
  const [nurseCount, setNurseCount] = useState<number | null>(null);
  const [userName, setUserName] = useState('');
  // Read role immediately from localStorage (fast path), then confirmed by API
  useEffect(() => { try { const u = localStorage.getItem('iat_user'); if (u) { const parsed = JSON.parse(u); if (parsed?.role) setUserRole(parsed.role); } } catch {} }, []);
  const [userRole, setUserRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [waiting, setWaiting] = useState<WaitingEntry[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [gridLayouts, setGridLayouts] = useState<ResponsiveLayouts>(DEFAULT_LAYOUTS);

  function handleGridLayoutChange(_layout: Layout, allLayouts: ResponsiveLayouts) {
    setGridLayouts(allLayouts);
    // Only persist when user is actively editing — prevent page load from stomping saved layout
    if (editMode) {
      try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(allLayouts)); } catch {}
    }
  }
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [quickLogEntry, setQuickLogEntry] = useState<WaitingEntry | null>(null);
  const [quickLogForm, setQuickLogForm] = useState({ activityType: 'note', notes: '' });
  const [quickLogSaving, setQuickLogSaving] = useState(false);
  const [todayAppts, setTodayAppts] = useState<TodayAppointment[]>([]);
  const [checkingInApptId, setCheckingInApptId] = useState<string | null>(null);
  const [checkedInApptIds, setCheckedInApptIds] = useState<Set<string>>(new Set());
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
  const [locationNames, setLocationNames] = useState<Record<string, string>>({});
  const [savingAppt, setSavingAppt] = useState(false);
  const [deletingApptId, setDeletingApptId] = useState<string | null>(null);
  const [showAddApptModal, setShowAddApptModal] = useState(false);
  const [newApptTitle, setNewApptTitle] = useState('');
  const [newApptTime, setNewApptTime] = useState('09:00');
  const [newApptEndTime, setNewApptEndTime] = useState('10:00');
  const [newApptProvider, setNewApptProvider] = useState('');
  const [addingAppt, setAddingAppt] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const getActiveLocation = useCallback(() => {
    try { return localStorage.getItem('iat_active_location') ?? ''; } catch { return ''; }
  }, []);
  const getActivePractice = useCallback(() => {
    try { return localStorage.getItem('iat_active_practice_filter') ?? ''; } catch { return ''; }
  }, []);

  const loadWaiting = useCallback(async () => {
    try {
      const locId = getActiveLocation();
      const practId = !locId ? getActivePractice() : '';
      const url = locId ? `/api/waiting-room?locationId=${locId}` : practId ? `/api/waiting-room?practiceId=${practId}` : '/api/waiting-room';
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

  // Re-fetch when location changes — use event detail to avoid stale closure
  useEffect(() => {
    async function onLocationChange(e: Event) {
      const detail = (e as CustomEvent<{ locationId?: string; practiceId?: string }>).detail ?? {};
      const locId = detail.locationId ?? '';
      const practId = detail.practiceId ?? '';

      // Reload waiting room with fresh location from event
      try {
        const url = locId
          ? `/api/waiting-room?locationId=${locId}`
          : practId
            ? `/api/waiting-room?practiceId=${practId}`
            : '/api/waiting-room';
        const r = await fetch(url);
        if (r.ok) {
          const d = await r.json();
          setWaiting(d.entries ?? []);
        }
      } catch {}

      // Reload appointments with fresh location from event
      const todayStr = new Date().toISOString().split('T')[0];
      const locParam = locId ? `&locationId=${locId}` : practId ? `&practiceId=${practId}` : '';
      try {
        const r = await fetch(`/api/iat-appointments?date=${todayStr}&range=day${locParam}`);
        if (r.ok) {
          const d = await r.json();
          setTodayAppts(Array.isArray(d) ? d : (d.appointments ?? []));
        }
      } catch {}

      // Re-run the full data load for KPIs etc
      const ev = new Event('iat-reload-dashboard');
      window.dispatchEvent(ev);
    }
    window.addEventListener('locationchange', onLocationChange);
    return () => window.removeEventListener('locationchange', onLocationChange);
  }, []);

  useEffect(() => {
    async function loadData() {
      try {
        const locId = getActiveLocation();
        const practiceId = !locId ? getActivePractice() : '';
        const locParam = locId ? `?locationId=${locId}` : practiceId ? `?practiceId=${practiceId}` : '';

        // Load location names for display (alongside dashboard data)
        fetch('/api/locations').then(r => r.ok ? r.json() : {locations:[]}).then(d => {
          const locs: {id: string; name: string}[] = Array.isArray(d) ? d : (d.locations ?? []);
          const nameMap: Record<string, string> = {};
          locs.forEach(l => { nameMap[l.id] = l.name; });
          setLocationNames(nameMap);
        }).catch(() => {});

        // Single consolidated endpoint — 1 cold start instead of 7
        // auth/me uses shared cache — deduped, won't double-hit if layout already fetched it
        const [dashRes, meData] = await Promise.allSettled([
          fetch(`/api/dashboard${locParam}`),
          getAuthUser(),
        ]);

        if (dashRes.status === 'fulfilled' && dashRes.value.ok) {
          const d = await dashRes.value.json();

          // Patients
          const patients: {id: string; name: string}[] = (d.patients ?? []).map((p: Record<string, unknown>) => ({
            id: p.id as string,
            name: p.name as string ?? `${p.firstName} ${p.lastName}`,
          }));
          setPatientCount(patients.length);

          // Doctors
          const docList: Doctor[] = (d.doctors ?? []).filter((doc: Doctor) => doc.active !== false);
          setDoctors(docList);

          // Nurses
          const nurseList: Nurse[] = d.nurses ?? [];
          setNurses(nurseList);
          setNurseCount(nurseList.length);

          // Encounter count
          setEncounterCount(d.encounterCount ?? 0);

          // Service colors from reasons
          const reasons: {name: string; color: string}[] = d.reasons ?? [];
          const colorMap: Record<string, string> = {};
          reasons.forEach((r: {name: string; color: string}) => { colorMap[r.name] = r.color; });
          setServiceColors(colorMap);
          setEditApptReasons(reasons.map((r: {id?: string; name: string; color: string}) => ({ id: r.id ?? r.name, name: r.name, color: r.color })));

          // Today's appointments
          const appts: TodayAppointment[] = d.appointments ?? [];
          setTodayAppts(appts);

          // Waiting room from dashboard data too
          const waitEntries = (d.waiting ?? []).map((w: Record<string, unknown>) => ({
            id: w.id,
            patientId: w.patientId,
            patientName: w.patientName ?? 'Unknown',
            status: w.status,
            checkedInAt: w.checkInTime,
            notes: w.notes,
          }));
          if (waitEntries.length > 0) setWaiting(waitEntries);
        }

        if (meData.status === 'fulfilled' && meData.value) {
          const u = meData.value;
          setUserName(u?.name ?? '');
          if (u?.role) setUserRole(u.role);
        }
      } catch {}
      finally { setLoading(false); }
    }
    loadData();
    loadWaiting();
    setGridLayouts(loadLayouts());

    // SSE: real-time waiting room updates with exponential backoff reconnect
    let evtSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let reconnectDelay = 5000; // start at 5s

    function connectSSE() {
      const locId = getActiveLocation();
      const practId = !locId ? getActivePractice() : '';
      const url = locId
        ? `/api/waiting-room/stream?locationId=${locId}`
        : practId
          ? `/api/waiting-room/stream?practiceId=${practId}`
          : '/api/waiting-room/stream';

      try {
        evtSource = new EventSource(url);
        evtSource.onmessage = (e) => {
          try {
            const entries = JSON.parse(e.data);
            setWaiting(entries ?? []);
            reconnectDelay = 5000; // reset backoff on success
          } catch {}
        };
        evtSource.onerror = () => {
          evtSource?.close();
          evtSource = null;
          // Exponential backoff: 5s, 10s, 20s, 40s, max 60s
          reconnectDelay = Math.min(reconnectDelay * 2, 60000);
          reconnectTimeout = setTimeout(connectSSE, reconnectDelay);
        };
      } catch {
        // SSE not supported or failed — ignore, manual refresh still works
      }
    }

    connectSSE();

    // Also listen for manual dashboard reload trigger
    function onReload() { loadData(); }
    window.addEventListener('iat-reload-dashboard', onReload);
    return () => {
      evtSource?.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      window.removeEventListener('iat-reload-dashboard', onReload);
    };
  }, [loadWaiting, getActiveLocation]);

  // Appointments are now fetched in the main loadData() parallel block above.

  async function handleQuickAddAppt() {
    if (!newApptTitle.trim()) return;
    setAddingAppt(true);
    const today = new Date().toISOString().slice(0, 10);
    const startIso = new Date(`${today}T${newApptTime}:00`).toISOString();
    const endIso = new Date(`${today}T${newApptEndTime}:00`).toISOString();
    try {
      const res = await apiFetch('/api/iat-appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newApptTitle, startTime: startIso, endTime: endIso, providerName: newApptProvider || undefined, locationId: getActiveLocation() || undefined }),
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
        setNewApptProvider('');
      }
    } catch {}
    setAddingAppt(false);
  }

  async function handleCheckIn(appt: TodayAppointment, e: React.MouseEvent) {
    e.stopPropagation();
    if (!appt.patientId || !appt.patientName) return;
    setCheckingInApptId(appt.id);
    try {
      const res = await apiFetch('/api/waiting-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: appt.patientId, patientName: appt.patientName }),
      });
      if (res.ok) {
        setCheckedInApptIds(prev => new Set([...prev, appt.id]));
        await loadWaiting();
        // Fire-and-forget: auto-create an open encounter on check-in
        try {
          await apiFetch('/api/encounters', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              patientId: appt.patientId,
              chiefComplaint: `Visit - ${appt.reasonName ?? appt.title}`,
              status: 'open',
              nurseName: '',
              doctorName: appt.providerName ?? '',
            }),
          });
        } catch {}
      }
    } catch {}
    setCheckingInApptId(null);
  }

  async function handleQuickLog() {
    if (!quickLogEntry) return;
    setQuickLogSaving(true);
    await apiFetch('/api/encounter-activities', {
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
    // Find the entry so we can get patientId for encounter side-effects
    const entry = waiting.find(w => w.id === id);
    await apiFetch(`/api/waiting-room/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, nurseName }),
    });
    await loadWaiting();
    setUpdatingId(null);

    // Side-effects on encounter (fire-and-forget)
    if (entry?.patientId) {
      try {
        // Find the most recent open encounter for this patient
        const encRes = await fetch(`/api/encounters?patientId=${entry.patientId}&status=open&limit=1`);
        if (encRes.ok) {
          const encData = await encRes.json();
          const openEncs: { id: string }[] = encData.encounters ?? [];
          const encId = openEncs[0]?.id;
          if (encId) {
            if (status === 'in-service') {
              // Log "Patient brought to exam room" activity AND update encounter with nurse name
              const nurseLabel = nurseName ?? entry.nurseName ?? 'Staff';
              // Update the encounter with the nurse name
              apiFetch(`/api/encounters/${encId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nurseName: nurseLabel }),
              }).catch(() => {});
              // Log the activity
              apiFetch('/api/encounter-activities', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  encounterId: encId,
                  patientId: entry.patientId,
                  activityType: 'note',
                  performedBy: nurseLabel,
                  notes: `Patient brought to exam room by ${nurseLabel}`,
                }),
              }).catch(() => {});
            } else if (status === 'complete') {
              // Close the open encounter
              apiFetch(`/api/encounters/${encId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'complete' }),
              }).catch(() => {});
            }
          }
        }
      } catch {}
    }
  }

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const waitingCount = waiting.filter(e => e.status === 'waiting').length;
  const inServiceCount = waiting.filter(e => e.status === 'in-service').length;

  // ─── Tile content builders ───────────────────────────────────────────────

  const waitingRoomTile = (
    <WaitingRoomTile
      waiting={waiting}
      nurses={nurses}
      serviceColors={serviceColors}
      loadWaiting={loadWaiting}
      updateStatus={updateStatus}
      quickLogEntry={quickLogEntry}
      setQuickLogEntry={setQuickLogEntry}
      quickLogForm={quickLogForm}
      setQuickLogForm={setQuickLogForm}
      updatingId={updatingId}
      editingNoteId={editingNoteId}
      setEditingNoteId={setEditingNoteId}
      editingNoteText={editingNoteText}
      setEditingNoteText={setEditingNoteText}
      editMode={editMode}
      router={router}
    />
  );

  const appointmentsTile = (
    <AppointmentsTile
              locationNames={locationNames}
      todayAppts={todayAppts}
      serviceColors={serviceColors}
      editMode={editMode}
      checkingInApptId={checkingInApptId}
      checkedInApptIds={checkedInApptIds}
      handleCheckInAppt={handleCheckIn}
      setSelectedAppt={setSelectedAppt}
      setShowAddApptModal={setShowAddApptModal}
    />
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
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Link href="/patients/new" className="btn-secondary btn-sm btn">+ Register</Link>
          <Link href="/testing" className="btn btn-sm">🧪 Test</Link>
          {userRole !== 'clinical_staff' && (
          <button onClick={() => setEditMode(v => !v)}
            style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${editMode ? '#f59e0b' : '#e2e8f0'}`, background: editMode ? '#fefce8' : '#fff', color: editMode ? '#b45309' : '#374151', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            {editMode ? '✅ Done' : '⊞ Edit'}
          </button>
          )}
          <Link href="/calendar?action=new" className="btn btn-sm" style={{ background: '#7c3aed', color: '#fff' }}>📅 Book</Link>
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
                <div className="kpi-card" style={{ height: '100%', borderTop: '4px solid #6366f1', border: editMode ? '2px dashed #f59e0b' : undefined }}>
                  <div className="kpi-icon">📅</div>
                  <div className="kpi-label">Appointments Today</div>
                  {loading ? <div style={{width:40,height:24,borderRadius:6,background:'#e2e8f0',animation:'pulse 1.5s infinite'}} /> : <div className="kpi-value" style={{ color: todayAppts.length > 0 ? '#4f46e5' : '#64748b' }}>{todayAppts.length}</div>}
                </div>
              ),
            },
            {
              id: 'kpi-waiting',
              content: (
                <div className="kpi-card" style={{ height: '100%', borderTop: '4px solid #f59e0b', border: editMode ? '2px dashed #f59e0b' : undefined }}>
                  <div className="kpi-icon">⏳</div>
                  <div className="kpi-label">Waiting</div>
                  {loading ? <div style={{width:40,height:24,borderRadius:6,background:'#e2e8f0',animation:'pulse 1.5s infinite'}} /> : <div className="kpi-value" style={{ color: waitingCount > 0 ? '#b45309' : '#64748b' }}>{waitingCount}</div>}
                </div>
              ),
            },
            {
              id: 'kpi-inservice',
              content: (
                <div className="kpi-card" style={{ height: '100%', borderTop: '4px solid #0d9488', border: editMode ? '2px dashed #f59e0b' : undefined }}>
                  <div className="kpi-icon">🩺</div>
                  <div className="kpi-label">In Service</div>
                  {loading ? <div style={{width:40,height:24,borderRadius:6,background:'#e2e8f0',animation:'pulse 1.5s infinite'}} /> : <div className="kpi-value" style={{ color: inServiceCount > 0 ? '#0d9488' : '#64748b' }}>{inServiceCount}</div>}
                </div>
              ),
            },
            { id: 'waiting-room',  content: waitingRoomTile },
            { id: 'appointments',  content: appointmentsTile },
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
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
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Physician</label>
              {doctors.length > 0 ? (
                <select value={newApptProvider} onChange={e => setNewApptProvider(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box' }}>
                  <option value="">— Select Physician —</option>
                  {doctors.map(d => <option key={d.id} value={d.name}>{d.title ? `${d.name}, ${d.title}` : d.name}</option>)}
                </select>
              ) : (
                <input value={newApptProvider} onChange={e => setNewApptProvider(e.target.value)}
                  placeholder="e.g. Dr. Smith"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box' }} />
              )}
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
              {userRole !== 'clinical_staff' && <button
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
                    (() => { let lp = ''; try { const l = localStorage.getItem('iat_active_location'); if (l) lp = `?locationId=${l}`; } catch {} return fetch(`/api/patients${lp}`); })().then(r => r.json()),
                    fetch('/api/appointment-reasons').then(r => r.json()),
                  ]);
                  if (pRes.status === 'fulfilled') setEditApptPatients(Array.isArray(pRes.value) ? pRes.value : pRes.value.patients ?? []);
                  if (rRes.status === 'fulfilled') setEditApptReasons(rRes.value.reasons ?? []);
                }}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                ✏️ Edit
              </button>}
              {userRole !== 'clinical_staff' && (
              <button
                disabled={deletingApptId === selectedAppt.id}
                onClick={async () => {
                  if (!confirm('Delete this appointment?')) return;
                  setDeletingApptId(selectedAppt.id);
                  await apiFetch(`/api/iat-appointments/${selectedAppt.id}`, { method: 'DELETE' });
                  setTodayAppts(prev => prev.filter(a => a.id !== selectedAppt.id));
                  setSelectedAppt(null);
                  setDeletingApptId(null);
                }}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#fef2f2', color: '#b91c1c', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {deletingApptId === selectedAppt.id ? '⏳' : '🗑️ Delete'}
              </button>
              )}
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
                await apiFetch(`/api/iat-appointments/${editingAppt.id}`, {
                  method: 'PUT', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    title: editApptTitle, startTime: startIso, endTime: endIso,
                    patientId: editApptPatientId, patientName: editApptPatientName,
                    type: reason?.name || editApptReasonId, notes: editApptNotes,
                  }),
                });
                setSavingAppt(false); setEditingAppt(null);
                const todayStr = new Date().toISOString().split('T')[0];
                fetch(`/api/iat-appointments?date=${todayStr}&range=day`).then(async r => {
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
