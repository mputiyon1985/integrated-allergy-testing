'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Doctor { id: string; name: string; }
interface Location { id: string; name: string; }

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
];

export default function NewPatientPage() {
  const router = useRouter();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    honorific: '',
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    email: '',
    cellPhone: '',
    homePhone: '',
    // Address
    street: '',
    city: '',
    state: '',
    zip: '',
    // Emergency
    emergencyName: '',
    emergencyPhone: '',
    emergencyEmail: '',
    emergencyRelationship: '',
    // Insurance
    insuranceProvider: '',
    insuranceId: '',
    groupNumber: '',
    // Clinical
    doctorId: '',
    locationId: '',
    notes: '',
  });

  useEffect(() => {
    fetch('/api/doctors').then(r => r.ok ? r.json() : []).then(d => {
      setDoctors(Array.isArray(d) ? d : (d.doctors ?? []));
    }).catch(() => {});

    fetch('/api/locations').then(r => r.ok ? r.json() : []).then(d => {
      setLocations(Array.isArray(d) ? d : (d.locations ?? []));
    }).catch(() => {});
  }, []);

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.firstName.trim()) { setError('First name is required'); return; }
    if (!form.lastName.trim()) { setError('Last name is required'); return; }
    if (!form.dateOfBirth) { setError('Date of birth is required'); return; }

    setSaving(true);
    try {
      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          honorific: form.honorific || undefined,
          firstName: form.firstName,
          lastName: form.lastName,
          dateOfBirth: form.dateOfBirth,
          email: form.email || undefined,
          cellPhone: form.cellPhone || undefined,
          homePhone: form.homePhone || undefined,
          address: {
            street: form.street || undefined,
            city: form.city || undefined,
            state: form.state || undefined,
            zip: form.zip || undefined,
          },
          emergencyContact: {
            name: form.emergencyName || undefined,
            phone: form.emergencyPhone || undefined,
            email: form.emergencyEmail || undefined,
            relationship: form.emergencyRelationship || undefined,
          },
          insurance: {
            provider: form.insuranceProvider || undefined,
            insuranceId: form.insuranceId || undefined,
            groupNumber: form.groupNumber || undefined,
          },
          doctorId: form.doctorId || undefined,
          locationId: form.locationId || undefined,
          notes: form.notes || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? `Request failed: ${res.status}`);
      }

      const created = await res.json();
      const id = created.id ?? created.patientId;
      router.push(`/patients/${id}`);
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
        <Link href="/patients" className="btn-secondary btn">← Back to Patients</Link>
      </div>

      <div className="page-body">
        {error && <div className="alert alert-error">⚠️ {error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Section 1 — Personal Info */}
          <div className="card form-section">
            <div className="form-section-title">
              <span className="form-section-number">1</span>
              Personal Information
            </div>
            <div className="form-row form-row-4" style={{ gridTemplateColumns: '160px 1fr 1fr 180px' }}>
              <div className="form-group">
                <label className="form-label">Honorific</label>
                <select className="form-input" value={form.honorific} onChange={e => set('honorific', e.target.value)}>
                  <option value="">Select…</option>
                  {['Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Prof'].map(h => (
                    <option key={h} value={h}>{h}.</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">First Name <span className="required">*</span></label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="First name"
                  value={form.firstName}
                  onChange={e => set('firstName', e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Last Name <span className="required">*</span></label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Last name"
                  value={form.lastName}
                  onChange={e => set('lastName', e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Date of Birth <span className="required">*</span></label>
                <input
                  type="date"
                  className="form-input"
                  value={form.dateOfBirth}
                  onChange={e => set('dateOfBirth', e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="form-row form-row-3">
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" className="form-input" placeholder="email@example.com" value={form.email} onChange={e => set('email', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Cell Phone</label>
                <input type="tel" className="form-input" placeholder="(555) 555-0100" value={form.cellPhone} onChange={e => set('cellPhone', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Home Phone</label>
                <input type="tel" className="form-input" placeholder="(555) 555-0100" value={form.homePhone} onChange={e => set('homePhone', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Section 2 — Address */}
          <div className="card form-section">
            <div className="form-section-title">
              <span className="form-section-number">2</span>
              Address
            </div>
            <div className="form-group">
              <label className="form-label">Street Address</label>
              <input type="text" className="form-input" placeholder="123 Main Street" value={form.street} onChange={e => set('street', e.target.value)} />
            </div>
            <div className="form-row form-row-3">
              <div className="form-group">
                <label className="form-label">City</label>
                <input type="text" className="form-input" placeholder="City" value={form.city} onChange={e => set('city', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">State</label>
                <select className="form-input" value={form.state} onChange={e => set('state', e.target.value)}>
                  <option value="">Select state…</option>
                  {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">ZIP Code</label>
                <input type="text" className="form-input" placeholder="12345" value={form.zip} onChange={e => set('zip', e.target.value)} maxLength={10} />
              </div>
            </div>
          </div>

          {/* Section 3 — Emergency Contact */}
          <div className="card form-section">
            <div className="form-section-title">
              <span className="form-section-number">3</span>
              Emergency Contact
            </div>
            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">Contact Name</label>
                <input type="text" className="form-input" placeholder="Full name" value={form.emergencyName} onChange={e => set('emergencyName', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input type="tel" className="form-input" placeholder="(555) 555-0100" value={form.emergencyPhone} onChange={e => set('emergencyPhone', e.target.value)} />
              </div>
            </div>
            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" className="form-input" placeholder="email@example.com" value={form.emergencyEmail} onChange={e => set('emergencyEmail', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Relationship</label>
                <select className="form-input" value={form.emergencyRelationship} onChange={e => set('emergencyRelationship', e.target.value)}>
                  <option value="">Select…</option>
                  {['Spouse', 'Parent', 'Child', 'Sibling', 'Friend', 'Guardian', 'Other'].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Section 4 — Insurance */}
          <div className="card form-section">
            <div className="form-section-title">
              <span className="form-section-number">4</span>
              Insurance Information
            </div>
            <div className="form-row form-row-3">
              <div className="form-group">
                <label className="form-label">Insurance Provider</label>
                <input type="text" className="form-input" placeholder="e.g. BlueCross BlueShield" value={form.insuranceProvider} onChange={e => set('insuranceProvider', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Insurance ID</label>
                <input type="text" className="form-input" placeholder="Member ID" value={form.insuranceId} onChange={e => set('insuranceId', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Group Number</label>
                <input type="text" className="form-input" placeholder="Group / Plan #" value={form.groupNumber} onChange={e => set('groupNumber', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Section 5 — Clinical */}
          <div className="card form-section">
            <div className="form-section-title">
              <span className="form-section-number">5</span>
              Clinical Information
            </div>
            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">Assigned Doctor</label>
                <select className="form-input" value={form.doctorId} onChange={e => set('doctorId', e.target.value)}>
                  <option value="">Select doctor…</option>
                  {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Location / Clinic</label>
                <select className="form-input" value={form.locationId} onChange={e => set('locationId', e.target.value)}>
                  <option value="">Select location…</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Clinical Notes</label>
              <textarea
                className="form-input"
                placeholder="Any relevant clinical notes, allergies, or observations…"
                rows={4}
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                style={{ resize: 'vertical', minHeight: 100 }}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3" style={{ justifyContent: 'flex-end' }}>
            <Link href="/patients" className="btn-secondary btn">Cancel</Link>
            <button type="submit" className="btn" disabled={saving}>
              {saving ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Registering…</> : '✓ Register Patient'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
