'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getLocationParam } from '@/lib/location-params';

interface Patient {
  id: string;
  patientId?: string;
  name: string;
  dob?: string;
  status: string;
  clinicLocation?: string;
  physician?: string;
  email?: string;
  photoUrl?: string;
}

const STATUS_BADGE: Record<string, string> = {
  registered: 'badge-blue',
  tested: 'badge-yellow',
  consented: 'badge-green',
  complete: 'badge-teal',
};

export default function PatientsPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function loadPatients() {
    setLoading(true);
    fetch(`/api/patients${getLocationParam()}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load patients');
        return r.json();
      })
      .then((data) => {
        const list: Patient[] = Array.isArray(data) ? data : (data.patients ?? []);
        setPatients(list);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadPatients();
    const handler = () => loadPatients();
    window.addEventListener('locationchange', handler);
    return () => window.removeEventListener('locationchange', handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = patients.filter((p) => {
    const q = search.toLowerCase();
    return (p.name ?? '').toLowerCase().includes(q) || (p.patientId ?? p.id).toLowerCase().includes(q);
  });

  function formatDOB(val?: string) {
    if (!val) return '—';
    try {
      const d = new Date(val);
      return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
        .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return val;
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Patients</div>
          <div className="page-subtitle">
            {loading ? 'Loading...' : `${filtered.length} patient${filtered.length !== 1 ? 's' : ''}`}
          </div>
        </div>
        <Link href="/patients/new" className="btn">
          + Register Patient
        </Link>
      </div>

      <div className="page-body">
        {error && <div className="alert alert-error">⚠️ {error}</div>}

        {/* Search */}
        <div className="card mb-6">
          <div className="search-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="form-input search-input"
              placeholder="Search by name or patient ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="loading-center"><div className="spinner" /><span>Loading patients…</span></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👥</div>
            <div className="empty-state-title">{search ? 'No patients match your search' : 'No patients yet'}</div>
            {!search && (
              <div style={{ marginTop: 16 }}>
                <Link href="/patients/new" className="btn">Register First Patient</Link>
              </div>
            )}
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Patient ID</th>
                  <th></th>
                  <th>Name</th>
                  <th>Date of Birth</th>
                  <th>Status</th>
                  <th>Location</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} onClick={() => router.push(`/patients/${p.id}`)}>
                    <td>
                      <code style={{ fontSize: 12, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>
                        {p.patientId ?? p.id.slice(0, 8).toUpperCase()}
                      </code>
                    </td>
                    <td style={{ width: 40, padding: '6px 0 6px 12px' }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', overflow: 'hidden',
                        background: p.photoUrl ? 'transparent' : '#0d9488',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, border: '2px solid #e2e8f0',
                      }}>
                        {p.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.photoUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', userSelect: 'none' }}>
                            {p.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>
                        {p.name}
                      </div>
                      {p.email && <div style={{ fontSize: 12, color: '#64748b' }}>{p.email}</div>}
                    </td>
                    <td>{formatDOB(p.dob)}</td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[p.status?.toLowerCase()] ?? 'badge-gray'}`}>
                        {p.status ?? 'unknown'}
                      </span>
                    </td>
                    <td>{p.clinicLocation ?? '—'}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-2">
                        <Link href={`/patients/${p.id}`} className="btn btn-sm btn-secondary">View</Link>
                        <Link href={`/testing?patientId=${p.id}`} className="btn btn-sm">Test</Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
