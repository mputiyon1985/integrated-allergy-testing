'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { TestPanel, AllergenEntry, PanelState, Location, GRADE_COLORS, typeToCategory } from '@/components/testing/TestPanel';

/* ─── Types ─────────────────────────────────────────────────────── */

interface Patient {
  id: string;
  patientId?: string;
  name: string;
  dob?: string;
  physician?: string;
  clinicLocation?: string;
  insuranceId?: string;
}

interface Allergen {
  id: string;
  name: string;
  category?: string;
  type?: string;
  showOnTestingScreen?: boolean;
}




function formatDOB(val?: string) {
  if (!val) return '—';
  try { return new Date(val).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }); }
  catch { return val; }
}

function today() {
  return new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

/* ─── Step 1: Select Patient + Tester ───────────────────────────── */

function TestingSetup({ onStart }: {
  onStart: (patient: Patient, nurse: string) => void;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [nurses, setNurses] = useState<{ id: string; name: string; title?: string }[]>([]);
  const [selectedNurse, setSelectedNurse] = useState('');

  const search = useCallback((val: string) => {
    if (val.length < 2) { Promise.resolve().then(() => setResults([])); return; }
    void (async () => { try {
      let _locP = ''; try { const _l = localStorage.getItem('iat_active_location'); if (_l) _locP = `&locationId=${_l}`; } catch {}
      const r = await fetch(`/api/patients?search=${encodeURIComponent(val)}${_locP}`);
      const d = await r.json();
      setResults((Array.isArray(d) ? d : d.patients ?? []).slice(0, 10));
    } catch { setResults([]); } })();
  }, []);

  useEffect(() => { search(q); }, [q, search]);

  useEffect(() => {
    (() => { let lp = ''; try { const l = localStorage.getItem('iat_active_location'); if (l) lp = `?locationId=${l}`; } catch {} return fetch(`/api/nurses${lp}`); })()
      .then(r => r.ok ? r.json() : [])
      .then((d: { id: string; name: string; title?: string }[] | { nurses?: { id: string; name: string; title?: string }[] }) => {
        const list = Array.isArray(d) ? d : (d.nurses ?? []);
        setNurses(list);
      })
      .catch(() => {});
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.10)', width: '100%', maxWidth: 540 }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #0055A5, #0d9488)', borderRadius: '16px 16px 0 0', padding: '24px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🧪</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>Allergy Testing</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>Select patient and tester to begin</div>
        </div>

        <div style={{ padding: '28px 32px' }}>
          {/* Step 1: Patient */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              Step 1 — Select Patient
            </div>
            {selectedPatient ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#e8f9f7', border: '2px solid #0d9488', borderRadius: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#0d9488' }}>{selectedPatient.name}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{selectedPatient.patientId} · {selectedPatient.physician ?? 'No physician'}</div>
                </div>
                <button onClick={() => { setSelectedPatient(null); setQ(''); }}
                  style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18 }}>✕</button>
              </div>
            ) : (
              <>
                <input autoFocus className="form-input" placeholder="Search by name or patient ID…" value={q}
                  onChange={e => setQ(e.target.value)} style={{ fontSize: 15, padding: '12px 16px' }} />
                {results.length > 0 && (
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', marginTop: 4 }}>
                    {results.map((p, i) => (
                      <div key={p.id} onClick={() => { setSelectedPatient(p); setResults([]); setQ(''); }}
                        style={{ padding: '11px 16px', cursor: 'pointer', fontSize: 14, borderBottom: i < results.length - 1 ? '1px solid #f1f5f9' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f0fffe')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}>
                        <div>
                          <span style={{ fontWeight: 600 }}>{p.name}</span>
                          <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 8 }}>{p.patientId ?? p.id.slice(0,8).toUpperCase()}</span>
                        </div>
                        <span style={{ fontSize: 12, color: '#0d9488', fontWeight: 700 }}>SELECT →</span>
                      </div>
                    ))}
                  </div>
                )}
                {q.length >= 2 && results.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, padding: '10px 0' }}>No patients found</div>
                )}
              </>
            )}
          </div>

          {/* Step 2: Nurse */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              Step 2 — Tested By (Nurse / Clinician)
            </div>
            <select className="form-input" value={selectedNurse} onChange={e => setSelectedNurse(e.target.value)}
              style={{ fontSize: 15, padding: '12px 16px' }}>
              <option value="">— Select Clinician —</option>
              {nurses.map(n => (
                <option key={n.id} value={n.name}>{n.title ? `${n.title} ${n.name}` : n.name}</option>
              ))}
            </select>
          </div>

          {/* Begin button */}
          <button
            onClick={() => { if (selectedPatient && selectedNurse) onStart(selectedPatient, selectedNurse); }}
            disabled={!selectedPatient || !selectedNurse}
            style={{
              width: '100%', padding: '14px', borderRadius: 10, border: 'none',
              background: selectedPatient && selectedNurse ? '#0d9488' : '#e2e8f0',
              color: selectedPatient && selectedNurse ? '#fff' : '#94a3b8',
              fontSize: 16, fontWeight: 800, cursor: selectedPatient && selectedNurse ? 'pointer' : 'not-allowed',
              transition: 'background 0.2s',
            }}
          >
            {selectedPatient && selectedNurse ? '🧪 Begin Testing →' : 'Select patient and clinician to continue'}
          </button>

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Link href="/patients/new" style={{ fontSize: 13, color: '#0055A5', fontWeight: 600 }}>+ Register New Patient</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────── */

function buildRows(allergens: Allergen[]): AllergenEntry[] {
  return allergens.map(a => ({
    allergenId: a.id,
    allergenName: a.name,
    category: typeToCategory(a.type ?? a.category),
    grade: null,
    wheal: '',
    flare: '',
    location: 'RA',
  }));
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 641);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return isMobile;
}

function TestingPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlPatientId = searchParams?.get('patientId');

  const [patient, setPatient] = useState<Patient | null>(null);
  const [allergens, setAllergens] = useState<Allergen[]>([]);
  const [prick, setPrick] = useState<PanelState>({ rows: [] });
  const [intradermal, setIntradermal] = useState<PanelState>({ rows: [] });
  const [testTab, setTestTab] = useState<'prick' | 'intradermal'>('prick');
  const isMobile = useIsMobile();
  const [loadingPatient, setLoadingPatient] = useState(false);
  const [loadingAllergens, setLoadingAllergens] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [applyWheal, setApplyWheal] = useState('');
  const [applyFlare, setApplyFlare] = useState('');
  const [testedBy, setTestedBy] = useState('');
  const [nurses, setNurses] = useState<{ id: string; name: string; title?: string; active?: boolean }[]>([]);
  const printRef = useRef<HTMLDivElement>(null);

  // Load nurses for "Tested By" dropdown
  useEffect(() => {
    fetch('/api/nurses')
      .then(r => r.ok ? r.json() : [])
      .then((data: { id: string; name: string; title?: string; active?: boolean }[] | { nurses?: { id: string; name: string; title?: string; active?: boolean }[] }) => {
        const list = Array.isArray(data) ? data : (data.nurses ?? []);
        setNurses(list.filter(n => n.active !== false));
      })
      .catch(() => {});
  }, []);

  // Load allergens — Prick and Intradermal use separate panel lists
  useEffect(() => {
    Promise.all([
      fetch('/api/allergens?testingScreen=true').then(r => r.ok ? r.json() : []),
      fetch('/api/allergens?intradermalOnly=true').then(r => r.ok ? r.json() : []),
    ])
      .then(([prickData, intradermalData]) => {
        const prickList: Allergen[] = Array.isArray(prickData) ? prickData : (prickData.allergens ?? []);
        const intradermalList: Allergen[] = Array.isArray(intradermalData) ? intradermalData : (intradermalData.allergens ?? []);
        setAllergens(prickList); // keep for reference/PDF
        setPrick({ rows: buildRows(prickList) });
        setIntradermal({ rows: buildRows(intradermalList) });
      })
      .catch(() => {})
      .finally(() => setLoadingAllergens(false));
  }, []);

  // Load patient from URL
  useEffect(() => {
    if (!urlPatientId) return;
    setLoadingPatient(true);
    fetch(`/api/patients/${urlPatientId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setPatient(d.patient ?? d))
      .catch(() => {})
      .finally(() => setLoadingPatient(false));
  }, [urlPatientId]);

  function handleStart(p: Patient, nurse: string) {
    setPatient(p);
    setTestedBy(nurse);
    router.replace(`/testing?patientId=${p.id}`);
  }

  // Apply to all
  function applyToAll(field: 'wheal' | 'flare', val: string) {
    const apply = (rows: AllergenEntry[]) => rows.map(r => ({ ...r, [field]: val }));
    setPrick(prev => ({ rows: apply(prev.rows) }));
    setIntradermal(prev => ({ rows: apply(prev.rows) }));
  }

  // Clear all
  function clearAll() {
    const clear = (rows: AllergenEntry[]) => rows.map(r => ({
      ...r, grade: null, wheal: '', flare: '', location: 'RA' as Location,
    }));
    setPrick(prev => ({ rows: clear(prev.rows) }));
    setIntradermal(prev => ({ rows: clear(prev.rows) }));
    setSaved(false);
    setError('');
  }

  // Save results
  async function handleSave() {
    if (!patient) return;
    setError('');
    setSaving(true);

    const toSave: Array<{
      allergenId: string;
      testType: string;
      reaction: number;
      wheal?: string;
      flare?: string;
      location?: string;
    }> = [];

    for (const row of prick.rows) {
      if (row.grade !== null) {
        toSave.push({
          allergenId: row.allergenId,
          testType: 'scratch',
          reaction: Math.min(row.grade, 4),
          wheal: row.wheal || undefined,
          flare: row.flare || undefined,
          location: row.location,
        });
      }
    }
    for (const row of intradermal.rows) {
      if (row.grade !== null) {
        toSave.push({
          allergenId: row.allergenId,
          testType: 'intradermal',
          reaction: Math.min(row.grade, 4),
          wheal: row.wheal || undefined,
          flare: row.flare || undefined,
          location: row.location,
        });
      }
    }

    if (toSave.length === 0) {
      setError('No grades recorded. Select at least one reaction grade to save.');
      setSaving(false);
      return;
    }

    try {
      const results = await Promise.allSettled(
        toSave.map(item =>
          fetch('/api/test-results', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              patientId: patient.id,
              allergenId: item.allergenId,
              testType: item.testType,
              reaction: item.reaction,
              wheal: item.wheal,
              nurseName: testedBy || undefined,
              notes: [
                item.flare ? `Flare: ${item.flare}mm` : '',
                item.location !== 'Back' ? `Location: ${item.location}` : '',
              ].filter(Boolean).join('; ') || undefined,
            }),
          })
        )
      );

      const failed = results.filter(r => r.status === 'rejected').length;
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      if (failed > 0 && succeeded === 0) throw new Error('All saves failed — check connection.');
      if (failed > 0) throw new Error(`${failed} result(s) failed to save. ${succeeded} saved successfully.`);
      setSaved(true);

      // Auto-link to today's open encounter (fire and forget)
      const prickCount = toSave.filter(i => i.testType === 'scratch').length;
      const intradermalCount = toSave.filter(i => i.testType === 'intradermal').length;
      fetch('/api/encounters/auto-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: patient.id,
          activityType: 'allergy_test',
          notes: `${prickCount} prick + ${intradermalCount} intradermal results recorded`,
          performedBy: testedBy || undefined,
        }),
      }).catch(() => {}); // silent fail — don't block the test save
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function handlePrint() {
    // Build a clean print-only HTML page — avoids all the interactive UI clutter
    const prickResults = prick.rows.filter(r => r.grade !== null);
    const idResults = intradermal.rows.filter(r => r.grade !== null);

    const gradeLabel: Record<number, string> = {
      0: 'Negative', 1: 'Trace', 2: 'Positive', 3: 'Strong', 4: 'Very Strong', 5: 'Extreme',
    };
    const gradeColor: Record<number, string> = {
      0: '#64748b', 1: '#ca8a04', 2: '#ea580c', 3: '#dc2626', 4: '#991b1b', 5: '#7f1d1d',
    };

    const testDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    const renderRows = (rows: typeof prickResults) =>
      rows.map((r, i) => `
        <tr style="border-bottom:1px solid #e2e8f0; background:${(r.grade ?? 0) >= 2 ? '#fff7ed' : i % 2 === 0 ? '#fff' : '#f8fafc'}">
          <td style="padding:6px 10px;">${i + 1}</td>
          <td style="padding:6px 10px; font-weight:600;">${r.allergenName}</td>
          <td style="padding:6px 10px; color:#64748b; font-size:12px;">${r.category ?? ''}</td>
          <td style="padding:6px 10px; font-weight:800; font-size:16px; color:${gradeColor[r.grade ?? 0]};">${r.grade}</td>
          <td style="padding:6px 10px; color:#64748b; font-size:12px;">${gradeLabel[r.grade ?? 0]}</td>
          <td style="padding:6px 10px; color:#374151;">${r.wheal ? r.wheal + ' mm' : '—'}</td>
          <td style="padding:6px 10px; color:#374151;">${r.flare ? r.flare + ' mm' : '—'}</td>
          <td style="padding:6px 10px; color:#64748b;">${r.location}</td>
          <td style="padding:6px 10px; color:#64748b; font-size:11px;">${testDate}</td>
        </tr>`).join('');

    const tableHtml = (title: string, icon: string, rows: typeof prickResults) =>
      rows.length === 0 ? '' : `
        <div style="margin-bottom:24px;">
          <h3 style="font-size:14px; font-weight:700; color:#0055A5; text-transform:uppercase; letter-spacing:0.06em; margin:0 0 8px; padding-bottom:6px; border-bottom:2px solid #0055A5;">
            ${icon} ${title} — ${rows.length} allergen${rows.length !== 1 ? 's' : ''} tested &nbsp;·&nbsp; <span style="font-weight:500; text-transform:none;">${testDate}</span>
          </h3>
          <table style="width:100%; border-collapse:collapse; font-size:13px; font-family:system-ui,sans-serif;">
            <thead>
              <tr style="background:#0055A5; color:#fff;">
                <th style="padding:6px 10px; text-align:left; width:30px;">#</th>
                <th style="padding:6px 10px; text-align:left;">Allergen</th>
                <th style="padding:6px 10px; text-align:left;">Category</th>
                <th style="padding:6px 10px; text-align:left;">Grade</th>
                <th style="padding:6px 10px; text-align:left;">Result</th>
                <th style="padding:6px 10px; text-align:left;">Wheal</th>
                <th style="padding:6px 10px; text-align:left;">Flare</th>
                <th style="padding:6px 10px; text-align:left;">Site</th>
                <th style="padding:6px 10px; text-align:left;">Test Date</th>
              </tr>
            </thead>
            <tbody>${renderRows(rows)}</tbody>
          </table>
        </div>`;

    const html = `<!DOCTYPE html>
<html><head><title>Allergy Test Results — ${fullName}</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 0; padding: 20px; color: #1a2233; }
  @media print { body { padding: 10px; } }
</style>
</head><body>
<div style="border-bottom:3px solid #0055A5; padding-bottom:12px; margin-bottom:16px;">
  <div style="font-size:20px; font-weight:800; color:#0055A5; margin-bottom:8px;">Integrated Allergy Testing — Allergy Test Results</div>
  <div style="display:flex; gap:32px; font-size:13px; flex-wrap:wrap;">
    <span><strong>Patient:</strong> ${fullName}</span>
    <span><strong>ID:</strong> ${patient?.patientId ?? patient?.id?.slice(0,8).toUpperCase()}</span>
    <span><strong>DOB:</strong> ${patient?.dob ? new Date(patient.dob).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}) : '—'}</span>
    <span><strong>Physician:</strong> ${patient?.physician ?? '—'}</span>
    <span><strong>Clinic Location:</strong> ${patient?.clinicLocation ?? '—'}</span>
    <span><strong>Insurance ID:</strong> ${patient?.insuranceId ?? '—'}</span>
    <span><strong>Tested By:</strong> ${testedBy || '—'}</span>
    <span><strong>Date:</strong> ${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</span>
  </div>
</div>
<div style="background:#f0fdf4; border:1px solid #86efac; border-radius:6px; padding:8px 14px; margin-bottom:16px; font-size:12px; color:#166534;">
  <strong>Grade Legend:</strong>&nbsp;
  0 = Negative &nbsp;|&nbsp; 1 = Trace &nbsp;|&nbsp; 2 = Positive &nbsp;|&nbsp; 3 = Strong &nbsp;|&nbsp; 4 = Very Strong &nbsp;|&nbsp; 5 = Extreme
</div>
${tableHtml('Prick Test', '🩹', prickResults)}
${tableHtml('Intradermal Test', '💉', idResults)}
${(prickResults.length + idResults.length) === 0 ? '<p style="color:#94a3b8; text-align:center; padding:40px;">No graded results to print.</p>' : ''}
<div style="margin-top:32px; border-top:1px solid #e2e8f0; padding-top:12px; font-size:11px; color:#94a3b8; display:flex; justify-content:space-between;">
  <span>Integrated Allergy Testing — HIPAA Compliant</span>
  <span>Printed: ${new Date().toLocaleString('en-US')}</span>
</div>
</body></html>`;

    const w = window.open('', '_blank', 'width=900,height=700');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => { w.print(); }, 400);
    }
  }

  // ── Step 1: select patient + nurse (unless coming from URL with patientId)
  if (!patient && !loadingPatient && !urlPatientId) {
    return <TestingSetup onStart={handleStart} />;
  }

  // ── Loading
  if (loadingPatient || loadingAllergens) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#64748b' }}>
          <div className="spinner" />
          <span>Loading…</span>
        </div>
      </div>
    );
  }

  const fullName = patient?.name ?? '';
  const prickCount = prick.rows.filter(r => r.grade !== null).length;
  const idCount = intradermal.rows.filter(r => r.grade !== null).length;
  const totalGraded = prickCount + idCount;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#F8FAFC' }} ref={printRef}>

      {/* ── Top Bar ──────────────────────────────────────────── */}
      {/* Print-only patient header */}
      <div className="no-print" style={{ display: 'none' }} />
      <style>{`
        @media print {
          .print-patient-header { display: block !important; margin-bottom: 16px; border-bottom: 2px solid #0055A5; padding-bottom: 10px; }
        }
        .print-patient-header { display: none; }
      `}</style>
      <div className="print-patient-header">
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0055A5', marginBottom: 4 }}>Integrated Allergy Testing — Allergy Test Results</div>
        <div style={{ display: 'flex', gap: 32, fontSize: 13, flexWrap: 'wrap' }}>
          <span><strong>Patient:</strong> {fullName}</span>
          <span><strong>ID:</strong> {patient?.patientId ?? patient?.id?.slice(0,8).toUpperCase()}</span>
          <span><strong>DOB:</strong> {formatDOB(patient?.dob)}</span>
          <span><strong>Physician:</strong> {patient?.physician ?? '—'}</span>
          <span><strong>Location:</strong> {patient?.clinicLocation ?? '—'}</span>
          <span><strong>Test Date:</strong> {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
        </div>
      </div>

      <div style={{
        background: '#0055A5', color: '#fff',
        padding: '10px 20px',
        display: 'flex', flexWrap: 'wrap', gap: 16,
        alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 50,
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      }} className="no-print">
        {/* Patient info */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', fontSize: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ opacity: 0.7 }}>Patient:</span>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{fullName}</span>
            <button
              onClick={() => { setPatient(null); router.replace('/testing'); }}
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}
            >
              ✕ Change
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ opacity: 0.7 }}>DOB:</span>
            <span style={{ fontWeight: 600 }}>{formatDOB(patient?.dob)}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ opacity: 0.7 }}>Date:</span>
            <span style={{ fontWeight: 600 }}>{today()}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ opacity: 0.7 }}>Tested By:</span>
            <select
              value={testedBy}
              onChange={e => setTestedBy(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: 4, padding: '3px 8px', color: '#fff', fontSize: 13,
                width: 160, cursor: 'pointer',
              }}
            >
              <option value="" style={{ color: '#374151', background: '#fff' }}>— Select Nurse —</option>
              {nurses.map(n => (
                <option key={n.id} value={n.name} style={{ color: '#374151', background: '#fff' }}>
                  {n.title ? `${n.title} ${n.name}` : n.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Top action buttons */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {saved && (
            <span style={{ background: '#10b981', color: '#fff', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              ✓ Saved
            </span>
          )}
          <button onClick={clearAll} style={topBtn('#475569')}>Clear All</button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={topBtn('#2EC4B6', saving)}
          >
            {saving ? '…Saving' : `💾 Save${totalGraded > 0 ? ` (${totalGraded})` : ''}`}
          </button>
          <button onClick={handlePrint} style={topBtn('#6366f1')}>🖨️ Print</button>
          <Link href={patient ? `/patients/${patient.id}` : '/patients'} style={{ ...topBtn('#1d4ed8') as React.CSSProperties, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
            👤 Patient
          </Link>
        </div>
      </div>

      {/* ── Error banner ─────────────────────────────────────── */}
      {error && (
        <div style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', padding: '10px 20px', fontSize: 13, fontWeight: 500, display: 'flex', gap: 8, alignItems: 'center' }}>
          ⚠️ {error}
          <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>
      )}

      {/* ── Legend ───────────────────────────────────────────── */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '6px 20px', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Grade Legend:</span>
        {Object.entries(GRADE_COLORS).map(([g, c]) => (
          <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 20, height: 20, borderRadius: 3, background: c.bg, border: `1.5px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: c.text }}>{g}</div>
            <span style={{ fontSize: 11, color: '#64748b' }}>
              {g === '0' ? 'Negative' : g === '1' ? 'Trace' : g === '2' ? 'Positive' : g === '3' ? 'Strong' : g === '4' ? 'Very Strong' : 'Extreme'}
            </span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: 11, color: '#64748b' }}>
          Prick: <strong style={{ color: '#0055A5' }}>{prickCount}</strong> graded &nbsp;|&nbsp;
          Intradermal: <strong style={{ color: '#0055A5' }}>{idCount}</strong> graded
        </div>
      </div>

      {/* ── Nurse required banner ────────────────────────────── */}
      {!testedBy && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 16px', margin: '0 16px 8px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#92400e', fontWeight: 600 }}>
          ⚠️ Please select a nurse/clinician in the <strong>&quot;Tested By&quot;</strong> field above before recording results.
        </div>
      )}

      {/* ── Tab selector ──────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 0, padding: '8px 12px 0', borderBottom: '2px solid #e2e8f0' }}>
        <button
          onClick={() => setTestTab('prick')}
          style={{
            padding: '8px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none',
            borderRadius: '8px 8px 0 0', borderBottom: testTab === 'prick' ? '2px solid #0055A5' : 'none',
            background: testTab === 'prick' ? '#fff' : '#f1f5f9',
            color: testTab === 'prick' ? '#0055A5' : '#64748b',
            marginBottom: testTab === 'prick' ? '-2px' : '0',
          }}
        >
          🩹 Prick Test
          {prick.rows.filter(r => r.grade !== null).length > 0 && (
            <span style={{ marginLeft: 6, background: '#0055A5', color: '#fff', borderRadius: 999, fontSize: 10, padding: '1px 6px', fontWeight: 700 }}>
              {prick.rows.filter(r => r.grade !== null).length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTestTab('intradermal')}
          style={{
            padding: '8px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none',
            borderRadius: '8px 8px 0 0', borderBottom: testTab === 'intradermal' ? '2px solid #7c3aed' : 'none',
            background: testTab === 'intradermal' ? '#fff' : '#f1f5f9',
            color: testTab === 'intradermal' ? '#7c3aed' : '#64748b',
            marginBottom: testTab === 'intradermal' ? '-2px' : '0',
          }}
        >
          💉 Intradermal
          {intradermal.rows.filter(r => r.grade !== null).length > 0 && (
            <span style={{ marginLeft: 6, background: '#7c3aed', color: '#fff', borderRadius: 999, fontSize: 10, padding: '1px 6px', fontWeight: 700 }}>
              {intradermal.rows.filter(r => r.grade !== null).length}
            </span>
          )}
        </button>
      </div>

      {/* ── Panel area ────────────────────────────────────────── */}
      {allergens.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 40 }}>🌿</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#475569' }}>No allergens configured</div>
          <div style={{ fontSize: 13 }}>Add allergens through the API to begin testing.</div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', padding: '12px', overflow: 'auto' }}>
          {testTab === 'prick' ? (
            <TestPanel
              title="Prick Test"
              color="#0055A5"
              state={prick}
              onChange={rows => setPrick({ rows })}
              locked={!testedBy}
              columns={isMobile ? 1 : 3}
            />
          ) : (
            <div style={{ display: 'flex', gap: 0, width: '100%' }}>
              <div style={{ width: 'min(33.33%, 100%)', minWidth: 0, maxWidth: '100%' }}
                   className="intradermal-panel-wrapper">
                <style>{`@media(max-width:640px){.intradermal-panel-wrapper{width:100%!important}}`}</style>
                <TestPanel
                  title="Intradermal Test"
                  color="#7c3aed"
                  state={intradermal}
                  onChange={rows => setIntradermal({ rows })}
                  locked={!testedBy}
                  columns={1}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Bottom Action Bar ─────────────────────────────────── */}
      <div style={{
        background: '#fff', borderTop: '2px solid #e2e8f0',
        padding: '12px 20px',
        position: 'sticky', bottom: 0, zIndex: 50,
        display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center',
        boxShadow: '0 -2px 12px rgba(0,0,0,0.08)',
      }}>
        {/* Apply to all */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Apply to All:</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 12, color: '#374151' }}>Wheal</span>
            <input
              type="number" min="0" max="99" step="0.1"
              value={applyWheal}
              onChange={e => setApplyWheal(e.target.value)}
              placeholder="mm"
              style={{ width: 52, height: 30, fontSize: 12, border: '1px solid #cbd5e1', borderRadius: 4, padding: '2px 6px', textAlign: 'center' }}
            />
            <button
              onClick={() => { if (applyWheal) applyToAll('wheal', applyWheal); }}
              style={bottomBtn('#0055A5')}
            >
              Set
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 12, color: '#374151' }}>Flare</span>
            <input
              type="number" min="0" max="99" step="0.1"
              value={applyFlare}
              onChange={e => setApplyFlare(e.target.value)}
              placeholder="mm"
              style={{ width: 52, height: 30, fontSize: 12, border: '1px solid #cbd5e1', borderRadius: 4, padding: '2px 6px', textAlign: 'center' }}
            />
            <button
              onClick={() => { if (applyFlare) applyToAll('flare', applyFlare); }}
              style={bottomBtn('#0055A5')}
            >
              Set
            </button>
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 32, background: '#e2e8f0', flexShrink: 0 }} />

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginLeft: 'auto', alignItems: 'center' }}>
          {totalGraded > 0 && (
            <span style={{ fontSize: 12, color: '#64748b' }}>
              <strong style={{ color: '#0055A5' }}>{totalGraded}</strong> result{totalGraded !== 1 ? 's' : ''} ready to save
            </span>
          )}
          <button onClick={clearAll} style={bottomBtn('#64748b')}>Clear All</button>
          <button onClick={handlePrint} style={bottomBtn('#6366f1')}>🖨️ Print</button>
          <button
            onClick={handleSave}
            disabled={saving || totalGraded === 0 || !testedBy}
            style={bottomBtn('#2EC4B6', saving || totalGraded === 0)}
          >
            {saving ? '…Saving' : '💾 Save Results'}
          </button>
          {saved && (
            <Link href={patient ? `/patients/${patient.id}` : '/patients'} style={{ ...bottomBtn('#10b981') as React.CSSProperties, textDecoration: 'none' }}>
              View Patient Record →
            </Link>
          )}
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          .sidebar, .sidebar-toggle, .sidebar-overlay { display: none !important; }
          .main-content { margin-left: 0 !important; }
          body { background: #fff !important; }
          /* Hide rows that were not tested (no grade entered) */
          .untested-row { display: none !important; }
          /* Hide action inputs/buttons in print */
          .no-print { display: none !important; }
          /* Show full allergen names — no truncation */
          .allergen-name {
            overflow: visible !important;
            text-overflow: clip !important;
            white-space: normal !important;
            word-break: break-word !important;
          }
          /* Compact inputs */
          input, select { border: none !important; background: transparent !important; font-size: 11px !important; }
          select { -webkit-appearance: none !important; }
        }
      `}</style>
    </div>
  );
}

function topBtn(bg: string, disabled?: boolean): React.CSSProperties {
  return {
    background: disabled ? '#94a3b8' : bg,
    color: '#fff', border: 'none', borderRadius: 6,
    padding: '7px 14px', fontSize: 12, fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    minHeight: 34, whiteSpace: 'nowrap',
    transition: 'background 0.15s',
    opacity: disabled ? 0.7 : 1,
  };
}

function bottomBtn(bg: string, disabled?: boolean): React.CSSProperties {
  return {
    background: disabled ? '#e2e8f0' : bg,
    color: disabled ? '#94a3b8' : '#fff',
    border: 'none', borderRadius: 6,
    padding: '6px 14px', fontSize: 12, fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    minHeight: 32, whiteSpace: 'nowrap',
    transition: 'background 0.15s',
  };
}

export default function TestingPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontSize: '18px', color: '#6b7280' }}>Loading testing panel...</div>}>
      <TestingPageInner />
    </Suspense>
  )
}
