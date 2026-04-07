'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Patient {
  id: string;
  patientId?: string;
  honorific?: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  dob?: string;
  email?: string;
  cellPhone?: string;
  homePhone?: string;
  status: string;
  location?: string;
  locationId?: string;
  doctor?: string;
  doctorId?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  emergencyContact?: {
    name?: string;
    phone?: string;
    email?: string;
    relationship?: string;
  };
  insurance?: {
    provider?: string;
    insuranceId?: string;
    groupNumber?: string;
  };
}

interface TestResult {
  id: string;
  allergenName?: string;
  allergen?: { name: string; category?: string };
  testType?: string;
  reaction?: number;
  wheal?: number;
  date?: string;
  createdAt?: string;
}

interface VideoWatch {
  id: string;
  title?: string;
  video?: { title: string };
  watchedAt?: string;
  createdAt?: string;
}

interface FormSigned {
  id: string;
  formName?: string;
  form?: { name: string };
  signedAt?: string;
  createdAt?: string;
}

const STATUS_BADGE: Record<string, string> = {
  registered: 'badge-blue',
  tested: 'badge-yellow',
  consented: 'badge-green',
  complete: 'badge-teal',
};

const REACTION_LABEL: Record<number, { label: string; color: string }> = {
  0: { label: '0 — None', color: '#64748b' },
  1: { label: '1 — Mild', color: '#ca8a04' },
  2: { label: '2 — Moderate', color: '#ea580c' },
  3: { label: '3 — Strong', color: '#dc2626' },
  4: { label: '4 — Severe', color: '#b91c1c' },
};

type Tab = 'overview' | 'tests' | 'videos' | 'forms';

export default function PatientDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [patient, setPatient] = useState<Patient | null>(null);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [videos, setVideos] = useState<VideoWatch[]>([]);
  const [forms, setForms] = useState<FormSigned[]>([]);
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);

    fetch(`/api/patients/${id}`)
      .then(r => {
        if (!r.ok) throw new Error('Patient not found');
        return r.json();
      })
      .then(data => {
        setPatient(data.patient ?? data);
        setTestResults(data.testResults ?? []);
        setVideos(data.videos ?? []);
        setForms(data.forms ?? []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  function formatDate(val?: string) {
    if (!val) return '—';
    try {
      return new Date(val).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    } catch { return val; }
  }

  function InfoRow({ label, value }: { label: string; value?: string }) {
    return (
      <div style={{ display: 'flex', gap: 16, padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ width: 180, flexShrink: 0, fontSize: 13, fontWeight: 600, color: '#64748b' }}>{label}</div>
        <div style={{ fontSize: 14, color: '#1a2233' }}>{value || '—'}</div>
      </div>
    );
  }

  if (loading) {
    return (
      <>
        <div className="page-header"><div className="page-title">Patient Detail</div></div>
        <div className="page-body loading-center"><div className="spinner" /><span>Loading patient…</span></div>
      </>
    );
  }

  if (error || !patient) {
    return (
      <>
        <div className="page-header"><div className="page-title">Patient Not Found</div></div>
        <div className="page-body">
          <div className="alert alert-error">⚠️ {error || 'Patient not found'}</div>
          <Link href="/patients" className="btn">← Back to Patients</Link>
        </div>
      </>
    );
  }

  const fullName = [patient.honorific, patient.firstName, patient.lastName].filter(Boolean).join(' ');

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">{fullName}</div>
          <div className="page-subtitle" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <code style={{ fontSize: 12, background: '#f1f5f9', padding: '2px 8px', borderRadius: 4 }}>
              {patient.patientId ?? patient.id.slice(0, 8).toUpperCase()}
            </code>
            <span className={`badge ${STATUS_BADGE[patient.status?.toLowerCase()] ?? 'badge-gray'}`}>
              {patient.status}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/patients" className="btn-secondary btn">← Patients</Link>
          <Link href={`/testing?patientId=${patient.id}`} className="btn">🧪 Start Testing</Link>
        </div>
      </div>

      <div className="page-body">
        {/* Tabs */}
        <div className="tabs">
          {(['overview', 'tests', 'videos', 'forms'] as Tab[]).map(t => (
            <button
              key={t}
              className={`tab ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'overview' && '📋 Overview'}
              {t === 'tests' && `🧪 Test Results (${testResults.length})`}
              {t === 'videos' && `🎬 Videos (${videos.length})`}
              {t === 'forms' && `📝 Forms (${forms.length})`}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {tab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div className="card">
              <div className="card-title">Personal Information</div>
              <InfoRow label="Full Name" value={fullName} />
              <InfoRow label="Date of Birth" value={formatDate(patient.dateOfBirth ?? patient.dob)} />
              <InfoRow label="Email" value={patient.email} />
              <InfoRow label="Cell Phone" value={patient.cellPhone} />
              <InfoRow label="Home Phone" value={patient.homePhone} />
              {patient.address && (
                <InfoRow
                  label="Address"
                  value={[patient.address.street, patient.address.city, patient.address.state, patient.address.zip].filter(Boolean).join(', ')}
                />
              )}
            </div>

            <div>
              <div className="card mb-4">
                <div className="card-title">Clinical Information</div>
                <InfoRow label="Status" value={patient.status} />
                <InfoRow label="Doctor" value={patient.doctor} />
                <InfoRow label="Location" value={patient.location} />
                <InfoRow label="Registered" value={formatDate(patient.createdAt)} />
                <InfoRow label="Last Updated" value={formatDate(patient.updatedAt)} />
                {patient.notes && <InfoRow label="Notes" value={patient.notes} />}
              </div>

              {patient.emergencyContact && (
                <div className="card mb-4">
                  <div className="card-title">Emergency Contact</div>
                  <InfoRow label="Name" value={patient.emergencyContact.name} />
                  <InfoRow label="Relationship" value={patient.emergencyContact.relationship} />
                  <InfoRow label="Phone" value={patient.emergencyContact.phone} />
                  <InfoRow label="Email" value={patient.emergencyContact.email} />
                </div>
              )}

              {patient.insurance && (
                <div className="card">
                  <div className="card-title">Insurance</div>
                  <InfoRow label="Provider" value={patient.insurance.provider} />
                  <InfoRow label="Insurance ID" value={patient.insurance.insuranceId} />
                  <InfoRow label="Group Number" value={patient.insurance.groupNumber} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Test Results Tab */}
        {tab === 'tests' && (
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <div className="card-title" style={{ margin: 0 }}>Test Results</div>
              <Link href={`/testing?patientId=${patient.id}`} className="btn btn-sm">+ Add Test</Link>
            </div>
            {testResults.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🧪</div>
                <div className="empty-state-title">No test results yet</div>
                <div style={{ marginTop: 12 }}>
                  <Link href={`/testing?patientId=${patient.id}`} className="btn">Start Testing</Link>
                </div>
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Allergen</th>
                      <th>Type</th>
                      <th>Reaction</th>
                      <th>Wheal (mm)</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {testResults.map((r) => {
                      const reaction = r.reaction ?? 0;
                      const rInfo = REACTION_LABEL[reaction] ?? REACTION_LABEL[0];
                      return (
                        <tr key={r.id} style={{ cursor: 'default' }}>
                          <td style={{ fontWeight: 600 }}>{r.allergenName ?? r.allergen?.name ?? '—'}</td>
                          <td>
                            <span className="badge badge-blue">{r.testType ?? 'Scratch'}</span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{
                                width: 32, height: 32, borderRadius: 6,
                                background: reaction === 0 ? '#f1f5f9' : reaction === 1 ? '#fef9c3' : reaction === 2 ? '#fed7aa' : reaction === 3 ? '#fca5a5' : '#f87171',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 700, fontSize: 14, color: rInfo.color
                              }}>
                                {reaction}
                              </div>
                              <span style={{ fontSize: 13, color: rInfo.color }}>{rInfo.label}</span>
                            </div>
                          </td>
                          <td>{r.wheal ?? '—'}</td>
                          <td>{formatDate(r.date ?? r.createdAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Videos Tab */}
        {tab === 'videos' && (
          <div className="card">
            <div className="card-title">Videos Watched</div>
            {videos.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🎬</div>
                <div className="empty-state-title">No videos watched yet</div>
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr><th>Video Title</th><th>Watched At</th></tr>
                  </thead>
                  <tbody>
                    {videos.map((v) => (
                      <tr key={v.id} style={{ cursor: 'default' }}>
                        <td style={{ fontWeight: 600 }}>{v.title ?? v.video?.title ?? '—'}</td>
                        <td>{formatDate(v.watchedAt ?? v.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Forms Tab */}
        {tab === 'forms' && (
          <div className="card">
            <div className="card-title">Forms Signed</div>
            {forms.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📝</div>
                <div className="empty-state-title">No forms signed yet</div>
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr><th>Form Name</th><th>Signed At</th></tr>
                  </thead>
                  <tbody>
                    {forms.map((f) => (
                      <tr key={f.id} style={{ cursor: 'default' }}>
                        <td style={{ fontWeight: 600 }}>{f.formName ?? f.form?.name ?? '—'}</td>
                        <td>{formatDate(f.signedAt ?? f.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
