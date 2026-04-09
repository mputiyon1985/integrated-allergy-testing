'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

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
}

const ACTIVE_LOC_KEY = 'iat_active_location';

const LOC_CACHE_KEY = 'iat_location_data_v2';

export function LocationSelector() {
  const [practice, setPractice] = useState<Practice | null>(null);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    // Load from cache instantly first
    try {
      const cached = localStorage.getItem(LOC_CACHE_KEY);
      if (cached) {
        const { practice: cp, locations: cl } = JSON.parse(cached);
        if (cp) setPractice(cp);
        if (cl?.length) setLocations(cl);
      }
      const storedLoc = localStorage.getItem(ACTIVE_LOC_KEY);
      if (storedLoc) setActiveId(storedLoc);
    } catch {}

    // Then refresh from API
    try {
      // Clear old stale cache key
      try { localStorage.removeItem('iat_location_data'); } catch {}

      const res = await fetch('/api/user/locations');
      if (!res.ok) return;
      const data = await res.json() as {
        practice: Practice | null;
        locations: LocationItem[];
        defaultLocationId: string;
      };
      setPractice(data.practice);
      setLocations(data.locations ?? []);
      try { localStorage.setItem(LOC_CACHE_KEY, JSON.stringify({ practice: data.practice, locations: data.locations })); } catch {}

      const stored = localStorage.getItem(ACTIVE_LOC_KEY);
      const initial = stored ?? data.defaultLocationId;
      setActiveId(initial);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  // Re-sync when sidebar switches location
  useEffect(() => {
    function handleLocationChange(e: Event) {
      const locId = (e as CustomEvent).detail?.locationId;
      if (locId) {
        setActiveId(locId);
        setOpen(false);
        load(); // re-fetch to get updated practice name
      }
    }
    window.addEventListener('locationchange', handleLocationChange);
    return () => window.removeEventListener('locationchange', handleLocationChange);
  }, [load]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function switchLocation(locId: string) {
    setActiveId(locId);
    setOpen(false);
    localStorage.setItem(ACTIVE_LOC_KEY, locId);

    // Persist as new default (fire-and-forget)
    fetch('/api/user/locations/default', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: locId }),
    }).catch(() => {});

    // Notify all pages to re-fetch with new location
    window.dispatchEvent(new CustomEvent('locationchange', { detail: { locationId: locId } }));
  }

  const activeLoc = locations.find((l) => l.id === activeId) ?? locations[0];
  const multiLoc = locations.length > 1;

  if (!activeLoc) return null;

  const practiceName = practice?.name ?? '';
  const locationName = activeLoc.name;

  return (
    <div
      ref={ref}
      style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
    >
      {multiLoc ? (
        <button
          onClick={() => setOpen((v) => !v)}
          title="Switch location"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(13,148,136,0.08)',
            border: '1px solid rgba(13,148,136,0.25)',
            borderRadius: 8,
            padding: '5px 10px',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
            color: '#374151',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ fontSize: 14 }}>📍</span>
          {practiceName && (
            <span style={{ fontWeight: 700, color: '#0d9488' }}>{practiceName}</span>
          )}
          {practiceName && <span style={{ color: '#9ca3af' }}>—</span>}
          <span style={{ color: '#0d9488', fontWeight: 600 }}>{locationName}</span>
          <span style={{ fontSize: 10, color: '#6b7280', marginLeft: 2 }}>▾</span>
        </button>
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            fontWeight: 500,
            color: '#374151',
            padding: '5px 10px',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ fontSize: 14 }}>📍</span>
          {practiceName && (
            <span style={{ fontWeight: 700, color: '#0d9488' }}>{practiceName}</span>
          )}
          {practiceName && <span style={{ color: '#9ca3af' }}>—</span>}
          <span style={{ color: '#0d9488', fontWeight: 600 }}>{locationName}</span>
        </div>
      )}

      {open && multiLoc && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            minWidth: 240,
            zIndex: 1000,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '8px 14px 6px',
              fontSize: 11,
              fontWeight: 700,
              color: '#9ca3af',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              borderBottom: '1px solid #f1f5f9',
            }}
          >
            Switch Location
          </div>
          {locations.map((loc) => (
            <button
              key={loc.id}
              onClick={() => switchLocation(loc.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '10px 14px',
                background: loc.id === activeId ? '#f0fdf9' : 'transparent',
                border: 'none',
                borderBottom: '1px solid #f8fafc',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: 13,
                color: loc.id === activeId ? '#0d9488' : '#374151',
                fontWeight: loc.id === activeId ? 700 : 400,
              }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>
                {loc.id === activeId ? '✅' : '📍'}
              </span>
              <div>
                <div style={{ fontWeight: 600 }}>{loc.name}</div>
                {(loc.city || loc.state) && (
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>
                    {[loc.city, loc.state].filter(Boolean).join(', ')}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
