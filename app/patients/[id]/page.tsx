'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Patient {
  id: string;
  patientId?: string;
  name: string;
  dob?: string;
  email?: string;
  phone?: string;
  clinicLocation?: string;
  physician?: string;
  diagnosis?: string;
  status: string;
  doctorId?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  insuranceId?: string;
  doctor?: { id: string; name: string; title?: string } | null;
  testResults?: TestResult[];
  videoActivity?: VideoWatch[];
  formActivity?: FormSigned[];
}

interface TestResult {
  id: string;
  allergen?: { name: string; type?: string };
  testType?: string;
  reaction?: number;
  wheal?: string;
  notes?: string;
  testedAt?: string;
}

interface VideoWatch {
  id: string;
  video?: { title: string };
  watchedAt?: string;
  acknowledged?: boolean;
}

interface FormSigned {
  id: string;
  form?: { name: string };
  signedAt?: string;
  printedAt?: string;
  emailedAt?: string;
}

const STATUS_BADGE: Record<string, { cls: string; color: string; bg: string }> = {
  'build-up':   { cls: 'badge-blue',   color: '#1d4ed8', bg: '#dbeafe' },
  'maintenance':{ cls: 'badge-green',  color: '#15803d', bg: '#dcfce7' },
  registered:   { cls: 'badge-blue',   color: '#1d4ed8', bg: '#dbeafe' },
  tested:       { cls: 'badge-yellow', color: '#b45309', bg: '#fef9c3' },
  consented:    { cls: 'badge-green',  color: '#15803d', bg: '#dcfce7' },
  complete:     { cls: 'badge-teal',   color: '#0d9488', bg: '#e8f9f7' },
};

const REACTION_COLOR: Record<number, string> = {
  0: '#94a3b8', 1: '#ca8a04', 2: '#ea580c', 3: '#dc2626', 4: '#991b1b', 5: '#7f1d1d',
};

type Tab = 'overview' | 'tests' | 'videos' | 'forms';

export default function PatientDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [patient, setPatient] = useState<Patient | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Patient>>({});

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/patients/${id}`)
      .then(r => { if (!r.ok) throw new Error('Patient not found'); return r.json(); })
      .then(data => { setPatient(data); setEditForm(data); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!patient) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/patients/${patient.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          phone: editForm.phone,
          email: editForm.email,
          status: editForm.status,
          physician: editForm.physician,
          clinicLocation: editForm.clinicLocation,
          diagnosis: editForm.diagnosis,
          notes: editForm.notes,
          insuranceId: editForm.insuranceId,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      setEditing(false);
      load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function fmt(val?: string) {
    if (!val) return '—';
    try { return new Date(val).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); }
    catch { return val; }
  }

  function InfoRow({ label, value }: { label: string; value?: string | null }) {
    return (
      <div style={{ display: 'flex', gap: 16, padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ width: 160, flexShrink: 0, fontSize: 13, fontWeight: 600, color: '#64748b' }}>{label}</div>
        <div style={{ fontSize: 14, color: value ? '#1a2233' : '#94a3b8' }}>{value || '—'}</div>
      </div>
    );
  }

  function Field({ label, field, type = 'text' }: { label: string; field: keyof Patient; type?: string }) {
    return (
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</label>
        <input
          type={type}
          className="form-input"
          value={(editForm[field] as string) ?? ''}
          onChange={e => setEditForm(f => ({ ...f, [field]: e.target.value }))}
        />
      </div>
    );
  }

  if (loading) return (
    <><div className="page-header"><div className="page-title">Patient Detail</div></div>
    <div className="page-body loading-center"><div className="spinner" /><span>Loading…</span></div></>
  );

  if (error || !patient) return (
    <><div className="page-header"><div className="page-title">Patient Not Found</div></div>
    <div className="page-body">
      <div className="alert alert-error">⚠️ {error || 'Patient not found'}</div>
      <Link href="/patients" className="btn">← Back to Patients</Link>
    </div></>
  );

  const statusStyle = STATUS_BADGE[patient.status?.toLowerCase()] ?? { color: '#374151', bg: '#f1f5f9' };
  const tests = patient.testResults ?? [];
  const videos = patient.videoActivity ?? [];
  const forms = patient.formActivity ?? [];

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">{patient.name}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
            <code style={{ fontSize: 12, background: '#f1f5f9', padding: '2px 8px', borderRadius: 4 }}>
              {patient.patientId ?? patient.id.slice(0, 8).toUpperCase()}
            </code>
            <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 999, color: statusStyle.color, background: statusStyle.bg }}>
              {patient.status}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/patients" style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#374151', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>← Patients</Link>
          <button onClick={() => { setEditForm(patient); setEditing(true); }}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #0d9488', background: '#fff', color: '#0d9488', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            ✏️ Edit
          </button>
          <Link href={`/testing?patientId=${patient.id}`}
            style={{ padding: '8px 16px', borderRadius: 8, background: '#0d9488', color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
            🧪 Start Testing
          </Link>
        </div>
      </div>

      <div className="page-body">
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid #e2e8f0', marginBottom: 24 }}>
          {(['overview', 'tests', 'videos', 'forms'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '10px 20px', border: 'none', background: 'transparent', fontSize: 14, fontWeight: 600,
              color: tab === t ? '#0d9488' : '#64748b', cursor: 'pointer',
              borderBottom: tab === t ? '2px solid #0d9488' : '2px solid transparent', marginBottom: -2,
            }}>
              {t === 'overview' && '📋 Overview'}
              {t === 'tests' && `🧪 Test Results (${tests.length})`}
              {t === 'videos' && `🎬 Videos (${videos.length})`}
              {t === 'forms' && `📝 Forms (${forms.length})`}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div className="card">
              <div className="card-title">Personal Information</div>
              <InfoRow label="Full Name" value={patient.name} />
              <InfoRow label="Date of Birth" value={fmt(patient.dob)} />
              <InfoRow label="Email" value={patient.email} />
              <InfoRow label="Phone" value={patient.phone} />
              <InfoRow label="Insurance ID" value={patient.insuranceId} />
            </div>
            <div className="card">
              <div className="card-title">Clinical Information</div>
              <InfoRow label="Status" value={patient.status} />
              <InfoRow label="Physician" value={patient.physician || patient.doctor?.name} />
              <InfoRow label="Location" value={patient.clinicLocation} />
              <InfoRow label="Diagnosis" value={patient.diagnosis} />
              <InfoRow label="Registered" value={fmt(patient.createdAt)} />
              <InfoRow label="Last Updated" value={fmt(patient.updatedAt)} />
              {patient.notes && <InfoRow label="Notes" value={patient.notes} />}
            </div>
          </div>
        )}

        {/* Test Results */}
        {tab === 'tests' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1a2233' }}>Test Results ({tests.length})</div>
              <Link href={`/testing?patientId=${patient.id}`} style={{ padding: '8px 16px', borderRadius: 8, background: '#0d9488', color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>+ New Test Session</Link>
            </div>
            {tests.length === 0 ? (
              <div className="card">
                <div className="empty-state">
                  <div className="empty-state-icon">🧪</div>
                  <div className="empty-state-title">No test results yet</div>
                  <Link href={`/testing?patientId=${patient.id}`} className="btn" style={{ marginTop: 12 }}>Start Testing</Link>
                </div>
              </div>
            ) : (() => {
              // Group by test date (YYYY-MM-DD) and testType
              const groups = new Map<string, TestResult[]>();
              tests.forEach(r => {
                const dateKey = r.testedAt ? new Date(r.testedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Unknown Date';
                const key = `${dateKey}||${r.testType ?? 'scratch'}`;
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key)!.push(r);
              });
              return Array.from(groups.entries()).map(([key, results]) => {
                const [dateLabel, testType] = key.split('||');
                return (
                  <div key={key} className="card" style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#0d9488' }}>{dateLabel}</div>
                      <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 999, background: '#dbeafe', color: '#1d4ed8', textTransform: 'capitalize' }}>
                        {testType === 'scratch' ? '🩹 Prick Test' : '💉 Intradermal'}
                      </span>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          {['Allergen', 'Reaction', 'Wheal', 'Notes'].map(h => (
                            <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {results.map(r => (
                          <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9', background: (r.reaction ?? 0) >= 2 ? '#fff7ed' : 'transparent' }}>
                            <td style={{ padding: '10px 12px', fontWeight: 600 }}>{r.allergen?.name ?? '—'}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{ fontWeight: 800, fontSize: 16, color: REACTION_COLOR[r.reaction ?? 0] }}>{r.reaction ?? 0}</span>
                            </td>
                            <td style={{ padding: '10px 12px', color: '#64748b' }}>{r.wheal ?? '—'}</td>
                            <td style={{ padding: '10px 12px', color: '#64748b', fontSize: 13 }}>{r.notes ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              });
            })()}
          </div>
        )}

        {/* Videos */}
        {tab === 'videos' && (
          <div className="card">
            <div className="card-title">Videos Watched</div>
            {videos.length === 0 ? (
              <div className="empty-state"><div className="empty-state-icon">🎬</div><div className="empty-state-title">No videos watched yet</div></div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead><tr style={{ background: '#f8fafc' }}>{['Video','Watched','Acknowledged'].map(h=><th key={h} style={{ padding:'8px 12px',textAlign:'left',fontSize:12,fontWeight:700,color:'#374151',textTransform:'uppercase',borderBottom:'2px solid #e2e8f0'}}>{h}</th>)}</tr></thead>
                <tbody>{videos.map(v=><tr key={v.id} style={{borderBottom:'1px solid #f1f5f9'}}><td style={{padding:'10px 12px',fontWeight:600}}>{v.video?.title??'—'}</td><td style={{padding:'10px 12px',color:'#64748b'}}>{fmt(v.watchedAt)}</td><td style={{padding:'10px 12px'}}>{v.acknowledged?'✅':'—'}</td></tr>)}</tbody>
              </table>
            )}
          </div>
        )}

        {/* Forms */}
        {tab === 'forms' && (
          <div className="card">
            <div className="card-title">Forms</div>
            {forms.length === 0 ? (
              <div className="empty-state"><div className="empty-state-icon">📝</div><div className="empty-state-title">No forms signed yet</div></div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead><tr style={{ background: '#f8fafc' }}>{['Form','Signed','Printed','Emailed'].map(h=><th key={h} style={{padding:'8px 12px',textAlign:'left',fontSize:12,fontWeight:700,color:'#374151',textTransform:'uppercase',borderBottom:'2px solid #e2e8f0'}}>{h}</th>)}</tr></thead>
                <tbody>{forms.map(f=><tr key={f.id} style={{borderBottom:'1px solid #f1f5f9'}}><td style={{padding:'10px 12px',fontWeight:600}}>{f.form?.name??'—'}</td><td style={{padding:'10px 12px',color:'#64748b'}}>{fmt(f.signedAt)}</td><td style={{padding:'10px 12px',color:'#64748b'}}>{fmt(f.printedAt)}</td><td style={{padding:'10px 12px',color:'#64748b'}}>{fmt(f.emailedAt)}</td></tr>)}</tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: 580, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1a2233' }}>✏️ Edit Patient</h2>
              <button onClick={() => setEditing(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ gridColumn: '1/-1' }}><Field label="Full Name *" field="name" /></div>
                <Field label="Date of Birth" field="dob" type="date" />
                <Field label="Email" field="email" type="email" />
                <Field label="Phone" field="phone" />
                <Field label="Insurance ID" field="insuranceId" />
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status</label>
                  <select className="form-input" value={editForm.status ?? ''} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                    {['build-up', 'maintenance', 'registered', 'tested', 'consented', 'complete'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <Field label="Physician" field="physician" />
                <Field label="Clinic Location" field="clinicLocation" />
                <div style={{ gridColumn: '1/-1' }}><Field label="Diagnosis" field="diagnosis" /></div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Notes</label>
                  <textarea className="form-input" rows={3} value={editForm.notes ?? ''} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: 'vertical' }} />
                </div>
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditing(false)} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#374151', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#0d9488', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
                {saving ? '⏳ Saving…' : '💾 Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
