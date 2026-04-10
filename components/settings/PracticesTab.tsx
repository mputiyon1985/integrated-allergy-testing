'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Practice {
  id: string; name: string; key: string | null; shortName: string | null;
  npi: string | null; taxId: string | null; phone: string | null;
  fax: string | null; email: string | null; website: string | null; active: boolean;
}
interface Location {
  id: string; name: string; key: string; city: string; state: string; active: boolean; practiceId?: string | null;
}
interface InsuranceCompany {
  id: string; name: string; type: string; payerId: string | null; active: boolean; sortOrder: number;
}
interface PracticeInsurance {
  id: string; practiceId: string; insuranceId: string;
  insurance: { id: string; name: string; type: string; payerId: string | null; };
}
interface DayHours {
  dayOfWeek: number; isOpen: boolean; openTime: string; closeTime: string;
  lunchStart: string; lunchEnd: string; notes: string;
}

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DAY_SHORT  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const DEFAULT_HOURS: DayHours[] = DAY_NAMES.map((_, i) => ({
  dayOfWeek: i,
  isOpen: i >= 1 && i <= 5,
  openTime: '08:00', closeTime: '17:00',
  lunchStart: '12:00', lunchEnd: '13:00',
  notes: '',
}));

const EMPTY_FORM = { name:'', key:'', shortName:'', npi:'', taxId:'', phone:'', fax:'', email:'', website:'' };
type FormData = typeof EMPTY_FORM;
type ModalTab = 'info' | 'insurance' | 'hours';

const TYPE_BADGE_COLORS: Record<string,string> = {
  medicare:'#1d4ed8', medicaid:'#7c3aed', bcbs:'#0369a1', aetna:'#b91c1c',
  united:'#065f46', cigna:'#92400e', tricare:'#1e3a5f', commercial:'#374151',
};

function TypeBadge({ type }: { type: string }) {
  const color = TYPE_BADGE_COLORS[type] ?? '#374151';
  return (
    <span style={{ display:'inline-block', padding:'1px 7px', borderRadius:4, fontSize:10, fontWeight:600,
      textTransform:'uppercase', letterSpacing:'0.05em', background:color+'22', color, border:`1px solid ${color}44` }}>
      {type}
    </span>
  );
}

function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const times: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      times.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
    }
  }
  function fmt(t: string) {
    const [hh, mm] = t.split(':').map(Number);
    const ampm = hh >= 12 ? 'PM' : 'AM';
    const h12 = hh % 12 || 12;
    return `${h12}:${String(mm).padStart(2,'0')} ${ampm}`;
  }
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ padding:'6px 10px', borderRadius:6, border:'1px solid #d1d5db', fontSize:13, background:'#fff', cursor:'pointer' }}>
      {times.map(t => <option key={t} value={t}>{fmt(t)}</option>)}
    </select>
  );
}

export default function PracticesTab() {
  const [practices, setPractices] = useState<Practice[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editPractice, setEditPractice] = useState<Practice | null>(null);
  const [activeTab, setActiveTab] = useState<ModalTab>('info');
  const [form, setForm] = useState<FormData>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Insurance tab
  const [allInsurers, setAllInsurers] = useState<InsuranceCompany[]>([]);
  const [practiceInsurances, setPracticeInsurances] = useState<PracticeInsurance[]>([]);
  const [insurersLoading, setInsurersLoading] = useState(false);
  const [insurerToggling, setInsurerToggling] = useState<string | null>(null);

  // Hours tab
  const [hours, setHours] = useState<DayHours[]>(DEFAULT_HOURS.map(h => ({ ...h })));
  const [hoursLoading, setHoursLoading] = useState(false);
  const [hoursSaving, setHoursSaving] = useState(false);
  const [hoursSuccess, setHoursSuccess] = useState(false);

  async function loadData() {
    setLoading(true); setLoadError(null);
    try {
      const [pRes, lRes] = await Promise.all([fetch('/api/practices'), fetch('/api/locations?all=1')]);
      if (!pRes.ok) throw new Error(pRes.status === 401 ? 'session_expired' : `HTTP ${pRes.status}`);
      if (!lRes.ok) throw new Error(lRes.status === 401 ? 'session_expired' : `HTTP ${lRes.status}`);
      const pData = await pRes.json();
      const lData = await lRes.json();
      setPractices(pData?.practices ?? (Array.isArray(pData) ? pData : []));
      setLocations(Array.isArray(lData) ? lData : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load';
      setLoadError(msg === 'session_expired' ? 'Session expired — please refresh.' : `Failed to load: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  async function loadInsurers(practiceId: string) {
    setInsurersLoading(true);
    try {
      const [aRes, pRes] = await Promise.all([
        fetch('/api/insurance-companies?all=true'),
        fetch(`/api/practices/${practiceId}/insurances`),
      ]);
      const aData = await aRes.json() as { companies?: InsuranceCompany[] };
      const pData = await pRes.json() as { insurances?: PracticeInsurance[] };
      setAllInsurers(aData.companies ?? []);
      setPracticeInsurances(pData.insurances ?? []);
    } catch { /* non-fatal */ }
    finally { setInsurersLoading(false); }
  }

  async function loadHours(practiceId: string) {
    setHoursLoading(true);
    try {
      const res = await fetch(`/api/practices/${practiceId}/hours`);
      if (res.ok) {
        const data = await res.json() as { hours: Array<{
          dayOfWeek: number; isOpen: number | boolean; openTime: string; closeTime: string;
          lunchStart: string | null; lunchEnd: string | null; notes: string | null;
        }> };
        const mapped = (data.hours ?? []).map(h => ({
          dayOfWeek: Number(h.dayOfWeek),
          isOpen: Boolean(h.isOpen === 1 || h.isOpen === true),
          openTime: h.openTime ?? '08:00',
          closeTime: h.closeTime ?? '17:00',
          lunchStart: h.lunchStart ?? '12:00',
          lunchEnd: h.lunchEnd ?? '13:00',
          notes: h.notes ?? '',
        }));
        // Fill missing days with defaults
        const full = DEFAULT_HOURS.map(def => mapped.find(m => m.dayOfWeek === def.dayOfWeek) ?? { ...def });
        setHours(full);
      }
    } catch { /* non-fatal */ }
    finally { setHoursLoading(false); }
  }

  useEffect(() => { void loadData(); }, []);

  function openAdd() {
    setEditPractice(null); setForm({ ...EMPTY_FORM }); setFormError('');
    setAllInsurers([]); setPracticeInsurances([]);
    setHours(DEFAULT_HOURS.map(h => ({ ...h })));
    setActiveTab('info'); setShowModal(true);
  }

  function openEdit(p: Practice) {
    setEditPractice(p);
    setForm({ name:p.name??'', key:p.key??'', shortName:p.shortName??'', npi:p.npi??'',
      taxId:p.taxId??'', phone:p.phone??'', fax:p.fax??'', email:p.email??'', website:p.website??'' });
    setFormError(''); setActiveTab('info'); setShowModal(true);
    void loadInsurers(p.id);
    void loadHours(p.id);
  }

  function closeModal() {
    setShowModal(false); setEditPractice(null); setFormError('');
    setAllInsurers([]); setPracticeInsurances([]);
    setHoursSuccess(false);
  }

  function generateKey(name: string) {
    const initials = name.trim().toUpperCase().replace(/[^A-Z0-9\s]/g,'')
      .split(/\s+/).filter(Boolean).map(w => w[0]).join('').substring(0,6) || 'PRC';
    let key = initials; let n = 1;
    while (practices.some(p => p.key === key && p.id !== editPractice?.id)) key = `${initials}-${n++}`;
    return key;
  }

  function setField(field: keyof FormData, value: string) {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'name' && !editPractice) next.key = generateKey(value);
      return next;
    });
  }

  function updateHour(dayOfWeek: number, updates: Partial<DayHours>) {
    setHours(prev => prev.map(h => h.dayOfWeek === dayOfWeek ? { ...h, ...updates } : h));
  }

  async function saveHours() {
    if (!editPractice) return;
    setHoursSaving(true);
    try {
      const res = await fetch(`/api/practices/${editPractice.id}/hours`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours }),
      });
      if (!res.ok) throw new Error('Failed to save hours');
      setHoursSuccess(true);
      setTimeout(() => setHoursSuccess(false), 3000);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save hours');
    } finally {
      setHoursSaving(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setFormError('');
    if (!form.name.trim()) { setFormError('Practice name is required'); return; }
    setSaving(true);
    try {
      const url = editPractice ? `/api/practices/${editPractice.id}` : '/api/practices';
      const res = await fetch(url, {
        method: editPractice ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(), key: form.key.trim() || undefined,
          shortName: form.shortName.trim() || null, npi: form.npi.trim() || null,
          taxId: form.taxId.trim() || null, phone: form.phone.trim() || null,
          fax: form.fax.trim() || null, email: form.email.trim() || null,
          website: form.website.trim() || null,
        }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})) as { error?: string }; throw new Error(d.error ?? `Request failed: ${res.status}`); }
      closeModal(); await loadData();
    } catch (e) { setFormError(e instanceof Error ? e.message : 'Failed to save'); }
    finally { setSaving(false); }
  }

  async function toggleActive(p: Practice) {
    try {
      const res = await fetch(`/api/practices/${p.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ active: !p.active }) });
      if (!res.ok) throw new Error('Failed');
      await loadData();
    } catch { alert('Failed to update practice status'); }
  }

  async function toggleInsurer(insuranceId: string) {
    if (!editPractice || insurerToggling) return;
    setInsurerToggling(insuranceId);
    const isActive = practiceInsurances.some(pi => pi.insuranceId === insuranceId);
    try {
      if (isActive) {
        await fetch(`/api/practices/${editPractice.id}/insurances/${insuranceId}`, { method:'DELETE' });
        setPracticeInsurances(prev => prev.filter(pi => pi.insuranceId !== insuranceId));
      } else {
        await fetch(`/api/practices/${editPractice.id}/insurances`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ insuranceId }) });
        const r = await fetch(`/api/practices/${editPractice.id}/insurances`);
        const d = await r.json() as { insurances?: PracticeInsurance[] };
        setPracticeInsurances(d.insurances ?? []);
      }
    } catch { alert('Failed to update insurance preference'); }
    finally { setInsurerToggling(null); }
  }

  const locationsForPractice = (pid: string) => locations.filter(l => l.practiceId === pid);

  const TAB_STYLE = (active: boolean): React.CSSProperties => ({
    padding: '9px 18px', borderRadius: '8px 8px 0 0',
    border: '1px solid #e2e8f0', borderBottom: active ? '2px solid #fff' : '1px solid #e2e8f0',
    background: active ? '#fff' : '#f8fafc',
    color: active ? '#0d9488' : '#64748b',
    fontWeight: active ? 700 : 500, fontSize: 13, cursor: 'pointer',
    marginBottom: -1, transition: 'all 0.15s',
  });

  return (
    <>
      {loadError && (
        <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'12px 16px', marginBottom:16, color:'#b91c1c', fontSize:13 }}>
          🔐 {loadError}
          <button onClick={() => { setLoadError(null); void loadData(); }}
            style={{ marginLeft:12, padding:'3px 10px', background:'#b91c1c', color:'#fff', border:'none', borderRadius:6, cursor:'pointer', fontSize:12 }}>Retry</button>
        </div>
      )}

      {loading ? (
        <div className="loading-center"><div className="spinner" /><span>Loading practices…</span></div>
      ) : practices.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🏥</div>
          <div className="empty-state-title">No practices yet</div>
          <div style={{ marginTop:16 }}><button className="btn" onClick={openAdd}>Add First Practice</button></div>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Practice Name</th><th>Short Name</th><th>Type 2 NPI</th>
                <th>Phone</th><th>Email</th><th>Locations</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {practices.map(p => {
                const locs = locationsForPractice(p.id);
                return (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight:600 }}>{p.name}</div>
                      {p.taxId && <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>EIN: {p.taxId}</div>}
                    </td>
                    <td>{p.shortName ?? '—'}</td>
                    <td>{p.npi ? <code style={{ fontSize:12, background:'#f1f5f9', padding:'2px 6px', borderRadius:4 }}>{p.npi}</code> : '—'}</td>
                    <td>{p.phone ?? '—'}</td>
                    <td>{p.email ? <a href={`mailto:${p.email}`} style={{ color:'#0d9488', textDecoration:'none', fontSize:13 }}>{p.email}</a> : '—'}</td>
                    <td>
                      {locs.length === 0 ? <span style={{ color:'#94a3b8', fontSize:12 }}>None</span> : (
                        <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                          {locs.map(loc => (
                            <div key={loc.id} style={{ display:'flex', alignItems:'center', gap:6 }}>
                              <span style={{ display:'inline-block', width:6, height:6, borderRadius:'50%', background:loc.active?'#0d9488':'#94a3b8' }} />
                              <span style={{ fontSize:12 }}>{loc.name}</span>
                              {(loc.city||loc.state) && <span style={{ fontSize:11, color:'#9ca3af' }}>{[loc.city,loc.state].filter(Boolean).join(', ')}</span>}
                            </div>
                          ))}
                          <Link href="/locations" style={{ fontSize:11, color:'#0d9488', textDecoration:'none', marginTop:2 }}>Manage locations →</Link>
                        </div>
                      )}
                    </td>
                    <td><span className={`badge ${p.active ? 'badge-green' : 'badge-gray'}`}>{p.active ? 'Active' : 'Inactive'}</span></td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-sm btn-secondary" onClick={() => openEdit(p)}>Edit</button>
                        <button className={`btn btn-sm ${p.active ? 'btn-danger' : 'btn-secondary'}`} onClick={() => void toggleActive(p)}>
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

      {/* ── Modal ── */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" style={{ maxWidth: 700, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editPractice ? `Edit — ${editPractice.name}` : 'Add Practice'}</h2>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>

            {/* Tab Nav */}
            <div style={{ display:'flex', gap:4, padding:'0 24px', borderBottom:'1px solid #e2e8f0', background:'#f8fafc' }}>
              <button style={TAB_STYLE(activeTab==='info')} onClick={() => setActiveTab('info')}>🏥 Practice Info</button>
              {editPractice && <button style={TAB_STYLE(activeTab==='insurance')} onClick={() => setActiveTab('insurance')}>🏦 Accepted Insurances</button>}
              {editPractice && <button style={TAB_STYLE(activeTab==='hours')} onClick={() => setActiveTab('hours')}>🕐 Hours of Operation</button>}
            </div>

            <div style={{ overflowY:'auto', maxHeight:'calc(90vh - 170px)', padding:'24px' }}>

              {/* ── INFO TAB ── */}
              {activeTab === 'info' && (
                <form id="practice-form" onSubmit={e => void handleSubmit(e)}>
                  {formError && <div className="alert alert-error" style={{ marginBottom:16 }}>⚠️ {formError}</div>}

                  <div className="form-row form-row-2">
                    <div className="form-group" style={{ gridColumn:'1 / -1' }}>
                      <label className="form-label">Practice Name <span className="required">*</span></label>
                      <input type="text" className="form-input" placeholder="e.g. Northern Virginia Allergy Associates"
                        value={form.name} onChange={e => setField('name', e.target.value)} required />
                    </div>
                  </div>
                  <div className="form-row form-row-2">
                    <div className="form-group">
                      <label className="form-label">Practice Key</label>
                      <input type="text" className="form-input" value={form.key} readOnly disabled={!!editPractice}
                        style={{ background:'#f8fafc', color:'#64748b', cursor:editPractice?'not-allowed':'default', fontFamily:'monospace', fontSize:13 }} />
                      {!editPractice && <div style={{ fontSize:11, color:'#94a3b8', marginTop:3 }}>Auto-generated from initials</div>}
                    </div>
                    <div className="form-group">
                      <label className="form-label">Short Name / Abbreviation</label>
                      <input type="text" className="form-input" placeholder="e.g. NVAA" value={form.shortName} onChange={e => setField('shortName', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Type 2 NPI <span style={{ fontSize:11, color:'#94a3b8', fontWeight:400 }}>(Organization)</span></label>
                      <input type="text" className="form-input" placeholder="10-digit NPI" value={form.npi} onChange={e => setField('npi', e.target.value)} />
                    </div>
                  </div>
                  <div className="form-row form-row-2">
                    <div className="form-group">
                      <label className="form-label">Tax ID / EIN</label>
                      <input type="text" className="form-input" placeholder="XX-XXXXXXX" value={form.taxId} onChange={e => setField('taxId', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Phone</label>
                      <input type="text" className="form-input" placeholder="(703) 555-0100" value={form.phone} onChange={e => setField('phone', e.target.value)} />
                    </div>
                  </div>
                  <div className="form-row form-row-2">
                    <div className="form-group">
                      <label className="form-label">Fax</label>
                      <input type="text" className="form-input" placeholder="(703) 555-0101" value={form.fax} onChange={e => setField('fax', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Email</label>
                      <input type="email" className="form-input" placeholder="admin@yourpractice.com" value={form.email} onChange={e => setField('email', e.target.value)} />
                    </div>
                  </div>
                  <div className="form-row form-row-2">
                    <div className="form-group" style={{ gridColumn:'1 / -1' }}>
                      <label className="form-label">Website</label>
                      <input type="text" className="form-input" placeholder="https://yourpractice.com" value={form.website} onChange={e => setField('website', e.target.value)} />
                    </div>
                  </div>
                </form>
              )}

              {/* ── INSURANCE TAB ── */}
              {activeTab === 'insurance' && editPractice && (
                <div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:15, color:'#1e293b' }}>Accepted Insurance Payers</div>
                      <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>
                        {insurersLoading ? 'Loading…' : `${practiceInsurances.length} of ${allInsurers.length} payers accepted`}
                      </div>
                    </div>
                  </div>
                  {insurersLoading ? (
                    <div style={{ display:'flex', alignItems:'center', gap:8, color:'#64748b', fontSize:13, padding:'12px 0' }}>
                      <div className="spinner" style={{ width:16, height:16 }} /> Loading insurers…
                    </div>
                  ) : allInsurers.length === 0 ? (
                    <div style={{ color:'#94a3b8', fontSize:13 }}>No insurance companies configured yet.</div>
                  ) : (
                    <div style={{ border:'1px solid #e2e8f0', borderRadius:8, overflow:'hidden' }}>
                      {allInsurers.map((ins, idx) => {
                        const isChecked = practiceInsurances.some(pi => pi.insuranceId === ins.id);
                        const isToggling = insurerToggling === ins.id;
                        return (
                          <label key={ins.id} style={{
                            display:'flex', alignItems:'center', gap:12, padding:'10px 14px',
                            borderBottom: idx < allInsurers.length-1 ? '1px solid #f1f5f9' : 'none',
                            cursor: isToggling ? 'wait' : 'pointer',
                            background: isChecked ? '#f0fdf4' : '#fff', transition:'background 0.15s',
                          }}>
                            <input type="checkbox" checked={isChecked} disabled={isToggling}
                              onChange={() => void toggleInsurer(ins.id)}
                              style={{ width:16, height:16, accentColor:'#0d9488', cursor:'pointer', flexShrink:0 }} />
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                <span style={{ fontWeight:500, fontSize:13, color:'#1e293b' }}>{ins.name}</span>
                                <TypeBadge type={ins.type} />
                              </div>
                              {ins.payerId && (
                                <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>
                                  Payer ID: <code style={{ fontFamily:'monospace', background:'#f8fafc', padding:'0 4px', borderRadius:3 }}>{ins.payerId}</code>
                                </div>
                              )}
                            </div>
                            {isToggling && <div className="spinner" style={{ width:14, height:14, flexShrink:0 }} />}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── HOURS TAB ── */}
              {activeTab === 'hours' && editPractice && (
                <div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:15, color:'#1e293b' }}>Hours of Operation</div>
                      <div style={{ fontSize:12, color:'#64748b', marginTop:2 }}>Set open/close times and lunch break for each day</div>
                    </div>
                    <button onClick={() => void saveHours()} disabled={hoursSaving}
                      style={{ padding:'8px 18px', borderRadius:8, border:'none',
                        background: hoursSuccess ? '#16a34a' : '#0d9488',
                        color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', transition:'background 0.3s' }}>
                      {hoursSaving ? 'Saving…' : hoursSuccess ? '✅ Saved!' : '💾 Save Hours'}
                    </button>
                  </div>

                  {hoursLoading ? (
                    <div style={{ display:'flex', alignItems:'center', gap:8, color:'#64748b', fontSize:13 }}>
                      <div className="spinner" style={{ width:16, height:16 }} /> Loading hours…
                    </div>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:0, border:'1px solid #e2e8f0', borderRadius:10, overflow:'hidden' }}>
                      {/* Header */}
                      <div style={{ display:'grid', gridTemplateColumns:'90px 80px 1fr', gap:0,
                        background:'#f1f5f9', padding:'8px 16px', borderBottom:'1px solid #e2e8f0' }}>
                        <div style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase' }}>Day</div>
                        <div style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase' }}>Open</div>
                        <div style={{ fontSize:11, fontWeight:700, color:'#64748b', textTransform:'uppercase' }}>Schedule</div>
                      </div>

                      {hours.map((h, idx) => (
                        <div key={h.dayOfWeek} style={{
                          display:'grid', gridTemplateColumns:'90px 80px 1fr',
                          alignItems:'start', gap:0, padding:'12px 16px',
                          borderBottom: idx < 6 ? '1px solid #f1f5f9' : 'none',
                          background: h.isOpen ? '#fff' : '#fafafa',
                          transition:'background 0.15s',
                        }}>
                          {/* Day name */}
                          <div style={{ display:'flex', alignItems:'center', paddingTop:6 }}>
                            <span style={{ fontWeight:700, fontSize:13, color: h.isOpen ? '#1e293b' : '#94a3b8' }}>
                              {DAY_SHORT[h.dayOfWeek]}
                            </span>
                          </div>

                          {/* Toggle */}
                          <div style={{ paddingTop:4 }}>
                            <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}>
                              <div onClick={() => updateHour(h.dayOfWeek, { isOpen: !h.isOpen })} style={{
                                width:40, height:22, borderRadius:11,
                                background: h.isOpen ? '#0d9488' : '#d1d5db',
                                position:'relative', cursor:'pointer', transition:'background 0.2s',
                                flexShrink:0,
                              }}>
                                <div style={{
                                  position:'absolute', top:3, left: h.isOpen ? 21 : 3,
                                  width:16, height:16, borderRadius:'50%', background:'#fff',
                                  transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)',
                                }} />
                              </div>
                              <span style={{ fontSize:12, color: h.isOpen ? '#0d9488' : '#94a3b8', fontWeight:600 }}>
                                {h.isOpen ? 'Open' : 'Closed'}
                              </span>
                            </label>
                          </div>

                          {/* Times */}
                          {h.isOpen ? (
                            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                              {/* Open / Close */}
                              <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                  <span style={{ fontSize:12, color:'#64748b', minWidth:36 }}>Open</span>
                                  <TimeSelect value={h.openTime} onChange={v => updateHour(h.dayOfWeek, { openTime: v })} />
                                </div>
                                <span style={{ color:'#94a3b8', fontSize:13 }}>→</span>
                                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                  <span style={{ fontSize:12, color:'#64748b', minWidth:36 }}>Close</span>
                                  <TimeSelect value={h.closeTime} onChange={v => updateHour(h.dayOfWeek, { closeTime: v })} />
                                </div>
                              </div>

                              {/* Lunch break */}
                              <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                                <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}>
                                  <input type="checkbox"
                                    checked={!!h.lunchStart && !!h.lunchEnd}
                                    onChange={e => updateHour(h.dayOfWeek, e.target.checked
                                      ? { lunchStart:'12:00', lunchEnd:'13:00' }
                                      : { lunchStart:'', lunchEnd:'' })}
                                    style={{ accentColor:'#f59e0b', width:14, height:14 }} />
                                  <span style={{ fontSize:12, color:'#92400e', fontWeight:600 }}>🍽 Lunch break</span>
                                </label>
                                {h.lunchStart && h.lunchEnd && (
                                  <>
                                    <TimeSelect value={h.lunchStart} onChange={v => updateHour(h.dayOfWeek, { lunchStart: v })} />
                                    <span style={{ color:'#94a3b8', fontSize:13 }}>→</span>
                                    <TimeSelect value={h.lunchEnd} onChange={v => updateHour(h.dayOfWeek, { lunchEnd: v })} />
                                  </>
                                )}
                              </div>

                              {/* Notes */}
                              <input type="text" placeholder="Notes (optional, e.g. 'By appointment only')"
                                value={h.notes} onChange={e => updateHour(h.dayOfWeek, { notes: e.target.value })}
                                style={{ padding:'5px 10px', borderRadius:6, border:'1px solid #e2e8f0',
                                  fontSize:12, color:'#374151', background:'#f8fafc', width:'100%', boxSizing:'border-box' }} />
                            </div>
                          ) : (
                            <div style={{ display:'flex', alignItems:'center', height:32 }}>
                              <span style={{ fontSize:12, color:'#94a3b8', fontStyle:'italic' }}>Closed all day</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
              {activeTab === 'info' && (
                <button type="submit" form="practice-form" className="btn" disabled={saving}>
                  {saving ? 'Saving…' : editPractice ? 'Save Changes' : 'Add Practice'}
                </button>
              )}
              {activeTab === 'hours' && (
                <button onClick={() => void saveHours()} disabled={hoursSaving} className="btn">
                  {hoursSaving ? 'Saving…' : hoursSuccess ? '✅ Saved!' : '💾 Save Hours'}
                </button>
              )}
              {activeTab === 'insurance' && (
                <span style={{ fontSize:12, color:'#64748b', fontStyle:'italic' }}>Changes save automatically</span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
