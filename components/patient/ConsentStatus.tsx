'use client';

import { useState, useEffect } from 'react';

export function ConsentStatus({ patientId }: { patientId: string }) {
  const [forms, setForms] = useState<{ formId: string; name: string; signed: boolean; signedAt?: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [nurses, setNurses] = useState<{ id: string; name: string; title?: string }[]>([])
  const [ackMap, setAckMap] = useState<Record<string, string>>({})
  const [ackSaving, setAckSaving] = useState<Record<string, boolean>>({})

  useEffect(() => {
    Promise.allSettled([
      fetch(`/api/consent/check?patientId=${patientId}`).then(async r => {
        if (!r.ok) throw new Error(r.status === 401 ? 'session_expired' : `HTTP ${r.status}`);
        return r.json();
      }),
      (() => { let lp = ''; try { const l = localStorage.getItem('iat_active_location'); const p = !l ? localStorage.getItem('iat_active_practice_filter') ?? '' : ''; if (l) lp = `?locationId=${l}`; else if (p) lp = `?practiceId=${p}`; } catch {} return fetch(`/api/nurses${lp}`); })().then(async r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }),
    ]).then(([formsRes, nursesRes]) => {
      if (formsRes.status === 'fulfilled') setForms(formsRes.value.forms ?? [])
      else console.error('[ConsentStatus] consent fetch error:', (formsRes.reason as Error)?.message)
      if (nursesRes.status === 'fulfilled') {
        const d = nursesRes.value
        setNurses(Array.isArray(d) ? d : (d.nurses ?? []))
      } else {
        console.error('[ConsentStatus] nurses fetch error:', (nursesRes.reason as Error)?.message)
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [patientId])

  async function ackForm(formId: string, nurseName: string) {
    if (!nurseName) return
    setAckSaving(prev => ({ ...prev, [formId]: true }))
    setAckMap(prev => ({ ...prev, [formId]: nurseName }))
    setTimeout(() => setAckSaving(prev => ({ ...prev, [formId]: false })), 500)
  }

  if (loading) return <div className="loading-center"><div className="spinner" /></div>
  if (forms.length === 0) return (
    <div className="card">
      <div className="empty-state">
        <div className="empty-state-icon">📋</div>
        <div className="empty-state-title">No consent forms configured</div>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {forms.map(f => (
        <div key={f.formId} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{f.name}</div>
            {f.signed ? (
              <div style={{ fontSize: 13, color: '#15803d' }}>
                ✅ Signed on {new Date(f.signedAt!).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: '#b45309' }}>⚠️ Not yet signed</div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {f.signed && ackMap[f.formId] ? (
              <span style={{ fontSize: 13, fontWeight: 700, color: '#15803d', background: '#dcfce7', padding: '4px 12px', borderRadius: 999 }}>
                ✅ Verified by {ackMap[f.formId]}
              </span>
            ) : f.signed && nurses.length > 0 ? (
              <select
                defaultValue=""
                disabled={ackSaving[f.formId]}
                onChange={e => e.target.value && ackForm(f.formId, e.target.value)}
                style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0', cursor: 'pointer', color: '#374151' }}
              >
                <option value="">✓ Nurse Verify</option>
                {nurses.map(n => <option key={n.id} value={n.name}>{n.title ? `${n.title} ${n.name}` : n.name}</option>)}
              </select>
            ) : null}
            {f.signed && (
              <a
                href={`/api/consent/pdf?patientId=${patientId}&formId=${f.formId}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
              >
                📄 Download PDF
              </a>
            )}
            {!f.signed && (
              <span style={{ padding: '6px 14px', borderRadius: 8, background: '#fef9c3', color: '#b45309', fontSize: 13, fontWeight: 600 }}>
                Pending Patient Signature
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
