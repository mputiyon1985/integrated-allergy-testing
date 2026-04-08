'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Doctor { id: string; name: string; }
interface Location { id: string; name: string; }

export default function NewPatientPage() {
  const router = useRouter();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    // Section 1 — Patient
    name: '',
    dob: '',
    email: '',
    phone: '',
    // Section 2 — Clinical
    physician: '',
    clinicLocation: '',
    diagnosis: '',
    // Section 3 — Insurance / Notes
    insuranceId: '',
    insuranceProvider: '',
    notes: '',
  });

  useEffect(() => {
    fetch('/api/doctors')
      .then(r => r.ok ? r.json() : [])
      .then((d: Doctor[] | { doctors?: Doctor[] }) => setDoctors(Array.isArray(d) ? d : (d.doctors ?? [])))
      .catch(() => {});
    fetch('/api/locations')
      .then(r => r.ok ? r.json() : [])
      .then((d: Location[]) => setLocations(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  function setField(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!form.name.trim()) { setError('Name is required'); return; }
    if (!form.dob) { setError('Date of birth is required'); return; }

    setSaving(true);
    try {
      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          dob: form.dob,
          email: form.email || undefined,
          phone: form.phone || undefined,
          physician: form.physician || undefined,
          clinicLocation: form.clinicLocation || undefined,
          diagnosis: form.diagnosis || undefined,
          insuranceId: form.insuranceId || undefined,
          insuranceProvider: form.insuranceProvider || undefined,
          notes: form.notes || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? `Request failed: ${res.status}`);
      }

      const created = await res.json();
      router.push(`/patients/${created.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to register patient');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Register New Patient</div>
          <div className="page-subtitle">Complete all required fields to register the patient</div>
        </div>
        <Link href="/patients" className="btn btn-secondary">← Back to Patients</Link>
      </div>

      <div className="page-body">
        {error && <div className="alert alert-error">⚠️ {error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Section 1 — Patient Info */}
          <div className="card form-section">
            <div className="form-section-title">
              <span className="form-section-number">1</span>
              Patient Information
            </div>

            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">Full Name <span className="required">*</span></label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Jane Smith"
                  value={form.name}
                  onChange={e => setField('name', e.target.value)}
                  required
                  style={{ fontSize: 16 }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Date of Birth <span className="required">*</span></label>
                <input
                  type="date"
                  className="form-input"
                  value={form.dob}
                  onChange={e => setField('dob', e.target.value)}
                  required
                  style={{ fontSize: 16 }}
                />
              </div>
            </div>

            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="patient@example.com"
                  value={form.email}
                  onChange={e => setField('email', e.target.value)}
                  style={{ fontSize: 16 }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input
                  type="tel"
                  className="form-input"
                  placeholder="(555) 555-0100"
                  value={form.phone}
                  onChange={e => setField('phone', e.target.value)}
                  style={{ fontSize: 16 }}
                />
              </div>
            </div>
          </div>

          {/* Section 2 — Clinical */}
          <div className="card form-section">
            <div className="form-section-title">
              <span className="form-section-number">2</span>
              Clinical Information
            </div>

            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">Physician</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Referring physician name"
                  value={form.physician}
                  onChange={e => setField('physician', e.target.value)}
                  list="doctors-list"
                  style={{ fontSize: 16 }}
                />
                <datalist id="doctors-list">
                  {doctors.map(d => <option key={d.id} value={d.name} />)}
                </datalist>
              </div>
              <div className="form-group">
                <label className="form-label">Clinic Location</label>
                <select
                  className="form-input"
                  value={form.clinicLocation}
                  onChange={e => setField('clinicLocation', e.target.value)}
                  style={{ fontSize: 16 }}
                >
                  <option value="">— Select Location —</option>
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.name}>{loc.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Diagnosis</label>
              <input
                type="text"
                className="form-input"
                placeholder="Primary diagnosis or reason for testing"
                value={form.diagnosis}
                onChange={e => setField('diagnosis', e.target.value)}
                style={{ fontSize: 16 }}
              />
            </div>
          </div>

          {/* Section 3 — Insurance & Notes */}
          <div className="card form-section">
            <div className="form-section-title">
              <span className="form-section-number">3</span>
              Insurance &amp; Notes
            </div>

            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">Insurance ID</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Member ID"
                  value={form.insuranceId}
                  onChange={e => setField('insuranceId', e.target.value)}
                  style={{ fontSize: 16 }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Insurance Provider</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. BlueCross BlueShield"
                  value={form.insuranceProvider}
                  onChange={e => setField('insuranceProvider', e.target.value)}
                  style={{ fontSize: 16 }}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                className="form-input"
                placeholder="Any relevant clinical notes or observations…"
                rows={4}
                value={form.notes}
                onChange={e => setField('notes', e.target.value)}
                style={{ resize: 'vertical', minHeight: 100, fontSize: 16 }}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3" style={{ justifyContent: 'flex-end' }}>
            <Link href="/patients" className="btn btn-secondary">Cancel</Link>
            <button type="submit" className="btn" disabled={saving}>
              {saving
                ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Registering…</>
                : '✓ Register Patient'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
