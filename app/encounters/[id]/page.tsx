'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

// ── Types ────────────────────────────────────────────────────
interface EncounterActivity {
  id: string;
  activityType: string;
  performedBy?: string;
  notes?: string;
  soapSubjective?: string;
  soapObjective?: string;
  soapAssessment?: string;
  soapPlan?: string;
  performedAt?: string;
  createdAt?: string;
}

interface Encounter {
  id: string;
  patientId: string;
  encounterDate: string;
  status: string;
  chiefComplaint: string;
  doctorId?: string;
  doctorName?: string;
  nurseId?: string;
  nurseName?: string;
  subjectiveNotes?: string;
  objectiveNotes?: string;
  assessment?: string;
  plan?: string;
  diagnosisCode?: string;
  followUpDays?: number;
  cptSummary?: string;
  signedBy?: string;
  signedAt?: string;
  billedAt?: string;
  waitMinutes?: number;
  inServiceMinutes?: number;
  activities?: EncounterActivity[];
}

interface DoctorOption { id: string; name: string; title?: string; }
interface NurseOption  { id: string; name: string; title?: string; }
interface Icd10Option  { id: string; code: string; description: string; }

// ── Activity Type maps ───────────────────────────────────────
const ACTIVITY_TYPES: { value: string; label: string; icon: string }[] = [
  { value: 'shot',                     label: 'Shot / Injection',          icon: '💊' },
  { value: 'shot_maintenance',         label: 'Maintenance Shot',          icon: '💉' },
  { value: 'allergy_test',             label: 'Allergy Test (Prick)',       icon: '🧪' },
  { value: 'allergy_test_intradermal', label: 'Allergy Test (Intradermal)', icon: '🔬' },
  { value: 'consent_signed',           label: 'Consent Signed',            icon: '📋' },
  { value: 'video_education',          label: 'Video Watched',             icon: '🎬' },
  { value: 'phone_call',               label: 'Phone Call',                icon: '📞' },
  { value: 'telehealth',               label: 'Telehealth Visit',          icon: '💻' },
  { value: 'email',                    label: 'Email',                     icon: '📧' },
  { value: 'in_person_visit',          label: 'In-Person Visit',           icon: '🏥' },
  { value: 'appointment_scheduled',    label: 'Appointment Scheduled',     icon: '📅' },
  { value: 'no_show',                  label: 'No Show',                   icon: '❌' },
  { value: 'note',                     label: 'Note',                      icon: '📝' },
  { value: 'lab_order',                label: 'Lab Order',                 icon: '🔬' },
  { value: 'referral',                 label: 'Referral',                  icon: '🔗' },
  { value: 'prescription',             label: 'Prescription',              icon: '📃' },
  { value: 'kiosk_checkin',            label: 'Kiosk Check-in',            icon: '🖥️' },
];
const ACTIVITY_ICON: Record<string, string> = Object.fromEntries(ACTIVITY_TYPES.map(t => [t.value, t.icon]));
const ACTIVITY_LABEL: Record<string, string> = Object.fromEntries(ACTIVITY_TYPES.map(t => [t.value, t.label]));
const SOAP_TYPES = new Set(['in_person_visit', 'telehealth', 'phone_call']);

const ENC_STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  open:        { bg: '#fef9c3', color: '#b45309', label: 'Open' },
  complete:    { bg: '#dcfce7', color: '#15803d', label: 'Complete' },
  awaiting_md: { bg: '#eff6ff', color: '#1d4ed8', label: 'Awaiting MD' },
  signed:      { bg: '#f5f3ff', color: '#7c3aed', label: 'Signed' },
  billed:      { bg: '#ecfdf5', color: '#065f46', label: 'Billed' },
  cancelled:   { bg: '#f3f4f6', color: '#64748b', label: 'Cancelled' },
};

function fmtTime(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const h = d.getHours() % 12 || 12;
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m} ${d.getHours() >= 12 ? 'PM' : 'AM'}`;
}

function fmtDateTime(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + fmtTime(iso);
}

// ── Inline editable textarea / input ────────────────────────
function InlineField({
  label, value, multiline = false, rows = 2, onSave,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  rows?: number;
  onSave: (val: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft(value); }, [value]);

  async function handleBlur() {
    if (draft === value) { setEditing(false); return; }
    setSaving(true);
    await onSave(draft);
    setSaving(false);
    setEditing(false);
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
      {editing ? (
        multiline ? (
          <textarea
            autoFocus
            rows={rows}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={handleBlur}
            style={{ width: '100%', fontSize: 13, padding: '6px 10px', borderRadius: 7, border: '1px solid #0d9488', outline: 'none', resize: 'vertical', lineHeight: 1.5, boxSizing: 'border-box' }}
          />
        ) : (
          <input
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={handleBlur}
            style={{ width: '100%', fontSize: 13, padding: '6px 10px', borderRadius: 7, border: '1px solid #0d9488', outline: 'none', boxSizing: 'border-box' }}
          />
        )
      ) : (
        <div
          onClick={() => { setDraft(value); setEditing(true); }}
          style={{
            fontSize: 13,
            color: value ? '#1a2233' : '#94a3b8',
            cursor: 'text',
            padding: '6px 10px',
            borderRadius: 7,
            border: '1px solid transparent',
            minHeight: multiline ? `${rows * 22 + 12}px` : 'auto',
            whiteSpace: 'pre-wrap',
            lineHeight: 1.6,
            transition: 'border-color 0.15s, background 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#f8fafc'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent'; }}
        >
          {saving ? '⏳ Saving…' : (value || `Click to add ${label.toLowerCase()}…`)}
        </div>
      )}
    </div>
  );
}

// ── Add Activity Modal ───────────────────────────────────────
function AddActivityModal({
  encounterId,
  patientId,
  nurseName: defaultNurseName,
  onClose,
  onSaved,
}: {
  encounterId: string;
  patientId: string;
  nurseName?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    activityType: 'note',
    performedBy: defaultNurseName ?? '',
    notes: '',
    soapSubjective: '',
    soapObjective: '',
    soapAssessment: '',
    soapPlan: '',
  });
  const [nurses, setNurses] = useState<NurseOption[]>([]);
  const [saving, setSaving] = useState(false);
  const showSoap = SOAP_TYPES.has(form.activityType);

  useEffect(() => {
    let locId = '';
    try { locId = localStorage.getItem('iat_active_location') ?? ''; } catch {}
    (() => { let lp = ''; try { const l = localStorage.getItem('iat_active_location'); if (l) lp = `&locationId=${l}`; } catch {} return fetch(`/api/nurses?all=1${lp}`); })().then(r => r.ok ? r.json() : []).then(d => {
      const all: (NurseOption & { active?: boolean; locationId?: string | null })[] =
        Array.isArray(d) ? d : (d.nurses ?? []);
      const filtered = locId ? all.filter(n => !n.locationId || n.locationId === locId) : all;
      setNurses(filtered.filter(n => n.active !== false));
    }).catch(() => {});
  }, []);

  async function submit() {
    setSaving(true);
    await fetch('/api/encounter-activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encounterId, patientId, ...form }),
    });
    setSaving(false);
    onSaved();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>➕ Add Activity</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}>✕</button>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Activity Type *</label>
            <select className="form-input" value={form.activityType} onChange={e => setForm(p => ({ ...p, activityType: e.target.value }))}>
              {ACTIVITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Performed By</label>
            {nurses.length > 0 ? (
              <select className="form-input" value={form.performedBy} onChange={e => setForm(p => ({ ...p, performedBy: e.target.value }))}>
                <option value="">— Select Nurse / Tech —</option>
                {nurses.map(n => <option key={n.id} value={n.name}>{n.title ? `${n.name}, ${n.title}` : n.name}</option>)}
              </select>
            ) : (
              <input className="form-input" value={form.performedBy} placeholder="e.g. RN Michelle Roman" onChange={e => setForm(p => ({ ...p, performedBy: e.target.value }))} />
            )}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Notes</label>
            <textarea className="form-input" rows={3} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} style={{ resize: 'vertical' }} />
          </div>
          {showSoap && (
            <>
              <div style={{ fontWeight: 700, fontSize: 12, color: '#0d9488', textTransform: 'uppercase', borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>SOAP Notes</div>
              {(['soapSubjective', 'soapObjective', 'soapAssessment', 'soapPlan'] as const).map(k => (
                <div key={k}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>
                    {{ soapSubjective: 'Subjective', soapObjective: 'Objective', soapAssessment: 'Assessment', soapPlan: 'Plan' }[k]}
                  </label>
                  <textarea className="form-input" rows={2} value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} style={{ resize: 'vertical' }} />
                </div>
              ))}
            </>
          )}
        </div>
        <div style={{ padding: '14px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#0d9488', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
            {saving ? '⏳ Saving…' : '💾 Save Activity'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Inline-editable Activity Row ─────────────────────────────
function ActivityRow({
  act,
  onUpdated,
}: {
  act: EncounterActivity;
  onUpdated: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [soapOpen, setSoapOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    activityType: act.activityType,
    performedBy: act.performedBy ?? '',
    notes: act.notes ?? '',
    soapSubjective: act.soapSubjective ?? '',
    soapObjective: act.soapObjective ?? '',
    soapAssessment: act.soapAssessment ?? '',
    soapPlan: act.soapPlan ?? '',
  });

  const icon  = ACTIVITY_ICON[act.activityType]  ?? '📝';
  const label = ACTIVITY_LABEL[act.activityType] ?? act.activityType;
  const ts    = act.performedAt ?? act.createdAt;
  const hasSoap = act.soapSubjective || act.soapObjective || act.soapAssessment || act.soapPlan;
  const editShowSoap = SOAP_TYPES.has(editForm.activityType);

  async function saveEdit() {
    setSaving(true);
    try {
      await fetch(`/api/encounter-activities/${act.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      onUpdated();
      setEditing(false);
    } catch {}
    setSaving(false);
  }

  if (editing) {
    return (
      <div style={{ padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select
              value={editForm.activityType}
              onChange={e => setEditForm(p => ({ ...p, activityType: e.target.value }))}
              style={{ fontSize: 12, padding: '5px 8px', borderRadius: 7, border: '1px solid #e2e8f0', flex: 1, minWidth: 160 }}
            >
              {ACTIVITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
            </select>
            <input
              value={editForm.performedBy}
              onChange={e => setEditForm(p => ({ ...p, performedBy: e.target.value }))}
              placeholder="Performed by"
              style={{ fontSize: 12, padding: '5px 8px', borderRadius: 7, border: '1px solid #e2e8f0', flex: 1, minWidth: 140 }}
            />
          </div>
          <textarea
            value={editForm.notes}
            onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
            rows={3}
            placeholder="Notes"
            style={{ fontSize: 13, padding: '7px 10px', borderRadius: 7, border: '1px solid #e2e8f0', resize: 'vertical' }}
          />
          {editShowSoap && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {([
                ['soapSubjective', 'Subjective'],
                ['soapObjective', 'Objective'],
                ['soapAssessment', 'Assessment'],
                ['soapPlan', 'Plan'],
              ] as [keyof typeof editForm, string][]).map(([key, lbl]) => (
                <textarea
                  key={key}
                  value={editForm[key]}
                  onChange={e => setEditForm(p => ({ ...p, [key]: e.target.value }))}
                  rows={2}
                  placeholder={lbl}
                  style={{ fontSize: 12, padding: '6px 8px', borderRadius: 7, border: '1px solid #e2e8f0', resize: 'vertical' }}
                />
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button onClick={() => setEditing(false)} style={{ padding: '5px 14px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
            <button onClick={saveEdit} disabled={saving} style={{ padding: '5px 14px', borderRadius: 7, border: 'none', background: '#0d9488', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
              {saving ? '⏳' : '💾 Save'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid #f1f5f9', alignItems: 'flex-start' }}>
      <div style={{ fontSize: 20, lineHeight: 1, paddingTop: 2, minWidth: 26, textAlign: 'center' }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: '#94a3b8', minWidth: 72, fontVariantNumeric: 'tabular-nums' }}>{fmtTime(ts)}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#1a2233' }}>{label}</span>
          {act.performedBy && <span style={{ fontSize: 12, color: '#64748b' }}>— {act.performedBy}</span>}
        </div>
        {act.notes && (
          <div style={{ fontSize: 13, color: '#374151', marginTop: 4, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{act.notes}</div>
        )}
        {hasSoap && (
          <div style={{ marginTop: 6 }}>
            <button onClick={() => setSoapOpen(v => !v)} style={{ background: 'none', border: 'none', color: '#7c3aed', fontSize: 12, cursor: 'pointer', fontWeight: 600, padding: 0 }}>
              {soapOpen ? '▼ Hide SOAP' : '▶ SOAP Notes'}
            </button>
            {soapOpen && (
              <div style={{ marginTop: 6, background: '#f5f3ff', borderRadius: 8, padding: '10px 12px', fontSize: 12, lineHeight: 1.6 }}>
                {act.soapSubjective && <div style={{ marginBottom: 4 }}><strong style={{ color: '#7c3aed' }}>S:</strong> {act.soapSubjective}</div>}
                {act.soapObjective  && <div style={{ marginBottom: 4 }}><strong style={{ color: '#7c3aed' }}>O:</strong> {act.soapObjective}</div>}
                {act.soapAssessment && <div style={{ marginBottom: 4 }}><strong style={{ color: '#7c3aed' }}>A:</strong> {act.soapAssessment}</div>}
                {act.soapPlan       && <div><strong style={{ color: '#7c3aed' }}>P:</strong> {act.soapPlan}</div>}
              </div>
            )}
          </div>
        )}
      </div>
      <button
        onClick={() => setEditing(true)}
        title="Edit activity"
        style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 14, cursor: 'pointer', padding: '2px 4px', flexShrink: 0 }}
      >✏️</button>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────
export default function EncounterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAddActivity, setShowAddActivity] = useState(false);

  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [nurses, setNurses] = useState<NurseOption[]>([]);
  const [icd10Options, setIcd10Options] = useState<Icd10Option[]>([]);

  const loadEncounter = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/encounters/${id}`);
      if (!r.ok) throw new Error(r.status === 401 ? 'session_expired' : `HTTP ${r.status}`);
      const data = await r.json();
      setEncounter(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg === 'session_expired' ? 'Session expired — please log in again' : `Failed to load encounter: ${msg}`);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { loadEncounter(); }, [loadEncounter]);

  // Load doctors, nurses, ICD-10 for dropdowns
  useEffect(() => {
    let locId = '';
    try { locId = localStorage.getItem('iat_active_location') ?? ''; } catch {}

    (() => { let lp = ''; try { const l = localStorage.getItem('iat_active_location'); if (l) lp = `&locationId=${l}`; } catch {} return fetch(`/api/doctors?all=1${lp}`); })().then(r => r.ok ? r.json() : { doctors: [] }).then(d => {
      const all: (DoctorOption & { active?: boolean; locationId?: string | null })[] =
        Array.isArray(d) ? d : (d.doctors ?? []);
      const filtered = locId ? all.filter(x => !x.locationId || x.locationId === locId) : all;
      setDoctors(filtered.filter(x => x.active !== false));
    }).catch(() => {});

    (() => { let lp = ''; try { const l = localStorage.getItem('iat_active_location'); if (l) lp = `&locationId=${l}`; } catch {} return fetch(`/api/nurses?all=1${lp}`); })().then(r => r.ok ? r.json() : []).then(d => {
      const all: (NurseOption & { active?: boolean; locationId?: string | null })[] =
        Array.isArray(d) ? d : (d.nurses ?? []);
      const filtered = locId ? all.filter(x => !x.locationId || x.locationId === locId) : all;
      setNurses(filtered.filter(x => x.active !== false));
    }).catch(() => {});

    fetch('/api/icd10-codes?all=true').then(r => r.ok ? r.json() : { codes: [] }).then(d => {
      setIcd10Options(d.codes ?? []);
    }).catch(() => {});
  }, []);

  async function patchEncounter(fields: Partial<Encounter>) {
    if (!encounter) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/encounters/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      if (r.ok) {
        const data = await r.json();
        setEncounter(prev => prev ? { ...prev, ...data.encounter, activities: prev.activities } : prev);
      }
    } catch {}
    setSaving(false);
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (error || !encounter) {
    return (
      <div style={{ maxWidth: 600, margin: '60px auto', padding: 24 }}>
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: 20, color: '#b91c1c', fontSize: 14 }}>
          🚨 {error ?? 'Encounter not found'}
        </div>
        <button onClick={() => router.back()} style={{ marginTop: 16, padding: '8px 18px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>
          ← Back
        </button>
      </div>
    );
  }

  const statusStyle = ENC_STATUS_STYLES[encounter.status] ?? ENC_STATUS_STYLES.open;
  const activities = (encounter.activities ?? [])
    .slice()
    .sort((a, b) => new Date(a.performedAt ?? a.createdAt ?? 0).getTime() - new Date(b.performedAt ?? b.createdAt ?? 0).getTime());

  const encDate = new Date(encounter.encounterDate);
  const encDateLabel = encDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', paddingBottom: 48 }}>
      {/* Top nav bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.back()}
          style={{ background: 'none', border: 'none', color: '#0d9488', fontWeight: 700, fontSize: 14, cursor: 'pointer', padding: 0 }}>
          ← Back
        </button>
        <div style={{ flex: 1 }} />
        {saving && <span style={{ fontSize: 12, color: '#0d9488', fontWeight: 600 }}>⏳ Saving…</span>}
        <a href={`/api/encounters/${id}/pdf`} target="_blank" rel="noopener noreferrer"
          style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#64748b', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>
          📄 PDF
        </a>
        <Link href={`/patients/${encounter.patientId}`}
          style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
          👤 Patient Chart
        </Link>
      </div>

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '20px 32px' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: '#1a2233' }}>{encounter.chiefComplaint}</span>
              <span style={{
                fontSize: 12, fontWeight: 700, padding: '3px 12px', borderRadius: 999,
                background: statusStyle.bg, color: statusStyle.color, textTransform: 'uppercase', whiteSpace: 'nowrap'
              }}>{statusStyle.label}</span>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#64748b', flexWrap: 'wrap' }}>
              <span>📅 {encDateLabel}</span>
              {encounter.doctorName && <span>👨‍⚕️ {encounter.doctorName}</span>}
              {encounter.nurseName  && <span>👩‍⚕️ {encounter.nurseName}</span>}
              {encounter.waitMinutes != null && <span>⏱ Wait: {encounter.waitMinutes}m</span>}
              {encounter.inServiceMinutes != null && <span>🩺 In-service: {encounter.inServiceMinutes}m</span>}
            </div>
          </div>
          {/* Quick status toggle */}
          <select
            value={encounter.status}
            onChange={e => {
              const newStatus = e.target.value;
              setEncounter(prev => prev ? { ...prev, status: newStatus } : prev);
              patchEncounter({ status: newStatus });
            }}
            style={{ fontSize: 13, fontWeight: 700, padding: '6px 12px', borderRadius: 8, border: `2px solid ${statusStyle.color}`, color: statusStyle.color, background: statusStyle.bg, cursor: 'pointer' }}
          >
            <option value="open">Open</option>
            <option value="awaiting_md">Awaiting MD</option>
            <option value="complete">Complete</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Body: two-column layout */}
      <div style={{ maxWidth: 1200, margin: '24px auto', padding: '0 24px', display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 24, alignItems: 'start' }}>

        {/* ─── Left: Editable Encounter Info ─────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Encounter details card */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#1a2233', marginBottom: 16, borderBottom: '1px solid #f1f5f9', paddingBottom: 10 }}>
              📋 Encounter Details
            </div>

            <InlineField
              label="Chief Complaint"
              value={encounter.chiefComplaint}
              multiline
              rows={2}
              onSave={v => patchEncounter({ chiefComplaint: v })}
            />

            {/* Physician dropdown */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Physician</div>
              <select
                value={encounter.doctorName ?? ''}
                onChange={e => {
                  const v = e.target.value;
                  setEncounter(prev => prev ? { ...prev, doctorName: v } : prev);
                  patchEncounter({ doctorName: v });
                }}
                style={{ width: '100%', fontSize: 13, padding: '6px 10px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer' }}
              >
                <option value="">— Select Physician —</option>
                {doctors.map(d => <option key={d.id} value={d.name}>{d.title ? `${d.name}, ${d.title}` : d.name}</option>)}
              </select>
            </div>

            {/* Nurse dropdown */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Nurse / Tech</div>
              <select
                value={encounter.nurseName ?? ''}
                onChange={e => {
                  const v = e.target.value;
                  setEncounter(prev => prev ? { ...prev, nurseName: v } : prev);
                  patchEncounter({ nurseName: v });
                }}
                style={{ width: '100%', fontSize: 13, padding: '6px 10px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer' }}
              >
                <option value="">— Select Nurse / Tech —</option>
                {nurses.map(n => <option key={n.id} value={n.name}>{n.title ? `${n.name}, ${n.title}` : n.name}</option>)}
              </select>
            </div>

            {/* Diagnosis Code (ICD-10) */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Diagnosis Code (ICD-10)</div>
              <select
                value={encounter.diagnosisCode ?? ''}
                onChange={e => {
                  const v = e.target.value;
                  setEncounter(prev => prev ? { ...prev, diagnosisCode: v } : prev);
                  patchEncounter({ diagnosisCode: v });
                }}
                style={{ width: '100%', fontSize: 13, padding: '6px 10px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer' }}
              >
                <option value="">— Select ICD-10 Code —</option>
                {icd10Options.map(c => <option key={c.id} value={c.code}>{c.code} — {c.description}</option>)}
                {icd10Options.length === 0 && encounter.diagnosisCode && (
                  <option value={encounter.diagnosisCode}>{encounter.diagnosisCode}</option>
                )}
              </select>
            </div>
          </div>

          {/* SOAP card */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#1a2233', marginBottom: 16, borderBottom: '1px solid #f1f5f9', paddingBottom: 10 }}>
              🩺 Clinical Notes (SOAP)
            </div>
            <InlineField label="Subjective" value={encounter.subjectiveNotes ?? ''} multiline rows={3} onSave={v => patchEncounter({ subjectiveNotes: v })} />
            <InlineField label="Objective"  value={encounter.objectiveNotes  ?? ''} multiline rows={3} onSave={v => patchEncounter({ objectiveNotes:  v })} />
            <InlineField label="Assessment" value={encounter.assessment       ?? ''} multiline rows={3} onSave={v => patchEncounter({ assessment:       v })} />
            <InlineField label="Plan"       value={encounter.plan             ?? ''} multiline rows={3} onSave={v => patchEncounter({ plan:             v })} />
          </div>

          {/* Metadata card */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#64748b', marginBottom: 12 }}>ℹ️ Encounter Info</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px', fontSize: 12, color: '#374151' }}>
              <div><span style={{ color: '#94a3b8' }}>ID:</span> <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{id.slice(0, 8)}…</span></div>
              <div><span style={{ color: '#94a3b8' }}>Status:</span> <strong>{statusStyle.label}</strong></div>
              {encounter.signedBy  && <div style={{ gridColumn: '1/-1' }}><span style={{ color: '#94a3b8' }}>Signed by:</span> {encounter.signedBy} — {fmtDateTime(encounter.signedAt)}</div>}
              {encounter.billedAt  && <div style={{ gridColumn: '1/-1' }}><span style={{ color: '#94a3b8' }}>Billed:</span> {fmtDateTime(encounter.billedAt)}</div>}
              {encounter.cptSummary && <div style={{ gridColumn: '1/-1' }}><span style={{ color: '#94a3b8' }}>CPT:</span> {encounter.cptSummary}</div>}
            </div>
          </div>
        </div>

        {/* ─── Right: Activity Timeline ───────────────────────── */}
        <div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Timeline header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#1a2233' }}>
                📋 Activity Timeline
                <span style={{ marginLeft: 8, fontSize: 12, color: '#94a3b8', fontWeight: 400 }}>({activities.length} activities)</span>
              </div>
              <button
                onClick={() => setShowAddActivity(true)}
                style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#0d9488', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                + Add Activity
              </button>
            </div>

            {/* Activities */}
            <div style={{ padding: '0 20px', maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }}>
              {activities.length === 0 ? (
                <div style={{ padding: '32px 0', textAlign: 'center', color: '#94a3b8' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
                  <div style={{ fontSize: 14 }}>No activities yet</div>
                  <button onClick={() => setShowAddActivity(true)}
                    style={{ marginTop: 12, padding: '6px 16px', borderRadius: 8, border: 'none', background: '#0d9488', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    Log First Activity
                  </button>
                </div>
              ) : (
                activities.map(a => (
                  <ActivityRow
                    key={a.id}
                    act={a}
                    onUpdated={loadEncounter}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {showAddActivity && (
        <AddActivityModal
          encounterId={id}
          patientId={encounter.patientId}
          nurseName={encounter.nurseName}
          onClose={() => setShowAddActivity(false)}
          onSaved={() => { setShowAddActivity(false); loadEncounter(); }}
        />
      )}
    </div>
  );
}
