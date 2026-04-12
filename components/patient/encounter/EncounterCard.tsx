'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getLocationParam } from '@/lib/location-params';
import { apiFetch } from '@/lib/api-fetch';

// ── Activity Type constants ──────────────────────────────────
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

const ENC_STATUS: Record<string, { bg: string; color: string }> = {
  open:        { bg: '#fef9c3', color: '#b45309' },
  complete:    { bg: '#dcfce7', color: '#15803d' },
  awaiting_md: { bg: '#eff6ff', color: '#1d4ed8' },
  signed:      { bg: '#f5f3ff', color: '#7c3aed' },
  billed:      { bg: '#ecfdf5', color: '#065f46' },
  cancelled:   { bg: '#f3f4f6', color: '#64748b' },
};

// ── Types ───────────────────────────────────────────────────
export interface EncounterActivity {
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

export interface EncounterRecord {
  id: string;
  encounterDate: string;
  doctorName?: string;
  nurseName?: string;
  chiefComplaint: string;
  assessment?: string;
  plan?: string;
  status: string;
  activities?: EncounterActivity[];
}

interface ClaimData {
  claimId: string;
  encounterId: string;
  patientName: string;
  patientId: string;
  dob: string;
  insuranceProvider: string;
  memberId: string;
  groupNumber: string;
  dateOfService: string;
  renderingProvider: string;
  renderingProviderNPI: string;
  diagnosisCodes: string[];
  cptCodes: { code: string; description: string; units: number; fee: number; total: number }[];
  totalCharges: number;
  placeOfService: string;
  claimGeneratedAt: string;
  status: string;
}

// ── Helpers ─────────────────────────────────────────────────
function fmtTime(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const h = d.getHours() % 12 || 12;
  const m = String(d.getMinutes()).padStart(2, '0');
  const ap = d.getHours() >= 12 ? 'PM' : 'AM';
  return `${h}:${m} ${ap}`;
}

function fmtDateLabel(iso: string) {
  try {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Today';
    const yest = new Date(today); yest.setDate(today.getDate() - 1);
    if (d.toDateString() === yest.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch { return iso; }
}

// ── Activity Item ────────────────────────────────────────────
function ActivityItem({
  act,
  onUpdated,
}: {
  act: EncounterActivity;
  onUpdated: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [soapOpen, setSoapOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    activityType: act.activityType,
    performedBy: act.performedBy ?? '',
    notes: act.notes ?? '',
    soapSubjective: act.soapSubjective ?? '',
    soapObjective: act.soapObjective ?? '',
    soapAssessment: act.soapAssessment ?? '',
    soapPlan: act.soapPlan ?? '',
  });

  const icon = ACTIVITY_ICON[act.activityType] ?? '📝';
  const label = ACTIVITY_LABEL[act.activityType] ?? act.activityType;
  const ts = act.performedAt ?? act.createdAt;
  const truncNote = act.notes && act.notes.length > 100 ? act.notes.slice(0, 100) + '…' : act.notes;
  const hasFullNote = (act.notes?.length ?? 0) > 100;
  const hasSoap = act.soapSubjective || act.soapObjective || act.soapAssessment || act.soapPlan;
  const showSoap = SOAP_TYPES.has(editForm.activityType);

  async function saveEdit() {
    setSaving(true);
    try {
      await apiFetch(`/api/encounter-activities/${act.id}`, {
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
      <div style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: '#f8fafc', borderRadius: 10, padding: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              value={editForm.activityType}
              onChange={e => setEditForm(p => ({ ...p, activityType: e.target.value }))}
              style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid #e2e8f0', flex: 1 }}
            >
              {ACTIVITY_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
              ))}
            </select>
            <input
              value={editForm.performedBy}
              onChange={e => setEditForm(p => ({ ...p, performedBy: e.target.value }))}
              placeholder="Performed by"
              style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid #e2e8f0', flex: 1 }}
            />
          </div>
          <textarea
            value={editForm.notes}
            onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
            rows={2}
            placeholder="Notes"
            style={{ fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0', resize: 'vertical' }}
          />
          {showSoap && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
                  style={{ fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0', resize: 'vertical' }}
                />
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setEditing(false)}
              style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
            >Cancel</button>
            <button
              onClick={saveEdit}
              disabled={saving}
              style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: '#0d9488', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}
            >{saving ? '⏳' : '💾 Save'}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ fontSize: 18, lineHeight: 1, paddingTop: 2, minWidth: 24, textAlign: 'center' }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#94a3b8', minWidth: 72, fontVariantNumeric: 'tabular-nums' }}>{fmtTime(ts)}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1a2233' }}>{label}</span>
          {act.performedBy && <span style={{ fontSize: 12, color: '#64748b' }}>— {act.performedBy}</span>}
          <button
            onClick={() => setEditing(true)}
            title="Edit activity"
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#94a3b8', fontSize: 13, cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}
          >✏️</button>
        </div>
        {act.notes && (
          <div style={{ fontSize: 13, color: '#374151', marginTop: 3 }}>
            {expanded ? act.notes : truncNote}
            {hasFullNote && (
              <button onClick={() => setExpanded(v => !v)} style={{ marginLeft: 6, background: 'none', border: 'none', color: '#0d9488', fontSize: 12, cursor: 'pointer', fontWeight: 600, padding: 0 }}>
                {expanded ? 'Show less' : 'Read more'}
              </button>
            )}
          </div>
        )}
        {hasSoap && (
          <div style={{ marginTop: 6 }}>
            <button onClick={() => setSoapOpen(v => !v)} style={{ background: 'none', border: 'none', color: '#7c3aed', fontSize: 12, cursor: 'pointer', fontWeight: 600, padding: 0 }}>
              {soapOpen ? '▼ Hide SOAP' : '▶ SOAP Notes'}
            </button>
            {soapOpen && (
              <div style={{ marginTop: 8, background: '#f5f3ff', borderRadius: 8, padding: '10px 12px', fontSize: 12 }}>
                {act.soapSubjective && <div style={{ marginBottom: 6 }}><strong style={{ color: '#7c3aed' }}>S:</strong> {act.soapSubjective}</div>}
                {act.soapObjective  && <div style={{ marginBottom: 6 }}><strong style={{ color: '#7c3aed' }}>O:</strong> {act.soapObjective}</div>}
                {act.soapAssessment && <div style={{ marginBottom: 6 }}><strong style={{ color: '#7c3aed' }}>A:</strong> {act.soapAssessment}</div>}
                {act.soapPlan       && <div><strong style={{ color: '#7c3aed' }}>P:</strong> {act.soapPlan}</div>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Add Activity Modal ───────────────────────────────────────
function AddActivityModal({
  encounterId, patientId, nurseName: defaultNurseName, onClose, onSaved,
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
  const [nurses, setNurses] = useState<{ id: string; name: string; title?: string; locationId?: string | null }[]>([]);
  const [cptCodes, setCptCodes] = useState<{ id: string; code: string; description: string }[]>([]);
  const [cptInput, setCptInput] = useState('');
  const [saving, setSaving] = useState(false);
  const showSoap = SOAP_TYPES.has(form.activityType);

  useEffect(() => {
    const locId = (() => { try { return localStorage.getItem('iat_active_location') ?? ''; } catch { return ''; } })();

    fetch(`/api/nurses?all=1${getLocationParam('&')}`).then(r => r.ok ? r.json() : []).then(d => {
      const all: { id: string; name: string; title?: string; locationId?: string | null; active?: boolean }[] =
        Array.isArray(d) ? d : (d.nurses ?? []);
      const filtered = locId ? all.filter(n => !n.locationId || n.locationId === locId) : all;
      setNurses(filtered.filter(n => n.active !== false));
    }).catch(() => {});

    fetch('/api/cpt-codes').then(r => r.ok ? r.json() : { codes: [] }).then(d => setCptCodes(d.codes ?? [])).catch(() => {});
  }, []);

  async function submit() {
    setSaving(true);
    const notesWithCpt = cptInput.trim()
      ? (form.notes ? form.notes + '\nCPT: ' + cptInput.trim() : 'CPT: ' + cptInput.trim())
      : form.notes;
    await apiFetch('/api/encounter-activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encounterId, patientId, ...form, notes: notesWithCpt }),
    });
    setSaving(false);
    onSaved();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>➕ Add Activity</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}>✕</button>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Activity Type *</label>
            <select className="form-input" value={form.activityType} onChange={e => setForm(p => ({ ...p, activityType: e.target.value }))}>
              {ACTIVITY_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
              ))}
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
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>CPT Codes</label>
            <input className="form-input" list="cpt-list-modal" value={cptInput}
              onChange={e => setCptInput(e.target.value)}
              placeholder="e.g. 95004, 99213" />
            <datalist id="cpt-list-modal">
              {cptCodes.map(c => <option key={c.id} value={c.code}>{c.code} — {c.description}</option>)}
            </datalist>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Comma-separated. Appended to notes as &quot;CPT: …&quot;</div>
          </div>
          {showSoap && (
            <>
              <div style={{ fontWeight: 700, fontSize: 12, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.05em', paddingTop: 4, borderTop: '1px solid #e2e8f0' }}>SOAP Notes</div>
              {[
                { label: 'Subjective (Patient reports)', key: 'soapSubjective' },
                { label: 'Objective (Clinical observations)', key: 'soapObjective' },
                { label: 'Assessment / Diagnosis', key: 'soapAssessment' },
                { label: 'Plan / Treatment', key: 'soapPlan' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>{f.label}</label>
                  <textarea className="form-input" rows={2} value={(form as Record<string, string>)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} style={{ resize: 'vertical' }} />
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

// ── Claim Modal ──────────────────────────────────────────────
function ClaimModal({ encounterId, onClose }: { encounterId: string; onClose: () => void }) {
  const [claim, setClaim] = useState<ClaimData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    apiFetch(`/api/encounters/${encounterId}/claim`, { method: 'POST' })
      .then(async r => {
        if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? 'Failed'); }
        return r.json();
      })
      .then(d => { setClaim(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [encounterId]);

  function handleCopy() {
    if (!claim) return;
    navigator.clipboard.writeText(JSON.stringify(claim, null, 2)).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleDownload() {
    if (!claim) return;
    const blob = new Blob([JSON.stringify(claim, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `claim-${claim.claimId}-${claim.dateOfService.replace(/\//g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: 620, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>🧾 Claim Summary</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}>✕</button>
        </div>
        <div style={{ padding: 24 }}>
          {loading && <div style={{ textAlign: 'center', padding: 32, color: '#64748b' }}>⏳ Generating claim…</div>}
          {error && <div style={{ color: '#b91c1c', background: '#fef2f2', borderRadius: 8, padding: 12 }}>❌ {error}</div>}
          {claim && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0d9488', background: '#e8f9f7', padding: '2px 10px', borderRadius: 999 }}>Claim ID: {claim.claimId}</span>
                <span style={{ fontSize: 12, color: '#64748b' }}>Generated {new Date(claim.claimGeneratedAt).toLocaleString('en-US')}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', marginBottom: 8 }}>Patient</div>
                  {[['Name', claim.patientName], ['Patient ID', claim.patientId], ['Date of Birth', claim.dob]].map(([l, v]) => (
                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0', borderBottom: '1px solid #e2e8f0' }}>
                      <span style={{ color: '#64748b' }}>{l}</span>
                      <span style={{ fontWeight: 600, color: '#1a2233' }}>{v}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', marginBottom: 8 }}>Insurance</div>
                  {[['Provider', claim.insuranceProvider], ['Member ID', claim.memberId], ['Group #', claim.groupNumber]].map(([l, v]) => (
                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0', borderBottom: '1px solid #e2e8f0' }}>
                      <span style={{ color: '#64748b' }}>{l}</span>
                      <span style={{ fontWeight: 600, color: '#1a2233' }}>{v}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', marginBottom: 8 }}>Service</div>
                  {[['Date of Service', claim.dateOfService], ['Place of Service', claim.placeOfService], ['Provider', claim.renderingProvider], ['NPI', claim.renderingProviderNPI]].map(([l, v]) => (
                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0', borderBottom: '1px solid #e2e8f0' }}>
                      <span style={{ color: '#64748b' }}>{l}</span>
                      <span style={{ fontWeight: 600, color: '#1a2233' }}>{v}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#ea580c', textTransform: 'uppercase', marginBottom: 8 }}>Diagnosis</div>
                  {claim.diagnosisCodes.length > 0
                    ? claim.diagnosisCodes.map(c => (
                        <div key={c} style={{ fontSize: 13, fontWeight: 600, color: '#1a2233', fontFamily: 'monospace', padding: '3px 0' }}>{c}</div>
                      ))
                    : <div style={{ fontSize: 13, color: '#94a3b8' }}>No diagnosis codes</div>
                  }
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', marginBottom: 8 }}>CPT Codes</div>
                {claim.cptCodes.length === 0
                  ? <div style={{ color: '#94a3b8', fontSize: 13 }}>No CPT codes</div>
                  : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#f1f5f9' }}>
                          {['Code', 'Description', 'Units', 'Fee', 'Total'].map(h => (
                            <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: '#374151', fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {claim.cptCodes.map(c => (
                          <tr key={c.code} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontWeight: 700, color: '#0d9488' }}>{c.code}</td>
                            <td style={{ padding: '6px 10px', color: '#374151' }}>{c.description}</td>
                            <td style={{ padding: '6px 10px', color: '#64748b' }}>{c.units}</td>
                            <td style={{ padding: '6px 10px', color: '#64748b' }}>${c.fee.toFixed(2)}</td>
                            <td style={{ padding: '6px 10px', fontWeight: 700, color: '#1a2233' }}>${c.total.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ borderTop: '2px solid #0d9488' }}>
                          <td colSpan={4} style={{ padding: '8px 10px', fontWeight: 700, color: '#374151', textAlign: 'right' }}>Total Charges:</td>
                          <td style={{ padding: '8px 10px', fontWeight: 800, color: '#0d9488', fontSize: 15 }}>${claim.totalCharges.toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  )
                }
              </div>
            </div>
          )}
        </div>
        {claim && (
          <div style={{ padding: '14px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={handleCopy}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: copied ? '#dcfce7' : '#fff', color: copied ? '#15803d' : '#374151', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
              {copied ? '✅ Copied!' : '📋 Copy'}
            </button>
            <button onClick={handleDownload}
              style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#0d9488', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
              ⬇️ Download JSON
            </button>
            <button onClick={onClose}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#374151', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Encounter Card ───────────────────────────────────────────
export interface EncounterCardProps {
  enc: EncounterRecord;
  patientId: string;
  onRefresh: () => void;
}

export function EncounterCard({ enc, patientId, onRefresh }: EncounterCardProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [showClaim, setShowClaim] = useState(false);
  const s = ENC_STATUS[enc.status] ?? ENC_STATUS.open;
  const activities = (enc.activities ?? []).slice().sort(
    (a, b) => new Date(a.performedAt ?? a.createdAt ?? 0).getTime() - new Date(b.performedAt ?? b.createdAt ?? 0).getTime()
  );

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header — clickable to full encounter view */}
      <Link href={`/encounters/${enc.id}`} style={{ textDecoration: 'none', display: 'block' }}>
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', cursor: 'pointer', transition: 'background 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#e8f9f7')}
          onMouseLeave={e => (e.currentTarget.style.background = '#f8fafc')}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#1a2233', marginBottom: 2 }}>{enc.chiefComplaint}</div>
            <div style={{ fontSize: 12, color: '#64748b', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <span>📅 {fmtDateLabel(enc.encounterDate)}</span>
              {enc.doctorName && <span>👨‍⚕️ {enc.doctorName}</span>}
              {enc.nurseName && <span>👩‍⚕️ {enc.nurseName}</span>}
              <span style={{ color: '#0d9488', fontWeight: 600 }}>View Full Encounter →</span>
            </div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 999, ...s, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{enc.status}</span>
        </div>
      </Link>

      {/* Actions row */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 16px', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
        <a href={`/api/encounters/${enc.id}/pdf`} target="_blank" rel="noopener noreferrer"
          style={{ padding: '4px 10px', borderRadius: 7, border: 'none', background: '#64748b', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', textDecoration: 'none', display: 'inline-block' }}>
          📄 PDF
        </a>
        {(enc.status === 'signed' || enc.status === 'billed') && (
          <button onClick={() => setShowClaim(true)}
            style={{ padding: '4px 10px', borderRadius: 7, border: 'none', background: '#7c3aed', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            🧾 Generate Claim
          </button>
        )}
        <button onClick={() => setShowAdd(true)}
          style={{ padding: '4px 10px', borderRadius: 7, border: 'none', background: '#0d9488', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          + Add Activity
        </button>
      </div>

      {/* Activities */}
      <div style={{ padding: '0 16px' }}>
        {activities.length === 0 ? (
          <div style={{ padding: '16px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No activities recorded yet</div>
        ) : (
          activities.map(a => <ActivityItem key={a.id} act={a} onUpdated={onRefresh} />)
        )}
      </div>

      {showAdd && (
        <AddActivityModal
          encounterId={enc.id}
          patientId={patientId}
          nurseName={enc.nurseName}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); onRefresh(); }}
        />
      )}
      {showClaim && (
        <ClaimModal encounterId={enc.id} onClose={() => setShowClaim(false)} />
      )}
    </div>
  );
}
