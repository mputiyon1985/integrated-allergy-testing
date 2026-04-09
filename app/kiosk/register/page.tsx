/**
 * @file app/kiosk/register/page.tsx
 * @description Kiosk new-patient registration — collects full contact info.
 */
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function formatDob(dob: string): string {
  if (!dob) return '';
  const [year, month, day] = dob.split('-');
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${months[parseInt(month, 10) - 1]} ${parseInt(day, 10)}, ${year}`;
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '14px 16px', fontSize: 18,
  border: '2px solid #e2e8f0', borderRadius: 10, boxSizing: 'border-box',
  outline: 'none', color: '#1f2937',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 14, fontWeight: 700,
  color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em',
};

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dob = searchParams.get('dob') || '';

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Name
  const [firstName, setFirstName] = useState(searchParams?.get('firstName') || '');
  const [lastName, setLastName] = useState('');

  // Step 2: Contact
  const [cellPhone, setCellPhone] = useState('');
  const [email, setEmail] = useState('');

  // Step 3: Address
  const [street, setStreet] = useState('');
  const [apt, setApt] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');

  // Step 4: Insurance
  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [insuranceId, setInsuranceId] = useState('');
  const [insuranceOptions, setInsuranceOptions] = useState<{id: string; name: string}[]>([]);

  useEffect(() => {
    fetch('/api/insurance-companies?all=true')
      .then(r => r.ok ? r.json() : { companies: [] })
      .then(d => setInsuranceOptions((d.companies ?? []).filter((c: {active: boolean}) => c.active)))
      .catch(() => {});
  }, []);

  async function handleRegister() {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/kiosk/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(), lastName: lastName.trim(), dob,
          phone: cellPhone, email, street, apt, city, state, zip,
          insuranceProvider, insuranceId,
        }),
      });
      const data = await res.json();
      if (res.ok && data.patient) {
        sessionStorage.setItem('kiosk_patient', JSON.stringify(data.patient));
        setStep(5);
        setTimeout(() => router.push('/kiosk/videos'), 2000);
      } else {
        setError(data.error || 'Registration failed. Please see a staff member.');
      }
    } catch {
      setError('Something went wrong. Please see a staff member.');
    } finally { setLoading(false); }
  }

  const primaryBtn: React.CSSProperties = {
    width: '100%', padding: '18px', fontSize: 20, fontWeight: 800,
    background: '#0d9488', color: '#fff', border: 'none', borderRadius: 14,
    cursor: 'pointer', marginTop: 8, minHeight: 64,
  };
  const secondaryBtn: React.CSSProperties = {
    background: 'transparent', border: 'none', color: '#64748b',
    fontSize: 16, cursor: 'pointer', textDecoration: 'underline', padding: '8px 0',
  };

  const TOTAL_STEPS = 4;
  const progressPct = (step / TOTAL_STEPS) * 100;

  return (
    <div style={{ width: '100%', maxWidth: 560 }}>
      <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 8px 40px rgba(0,0,0,0.10)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #0055A5, #0d9488)', padding: '24px 32px' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>New Patient Registration</div>
          {step < 5 && (
            <>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', marginBottom: 12 }}>
                Step {step} of {TOTAL_STEPS}
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 999 }}>
                <div style={{ height: '100%', width: `${progressPct}%`, background: '#fff', borderRadius: 999, transition: 'width 0.4s' }} />
              </div>
            </>
          )}
        </div>

        <div style={{ padding: '28px 32px' }}>
          {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 8, padding: '12px 16px', fontSize: 14, marginBottom: 16 }}>⚠️ {error}</div>}

          {/* Step 1: Name */}
          {step === 1 && (
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0055A5', marginBottom: 20 }}>What is your name?</div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>First Name *</label>
                <input style={inputStyle} value={firstName} onChange={e => setFirstName(e.target.value)}
                  placeholder="Jane" autoFocus
                  onFocus={e => e.target.style.borderColor = '#0d9488'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Last Name *</label>
                <input style={inputStyle} value={lastName} onChange={e => setLastName(e.target.value)}
                  placeholder="Smith"
                  onFocus={e => e.target.style.borderColor = '#0d9488'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>
              <div style={{ background: '#f0f9ff', borderRadius: 8, padding: '10px 14px', fontSize: 14, color: '#0369a1', marginBottom: 20 }}>
                📅 Date of Birth: <strong>{formatDob(dob)}</strong>
              </div>
              <button style={{ ...primaryBtn, opacity: (!firstName.trim() || !lastName.trim()) ? 0.5 : 1 }}
                disabled={!firstName.trim() || !lastName.trim()}
                onClick={() => setStep(2)}>Continue →</button>
            </div>
          )}

          {/* Step 2: Contact */}
          {step === 2 && (
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0055A5', marginBottom: 20 }}>Contact Information</div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Cell Phone</label>
                <input style={inputStyle} type="tel" value={cellPhone} onChange={e => setCellPhone(e.target.value)}
                  placeholder="(555) 555-0100"
                  onFocus={e => e.target.style.borderColor = '#0d9488'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Email Address</label>
                <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="jane@example.com"
                  onFocus={e => e.target.style.borderColor = '#0d9488'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>
              <button style={primaryBtn} onClick={() => setStep(3)}>Continue →</button>
              <div style={{ textAlign: 'center', marginTop: 12 }}>
                <button style={secondaryBtn} onClick={() => setStep(1)}>← Back</button>
              </div>
            </div>
          )}

          {/* Step 3: Address */}
          {step === 3 && (
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0055A5', marginBottom: 20 }}>Home Address</div>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Street Address</label>
                <input style={inputStyle} value={street} onChange={e => setStreet(e.target.value)}
                  placeholder="123 Main Street"
                  onFocus={e => e.target.style.borderColor = '#0d9488'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Apt / Suite</label>
                <input style={inputStyle} value={apt} onChange={e => setApt(e.target.value)}
                  placeholder="Apt 2B (optional)"
                  onFocus={e => e.target.style.borderColor = '#0d9488'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
                <div>
                  <label style={labelStyle}>City</label>
                  <input style={inputStyle} value={city} onChange={e => setCity(e.target.value)} placeholder="City"
                    onFocus={e => e.target.style.borderColor = '#0d9488'}
                    onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                </div>
                <div>
                  <label style={labelStyle}>State</label>
                  <input style={inputStyle} value={state} onChange={e => setState(e.target.value.toUpperCase())} placeholder="VA" maxLength={2}
                    onFocus={e => e.target.style.borderColor = '#0d9488'}
                    onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                </div>
                <div>
                  <label style={labelStyle}>ZIP</label>
                  <input style={inputStyle} value={zip} onChange={e => setZip(e.target.value)} placeholder="22026" maxLength={10}
                    onFocus={e => e.target.style.borderColor = '#0d9488'}
                    onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
                </div>
              </div>
              <button style={primaryBtn} onClick={() => setStep(4)}>Continue →</button>
              <div style={{ textAlign: 'center', marginTop: 12 }}>
                <button style={secondaryBtn} onClick={() => setStep(2)}>← Back</button>
              </div>
            </div>
          )}

          {/* Step 4: Insurance + Confirm */}
          {step === 4 && (
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0055A5', marginBottom: 20 }}>Insurance Information</div>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Insurance Provider</label>
                <select style={{ ...inputStyle, cursor: 'pointer' }} value={insuranceProvider} onChange={e => setInsuranceProvider(e.target.value)}>
                  <option value="">— Select insurance provider —</option>
                  {insuranceOptions.map(ins => (
                    <option key={ins.id} value={ins.name}>{ins.name}</option>
                  ))}
                  <option value="Other">Other / Not Listed</option>
                  <option value="Self Pay">Self Pay / No Insurance</option>
                </select>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Member / Insurance ID</label>
                <input style={inputStyle} value={insuranceId} onChange={e => setInsuranceId(e.target.value)}
                  placeholder="Member ID number"
                  onFocus={e => e.target.style.borderColor = '#0d9488'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
              </div>

              {/* Summary */}
              <div style={{ background: '#f8fafc', borderRadius: 10, padding: 16, marginBottom: 20, fontSize: 14 }}>
                <div style={{ fontWeight: 700, marginBottom: 8, color: '#374151' }}>Please confirm your information:</div>
                <div><strong>Name:</strong> {firstName} {lastName}</div>
                <div><strong>DOB:</strong> {formatDob(dob)}</div>
                {cellPhone && <div><strong>Phone:</strong> {cellPhone}</div>}
                {email && <div><strong>Email:</strong> {email}</div>}
                {city && <div><strong>Address:</strong> {[street, apt, city, state, zip].filter(Boolean).join(', ')}</div>}
              </div>

              <button style={{ ...primaryBtn, background: loading ? '#94a3b8' : '#0d9488' }}
                disabled={loading} onClick={handleRegister}>
                {loading ? '⏳ Registering…' : '✅ Register & Continue'}
              </button>
              <div style={{ textAlign: 'center', marginTop: 12 }}>
                <button style={secondaryBtn} onClick={() => setStep(3)}>← Back</button>
              </div>
            </div>
          )}

          {/* Step 5: Done */}
          {step === 5 && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#0d9488', marginBottom: 8 }}>Welcome, {firstName}!</div>
              <div style={{ fontSize: 16, color: '#64748b' }}>You&apos;ve been registered. Proceeding to next step…</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', fontSize: 18, color: '#64748b' }}>Loading…</div>}>
      <RegisterContent />
    </Suspense>
  );
}
