'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { signIn } from 'next-auth/react';

type Step = 'credentials' | 'mfa-verify' | 'mfa-setup' | 'mfa-setup-verify';

function LoginPageInner() {
  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // SSO error from URL
  const searchParams = useSearchParams();
  const ssoError = searchParams?.get('error');

  // Pre-warm key serverless functions while user is on login page
  // This prevents cold-start delays after successful login
  useEffect(() => {
    const warm = () => {
      // Fire and forget — just wake the functions up
      fetch('/api/ping').catch(() => {});
    };
    // Warm immediately + again after 10s in case first hit times out
    warm();
    const t = setTimeout(warm, 10000);
    return () => clearTimeout(t);
  }, []);

  // MFA state
  const [tempToken, setTempToken] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [setupSecret, setSetupSecret] = useState('');
  const [setupQr, setSetupQr] = useState('');
  const [setupCode, setSetupCode] = useState('');

  // Load QR code when entering setup step
  useEffect(() => {
    if (step === 'mfa-setup' && tempToken) {
      fetch('/api/auth/mfa-setup', {
        headers: { 'x-temp-token': tempToken },
      })
        .then(r => r.json())
        .then(data => {
          if (data.secret) {
            setSetupSecret(data.secret);
            setSetupQr(data.qrCode);
          } else {
            setError(data.error || 'Failed to load QR code');
          }
        })
        .catch(() => setError('Network error loading QR code'));
    }
  }, [step, tempToken]);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429) {
          setError('Too many failed attempts. Please wait 15 minutes and try again.');
        } else {
          setError(data.error || 'Invalid email or password.');
        }
        return;
      }
      if (data.success) {
        // MFA disabled — session issued directly
        window.location.replace('/');
      } else if (data.requiresMfa) {
        setTempToken(data.tempToken);
        setStep('mfa-verify');
      } else if (data.requiresMfaSetup) {
        setTempToken(data.tempToken);
        setStep('mfa-setup');
      } else {
        window.location.replace('/');
      }
    } catch {
      setError('Unable to connect — please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleMfaVerify(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/mfa-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken, code: mfaCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Invalid code.');
        return;
      }
      window.location.replace('/');
    } catch {
      setError('Unable to connect — please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleMfaSetupVerify(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/mfa-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken, secret: setupSecret, code: setupCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Invalid code.');
        return;
      }
      window.location.replace('/');
    } catch {
      setError('Unable to connect — please try again.');
    } finally {
      setLoading(false);
    }
  }

  const headerBlock = (
    <div style={{ background: 'linear-gradient(135deg, #0d9488 0%, #0055A5 100%)', padding: '32px 32px 28px', textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/integrated-allergy-logo.jpg"
          alt="Integrated Allergy"
          style={{ height: 56, width: 'auto', borderRadius: 8, background: '#fff', padding: '4px 8px' }}
          onError={e => {
            // Fallback if image fails to load
            const el = e.currentTarget as HTMLImageElement;
            el.style.display = 'none';
            const fallback = el.nextElementSibling as HTMLElement;
            if (fallback) fallback.style.display = 'flex';
          }}
        />
        <div style={{
          display: 'none', alignItems: 'center', justifyContent: 'center',
          height: 56, padding: '0 16px', background: '#fff', borderRadius: 8,
          fontSize: 18, fontWeight: 800, color: '#0d9488', letterSpacing: '-0.5px',
        }}>
          🏥 Integrated Allergy
        </div>
      </div>
      <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '0.01em' }}>
        Integrated Allergy Testing
      </h1>
      <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 4 }}>
        Clinical Testing Portal
      </p>
    </div>
  );

  const errorBlock = error && (
    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
      {error}
    </div>
  );

  const footerBlock = (
    <div style={{ padding: '0 32px 20px', textAlign: 'center' }}>
      <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>
        🔐 HIPAA Compliant Clinical Portal · © {new Date().getFullYear()} Integrated Allergy Testing
      </p>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #e8f9f7 0%, #e8f0f8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 20px 60px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
          {headerBlock}

          {/* Step 1: Credentials */}
          {step === 'credentials' && (
            <div style={{ padding: '28px 32px' }}>
              <h2 style={{ fontSize: 17, fontWeight: 600, color: '#1f2937', marginBottom: 20, textAlign: 'center' }}>
                Sign in to your account
              </h2>

              {/* SSO domain error */}
              {ssoError === 'unauthorized_domain' && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
                  ⚠️ Your Microsoft account domain is not authorized. Contact your administrator.
                </div>
              )}
              {ssoError === 'account_disabled' && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
                  ⚠️ Your account has been disabled. Contact your administrator.
                </div>
              )}
              {ssoError === 'sso_failed' && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
                  ⚠️ Microsoft sign-in failed. Please try again or use email and password.
                </div>
              )}

              {/* Demo Role Switcher */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#166534', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>🎭 Demo — Sign in as a role</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {[
                    { label: '👨‍⚕️ Provider', email: 'demo.provider@iat-demo.com', color: '#7c3aed' },
                    { label: '💉 Clinical Staff', email: 'demo.nurse@iat-demo.com', color: '#0d9488' },
                    { label: '🗓 Front Desk', email: 'demo.frontdesk@iat-demo.com', color: '#2563eb' },
                    { label: '💳 Billing', email: 'demo.billing@iat-demo.com', color: '#d97706' },
                    { label: '🏢 Office Manager', email: 'demo.manager@iat-demo.com', color: '#64748b' },
                    { label: '🔑 Admin', email: 'mputiyon@tipinc.ai', color: '#dc2626', admin: true },
                  ].map(r => (
                    <button
                      key={r.email}
                      type="button"
                      onClick={async () => {
                        setError('');
                        setLoading(true);
                        try {
                          const res = await fetch('/api/auth/login', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email: r.email, password: r.admin ? undefined : 'demo1234', _demoRole: true }),
                          });
                          const data = await res.json();
                          if (!res.ok) { setError(data.error ?? 'Demo login failed'); setLoading(false); return; }
                          if (data.requiresMfa) { setError('MFA required — use email login'); setLoading(false); return; }
                          window.location.href = '/';
                        } catch { setError('Demo login failed'); setLoading(false); }
                      }}
                      disabled={loading}
                      style={{ padding: '8px 10px', background: r.color, color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, textAlign: 'left' }}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: '#6b7280', marginTop: 8 }}>Demo password: <code>demo1234</code> · Admin requires your password</div>
              </div>

              {/* Microsoft SSO button */}
              <button
                onClick={() => signIn('azure-ad', { callbackUrl: '/api/auth/azure-callback' })}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  width: '100%', padding: '12px',
                  background: '#0055A5', color: '#fff',
                  border: 'none', borderRadius: 10,
                  fontSize: 15, fontWeight: 700,
                  cursor: 'pointer', marginBottom: 16,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg" alt="" style={{ width: 20, height: 20 }} />
                Sign in with Microsoft 365
              </button>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                <span style={{ fontSize: 13, color: '#94a3b8', whiteSpace: 'nowrap' }}>or sign in with email</span>
                <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
              </div>

              <form onSubmit={handleCredentials}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                    Email address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoFocus
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 10, fontSize: 14, color: '#1f2937', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => e.target.style.borderColor = '#0d9488'}
                    onBlur={e => e.target.style.borderColor = '#d1d5db'}
                    placeholder="you@clinic.com"
                    disabled={loading}
                  />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                    Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      style={{ width: '100%', padding: '10px 44px 10px 14px', border: '1px solid #d1d5db', borderRadius: 10, fontSize: 14, color: '#1f2937', outline: 'none', boxSizing: 'border-box' }}
                      onFocus={e => e.target.style.borderColor = '#0d9488'}
                      onBlur={e => e.target.style.borderColor = '#d1d5db'}
                      placeholder="••••••••"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 15, padding: 2 }}
                      title={showPassword ? 'Hide' : 'Show'}
                    >
                      {showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>
                {errorBlock}
                <button
                  type="submit"
                  disabled={loading || !email || !password}
                  style={{ width: '100%', padding: '12px', background: loading || !email || !password ? '#9ca3af' : '#0d9488', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: loading || !email || !password ? 'not-allowed' : 'pointer' }}
                >
                  {loading ? '⏳ Signing in...' : 'Sign In'}
                </button>
              </form>
            </div>
          )}

          {/* Step 2: MFA Verify */}
          {step === 'mfa-verify' && (
            <div style={{ padding: '28px 32px' }}>
              <h2 style={{ fontSize: 17, fontWeight: 600, color: '#1f2937', marginBottom: 8, textAlign: 'center' }}>
                🔐 Two-Factor Authentication
              </h2>
              <p style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', marginBottom: 20 }}>
                Enter the 6-digit code from your authenticator app.
              </p>
              <form onSubmit={handleMfaVerify}>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                    Verification Code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={mfaCode}
                    onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
                    required
                    autoFocus
                    placeholder="000000"
                    disabled={loading}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 10, fontSize: 24, textAlign: 'center', letterSpacing: '0.3em', color: '#1f2937', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => e.target.style.borderColor = '#0d9488'}
                    onBlur={e => e.target.style.borderColor = '#d1d5db'}
                  />
                </div>
                {errorBlock}
                <button
                  type="submit"
                  disabled={loading || mfaCode.length !== 6}
                  style={{ width: '100%', padding: '12px', background: loading || mfaCode.length !== 6 ? '#9ca3af' : '#0d9488', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: loading || mfaCode.length !== 6 ? 'not-allowed' : 'pointer' }}
                >
                  {loading ? '⏳ Verifying...' : 'Verify'}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep('credentials'); setMfaCode(''); setError(''); }}
                  style={{ width: '100%', marginTop: 10, padding: '10px', background: 'none', border: '1px solid #d1d5db', borderRadius: 10, fontSize: 14, color: '#6b7280', cursor: 'pointer' }}
                >
                  ← Back
                </button>
              </form>
            </div>
          )}

          {/* Step 3: MFA Setup — show QR code */}
          {step === 'mfa-setup' && (
            <div style={{ padding: '28px 32px' }}>
              <h2 style={{ fontSize: 17, fontWeight: 600, color: '#1f2937', marginBottom: 8, textAlign: 'center' }}>
                🔐 Set Up Two-Factor Authentication
              </h2>
              <p style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', marginBottom: 20 }}>
                Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.), then click Continue.
              </p>
              {!setupQr && !error && (
                <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>⏳ Loading QR code…</p>
              )}
              {setupQr && (
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={setupQr} alt="QR Code" style={{ width: 200, height: 200, margin: '0 auto' }} />
                  <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>
                    Can&apos;t scan? Enter manually: <code style={{ fontSize: 10 }}>{setupSecret}</code>
                  </p>
                </div>
              )}
              {errorBlock}
              {setupQr && (
                <button
                  onClick={() => setStep('mfa-setup-verify')}
                  style={{ width: '100%', padding: '12px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
                >
                  Continue →
                </button>
              )}
              <button
                type="button"
                onClick={() => { setStep('credentials'); setError(''); }}
                style={{ width: '100%', marginTop: 10, padding: '10px', background: 'none', border: '1px solid #d1d5db', borderRadius: 10, fontSize: 14, color: '#6b7280', cursor: 'pointer' }}
              >
                ← Back
              </button>
            </div>
          )}

          {/* Step 4: MFA Setup — verify the code */}
          {step === 'mfa-setup-verify' && (
            <div style={{ padding: '28px 32px' }}>
              <h2 style={{ fontSize: 17, fontWeight: 600, color: '#1f2937', marginBottom: 8, textAlign: 'center' }}>
                🔐 Confirm Your Authenticator
              </h2>
              <p style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', marginBottom: 20 }}>
                Enter the 6-digit code from your authenticator app to complete setup.
              </p>
              <form onSubmit={handleMfaSetupVerify}>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                    Verification Code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={setupCode}
                    onChange={e => setSetupCode(e.target.value.replace(/\D/g, ''))}
                    required
                    autoFocus
                    placeholder="000000"
                    disabled={loading}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 10, fontSize: 24, textAlign: 'center', letterSpacing: '0.3em', color: '#1f2937', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => e.target.style.borderColor = '#0d9488'}
                    onBlur={e => e.target.style.borderColor = '#d1d5db'}
                  />
                </div>
                {errorBlock}
                <button
                  type="submit"
                  disabled={loading || setupCode.length !== 6}
                  style={{ width: '100%', padding: '12px', background: loading || setupCode.length !== 6 ? '#9ca3af' : '#0d9488', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: loading || setupCode.length !== 6 ? 'not-allowed' : 'pointer' }}
                >
                  {loading ? '⏳ Activating MFA...' : 'Enable MFA & Sign In'}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep('mfa-setup'); setSetupCode(''); setError(''); }}
                  style={{ width: '100%', marginTop: 10, padding: '10px', background: 'none', border: '1px solid #d1d5db', borderRadius: 10, fontSize: 14, color: '#6b7280', cursor: 'pointer' }}
                >
                  ← Back to QR Code
                </button>
              </form>
            </div>
          )}

          {footerBlock}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>}>
      <LoginPageInner />
    </Suspense>
  );
}
