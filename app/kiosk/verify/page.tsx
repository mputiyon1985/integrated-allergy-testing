/**
 * @file app/kiosk/verify/page.tsx
 * @description Kiosk patient identity verification page.
 *   Prompts the patient to confirm their first name, then calls /api/kiosk/verify.
 *   On success, checks videos/consent completion and routes to the appropriate next step.
 */
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface Patient {
  id: string;
  firstName: string;
}

interface LookupResult {
  found: boolean;
  patients?: Patient[];
}

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [firstName, setFirstName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const raw = sessionStorage.getItem('kiosk_lookup');
    if (raw) {
      const data: LookupResult = JSON.parse(raw);
      if (data.found && data.patients && data.patients.length > 0) {
        setPatients(data.patients);
        if (data.patients.length === 1) {
          setSelectedPatient(data.patients[0]);
        }
      }
    }
  }, []);

  async function handleConfirm() {
    if (!selectedPatient || !firstName.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/kiosk/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: selectedPatient.id, firstName: firstName.trim() }),
      });
      const data = await res.json();
      if (data.verified) {
        // Use full patient data from API response (has full name, not just firstName)
        const patientData = data.patient || { ...selectedPatient, name: `${firstName.trim()} ${selectedPatient.id}` };
        sessionStorage.setItem('kiosk_patient', JSON.stringify(patientData));

        // Check videos watched + consent signed — skip steps already completed
        const patId = patientData.id || selectedPatient.id;
        try {
          const [videosRes, watchedRes, consentRes] = await Promise.all([
            fetch('/api/videos').then(r => r.json()),
            fetch(`/api/kiosk/videos-watched?patientId=${patId}`).then(r => r.json()),
            fetch(`/api/consent/check?patientId=${patId}`).then(r => r.json()),
          ]);
          const totalVideos = (Array.isArray(videosRes) ? videosRes : videosRes.videos ?? []).filter((v: { active?: boolean }) => v.active !== false).length;
          const watchedCount = (watchedRes.watchedIds ?? []).length;
          const allVideosDone = totalVideos === 0 || watchedCount >= totalVideos;
          const allConsentDone = consentRes.allSigned === true;

          let nextStep: string;
          if (allVideosDone && allConsentDone) {
            // Everything done — go straight to done/waiting room
            nextStep = 'done';
          } else if (allVideosDone) {
            // Videos done, consent needed
            nextStep = 'consent';
          } else {
            // Need to watch videos first
            nextStep = 'videos';
          }

          // Store next step so update-info knows where to continue
          sessionStorage.setItem('kiosk_next_step', nextStep);

          // Fetch full patient record to check for missing info
          // (verify API only returns id/firstName for privacy — need separate fetch)
          try {
            const fullPatient = await fetch(`/api/patients/${patientData.id}`).then(r => r.ok ? r.json() : null);
            const missingInfo = fullPatient && (!fullPatient.phone || !fullPatient.email || !fullPatient.insuranceId);
            if (missingInfo) {
              router.push('/kiosk/update-info');
            } else {
              router.push(`/kiosk/${nextStep}`);
            }
          } catch {
            router.push(`/kiosk/${nextStep}`);
          }
        } catch {
          router.push('/kiosk/videos');
        }
      } else {
        // Name doesn't match — automatically take them to new patient registration
        const dob = sessionStorage.getItem('kiosk_dob') || searchParams?.get('dob') || '';
        router.push(`/kiosk/register?dob=${encodeURIComponent(dob)}&firstName=${encodeURIComponent(firstName.trim())}`);
      }
    } catch {
      setError('Something went wrong. Please try again or ask a staff member.');
    } finally {
      setLoading(false);
    }
  }

  const initialsList = patients.map(p => p.firstName.charAt(0).toUpperCase() + '...');

  return (
    <div style={{
      background: '#fff',
      borderRadius: 20,
      boxShadow: '0 8px 40px rgba(0,0,0,0.10)',
      padding: '48px 56px',
      maxWidth: 580,
      width: '100%',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
      <h1 style={{ fontSize: 32, fontWeight: 800, color: '#0055A5', marginBottom: 12 }}>
        Please confirm your first name
      </h1>
      <p style={{ fontSize: 18, color: '#475569', marginBottom: 36 }}>
        We found a record matching your date of birth.
      </p>

      {/* Multiple patients — show initials selector */}
      {patients.length > 1 && !selectedPatient && (
        <div style={{ marginBottom: 36 }}>
          <p style={{ fontSize: 16, color: '#64748b', marginBottom: 16, fontWeight: 600 }}>
            Multiple records found. Select the first initial that matches you:
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            {patients.map((p, i) => (
              <button
                key={p.id}
                onClick={() => setSelectedPatient(p)}
                style={{
                  width: 80,
                  height: 80,
                  fontSize: 28,
                  fontWeight: 700,
                  background: '#f0f9ff',
                  color: '#0055A5',
                  border: '2px solid #bfdbfe',
                  borderRadius: 14,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#0055A5';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#f0f9ff';
                  e.currentTarget.style.color = '#0055A5';
                }}
              >
                {initialsList[i]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Name input — show once patient selected or only one patient */}
      {(selectedPatient || patients.length === 1) && (
        <div style={{ marginBottom: 32 }}>
          <label style={{ display: 'block', fontSize: 16, fontWeight: 600, color: '#334155', marginBottom: 10, textAlign: 'left' }}>
            Your First Name
          </label>
          <input
            type="text"
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            placeholder="Enter your first name"
            autoComplete="off"
            style={{
              width: '100%',
              fontSize: 24,
              padding: '16px 20px',
              border: '2px solid #cbd5e1',
              borderRadius: 12,
              outline: 'none',
              color: '#1e293b',
              background: '#f8fafc',
              boxSizing: 'border-box',
            }}
            onFocus={e => (e.target.style.borderColor = '#0d9488')}
            onBlur={e => (e.target.style.borderColor = '#cbd5e1')}
            onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); }}
          />
        </div>
      )}

      {error && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fca5a5',
          borderRadius: 10,
          padding: '14px 18px',
          color: '#dc2626',
          fontSize: 16,
          marginBottom: 24,
          textAlign: 'left',
        }}>
          ⚠️ {error}
        </div>
      )}

      {(selectedPatient || patients.length === 1) && (
        <button
          onClick={handleConfirm}
          disabled={!firstName.trim() || loading}
          style={{
            width: '100%',
            padding: '22px 0',
            fontSize: 22,
            fontWeight: 700,
            background: !firstName.trim() || loading ? '#94a3b8' : '#0d9488',
            color: '#fff',
            border: 'none',
            borderRadius: 14,
            cursor: !firstName.trim() || loading ? 'not-allowed' : 'pointer',
            minHeight: 70,
            marginBottom: 20,
          }}
        >
          {loading ? 'Verifying…' : '✓ Confirm'}
        </button>
      )}

      {/* If name doesn't match, offer new patient registration */}
      {error && (
        <div style={{ marginBottom: 16, textAlign: 'center' }}>
          <p style={{ fontSize: 15, color: '#64748b', marginBottom: 12 }}>
            Not in our system yet?
          </p>
          <button
            onClick={() => {
              // Keep dob, pass to register
              const dob = sessionStorage.getItem('kiosk_dob') || searchParams?.get('dob') || '';
              router.push(`/kiosk/register?dob=${encodeURIComponent(dob)}&firstName=${encodeURIComponent(firstName.trim())}`);
            }}
            style={{
              width: '100%',
              padding: '18px 0',
              fontSize: 18,
              fontWeight: 700,
              background: '#0055A5',
              color: '#fff',
              border: 'none',
              borderRadius: 14,
              cursor: 'pointer',
              minHeight: 60,
              marginBottom: 12,
            }}
          >
            📝 Register as New Patient →
          </button>
        </div>
      )}

      <button
        onClick={() => router.push('/kiosk')}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#64748b',
          fontSize: 16,
          cursor: 'pointer',
          textDecoration: 'underline',
          padding: '8px 0',
          minHeight: 44,
        }}
      >
        ← Start over
      </button>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div style={{ fontSize: 24, color: '#64748b' }}>Loading…</div>}>
      <VerifyContent />
    </Suspense>
  );
}
