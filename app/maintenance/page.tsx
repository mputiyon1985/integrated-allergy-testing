'use client';

import { useEffect, useState, useCallback } from 'react';

interface MaintenanceVial {
  id: string;
  patientId: string;
  patientName: string;
  patientCode: string;
  vialMode: string;
  label: string;
  currentDose: number;
  maxDose: number;
  concentration: string;
  intervalWeeks: number;
  lastShotDate: string | null;
  nextDueDate: string | null;
  expiresAt: string | null;
  notes: string | null;
}

interface ShotModalState {
  vial: MaintenanceVial;
  open: boolean;
}

interface AddModalState {
  open: boolean;
}

interface PatientOption {
  id: string;
  name: string;
  patientId?: string;
}

function getDueStatus(nextDueDate: string | null, lastShotDate: string | null) {
  if (!lastShotDate && !nextDueDate) return 'none';
  if (!nextDueDate) return 'none';
  const now = new Date();
  const due = new Date(nextDueDate);
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 3) return 'due-soon';
  return 'on-schedule';
}

function StatusBadge({ nextDueDate, lastShotDate }: { nextDueDate: string | null; lastShotDate: string | null }) {
  const status = getDueStatus(nextDueDate, lastShotDate);
  const map = {
    none: { icon: '⚪', label: 'No shot yet', color: '#9ca3af', bg: '#f3f4f6' },
    overdue: { icon: '🔴', label: 'Overdue', color: '#dc2626', bg: '#fee2e2' },
    'due-soon': { icon: '🟡', label: 'Due soon', color: '#d97706', bg: '#fef3c7' },
    'on-schedule': { icon: '🟢', label: 'On schedule', color: '#059669', bg: '#d1fae5' },
  };
  const s = map[status];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
      color: s.color, background: s.bg, border: `1px solid ${s.color}30`,
    }}>
      {s.icon} {s.label}
    </span>
  );
}

function formatDate(val: string | null) {
  if (!val) return '—';
  try {
    const d = new Date(val);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return val; }
}

function ReactionButton({ value, current, onClick }: { value: number; current: number; onClick: (v: number) => void }) {
  const colors = ['#059669', '#84cc16', '#f59e0b', '#ef4444', '#7c3aed'];
  const labels = ['0 – None', '1 – Mild', '2 – Moderate', '3 – Severe', '4 – Anaphylaxis'];
  const active = value === current;
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      title={labels[value]}
      style={{
        width: 36, height: 36, borderRadius: 8, border: `2px solid ${colors[value]}`,
        background: active ? colors[value] : 'transparent',
        color: active ? '#fff' : colors[value],
        fontWeight: 700, fontSize: 13, cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {value}
    </button>
  );
}

function ShotModal({ vial, onClose, onSaved }: { vial: MaintenanceVial; onClose: () => void; onSaved: () => void }) {
  const [dose, setDose] = useState(vial.currentDose);
  const [arm, setArm] = useState('Left');
  const [reaction, setReaction] = useState(0);
  const [reactionNotes, setReactionNotes] = useState('');
  const [givenBy, setGivenBy] = useState('');
  const [waitMinutes, setWaitMinutes] = useState(30);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const c = localStorage.getItem('iat_user');
      if (c) setGivenBy(JSON.parse(c)?.name ?? '');
    } catch {}
  }, []);

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/maintenance/${vial.id}/shots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: vial.patientId,
          doseGiven: dose,
          arm,
          reaction,
          reactionNotes: reactionNotes || undefined,
          givenBy: givenBy || undefined,
          givenAt: new Date().toISOString(),
          waitMinutes,
          intervalWeeks: vial.intervalWeeks,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to save');
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: '#0f172a' }}>💉 Record Shot</div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{vial.patientName} — {vial.label}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af' }}>✕</button>
        </div>

        {error && <div style={{ background: '#fee2e2', color: '#dc2626', padding: '8px 12px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>⚠️ {error}</div>}

        <div style={{ display: 'grid', gap: 14 }}>
          {/* Dose */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Dose (ml)</label>
            <input
              type="number"
              min={0.1}
              max={0.5}
              step={0.1}
              value={dose}
              onChange={e => setDose(parseFloat(e.target.value))}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 15, fontWeight: 600, color: '#0d9488' }}
            />
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>Standard: 0.4ml (Dr. Rob Sikora)</div>
          </div>

          {/* Arm */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Arm</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['Left', 'Right'].map(a => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setArm(a)}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 8, border: `2px solid ${arm === a ? '#0d9488' : '#e5e7eb'}`,
                    background: arm === a ? '#0d9488' : '#fff', color: arm === a ? '#fff' : '#374151',
                    fontWeight: 600, fontSize: 14, cursor: 'pointer',
                  }}
                >
                  {a === 'Left' ? '◀ Left' : 'Right ▶'}
                </button>
              ))}
            </div>
          </div>

          {/* Reaction */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Reaction (0–4)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[0, 1, 2, 3, 4].map(v => (
                <ReactionButton key={v} value={v} current={reaction} onClick={setReaction} />
              ))}
            </div>
            {reaction >= 3 && (
              <textarea
                placeholder="Describe reaction (required for grade 3–4)…"
                value={reactionNotes}
                onChange={e => setReactionNotes(e.target.value)}
                style={{ marginTop: 8, width: '100%', padding: '8px 12px', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, resize: 'vertical', minHeight: 60, boxSizing: 'border-box' }}
              />
            )}
          </div>

          {/* Wait time */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Wait Time (min)</label>
            <input
              type="number"
              min={5}
              max={60}
              step={5}
              value={waitMinutes}
              onChange={e => setWaitMinutes(parseInt(e.target.value))}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}
            />
            <div style={{ fontSize: 11, color: '#b45309', marginTop: 4, background: '#fef3c7', padding: '4px 8px', borderRadius: 6 }}>
              ⚠️ AAAAI guidelines require <strong>30-minute</strong> observation post-injection
            </div>
          </div>

          {/* Nurse */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Nurse / Given By</label>
            <input
              type="text"
              value={givenBy}
              onChange={e => setGivenBy(e.target.value)}
              placeholder="Nurse name"
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ flex: 2, padding: '10px 0', borderRadius: 8, border: 'none', background: saving ? '#9ca3af' : '#0d9488', color: '#fff', fontWeight: 700, fontSize: 15, cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            {saving ? 'Saving…' : '💉 Record Shot'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddPatientModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [search, setSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null);
  const [vialMode, setVialMode] = useState<'single' | 'multi'>('single');
  const [vials, setVials] = useState([{ label: 'Set A', concentration: '1:1' }]);
  const [intervalWeeks, setIntervalWeeks] = useState(4);
  const [currentDose, setCurrentDose] = useState(0.4);
  const [expiresAt, setExpiresAt] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/patients').then(r => r.json()).then(d => {
      const list = Array.isArray(d) ? d : (d.patients ?? []);
      setPatients(list);
    }).catch(() => {});
  }, []);

  const filtered = patients.filter(p => {
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.patientId ?? '').toLowerCase().includes(q);
  }).slice(0, 8);

  function addVial() {
    const labels = ['Set A', 'Set B', 'Set C', 'Set D'];
    setVials(v => [...v, { label: labels[v.length] ?? `Set ${v.length + 1}`, concentration: '1:1' }]);
  }

  function updateVial(i: number, field: string, val: string) {
    setVials(v => v.map((item, idx) => idx === i ? { ...item, [field]: val } : item));
  }

  async function handleSave() {
    if (!selectedPatient) return setError('Please select a patient');
    setSaving(true);
    setError('');
    try {
      for (const vial of vials) {
        const res = await fetch('/api/maintenance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patientId: selectedPatient.id,
            vialMode,
            label: vial.label,
            currentDose,
            maxDose: 0.5,
            concentration: vial.concentration,
            intervalWeeks,
            expiresAt: expiresAt || undefined,
            notes: notes || undefined,
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to save');
      }
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#0f172a' }}>➕ Add Patient to Maintenance</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af' }}>✕</button>
        </div>

        {error && <div style={{ background: '#fee2e2', color: '#dc2626', padding: '8px 12px', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>⚠️ {error}</div>}

        <div style={{ display: 'grid', gap: 16 }}>
          {/* Patient search */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Patient *</label>
            {selectedPatient ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '2px solid #0d9488', borderRadius: 8, background: '#f0fdfa' }}>
                <span style={{ fontWeight: 600, color: '#0d9488' }}>{selectedPatient.name}</span>
                <span style={{ fontSize: 12, color: '#6b7280' }}>{selectedPatient.patientId}</span>
                <button onClick={() => setSelectedPatient(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16 }}>✕</button>
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  placeholder="Search patient name or ID…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
                />
                {search && (
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, marginTop: 4, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                    {filtered.length === 0 ? (
                      <div style={{ padding: '10px 12px', fontSize: 13, color: '#9ca3af' }}>No patients found</div>
                    ) : filtered.map(p => (
                      <button key={p.id} onClick={() => { setSelectedPatient(p); setSearch(''); }}
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', background: '#fff', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f0fdfa')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                      >
                        <span style={{ fontWeight: 600 }}>{p.name}</span>
                        <span style={{ color: '#9ca3af', marginLeft: 8, fontSize: 12 }}>{p.patientId}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Vial mode */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Vial Mode</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['single', 'multi'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setVialMode(m); if (m === 'single') setVials([{ label: 'Set A', concentration: '1:1' }]); }}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 8,
                    border: `2px solid ${vialMode === m ? '#0d9488' : '#e5e7eb'}`,
                    background: vialMode === m ? '#0d9488' : '#fff',
                    color: vialMode === m ? '#fff' : '#374151',
                    fontWeight: 600, fontSize: 13, cursor: 'pointer',
                  }}
                >
                  {m === 'single' ? '🧪 Single Vial' : '🧪🧪 Multi-Vial'}
                </button>
              ))}
            </div>
          </div>

          {/* Vials list */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Vial Set(s)</label>
            {vials.map((vial, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  type="text"
                  value={vial.label}
                  onChange={e => updateVial(i, 'label', e.target.value)}
                  placeholder="Label (e.g. Trees/Grasses)"
                  style={{ flex: 2, padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }}
                />
                <select
                  value={vial.concentration}
                  onChange={e => updateVial(i, 'concentration', e.target.value)}
                  style={{ flex: 1, padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }}
                >
                  <option value="1:1">1:1</option>
                  <option value="1:10">1:10</option>
                  <option value="1:100">1:100</option>
                </select>
                {vials.length > 1 && (
                  <button onClick={() => setVials(v => v.filter((_, idx) => idx !== i))}
                    style={{ padding: '0 10px', border: '1px solid #fca5a5', borderRadius: 8, background: '#fff', color: '#ef4444', cursor: 'pointer', fontSize: 16 }}>
                    ✕
                  </button>
                )}
              </div>
            ))}
            {vialMode === 'multi' && vials.length < 4 && (
              <button onClick={addVial}
                style={{ fontSize: 13, color: '#0d9488', background: 'none', border: '1px dashed #0d9488', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', width: '100%' }}>
                + Add vial set
              </button>
            )}
          </div>

          {/* Interval, Dose, Expiry */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Interval</label>
              <select value={intervalWeeks} onChange={e => setIntervalWeeks(Number(e.target.value))}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }}>
                <option value={2}>Every 2 weeks</option>
                <option value={3}>Every 3 weeks</option>
                <option value={4}>Every 4 weeks</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Starting Dose (ml)</label>
              <input type="number" min={0.1} max={0.5} step={0.1} value={currentDose}
                onChange={e => setCurrentDose(parseFloat(e.target.value))}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Vial Expiry Date</label>
            <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Optional clinical notes…"
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, resize: 'vertical', minHeight: 60, boxSizing: 'border-box' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 2, padding: '10px 0', borderRadius: 8, border: 'none', background: saving ? '#9ca3af' : '#0d9488', color: '#fff', fontWeight: 700, fontSize: 15, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving…' : '➕ Add to Maintenance'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MaintenancePage() {
  const [vials, setVials] = useState<MaintenanceVial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [shotModal, setShotModal] = useState<ShotModalState | null>(null);
  const [addModal, setAddModal] = useState<AddModalState | null>(null);
  const [expandedPatients, setExpandedPatients] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/maintenance')
      .then(r => r.json())
      .then(d => setVials(d.vials ?? []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Group vials by patient
  const patientMap = new Map<string, MaintenanceVial[]>();
  for (const v of vials) {
    const key = v.patientId;
    if (!patientMap.has(key)) patientMap.set(key, []);
    patientMap.get(key)!.push(v);
  }

  const now = new Date();
  const todayStr = now.toDateString();

  // Stats
  const totalPatients = patientMap.size;
  const allVials = vials;
  const dueToday = allVials.filter(v => v.nextDueDate && new Date(v.nextDueDate).toDateString() === todayStr).length;
  const overdue = allVials.filter(v => {
    if (!v.nextDueDate) return false;
    return new Date(v.nextDueDate) < now;
  }).length;
  const dueThisWeek = allVials.filter(v => {
    if (!v.nextDueDate) return false;
    const due = new Date(v.nextDueDate);
    const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 7;
  }).length;

  // Filter by search
  const filteredEntries = Array.from(patientMap.entries()).filter(([, pvials]) => {
    const q = search.toLowerCase();
    if (!q) return true;
    const p = pvials[0];
    return p.patientName.toLowerCase().includes(q) || p.patientCode.toLowerCase().includes(q);
  });

  function toggleExpand(patientId: string) {
    setExpandedPatients(s => {
      const n = new Set(s);
      if (n.has(patientId)) n.delete(patientId); else n.add(patientId);
      return n;
    });
  }

  return (
    <>
      {shotModal?.open && (
        <ShotModal
          vial={shotModal.vial}
          onClose={() => setShotModal(null)}
          onSaved={load}
        />
      )}
      {addModal?.open && (
        <AddPatientModal
          onClose={() => setAddModal(null)}
          onSaved={load}
        />
      )}

      <div className="page-header">
        <div>
          <div className="page-title">💉 Maintenance</div>
          <div className="page-subtitle">
            {loading ? 'Loading…' : `${totalPatients} patient${totalPatients !== 1 ? 's' : ''} on maintenance`}
          </div>
        </div>
        <button
          className="btn"
          onClick={() => setAddModal({ open: true })}
          style={{ background: '#0d9488', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}
        >
          ➕ Add Patient
        </button>
      </div>

      <div className="page-body">
        {error && <div className="alert alert-error">⚠️ {error}</div>}

        {/* Stats bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
          {[
            { label: 'Total on Maintenance', value: totalPatients, color: '#0d9488', bg: '#f0fdfa', icon: '🧪' },
            { label: 'Due Today', value: dueToday, color: '#d97706', bg: '#fffbeb', icon: '📅' },
            { label: 'Overdue', value: overdue, color: '#dc2626', bg: '#fef2f2', icon: '🔴' },
            { label: 'Due This Week', value: dueThisWeek, color: '#2563eb', bg: '#eff6ff', icon: '📆' },
          ].map(stat => (
            <div key={stat.label} style={{ background: stat.bg, border: `1px solid ${stat.color}20`, borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.icon} {stat.label}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: stat.color, marginTop: 4 }}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Status legend */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
          {[
            { icon: '🟢', label: 'On schedule (>3 days)', color: '#059669' },
            { icon: '🟡', label: 'Due soon (≤3 days)', color: '#d97706' },
            { icon: '🔴', label: 'Overdue', color: '#dc2626' },
            { icon: '⚪', label: 'No shot recorded', color: '#6b7280' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: s.color, fontWeight: 500 }}>
              {s.icon} {s.label}
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="card mb-6" style={{ marginBottom: 16 }}>
          <div className="search-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="form-input search-input"
              placeholder="Search by patient name or ID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="loading-center"><div className="spinner" /><span>Loading maintenance list…</span></div>
        ) : filteredEntries.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💉</div>
            <div className="empty-state-title">{search ? 'No patients match your search' : 'No patients on maintenance yet'}</div>
            {!search && (
              <div className="empty-state-body">
                <button className="btn" onClick={() => setAddModal({ open: true })} style={{ marginTop: 12 }}>
                  ➕ Add First Patient
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  {['Patient', 'Vial / Set', 'Dose', 'Concentration', 'Interval', 'Last Shot', 'Next Due', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map(([patientId, pvials]) => {
                  const isSingle = pvials[0]?.vialMode === 'single' || pvials.length === 1;
                  const isExpanded = expandedPatients.has(patientId);
                  const primaryVial = pvials[0];

                  if (isSingle) {
                    return (
                      <tr key={patientId} style={{ borderBottom: '1px solid #f1f5f9' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 14 }}>{primaryVial.patientName}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>{primaryVial.patientCode}</div>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ background: '#f0fdfa', color: '#0d9488', padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: '1px solid #99f6e4' }}>
                            {primaryVial.label}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0d9488', fontSize: 15 }}>{primaryVial.currentDose}ml</td>
                        <td style={{ padding: '12px 14px', fontSize: 13, color: '#374151' }}>{primaryVial.concentration}</td>
                        <td style={{ padding: '12px 14px', fontSize: 13, color: '#374151' }}>Every {primaryVial.intervalWeeks}w</td>
                        <td style={{ padding: '12px 14px', fontSize: 13, color: '#374151' }}>{formatDate(primaryVial.lastShotDate)}</td>
                        <td style={{ padding: '12px 14px', fontSize: 13, color: '#374151' }}>{formatDate(primaryVial.nextDueDate)}</td>
                        <td style={{ padding: '12px 14px' }}><StatusBadge nextDueDate={primaryVial.nextDueDate} lastShotDate={primaryVial.lastShotDate} /></td>
                        <td style={{ padding: '12px 14px' }}>
                          <button
                            onClick={() => setShotModal({ vial: primaryVial, open: true })}
                            style={{ padding: '5px 12px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            💉 Give Shot
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  // Multi-vial: header row + expandable sub-rows
                  return [
                    <tr key={`${patientId}-header`} style={{ borderBottom: '1px solid #f1f5f9', background: '#fafffe' }}>
                      <td style={{ padding: '12px 14px' }}>
                        <button onClick={() => toggleExpand(patientId)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                          <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 11, color: '#0d9488' }}>{isExpanded ? '▼' : '▶'}</span>
                            {primaryVial.patientName}
                          </div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>{primaryVial.patientCode}</div>
                        </button>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: '1px solid #bfdbfe' }}>
                          🧪🧪 {pvials.length} vials
                        </span>
                      </td>
                      <td colSpan={5} style={{ padding: '12px 14px', fontSize: 12, color: '#9ca3af' }}>
                        Click to {isExpanded ? 'collapse' : 'expand'} vials
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <StatusBadge
                          nextDueDate={pvials.reduce((earliest, v) => {
                            if (!earliest) return v.nextDueDate;
                            if (!v.nextDueDate) return earliest;
                            return new Date(v.nextDueDate) < new Date(earliest) ? v.nextDueDate : earliest;
                          }, null as string | null)}
                          lastShotDate={pvials[0].lastShotDate}
                        />
                      </td>
                      <td style={{ padding: '12px 14px' }} />
                    </tr>,
                    ...(isExpanded ? pvials.map((vial, vi) => (
                      <tr key={`${patientId}-vial-${vi}`} style={{ borderBottom: '1px solid #f1f5f9', background: '#f8fffe' }}>
                        <td style={{ padding: '8px 14px 8px 28px', fontSize: 12, color: '#6b7280' }}>└ {vial.label}</td>
                        <td style={{ padding: '8px 14px' }}>
                          <span style={{ background: '#f0fdfa', color: '#0d9488', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, border: '1px solid #99f6e4' }}>
                            {vial.label}
                          </span>
                        </td>
                        <td style={{ padding: '8px 14px', fontWeight: 700, color: '#0d9488', fontSize: 14 }}>{vial.currentDose}ml</td>
                        <td style={{ padding: '8px 14px', fontSize: 12, color: '#374151' }}>{vial.concentration}</td>
                        <td style={{ padding: '8px 14px', fontSize: 12, color: '#374151' }}>Every {vial.intervalWeeks}w</td>
                        <td style={{ padding: '8px 14px', fontSize: 12, color: '#374151' }}>{formatDate(vial.lastShotDate)}</td>
                        <td style={{ padding: '8px 14px', fontSize: 12, color: '#374151' }}>{formatDate(vial.nextDueDate)}</td>
                        <td style={{ padding: '8px 14px' }}><StatusBadge nextDueDate={vial.nextDueDate} lastShotDate={vial.lastShotDate} /></td>
                        <td style={{ padding: '8px 14px' }}>
                          <button
                            onClick={() => setShotModal({ vial, open: true })}
                            style={{ padding: '4px 10px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            💉 Give Shot
                          </button>
                        </td>
                      </tr>
                    )) : []),
                  ];
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
