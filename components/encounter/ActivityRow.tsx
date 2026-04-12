'use client';

import { useState } from 'react';
import { EncounterActivity } from './types';
import { ACTIVITY_TYPES, ACTIVITY_ICON, ACTIVITY_LABEL, SOAP_TYPES } from './constants';

export interface ActivityRowProps {
  act: EncounterActivity;
  onUpdated: () => void;
}

function fmtTime(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const h = d.getHours() % 12 || 12;
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m} ${d.getHours() >= 12 ? 'PM' : 'AM'}`;
}

export function ActivityRow({ act, onUpdated }: ActivityRowProps) {
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
