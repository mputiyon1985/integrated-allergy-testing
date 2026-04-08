'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function formatDob(dob: string): string {
  if (!dob) return '';
  const [year, month, day] = dob.split('-');
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${months[parseInt(month, 10) - 1]} ${parseInt(day, 10)}, ${year}`;
}

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dob = searchParams.get('dob') || '';

  const [step, setStep] = useState(1);
  const [firstName, setFirstName] = useState(searchParams?.get('firstName') || '');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRegister() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/kiosk/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim(), dob }),
      });
      const data = await res.json();
      if (res.ok && data.patient) {
        sessionStorage.setItem('kiosk_patient', JSON.stringify(data.patient));
        setStep(3);
        setTimeout(() => router.push('/kiosk/videos'), 2000);
      } else {
        setError(data.error || 'Registration failed. Please see a staff member.');
        setStep(2);
      }
    } catch {
      setError('Something went wrong. Please see a staff member.');
      setStep(2);
    } finally {
      setLoading(false);
    }
  }

  const cardStyle: React.CSSProperties = {
    background: '#fff',
    borderRadius: 20,
    boxShadow: '0 8px 40px rgba(0,0,0,0.10)',
    padding: '48px 56px',
    maxWidth: 580,
    width: '100%',
    textAlign: 'center',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    fontSize: 24,
    padding: '16px 20px',
    border: '2px solid #cbd5e1',
    borderRadius: 12,
    outline: 'none',
    color: '#1e293b',
    background: '#f8fafc',
    boxSizing: 'border-box',
    marginBottom: 16,
  };

  const primaryBtnStyle: React.CSSProperties = {
    width: '100%',
    padding: '22px 0',
    fontSize: 22,
    fontWeight: 700,
    background: '#0d9488',
    color: '#fff',
    border: 'none',
    borderRadius: 14,
    cursor: 'pointer',
    minHeight: 70,
    marginBottom: 16,
  };

  const disabledBtnStyle: React.CSSProperties = {
    ...primaryBtnStyle,
    background: '#94a3b8',
    cursor: 'not-allowed',
  };

  // Progress indicator
  const ProgressBar = () => (
    <div style={{ display: 'flex', gap: 8, marginBottom: 36, justifyContent: 'center' }}>
      {[1, 2, 3].map(s => (
        <div key={s} style={{
          flex: 1,
          maxWidth: 80,
          height: 6,
          borderRadius: 3,
          background: s <= step ? '#0d9488' : '#e2e8f0',
          transition: 'background 0.3s',
        }} />
      ))}
    </div>
  );

  if (step === 1) {
    return (
      <div style={cardStyle}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
        <h1 style={{ fontSize: 30, fontWeight: 800, color: '#0055A5', marginBottom: 12 }}>
          Let&apos;s Create Your Record
        </h1>
        <p style={{ fontSize: 18, color: '#475569', marginBottom: 32 }}>
          We couldn&apos;t find you in our system. Please enter your name below.
        </p>
        <ProgressBar />

        <div style={{ textAlign: 'left', marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 16, fontWeight: 600, color: '#334155', marginBottom: 8 }}>
            First Name <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input
            type="text"
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            placeholder="First name"
            autoComplete="off"
            style={inputStyle}
            onFocus={e => (e.target.style.borderColor = '#0d9488')}
            onBlur={e => (e.target.style.borderColor = '#cbd5e1')}
          />
          <label style={{ display: 'block', fontSize: 16, fontWeight: 600, color: '#334155', marginBottom: 8 }}>
            Last Name <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input
            type="text"
            value={lastName}
            onChange={e => setLastName(e.target.value)}
            placeholder="Last name"
            autoComplete="off"
            style={{ ...inputStyle, marginBottom: 0 }}
            onFocus={e => (e.target.style.borderColor = '#0d9488')}
            onBlur={e => (e.target.style.borderColor = '#cbd5e1')}
          />
        </div>

        <button
          onClick={() => setStep(2)}
          disabled={!firstName.trim() || !lastName.trim()}
          style={!firstName.trim() || !lastName.trim() ? disabledBtnStyle : primaryBtnStyle}
        >
          Continue →
        </button>

        <button
          onClick={() => router.push('/kiosk')}
          style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: 16, cursor: 'pointer', textDecoration: 'underline', minHeight: 44 }}
        >
          ← Go back
        </button>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div style={cardStyle}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <h1 style={{ fontSize: 30, fontWeight: 800, color: '#0055A5', marginBottom: 12 }}>
          Please Confirm Your Information
        </h1>
        <ProgressBar />

        <div style={{
          background: '#f0f9ff',
          border: '2px solid #bfdbfe',
          borderRadius: 14,
          padding: '28px 32px',
          textAlign: 'left',
          marginBottom: 32,
        }}>
          <div style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>Name</span>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#1e293b', marginTop: 4 }}>
              {firstName} {lastName}
            </div>
          </div>
          <div>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>Date of Birth</span>
            <div style={{ fontSize: 24, fontWeight: 600, color: '#1e293b', marginTop: 4 }}>
              {formatDob(dob)}
            </div>
          </div>
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
            textAlign: 'left',
          }}>
            ⚠️ {error}
          </div>
        )}

        <button
          onClick={handleRegister}
          disabled={loading}
          style={loading ? disabledBtnStyle : primaryBtnStyle}
        >
          {loading ? 'Registering…' : '✅ This is correct — Register Me'}
        </button>

        <button
          onClick={() => { setStep(1); setError(''); }}
          style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: 16, cursor: 'pointer', textDecoration: 'underline', minHeight: 44 }}
        >
          ← Go back to correct
        </button>
      </div>
    );
  }

  // Step 3: Done
  return (
    <div style={cardStyle}>
      <ProgressBar />
      <div style={{ fontSize: 72, marginBottom: 24 }}>✅</div>
      <h1 style={{ fontSize: 36, fontWeight: 800, color: '#0d9488', marginBottom: 16 }}>
        Welcome, {firstName}!
      </h1>
      <p style={{ fontSize: 20, color: '#475569' }}>
        You&apos;ve been registered. Proceeding to next step…
      </p>
      <div style={{ marginTop: 32 }}>
        <div style={{
          width: 40,
          height: 40,
          border: '4px solid #e2e8f0',
          borderTopColor: '#0d9488',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto',
        }} />
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div style={{ fontSize: 24, color: '#64748b' }}>Loading…</div>}>
      <RegisterContent />
    </Suspense>
  );
}
