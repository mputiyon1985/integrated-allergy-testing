'use client';

import React from 'react';

/* ─── Types ─────────────────────────────────────────────────────── */

export type Location = 'Back' | 'LA' | 'RA' | 'LE' | 'RE';

export interface AllergenEntry {
  allergenId: string;
  allergenName: string;
  category: string;
  grade: number | null; // 0-5
  wheal: string;
  flare: string;
  location: Location;
}

export interface PanelState {
  rows: AllergenEntry[];
}

/* ─── Constants ─────────────────────────────────────────────────── */

export const LOCATIONS: Location[] = ['RA', 'LA', 'Back', 'LE', 'RE'];

export const CATEGORY_ORDER = [
  'Trees', 'Grasses', 'Weeds', 'Dust Mites', 'Insects', 'Animals', 'Molds', 'Other',
];

// Map DB type → display category
export function typeToCategory(type?: string): string {
  const t = (type ?? '').toLowerCase();
  if (t === 'trees') return 'Trees';
  if (t === 'grasses') return 'Grasses';
  if (t === 'weeds') return 'Weeds';
  if (t === 'dust mites') return 'Dust Mites';
  if (t === 'insects') return 'Insects';
  if (t === 'animals') return 'Animals';
  if (t === 'molds') return 'Molds';
  return 'Other';
}

export const GRADE_COLORS: Record<number, { bg: string; text: string; border: string }> = {
  0: { bg: '#e2e8f0', text: '#475569', border: '#94a3b8' },
  1: { bg: '#fef08a', text: '#713f12', border: '#ca8a04' },
  2: { bg: '#fed7aa', text: '#7c2d12', border: '#ea580c' },
  3: { bg: '#fca5a5', text: '#7f1d1d', border: '#dc2626' },
  4: { bg: '#ef4444', text: '#fff',    border: '#b91c1c' },
  5: { bg: '#7f1d1d', text: '#fff',    border: '#450a0a' },
};

export function rowBg(grade: number | null, idx: number): string {
  if (grade !== null && grade >= 2) return grade >= 4 ? '#fff1f2' : '#fffbeb';
  return idx % 2 === 0 ? '#fff' : '#f0f9ff';
}

export const colHdr: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: '#64748b',
  letterSpacing: '0.05em', textTransform: 'uppercase',
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
};

export const numInput: React.CSSProperties = {
  width: '100%', height: 22, fontSize: 13, textAlign: 'center',
  border: '1px solid #cbd5e1', borderRadius: 3, padding: '1px 2px',
  background: '#fff', color: '#1a2233',
};

/* ─── GradeCell ─────────────────────────────────────────────────── */

export function GradeCell({ grade, onChange, locked, size = 22 }: { grade: number | null; onChange: (g: number | null) => void; locked?: boolean; size?: number }) {
  return (
    <div style={{ display: 'flex', gap: 1 }} title={locked ? 'Select a nurse before recording results' : undefined}>
      {[0, 1, 2, 3, 4, 5].map(n => {
        const selected = grade === n;
        const c = GRADE_COLORS[n];
        return (
          <button
            key={n}
            onClick={() => !locked && onChange(selected ? null : n)}
            title={locked ? 'Select a nurse first' : `Grade ${n}`}
            style={{
              width: size, height: size, borderRadius: 3,
              border: `1.5px solid ${locked ? '#e2e8f0' : selected ? c.border : '#cbd5e1'}`,
              background: locked ? '#f8fafc' : selected ? c.bg : '#fff',
              color: locked ? '#d1d5db' : selected ? c.text : '#94a3b8',
              fontSize: 10, fontWeight: 700,
              cursor: locked ? 'not-allowed' : 'pointer', padding: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.1s',
              flexShrink: 0,
              opacity: locked ? 0.5 : 1,
            }}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

/* ─── TestPanel ─────────────────────────────────────────────────── */

export function TestPanel({
  title,
  color,
  state,
  onChange,
  locked,
  columns = 1,
}: {
  title: string;
  color: string;
  state: PanelState;
  onChange: (rows: AllergenEntry[]) => void;
  locked?: boolean;
  columns?: number;
}) {
  function updateRow(allergenId: string, field: keyof Omit<AllergenEntry, 'allergenId' | 'allergenName' | 'category'>, value: unknown) {
    onChange(state.rows.map(r => r.allergenId === allergenId ? { ...r, [field]: value } : r));
  }

  // Group by category in defined order
  const grouped = new Map<string, AllergenEntry[]>();
  for (const cat of CATEGORY_ORDER) grouped.set(cat, []);
  for (const row of state.rows) {
    const cat = CATEGORY_ORDER.includes(row.category) ? row.category : 'Other';
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(row);
  }

  // Compute sequential # across all rows
  let rowNum = 0;

  // Flatten all rows with sequential numbers (for multi-column layout)
  const allRows: { cat: string; row: AllergenEntry; num: number }[] = [];
  let n = 0;
  for (const cat of CATEGORY_ORDER) {
    for (const row of grouped.get(cat) ?? []) {
      n++;
      allRows.push({ cat, row, num: n });
    }
  }
  const perCol = Math.ceil(allRows.length / columns);

  // Compact column header (used in multi-column mode)
  const compactHdr = (
    <div style={{ display: 'grid', gridTemplateColumns: '16px minmax(60px,1fr) 42px 120px 42px 42px', gap: 1, padding: '2px 4px', background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', position: 'sticky', top: 0 }}>
      {['#', 'Allergen', 'Loc', 'Grade', 'Whl', 'Flr'].map(h => (
        <div key={h} style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const, whiteSpace: 'nowrap' as const, overflow: 'hidden' }}>{h}</div>
      ))}
    </div>
  );

  const renderCompactRow = (entry: { row: AllergenEntry; num: number }, localIdx: number) => {
    const { row, num } = entry;
    const positive = row.grade !== null && row.grade >= 2;
    const bg = rowBg(row.grade, localIdx);
    return (
      <div key={row.allergenId} className={row.grade === null ? 'untested-row' : ''}
        style={{ display: 'grid', gridTemplateColumns: '16px minmax(60px,1fr) 42px 120px 42px 42px', gap: 1, padding: '2px 4px', background: bg, borderBottom: '1px solid #f1f5f9', alignItems: 'center', outline: positive ? '1px solid #fed7aa' : 'none' }}>
        <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center' as const, fontWeight: 600 }}>{num}</div>
        <div style={{ fontSize: 13, fontWeight: positive ? 700 : 400, color: positive ? '#7c2d12' : '#1a2233', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{row.allergenName}</div>
        <select value={row.location} onChange={e => updateRow(row.allergenId, 'location', e.target.value as Location)}
          style={{ fontSize: 12, border: '1px solid #cbd5e1', borderRadius: 3, padding: '0 2px', background: '#fff', color: '#374151', width: '100%', height: 22, cursor: 'pointer' }}>
          {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <GradeCell grade={row.grade} onChange={g => updateRow(row.allergenId, 'grade', g)} locked={locked} size={18} />
        <input type="number" min="0" max="99" step="0.1" value={row.wheal} onChange={e => updateRow(row.allergenId, 'wheal', e.target.value)} placeholder="mm"
          style={{ width: '100%', height: 22, fontSize: 13, textAlign: 'center' as const, border: '1px solid #cbd5e1', borderRadius: 3, padding: '0 2px', background: '#fff' }} />
        <input type="number" min="0" max="99" step="0.1" value={row.flare} onChange={e => updateRow(row.allergenId, 'flare', e.target.value)} placeholder="mm"
          style={{ width: '100%', height: 22, fontSize: 13, textAlign: 'center' as const, border: '1px solid #cbd5e1', borderRadius: 3, padding: '0 2px', background: '#fff' }} />
      </div>
    );
  };

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Panel header */}
      <div style={{
        background: color, color: '#fff', padding: '6px 12px',
        fontSize: 12, fontWeight: 700, letterSpacing: '0.06em',
        textTransform: 'uppercase', borderRadius: '6px 6px 0 0',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span>{title === 'Prick Test' ? '🩹' : '💉'}</span>
        {title}
      </div>

      {/* Column headers — only shown in single-column mode */}
      {columns === 1 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '16px minmax(60px,1fr) 42px 120px 42px 42px',
          gap: 1, padding: '2px 4px',
          background: '#f1f5f9',
          borderLeft: '1px solid #e2e8f0',
          borderRight: '1px solid #e2e8f0',
          borderBottom: '1px solid #cbd5e1',
          position: 'sticky', top: 0, zIndex: 10,
        }}>
          <div style={colHdr}>#</div>
          <div style={colHdr}>Allergen</div>
          <div style={colHdr}>Loc</div>
          <div style={{ ...colHdr, textAlign: 'center' }}>Grade (0–5)</div>
          <div style={{ ...colHdr, textAlign: 'center' }}>Wheal</div>
          <div style={{ ...colHdr, textAlign: 'center' }}>Flare</div>
        </div>
      )}

      {/* Rows */}
      <div style={{ flex: 1, border: '1px solid #e2e8f0', borderTop: 'none', borderRadius: '0 0 6px 6px', overflow: 'auto' }}>
        {columns > 1 ? (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, height: '100%' }}>
            {Array.from({ length: columns }, (_, colIdx) => {
              const start = colIdx * perCol;
              const colRows = allRows.slice(start, start + perCol);
              return (
                <div key={colIdx} style={{ borderRight: colIdx < columns - 1 ? '2px solid #cbd5e1' : 'none', display: 'flex', flexDirection: 'column' }}>
                  {compactHdr}
                  {colRows.map((entry, i) => {
                    const prevCat = i > 0 ? colRows[i - 1].cat : null;
                    const showCatHeader = entry.cat !== prevCat;
                    return (
                      <div key={entry.row.allergenId}>
                        {showCatHeader && (
                          <div style={{ background: '#1e293b', color: '#e2e8f0', padding: '2px 6px', fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                            {entry.cat}
                          </div>
                        )}
                        {renderCompactRow(entry, i)}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ) : (
          Array.from(grouped.entries()).map(([cat, rows]) => {
            if (rows.length === 0) return null;
            return (
              <div key={cat}>
                {/* Category header */}
                <div style={{
                  background: '#0d9488', color: '#fff',
                  padding: '3px 8px', fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.05em', textTransform: 'uppercase',
                }}>
                  {cat}
                </div>
                {rows.map((row, localIdx) => {
                  rowNum++;
                  const num = rowNum;
                  const positive = row.grade !== null && row.grade >= 2;
                  const bg = rowBg(row.grade, localIdx);
                  return (
                    <div
                      key={row.allergenId}
                      className={row.grade === null ? 'untested-row' : ''}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '16px minmax(60px,1fr) 42px 120px 42px 42px',
                        gap: 1, padding: '2px 4px',
                        background: bg,
                        borderBottom: '1px solid #f1f5f9',
                        alignItems: 'center',
                        outline: positive ? '1px solid #fed7aa' : 'none',
                      }}
                    >
                      {/* # */}
                      <div style={{ fontSize: 10, color: '#94a3b8', textAlign: 'center', fontWeight: 600 }}>{num}</div>
                      {/* Name */}
                      <div style={{ fontSize: 13, fontWeight: positive ? 700 : 400, color: positive ? '#7c2d12' : '#1a2233', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} className="allergen-name">
                        {row.allergenName}
                        {row.category && (
                          <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 3 }}>({row.category})</span>
                        )}
                      </div>
                      {/* Location */}
                      <select
                        value={row.location}
                        onChange={e => updateRow(row.allergenId, 'location', e.target.value as Location)}
                        style={{
                          fontSize: 11, border: '1px solid #cbd5e1', borderRadius: 3,
                          padding: '1px 2px', background: '#fff', color: '#374151',
                          width: '100%', height: 22, cursor: 'pointer',
                        }}
                      >
                        {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                      {/* Grade */}
                      <GradeCell
                        grade={row.grade}
                        onChange={g => updateRow(row.allergenId, 'grade', g)}
                        locked={locked}
                      />
                      {/* Wheal */}
                      <input
                        type="number" min="0" max="99" step="0.1"
                        value={row.wheal}
                        onChange={e => updateRow(row.allergenId, 'wheal', e.target.value)}
                        placeholder="mm"
                        style={numInput}
                      />
                      {/* Flare */}
                      <input
                        type="number" min="0" max="99" step="0.1"
                        value={row.flare}
                        onChange={e => updateRow(row.allergenId, 'flare', e.target.value)}
                        placeholder="mm"
                        style={numInput}
                      />
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
