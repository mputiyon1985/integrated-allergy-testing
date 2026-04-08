/**
 * @file app/kiosk/update-info/page.tsx
 * @description Kiosk step: prompts patient to fill in missing contact and insurance info.
 *   Shown only when the patient record is missing phone, email, address, or insuranceId.
 *   On save, updates the Patient record and routes to /kiosk/videos.
 */
/**
 * @file app/kiosk/update-info/page.tsx
 * @description Kiosk contact-info update page.
 *   Prompts the patient to fill in any missing fields (phone, email, address, insurance)
 *   and saves them via PATCH /api/patients/[id]. Skips automatically if all fields present.
 */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface PatientData {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  notes?: string;
  insuranceId?: string;
  [key: string]: unknown;
}

function hasAddress(notes?: string): boolean {
  return !!(notes && notes.includes('Address:'));
}

function hasInsurance(notes?: string, insuranceId?: string): boolean {
  return !!(insuranceId || (notes && notes.includes('Insurance:')));
}

export default function UpdateInfoPage() {
  const router = useRouter();

  const [patient, setPatient] = useState<PatientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Missing field form state
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [memberId, setMemberId] = useState('');

  // What's missing
  const [needPhone, setNeedPhone] = useState(false);
  const [needEmail, setNeedEmail] = useState(false);
  const [needAddress, setNeedAddress] = useState(false);
  const [needInsurance, setNeedInsurance] = useState(false);

  const nextStep = typeof window !== 'undefined'
    ? sessionStorage.getItem('kiosk_next_step') || 'videos'
    : 'videos';

  useEffect(() => {
    async function loadPatient() {
      try {
        const raw = sessionStorage.getItem('kiosk_patient');
        if (!raw) {
          router.push('/kiosk');
          return;
        }
        const cached = JSON.parse(raw) as PatientData;

        // Fetch fresh patient data
        const res = await fetch(`/api/patients/${cached.id}`);
        const data = await res.json();
        const p: PatientData = data.patient || data;

        setPatient(p);

        const missing = {
          phone: !p.phone,
          email: !p.email,
          address: !hasAddress(p.notes),
          insurance: !hasInsurance(p.notes, p.insuranceId),
        };

        setNeedPhone(missing.phone);
        setNeedEmail(missing.email);
        setNeedAddress(missing.address);
        setNeedInsurance(missing.insurance);

        const anyMissing = missing.phone || missing.email || missing.address || missing.insurance;
        if (!anyMissing) {
          // All good — skip straight to next step
          router.push(`/kiosk/${nextStep}`);
          return;
        }
      } catch (e) {
        console.error('Failed to load patient:', e);
        setError('Unable to load your information. Please ask a staff member for help.');
      } finally {
        setLoading(false);
      }
    }

    loadPatient();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function goNext() {
    router.push(`/kiosk/${nextStep}`);
  }

  async function handleSave() {
    if (!patient) return;
    setSaving(true);
    setError('');

    try {
      // Build the update payload
      const updates: Record<string, string> = {};

      if (needPhone && phone.trim()) {
        updates.phone = phone.trim();
      }
      if (needEmail && email.trim()) {
        updates.email = email.trim();
      }

      // Build updated notes
      let notes = patient.notes || '';

      if (needAddress && (street.trim() || city.trim() || state.trim() || zip.trim())) {
        const addressLine = `Address: ${street.trim()}, ${city.trim()}, ${state.trim()} ${zip.trim()}`;
        notes = addressLine + (notes ? '\n' + notes : '');
      }

      if (needInsurance && (insuranceProvider.trim() || memberId.trim())) {
        const insuranceLine = `Insurance: ${insuranceProvider.trim()} ID: ${memberId.trim()}`;
        notes = notes ? notes + '\n' + insuranceLine : insuranceLine;
      }

      if (notes !== patient.notes) {
        updates.notes = notes;
      }

      if (Object.keys(updates).length > 0) {
        // Use dedicated kiosk endpoint (limited field allowlist, no auth required)
        const res = await fetch('/api/kiosk/update-patient', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patientId: patient.id, ...updates }),
        });

        if (!res.ok) {
          throw new Error('Save failed');
        }

        // Update sessionStorage with fresh data
        const saved = await res.json();
        const updatedPatient = saved.patient || { ...patient, ...updates };
        sessionStorage.setItem('kiosk_patient', JSON.stringify(updatedPatient));
      }

      goNext();
    } catch (e) {
      console.error('Save error:', e);
      setError('Could not save your information. You can skip for now and update at the front desk.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ fontSize: 24, color: '#64748b', textAlign: 'center', padding: 40 }}>
        Loading your information…
      </div>
    );
  }

  const patientName = patient
    ? `${patient.firstName || ''} ${patient.lastName || ''}`.trim()
    : '';

  const inputStyle: React.CSSProperties = {
    width: '100%',
    fontSize: 20,
    padding: '16px 18px',
    border: '2px solid #cbd5e1',
    borderRadius: 12,
    outline: 'none',
    color: '#1e293b',
    background: '#f8fafc',
    boxSizing: 'border-box',
    marginTop: 8,
    minHeight: 60,
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 16,
    fontWeight: 600,
    color: '#334155',
    marginBottom: 4,
    marginTop: 20,
  };

  return (
    <div style={{
      background: '#fff',
      borderRadius: 20,
      boxShadow: '0 8px 40px rgba(0,0,0,0.10)',
      padding: '48px 56px',
      maxWidth: 620,
      width: '100%',
    }}>
      {/* Patient name pill */}
      {patientName && (
        <div style={{
          display: 'inline-block',
          background: '#ccfbf1',
          color: '#0f766e',
          borderRadius: 999,
          padding: '6px 20px',
          fontSize: 16,
          fontWeight: 700,
          marginBottom: 24,
        }}>
          👤 {patientName}
        </div>
      )}

      <h1 style={{ fontSize: 30, fontWeight: 800, color: '#0f766e', marginBottom: 8, marginTop: 0 }}>
        Please update your contact information
      </h1>
      <p style={{ fontSize: 17, color: '#475569', marginBottom: 32, marginTop: 0 }}>
        Help us keep your records current
      </p>

      <div>
        {/* Phone */}
        {needPhone && (
          <div>
            <label style={labelStyle}>📱 Cell Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="(555) 555-5555"
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = '#0d9488')}
              onBlur={e => (e.target.style.borderColor = '#cbd5e1')}
            />
          </div>
        )}

        {/* Email */}
        {needEmail && (
          <div>
            <label style={labelStyle}>📧 Email Address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = '#0d9488')}
              onBlur={e => (e.target.style.borderColor = '#cbd5e1')}
            />
          </div>
        )}

        {/* Address */}
        {needAddress && (
          <div>
            <label style={labelStyle}>🏠 Street Address</label>
            <input
              type="text"
              value={street}
              onChange={e => setStreet(e.target.value)}
              placeholder="123 Main St"
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = '#0d9488')}
              onBlur={e => (e.target.style.borderColor = '#cbd5e1')}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginTop: 12 }}>
              <div>
                <label style={{ ...labelStyle, marginTop: 0 }}>City</label>
                <input
                  type="text"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  placeholder="Springfield"
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = '#0d9488')}
                  onBlur={e => (e.target.style.borderColor = '#cbd5e1')}
                />
              </div>
              <div>
                <label style={{ ...labelStyle, marginTop: 0 }}>State</label>
                <input
                  type="text"
                  value={state}
                  onChange={e => setState(e.target.value)}
                  placeholder="VA"
                  maxLength={2}
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = '#0d9488')}
                  onBlur={e => (e.target.style.borderColor = '#cbd5e1')}
                />
              </div>
              <div>
                <label style={{ ...labelStyle, marginTop: 0 }}>ZIP</label>
                <input
                  type="text"
                  value={zip}
                  onChange={e => setZip(e.target.value)}
                  placeholder="22025"
                  maxLength={10}
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = '#0d9488')}
                  onBlur={e => (e.target.style.borderColor = '#cbd5e1')}
                />
              </div>
            </div>
          </div>
        )}

        {/* Insurance */}
        {needInsurance && (
          <div>
            <label style={labelStyle}>🏥 Insurance Provider</label>
            <input
              type="text"
              value={insuranceProvider}
              onChange={e => setInsuranceProvider(e.target.value)}
              placeholder="BlueCross BlueShield"
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = '#0d9488')}
              onBlur={e => (e.target.style.borderColor = '#cbd5e1')}
            />
            <label style={labelStyle}>Member ID / Policy Number</label>
            <input
              type="text"
              value={memberId}
              onChange={e => setMemberId(e.target.value)}
              placeholder="ABC123456789"
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = '#0d9488')}
              onBlur={e => (e.target.style.borderColor = '#cbd5e1')}
            />
          </div>
        )}
      </div>

      {error && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fca5a5',
          borderRadius: 10,
          padding: '14px 18px',
          color: '#dc2626',
          fontSize: 16,
          marginTop: 24,
          marginBottom: 8,
        }}>
          ⚠️ {error}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          width: '100%',
          padding: '22px 0',
          fontSize: 22,
          fontWeight: 700,
          background: saving ? '#94a3b8' : '#0d9488',
          color: '#fff',
          border: 'none',
          borderRadius: 14,
          cursor: saving ? 'not-allowed' : 'pointer',
          minHeight: 70,
          marginTop: 32,
          marginBottom: 16,
        }}
      >
        {saving ? 'Saving…' : '✓ Save & Continue'}
      </button>

      <div style={{ textAlign: 'center' }}>
        <button
          onClick={goNext}
          disabled={saving}
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
          Skip for now →
        </button>
      </div>
    </div>
  );
}
