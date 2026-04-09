'use client';

import { useEffect, useState, useCallback } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

interface BillingRule {
  id: string;
  name: string;
  description?: string;
  insuranceType: string;
  ruleType: string;
  cptCode?: string;
  relatedCptCode?: string;
  maxUnits?: number;
  requiresModifier?: string;
  requiresDxMatch: boolean;
  warningMessage: string;
  severity: 'warning' | 'hard_block' | 'info';
  overrideRequiresAdmin: boolean;
  active: boolean;
  sortOrder: number;
}

interface InsuranceCompany {
  id: string;
  name: string;
  type: string;
  payerId?: string;
  phone?: string;
  fax?: string;
  website?: string;
  planTypes?: string;
  notes?: string;
  active: boolean;
  sortOrder: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const INSURANCE_COLORS: Record<string, { bg: string; color: string }> = {
  medicare:   { bg: '#dbeafe', color: '#1d4ed8' },
  medicaid:   { bg: '#dcfce7', color: '#15803d' },
  all:        { bg: '#f1f5f9', color: '#475569' },
  bcbs:       { bg: '#ede9fe', color: '#6d28d9' },
  commercial: { bg: '#fce7f3', color: '#be185d' },
  tricare:    { bg: '#fed7aa', color: '#c2410c' },
  aetna:      { bg: '#fef9c3', color: '#a16207' },
  united:     { bg: '#e0f2fe', color: '#0369a1' },
  cigna:      { bg: '#f0fdf4', color: '#166534' },
};

const SEVERITY_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  info:       { bg: '#f0f9ff', color: '#0369a1', label: 'Info' },
  warning:    { bg: '#fef9c3', color: '#a16207', label: 'Warning' },
  hard_block: { bg: '#fee2e2', color: '#b91c1c', label: 'Hard Block' },
};

const RULE_TYPE_ICONS: Record<string, string> = {
  same_day_conflict:  '⚡',
  requires_modifier:  '🔖',
  max_units:          '🔢',
  lifetime_limit:     '♾️',
  dx_required:        '🏥',
  prior_auth:         '📋',
  specialist_required:'👨‍⚕️',
  supervision:        '👁️',
  documentation:      '📝',
  unbundling:         '⚠️',
  in_person_required: '🏢',
};

const RULE_TYPES = Object.keys(RULE_TYPE_ICONS);

const INSURANCE_FILTER_TABS = [
  { key: '', label: 'All' },
  { key: 'medicare', label: 'Medicare' },
  { key: 'medicaid', label: 'Medicaid' },
  { key: 'bcbs', label: 'BCBS' },
  { key: 'commercial', label: 'Commercial' },
  { key: 'tricare', label: 'Tricare' },
  { key: 'aetna', label: 'Aetna' },
  { key: 'united', label: 'United' },
  { key: 'cigna', label: 'Cigna' },
  { key: 'all', label: 'All Payers' },
];

const SEVERITY_FILTER_TABS = [
  { key: '', label: 'All Severity' },
  { key: 'hard_block', label: '🚫 Hard Blocks' },
  { key: 'warning', label: '⚠️ Warnings' },
  { key: 'info', label: 'ℹ️ Info' },
];

const EMPTY_RULE: Partial<BillingRule> = {
  name: '', description: '', insuranceType: 'all', ruleType: 'same_day_conflict',
  cptCode: '', relatedCptCode: '', requiresModifier: '',
  requiresDxMatch: false, warningMessage: '',
  severity: 'warning', overrideRequiresAdmin: false, active: true,
};

const EMPTY_COMPANY: Partial<InsuranceCompany> = {
  name: '', type: 'commercial', payerId: '', phone: '', fax: '',
  website: '', planTypes: '', notes: '', active: true, sortOrder: 0,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function InsuranceBadge({ type, label }: { type: string; label?: string }) {
  const s = INSURANCE_COLORS[type] ?? { bg: '#f1f5f9', color: '#475569' };
  return (
    <span style={{
      background: s.bg, color: s.color,
      padding: '2px 8px', borderRadius: 12, fontSize: 11,
      fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
    }}>
      {label ?? type}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const s = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.warning;
  return (
    <span style={{
      background: s.bg, color: s.color,
      padding: '2px 8px', borderRadius: 12, fontSize: 11,
      fontWeight: 700, border: `1px solid ${s.color}33`,
      whiteSpace: 'nowrap', display: 'inline-block',
    }}>
      {severity === 'hard_block' ? '🚫' : severity === 'warning' ? '⚠️' : 'ℹ️'} {s.label}
    </span>
  );
}

function CptBadge({ code }: { code?: string }) {
  if (!code) return <span style={{ color: '#9ca3af' }}>—</span>;
  return (
    <span style={{
      background: '#f8fafc', border: '1px solid #e2e8f0',
      padding: '2px 7px', borderRadius: 6, fontSize: 12,
      fontFamily: 'monospace', fontWeight: 700, color: '#374151',
    }}>
      {code}
    </span>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function InsurancePage() {
  const [activeTab, setActiveTab] = useState<'rules' | 'cpt' | 'icd' | 'companies' | 'guide'>('companies');

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">🏥 Insurance Hub</div>
          <div className="page-subtitle">Billing rules, code references, and insurance company management</div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ padding: '0 24px', borderBottom: '1px solid #e2e8f0', background: '#fff', display: 'flex', gap: 0, overflowX: 'auto' }}>
        {([
          { key: 'companies', label: '🏢 Insurance Companies' },
          { key: 'rules',     label: '📋 Business Rules' },
          { key: 'cpt',       label: '💊 CPT Codes' },
          { key: 'icd',       label: '🏷️ ICD-10 Codes' },
          { key: 'guide',     label: '📖 Reference Guide' },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: '14px 20px', border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap',
              borderBottom: activeTab === t.key ? '3px solid #0d9488' : '3px solid transparent',
              color: activeTab === t.key ? '#0d9488' : '#64748b',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="page-body">
        {activeTab === 'rules'     && <BusinessRulesTab />}
        {activeTab === 'companies' && <CompaniesTab />}
        {activeTab === 'cpt' && <CptCodesTab />}
        {activeTab === 'icd' && <Icd10CodesTab />}
        {activeTab === 'guide'     && <ReferenceGuideTab />}
      </div>
    </div>
  );
}

// ── Tab: Code Link (CPT / ICD) ───────────────────────────────────────────────

// ── Tab: CPT Codes ────────────────────────────────────────────────────────────
function CptCodesTab() {
  const [codes, setCodes] = useState<{ id: string; code: string; description: string; category?: string; nonFacilityFee?: number | null; facilityFee?: number | null; maximumAllowable?: number | null; active: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    fetch('/api/cpt-codes?all=true').then(async r => {
      const data = await r.json();
      if (r.status === 401) throw new Error('session_expired');
      if (!r.ok) throw new Error(data?.error ?? `HTTP ${r.status}`);
      return data;
    })
      .then(d => { setCodes(d.codes ?? (Array.isArray(d) ? d : [])); })
      .catch((err: Error) => {
        const msg = err?.message ?? 'unknown error';
        if (msg === 'session_expired') {
          setLoadError('Your session has expired. Please refresh the page and log in again.');
        } else {
          setLoadError(`Failed to load CPT codes: ${msg}`);
        }
        setCodes([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = codes.filter(c =>
    !search || c.code.toLowerCase().includes(search.toLowerCase()) ||
    c.description.toLowerCase().includes(search.toLowerCase()) ||
    (c.category ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#1a2233' }}>💊 CPT Procedure Codes ({codes.length})</div>
        <input className="form-input" placeholder="Search codes..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: 250, fontSize: 13 }} />
      </div>
      {loadError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#b91c1c', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>🔐</span>
          <span>{loadError}</span>
          <button onClick={load} style={{ marginLeft: 'auto', padding: '4px 12px', background: '#b91c1c', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Retry</button>
        </div>
      )}
      {loading ? <div className="loading-center"><div className="spinner" /></div> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Code', 'Description', 'Category', '2026 NF Rate', '2026 FAC Rate', 'NoVA MAC'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#374151', textTransform: 'uppercase', fontSize: 11, borderBottom: '2px solid #e2e8f0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#f8fafc', opacity: c.active ? 1 : 0.5 }}>
                  <td style={{ padding: '9px 14px', fontWeight: 700, color: '#7c3aed', fontFamily: 'monospace' }}>{c.code}</td>
                  <td style={{ padding: '9px 14px', color: '#374151' }}>{c.description}</td>
                  <td style={{ padding: '9px 14px', color: '#64748b', fontSize: 12 }}>{c.category ?? '—'}</td>
                  <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 12, color: c.nonFacilityFee ? '#15803d' : '#94a3b8', fontWeight: 600 }}>
                    {c.nonFacilityFee ? `$${Number(c.nonFacilityFee).toFixed(2)}` : '—'}
                  </td>
                  <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 12, color: c.facilityFee ? '#0369a1' : '#94a3b8', fontWeight: 600 }}>
                    {c.facilityFee ? `$${Number(c.facilityFee).toFixed(2)}` : '—'}
                  </td>
                  <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 12, color: c.maximumAllowable ? '#7c3aed' : '#94a3b8', fontWeight: 700 }}>
                    {c.maximumAllowable ? `$${Number(c.maximumAllowable).toFixed(2)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Tab: ICD-10 Codes ─────────────────────────────────────────────────────────
function Icd10CodesTab() {
  const [codes, setCodes] = useState<{ id: string; code: string; description: string; category?: string; active: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    fetch('/api/icd10-codes?all=true').then(async r => {
      const data = await r.json();
      if (r.status === 401) throw new Error('session_expired');
      if (!r.ok) throw new Error(data?.error ?? `HTTP ${r.status}`);
      return data;
    })
      .then(d => { setCodes(d.codes ?? (Array.isArray(d) ? d : [])); })
      .catch((err: Error) => {
        const msg = err?.message ?? 'unknown error';
        if (msg === 'session_expired') {
          setLoadError('Your session has expired. Please refresh the page and log in again.');
        } else {
          setLoadError(`Failed to load ICD-10 codes: ${msg}`);
        }
        setCodes([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = codes.filter(c =>
    !search || c.code.toLowerCase().includes(search.toLowerCase()) ||
    c.description.toLowerCase().includes(search.toLowerCase()) ||
    (c.category ?? '').toLowerCase().includes(search.toLowerCase())
  );

  // Group by category
  const categories = [...new Set(filtered.map(c => c.category ?? 'Other'))].sort();

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#1a2233' }}>🏷️ ICD-10 Diagnosis Codes ({codes.length})</div>
        <input className="form-input" placeholder="Search codes..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: 250, fontSize: 13 }} />
      </div>
      {loadError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#b91c1c', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>🔐</span>
          <span>{loadError}</span>
          <button onClick={load} style={{ marginLeft: 'auto', padding: '4px 12px', background: '#b91c1c', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Retry</button>
        </div>
      )}
      {loading ? <div className="loading-center"><div className="spinner" /></div> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Code', 'Description', 'Category', 'Status'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#374151', textTransform: 'uppercase', fontSize: 11, borderBottom: '2px solid #e2e8f0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map(cat => {
                const catCodes = filtered.filter(c => (c.category ?? 'Other') === cat);
                return catCodes.map((c, i) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                    {i === 0 && (
                      <td colSpan={4} style={{ padding: '8px 14px', background: '#f0fdf4', fontWeight: 700, fontSize: 11, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0' }}>
                        {cat} ({catCodes.length})
                      </td>
                    )}
                    {i > 0 && null}
                  </tr>
                )).concat(catCodes.map((c, i) => (
                  <tr key={c.id + '-data'} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#f8fafc', opacity: c.active ? 1 : 0.5 }}>
                    <td style={{ padding: '9px 14px', fontWeight: 700, color: '#0055A5', fontFamily: 'monospace' }}>{c.code}</td>
                    <td style={{ padding: '9px 14px', color: '#374151' }}>{c.description}</td>
                    <td style={{ padding: '9px 14px', color: '#64748b', fontSize: 12 }}>{c.category ?? '—'}</td>
                    <td style={{ padding: '9px 14px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: c.active ? '#dcfce7' : '#f3f4f6', color: c.active ? '#15803d' : '#64748b' }}>
                        {c.active ? '✅ Active' : '⬜ Inactive'}
                      </span>
                    </td>
                  </tr>
                )));
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Tab: Business Rules ──────────────────────────────────────────────────────

function BusinessRulesTab() {
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

  // Group by insuranceType for cards view
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

  // Get unique insurance types from loaded companies for the modal dropdown
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
        /* ── Table view ── */
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
                      <span style={{ color: '#374151', fontSize: 12, lineHeight: 1.5 }}>
                        {rule.warningMessage}
                      </span>
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
        /* ── Cards view (grouped) ── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Object.entries(grouped).map(([type, groupRules]) => (
            <div key={type} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <button
                onClick={() => toggleGroup(type)}
                style={{
                  width: '100%', textAlign: 'left', background: '#f8fafc',
                  border: 'none', padding: '14px 20px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}
              >
                <InsuranceBadge type={type} />
                <span style={{ fontWeight: 700, color: '#374151', fontSize: 14 }}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </span>
                <span style={{ fontSize: 12, color: '#6b7280' }}>({groupRules.length} rule{groupRules.length !== 1 ? 's' : ''})</span>
                <span style={{ marginLeft: 'auto', fontSize: 16 }}>{expandedGroups[type] ? '▲' : '▼'}</span>
              </button>
              {expandedGroups[type] && (
                <div style={{ padding: '16px 20px', display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
                  {groupRules.map(rule => (
                    <div key={rule.id} style={{
                      border: `1px solid ${rule.severity === 'hard_block' ? '#fecaca' : '#e2e8f0'}`,
                      borderRadius: 10, padding: '14px 16px',
                      background: rule.severity === 'hard_block' ? '#fff5f5' : '#fff',
                    }}>
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
              {/* Rule Name */}
              <div className="form-group">
                <label className="form-label">Rule Name *</label>
                <input className="form-input" value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Medicare: No SPT + IDT Same Day" />
              </div>
              {/* Description */}
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-input" rows={2} value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief clinical description…" />
              </div>
              {/* Row: Insurance Type + Rule Type */}
              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label">Insurance Type</label>
                  <select className="form-input" value={form.insuranceType ?? 'all'} onChange={e => setForm(f => ({ ...f, insuranceType: e.target.value }))}>
                    <option value="all">All Payers</option>
                    {uniqueTypes.filter(t => t !== 'all').map(t => {
                      const co = companyOptions.find(c => c.value === t);
                      return <option key={t} value={t}>{co?.label ?? t}</option>;
                    })}
                    {/* Fallback: always include common types */}
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
              {/* Row: Severity + Override */}
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
              {/* Row: CPT Code + Related CPT */}
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
              {/* Row: Max Units + Requires Modifier */}
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
              {/* Dx match + Active */}
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
              {/* Warning Message */}
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

// ── Tab: Insurance Companies ─────────────────────────────────────────────────

function CompaniesTab() {
  const [companies, setCompanies] = useState<InsuranceCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCo, setEditingCo] = useState<InsuranceCompany | null>(null);
  const [form, setForm] = useState<Partial<InsuranceCompany>>(EMPTY_COMPANY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/insurance-companies?all=true').then(r => r.json())
      .then(d => setCompanies(d.companies ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = companies.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.type.toLowerCase().includes(search.toLowerCase()) ||
    (c.payerId ?? '').toLowerCase().includes(search.toLowerCase())
  );

  function openAdd() { setEditingCo(null); setForm({ ...EMPTY_COMPANY }); setModalOpen(true); }
  function openEdit(co: InsuranceCompany) { setEditingCo(co); setForm({ ...co }); setModalOpen(true); }

  async function handleSave() {
    if (!form.name) return;
    setSaving(true);
    try {
      const url = editingCo ? `/api/insurance-companies/${editingCo.id}` : '/api/insurance-companies';
      const method = editingCo ? 'PUT' : 'POST';
      await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      setModalOpen(false);
      load();
    } catch { /* ignore */ } finally { setSaving(false); }
  }

  async function handleDelete(co: InsuranceCompany) {
    if (!confirm(`Deactivate "${co.name}"?`)) return;
    await fetch(`/api/insurance-companies/${co.id}`, { method: 'DELETE' });
    load();
  }

  async function handleToggle(co: InsuranceCompany) {
    await fetch(`/api/insurance-companies/${co.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !co.active }),
    });
    load();
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          placeholder="🔍 Search companies…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: '1 1 220px', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }}
        />
        <button onClick={openAdd} className="btn">+ Add Insurer</button>
      </div>

      {loading ? (
        <div className="loading-center"><div className="spinner" /></div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  {['Company Name', 'Type', 'Payer ID', 'Phone', 'Fax', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#374151', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>No companies found</td></tr>
                ) : filtered.map((co, i) => (
                  <tr key={co.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1e293b' }}>
                      {co.name}
                      {co.notes && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, fontWeight: 400 }}>{co.notes.slice(0, 50)}</div>}
                    </td>
                    <td style={{ padding: '10px 14px' }}><InsuranceBadge type={co.type} /></td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: '#374151' }}>{co.payerId ?? '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#374151' }}>{co.phone ?? '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#374151' }}>{co.fax ?? '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <input type="checkbox" checked={co.active} onChange={() => handleToggle(co)} />
                        <span style={{ fontSize: 11, color: co.active ? '#15803d' : '#9ca3af' }}>{co.active ? 'Active' : 'Inactive'}</span>
                      </label>
                    </td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                      <button onClick={() => openEdit(co)} style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, marginRight: 6 }}>✏️ Edit</button>
                      <button onClick={() => handleDelete(co)} style={{ background: 'none', border: '1px solid #fca5a5', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, color: '#dc2626' }}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '10px 16px', borderTop: '1px solid #f1f5f9', fontSize: 12, color: '#6b7280' }}>
            {filtered.length} insurer{filtered.length !== 1 ? 's' : ''} · {companies.filter(c => c.active).length} active
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{editingCo ? '✏️ Edit Insurer' : '+ Add Insurance Company'}</h2>
              <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#6b7280' }}>×</button>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label">Company Name *</label>
                  <input className="form-input" value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. BlueCross BlueShield" />
                </div>
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select className="form-input" value={form.type ?? 'commercial'} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    {['medicare','medicaid','bcbs','commercial','tricare','aetna','united','cigna'].map(t => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label">Payer ID</label>
                  <input className="form-input" value={form.payerId ?? ''} onChange={e => setForm(f => ({ ...f, payerId: e.target.value }))} placeholder="e.g. 00570" />
                </div>
                <div className="form-group">
                  <label className="form-label">Plan Types</label>
                  <input className="form-input" value={form.planTypes ?? ''} onChange={e => setForm(f => ({ ...f, planTypes: e.target.value }))} placeholder="HMO, PPO, EPO…" />
                </div>
              </div>
              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-input" value={form.phone ?? ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Provider services #" />
                </div>
                <div className="form-group">
                  <label className="form-label">Fax</label>
                  <input className="form-input" value={form.fax ?? ''} onChange={e => setForm(f => ({ ...f, fax: e.target.value }))} placeholder="Claims fax #" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Website</label>
                <input className="form-input" value={form.website ?? ''} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="https://providerportal.example.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-input" rows={2} value={form.notes ?? ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any special billing notes…" />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={form.active ?? true} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
                Active
              </label>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalOpen(false)} className="btn btn-secondary">Cancel</button>
              <button onClick={handleSave} className="btn" disabled={saving || !form.name}>
                {saving ? 'Saving…' : editingCo ? 'Save Changes' : 'Add Company'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Tab: Reference Guide ─────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="card" style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', textAlign: 'left', background: 'linear-gradient(135deg,#f8fafc,#f1f5f9)',
        border: 'none', padding: '16px 20px', cursor: 'pointer',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>{title}</span>
        <span style={{ fontSize: 18, color: '#64748b' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div style={{ padding: '0 24px 24px' }}>{children}</div>}
    </div>
  );
}

function GuideTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div style={{ overflowX: 'auto', marginTop: 12 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            {headers.map(h => <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, borderBottom: '2px solid #e2e8f0', color: '#374151', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
              {row.map((cell, j) => <td key={j} style={{ padding: '8px 12px', color: '#374151', verticalAlign: 'top', lineHeight: 1.5 }}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AlertBox({ type, children }: { type: 'info' | 'warning' | 'danger'; children: React.ReactNode }) {
  const styles = {
    info:    { bg: '#eff6ff', border: '#bfdbfe', color: '#1e40af', icon: 'ℹ️' },
    warning: { bg: '#fefce8', border: '#fde68a', color: '#92400e', icon: '⚠️' },
    danger:  { bg: '#fef2f2', border: '#fecaca', color: '#991b1b', icon: '🚫' },
  }[type];
  return (
    <div style={{ background: styles.bg, border: `1px solid ${styles.border}`, borderRadius: 8, padding: '12px 16px', marginTop: 12, display: 'flex', gap: 10 }}>
      <span style={{ fontSize: 16 }}>{styles.icon}</span>
      <div style={{ fontSize: 13, color: styles.color, lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}

function ReferenceGuideTab() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e293b' }}>📖 Allergy Billing Reference Guide</h2>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
          Quick reference for allergy-specific billing compliance. Always verify against current payer policies.
          Last reviewed: 2026.
        </p>
      </div>

      {/* ── Section 1: Medicare Allergy Billing Quick Reference ── */}
      <Section title="🏥 Medicare Allergy Billing Quick Reference">
        <AlertBox type="danger">
          Medicare is the most complex payer for allergy billing. Direct physician supervision (physician in office suite)
          is required for all allergy skin testing — not general supervision.
        </AlertBox>

        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginTop: 16 }}>Allergy Testing Limits</h3>
        <GuideTable
          headers={['CPT Code', 'Description', 'Medicare Limit', 'Notes']}
          rows={[
            ['95004', 'Percutaneous allergy tests (SPT)', '70 tests/session', 'Up to 70 different allergens per session'],
            ['95024', 'Intradermal tests, sequential', 'Only after failed SPT', 'Requires documentation that SPT was inconclusive'],
            ['95044', 'Patch tests', '85 tests/session', 'Contact allergens'],
            ['95052', 'Photo-patch tests', 'Per session', 'UV-tested patch allergens'],
            ['95165', 'Antigen serum preparation', '1,800 units/year', 'Max 5-year lifetime limit for immunotherapy'],
          ]}
        />

        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginTop: 16 }}>Immunotherapy Billing</h3>
        <GuideTable
          headers={['CPT Code', 'Description', 'Coverage Rule']}
          rows={[
            ['95115', 'Immunotherapy injection — single', 'Covered; physician must be immediately available'],
            ['95117', 'Immunotherapy injection — multiple', 'Use for 2+ injections same visit; do not bill with 95115'],
            ['95165', 'Serum preparation', '1 unit = 1 dose vial; 1800 max/year'],
          ]}
        />

        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginTop: 16 }}>Documentation Requirements</h3>
        <ul style={{ fontSize: 13, color: '#374151', lineHeight: 1.8, paddingLeft: 20 }}>
          <li>Documented allergic disease diagnosis (ICD-10: J30.x, J45.x, L50.x, etc.)</li>
          <li>Failed conservative treatment (antihistamines, nasal steroids) documented in chart</li>
          <li>Physician present in office suite for skin testing (direct supervision)</li>
          <li>Physician immediately available (on-site) during injection administration</li>
          <li>Skin test results recorded (positive/negative, wheal size in mm)</li>
          <li>Informed consent for immunotherapy documented</li>
        </ul>

        <AlertBox type="info">
          <strong>Local Coverage Determination (LCD):</strong> Check the current LCD for allergy testing in your MAC jurisdiction.
          Northern Virginia falls under CGS Administrators (J15). LCD L33681 covers allergy testing indications.
        </AlertBox>
      </Section>

      {/* ── Section 2: CPT Modifier Guide ── */}
      <Section title="🔖 CPT Modifier Guide">
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 12 }}>
          Modifiers clarify the circumstances of a service to payers. Using wrong or missing modifiers is a top denial reason.
        </p>
        <GuideTable
          headers={['Modifier', 'Name', 'When to Use', 'Common Payer Notes']}
          rows={[
            ['25', 'Significant, Separately Identifiable E&M',
              'When billing an E&M (99213/99214) on the same day as a procedure (allergy testing, injection)',
              'Required by Medicare and most commercial payers. Document that E&M was for a separate, distinct reason.'],
            ['59', 'Distinct Procedural Service',
              'When two procedures not normally billed together are distinct services on the same date',
              'Example: allergy testing (95004) + injection (95115) same day. Some payers prefer X-modifiers (XE, XS, XP, XU).'],
            ['26', 'Professional Component',
              'When billing only the professional (physician) component of a global service',
              'Rarely used in allergy; more common in labs/radiology.'],
            ['TC', 'Technical Component',
              'When billing only the technical component (equipment, staff)',
              'Rarely used in allergy settings.'],
            ['KX', 'Medical Necessity Documentation',
              'Medicare: certify that documentation supporting medical necessity is on file',
              'Required for some allergy services when LCD requires documentation threshold.'],
            ['GA', 'Waiver of Liability on File',
              'Medicare: ABN (Advance Beneficiary Notice) signed — patient may be liable',
              'Use when service may not be covered and ABN is obtained.'],
            ['GY', 'Non-Covered Service',
              'Service is statutorily excluded from Medicare coverage',
              'Do not use for covered services — will result in denial.'],
            ['GZ', 'Reasonable & Necessary Failure Expected',
              'Medicare: service expected to fail R&N determination, no ABN obtained',
              'Avoid — indicates billing without proper documentation.'],
          ]}
        />

        <AlertBox type="warning">
          <strong>Modifier 59 vs. X-Modifiers:</strong> CMS has introduced HCPCS modifiers XE, XS, XP, and XU as more specific
          alternatives to Modifier 59. Check your payer policy — many Medicare MACs now prefer X-modifiers over 59.
        </AlertBox>
      </Section>

      {/* ── Section 3: Common Denial Reasons ── */}
      <Section title="❌ Common Denial Reasons and How to Avoid Them">
        <GuideTable
          headers={['Denial Reason', 'Root Cause', 'Prevention', 'Appeal Strategy']}
          rows={[
            ['Lack of Medical Necessity',
              'No documentation of failed conservative therapy; weak diagnosis documentation',
              'Document antihistamine/steroid trial in chart before ordering allergy testing; use specific ICD-10 codes',
              'Submit office notes showing symptom chronology, failed first-line treatment, and clinical rationale for testing'],
            ['Supervision Level Not Met',
              'Physician not present in office suite during allergy testing',
              'Ensure physician is in-office (not just on-call) for all Medicare allergy testing visits',
              'Submit documentation showing physician was present; provide schedule/attestation'],
            ['Missing Modifier 25 on E&M',
              'E&M and procedure billed same day without Modifier 25',
              'Always append Modifier 25 to E&M when billing with allergy procedure on same date',
              'Resubmit claim with Modifier 25 attached to E&M code'],
            ['Exceeded Annual/Lifetime Limits',
              '95165 units exceed 1,800/year or 5-year lifetime for Medicare',
              'Track serum units in EMR; set alerts at 1,600 units',
              'Request exceptions with supporting documentation; consider Medicare Advantage appeal process'],
            ['Same-Day Conflict (95004 + 95024)',
              'Both percutaneous and intradermal tests billed on same date for Medicare',
              'Never bill 95004 and 95024 on the same date of service for Medicare',
              'Void duplicate claim; resubmit with only one test type; document clinical rationale if both truly needed'],
            ['Missing Prior Authorization',
              'Allergy testing or immunotherapy started without required PA for Tricare or some MA plans',
              'Verify PA requirements at intake; obtain PA before first visit; document PA number in claim',
              'Retrospective authorization request with clinical documentation; often limited success'],
            ['Incorrect Diagnosis Code',
              'Unspecified allergy code (T78.40XA) used instead of specific code; wrong code family',
              'Use specific allergy ICD-10 (J30.1 seasonal rhinitis, L50.0 allergic urticaria, etc.)',
              'Resubmit with correct, specific ICD-10; attach clinical documentation'],
            ['Unbundling',
              '95115 and 95117 billed same day; or procedure components billed separately',
              'Use 95117 for multiple injections; never bill 95115 + 95117 on same date',
              'Resubmit with correct single code; explain clinical details if needed'],
            ['Timely Filing Exceeded',
              'Claim submitted outside payer\'s timely filing window (Medicare: 12 months)',
              'Submit claims within 90 days; monitor aging A/R at 60-day intervals',
              'Submit proof of timely filing (clearinghouse confirmation, system logs); limited recourse after window'],
          ]}
        />
      </Section>

      {/* ── Section 4: Allergy Billing FAQ ── */}
      <Section title="❓ Allergy Billing FAQ">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 16 }}>
          {[
            {
              q: 'Can we bill for allergy testing and an E&M on the same day?',
              a: 'Yes, but you must append Modifier 25 to the E&M code (99213/99214). The E&M must be for a significant, separately identifiable medical decision-making problem — not just to justify the testing. Document the reason for the E&M separately from the testing indication.'
            },
            {
              q: 'How do we bill for the allergist who reviews and interprets the allergy test results?',
              a: 'The professional interpretation is bundled into the allergy testing CPT codes (95004, 95024, etc.). There is no separate interpretation code unless you are billing for a second physician\'s interpretation in a facility setting. Do not separately bill for "reading" the results.'
            },
            {
              q: 'What is the correct unit calculation for CPT 95165?',
              a: '1 unit of 95165 = 1 dose. A standard multidose vial contains 10 doses = 10 units. A full 3-vial build-up set might be ~30 units. Medicare\'s 1,800 unit/year limit translates to roughly 180 vials. Document units dispensed per visit.'
            },
            {
              q: 'Can a nurse practitioner or PA perform allergy testing under general supervision?',
              a: 'For Medicare, allergy skin testing requires DIRECT supervision (physician in office suite, immediately available). An NP or PA cannot perform the testing under general supervision for Medicare. State scope of practice laws may differ — consult your compliance team.'
            },
            {
              q: 'Our Medicaid patient also has Medicare — how do we bill?',
              a: 'Bill Medicare primary first. Medicare will process and send an Explanation of Benefits (EOB). Then bill Medicaid as secondary with the Medicare EOB. Medicaid typically pays the patient liability portion. Do not write off balances before submitting to secondary payers.'
            },
            {
              q: 'What ICD-10 codes are typically required for allergy testing?',
              a: 'Common codes: J30.1 (seasonal rhinitis, tree pollen), J30.2 (seasonal rhinitis, unspec.), J30.9 (allergic rhinitis, unspec.), J45.20-J45.51 (allergic asthma), L50.0 (allergic urticaria), T78.1XXA (food allergy), L23.x (allergic contact dermatitis). Use the most specific code supported by documentation.'
            },
            {
              q: 'How long must we retain allergy testing documentation?',
              a: 'CMS requires Medicare records be retained for 7 years. Virginia state law requires patient records for 10 years from the last treatment date (or until the patient turns 18, whichever is longer). Maintain both allergy test results and immunotherapy injection logs.'
            },
            {
              q: 'Can we bill a telehealth visit on the day of allergy injections?',
              a: 'No — not for Medicare. Allergy injection administration (95115/95117) requires an in-person visit. A telehealth E&M on the same day would be denied. You may bill a telehealth follow-up on a DIFFERENT date for medication adjustments or symptom reviews.'
            },
          ].map(({ q, a }, i) => (
            <div key={i} style={{ borderLeft: '3px solid #0d9488', paddingLeft: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', marginBottom: 6 }}>Q: {q}</div>
              <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}><strong>A:</strong> {a}</div>
            </div>
          ))}
        </div>

        <AlertBox type="info">
          <strong>Disclaimer:</strong> This reference guide is for informational purposes only and reflects general
          Medicare/commercial billing guidance as of 2026. Always verify against current payer policies, LCDs, and your
          compliance officer before billing. Coding rules change frequently — subscribe to CMS updates and your MAC newsletter.
        </AlertBox>
      </Section>
    </div>
  );
}
