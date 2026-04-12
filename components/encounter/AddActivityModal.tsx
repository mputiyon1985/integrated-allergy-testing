'use client';

import { useState, useEffect } from 'react';
import { NurseOption } from './types';
import { ACTIVITY_TYPES, SOAP_TYPES } from './constants';

export interface AddActivityModalProps {
  encounterId: string;
  patientId: string;
  nurseName?: string;
  onClose: () => void;
  onSaved: () => void;
}

export function AddActivityModal({
  encounterId,
  patientId,
  nurseName: defaultNurseName,
  onClose,
  onSaved,
}: AddActivityModalProps) {
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
    (() => {
      let lp = '';
      try {
        const l = localStorage.getItem('iat_active_location');
        const p = !l ? localStorage.getItem('iat_active_practice_filter') ?? '' : '';
        if (l) lp = `&locationId=${l}`;
        else if (p) lp = `&practiceId=${p}`;
      } catch {}
      return fetch(`/api/nurses?all=1${lp}`);
    })().then(r => r.ok ? r.json() : []).then(d => {
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
