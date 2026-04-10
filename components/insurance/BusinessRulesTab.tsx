'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BillingRule, InsuranceCompany,
  RULE_TYPE_ICONS, RULE_TYPES,
  INSURANCE_FILTER_TABS, SEVERITY_FILTER_TABS,
  EMPTY_RULE,
} from './types';
import { InsuranceBadge, SeverityBadge, CptBadge } from './shared';

export function BusinessRulesTab() {
  const [rules, setRules] = useState<BillingRule[]>([]);
  const [companies, setCompanies] = useState<InsuranceCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [search, setSearch] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [view, setView] = useState<'table' | 'cards'>('table');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<BillingRule | null>(null);
  const [form, setForm] = useState<Partial<BillingRule>>(EMPTY_RULE);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    Promise.allSettled([
      fetch('/api/billing-rules?all=true').then(async r => {
        const data = await r.json();
        if (r.status === 401) throw new Error('session_expired');
        if (!r.ok) throw new Error(data?.error ?? `HTTP ${r.status}`);
        if (!Array.isArray(data.rules)) throw new Error('unexpected response format');
        return data;
      }),
      fetch('/api/insurance-companies').then(async r => {
        if (!r.ok) return { companies: [] };
        return r.json();
      }),
    ]).then(([rd, cd]) => {
      if (rd.status === 'rejected') {
        const msg = (rd.reason as Error)?.message ?? 'unknown error';
        if (msg === 'session_expired') {
          setLoadError('Your session has expired. Please refresh the page and log in again.');
        } else {
          setLoadError(`Failed to load billing rules: ${msg}`);
        }
        setRules([]);
      } else {
        setRules(rd.value.rules ?? []);
      }
      if (cd.status === 'fulfilled') setCompanies(cd.value.companies ?? []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = rules.filter(r => {
    if (filterType && r.insuranceType !== filterType) return false;
    if (filterSeverity && r.severity !== filterSeverity) return false;
    if (activeOnly && !r.active) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.name.toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q) ||
        (r.cptCode ?? '').toLowerCase().includes(q) ||
        r.warningMessage.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const grouped = filtered.reduce<Record<string, BillingRule[]>>((acc, r) => {
    const key = r.insuranceType;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  function toggleGroup(key: string) {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function openAdd() {
    setEditingRule(null);
    setForm({ ...EMPTY_RULE });
    setModalOpen(true);
  }

  function openEdit(rule: BillingRule) {
    setEditingRule(rule);
    setForm({ ...rule });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name || !form.ruleType || !form.warningMessage) return;
    setSaving(true);
    try {
      const url = editingRule ? `/api/billing-rules/${editingRule.id}` : '/api/billing-rules';
      const method = editingRule ? 'PUT' : 'POST';
      await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      setModalOpen(false);
      load();
    } catch { /* ignore */ } finally { setSaving(false); }
  }

  async function handleToggleActive(rule: BillingRule) {
    await fetch(`/api/billing-rules/${rule.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !rule.active }),
    });
    load();
  }

  async function handleDelete(rule: BillingRule) {
    if (!confirm(`Deactivate rule "${rule.name}"?`)) return;
    await fetch(`/api/billing-rules/${rule.id}`, { method: 'DELETE' });
    load();
  }

  function exportCsv() {
    const header = ['Name', 'Insurance Type', 'CPT Code', 'Rule Type', 'Severity', 'Warning Message', 'Active'];
    const rows = filtered.map(r => [
      r.name, r.insuranceType, r.cptCode ?? '', r.ruleType,
      r.severity, r.warningMessage, r.active ? 'Yes' : 'No',
    ]);
    const csv = [header, ...rows].map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'billing-rules.csv'; a.click();
  }

  const companyOptions = companies.map(c => ({ value: c.type, label: c.name }));
  const uniqueTypes = [...new Set(companyOptions.map(c => c.value))];

  return (
    <>
      {/* Controls row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          placeholder="🔍 Search rules, CPT, message…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: '1 1 220px', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#374151', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} />
          Active only
        </label>
        <button onClick={openAdd} className="btn" style={{ whiteSpace: 'nowrap' }}>+ Add Rule</button>
        <button onClick={exportCsv} className="btn btn-secondary" style={{ whiteSpace: 'nowrap' }}>⬇ Export</button>
        <button onClick={() => setView(v => v === 'table' ? 'cards' : 'table')} className="btn btn-secondary" style={{ whiteSpace: 'nowrap' }}>
          {view === 'table' ? '🗂 Cards View' : '📊 Table View'}
        </button>
      </div>

      {/* Insurance type filter tabs */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
        {INSURANCE_FILTER_TABS.map(t => (
          <button key={t.key} onClick={() => setFilterType(t.key)} style={{
            padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 600,
            background: filterType === t.key ? '#0d9488' : '#f1f5f9',
            color: filterType === t.key ? '#fff' : '#475569',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Severity filter tabs */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 16 }}>
        {SEVERITY_FILTER_TABS.map(t => (
          <button key={t.key} onClick={() => setFilterSeverity(t.key)} style={{
            padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 600,
            background: filterSeverity === t.key ? '#374151' : '#f1f5f9',
            color: filterSeverity === t.key ? '#fff' : '#475569',
          }}>{t.label}</button>
        ))}
      </div>

      {loadError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#b91c1c', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>🔐</span>
          <span>{loadError}</span>
          <button onClick={load} style={{ marginLeft: 'auto', padding: '4px 12px', background: '#b91c1c', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Retry</button>
        </div>
      )}

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : view === 'table' ? (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  {['Rule Name', 'Insurance', 'CPT Code(s)', 'Type', 'Severity', 'Warning Message', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#374151', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', minWidth: h === 'Severity' ? 110 : undefined }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>No rules match your filters</td></tr>
                ) : filtered.map((rule, i) => (
                  <tr key={rule.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1e293b', maxWidth: 200 }}>
                      <div>{rule.name}</div>
                      {rule.description && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, fontWeight: 400 }}>{rule.description.slice(0, 60)}{rule.description.length > 60 ? '…' : ''}</div>}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <InsuranceBadge type={rule.insuranceType} />
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <CptBadge code={rule.cptCode} />
                      {rule.relatedCptCode && <><span style={{ margin: '0 4px', color: '#9ca3af' }}>+</span><CptBadge code={rule.relatedCptCode} /></>}
                    </td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                      <span title={rule.ruleType}>{RULE_TYPE_ICONS[rule.ruleType] ?? '📌'}</span>
                      <span style={{ marginLeft: 6, color: '#374151', fontSize: 11 }}>{rule.ruleType.replace(/_/g, ' ')}</span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <SeverityBadge severity={rule.severity} />
                      {rule.overrideRequiresAdmin && (
                        <div style={{ fontSize: 10, color: '#b91c1c', marginTop: 3 }}>🔐 Admin only</div>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ color: '#374151', fontSize: 12, lineHeight: 1.5 }}>{rule.warningMessage}</span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <input type="checkbox" checked={rule.active} onChange={() => handleToggleActive(rule)} />
                        <span style={{ fontSize: 11, color: rule.active ? '#15803d' : '#9ca3af' }}>{rule.active ? 'Active' : 'Inactive'}</span>
                      </label>
                    </td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                      <button onClick={() => openEdit(rule)} style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, marginRight: 6 }}>✏️ Edit</button>
                      <button onClick={() => handleDelete(rule)} style={{ background: 'none', border: '1px solid #fca5a5', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, color: '#dc2626' }}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '10px 16px', borderTop: '1px solid #f1f5f9', fontSize: 12, color: '#6b7280' }}>
            {filtered.length} rule{filtered.length !== 1 ? 's' : ''} shown · {rules.filter(r => r.severity === 'hard_block').length} hard blocks · {rules.filter(r => r.active).length} active total
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Object.entries(grouped).map(([type, groupRules]) => (
            <div key={type} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <button
                onClick={() => toggleGroup(type)}
                style={{ width: '100%', textAlign: 'left', background: '#f8fafc', border: 'none', padding: '14px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
              >
                <InsuranceBadge type={type} />
                <span style={{ fontWeight: 700, color: '#374151', fontSize: 14 }}>{type.charAt(0).toUpperCase() + type.slice(1)}</span>
                <span style={{ fontSize: 12, color: '#6b7280' }}>({groupRules.length} rule{groupRules.length !== 1 ? 's' : ''})</span>
                <span style={{ marginLeft: 'auto', fontSize: 16 }}>{expandedGroups[type] ? '▲' : '▼'}</span>
              </button>
              {expandedGroups[type] && (
                <div style={{ padding: '16px 20px', display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
                  {groupRules.map(rule => (
                    <div key={rule.id} style={{ border: `1px solid ${rule.severity === 'hard_block' ? '#fecaca' : '#e2e8f0'}`, borderRadius: 10, padding: '14px 16px', background: rule.severity === 'hard_block' ? '#fff5f5' : '#fff' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 18 }}>{RULE_TYPE_ICONS[rule.ruleType] ?? '📌'}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{rule.name}</div>
                          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                            <CptBadge code={rule.cptCode} />
                            {rule.relatedCptCode && <CptBadge code={rule.relatedCptCode} />}
                            <SeverityBadge severity={rule.severity} />
                          </div>
                        </div>
                        <button onClick={() => openEdit(rule)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>✏️</button>
                      </div>
                      <p style={{ fontSize: 12, color: '#6b7280', margin: 0, lineHeight: 1.4 }}>{rule.warningMessage}</p>
                      {rule.overrideRequiresAdmin && (
                        <div style={{ marginTop: 8, fontSize: 11, color: '#b91c1c', fontWeight: 600 }}>🔐 Admin override required</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {Object.keys(grouped).length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: 48 }}>
              <div style={{ color: '#9ca3af' }}>No rules match your filters</div>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{editingRule ? '✏️ Edit Rule' : '+ Add Billing Rule'}</h2>
              <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#6b7280' }}>×</button>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Rule Name *</label>
                <input className="form-input" value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Medicare: No SPT + IDT Same Day" />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-input" rows={2} value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief clinical description…" />
              </div>
              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label">Insurance Type</label>
                  <select className="form-input" value={form.insuranceType ?? 'all'} onChange={e => setForm(f => ({ ...f, insuranceType: e.target.value }))}>
                    <option value="all">All Payers</option>
                    {uniqueTypes.filter(t => t !== 'all').map(t => {
                      const co = companyOptions.find(c => c.value === t);
                      return <option key={t} value={t}>{co?.label ?? t}</option>;
                    })}
                    {!uniqueTypes.includes('medicare') && <option value="medicare">Medicare</option>}
                    {!uniqueTypes.includes('medicaid') && <option value="medicaid">Medicaid</option>}
                    {!uniqueTypes.includes('bcbs') && <option value="bcbs">BCBS</option>}
                    {!uniqueTypes.includes('commercial') && <option value="commercial">Commercial</option>}
                    {!uniqueTypes.includes('tricare') && <option value="tricare">Tricare</option>}
                    {!uniqueTypes.includes('aetna') && <option value="aetna">Aetna</option>}
                    {!uniqueTypes.includes('united') && <option value="united">United</option>}
                    {!uniqueTypes.includes('cigna') && <option value="cigna">Cigna</option>}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Rule Type</label>
                  <select className="form-input" value={form.ruleType ?? 'same_day_conflict'} onChange={e => setForm(f => ({ ...f, ruleType: e.target.value }))}>
                    {RULE_TYPES.map(rt => (
                      <option key={rt} value={rt}>{RULE_TYPE_ICONS[rt]} {rt.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label">Severity</label>
                  <select className="form-input" value={form.severity ?? 'warning'} onChange={e => setForm(f => ({ ...f, severity: e.target.value as BillingRule['severity'] }))}>
                    <option value="info">ℹ️ Info</option>
                    <option value="warning">⚠️ Warning</option>
                    <option value="hard_block">🚫 Hard Block</option>
                  </select>
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', paddingTop: 24 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#374151' }}>
                    <input type="checkbox" checked={form.overrideRequiresAdmin ?? false} onChange={e => setForm(f => ({ ...f, overrideRequiresAdmin: e.target.checked }))} />
                    🔐 Override requires admin
                  </label>
                </div>
              </div>
              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label">CPT Code</label>
                  <input className="form-input" value={form.cptCode ?? ''} onChange={e => setForm(f => ({ ...f, cptCode: e.target.value }))} placeholder="e.g. 95004" list="cpt-list" />
                  <datalist id="cpt-list">
                    {['95004','95024','95044','95052','95165','95115','95117','99213','99214'].map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div className="form-group">
                  <label className="form-label">Related CPT Code (optional)</label>
                  <input className="form-input" value={form.relatedCptCode ?? ''} onChange={e => setForm(f => ({ ...f, relatedCptCode: e.target.value }))} placeholder="e.g. 95024" list="cpt-list" />
                </div>
              </div>
              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label">Max Units (optional)</label>
                  <input type="number" className="form-input" value={form.maxUnits ?? ''} onChange={e => setForm(f => ({ ...f, maxUnits: e.target.value ? parseInt(e.target.value) : undefined }))} placeholder="e.g. 1800" />
                </div>
                <div className="form-group">
                  <label className="form-label">Requires Modifier (optional)</label>
                  <input className="form-input" value={form.requiresModifier ?? ''} onChange={e => setForm(f => ({ ...f, requiresModifier: e.target.value }))} placeholder="25, 59, etc." />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 24 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={form.requiresDxMatch ?? false} onChange={e => setForm(f => ({ ...f, requiresDxMatch: e.target.checked }))} />
                  Requires Diagnosis Match
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={form.active ?? true} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
                  Active
                </label>
              </div>
              <div className="form-group">
                <label className="form-label">Warning Message *</label>
                <textarea className="form-input" rows={3} value={form.warningMessage ?? ''} onChange={e => setForm(f => ({ ...f, warningMessage: e.target.value }))} placeholder="Message shown to billers when this rule triggers…" />
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalOpen(false)} className="btn btn-secondary">Cancel</button>
              <button onClick={handleSave} className="btn" disabled={saving || !form.name || !form.warningMessage}>
                {saving ? 'Saving…' : editingRule ? 'Save Changes' : 'Create Rule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
