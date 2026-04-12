'use client';

import { Encounter } from './types';
import { ENC_STATUS_STYLES } from './constants';

export interface ClaimTabProps {
  encounter: Encounter;
  encounterId: string;
  claim: Record<string, unknown> | null;
  claimLoading: boolean;
  claimError: string;
  loadClaim: () => void;
  onEncounterStatusChange: (status: string) => void;
}

function fmtTime(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const h = d.getHours() % 12 || 12;
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m} ${d.getHours() >= 12 ? 'PM' : 'AM'}`;
}

function fmtDateTime(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + fmtTime(iso);
}

function fmtCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function StatusBadge({ status }: { status: string }) {
  const s = ENC_STATUS_STYLES[status] ?? ENC_STATUS_STYLES.open;
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
      background: s.bg, color: s.color, textTransform: 'uppercase' as const, whiteSpace: 'nowrap' as const,
    }}>{s.label}</span>
  );
}

export function ClaimTab({
  encounter,
  encounterId,
  claim,
  claimLoading,
  claimError,
  loadClaim,
  onEncounterStatusChange,
}: ClaimTabProps) {
  const claimData = claim as {
    claimId?: string;
    diagnosisCode?: string;
    diagnosisDescription?: string;
    cptCodes?: { code: string; description: string; units: number; fee: number; total: number }[];
    patient?: { name?: string; dob?: string; insuranceProvider?: string; groupNumber?: string; memberId?: string };
    provider?: { name?: string; npi?: string; dateOfService?: string; location?: string };
    totalCharges?: number;
  } | null;

  function downloadClaimJson() {
    if (!claimData) return;
    const blob = new Blob([JSON.stringify(claim, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `claim-${claimData.claimId ?? 'unknown'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function markAsSubmitted() {
    try {
      await fetch(`/api/encounters/${encounterId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'complete' }),
      });
      onEncounterStatusChange('complete');
    } catch {}
  }

  return (
    <div>
      {/* Warning: not yet signed */}
      {(encounter.status === 'open' || encounter.status === 'awaiting_md') && (
        <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 10, padding: '14px 20px', color: '#92400e', fontSize: 14, marginBottom: 16 }}>
          ⚠️ Encounter must be signed before generating a claim. Change the status to <strong>Signed</strong> or <strong>Awaiting MD</strong> first.
        </div>
      )}

      {/* Loading spinner */}
      {claimLoading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 12 }}>
          <div className="spinner" />
          <span style={{ fontSize: 14, color: '#64748b' }}>Generating claim…</span>
        </div>
      )}

      {/* Error state */}
      {!claimLoading && claimError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '16px 20px', color: '#b91c1c', fontSize: 14, display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
          <span>🚨 {claimError}</span>
          <button onClick={loadClaim} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#b91c1c', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
            ↺ Retry
          </button>
        </div>
      )}

      {/* Claim card */}
      {!claimLoading && !claimError && claimData && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', maxWidth: 800, margin: '0 auto' }}>
          {/* Header row */}
          <div style={{ background: '#1e293b', color: '#fff', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700 }}>💳 CMS-1500 CLAIM</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {claimData.claimId && <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#94a3b8' }}>{claimData.claimId}</span>}
              <StatusBadge status={encounter.status} />
            </div>
          </div>

          {/* Two-column patient/provider */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, padding: 24 }}>
            {/* Patient */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Patient Information</div>
              {[
                ['Name', claimData.patient?.name],
                ['Date of Birth', claimData.patient?.dob],
                ['Insurance Provider', claimData.patient?.insuranceProvider],
                ['Group #', claimData.patient?.groupNumber],
                ['Member ID', claimData.patient?.memberId],
              ].map(([lbl, val]) => (
                <div key={lbl as string} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{lbl}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2233' }}>{val ?? '—'}</div>
                </div>
              ))}
            </div>

            {/* Provider */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Provider Information</div>
              {[
                ['Provider Name', claimData.provider?.name],
                ['NPI', claimData.provider?.npi],
                ['Date of Service', claimData.provider?.dateOfService],
                ['Location', claimData.provider?.location],
              ].map(([lbl, val]) => (
                <div key={lbl as string} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{lbl}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a2233' }}>{val ?? '—'}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Diagnosis */}
          <div style={{ borderTop: '1px solid #f1f5f9', padding: '16px 24px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Diagnosis Code</div>
            <div style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 700, color: '#1a2233' }}>
              {claimData.diagnosisCode ?? encounter.diagnosisCode ?? '—'}
              {claimData.diagnosisDescription && (
                <span style={{ fontFamily: 'sans-serif', fontSize: 13, fontWeight: 400, color: '#64748b', marginLeft: 12 }}>{claimData.diagnosisDescription}</span>
              )}
            </div>
          </div>

          {/* CPT Codes */}
          {claimData.cptCodes && claimData.cptCodes.length > 0 && (
            <div style={{ borderTop: '1px solid #f1f5f9', padding: '16px 24px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Procedure Codes (CPT)</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    {['Code', 'Description', 'Units', 'Fee', 'Total'].map(h => (
                      <th key={h} style={{ textAlign: h === 'Units' || h === 'Fee' || h === 'Total' ? 'right' : 'left', padding: '4px 8px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {claimData.cptCodes.map((cpt, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontWeight: 700, color: '#1a2233' }}>{cpt.code}</td>
                      <td style={{ padding: '6px 8px', color: '#374151' }}>{cpt.description}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: '#374151' }}>{cpt.units}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: '#374151' }}>{fmtCurrency(cpt.fee)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, color: '#1a2233' }}>{fmtCurrency(cpt.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid #e2e8f0' }}>
                    <td colSpan={3} />
                    <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 700, fontSize: 12, color: '#64748b', textTransform: 'uppercase' }}>Total Charges</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 800, fontSize: 15, color: '#1a2233' }}>
                      {fmtCurrency(claimData.totalCharges ?? (claimData.cptCodes?.reduce((s, c) => s + (c.total ?? 0), 0) ?? 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Actions footer */}
          <div style={{ borderTop: '1px solid #e2e8f0', padding: '16px 24px', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              onClick={downloadClaimJson}
              style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#7c3aed', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              ⬇ Download JSON
            </button>
            <button
              onClick={() => window.print()}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#374151', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              🖨 Print
            </button>
            {encounter.status !== 'complete' && (
              <button
                onClick={markAsSubmitted}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#15803d', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                ✅ Mark as Submitted
              </button>
            )}
          </div>
        </div>
      )}

      {/* Prompt to load if status is signed/billed but no claim yet and not loading */}
      {!claimLoading && !claimError && !claimData && encounter.status !== 'open' && encounter.status !== 'awaiting_md' && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>💳</div>
          <div style={{ fontSize: 14, marginBottom: 16 }}>Generate a CMS-1500 claim for this encounter.</div>
          <button
            onClick={loadClaim}
            style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: '#0d9488', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          >
            Generate Claim
          </button>
        </div>
      )}
    </div>
  );
}
