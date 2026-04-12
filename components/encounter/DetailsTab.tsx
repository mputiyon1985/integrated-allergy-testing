'use client';

import { useState, useEffect } from 'react';
import React from 'react';
import { Encounter, DoctorOption, NurseOption, Icd10Option } from './types';
import { ENC_STATUS_STYLES } from './constants';

export interface DetailsTabProps {
  encounter: Encounter;
  encounterId: string;
  doctors: DoctorOption[];
  nurses: NurseOption[];
  icd10Options: Icd10Option[];
  patchEncounter: (fields: Partial<Encounter>) => Promise<void>;
  setEncounter: React.Dispatch<React.SetStateAction<Encounter | null>>;
}

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

// Inline editable textarea / input
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

export function DetailsTab({
  encounter,
  encounterId,
  doctors,
  nurses,
  icd10Options,
  patchEncounter,
  setEncounter,
}: DetailsTabProps) {
  const statusStyle = ENC_STATUS_STYLES[encounter.status] ?? ENC_STATUS_STYLES.open;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Encounter details card */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#1a2233', marginBottom: 16, borderBottom: '1px solid #f1f5f9', paddingBottom: 10 }}>
          📋 Encounter Details
        </div>

        {/* Chief Complaint — dropdown + free text */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Chief Complaint</div>
          <select
            value={encounter.chiefComplaint ?? ''}
            onChange={e => {
              if (!e.target.value) return;
              setEncounter(prev => prev ? { ...prev, chiefComplaint: e.target.value } : prev);
              patchEncounter({ chiefComplaint: e.target.value });
            }}
            style={{ width: '100%', fontSize: 13, padding: '6px 10px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', marginBottom: 6 }}
          >
            <option value="">— Select common complaint —</option>
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
          <InlineField
            label=""
            value={encounter.chiefComplaint}
            multiline
            rows={1}
            onSave={async v => {
              setEncounter(prev => prev ? { ...prev, chiefComplaint: v } : prev);
              await patchEncounter({ chiefComplaint: v });
            }}
          />
        </div>

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
          <div><span style={{ color: '#94a3b8' }}>ID:</span> <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{encounterId.slice(0, 8)}…</span></div>
          <div><span style={{ color: '#94a3b8' }}>Status:</span> <strong>{statusStyle.label}</strong></div>
          {encounter.signedBy  && <div style={{ gridColumn: '1/-1' }}><span style={{ color: '#94a3b8' }}>Signed by:</span> {encounter.signedBy} — {fmtDateTime(encounter.signedAt)}</div>}
          {encounter.billedAt  && <div style={{ gridColumn: '1/-1' }}><span style={{ color: '#94a3b8' }}>Billed:</span> {fmtDateTime(encounter.billedAt)}</div>}
          {encounter.cptSummary && <div style={{ gridColumn: '1/-1' }}><span style={{ color: '#94a3b8' }}>CPT:</span> {encounter.cptSummary}</div>}
        </div>
      </div>
    </div>
  );
}
