/**
 * @file app/kiosk/services/page.tsx
 * @description Kiosk service selection step. Patient selects their reason for today's visit
 *   before watching required videos. Fetches active appointment reasons from /api/appointment-reasons.
 *   Saves selected reason to sessionStorage as kiosk_service_reason, then routes to /kiosk/videos.
 */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface AppointmentReason {
  id: string;
  name: string;
  color: string;
  duration: number;
  sortOrder: number;
  active: boolean;
}

export default function ServicesPage() {
  const router = useRouter();
  const [reasons, setReasons] = useState<AppointmentReason[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selecting, setSelecting] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/appointment-reasons')
      .then(r => r.json())
      .then(data => {
        const list: AppointmentReason[] = data.reasons ?? [];
        setReasons(list.filter(r => r.active !== false));
        setLoading(false);
      })
      .catch(() => {
        setError('Could not load services. Please ask a staff member.');
        setLoading(false);
      });
  }, []);

  function handleSelect(reason: AppointmentReason) {
    setSelecting(reason.id);
    sessionStorage.setItem(
      'kiosk_service_reason',
      JSON.stringify({ id: reason.id, name: reason.name, color: reason.color, duration: reason.duration })
    );
    router.push('/kiosk/videos');
  }

  function handleSkip() {
    router.push('/kiosk/videos');
  }

  /** Convert minutes to a friendly label, e.g. 15 → "~15 min", 60 → "~1 hr" */
  function formatDuration(minutes: number): string {
    if (!minutes || minutes <= 0) return '';
    if (minutes < 60) return `~${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `~${h} hr ${m} min` : `~${h} hr`;
  }

  /** Determine whether to use white or dark text based on button background color */
  function contrastColor(hex: string): string {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    // Luminance formula
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.55 ? '#1e293b' : '#ffffff';
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <div style={{ fontSize: 24, color: '#64748b' }}>Loading services…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        background: '#fff',
        borderRadius: 20,
        boxShadow: '0 8px 40px rgba(0,0,0,0.10)',
        padding: '48px 56px',
        maxWidth: 560,
        width: '100%',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <p style={{ fontSize: 20, color: '#dc2626', marginBottom: 32 }}>{error}</p>
        <button
          onClick={handleSkip}
          style={{
            padding: '18px 40px',
            fontSize: 18,
            fontWeight: 700,
            background: '#0d9488',
            color: '#fff',
            border: 'none',
            borderRadius: 14,
            cursor: 'pointer',
            minHeight: 60,
          }}
        >
          Continue Anyway →
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760, width: '100%' }}>
      {/* Page header */}
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>👋</div>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: '#0055A5', marginBottom: 10, lineHeight: 1.2 }}>
          Welcome!
        </h1>
        <p style={{ fontSize: 20, color: '#475569', lineHeight: 1.5 }}>
          Please select your reason for today&apos;s visit
        </p>
      </div>

      {/* Service grid */}
      {reasons.length === 0 ? (
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <p style={{ fontSize: 18, color: '#64748b' }}>No services configured. Please see a staff member.</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 20,
          marginBottom: 36,
        }}>
          {reasons.map(reason => {
            const bg = reason.color || '#0d9488';
            const fg = contrastColor(bg);
            const isSelecting = selecting === reason.id;
            const duration = formatDuration(reason.duration);

            return (
              <button
                key={reason.id}
                onClick={() => handleSelect(reason)}
                disabled={selecting !== null}
                style={{
                  background: isSelecting ? '#94a3b8' : bg,
                  color: isSelecting ? '#fff' : fg,
                  border: 'none',
                  borderRadius: 18,
                  padding: '32px 24px',
                  minHeight: 130,
                  cursor: selecting !== null ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: isSelecting ? 'none' : '0 4px 20px rgba(0,0,0,0.15)',
                  transition: 'transform 0.1s, box-shadow 0.1s, background 0.2s',
                  transform: isSelecting ? 'scale(0.97)' : 'scale(1)',
                  textAlign: 'center',
                  WebkitTapHighlightColor: 'transparent',
                  userSelect: 'none',
                }}
                onTouchStart={e => {
                  if (selecting === null) {
                    (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
                  }
                }}
                onTouchEnd={e => {
                  if (selecting === null) {
                    (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)';
                  }
                }}
                onMouseEnter={e => {
                  if (selecting === null) {
                    (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.02)';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 28px rgba(0,0,0,0.2)';
                  }
                }}
                onMouseLeave={e => {
                  if (selecting === null) {
                    (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)';
                  }
                }}
              >
                <span style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>
                  {isSelecting ? '⏳ ' : ''}{reason.name}
                </span>
                {duration && (
                  <span style={{ fontSize: 16, opacity: 0.85, fontWeight: 500 }}>
                    {duration}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Skip button */}
      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <button
          onClick={handleSkip}
          disabled={selecting !== null}
          style={{
            background: 'transparent',
            border: '1px solid #cbd5e1',
            color: '#64748b',
            fontSize: 16,
            padding: '14px 36px',
            borderRadius: 50,
            cursor: selecting !== null ? 'not-allowed' : 'pointer',
            minHeight: 50,
            fontWeight: 500,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            if (selecting === null) {
              (e.currentTarget as HTMLButtonElement).style.background = '#f1f5f9';
              (e.currentTarget as HTMLButtonElement).style.color = '#475569';
            }
          }}
          onMouseLeave={e => {
            if (selecting === null) {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.color = '#64748b';
            }
          }}
        >
          Skip / Not Sure
        </button>
      </div>
    </div>
  );
}
