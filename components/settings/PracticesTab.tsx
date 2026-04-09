'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Practice {
  id: string;
  name: string;
  key: string | null;
  shortName: string | null;
  npi: string | null;
  taxId: string | null;
  phone: string | null;
  fax: string | null;
  email: string | null;
  website: string | null;
  active: boolean;
}

interface Location {
  id: string;
  name: string;
  key: string;
  city: string;
  state: string;
  active: boolean;
  practiceId?: string | null;
}

interface InsuranceCompany {
  id: string;
  name: string;
  type: string;
  payerId: string | null;
  active: boolean;
  sortOrder: number;
}

interface PracticeInsurance {
  id: string;
  practiceId: string;
  insuranceId: string;
  insurance: {
    id: string;
    name: string;
    type: string;
    payerId: string | null;
  };
}

const EMPTY_FORM = {
  name: '',
  key: '',
  shortName: '',
  npi: '',
  taxId: '',
  phone: '',
  fax: '',
  email: '',
  website: '',
};

type FormData = typeof EMPTY_FORM;

const TYPE_BADGE_COLORS: Record<string, string> = {
  medicare: '#1d4ed8',
  medicaid: '#7c3aed',
  bcbs: '#0369a1',
  aetna: '#b91c1c',
  united: '#065f46',
  cigna: '#92400e',
  tricare: '#1e3a5f',
  commercial: '#374151',
};

function TypeBadge({ type }: { type: string }) {
  const color = TYPE_BADGE_COLORS[type] ?? '#374151';
  return (
    <span style={{
      display: 'inline-block',
      padding: '1px 7px',
      borderRadius: 4,
      fontSize: 10,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      background: color + '22',
      color,
      border: `1px solid ${color}44`,
    }}>
      {type}
    </span>
  );
}

export default function PracticesTab() {
  const [practices, setPractices] = useState<Practice[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editPractice, setEditPractice] = useState<Practice | null>(null);
  const [form, setForm] = useState<FormData>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Insurance payer management state
  const [allInsurers, setAllInsurers] = useState<InsuranceCompany[]>([]);
  const [practiceInsurances, setPracticeInsurances] = useState<PracticeInsurance[]>([]);
  const [insurersLoading, setInsurersLoading] = useState(false);
  const [insurerToggling, setInsurerToggling] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setLoadError(null);
    try {
      const [practicesRes, locationsRes] = await Promise.all([
        fetch('/api/practices'),
        fetch('/api/locations?all=1'),
      ]);

      if (!practicesRes.ok) throw new Error(practicesRes.status === 401 ? 'session_expired' : `HTTP ${practicesRes.status}`);
      if (!locationsRes.ok) throw new Error(locationsRes.status === 401 ? 'session_expired' : `HTTP ${locationsRes.status}`);

      const practicesData = await practicesRes.json();
      const locationsData = await locationsRes.json();

      setPractices(practicesData?.practices ?? (Array.isArray(practicesData) ? practicesData : []));
      setLocations(Array.isArray(locationsData) ? locationsData : []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load';
      if (msg === 'session_expired') setLoadError('Session expired — please refresh and log in again.');
      else setLoadError(`Failed to load practices: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  async function loadInsurers(practiceId: string) {
    setInsurersLoading(true);
    try {
      const [allRes, practiceRes] = await Promise.all([
        fetch('/api/insurance-companies?all=true'),
        fetch(`/api/practices/${practiceId}/insurances`),
      ]);
      const allData = await allRes.json() as { companies?: InsuranceCompany[] };
      const practiceData = await practiceRes.json() as { insurances?: PracticeInsurance[] };
      setAllInsurers(allData.companies ?? []);
      setPracticeInsurances(practiceData.insurances ?? []);
    } catch {
      // Non-fatal — insurers section will just be empty
    } finally {
      setInsurersLoading(false);
    }
  }

  useEffect(() => { void loadData(); }, []);

  function openAdd() {
    setEditPractice(null);
    setForm({ ...EMPTY_FORM });
    setFormError('');
    setAllInsurers([]);
    setPracticeInsurances([]);
    setShowModal(true);
  }

  function openEdit(p: Practice) {
    setEditPractice(p);
    setForm({
      name: p.name ?? '',
      key: p.key ?? '',
      shortName: p.shortName ?? '',
      npi: p.npi ?? '',
      taxId: p.taxId ?? '',
      phone: p.phone ?? '',
      fax: p.fax ?? '',
      email: p.email ?? '',
      website: p.website ?? '',
    });
    setFormError('');
    setShowModal(true);
    void loadInsurers(p.id);
  }

  function closeModal() {
    setShowModal(false);
    setEditPractice(null);
    setFormError('');
    setAllInsurers([]);
    setPracticeInsurances([]);
  }

  function generatePracticeKey(name: string, existing: Practice[]): string {
    const initials = name.trim().toUpperCase()
      .replace(/[^A-Z0-9\s]/g, '')
      .split(/\s+/).filter(Boolean)
      .map(w => w[0]).join('').substring(0, 6) || 'PRC';
    let key = initials;
    let n = 1;
    while (existing.some(p => p.key === key && p.id !== editPractice?.id)) {
      key = `${initials}-${n++}`;
    }
    return key;
  }

  function setField(field: keyof FormData, value: string) {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'name' && !editPractice) {
        next.key = generatePracticeKey(value, practices);
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim()) { setFormError('Practice name is required'); return; }

    setSaving(true);
    try {
      const url = editPractice ? `/api/practices/${editPractice.id}` : '/api/practices';
      const method = editPractice ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          key: form.key.trim() || undefined,
          shortName: form.shortName.trim() || null,
          npi: form.npi.trim() || null,
          taxId: form.taxId.trim() || null,
          phone: form.phone.trim() || null,
          fax: form.fax.trim() || null,
          email: form.email.trim() || null,
          website: form.website.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? `Request failed: ${res.status}`);
      }
      closeModal();
      await loadData();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p: Practice) {
    try {
      const res = await fetch(`/api/practices/${p.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !p.active }),
      });
      if (!res.ok) throw new Error('Failed to update');
      await loadData();
    } catch {
      alert('Failed to update practice status');
    }
  }

  async function toggleInsurer(insuranceId: string) {
    if (!editPractice || insurerToggling) return;
    setInsurerToggling(insuranceId);

    const isActive = practiceInsurances.some(pi => pi.insuranceId === insuranceId);

    try {
      if (isActive) {
        const res = await fetch(`/api/practices/${editPractice.id}/insurances/${insuranceId}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error('Failed to remove');
        setPracticeInsurances(prev => prev.filter(pi => pi.insuranceId !== insuranceId));
      } else {
        const res = await fetch(`/api/practices/${editPractice.id}/insurances`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ insuranceId }),
        });
        if (!res.ok) throw new Error('Failed to add');
        // Reload to get full data
        const practiceRes = await fetch(`/api/practices/${editPractice.id}/insurances`);
        const practiceData = await practiceRes.json() as { insurances?: PracticeInsurance[] };
        setPracticeInsurances(practiceData.insurances ?? []);
      }
    } catch {
      alert('Failed to update insurance preference');
    } finally {
      setInsurerToggling(null);
    }
  }

  const locationsForPractice = (practiceId: string) =>
    locations.filter(l => l.practiceId === practiceId);

  return (
    <>
        {loadError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#b91c1c', fontSize: 13 }}>
            🔐 {loadError}
            <button
              onClick={() => { setLoadError(null); void loadData(); }}
              style={{ marginLeft: 12, padding: '3px 10px', background: '#b91c1c', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="loading-center"><div className="spinner" /><span>Loading practices…</span></div>
        ) : practices.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🏥</div>
            <div className="empty-state-title">No practices yet</div>
            <div style={{ marginTop: 16 }}>
              <button className="btn" onClick={openAdd}>Add First Practice</button>
            </div>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Practice Name</th>
                  <th>Short Name</th>
                  <th>Type 2 NPI</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Locations</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {practices.map((p) => {
                  const practiceLocations = locationsForPractice(p.id);
                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{p.name}</div>
                        {p.taxId && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>EIN: {p.taxId}</div>}
                      </td>
                      <td>{p.shortName ?? '—'}</td>
                      <td>
                        {p.npi ? (
                          <code style={{ fontSize: 12, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>{p.npi}</code>
                        ) : '—'}
                      </td>
                      <td>{p.phone ?? '—'}</td>
                      <td>
                        {p.email ? (
                          <a href={`mailto:${p.email}`} style={{ color: '#0d9488', textDecoration: 'none', fontSize: 13 }}>{p.email}</a>
                        ) : '—'}
                      </td>
                      <td>
                        {practiceLocations.length === 0 ? (
                          <span style={{ color: '#94a3b8', fontSize: 12 }}>None</span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {practiceLocations.map(loc => (
                              <div key={loc.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{
                                  display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                                  background: loc.active ? '#0d9488' : '#94a3b8',
                                }} />
                                <span style={{ fontSize: 12 }}>{loc.name}</span>
                                {(loc.city || loc.state) && (
                                  <span style={{ fontSize: 11, color: '#9ca3af' }}>{[loc.city, loc.state].filter(Boolean).join(', ')}</span>
                                )}
                              </div>
                            ))}
                            <Link href="/locations" style={{ fontSize: 11, color: '#0d9488', textDecoration: 'none', marginTop: 2 }}>
                              Manage locations →
                            </Link>
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${p.active ? 'badge-green' : 'badge-gray'}`}>
                          {p.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button className="btn btn-sm btn-secondary" onClick={() => openEdit(p)}>Edit</button>
                          <button
                            className={`btn btn-sm ${p.active ? 'btn-danger' : 'btn-secondary'}`}
                            onClick={() => void toggleActive(p)}
                          >
                            {p.active ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      {/* Add / Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editPractice ? 'Edit Practice' : 'Add Practice'}</h2>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <form onSubmit={e => void handleSubmit(e)}>
              <div className="modal-body" style={{ overflowY: 'auto', maxHeight: 'calc(90vh - 130px)' }}>
                {formError && (
                  <div className="alert alert-error" style={{ marginBottom: 16 }}>⚠️ {formError}</div>
                )}

                {/* Name row */}
                <div className="form-row form-row-2">
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Practice Name <span className="required">*</span></label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Northern Virginia Allergy Associates"
                      value={form.name}
                      onChange={e => setField('name', e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Practice Key</label>
                    <input
                      type="text"
                      className="form-input"
                      value={form.key}
                      readOnly
                      disabled={!!editPractice}
                      style={{ background: '#f8fafc', color: '#64748b', cursor: editPractice ? 'not-allowed' : 'default', fontFamily: 'monospace', fontSize: 13 }}
                      title={editPractice ? 'Key cannot be changed after creation' : 'Auto-generated from name initials'}
                    />
                    {!editPractice && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>Auto-generated from initials (e.g. IAT, MAP)</div>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Short Name / Abbreviation</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. NVAA"
                      value={form.shortName}
                      onChange={e => setField('shortName', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Type 2 NPI <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>(Organization)</span></label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="10-digit organization NPI"
                      value={form.npi}
                      onChange={e => setField('npi', e.target.value)}
                    />
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>Used on claims for the practice as a whole</div>
                  </div>
                </div>

                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Tax ID / EIN</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="XX-XXXXXXX"
                      value={form.taxId}
                      onChange={e => setField('taxId', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="(703) 555-0100"
                      value={form.phone}
                      onChange={e => setField('phone', e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Fax</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="(703) 555-0101"
                      value={form.fax}
                      onChange={e => setField('fax', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="admin@yourpractice.com"
                      value={form.email}
                      onChange={e => setField('email', e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-row form-row-2">
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Website</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="https://yourpractice.com"
                      value={form.website}
                      onChange={e => setField('website', e.target.value)}
                    />
                  </div>
                </div>

                {/* ── Accepted Insurances (edit mode only) ───────────── */}
                {editPractice && (
                  <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>Accepted Insurance Payers</div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                          {insurersLoading ? 'Loading…' : `${practiceInsurances.length} of ${allInsurers.length} payers accepted`}
                        </div>
                      </div>
                    </div>

                    {insurersLoading ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', fontSize: 13, padding: '12px 0' }}>
                        <div className="spinner" style={{ width: 16, height: 16 }} />
                        Loading insurers…
                      </div>
                    ) : allInsurers.length === 0 ? (
                      <div style={{ color: '#94a3b8', fontSize: 13, padding: '8px 0' }}>No insurance companies configured yet.</div>
                    ) : (
                      <div style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: 8,
                        overflow: 'hidden',
                        maxHeight: 320,
                        overflowY: 'auto',
                      }}>
                        {allInsurers.map((ins, idx) => {
                          const isChecked = practiceInsurances.some(pi => pi.insuranceId === ins.id);
                          const isToggling = insurerToggling === ins.id;
                          return (
                            <label
                              key={ins.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                padding: '10px 14px',
                                borderBottom: idx < allInsurers.length - 1 ? '1px solid #f1f5f9' : 'none',
                                cursor: isToggling ? 'wait' : 'pointer',
                                background: isChecked ? '#f0fdf4' : '#fff',
                                transition: 'background 0.15s',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                disabled={isToggling}
                                onChange={() => void toggleInsurer(ins.id)}
                                style={{ width: 16, height: 16, accentColor: '#0d9488', cursor: 'pointer', flexShrink: 0 }}
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontWeight: 500, fontSize: 13, color: '#1e293b' }}>{ins.name}</span>
                                  <TypeBadge type={ins.type} />
                                </div>
                                {ins.payerId && (
                                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                                    Payer ID: <code style={{ fontFamily: 'monospace', background: '#f8fafc', padding: '0 4px', borderRadius: 3 }}>{ins.payerId}</code>
                                  </div>
                                )}
                              </div>
                              {isToggling && (
                                <div className="spinner" style={{ width: 14, height: 14, flexShrink: 0 }} />
                              )}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn" disabled={saving}>
                  {saving ? 'Saving…' : editPractice ? 'Save Changes' : 'Add Practice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
