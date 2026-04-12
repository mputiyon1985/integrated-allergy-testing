'use client';

import { useState, useEffect, useCallback } from 'react';

interface LocationItem { id: string; name: string; key?: string; }
interface Practice { id: string; name: string; shortName?: string; locations?: LocationItem[]; }

const ACTIVE_LOC_KEY = 'iat_active_location';
const ACTIVE_PRACTICE_KEY = 'iat_active_practice';
const LOC_CACHE_KEY = 'iat_location_data';

export function HeaderLocationSelector() {
  const [practices, setPractices] = useState<Practice[]>([]);
  const [activePracticeId, setActivePracticeId] = useState('');
  const [activeLocationId, setActiveLocationId] = useState('');

  const activePractice = practices.find(p => p.id === activePracticeId);
  const activeLocations = activePractice?.locations ?? [];
  const activeLocation = activeLocations.find(l => l.id === activeLocationId);

  const loadPractices = useCallback(async () => {
    try {
      const cached = localStorage.getItem(LOC_CACHE_KEY);
      if (cached) {
        const { practices: cp } = JSON.parse(cached) as { practices?: Practice[] };
        if (cp?.length) {
          setPractices(cp);
          const storedPractice = localStorage.getItem(ACTIVE_PRACTICE_KEY);
          const storedLoc = localStorage.getItem(ACTIVE_LOC_KEY);
          if (storedPractice) setActivePracticeId(storedPractice);
          if (storedLoc) setActiveLocationId(storedLoc);
        }
      }
      const res = await fetch('/api/practices');
      if (!res.ok) return;
      const data = await res.json() as { practices: Practice[] };
      const ps = data.practices ?? [];
      setPractices(ps);
      try { localStorage.setItem(LOC_CACHE_KEY, JSON.stringify({ practices: ps })); } catch {}
      const storedPractice = localStorage.getItem(ACTIVE_PRACTICE_KEY);
      const storedLoc = localStorage.getItem(ACTIVE_LOC_KEY);
      if (!storedPractice && ps[0]) {
        setActivePracticeId(ps[0].id);
        localStorage.setItem(ACTIVE_PRACTICE_KEY, ps[0].id);
      } else if (storedPractice) {
        setActivePracticeId(storedPractice);
      }
      if (!storedLoc && ps[0]?.locations?.[0]) {
        setActiveLocationId(ps[0].locations[0].id);
        localStorage.setItem(ACTIVE_LOC_KEY, ps[0].locations[0].id);
      } else if (storedLoc) {
        setActiveLocationId(storedLoc);
      }
    } catch {}
  }, []);

  useEffect(() => { loadPractices(); }, [loadPractices]);

  function selectPractice(practiceId: string) {
    setActivePracticeId(practiceId);
    localStorage.setItem(ACTIVE_PRACTICE_KEY, practiceId);
    localStorage.setItem('iat_active_practice_filter', practiceId);
    const practice = practices.find(p => p.id === practiceId);
    const firstLoc = practice?.locations?.[0];
    if (firstLoc) {
      setActiveLocationId(firstLoc.id);
      localStorage.setItem(ACTIVE_LOC_KEY, firstLoc.id);
      localStorage.removeItem('iat_active_practice_filter');
    } else {
      setActiveLocationId('');
      localStorage.setItem(ACTIVE_LOC_KEY, '');
    }
    window.dispatchEvent(new CustomEvent('locationchange', { detail: { practiceId, locationId: firstLoc?.id ?? '' } }));
  }

  function selectLocation(locId: string) {
    setActiveLocationId(locId);
    localStorage.setItem(ACTIVE_LOC_KEY, locId);
    localStorage.removeItem('iat_active_practice_filter');
    window.dispatchEvent(new CustomEvent('locationchange', { detail: { practiceId: activePracticeId, locationId: locId } }));
  }

  if (!practices.length) return null;

  const selectStyle: React.CSSProperties = {
    background: 'transparent',
    border: '1px solid #e2e8f0',
    borderRadius: 6,
    padding: '4px 8px',
    fontSize: 13,
    color: '#374151',
    cursor: 'pointer',
    fontWeight: 500,
    outline: 'none',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {/* Practice selector */}
      <select
        value={activePracticeId}
        onChange={e => selectPractice(e.target.value)}
        style={{ ...selectStyle, color: '#6b7280', fontSize: 12 }}
        title="Select Practice"
      >
        {practices.map(p => (
          <option key={p.id} value={p.id}>{p.shortName ?? p.name}</option>
        ))}
      </select>

      {/* Separator */}
      <span style={{ color: '#cbd5e1', fontSize: 16, fontWeight: 300 }}>›</span>

      {/* Location selector */}
      <select
        value={activeLocationId}
        onChange={e => selectLocation(e.target.value)}
        style={{ ...selectStyle, border: '1px solid #0d9488', color: '#0d9488', fontWeight: 600 }}
        title="Select Location"
      >
        {activeLocations.map(l => (
          <option key={l.id} value={l.id}>{l.name}</option>
        ))}
      </select>
    </div>
  );
}
