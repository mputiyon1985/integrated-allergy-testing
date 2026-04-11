/**
 * @file app/kiosk/page.tsx
 * @description Kiosk home page — patient check-in entry point.
 *   Prompts for date of birth, calls /api/kiosk/lookup, then routes to
 *   verify (existing patient) or register (new patient).
 */
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/** Captures ?locationId from the URL and stores it in sessionStorage for the kiosk flow. */
function LocationCapture() {
  const searchParams = useSearchParams();
  useEffect(() => {
    const locId = searchParams.get('locationId');
    if (locId) sessionStorage.setItem('kiosk_location_id', locId);
  }, [searchParams]);
  return null;
}

function KioskHomeContent() {
  const router = useRouter();
  const [dob, setDob] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleContinue() {
    if (!dob) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/kiosk/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dob }),
      });
      const data = await res.json();

      sessionStorage.setItem('kiosk_dob', dob);
      sessionStorage.setItem('kiosk_lookup', JSON.stringify(data));

      if (data.found) {
        router.push(`/kiosk/verify?dob=${encodeURIComponent(dob)}`);
      } else {
        router.push(`/kiosk/register?dob=${encodeURIComponent(dob)}`);
      }
    } catch {
      setError('Something went wrong. Please try again or ask a staff member for help.');
      setLoading(false);
    }
  }

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
      <div style={{ fontSize: 56, marginBottom: 16 }}>👋</div>
      <h1 style={{
        fontSize: 36,
        fontWeight: 800,
        color: '#0055A5',
        marginBottom: 12,
        lineHeight: 1.2,
      }}>
        Welcome — Patient Check-In
      </h1>
      <p style={{ fontSize: 20, color: '#475569', marginBottom: 40 }}>
        Please enter your date of birth to get started.
      </p>

      <div style={{ marginBottom: 32 }}>
        <label style={{ display: 'block', fontSize: 16, fontWeight: 600, color: '#334155', marginBottom: 10, textAlign: 'left' }}>
          Date of Birth
        </label>
        <input
          type="date"
          value={dob}
          onChange={e => setDob(e.target.value)}
          max={new Date().toISOString().split('T')[0]}
          style={{
            width: '100%',
            fontSize: 24,
            padding: '16px 20px',
            border: '2px solid #cbd5e1',
            borderRadius: 12,
            outline: 'none',
            color: '#1e293b',
            background: '#f8fafc',
            cursor: 'pointer',
            boxSizing: 'border-box',
            transition: 'border-color 0.2s',
          }}
          onFocus={e => (e.target.style.borderColor = '#0d9488')}
          onBlur={e => (e.target.style.borderColor = '#cbd5e1')}
        />
      </div>

      {error && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fca5a5',
          borderRadius: 10,
          padding: '14px 18px',
          color: '#dc2626',
          fontSize: 16,
          marginBottom: 24,
        }}>
          {error}
        </div>
      )}

      <button
        onClick={handleContinue}
        disabled={!dob || loading}
        style={{
          width: '100%',
          padding: '22px 0',
          fontSize: 22,
          fontWeight: 700,
          background: !dob || loading ? '#94a3b8' : '#0d9488',
          color: '#fff',
          border: 'none',
          borderRadius: 14,
          cursor: !dob || loading ? 'not-allowed' : 'pointer',
          transition: 'background 0.2s, transform 0.1s',
          minHeight: 70,
          letterSpacing: 0.3,
        }}
        onMouseDown={e => { if (dob && !loading) (e.currentTarget.style.transform = 'scale(0.98)'); }}
        onMouseUp={e => { (e.currentTarget.style.transform = 'scale(1)'); }}
      >
        {loading ? 'Looking up…' : 'Continue →'}
      </button>
    </div>
  );
}

export default function KioskHomePage() {
  return (
    <>
      <Suspense fallback={null}>
        <LocationCapture />
      </Suspense>
      <KioskHomeContent />
    </>
  );
}
