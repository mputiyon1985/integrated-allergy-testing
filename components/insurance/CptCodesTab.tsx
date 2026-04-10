'use client';

import { useState, useCallback, useEffect } from 'react';

export function CptCodesTab() {
  const [codes, setCodes] = useState<{ id: string; code: string; description: string; category?: string; nonFacilityFee?: number | null; facilityFee?: number | null; maximumAllowable?: number | null; active: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    fetch('/api/cpt-codes?all=true').then(async r => {
      const data = await r.json();
      if (r.status === 401) throw new Error('session_expired');
      if (!r.ok) throw new Error(data?.error ?? `HTTP ${r.status}`);
      return data;
    })
      .then(d => { setCodes(d.codes ?? (Array.isArray(d) ? d : [])); })
      .catch((err: Error) => {
        const msg = err?.message ?? 'unknown error';
        if (msg === 'session_expired') {
          setLoadError('Your session has expired. Please refresh the page and log in again.');
        } else {
          setLoadError(`Failed to load CPT codes: ${msg}`);
        }
        setCodes([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = codes.filter(c =>
    !search || c.code.toLowerCase().includes(search.toLowerCase()) ||
    c.description.toLowerCase().includes(search.toLowerCase()) ||
    (c.category ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#1a2233' }}>💊 CPT Procedure Codes ({codes.length})</div>
        <input className="form-input" placeholder="Search codes..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: 250, fontSize: 13 }} />
      </div>
      {loadError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#b91c1c', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>🔐</span>
          <span>{loadError}</span>
          <button onClick={load} style={{ marginLeft: 'auto', padding: '4px 12px', background: '#b91c1c', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Retry</button>
        </div>
      )}
      {loading ? <div className="loading-center"><div className="spinner" /></div> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Code', 'Description', 'Category', '2026 NF Rate', '2026 FAC Rate', 'NoVA MAC'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#374151', textTransform: 'uppercase', fontSize: 11, borderBottom: '2px solid #e2e8f0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#f8fafc', opacity: c.active ? 1 : 0.5 }}>
                  <td style={{ padding: '9px 14px', fontWeight: 700, color: '#7c3aed', fontFamily: 'monospace' }}>{c.code}</td>
                  <td style={{ padding: '9px 14px', color: '#374151' }}>{c.description}</td>
                  <td style={{ padding: '9px 14px', color: '#64748b', fontSize: 12 }}>{c.category ?? '—'}</td>
                  <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 12, color: c.nonFacilityFee ? '#15803d' : '#94a3b8', fontWeight: 600 }}>
                    {c.nonFacilityFee ? `$${Number(c.nonFacilityFee).toFixed(2)}` : '—'}
                  </td>
                  <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 12, color: c.facilityFee ? '#0369a1' : '#94a3b8', fontWeight: 600 }}>
                    {c.facilityFee ? `$${Number(c.facilityFee).toFixed(2)}` : '—'}
                  </td>
                  <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 12, color: c.maximumAllowable ? '#7c3aed' : '#94a3b8', fontWeight: 700 }}>
                    {c.maximumAllowable ? `$${Number(c.maximumAllowable).toFixed(2)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
