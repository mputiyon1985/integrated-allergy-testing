'use client';

import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-fetch';

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

interface WaitingRoomTileProps {
  waiting: WaitingEntry[];
  nurses: Nurse[];
  serviceColors: Record<string, string>;
  loadWaiting: () => void;
  updateStatus: (id: string, status: string, nurseName?: string) => Promise<void>;
  quickLogEntry: WaitingEntry | null;
  setQuickLogEntry: (entry: WaitingEntry | null) => void;
  quickLogForm: { activityType: string; notes: string };
  setQuickLogForm: (form: { activityType: string; notes: string }) => void;
  updatingId: string | null;
  editingNoteId: string | null;
  setEditingNoteId: (id: string | null) => void;
  editingNoteText: string;
  setEditingNoteText: (text: string) => void;
  editMode: boolean;
  router: ReturnType<typeof useRouter>;
}

function waitTime(checkedInAt: string) {
  const mins = Math.floor((Date.now() - new Date(checkedInAt).getTime()) / 60000);
  if (mins < 1) return 'Just arrived';
  if (mins === 1) return '1 min';
  return `${mins} mins`;
}

function inServiceTime(calledAt: string) {
  const mins = Math.floor((Date.now() - new Date(calledAt).getTime()) / 60000);
  if (mins < 1) return '< 1 min';
  if (mins === 1) return '1 min';
  return `${mins} mins`;
}

export default function WaitingRoomTile({
  waiting,
  nurses,
  serviceColors,
  loadWaiting,
  updateStatus,
  setQuickLogEntry,
  setQuickLogForm,
  updatingId,
  editingNoteId,
  setEditingNoteId,
  editingNoteText,
  setEditingNoteText,
  editMode,
  router,
}: WaitingRoomTileProps) {
  return (
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
                <tr key={e.id}
                  onClick={async () => {
                    if (!e.patientId) return;
                    try {
                      const r = await fetch(`/api/encounters?patientId=${e.patientId}&status=open&limit=1`);
                      if (r.ok) {
                        const d = await r.json();
                        const openEnc = (d.encounters ?? [])[0];
                        if (openEnc?.id) { router.push(`/encounters/${openEnc.id}`); return; }
                      }
                    } catch {}
                    router.push(`/patients/${e.patientId}?action=encounter`);
                  }}
                  style={{ borderBottom: rowBorder, background: rowBg, cursor: e.patientId ? 'pointer' : 'default', transition: 'background 0.15s' }}
                  onMouseEnter={ev => { if (e.patientId) ev.currentTarget.style.background = e.status === 'in-service' ? '#c8f5ef' : '#fef3c7'; }}
                  onMouseLeave={ev => ev.currentTarget.style.background = rowBg}
                >
                  <td style={{ padding: '5px 10px' }}>
                    <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                      {isNew && e.status === 'waiting' && <span style={{ fontSize: 9, background: '#f59e0b', color: '#fff', borderRadius: 4, padding: '1px 5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>NEW</span>}
                      {e.patientName}
                    </div>
                    {editingNoteId === e.id ? (
                      <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
                        <select
                          autoFocus
                          value={editingNoteText}
                          onChange={async ev => {
                            const val = ev.target.value;
                            setEditingNoteText(val);
                            try {
                              await apiFetch(`/api/waiting-room/${e.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notes: val || null }) });
                            } catch {}
                            setEditingNoteId(null);
                            loadWaiting();
                          }}
                          onKeyDown={ev => { if (ev.key === 'Escape') setEditingNoteId(null); }}
                          style={{ fontSize: 11, padding: '2px 6px', border: '1px solid #0d9488', borderRadius: 5, cursor: 'pointer', outline: 'none', background: '#fff' }}
                        >
                          <option value="">— clear reason —</option>
                          {Object.keys(serviceColors).length > 0
                            ? Object.keys(serviceColors).map(name => (
                                <option key={name} value={name}>{name}</option>
                              ))
                            : ['Allergy Shot','Allergy Testing','New Patient Intake','Follow-Up','Consultation','Test Results Review','Immunotherapy Build-Up','Immunotherapy Maintenance'].map(name => (
                                <option key={name} value={name}>{name}</option>
                              ))
                          }
                        </select>
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
                  <td style={{ padding: '5px 10px', fontSize: 12 }} onClick={ev => ev.stopPropagation()}>
                    {e.status === 'in-service' && e.calledAt ? (
                      <div>
                        <div style={{ color: '#0d9488', fontWeight: 700 }}>🩺 {inServiceTime(e.calledAt)}</div>
                        <div style={{ color: '#94a3b8', fontSize: 10 }}>wait: {waitTime(e.checkedInAt)}</div>
                      </div>
                    ) : (
                      <span style={{ color: '#64748b' }}>{waitTime(e.checkedInAt)}</span>
                    )}
                  </td>
                  <td style={{ padding: '5px 10px' }}>
                    {e.videoAckBy ? (
                      <div style={{ fontSize: 11, color: '#15803d', fontWeight: 700 }}>✅ {e.videosWatched ?? 0}</div>
                    ) : (e.videosWatched ?? 0) > 0 ? (
                      <button
                        onClick={async () => {
                          const ackBy = e.nurseName ?? 'Staff';
                          await apiFetch(`/api/waiting-room/${e.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videoAckBy: ackBy }) });
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
                  <td style={{ padding: '5px 10px' }} onClick={ev => ev.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      {e.patientId && (
                        <button
                          onClick={async ev => {
                            ev.stopPropagation();
                            try {
                              const r = await fetch(`/api/encounters?patientId=${e.patientId}&status=open&limit=1`);
                              if (r.ok) {
                                const d = await r.json();
                                const openEnc = (d.encounters ?? [])[0];
                                if (openEnc?.id) { router.push(`/encounters/${openEnc.id}`); return; }
                              }
                            } catch {}
                            router.push(`/patients/${e.patientId}?action=encounter`);
                          }}
                          style={{ padding: '3px 9px', borderRadius: 6, border: '1px solid #6366f1', background: '#eef2ff', color: '#4f46e5', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          🏥 Encounter
                        </button>
                      )}
                      {e.status === 'in-service' && (
                        <>
                          <button onClick={ev => { ev.stopPropagation(); setQuickLogEntry(e); setQuickLogForm({ activityType: 'note', notes: '' }); }}
                            style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid #0d9488', background: '#fff', color: '#0d9488', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            + Log
                          </button>
                          <button onClick={ev => { ev.stopPropagation(); updateStatus(e.id, 'complete'); }}
                            disabled={updatingId === e.id}
                            style={{ padding: '3px 10px', borderRadius: 6, border: 'none', background: '#0055A5', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                            {updatingId === e.id ? '⏳' : '✅ Complete'}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
