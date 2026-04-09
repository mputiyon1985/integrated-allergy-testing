'use client';

import { useState, useEffect, useCallback } from 'react';

interface LocationItem {
  id: string;
  name: string;
  key: string;
  city?: string;
  state?: string;
}

interface Practice {
  id: string;
  name: string;
  shortName?: string | null;
  locations?: LocationItem[];
}

const ACTIVE_LOC_KEY = 'iat_active_location';
const ACTIVE_PRACTICE_KEY = 'iat_active_practice';
const LOC_CACHE_KEY = 'iat_location_data_v2';

export function SidebarLocationSelector() {
  const [practices, setPractices] = useState<Practice[]>([]);
  const [activePracticeId, setActivePracticeId] = useState<string>('');
  const [activeLocationId, setActiveLocationId] = useState<string>('');

  const load = useCallback(async () => {
    // Clear stale old cache format
    try { localStorage.removeItem('iat_location_data'); } catch {}

    // Load cached values instantly
    try {
      const cached = localStorage.getItem(LOC_CACHE_KEY);
      if (cached) {
        const { practices: cp } = JSON.parse(cached) as { practices?: Practice[] };
        if (cp?.length) setPractices(cp);
      }
      const storedPractice = localStorage.getItem(ACTIVE_PRACTICE_KEY);
      if (storedPractice) setActivePracticeId(storedPractice);
      const storedLoc = localStorage.getItem(ACTIVE_LOC_KEY);
      if (storedLoc) setActiveLocationId(storedLoc);
    } catch {}

    // Refresh from API
    try {
      const res = await fetch('/api/practices');
      if (!res.ok) return;
      const data = await res.json() as { practices: Practice[] };
      const ps = data.practices ?? [];
      setPractices(ps);
      try { localStorage.setItem(LOC_CACHE_KEY, JSON.stringify({ practices: ps })); } catch {}

      // Set defaults if not already set
      const storedPractice = localStorage.getItem(ACTIVE_PRACTICE_KEY);
      const storedLoc = localStorage.getItem(ACTIVE_LOC_KEY);

      if (!storedPractice && ps[0]) {
        setActivePracticeId(ps[0].id);
        localStorage.setItem(ACTIVE_PRACTICE_KEY, ps[0].id);
      }
      if (!storedLoc && ps[0]?.locations?.[0]) {
        setActiveLocationId(ps[0].locations[0].id);
        localStorage.setItem(ACTIVE_LOC_KEY, ps[0].locations[0].id);
      }
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const activePractice = practices.find(p => p.id === activePracticeId) ?? practices[0];
  const availableLocations = activePractice?.locations ?? [];

  function switchPractice(practiceId: string) {
    setActivePracticeId(practiceId);
    localStorage.setItem(ACTIVE_PRACTICE_KEY, practiceId);

    // Auto-select first location in new practice
    const practice = practices.find(p => p.id === practiceId);
    if (practice?.locations?.[0]) {
      const locId = practice.locations[0].id;
      setActiveLocationId(locId);
      localStorage.setItem(ACTIVE_LOC_KEY, locId);
      window.dispatchEvent(new CustomEvent('locationchange', { detail: { locationId: locId } }));
    }
  }

  function switchLocation(locId: string) {
    setActiveLocationId(locId);
    localStorage.setItem(ACTIVE_LOC_KEY, locId);
    fetch('/api/user/locations/default', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: locId }),
    }).catch(() => {});
    window.dispatchEvent(new CustomEvent('locationchange', { detail: { locationId: locId } }));
  }

  if (!practices.length) return null;

  const selectStyle: React.CSSProperties = {
    width: '100%',
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: 600,
    color: '#0d9488',
    background: '#f0fdf9',
    border: '1px solid rgba(13,148,136,0.3)',
    borderRadius: 7,
    cursor: 'pointer',
    outline: 'none',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%230d9488'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 8px center',
    paddingRight: 24,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Practice picker */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
          🏢 Practice
        </div>
        {practices.length > 1 ? (
          <select
            value={activePracticeId}
            onChange={e => switchPractice(e.target.value)}
            style={selectStyle}
          >
            {practices.map(p => (
              <option key={p.id} value={p.id}>{p.shortName ?? p.name}</option>
            ))}
          </select>
        ) : (
          <div style={{ fontSize: 12, fontWeight: 600, color: '#0d9488', padding: '6px 10px', background: '#f0fdf9', border: '1px solid rgba(13,148,136,0.2)', borderRadius: 7 }}>
            {activePractice?.shortName ?? activePractice?.name ?? '—'}
          </div>
        )}
      </div>

      {/* Location picker */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
          📍 Location
        </div>
        {availableLocations.length > 1 ? (
          <select
            value={activeLocationId}
            onChange={e => switchLocation(e.target.value)}
            style={selectStyle}
          >
            {availableLocations.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        ) : (
          <div style={{ fontSize: 12, fontWeight: 600, color: '#0d9488', padding: '6px 10px', background: '#f0fdf9', border: '1px solid rgba(13,148,136,0.2)', borderRadius: 7 }}>
            {availableLocations[0]?.name ?? '—'}
          </div>
        )}
      </div>
    </div>
  );
}
