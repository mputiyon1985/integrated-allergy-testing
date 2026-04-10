'use client';

import { useState } from 'react';
import { CompaniesTab } from '@/components/insurance/CompaniesTab';
import { CptCodesTab } from '@/components/insurance/CptCodesTab';
import { Icd10CodesTab } from '@/components/insurance/Icd10CodesTab';
import { BusinessRulesTab } from '@/components/insurance/BusinessRulesTab';

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
