'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
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
      window.location.replace('/');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #e8f9f7 0%, #e8f0f8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ width: '100%', maxWidth: 440 }}>

        {/* Card */}
        <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 20px 60px rgba(0,0,0,0.12)', overflow: 'hidden' }}>

          {/* Header — teal gradient matching integrated-allergy */}
          <div style={{ background: 'linear-gradient(135deg, #0d9488 0%, #0055A5 100%)', padding: '32px 32px 28px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/integrated-allergy-logo.jpg"
                alt="Integrated Allergy"
                style={{ height: 56, width: 'auto', borderRadius: 8, background: '#fff', padding: '4px 8px' }}
              />
            </div>
            <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '0.01em' }}>
              Integrated Allergy Testing
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 4 }}>
              Clinical Testing Portal
            </p>
          </div>

          {/* Body */}
          <div style={{ padding: '28px 32px' }}>
            <h2 style={{ fontSize: 17, fontWeight: 600, color: '#1f2937', marginBottom: 20, textAlign: 'center' }}>
              Sign in to your account
            </h2>

            <form onSubmit={handleSubmit}>
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
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 10, fontSize: 14, color: '#1f2937', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
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

              {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email || !password}
                style={{ width: '100%', padding: '12px', background: loading || !email || !password ? '#9ca3af' : '#0d9488', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: loading || !email || !password ? 'not-allowed' : 'pointer', transition: 'background 0.2s' }}
              >
                {loading ? '⏳ Signing in...' : 'Sign In'}
              </button>
            </form>
          </div>

          {/* Footer */}
          <div style={{ padding: '0 32px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>
              🔐 HIPAA Compliant Clinical Portal · © {new Date().getFullYear()} Integrated Allergy Testing
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
