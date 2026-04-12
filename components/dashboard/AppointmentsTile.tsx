'use client';

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
  providerName?: string | null;
  locationId?: string | null;
  locationName?: string | null;
}

// Short display names for locations
const LOC_SHORT: Record<string, string> = {
  'loc-iat-001': 'MAP Dumfries',
  'loc-map-002': 'MAP Woodbridge',
  'loc-map-003': 'MAP Stafford',
  'loc-map-004': 'MAP Fredericksburg',
  'loc-nvaa-001': 'NVAA Fairfax',
  'loc-nvaa-002': 'NVAA Arlington',
  'loc-nvaa-003': 'NVAA Reston',
  'loc-nvaa-004': 'NVAA Tysons',
  'loc-caac-001': 'CAAC Bethesda',
  'loc-caac-002': 'CAAC Silver Spring',
  'loc-caac-003': 'CAAC Rockville',
}

interface AppointmentsTileProps {
  todayAppts: TodayAppointment[];
  serviceColors: Record<string, string>;
  editMode: boolean;
  checkingInApptId: string | null;
  checkedInApptIds: Set<string>;
  handleCheckInAppt: (appt: TodayAppointment, e: React.MouseEvent) => Promise<void>;
  setSelectedAppt: (appt: TodayAppointment | null) => void;
  setShowAddApptModal: (show: boolean) => void;
  showLocationBadge?: boolean; // show location tag when viewing all locations
}

function formatApptTime(iso: string) {
  const d = new Date(iso);
  const h = d.getHours() % 12 || 12;
  const m = d.getMinutes();
  const ampm = d.getHours() >= 12 ? 'pm' : 'am';
  return m > 0 ? `${h}:${String(m).padStart(2,'0')}${ampm}` : `${h}${ampm}`;
}

export default function AppointmentsTile({
  todayAppts,
  serviceColors,
  editMode,
  checkingInApptId,
  checkedInApptIds,
  handleCheckInAppt,
  setSelectedAppt,
  setShowAddApptModal,
  showLocationBadge = false,
}: AppointmentsTileProps) {
  // Auto-detect: show location badge when appointments span multiple locations
  const uniqueLocs = new Set(todayAppts.map(a => a.locationId).filter(Boolean));
  const shouldShowLoc = showLocationBadge || uniqueLocs.size > 1;
  return (
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {todayAppts.map(appt => {
            const color = serviceColors[appt.reasonName ?? ''] ?? serviceColors[appt.type] ?? '#64748b';
            return (
              <div key={appt.id}
                onClick={() => setSelectedAppt(appt)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', background: '#fff', borderRadius: 8, borderLeft: `3px solid ${color}`, border: `1.5px solid ${color}20`, cursor: 'pointer', transition: 'box-shadow 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.10)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
              >
                <div style={{ fontWeight: 700, fontSize: 12, color, minWidth: 48, flexShrink: 0 }}>
                  {formatApptTime(appt.startTime)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 999, background: color, color: '#fff', flexShrink: 0 }}>
                      {appt.reasonName ?? appt.type}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: 13, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{appt.patientName ?? appt.title}</span>
                    {shouldShowLoc && appt.locationId && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', flexShrink: 0 }}>
                        📍 {LOC_SHORT[appt.locationId] ?? appt.locationId}
                      </span>
                    )}
                  </div>
                </div>
                {appt.patientId && appt.status !== 'checked-in' && appt.status !== 'complete' && (
                  <button
                    onClick={(e) => handleCheckInAppt(appt, e)}
                    disabled={checkingInApptId === appt.id}
                    style={{
                      padding: '3px 10px',
                      borderRadius: 999,
                      border: 'none',
                      background: checkedInApptIds.has(appt.id) ? '#16a34a' : '#0d9488',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: checkingInApptId === appt.id ? 'wait' : 'pointer',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      opacity: checkingInApptId === appt.id ? 0.7 : 1,
                      transition: 'background 0.2s',
                    }}
                  >
                    {checkingInApptId === appt.id ? '⏳' : checkedInApptIds.has(appt.id) ? '✓ Checked In' : '✓ Check In'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
