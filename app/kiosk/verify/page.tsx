'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
}

interface LookupResult {
  found: boolean;
  patients?: Patient[];
}

function VerifyContent() {
  const router = useRouter();
  // dob is in sessionStorage lookup data (passed via URL on the way in)

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
        sessionStorage.setItem('kiosk_patient', JSON.stringify(selectedPatient));
        router.push('/kiosk/videos');
      } else {
        setError("Name doesn't match — please try again or see staff.");
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
        ← Not me — go back
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
