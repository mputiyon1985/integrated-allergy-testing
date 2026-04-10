'use client';

import { INSURANCE_COLORS, SEVERITY_STYLES } from './types';

export function InsuranceBadge({ type, label }: { type: string; label?: string }) {
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

export function SeverityBadge({ severity }: { severity: string }) {
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

export function CptBadge({ code }: { code?: string }) {
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
