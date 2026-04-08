'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Encounter {
  id: string; patientId: string; encounterDate: string; doctorName?: string;
  nurseName?: string; chiefComplaint: string; status: string; assessment?: string;
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  open: { bg: '#fef9c3', color: '#b45309' },
  complete: { bg: '#dcfce7', color: '#15803d' },
  cancelled: { bg: '#f3f4f6', color: '#64748b' },
};

export default function EncountersPage() {
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/encounters?limit=100')
      .then(r => r.json())
      .then(d => { setEncounters(d.encounters ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function fmt(d: string) {
    try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch { return d; }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">🏥 Encounter Records</div>
          <div className="page-subtitle">{loading ? 'Loading…' : `${encounters.length} encounters`}</div>
        </div>
      </div>
      <div className="page-body">
        {loading ? <div className="loading-center"><div className="spinner" /></div> :
        encounters.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 48 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏥</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#374151', marginBottom: 8 }}>No encounters yet</div>
            <div style={{ color: '#64748b', marginBottom: 20 }}>Create encounters from the patient detail page</div>
            <Link href="/patients" className="btn">Go to Patients</Link>
          </div>
        ) : (
          <div className="card">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Date', 'Patient ID', 'Physician', 'Chief Complaint', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {encounters.map(e => {
                  const s = STATUS_STYLE[e.status] ?? STATUS_STYLE.open;
                  return (
                    <tr key={e.id} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                      onClick={() => router.push(`/patients/${e.patientId}#encounters`)}
                      onMouseEnter={ev => (ev.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={ev => (ev.currentTarget.style.background = '')}>
                      <td style={{ padding: '10px 14px', color: '#64748b' }}>{fmt(e.encounterDate)}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>{e.patientId.slice(0,12)}…</td>
                      <td style={{ padding: '10px 14px' }}>{e.doctorName ?? '—'}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>{e.chiefComplaint}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 999, ...s }}>{e.status}</span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <Link href={`/patients/${e.patientId}`} onClick={ev => ev.stopPropagation()}
                          style={{ fontSize: 12, color: '#0d9488', fontWeight: 600, textDecoration: 'none' }}>View Patient</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
