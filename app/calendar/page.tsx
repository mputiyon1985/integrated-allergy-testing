'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

interface Appointment {
  id: string;
  title: string;
  patientId?: string | null;
  patientName?: string | null;
  startTime: string;
  endTime: string;
  type: string;
  notes?: string | null;
  status: string;
}

interface Patient {
  id: string;
  patientId: string;
  name: string;
}

interface AppointmentReason {
  id: string;
  name: string;
  color: string;
  duration: number;
  active: boolean;
}

function getReasonIcon(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('allergy shot') || n === 'shot') return '💉';
  if (n.includes('allergy test') || n.includes('testing')) return '🧪';
  if (n.includes('new patient') || n.includes('intake')) return '📋';
  if (n.includes('follow') || n.includes('follow-up')) return '🔄';
  if (n.includes('consultation')) return '👨‍⚕️';
  if (n.includes('test results') || n.includes('results review')) return '📊';
  if (n.includes('immunotherapy')) return '💊';
  return '📅';
}

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 7); // 7am–6pm

function formatHour(h: number) {
  if (h === 12) return '12pm';
  if (h > 12) return `${h - 12}pm`;
  return `${h}am`;
}

// Timezone-safe: uses local date parts so UTC conversion never shifts the date
function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Timezone-safe sameDay: compare local YYYY-MM-DD strings directly
function localDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function startOfWeek(d: Date) {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, n: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function sameDay(a: Date, b: Date) {
  // Compare local date strings — avoids UTC-vs-local off-by-one bugs
  return localDateStr(a) === localDateStr(b);
}

function apptHour(appt: Appointment) {
  return new Date(appt.startTime).getHours();
}

function apptDay(appt: Appointment) {
  return new Date(appt.startTime);
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'pm' : 'am';
  const displayH = h % 12 || 12;
  return m > 0 ? `${displayH}:${String(m).padStart(2, '0')}${ampm}` : `${displayH}${ampm}`;
}

const EMPTY_FORM = {
  title: '',
  patientId: '',
  patientName: '',
  date: '',
  startHour: '9',
  startMin: '00',
  endHour: '10',
  endMin: '00',
  reasonId: '',
  reasonName: '',
  notes: '',
};

function CalendarInner() {
  const searchParams = useSearchParams();
  // ── DEFAULT: month view ──
  const [view, setView] = useState<'week' | 'month'>('month');
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [reasons, setReasons] = useState<AppointmentReason[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'view'>('add');
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [titleManuallyEdited, setTitleManuallyEdited] = useState(false);

  // Day detail panel state
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [dayPanelOpen, setDayPanelOpen] = useState(false);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();

  // ── For month view: load all appointments in the current month ──
  const loadAppointments = useCallback(async () => {
    setLoading(true);
    try {
      // Pass the first day of the month so API returns the full month range
      const refDate = view === 'month'
        ? new Date(weekStart.getFullYear(), weekStart.getMonth(), 1)
        : weekStart;
      const res = await fetch(`/api/iat-appointments?date=${isoDate(refDate)}&range=${view}`);
      if (res.ok) {
        const data = await res.json();
        setAppointments(Array.isArray(data) ? data : []);
      }
    } catch {}
    setLoading(false);
  }, [weekStart, view]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  useEffect(() => {
    fetch('/api/patients')
      .then(r => r.ok ? r.json() : [])
      .then(d => setPatients(Array.isArray(d) ? d : d.patients ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/appointment-reasons')
      .then(r => r.ok ? r.json() : { reasons: [] })
      .then(d => setReasons(Array.isArray(d) ? d : d.reasons ?? []))
      .catch(() => {});
  }, []);

  // Handle URL params: auto-open modal if ?action=new
  useEffect(() => {
    const action = searchParams.get('action');
    const patientId = searchParams.get('patientId');
    const patientName = searchParams.get('patientName');
    if (action === 'new') {
      const d = isoDate(today);
      const baseForm = { ...EMPTY_FORM, date: d, startHour: '9', endHour: '10' };
      if (patientId) {
        baseForm.patientId = patientId;
        baseForm.patientName = patientName ?? '';
      }
      setForm(baseForm);
      setSelectedAppt(null);
      setModalMode('add');
      setEditMode(false);
      setTitleManuallyEdited(false);
      setError('');
      setShowModal(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Auto-fill title when patient and reason both selected
  useEffect(() => {
    if (!titleManuallyEdited && form.patientName && form.reasonName) {
      setForm(f => ({ ...f, title: `${form.patientName} - ${form.reasonName}` }));
    }
  }, [form.patientName, form.reasonName, titleManuallyEdited]);

  // ── Day panel helpers ──
  function openDayPanel(day: Date) {
    setSelectedDay(day);
    setDayPanelOpen(true);
  }

  function closeDayPanel() {
    setDayPanelOpen(false);
  }

  // Group same-time + same-type appointments into a single chip
  function buildDayChips(dayAppts: Appointment[]) {
    const groups = new Map<string, {
      appts: Appointment[];
      colors: ReturnType<typeof getApptColors>;
      typeName: string;
      time: string;
    }>();
    dayAppts.forEach(a => {
      const timePart = a.startTime.slice(0, 16);
      const typeName = getReasonForAppt(a)?.name ?? a.type;
      const key = `${timePart}|${typeName}`;
      if (!groups.has(key)) {
        groups.set(key, { appts: [], colors: getApptColors(a), typeName, time: formatTime(a.startTime) });
      }
      groups.get(key)!.appts.push(a);
    });
    return Array.from(groups.values()).map(({ appts, colors, typeName, time }) => ({
      label: appts.length > 1 ? `${appts.length}× ${typeName}` : (appts[0].patientName ?? appts[0].title),
      sublabel: time,
      colors,
      count: appts.length,
      appts,
    }));
  }

  function openAddModal(date?: Date, hour?: number) {
    const d = date ? isoDate(date) : isoDate(today);
    const h = hour ?? 9;
    setForm({ ...EMPTY_FORM, date: d, startHour: String(h), endHour: String(h + 1) });
    setSelectedAppt(null);
    setModalMode('add');
    setEditMode(false);
    setTitleManuallyEdited(false);
    setError('');
    setShowModal(true);
  }

  function openViewModal(appt: Appointment) {
    setSelectedAppt(appt);
    setModalMode('view');
    setEditMode(false);
    setError('');
    setShowModal(true);
  }

  function openEditModal(appt: Appointment) {
    const start = new Date(appt.startTime);
    const end = new Date(appt.endTime);
    const reason = reasons.find(r => r.name === appt.type || r.id === appt.type);
    setForm({
      title: appt.title,
      patientId: appt.patientId ?? '',
      patientName: appt.patientName ?? '',
      date: isoDate(start),
      startHour: String(start.getHours()),
      startMin: String(start.getMinutes()).padStart(2, '0'),
      endHour: String(end.getHours()),
      endMin: String(end.getMinutes()).padStart(2, '0'),
      reasonId: reason?.id ?? appt.type,
      reasonName: reason?.name ?? appt.type,
      notes: appt.notes ?? '',
    });
    setSelectedAppt(appt);
    setModalMode('add');
    setEditMode(true);
    setTitleManuallyEdited(true);
    setError('');
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.title.trim()) { setError('Title is required'); return; }
    if (!form.date) { setError('Date is required'); return; }
    if (!form.patientId) { setError('Patient selection is required'); return; }

    setSaving(true);
    setError('');

    const startDt = new Date(`${form.date}T${String(form.startHour).padStart(2, '0')}:${form.startMin}:00`);
    const endDt = new Date(`${form.date}T${String(form.endHour).padStart(2, '0')}:${form.endMin}:00`);

    const selectedReason = reasons.find(r => r.id === form.reasonId);
    const body = {
      title: form.title.trim(),
      patientId: form.patientId || undefined,
      patientName: form.patientName || undefined,
      startTime: startDt.toISOString(),
      endTime: endDt.toISOString(),
      type: selectedReason?.name ?? form.reasonName ?? form.reasonId,
      notes: form.notes || undefined,
    };

    try {
      let res;
      if (editMode && selectedAppt) {
        res = await fetch(`/api/iat-appointments/${selectedAppt.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch('/api/iat-appointments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? 'Save failed');
      } else {
        setShowModal(false);
        loadAppointments();
      }
    } catch {
      setError('Network error');
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this appointment?')) return;
    await fetch(`/api/iat-appointments/${id}`, { method: 'DELETE' });
    setShowModal(false);
    loadAppointments();
  }

  async function handleStatusChange(id: string, status: string) {
    await fetch(`/api/iat-appointments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    loadAppointments();
    setShowModal(false);
  }

  function getReasonForAppt(appt: Appointment) {
    return reasons.find(r => r.name === appt.type || r.id === appt.type);
  }

  function getApptColors(appt: Appointment) {
    const reason = getReasonForAppt(appt);
    if (reason) {
      return {
        bg: reason.color,
        border: reason.color,
        text: '#ffffff',
      };
    }
    return { bg: '#0d9488', border: '#0d9488', text: '#ffffff' };
  }

  // Week view rendering
  function getApptsForSlot(day: Date, hour: number) {
    return appointments.filter(a => {
      const d = apptDay(a);
      return sameDay(d, day) && apptHour(a) === hour;
    });
  }

  // Month view: compute month grid
  const monthStart = new Date(weekStart.getFullYear(), weekStart.getMonth(), 1);
  const monthFirstDay = monthStart.getDay();
  const daysInMonth = new Date(weekStart.getFullYear(), weekStart.getMonth() + 1, 0).getDate();

  const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  function prevWeek() { setWeekStart(w => addDays(w, -7)); }
  function nextWeek() { setWeekStart(w => addDays(w, 7)); }
  function prevMonth() { setWeekStart(w => new Date(w.getFullYear(), w.getMonth() - 1, 1)); }
  function nextMonth() { setWeekStart(w => new Date(w.getFullYear(), w.getMonth() + 1, 1)); }
  function goToday() { setWeekStart(startOfWeek(new Date())); }

  const monthLabel = `${MONTHS[weekStart.getMonth()]} ${weekStart.getFullYear()}`;
  const weekLabel = `${weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">📅 Calendar</div>
          <div className="page-subtitle">Appointment scheduling — multiple patients per slot supported</div>
        </div>
        <button
          onClick={() => openAddModal()}
          className="btn btn-sm"
        >
          + Add Appointment
        </button>
      </div>

      <div className="page-body">
        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          {/* View toggle */}
          <div style={{ display: 'flex', border: '1.5px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
            {(['month', 'week'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                style={{ padding: '6px 18px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: view === v ? '#0d9488' : '#fff', color: view === v ? '#fff' : '#374151' }}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <button onClick={view === 'week' ? prevWeek : prevMonth}
            style={{ padding: '6px 14px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 16 }}>
            ‹
          </button>
          <div style={{ fontWeight: 700, fontSize: 15, minWidth: 200, textAlign: 'center', color: '#111827' }}>
            {view === 'week' ? weekLabel : monthLabel}
          </div>
          <button onClick={view === 'week' ? nextWeek : nextMonth}
            style={{ padding: '6px 14px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 16 }}>
            ›
          </button>
          <button onClick={goToday}
            style={{ padding: '6px 14px', borderRadius: 8, border: '1.5px solid #0d9488', background: '#e8f9f7', color: '#0d9488', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
            Today
          </button>

          {loading && <span style={{ fontSize: 12, color: '#9ca3af' }}>Loading…</span>}
        </div>

        {/* ══ WEEK VIEW (unchanged) ══ */}
        {view === 'week' && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', borderBottom: '2px solid #e2e8f0' }}>
              <div style={{ padding: '10px 0', background: '#f8fafc' }} />
              {weekDays.map((day, i) => {
                const isToday = sameDay(day, today);
                return (
                  <div key={i} style={{ padding: '10px 6px', textAlign: 'center', background: isToday ? '#e8f9f7' : '#f8fafc', borderLeft: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>{DAYS_SHORT[i]}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: isToday ? '#0d9488' : '#111827', marginTop: 2 }}>{day.getDate()}</div>
                  </div>
                );
              })}
            </div>
            {/* Time slots */}
            <div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
              {HOURS.map(hour => (
                <div key={hour} style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', borderBottom: '1px solid #f1f5f9', minHeight: 70 }}>
                  <div style={{ padding: '6px 8px', fontSize: 11, color: '#9ca3af', fontWeight: 600, textAlign: 'right', paddingTop: 8 }}>
                    {formatHour(hour)}
                  </div>
                  {weekDays.map((day, di) => {
                    const isToday = sameDay(day, today);
                    const slotAppts = getApptsForSlot(day, hour);
                    return (
                      <div
                        key={di}
                        onClick={() => openAddModal(day, hour)}
                        style={{ borderLeft: '1px solid #f1f5f9', padding: '4px', cursor: 'pointer', background: isToday ? '#fafffe' : 'white', transition: 'background 0.1s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f0fdf4')}
                        onMouseLeave={e => (e.currentTarget.style.background = isToday ? '#fafffe' : 'white')}
                      >
                        {slotAppts.length > 1 ? (
                          // Multi-book: side-by-side columns with connecting top bar
                          <div style={{ position: 'relative' }}>
                            {/* Connecting bar across top */}
                            <div style={{
                              height: 3, borderRadius: '3px 3px 0 0', marginBottom: 1,
                              background: `linear-gradient(to right, ${slotAppts.map(a => getApptColors(a).bg).join(', ')})`,
                            }} />
                            <div style={{ display: 'flex', gap: 2 }}>
                              {slotAppts.map((appt, idx) => {
                                const colors = getApptColors(appt);
                                const reason = getReasonForAppt(appt);
                                const icon = reason ? getReasonIcon(reason.name) : '📅';
                                return (
                                  <div
                                    key={appt.id}
                                    onClick={e => { e.stopPropagation(); openViewModal(appt); }}
                                    style={{ flex: 1, background: colors.bg, border: `1.5px solid ${colors.border}`, borderRadius: idx === 0 ? '0 0 0 6px' : idx === slotAppts.length - 1 ? '0 0 6px 0' : '0', padding: '3px 4px', cursor: 'pointer', fontSize: 10, minWidth: 0 }}
                                  >
                                    <div style={{ fontWeight: 700, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{icon} {appt.patientName ?? appt.title}</div>
                                    <div style={{ color: colors.text, fontSize: 9, opacity: 0.85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{reason?.name ?? ''}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : slotAppts.map(appt => {
                          const colors = getApptColors(appt);
                          const reason = getReasonForAppt(appt);
                          const icon = reason ? getReasonIcon(reason.name) : '📅';
                          return (
                            <div
                              key={appt.id}
                              onClick={e => { e.stopPropagation(); openViewModal(appt); }}
                              style={{ background: colors.bg, border: `1.5px solid ${colors.border}`, borderRadius: 6, padding: '3px 6px', marginBottom: 3, cursor: 'pointer', fontSize: 11 }}
                            >
                              <div style={{ fontWeight: 700, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{icon} {appt.title}</div>
                              {appt.patientName && <div style={{ color: colors.text, fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.85 }}>{appt.patientName}</div>}
                              <div style={{ color: colors.text, fontSize: 10, opacity: 0.75 }}>{formatTime(appt.startTime)}–{formatTime(appt.endTime)}</div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ MONTH VIEW ══ */}
        {view === 'month' && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Day-of-week header */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '2px solid #e2e8f0' }}>
              {DAYS_SHORT.map(d => (
                <div key={d} style={{ padding: '10px 0', textAlign: 'center', background: '#f8fafc', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>{d}</div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {/* Leading empty cells (Monday-first grid) */}
              {Array.from({ length: (monthFirstDay === 0 ? 6 : monthFirstDay - 1) }).map((_, i) => (
                <div key={`empty-${i}`} style={{ minHeight: 120, background: '#fafafa', borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }} />
              ))}

              {/* Day cells */}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = new Date(weekStart.getFullYear(), weekStart.getMonth(), i + 1);
                const isToday = sameDay(day, today);
                const dayAppts = appointments.filter(a => sameDay(apptDay(a), day));
                const chips = buildDayChips(dayAppts);
                // Show up to 3 grouped chips; +N more = remaining raw appointments
                const MAX_CHIPS = 3;
                const visibleChips = chips.slice(0, MAX_CHIPS);
                const shownApptCount = visibleChips.reduce((s, c) => s + c.count, 0);
                const hiddenCount = dayAppts.length - shownApptCount;

                return (
                  <div
                    key={i}
                    onClick={() => openDayPanel(day)}
                    style={{
                      minHeight: 120,
                      borderRight: '1px solid #f1f5f9',
                      borderBottom: '1px solid #f1f5f9',
                      padding: '6px 5px',
                      cursor: 'pointer',
                      background: isToday ? '#f0fdf9' : 'white',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f0fdf4')}
                    onMouseLeave={e => (e.currentTarget.style.background = isToday ? '#f0fdf9' : 'white')}
                  >
                    {/* Day number row + count badge */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                      {isToday ? (
                        <div style={{ background: '#0d9488', color: '#fff', width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                          {i + 1}
                        </div>
                      ) : (
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#374151' }}>{i + 1}</div>
                      )}
                      {dayAppts.length > 0 && (
                        <span style={{
                          background: '#0d9488', color: '#fff',
                          borderRadius: 999, fontSize: 10, fontWeight: 700,
                          padding: '1px 7px', lineHeight: '16px', flexShrink: 0,
                        }}>
                          {dayAppts.length} appt{dayAppts.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {/* Grouped appointment chips */}
                    {visibleChips.map((chip, ci) => (
                      <div
                        key={ci}
                        title={`${chip.sublabel} – ${chip.label}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          background: hexToRgba(chip.colors.bg, 0.11),
                          borderLeft: `3px solid ${chip.colors.bg}`,
                          borderRadius: '0 4px 4px 0',
                          padding: '2px 5px',
                          marginBottom: 3,
                          fontSize: 10,
                          overflow: 'hidden',
                        }}
                      >
                        <span style={{ fontWeight: 700, color: chip.colors.bg, flexShrink: 0, fontSize: 10 }}>
                          {chip.sublabel}
                        </span>
                        <span style={{ color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, fontSize: 10 }}>
                          {chip.label}
                        </span>
                      </div>
                    ))}

                    {/* +N more overflow */}
                    {hiddenCount > 0 && (
                      <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, paddingLeft: 4 }}>
                        +{hiddenCount} more
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Legend */}
        {reasons.length > 0 && (
          <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
            {reasons.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#374151' }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, background: hexToRgba(r.color, 0.15), border: `1.5px solid ${r.color}` }} />
                {getReasonIcon(r.name)} {r.name}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══ DAY DETAIL SLIDE PANEL ══ */}
      {dayPanelOpen && selectedDay && (() => {
        const panelAppts = appointments
          .filter(a => sameDay(apptDay(a), selectedDay))
          .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
        const dayLabel = selectedDay.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

        return (
          <>
            {/* Backdrop */}
            <div
              onClick={closeDayPanel}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 900 }}
            />
            {/* Slide-in panel */}
            <div style={{
              position: 'fixed', top: 0, right: 0, bottom: 0,
              width: 420, maxWidth: '93vw',
              background: '#fff', zIndex: 901,
              boxShadow: '-4px 0 32px rgba(0,0,0,0.18)',
              display: 'flex', flexDirection: 'column',
              animation: 'slideInRight 0.22s ease',
            }}>
              {/* Panel header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1.5px solid #e2e8f0', background: '#f8fafc' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: '#111827' }}>📅 {dayLabel}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                    {panelAppts.length === 0 ? 'No appointments' : `${panelAppts.length} appointment${panelAppts.length !== 1 ? 's' : ''}`}
                  </div>
                </div>
                <button
                  onClick={closeDayPanel}
                  style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, width: 34, height: 34, fontSize: 20, cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                >×</button>
              </div>

              {/* Appointment cards */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {panelAppts.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 14, marginTop: 48 }}>
                    <div style={{ fontSize: 40, marginBottom: 10 }}>🗓️</div>
                    <div style={{ fontWeight: 600, color: '#6b7280' }}>No appointments</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>Click below to book one</div>
                  </div>
                ) : panelAppts.map(appt => {
                  const colors = getApptColors(appt);
                  const reason = getReasonForAppt(appt);
                  const icon = reason ? getReasonIcon(reason.name) : '📅';
                  return (
                    <div
                      key={appt.id}
                      onClick={() => { closeDayPanel(); openViewModal(appt); }}
                      style={{
                        borderLeft: `4px solid ${colors.bg}`,
                        background: '#fff',
                        borderRadius: '0 10px 10px 0',
                        padding: '12px 14px',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                        cursor: 'pointer',
                        transition: 'box-shadow 0.1s, transform 0.1s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.13)'; e.currentTarget.style.transform = 'translateX(2px)'; }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.07)'; e.currentTarget.style.transform = 'translateX(0)'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* Patient name */}
                          <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {appt.patientName ?? appt.title}
                          </div>
                          {/* Time */}
                          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: appt.notes ? 5 : 0 }}>
                            🕐 {formatTime(appt.startTime)} – {formatTime(appt.endTime)}
                          </div>
                          {/* Notes */}
                          {appt.notes && (
                            <div style={{ fontSize: 12, color: '#374151', background: '#f8fafc', borderRadius: 6, padding: '4px 8px', marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              📝 {appt.notes}
                            </div>
                          )}
                        </div>
                        {/* Service badge */}
                        <span style={{
                          background: colors.bg, color: colors.text,
                          borderRadius: 999, padding: '3px 10px',
                          fontSize: 11, fontWeight: 700,
                          whiteSpace: 'nowrap', flexShrink: 0,
                        }}>
                          {icon} {reason?.name ?? appt.type}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer: Book button */}
              <div style={{ padding: '14px 16px', borderTop: '1.5px solid #e2e8f0', background: '#f8fafc' }}>
                <button
                  onClick={() => { closeDayPanel(); openAddModal(selectedDay); }}
                  style={{ width: '100%', padding: '12px 0', borderRadius: 10, border: 'none', background: '#0d9488', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', letterSpacing: 0.3 }}
                >
                  + Book Appointment
                </button>
              </div>
            </div>

            <style>{`
              @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to   { transform: translateX(0);    opacity: 1; }
              }
            `}</style>
          </>
        );
      })()}

      {/* ══ MODAL ══ */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ fontWeight: 700, fontSize: 18, color: '#111827' }}>
                {modalMode === 'view' && !editMode ? '📅 Appointment Details' : editMode ? '✏️ Edit Appointment' : '+ Add Appointment'}
              </div>
              <button onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#6b7280', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ padding: '20px 24px' }}>
              {/* VIEW mode */}
              {modalMode === 'view' && !editMode && selectedAppt && (
                <div>
                  {(() => {
                    const colors = getApptColors(selectedAppt);
                    const reason = getReasonForAppt(selectedAppt);
                    const icon = reason ? getReasonIcon(reason.name) : '📅';
                    return (
                      <>
                        <div style={{ marginBottom: 16 }}>
                          <span style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}`, borderRadius: 999, padding: '2px 12px', fontSize: 12, fontWeight: 700 }}>
                            {icon} {reason?.name ?? selectedAppt.type}
                          </span>
                          <span style={{ marginLeft: 10, fontSize: 12, padding: '2px 10px', borderRadius: 999, background: '#f1f5f9', color: '#374151', fontWeight: 600 }}>
                            {selectedAppt.status}
                          </span>
                        </div>
                        <h3 style={{ margin: '0 0 12px', fontSize: 20, color: '#111827' }}>{selectedAppt.title}</h3>
                        {selectedAppt.patientName && (
                          <div style={{ marginBottom: 8, fontSize: 14, color: '#374151' }}>👤 {selectedAppt.patientName}</div>
                        )}
                        <div style={{ marginBottom: 8, fontSize: 14, color: '#374151' }}>
                          🕐 {formatTime(selectedAppt.startTime)} – {formatTime(selectedAppt.endTime)}
                        </div>
                        <div style={{ marginBottom: 12, fontSize: 14, color: '#374151' }}>
                          📆 {new Date(selectedAppt.startTime).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                        </div>
                        {selectedAppt.notes && (
                          <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px', fontSize: 14, color: '#374151', marginBottom: 12 }}>
                            📝 {selectedAppt.notes}
                          </div>
                        )}
                        {/* Status actions */}
                        {selectedAppt.status === 'scheduled' && (
                          <button onClick={() => handleStatusChange(selectedAppt.id, 'in-progress')}
                            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#0d9488', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13, marginBottom: 8, marginRight: 8 }}>
                            ▶ Start
                          </button>
                        )}
                        {selectedAppt.status === 'in-progress' && (
                          <button onClick={() => handleStatusChange(selectedAppt.id, 'complete')}
                            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13, marginBottom: 8, marginRight: 8 }}>
                            ✅ Complete
                          </button>
                        )}
                      </>
                    );
                  })()}
                  <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                    <button onClick={() => openEditModal(selectedAppt)}
                      style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1.5px solid #0d9488', background: '#fff', color: '#0d9488', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
                      ✏️ Edit
                    </button>
                    <button onClick={() => handleDelete(selectedAppt.id)}
                      style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1.5px solid #dc2626', background: '#fff', color: '#dc2626', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              )}

              {/* ADD/EDIT form */}
              {(modalMode === 'add' || editMode) && (
                <div>
                  {error && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '8px 14px', fontSize: 13, color: '#dc2626', marginBottom: 14 }}>
                      {error}
                    </div>
                  )}

                  {/* Patient — required */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                      Patient <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <select value={form.patientId}
                      onChange={e => {
                        const p = patients.find(x => x.id === e.target.value);
                        setForm(f => ({ ...f, patientId: e.target.value, patientName: p?.name ?? '' }));
                      }}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${!form.patientId && error ? '#fca5a5' : '#e2e8f0'}`, fontSize: 14, boxSizing: 'border-box' }}>
                      <option value="">— Select patient —</option>
                      {patients.map(p => <option key={p.id} value={p.id}>{p.name} ({p.patientId})</option>)}
                    </select>
                  </div>

                  {/* Reason */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Reason</label>
                    <select value={form.reasonId}
                      onChange={e => {
                        const r = reasons.find(x => x.id === e.target.value);
                        setForm(f => ({ ...f, reasonId: e.target.value, reasonName: r?.name ?? '' }));
                      }}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box' }}>
                      <option value="">— Select reason —</option>
                      {reasons.map(r => (
                        <option key={r.id} value={r.id}>
                          {getReasonIcon(r.name)} {r.name} ({r.duration}min)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Title — auto-filled but editable */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                      Title <span style={{ color: '#dc2626' }}>*</span>
                      {!titleManuallyEdited && form.patientName && form.reasonName && (
                        <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: 6, fontSize: 12 }}>(auto-filled)</span>
                      )}
                    </label>
                    <input value={form.title}
                      onChange={e => { setTitleManuallyEdited(true); setForm(f => ({ ...f, title: e.target.value })); }}
                      placeholder="e.g. John Smith - Allergy Testing"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box' }} />
                    {titleManuallyEdited && (
                      <button type="button" onClick={() => { setTitleManuallyEdited(false); }}
                        style={{ fontSize: 11, color: '#0d9488', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', marginTop: 2 }}>
                        ↺ Reset to auto-fill
                      </button>
                    )}
                  </div>

                  {/* Date */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Date <span style={{ color: '#dc2626' }}>*</span></label>
                    <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box' }} />
                  </div>

                  {/* Time */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Start Time <span style={{ color: '#dc2626' }}>*</span></label>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <select value={form.startHour} onChange={e => setForm(f => ({ ...f, startHour: e.target.value }))}
                          style={{ flex: 1, padding: '8px 6px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 13 }}>
                          {HOURS.map(h => <option key={h} value={h}>{formatHour(h)}</option>)}
                        </select>
                        <select value={form.startMin} onChange={e => setForm(f => ({ ...f, startMin: e.target.value }))}
                          style={{ width: 56, padding: '8px 4px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 13 }}>
                          {['00','15','30','45'].map(m => <option key={m} value={m}>:{m}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>End Time <span style={{ color: '#dc2626' }}>*</span></label>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <select value={form.endHour} onChange={e => setForm(f => ({ ...f, endHour: e.target.value }))}
                          style={{ flex: 1, padding: '8px 6px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 13 }}>
                          {HOURS.map(h => <option key={h} value={h}>{formatHour(h)}</option>)}
                        </select>
                        <select value={form.endMin} onChange={e => setForm(f => ({ ...f, endMin: e.target.value }))}
                          style={{ width: 56, padding: '8px 4px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 13 }}>
                          {['00','15','30','45'].map(m => <option key={m} value={m}>:{m}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Notes</label>
                    <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                      rows={3} placeholder="Optional notes…"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setShowModal(false)}
                      style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#fff', color: '#374151', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
                      Cancel
                    </button>
                    <button onClick={handleSave} disabled={saving}
                      style={{ flex: 2, padding: '10px 0', borderRadius: 10, border: 'none', background: '#0d9488', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14, opacity: saving ? 0.7 : 1 }}>
                      {saving ? 'Saving…' : editMode ? 'Save Changes' : 'Book Appointment'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<div className="page-body">Loading calendar…</div>}>
      <CalendarInner />
    </Suspense>
  );
}
