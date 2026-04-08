'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Patient {
  id: string;
  patientId?: string;
  name: string;
  dob?: string;
  email?: string;
  phone?: string;
  homePhone?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  clinicLocation?: string;
  physician?: string;
  diagnosis?: string;
  status: string;
  doctorId?: string;
  notes?: string;
  insuranceId?: string;
  insuranceProvider?: string;
  insuranceGroup?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  emergencyRelation?: string;
  createdAt?: string;
  updatedAt?: string;
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
  nurseName?: string;
  testedAt?: string;
}

interface VideoWatch {
  id: string;
  video?: { title: string };
  watchedAt?: string;
  acknowledged?: boolean;
}

interface LocationOption {
  id: string;
  name: string;
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

type Tab = 'overview' | 'tests' | 'videos' | 'forms' | 'consent' | 'encounters';

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
  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([]);
  const [doctorOptions, setDoctorOptions] = useState<{ id: string; name: string; title?: string }[]>([]);
  const [nurses, setNurses] = useState<{ id: string; name: string; title?: string }[]>([]);
  const [sessionNurses, setSessionNurses] = useState<Record<string, string>>({});
  const [sessionNurseSaving, setSessionNurseSaving] = useState<Record<string, boolean>>({});
  const [editingRows, setEditingRows] = useState<Record<string, { reaction: number; wheal: string; flare: string; notes: string }>>({});
  const [savingRows, setSavingRows] = useState<Record<string, boolean>>({});
  const locationsFetchedRef = useRef(false);

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

  useEffect(() => {
    if (editing && !locationsFetchedRef.current) {
      locationsFetchedRef.current = true;
      Promise.allSettled([
        fetch('/api/locations').then(r => r.ok ? r.json() : []),
        fetch('/api/doctors').then(r => r.ok ? r.json() : []),
      ]).then(([locRes, docRes]) => {
        if (locRes.status === 'fulfilled') {
          const d = locRes.value as LocationOption[] | { locations?: LocationOption[] };
          setLocationOptions(Array.isArray(d) ? d : (d.locations ?? []));
        }
        if (docRes.status === 'fulfilled') {
          const d = docRes.value as { id: string; name: string; title?: string }[] | { doctors?: { id: string; name: string; title?: string }[] };
          setDoctorOptions(Array.isArray(d) ? d : (d.doctors ?? []));
        }
      });
    }
  }, [editing]);

  // Load nurses once
  useEffect(() => {
    fetch('/api/nurses')
      .then(r => r.ok ? r.json() : [])
      .then((d: { id: string; name: string; title?: string }[] | { nurses?: { id: string; name: string; title?: string }[] }) => {
        setNurses(Array.isArray(d) ? d : (d.nurses ?? []));
      })
      .catch(() => {});
  }, []);

  async function saveSessionNurse(sessionKey: string, sessionResults: TestResult[]) {
    const nurseNameVal = sessionNurses[sessionKey] ?? (sessionResults[0]?.nurseName ?? '');
    setSessionNurseSaving(prev => ({ ...prev, [sessionKey]: true }));
    await Promise.allSettled(sessionResults.map(r =>
      fetch(`/api/test-results/${r.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nurseName: nurseNameVal || null }),
      })
    ));
    setSessionNurseSaving(prev => ({ ...prev, [sessionKey]: false }));
    load();
  }

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
          homePhone: editForm.homePhone,
          email: editForm.email,
          street: editForm.street,
          city: editForm.city,
          state: editForm.state,
          zip: editForm.zip,
          status: editForm.status,
          physician: editForm.physician,
          clinicLocation: editForm.clinicLocation,
          diagnosis: editForm.diagnosis,
          notes: editForm.notes,
          insuranceId: editForm.insuranceId,
          insuranceProvider: editForm.insuranceProvider,
          insuranceGroup: editForm.insuranceGroup,
          emergencyName: editForm.emergencyName,
          emergencyPhone: editForm.emergencyPhone,
          emergencyRelation: editForm.emergencyRelation,
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
    try {
      // Parse date and format in UTC to avoid timezone day-shift
      const d = new Date(val);
      return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
        .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }
    catch { return val; }
  }

  function handlePrintResults() {
    if (!patient || tests.length === 0) return;
    const gradeLabel: Record<number, string> = { 0:'Negative',1:'Trace',2:'Positive',3:'Strong',4:'Very Strong',5:'Extreme' };
    const gradeColor: Record<number, string> = { 0:'#64748b',1:'#ca8a04',2:'#ea580c',3:'#dc2626',4:'#991b1b',5:'#7f1d1d' };

    // Group by date + testType
    const groups = new Map<string, TestResult[]>();
    tests.forEach(r => {
      const d = r.testedAt ? new Date(r.testedAt).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}) : 'Unknown Date';
      const key = `${d}||${r.testType ?? 'scratch'}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    });

    const sectionsHtml = Array.from(groups.entries()).map(([key, results]) => {
      const [dateLabel, testType] = key.split('||');
      const icon = testType === 'scratch' ? '🩹' : '💉';
      const title = testType === 'scratch' ? 'Prick Test' : 'Intradermal Test';
      const rows = results.map((r, i) => {
        const notes = r.notes ?? '';
        const flareMatch = notes.match(/Flare:\s*([\d.]+\s*mm?)/i);
        const locMatch = notes.match(/Location:\s*([^;]+)/i);
        const flare = flareMatch ? flareMatch[1] : '—';
        const injectionSite = locMatch ? locMatch[1].trim() : 'Back';
        const grade = r.reaction ?? 0;
        return `<tr style="border-bottom:1px solid #e2e8f0; background:${grade >= 2 ? '#fff7ed' : i % 2 === 0 ? '#fff' : '#f8fafc'}">
          <td style="padding:6px 10px;">${i+1}</td>
          <td style="padding:6px 10px; font-weight:600;">${r.allergen?.name ?? '—'}</td>
          <td style="padding:6px 10px; font-weight:800; font-size:16px; color:${gradeColor[grade]};">${grade}</td>
          <td style="padding:6px 10px; color:#64748b; font-size:12px;">${gradeLabel[grade]}</td>
          <td style="padding:6px 10px; color:#374151;">${r.wheal ?? '—'}</td>
          <td style="padding:6px 10px; color:#374151;">${flare}</td>
          <td style="padding:6px 10px; color:#64748b;">${injectionSite}</td>
          <td style="padding:6px 10px; color:#64748b; font-size:11px;">${dateLabel}</td>
        </tr>`;
      }).join('');
      return `<div style="margin-bottom:24px;">
        <h3 style="font-size:14px; font-weight:700; color:#0055A5; text-transform:uppercase; letter-spacing:0.06em; margin:0 0 8px; padding-bottom:6px; border-bottom:2px solid #0055A5;">
          ${icon} ${title} &nbsp;·&nbsp; <span style="font-weight:500; text-transform:none;">${dateLabel}</span>
        </h3>
        <table style="width:100%; border-collapse:collapse; font-size:13px; font-family:system-ui,sans-serif;">
          <thead><tr style="background:#0055A5; color:#fff;">
            <th style="padding:6px 10px; text-align:left;">#</th>
            <th style="padding:6px 10px; text-align:left;">Allergen</th>
            <th style="padding:6px 10px; text-align:left;">Grade</th>
            <th style="padding:6px 10px; text-align:left;">Result</th>
            <th style="padding:6px 10px; text-align:left;">Wheal</th>
            <th style="padding:6px 10px; text-align:left;">Flare</th>
            <th style="padding:6px 10px; text-align:left;">Site</th>
            <th style="padding:6px 10px; text-align:left;">Test Date</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    }).join('');

    // Get nurse from dedicated nurseName field (falls back to notes for legacy data)
    const nurseFromField = tests[0]?.nurseName;
    const nurseFromNotes = tests[0]?.notes?.match(/Nurse:\s*([^;]+)/i)?.[1]?.trim();
    const nurseName = nurseFromField || nurseFromNotes || '—';

    const html = `<!DOCTYPE html><html><head><title>Test Results — ${patient.name}</title>
<style>body{font-family:system-ui,sans-serif;margin:0;padding:20px;color:#1a2233;}</style>
</head><body>
<div style="border-bottom:3px solid #0055A5;padding-bottom:12px;margin-bottom:16px;">
  <div style="font-size:20px;font-weight:800;color:#0055A5;margin-bottom:8px;">Integrated Allergy Testing — Test Results</div>
  <div style="display:flex;gap:28px;font-size:13px;flex-wrap:wrap;">
    <span><strong>Patient:</strong> ${patient.name}</span>
    <span><strong>ID:</strong> ${patient.patientId ?? patient.id.slice(0,8).toUpperCase()}</span>
    <span><strong>DOB:</strong> ${fmt(patient.dob)}</span>
    <span><strong>Physician:</strong> ${patient.physician ?? '—'}</span>
    <span><strong>Tested By:</strong> ${nurseName}</span>
    <span><strong>Clinic Location:</strong> ${patient.clinicLocation ?? '—'}</span>
    <span><strong>Insurance ID:</strong> ${patient.insuranceId ?? '—'}</span>
    <span><strong>Print Date:</strong> ${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</span>
  </div>
</div>
<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:6px;padding:8px 14px;margin-bottom:16px;font-size:12px;color:#166534;">
  <strong>Grade Legend:</strong> 0=Negative &nbsp;|&nbsp; 1=Trace &nbsp;|&nbsp; 2=Positive &nbsp;|&nbsp; 3=Strong &nbsp;|&nbsp; 4=Very Strong &nbsp;|&nbsp; 5=Extreme
</div>
${sectionsHtml}
<div style="margin-top:32px;border-top:1px solid #e2e8f0;padding-top:12px;font-size:11px;color:#94a3b8;display:flex;justify-content:space-between;">
  <span>Integrated Allergy Testing — HIPAA Compliant</span>
  <span>Printed: ${new Date().toLocaleString('en-US')}</span>
</div>
</body></html>`;

    const w = window.open('', '_blank', 'width=900,height=700');
    if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 400); }
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
    // For date fields, normalize ISO datetime to YYYY-MM-DD
    const rawVal = (editForm[field] as string) ?? '';
    // For date inputs: extract YYYY-MM-DD from ISO string, handling timezone
    const displayVal = type === 'date' && rawVal
      ? (() => {
          const s = rawVal.split('T')[0];
          // Validate it's a real date string
          if (/^\d{4}-\d{2}-\d{2}$/.test(s) && parseInt(s.substring(0,4)) > 1900) return s;
          // Fallback: parse and format as UTC
          try {
            const d = new Date(rawVal);
            return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
          } catch { return s; }
        })()
      : rawVal;
    return (
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</label>
        <input
          type={type}
          className="form-input"
          value={displayVal}
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
      <style>{`
        @media print {
          .sidebar, .sidebar-toggle, .sidebar-overlay, .page-header, .tabs-bar, .no-print { display: none !important; }
          .main-content { margin-left: 0 !important; padding: 0 !important; }
          .print-header { display: block !important; margin-bottom: 16px; padding-bottom: 10px; border-bottom: 2px solid #0055A5; }
          body { background: #fff !important; }
        }
        .print-header { display: none; }
        .tabs-bar { /* referenced above */ }
      `}</style>

      {/* Print-only patient header */}
      <div className="print-header">
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0055A5', marginBottom: 6 }}>Integrated Allergy Testing — Patient Test Results</div>
        <div style={{ display: 'flex', gap: 24, fontSize: 13, flexWrap: 'wrap' }}>
          <span><strong>Patient:</strong> {patient.name}</span>
          <span><strong>ID:</strong> {patient.patientId ?? patient.id.slice(0,8).toUpperCase()}</span>
          <span><strong>DOB:</strong> {fmt(patient.dob)}</span>
          <span><strong>Physician:</strong> {patient.physician ?? '—'}</span>
          <span><strong>Location:</strong> {patient.clinicLocation ?? '—'}</span>
          <span><strong>Print Date:</strong> {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
        </div>
      </div>

      {/* Header */}
      <div className="page-header no-print">
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
          <Link href={`/calendar?action=new&patientId=${patient.id}&patientName=${encodeURIComponent(patient.name)}`}
            style={{ padding: '8px 16px', borderRadius: 8, background: '#7c3aed', color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
            📅 Book Appt
          </Link>
        </div>
      </div>

      <div className="page-body">
        {/* Tabs */}
        <div className="no-print" style={{ display: 'flex', gap: 4, borderBottom: '2px solid #e2e8f0', marginBottom: 24 }}>
          {(['overview', 'tests', 'videos', 'forms', 'consent', 'encounters'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '10px 20px', border: 'none', background: 'transparent', fontSize: 14, fontWeight: 600,
              color: tab === t ? '#0d9488' : '#64748b', cursor: 'pointer',
              borderBottom: tab === t ? '2px solid #0d9488' : '2px solid transparent', marginBottom: -2,
            }}>
              {t === 'overview' && '📋 Overview'}
              {t === 'tests' && `🧪 Test Results (${tests.length})`}
              {t === 'videos' && `🎬 Videos (${videos.length})`}
              {t === 'forms' && `📝 Forms (${forms.length})`}
              {t === 'consent' && '📋 Consent'}
              {t === 'encounters' && '🏥 Encounters'}
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
              <InfoRow label="Cell Phone" value={patient.phone} />
              <InfoRow label="Home Phone" value={patient.homePhone} />
              <InfoRow label="Email" value={patient.email} />
              {(patient.street || patient.city) && (
                <InfoRow label="Address" value={[patient.street, patient.city, patient.state, patient.zip].filter(Boolean).join(', ')} />
              )}
              {(patient.emergencyName) && (
                <>
                  <InfoRow label="Emergency" value={`${patient.emergencyName}${patient.emergencyRelation ? ` (${patient.emergencyRelation})` : ''}`} />
                  <InfoRow label="Emerg. Phone" value={patient.emergencyPhone} />
                </>
              )}
              <InfoRow label="Insurance" value={[patient.insuranceProvider, patient.insuranceId, patient.insuranceGroup ? `Group: ${patient.insuranceGroup}` : ''].filter(Boolean).join(' · ')} />
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
              <div style={{ display: 'flex', gap: 8 }}>
                {tests.length > 0 && (
                  <button onClick={handlePrintResults}
                    style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#374151', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    🖨️ Print Results
                  </button>
                )}
                <Link href={`/testing?patientId=${patient.id}`} style={{ padding: '8px 16px', borderRadius: 8, background: '#0d9488', color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>🧪 Start New Test</Link>
              </div>
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: '#0d9488' }}>{dateLabel}</div>
                        <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 999, background: '#dbeafe', color: '#1d4ed8', textTransform: 'capitalize' }}>
                          {testType === 'scratch' ? '🩹 Prick Test' : '💉 Intradermal'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Tested By:</span>
                        <select
                          value={sessionNurses[key] ?? (results[0]?.nurseName ?? '')}
                          onChange={e => setSessionNurses(prev => ({ ...prev, [key]: e.target.value }))}
                          style={{ fontSize: 13, padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0', color: '#374151', cursor: 'pointer' }}
                        >
                          <option value="">— Assign Nurse —</option>
                          {nurses.map(n => (
                            <option key={n.id} value={n.name}>{n.title ? `${n.title} ${n.name}` : n.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => saveSessionNurse(key, results)}
                          disabled={sessionNurseSaving[key]}
                          style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: '#0d9488', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                        >
                          {sessionNurseSaving[key] ? '⏳' : '💾 Save'}
                        </button>
                      </div>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          {['Allergen', 'Reaction', 'Wheal', 'Flare', 'Site', 'Notes', ''].map(h => (
                            <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {results.map(r => {
                          const rowNotes = r.notes ?? '';
                          const flareMatch = rowNotes.match(/Flare:\s*([\d.]+\s*mm?)/i);
                          const locMatch = rowNotes.match(/Location:\s*([^;]+)/i);
                          const parsedFlare = flareMatch ? flareMatch[1].replace(/mm?/i,'').trim() : '';
                          const parsedSite = locMatch ? locMatch[1].trim() : 'Back';
                          const cleanNotes = rowNotes.replace(/Flare:\s*[\d.]+\s*mm?;?\s*/i,'').replace(/Location:\s*[^;]+;?\s*/i,'').trim();

                          const editing = editingRows[r.id] ?? {
                            reaction: r.reaction ?? 0,
                            wheal: r.wheal ?? '',
                            flare: parsedFlare,
                            notes: cleanNotes,
                          };

                          async function saveRow() {
                            setSavingRows(prev => ({ ...prev, [r.id]: true }));
                            const newNotes = [
                              editing.flare ? `Flare: ${editing.flare}mm` : '',
                              parsedSite !== 'Back' ? `Location: ${parsedSite}` : '',
                              editing.notes || '',
                            ].filter(Boolean).join('; ');
                            await fetch(`/api/test-results/${r.id}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                reaction: editing.reaction,
                                wheal: editing.wheal || null,
                                notes: newNotes || null,
                              }),
                            });
                            setSavingRows(prev => ({ ...prev, [r.id]: false }));
                            setEditingRows(prev => { const n = {...prev}; delete n[r.id]; return n; });
                            load();
                          }

                          const changed = editing.reaction !== (r.reaction ?? 0) ||
                            editing.wheal !== (r.wheal ?? '') ||
                            editing.flare !== parsedFlare ||
                            editing.notes !== cleanNotes;

                          return (
                            <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9', background: editing.reaction >= 2 ? '#fff7ed' : 'transparent' }}>
                              <td style={{ padding: '8px 12px', fontWeight: 600, fontSize: 13 }}>{r.allergen?.name ?? '—'}</td>
                              <td style={{ padding: '8px 8px' }}>
                                <select value={editing.reaction}
                                  onChange={e => setEditingRows(prev => ({ ...prev, [r.id]: { ...editing, reaction: Number(e.target.value) } }))}
                                  style={{ fontWeight: 700, fontSize: 14, color: REACTION_COLOR[editing.reaction], border: '1px solid #e2e8f0', borderRadius: 6, padding: '2px 6px', width: 52 }}>
                                  {[0,1,2,3,4,5].map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                              </td>
                              <td style={{ padding: '8px 6px' }}>
                                <input type="text" value={editing.wheal} placeholder="mm"
                                  onChange={e => setEditingRows(prev => ({ ...prev, [r.id]: { ...editing, wheal: e.target.value } }))}
                                  style={{ width: 52, padding: '3px 6px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13 }} />
                              </td>
                              <td style={{ padding: '8px 6px' }}>
                                <input type="text" value={editing.flare} placeholder="mm"
                                  onChange={e => setEditingRows(prev => ({ ...prev, [r.id]: { ...editing, flare: e.target.value } }))}
                                  style={{ width: 52, padding: '3px 6px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13 }} />
                              </td>
                              <td style={{ padding: '8px 12px', color: '#64748b', fontSize: 13 }}>{parsedSite}</td>
                              <td style={{ padding: '8px 6px' }}>
                                <input type="text" value={editing.notes} placeholder="Notes…"
                                  onChange={e => setEditingRows(prev => ({ ...prev, [r.id]: { ...editing, notes: e.target.value } }))}
                                  style={{ width: 120, padding: '3px 6px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12 }} />
                              </td>
                              <td style={{ padding: '8px 8px' }}>
                                {changed && (
                                  <button onClick={saveRow} disabled={savingRows[r.id]}
                                    style={{ padding: '3px 10px', borderRadius: 6, border: 'none', background: '#0d9488', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                    {savingRows[r.id] ? '⏳' : '💾 Save'}
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
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

        {/* Consent */}
        {tab === 'consent' && (
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1a2233', marginBottom: 16 }}>Consent Forms</div>
            <ConsentStatus patientId={patient.id} />
          </div>
        )}

        {tab === 'encounters' && (
          <EncountersTab patientId={patient.id} patientName={patient.name} />
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
                <Field label="Cell Phone" field="phone" />
                <Field label="Home Phone" field="homePhone" />
                <Field label="Email" field="email" type="email" />
                <div style={{ gridColumn: '1/-1', fontWeight: 700, fontSize: 12, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', paddingTop: 8, borderTop: '1px solid #e2e8f0' }}>Address</div>
                <div style={{ gridColumn: '1/-1' }}><Field label="Street" field="street" /></div>
                <Field label="City" field="city" />
                <Field label="State" field="state" />
                <Field label="ZIP" field="zip" />
                <div style={{ gridColumn: '1/-1', fontWeight: 700, fontSize: 12, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', paddingTop: 8, borderTop: '1px solid #e2e8f0' }}>Insurance</div>
                <Field label="Insurance Provider" field="insuranceProvider" />
                <Field label="Member ID" field="insuranceId" />
                <Field label="Group #" field="insuranceGroup" />
                <div style={{ gridColumn: '1/-1', fontWeight: 700, fontSize: 12, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', paddingTop: 8, borderTop: '1px solid #e2e8f0' }}>Emergency Contact</div>
                <Field label="Name" field="emergencyName" />
                <Field label="Phone" field="emergencyPhone" />
                <Field label="Relationship" field="emergencyRelation" />
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status</label>
                  <select className="form-input" value={editForm.status ?? ''} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                    {['build-up', 'maintenance', 'registered', 'tested', 'consented', 'complete'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Physician</label>
                  <select className="form-input" value={editForm.physician ?? ''} onChange={e => setEditForm(f => ({ ...f, physician: e.target.value }))}>
                    <option value="">— Select Physician —</option>
                    {doctorOptions.map(d => (
                      <option key={d.id} value={`${d.title ? d.title + ' ' : ''}${d.name}`}>
                        {d.title ? `${d.title} ${d.name}` : d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Clinic Location</label>
                  <select className="form-input" value={editForm.clinicLocation ?? ''} onChange={e => setEditForm(f => ({ ...f, clinicLocation: e.target.value }))}>
                    <option value="">— Select Location —</option>
                    {locationOptions.map(loc => (
                      <option key={loc.id} value={loc.name}>{loc.name}</option>
                    ))}
                  </select>
                </div>
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

function ConsentStatus({ patientId }: { patientId: string }) {
  const [forms, setForms] = useState<{ formId: string; name: string; signed: boolean; signedAt?: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [nurses, setNurses] = useState<{ id: string; name: string; title?: string }[]>([])
  const [ackMap, setAckMap] = useState<Record<string, string>>({})
  const [ackSaving, setAckSaving] = useState<Record<string, boolean>>({})

  useEffect(() => {
    Promise.allSettled([
      fetch(`/api/consent/check?patientId=${patientId}`).then(r => r.json()),
      fetch('/api/nurses').then(r => r.json()),
    ]).then(([formsRes, nursesRes]) => {
      if (formsRes.status === 'fulfilled') setForms(formsRes.value.forms ?? [])
      if (nursesRes.status === 'fulfilled') {
        const d = nursesRes.value
        setNurses(Array.isArray(d) ? d : (d.nurses ?? []))
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [patientId])

  async function ackForm(formId: string, nurseName: string) {
    if (!nurseName) return
    setAckSaving(prev => ({ ...prev, [formId]: true }))
    setAckMap(prev => ({ ...prev, [formId]: nurseName }))
    // Store ack in video activity notes for now — future: dedicated ack table
    // For now just show visual confirmation
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

function EncountersTab({ patientId, patientName }: { patientId: string; patientName: string }) {
  const [encounters, setEncounters] = useState<{ id: string; encounterDate: string; doctorName?: string; nurseName?: string; chiefComplaint: string; assessment?: string; plan?: string; status: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ chiefComplaint: '', subjectiveNotes: '', objectiveNotes: '', assessment: '', plan: '', doctorName: '', nurseName: '', followUpDays: '', status: 'open' });

  function load() {
    setLoading(true);
    fetch(`/api/encounters?patientId=${patientId}`)
      .then(r => r.json())
      .then(d => { setEncounters(d.encounters ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }
  useEffect(() => { load(); }, [patientId]);

  async function saveEncounter() {
    setSaving(true);
    await fetch('/api/encounters', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId, ...form, followUpDays: form.followUpDays ? Number(form.followUpDays) : null }) });
    setSaving(false); setShowNew(false);
    setForm({ chiefComplaint: '', subjectiveNotes: '', objectiveNotes: '', assessment: '', plan: '', doctorName: '', nurseName: '', followUpDays: '', status: 'open' });
    load();
  }

  const STATUS = { open: { bg: '#fef9c3', color: '#b45309' }, complete: { bg: '#dcfce7', color: '#15803d' }, cancelled: { bg: '#f3f4f6', color: '#64748b' } } as Record<string, { bg: string; color: string }>;
  const fmt = (d: string) => { try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return d; }};

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#1a2233' }}>Encounter Records ({encounters.length})</div>
        <button onClick={() => setShowNew(true)} style={{ padding: '8px 16px', borderRadius: 8, background: '#0d9488', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>+ New Encounter</button>
      </div>
      {loading ? <div className="loading-center"><div className="spinner" /></div> :
       encounters.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🏥</div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>No encounters yet</div>
          <button onClick={() => setShowNew(true)} className="btn" style={{ marginTop: 12 }}>Create First Encounter</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {encounters.map(e => {
            const s = STATUS[e.status] ?? STATUS.open;
            return (
              <div key={e.id} className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{e.chiefComplaint}</div>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 999, ...s }}>{e.status}</span>
                </div>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>
                  📅 {fmt(e.encounterDate)} {e.doctorName && `· 👨‍⚕️ ${e.doctorName}`} {e.nurseName && `· 👩‍⚕️ ${e.nurseName}`}
                </div>
                {e.assessment && <div style={{ fontSize: 13, marginBottom: 4 }}><strong>Assessment:</strong> {e.assessment}</div>}
                {e.plan && <div style={{ fontSize: 13 }}><strong>Plan:</strong> {e.plan}</div>}
              </div>
            );
          })}
        </div>
      )}

      {showNew && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: 620, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>🏥 New Encounter — {patientName}</h2>
              <button onClick={() => setShowNew(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Chief Complaint *', key: 'chiefComplaint', required: true },
                { label: 'Physician', key: 'doctorName' },
                { label: 'Nurse', key: 'nurseName' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>{f.label}</label>
                  <input className="form-input" value={(form as Record<string,string>)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
                </div>
              ))}
              {[
                { label: 'Subjective (Patient reports)', key: 'subjectiveNotes' },
                { label: 'Objective (Clinical observations)', key: 'objectiveNotes' },
                { label: 'Assessment / Diagnosis', key: 'assessment' },
                { label: 'Plan / Treatment', key: 'plan' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>{f.label}</label>
                  <textarea className="form-input" rows={3} value={(form as Record<string,string>)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} style={{ resize: 'vertical' }} />
                </div>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Follow-up (days)</label>
                  <input className="form-input" type="number" value={form.followUpDays} onChange={e => setForm(p => ({ ...p, followUpDays: e.target.value }))} placeholder="e.g. 30" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Status</label>
                  <select className="form-input" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                    <option value="open">Open</option>
                    <option value="complete">Complete</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNew(false)} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={saveEncounter} disabled={saving || !form.chiefComplaint.trim()} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#0d9488', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
                {saving ? '⏳ Saving…' : '💾 Save Encounter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
