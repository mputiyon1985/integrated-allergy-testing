'use client';

import { useState, useEffect, useCallback } from 'react';

type AllergenType =
  | 'trees' | 'grasses' | 'weeds' | 'molds' | 'animals'
  | 'dust mites' | 'insects' | 'food' | 'other' | string;

interface Allergen {
  id: string;
  name: string;
  type: AllergenType;
  manufacturer?: string | null;
  lotNumber?: string | null;
  stockConc?: string | null;
  expiresAt?: string | null;
  showOnTestingScreen: boolean;
  showOnPrickTest: boolean;
  showOnIntradermalTest: boolean;
  createdAt: string;
  deletedAt?: string | null;
}

const TYPE_BADGES: Record<string, { bg: string; color: string }> = {
  trees:       { bg: '#dcfce7', color: '#15803d' },
  grasses:     { bg: '#ecfccb', color: '#4d7c0f' },
  weeds:       { bg: '#ffedd5', color: '#c2410c' },
  molds:       { bg: '#f3e8ff', color: '#7c3aed' },
  animals:     { bg: '#dbeafe', color: '#1d4ed8' },
  'dust mites':{ bg: '#cffafe', color: '#0e7490' },
  insects:     { bg: '#fef9c3', color: '#a16207' },
  food:        { bg: '#fee2e2', color: '#dc2626' },
  other:       { bg: '#f1f5f9', color: '#475569' },
};

const ALL_TYPES: AllergenType[] = [
  'trees', 'grasses', 'weeds', 'molds', 'animals', 'dust mites', 'insects', 'food', 'other',
];

function TypeBadge({ type }: { type: AllergenType }) {
  const normalized = type?.toLowerCase() ?? 'other';
  const style = TYPE_BADGES[normalized] ?? TYPE_BADGES.other;
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 700,
      background: style.bg,
      color: style.color,
      textTransform: 'capitalize',
      letterSpacing: '0.03em',
      whiteSpace: 'nowrap',
    }}>
      {type ?? 'other'}
    </span>
  );
}

function ToggleSwitch({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      title={checked ? 'Remove from panel' : 'Add to panel'}
      style={{
        width: 40,
        height: 22,
        borderRadius: 999,
        border: 'none',
        background: checked ? '#0d9488' : '#d1d5db',
        position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer',
        padding: 0,
        transition: 'background 0.2s',
        flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute',
        top: 3,
        left: checked ? 20 : 3,
        width: 16,
        height: 16,
        borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.2s',
        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
      }} />
    </button>
  );
}

interface EditModalProps {
  allergen: Allergen;
  onClose: () => void;
  onSaved: () => void;
}

function EditModal({ allergen, onClose, onSaved }: EditModalProps) {
  const [name, setName] = useState(allergen.name);
  const [type, setType] = useState<AllergenType>(allergen.type ?? 'other');
  const [showOnPrickTest, setShowOnPrickTest] = useState(allergen.showOnPrickTest);
  const [showOnIntradermalTest, setShowOnIntradermalTest] = useState(allergen.showOnIntradermalTest);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/allergens/${allergen.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), type, showOnPrickTest, showOnIntradermalTest }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) { setError('Failed to save. Please try again.'); return; }
    onSaved();
    onClose();
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1100,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 20 }}>✏️ Edit Allergen</div>
        {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: '#b91c1c', fontSize: 13 }}>{error}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Name *</label>
            <input
              className="form-input"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Type</label>
            <select className="form-input" value={type} onChange={e => setType(e.target.value)} style={{ width: '100%' }}>
              {ALL_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase' }}>Test Panels</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
              <ToggleSwitch checked={showOnPrickTest} onChange={() => setShowOnPrickTest(v => !v)} />
              <span style={{ fontSize: 13, color: '#374151' }}>💉 Include in Prick Test panel</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
              <ToggleSwitch checked={showOnIntradermalTest} onChange={() => setShowOnIntradermalTest(v => !v)} />
              <span style={{ fontSize: 13, color: '#374151' }}>🩺 Include in Intradermal panel</span>
            </label>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving || !name.trim()}
            style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: saving || !name.trim() ? '#94a3b8' : '#0d9488', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving || !name.trim() ? 'not-allowed' : 'pointer' }}>
            {saving ? '⏳ Saving…' : '💾 Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface AddModalProps {
  onClose: () => void;
  onSaved: () => void;
}

function AddModal({ onClose, onSaved }: AddModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<AllergenType>('other');
  const [showOnPrickTest, setShowOnPrickTest] = useState(false);
  const [showOnIntradermalTest, setShowOnIntradermalTest] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError(null);
    const res = await fetch('/api/allergens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), type, showOnPrickTest, showOnIntradermalTest }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) { setError('Failed to add allergen. Please try again.'); return; }
    onSaved();
    onClose();
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1100,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 20 }}>➕ Add Allergen</div>
        {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: '#b91c1c', fontSize: 13 }}>{error}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Name *</label>
            <input
              className="form-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Mountain Cedar"
              autoFocus
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4, textTransform: 'uppercase' }}>Type</label>
            <select className="form-input" value={type} onChange={e => setType(e.target.value)} style={{ width: '100%' }}>
              {ALL_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase' }}>Test Panels</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
              <ToggleSwitch checked={showOnPrickTest} onChange={() => setShowOnPrickTest(v => !v)} />
              <span style={{ fontSize: 13, color: '#374151' }}>💉 Include in Prick Test panel</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
              <ToggleSwitch checked={showOnIntradermalTest} onChange={() => setShowOnIntradermalTest(v => !v)} />
              <span style={{ fontSize: 13, color: '#374151' }}>🩺 Include in Intradermal panel</span>
            </label>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving || !name.trim()}
            style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: saving || !name.trim() ? '#94a3b8' : '#0d9488', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving || !name.trim() ? 'not-allowed' : 'pointer' }}>
            {saving ? '⏳ Saving…' : '➕ Add Allergen'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AllergensTab() {
  const [allergens, setAllergens] = useState<Allergen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [panelOnly, setPanelOnly] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [editingAllergen, setEditingAllergen] = useState<Allergen | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const url = showDeleted ? '/api/allergens?showDeleted=true' : '/api/allergens';
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAllergens(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load allergens');
    } finally {
      setLoading(false);
    }
  }, [showDeleted]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  async function togglePanel(allergen: Allergen) {
    setTogglingId(allergen.id);
    await fetch(`/api/allergens/${allergen.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ showOnTestingScreen: !allergen.showOnTestingScreen }),
    }).catch(() => {});
    setTogglingId(null);
    load();
  }

  async function togglePrick(allergen: Allergen) {
    setTogglingId(allergen.id);
    await fetch(`/api/allergens/${allergen.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ showOnPrickTest: !allergen.showOnPrickTest }),
    }).catch(() => {});
    setTogglingId(null);
    load();
  }

  async function toggleIntradermal(allergen: Allergen) {
    setTogglingId(allergen.id);
    await fetch(`/api/allergens/${allergen.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ showOnIntradermalTest: !allergen.showOnIntradermalTest }),
    }).catch(() => {});
    setTogglingId(null);
    load();
  }

  async function softDelete(allergen: Allergen) {
    if (!confirm(`Remove "${allergen.name}" from the allergen catalog? You can restore it later.`)) return;
    await fetch(`/api/allergens/${allergen.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deletedAt: new Date().toISOString() }),
    }).catch(() => {});
    load();
  }

  async function restore(allergen: Allergen) {
    await fetch(`/api/allergens/${allergen.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deletedAt: null }),
    }).catch(() => {});
    load();
  }

  // Filter logic
  const filtered = allergens.filter(a => {
    if (panelOnly && !a.showOnTestingScreen) return false;
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (!showDeleted && a.deletedAt) return false;
    if (showDeleted && !a.deletedAt) return false; // in deleted view, only show deleted
    return true;
  });

  // Stats
  const totalActive = allergens.filter(a => !a.deletedAt).length;
  const totalPanel = allergens.filter(a => !a.deletedAt && a.showOnTestingScreen).length;
  const totalPrick = allergens.filter(a => !a.deletedAt && a.showOnPrickTest).length;
  const totalIntradermal = allergens.filter(a => !a.deletedAt && a.showOnIntradermalTest).length;

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="card-title" style={{ marginBottom: 4 }}>🧪 Allergens Management</div>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
            Manage the allergen catalog and control which allergens appear on the testing panel.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#0d9488', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>
          + Add Allergen
        </button>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: '#15803d' }}>
          ✅ {totalPanel} <span style={{ fontWeight: 400, color: '#374151' }}>on panel</span>
        </div>
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: '#1d4ed8' }}>
          💉 {totalPrick} <span style={{ fontWeight: 400, color: '#374151' }}>on Prick panel</span>
        </div>
        <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, color: '#7c3aed' }}>
          🩺 {totalIntradermal} <span style={{ fontWeight: 400, color: '#374151' }}>on Intradermal panel</span>
        </div>
        <div style={{ fontSize: 13, color: '#64748b' }}>
          📋 {totalActive} total allergens
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          className="form-input"
          placeholder="🔍 Search by name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 280 }}
        />

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer', userSelect: 'none' }}>
          <ToggleSwitch checked={panelOnly} onChange={() => { setPanelOnly(v => !v); if (!panelOnly) setShowDeleted(false); }} />
          Panel Only
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#dc2626', cursor: 'pointer', userSelect: 'none' }}>
          <ToggleSwitch checked={showDeleted} onChange={() => { setShowDeleted(v => !v); if (!showDeleted) setPanelOnly(false); }} />
          Show Deleted
        </label>

        <span style={{ fontSize: 13, color: '#94a3b8', marginLeft: 'auto' }}>
          {filtered.length} {filtered.length === 1 ? 'allergen' : 'allergens'} shown
        </span>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#b91c1c', fontSize: 13 }}>
          ⚠️ {error}
          <button onClick={load} style={{ marginLeft: 12, padding: '2px 10px', borderRadius: 6, border: '1px solid #fecaca', background: '#fff', color: '#b91c1c', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>Retry</button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={{ padding: '48px 0', textAlign: 'center', color: '#94a3b8' }}>Loading allergens…</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '48px 0', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
          {search ? `No allergens matching "${search}"` : showDeleted ? 'No deleted allergens.' : panelOnly ? 'No allergens on testing panel.' : 'No allergens found.'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: '#475569', width: 80 }}>On Panel</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: '#1d4ed8', width: 80 }}>💉 Prick</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: '#7c3aed', width: 100 }}>🩺 Intradermal</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Name</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#475569', width: 130 }}>Type</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#475569', width: 130 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((allergen) => {
                const isDeleted = !!allergen.deletedAt;
                const rowBg = isDeleted
                  ? '#fef2f2'
                  : allergen.showOnTestingScreen
                  ? 'rgba(240, 253, 244, 0.8)'
                  : '#fff';

                return (
                  <tr
                    key={allergen.id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      background: rowBg,
                      opacity: isDeleted ? 0.7 : 1,
                    }}
                  >
                    {/* On Panel toggle */}
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      {isDeleted ? (
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>—</span>
                      ) : (
                        <ToggleSwitch
                          checked={allergen.showOnTestingScreen}
                          onChange={() => togglePanel(allergen)}
                          disabled={togglingId === allergen.id}
                        />
                      )}
                    </td>

                    {/* Prick toggle */}
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      {isDeleted ? (
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>—</span>
                      ) : (
                        <ToggleSwitch
                          checked={allergen.showOnPrickTest}
                          onChange={() => togglePrick(allergen)}
                          disabled={togglingId === allergen.id}
                        />
                      )}
                    </td>

                    {/* Intradermal toggle */}
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      {isDeleted ? (
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>—</span>
                      ) : (
                        <ToggleSwitch
                          checked={allergen.showOnIntradermalTest}
                          onChange={() => toggleIntradermal(allergen)}
                          disabled={togglingId === allergen.id}
                        />
                      )}
                    </td>

                    {/* Name */}
                    <td style={{ padding: '10px 12px', fontWeight: isDeleted ? 400 : 500, color: isDeleted ? '#94a3b8' : '#1e293b' }}>
                      {allergen.name}
                      {isDeleted && <span style={{ marginLeft: 8, fontSize: 11, color: '#ef4444', fontWeight: 700 }}>DELETED</span>}
                    </td>

                    {/* Type */}
                    <td style={{ padding: '10px 12px' }}>
                      <TypeBadge type={allergen.type ?? 'other'} />
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {isDeleted ? (
                          <button
                            onClick={() => restore(allergen)}
                            style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#15803d', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                            title="Restore">
                            ♻️ Restore
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => setEditingAllergen(allergen)}
                              style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', fontSize: 12, cursor: 'pointer' }}
                              title="Edit">
                              ✏️
                            </button>
                            <button
                              onClick={() => softDelete(allergen)}
                              style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #fecaca', background: '#fff7f7', fontSize: 12, cursor: 'pointer' }}
                              title="Delete">
                              🗑️
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {editingAllergen && (
        <EditModal
          allergen={editingAllergen}
          onClose={() => setEditingAllergen(null)}
          onSaved={load}
        />
      )}
      {showAddModal && (
        <AddModal
          onClose={() => setShowAddModal(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}
