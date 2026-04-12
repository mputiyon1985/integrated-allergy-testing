'use client';

import { useState, useEffect } from 'react';
import { getLocationParam } from '@/lib/location-params';
import { apiFetch } from '@/lib/api-fetch';

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

const SOAP_TYPES = new Set(['in_person_visit', 'telehealth', 'phone_call']);

interface DoctorOption { id: string; name: string; title?: string; locationId?: string | null; }
interface NurseOption  { id: string; name: string; title?: string; locationId?: string | null; }

export interface NewEncounterModalProps {
  patientId: string;
  patientName: string;
  onClose: () => void;
  onSaved: () => void;
}

export function NewEncounterModal({
  patientId, patientName, onClose, onSaved,
}: NewEncounterModalProps) {
  const [step, setStep] = useState<'encounter' | 'activity'>('encounter');
  const [encId, setEncId] = useState('');
  const [saving, setSaving] = useState(false);

  const [encForm, setEncForm] = useState({
    chiefComplaint: '', doctorName: '', nurseName: '', status: 'open',
  });
  const [actForm, setActForm] = useState({
    activityType: 'in_person_visit',
    performedBy: '',
    notes: '',
    soapSubjective: '',
    soapObjective: '',
    soapAssessment: '',
    soapPlan: '',
  });

  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [nurses, setNurses] = useState<NurseOption[]>([]);

  useEffect(() => {
    const locId = (() => { try { return localStorage.getItem('iat_active_location') ?? ''; } catch { return ''; } })();
    const lp = getLocationParam('&');

    Promise.all([
      fetch(`/api/doctors?all=1${lp}`).then(r => r.ok ? r.json() : { doctors: [] }),
      fetch(`/api/nurses?all=1${lp}`).then(r => r.ok ? r.json() : []),
    ]).then(([docData, nurseData]) => {
      const allDocs: DoctorOption[] = Array.isArray(docData) ? docData : (docData.doctors ?? []);
      const allNurses: NurseOption[] = Array.isArray(nurseData) ? nurseData : (nurseData.nurses ?? []);

      const filteredDocs   = locId ? allDocs.filter(d => !d.locationId || d.locationId === locId) : allDocs;
      const filteredNurses = locId ? allNurses.filter(n => !n.locationId || n.locationId === locId) : allNurses;

      setDoctors(filteredDocs.filter(d => (d as unknown as { active?: boolean }).active !== false));
      setNurses(filteredNurses.filter(n => (n as unknown as { active?: boolean }).active !== false));
    }).catch(() => {});
  }, []);

  function advanceToActivity(encounterId: string) {
    const nurseLabel = encForm.nurseName ?? '';
    setActForm(p => ({
      ...p,
      activityType: 'in_person_visit',
      performedBy: nurseLabel,
      notes: nurseLabel
        ? `Patient seen by ${nurseLabel}. ${encForm.chiefComplaint ? 'Chief complaint: ' + encForm.chiefComplaint + '.' : ''}`.trim()
        : (encForm.chiefComplaint ? `Chief complaint: ${encForm.chiefComplaint}.` : ''),
    }));
    setEncId(encounterId);
    setStep('activity');
  }

  const showSoap = SOAP_TYPES.has(actForm.activityType);

  async function createEncounter() {
    setSaving(true);
    const res = await apiFetch('/api/encounters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId, ...encForm }),
    });
    const data = await res.json();
    const id = data.id ?? data.encounter?.id;
    setSaving(false);
    if (id) { advanceToActivity(id); }
    else { onSaved(); }
  }

  async function createActivity() {
    setSaving(true);
    await apiFetch('/api/encounter-activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encounterId: encId, patientId, ...actForm }),
    });
    setSaving(false);
    onSaved();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
            {step === 'encounter' ? `🏥 New Encounter — ${patientName}` : '➕ Log First Activity'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}>✕</button>
        </div>

        {step === 'encounter' ? (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Chief Complaint *</label>
              <select
                className="form-input"
                value={encForm.chiefComplaint}
                onChange={e => setEncForm(p => ({ ...p, chiefComplaint: e.target.value }))}
              >
                <option value="">— Select or type below —</option>
                <optgroup label="Allergy Visits">
                  <option>Allergic rhinitis — seasonal</option>
                  <option>Allergic rhinitis — perennial</option>
                  <option>Allergic conjunctivitis</option>
                  <option>Food allergy consultation</option>
                  <option>Food allergy — peanut</option>
                  <option>Bee venom allergy</option>
                  <option>Drug allergy evaluation</option>
                  <option>New patient allergy eval</option>
                </optgroup>
                <optgroup label="Shots &amp; Testing">
                  <option>Visit - Allergy Shot</option>
                  <option>Visit - Allergy Testing</option>
                  <option>Immunotherapy build-up</option>
                  <option>Immunotherapy maintenance</option>
                </optgroup>
                <optgroup label="Conditions">
                  <option>Asthma follow-up</option>
                  <option>Asthma, mild intermittent</option>
                  <option>Atopic dermatitis — moderate</option>
                  <option>Chronic urticaria</option>
                  <option>Hives / urticaria flare</option>
                  <option>Angioedema</option>
                  <option>Eczema follow-up</option>
                  <option>Sinusitis — allergic</option>
                </optgroup>
                <optgroup label="Other">
                  <option>Annual allergy review</option>
                  <option>Medication refill visit</option>
                  <option>Post-reaction follow-up</option>
                  <option>Telehealth consultation</option>
                </optgroup>
              </select>
              <input
                className="form-input"
                value={encForm.chiefComplaint}
                onChange={e => setEncForm(p => ({ ...p, chiefComplaint: e.target.value }))}
                placeholder="Or type a custom complaint…"
                style={{ marginTop: 6, fontSize: 12 }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Physician</label>
              <select className="form-input" value={encForm.doctorName} onChange={e => setEncForm(p => ({ ...p, doctorName: e.target.value }))}>
                <option value="">— Select Physician —</option>
                {doctors.map(d => (
                  <option key={d.id} value={d.name}>{d.title ? `${d.name}, ${d.title}` : d.name}</option>
                ))}
                {doctors.length === 0 && <option disabled>No physicians at this location</option>}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Nurse / Tech</label>
              <select className="form-input" value={encForm.nurseName} onChange={e => setEncForm(p => ({ ...p, nurseName: e.target.value }))}>
                <option value="">— Select Nurse / Tech —</option>
                {nurses.map(n => (
                  <option key={n.id} value={n.name}>{n.title ? `${n.name}, ${n.title}` : n.name}</option>
                ))}
                {nurses.length === 0 && <option disabled>No nurses at this location</option>}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Status</label>
              <select className="form-input" value={encForm.status} onChange={e => setEncForm(p => ({ ...p, status: e.target.value }))}>
                <option value="open">Open</option>
                <option value="complete">Complete</option>
              </select>
            </div>
          </div>
        ) : (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Activity Type *</label>
              <select className="form-input" value={actForm.activityType} onChange={e => setActForm(p => ({ ...p, activityType: e.target.value }))}>
                {ACTIVITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Performed By</label>
              {nurses.length > 0 ? (
                <select className="form-input" value={actForm.performedBy} onChange={e => setActForm(p => ({ ...p, performedBy: e.target.value }))}>
                  <option value="">— Select Nurse / Tech —</option>
                  {nurses.map(n => <option key={n.id} value={n.name}>{n.title ? `${n.name}, ${n.title}` : n.name}</option>)}
                </select>
              ) : (
                <input className="form-input" value={actForm.performedBy} placeholder="e.g. RN Michelle Roman" onChange={e => setActForm(p => ({ ...p, performedBy: e.target.value }))} />
              )}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Notes</label>
              <textarea className="form-input" rows={3} value={actForm.notes} onChange={e => setActForm(p => ({ ...p, notes: e.target.value }))} style={{ resize: 'vertical' }} />
            </div>
            {showSoap && (
              <>
                <div style={{ fontWeight: 700, fontSize: 12, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.05em', paddingTop: 4, borderTop: '1px solid #e2e8f0' }}>SOAP Notes</div>
                {[
                  { label: 'Subjective', key: 'soapSubjective' },
                  { label: 'Objective', key: 'soapObjective' },
                  { label: 'Assessment', key: 'soapAssessment' },
                  { label: 'Plan', key: 'soapPlan' },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>{f.label}</label>
                    <textarea className="form-input" rows={2} value={(actForm as Record<string, string>)[f.key]} onChange={e => setActForm(p => ({ ...p, [f.key]: e.target.value }))} style={{ resize: 'vertical' }} />
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        <div style={{ padding: '14px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
          {step === 'encounter' ? (
            <button onClick={createEncounter} disabled={saving || !encForm.chiefComplaint.trim()}
              style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#0d9488', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
              {saving ? '⏳ Creating…' : 'Next: Log Activity →'}
            </button>
          ) : (
            <button onClick={createActivity} disabled={saving}
              style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#0d9488', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
              {saving ? '⏳ Saving…' : '💾 Save Activity'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
