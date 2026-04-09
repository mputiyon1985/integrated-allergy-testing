/**
 * @file /api/migrate — Runtime schema migration for Turso/LibSQL
 * @description Creates InsuranceCompany and BillingRule tables if they don't exist,
 *   seeds default data, and is safe to call multiple times (idempotent).
 * @security Requires x-migrate-key header matching MIGRATE_KEY env var (or fallback)
 */
export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

const MIGRATE_KEY = process.env.MIGRATE_KEY ?? 'iat-migrate-2026'

export async function POST(req: NextRequest) {
  const key = req.headers.get('x-migrate-key')
  if (key !== MIGRATE_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: string[] = []

  try {
    // ── 1. InsuranceCompany table ─────────────────────────────────────────────
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "InsuranceCompany" (
        "id"        TEXT    NOT NULL PRIMARY KEY,
        "name"      TEXT    NOT NULL,
        "type"      TEXT    NOT NULL DEFAULT 'commercial',
        "payerId"   TEXT,
        "phone"     TEXT,
        "fax"       TEXT,
        "website"   TEXT,
        "planTypes" TEXT,
        "notes"     TEXT,
        "active"    INTEGER NOT NULL DEFAULT 1,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `
    results.push('InsuranceCompany table: OK')

    // ── 2. BillingRule table ─────────────────────────────────────────────────
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "BillingRule" (
        "id"                    TEXT    NOT NULL PRIMARY KEY,
        "name"                  TEXT    NOT NULL,
        "description"           TEXT,
        "insuranceType"         TEXT    NOT NULL DEFAULT 'all',
        "ruleType"              TEXT    NOT NULL,
        "cptCode"               TEXT,
        "relatedCptCode"        TEXT,
        "maxUnits"              INTEGER,
        "requiresModifier"      TEXT,
        "requiresDxMatch"       INTEGER NOT NULL DEFAULT 0,
        "warningMessage"        TEXT    NOT NULL,
        "severity"              TEXT    NOT NULL DEFAULT 'warning',
        "overrideRequiresAdmin" INTEGER NOT NULL DEFAULT 0,
        "active"                INTEGER NOT NULL DEFAULT 1,
        "sortOrder"             INTEGER NOT NULL DEFAULT 0,
        "createdAt"             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `
    results.push('BillingRule table: OK')

    // Add missing columns if table pre-existed without them
    const billingRuleColumns = [
      { col: 'severity',              sql: `ALTER TABLE "BillingRule" ADD COLUMN "severity" TEXT NOT NULL DEFAULT 'warning'` },
      { col: 'overrideRequiresAdmin', sql: `ALTER TABLE "BillingRule" ADD COLUMN "overrideRequiresAdmin" INTEGER NOT NULL DEFAULT 0` },
      { col: 'updatedAt',             sql: `ALTER TABLE "BillingRule" ADD COLUMN "updatedAt" TEXT DEFAULT '2026-01-01 00:00:00'` },
    ]
    for (const { col, sql } of billingRuleColumns) {
      try {
        await prisma.$executeRawUnsafe(sql)
        results.push(`BillingRule.${col}: added`)
      } catch { results.push(`BillingRule.${col}: already exists`) }
    }
    // Backfill updatedAt with createdAt for any rows that don't have it
    try {
      await prisma.$executeRaw`UPDATE "BillingRule" SET "updatedAt" = "createdAt" WHERE "updatedAt" = '2026-01-01 00:00:00'`
      results.push('BillingRule.updatedAt: backfilled')
    } catch { results.push('BillingRule.updatedAt backfill: skipped') }

    // ── 3. Seed InsuranceCompanies ────────────────────────────────────────────
    const insurers = [
      { id: 'ins-medicare',   name: 'Medicare',                          type: 'medicare',    payerId: null,    sortOrder: 1 },
      { id: 'ins-medicaid-va',name: 'Medicaid Virginia',                 type: 'medicaid',    payerId: null,    sortOrder: 2 },
      { id: 'ins-bcbs-va',    name: 'BlueCross BlueShield of Virginia',  type: 'bcbs',        payerId: '00570', sortOrder: 3 },
      { id: 'ins-aetna',      name: 'Aetna',                             type: 'aetna',       payerId: '60054', sortOrder: 4 },
      { id: 'ins-united',     name: 'United Healthcare',                 type: 'united',      payerId: '87726', sortOrder: 5 },
      { id: 'ins-cigna',      name: 'Cigna',                             type: 'cigna',       payerId: '62308', sortOrder: 6 },
      { id: 'ins-humana',     name: 'Humana',                            type: 'commercial',  payerId: '61101', sortOrder: 7 },
      { id: 'ins-tricare',    name: 'Tricare',                           type: 'tricare',     payerId: 'OHMMD', sortOrder: 8 },
      { id: 'ins-anthem',     name: 'Anthem',                            type: 'bcbs',        payerId: '00423', sortOrder: 9 },
      { id: 'ins-kaiser',     name: 'Kaiser Permanente',                 type: 'commercial',  payerId: null,    sortOrder: 10 },
      { id: 'ins-wellcare',   name: 'WellCare',                          type: 'commercial',  payerId: null,    sortOrder: 11 },
      { id: 'ins-molina',     name: 'Molina Healthcare',                 type: 'medicaid',    payerId: null,    sortOrder: 12 },
    ]

    for (const ins of insurers) {
      await prisma.$executeRaw`
        INSERT OR IGNORE INTO "InsuranceCompany"
          ("id","name","type","payerId","active","sortOrder","createdAt","updatedAt")
        VALUES
          (${ins.id}, ${ins.name}, ${ins.type}, ${ins.payerId}, 1, ${ins.sortOrder},
           CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `
    }
    results.push(`InsuranceCompany: seeded ${insurers.length} rows`)

    // ── 4. Seed BillingRules ──────────────────────────────────────────────────
    type RuleSeed = {
      id: string; name: string; description: string; insuranceType: string
      ruleType: string; cptCode: string | null; relatedCptCode: string | null
      maxUnits: number | null; requiresModifier: string | null
      requiresDxMatch: number; warningMessage: string
      severity: string; overrideRequiresAdmin: number; sortOrder: number
    }
    const rules: RuleSeed[] = [
      {
        id: 'rule-001',
        name: 'Medicare: No SPT + IDT Same Day',
        description: 'Medicare does not allow 95004 and 95024 to be billed on the same date of service.',
        insuranceType: 'medicare', ruleType: 'same_day_conflict',
        cptCode: '95004', relatedCptCode: '95024',
        maxUnits: null, requiresModifier: null, requiresDxMatch: 0,
        warningMessage: 'Medicare: CPT 95004 and 95024 cannot be billed on the same date of service.',
        severity: 'hard_block', overrideRequiresAdmin: 1, sortOrder: 1,
      },
      {
        id: 'rule-002',
        name: 'Medicare: E&M Same Day Requires Modifier 25',
        description: 'When billing an E&M (99213/99214) on the same day as allergy testing, Modifier 25 is required.',
        insuranceType: 'medicare', ruleType: 'requires_modifier',
        cptCode: '99213', relatedCptCode: null,
        maxUnits: null, requiresModifier: '25', requiresDxMatch: 0,
        warningMessage: 'Medicare: Modifier 25 required on E&M code (99213/99214) when billed same day as allergy testing.',
        severity: 'warning', overrideRequiresAdmin: 0, sortOrder: 2,
      },
      {
        id: 'rule-003',
        name: 'Medicare: Allergy Serum Max 1800 Units/Year',
        description: 'CPT 95165 (allergy serum) is limited to 1800 units per year for Medicare patients.',
        insuranceType: 'medicare', ruleType: 'max_units',
        cptCode: '95165', relatedCptCode: null,
        maxUnits: 1800, requiresModifier: null, requiresDxMatch: 0,
        warningMessage: 'Medicare: CPT 95165 has a 1,800 unit/year maximum. Verify patient has not exceeded annual limit.',
        severity: 'hard_block', overrideRequiresAdmin: 1, sortOrder: 3,
      },
      {
        id: 'rule-004',
        name: 'Medicare: Immunotherapy Lifetime Antigen Limit',
        description: 'Medicare limits antigen preparation (95165) to a lifetime of 5 years of therapy.',
        insuranceType: 'medicare', ruleType: 'lifetime_limit',
        cptCode: '95165', relatedCptCode: null,
        maxUnits: null, requiresModifier: null, requiresDxMatch: 0,
        warningMessage: 'Medicare: Verify patient has not exceeded 5-year lifetime limit for allergy immunotherapy.',
        severity: 'warning', overrideRequiresAdmin: 0, sortOrder: 4,
      },
      {
        id: 'rule-005',
        name: 'Medicare: Allergy Testing Requires Dx',
        description: 'Allergy testing codes must be paired with a valid ICD-10 allergy diagnosis code.',
        insuranceType: 'medicare', ruleType: 'dx_required',
        cptCode: '95004', relatedCptCode: null,
        maxUnits: null, requiresModifier: null, requiresDxMatch: 1,
        warningMessage: 'Medicare: An ICD-10 allergy diagnosis code (J30.x, L50.x, etc.) is required for allergy testing CPT codes.',
        severity: 'hard_block', overrideRequiresAdmin: 0, sortOrder: 5,
      },
      {
        id: 'rule-006',
        name: 'Medicare: Allergy Immunotherapy Prior Auth',
        description: 'Some Medicare Advantage plans require prior authorization for allergy immunotherapy.',
        insuranceType: 'medicare', ruleType: 'prior_auth',
        cptCode: '95165', relatedCptCode: null,
        maxUnits: null, requiresModifier: null, requiresDxMatch: 0,
        warningMessage: 'Medicare Advantage: Prior authorization may be required for allergy immunotherapy (CPT 95165). Verify with plan.',
        severity: 'warning', overrideRequiresAdmin: 0, sortOrder: 6,
      },
      {
        id: 'rule-007',
        name: 'Medicaid VA: Allergy Testing Requires Specialist Referral',
        description: 'Virginia Medicaid requires a specialist referral before allergy testing can be billed.',
        insuranceType: 'medicaid', ruleType: 'specialist_required',
        cptCode: '95004', relatedCptCode: null,
        maxUnits: null, requiresModifier: null, requiresDxMatch: 0,
        warningMessage: 'VA Medicaid: A specialist referral is required before allergy testing. Verify referral is on file.',
        severity: 'warning', overrideRequiresAdmin: 0, sortOrder: 7,
      },
      {
        id: 'rule-008',
        name: 'Medicare: Direct Supervision Required for Allergy Testing',
        description: 'Medicare requires direct physician supervision (physician in office suite) for allergy skin testing.',
        insuranceType: 'medicare', ruleType: 'supervision',
        cptCode: '95004', relatedCptCode: null,
        maxUnits: null, requiresModifier: null, requiresDxMatch: 0,
        warningMessage: 'Medicare: Physician must be present in the office suite (direct supervision) during allergy skin testing.',
        severity: 'hard_block', overrideRequiresAdmin: 1, sortOrder: 8,
      },
      {
        id: 'rule-009',
        name: 'BCBS: Allergy Testing Documentation Requirements',
        description: 'BCBS requires specific clinical documentation to support medical necessity for allergy testing.',
        insuranceType: 'bcbs', ruleType: 'documentation',
        cptCode: '95004', relatedCptCode: null,
        maxUnits: null, requiresModifier: null, requiresDxMatch: 0,
        warningMessage: 'BCBS: Ensure chart documents failed conservative therapy (antihistamines) before allergy testing to support medical necessity.',
        severity: 'warning', overrideRequiresAdmin: 0, sortOrder: 9,
      },
      {
        id: 'rule-010',
        name: 'Commercial: No Unbundling Allergy Injections',
        description: 'Do not bill 95115 (single injection) and 95117 (multiple injections) on the same day.',
        insuranceType: 'commercial', ruleType: 'unbundling',
        cptCode: '95115', relatedCptCode: '95117',
        maxUnits: null, requiresModifier: null, requiresDxMatch: 0,
        warningMessage: 'Commercial: CPT 95115 and 95117 cannot be billed on the same date — use 95117 for multiple injections.',
        severity: 'warning', overrideRequiresAdmin: 0, sortOrder: 10,
      },
      {
        id: 'rule-011',
        name: 'Tricare: Allergy Testing Prior Authorization Required',
        description: 'Tricare requires prior authorization for allergy skin testing beyond initial evaluation.',
        insuranceType: 'tricare', ruleType: 'prior_auth',
        cptCode: '95004', relatedCptCode: null,
        maxUnits: null, requiresModifier: null, requiresDxMatch: 0,
        warningMessage: 'Tricare: Prior authorization required for allergy skin testing (95004/95024). Obtain PA before testing.',
        severity: 'warning', overrideRequiresAdmin: 0, sortOrder: 11,
      },
      {
        id: 'rule-012',
        name: 'All Payers: Modifier 59 for Distinct Procedural Services',
        description: 'Modifier 59 is required when billing two procedures that are not normally reported together on the same day.',
        insuranceType: 'all', ruleType: 'requires_modifier',
        cptCode: '95117', relatedCptCode: '95004',
        maxUnits: null, requiresModifier: '59', requiresDxMatch: 0,
        warningMessage: 'All Payers: Modifier 59 (distinct procedure) required when allergy injection and testing are billed same day.',
        severity: 'warning', overrideRequiresAdmin: 0, sortOrder: 12,
      },
      {
        id: 'rule-013',
        name: 'Aetna: Allergy Serum Max 120 Doses',
        description: 'Aetna limits allergy immunotherapy to 120 doses (vials) per course of treatment.',
        insuranceType: 'aetna', ruleType: 'max_units',
        cptCode: '95165', relatedCptCode: null,
        maxUnits: 120, requiresModifier: null, requiresDxMatch: 0,
        warningMessage: 'Aetna: CPT 95165 limited to 120 doses per course of immunotherapy. Verify patient has not exceeded limit.',
        severity: 'warning', overrideRequiresAdmin: 0, sortOrder: 13,
      },
      {
        id: 'rule-014',
        name: 'United Healthcare: Intradermal Requires Failed SPT',
        description: 'UHC requires documentation that percutaneous testing (SPT) was performed and failed before intradermal testing.',
        insuranceType: 'united', ruleType: 'documentation',
        cptCode: '95024', relatedCptCode: null,
        maxUnits: null, requiresModifier: null, requiresDxMatch: 0,
        warningMessage: 'United Healthcare: Documentation of failed percutaneous testing (95004) is required before billing intradermal testing (95024).',
        severity: 'warning', overrideRequiresAdmin: 0, sortOrder: 14,
      },
      {
        id: 'rule-015',
        name: 'Medicare: No Telehealth for Allergy Injections',
        description: 'Medicare does not cover allergy injection administration via telehealth — in-person visit required.',
        insuranceType: 'medicare', ruleType: 'in_person_required',
        cptCode: '95115', relatedCptCode: null,
        maxUnits: null, requiresModifier: null, requiresDxMatch: 0,
        warningMessage: 'Medicare: Allergy injections (95115/95117) require in-person visit. Telehealth is not covered for injection administration.',
        severity: 'hard_block', overrideRequiresAdmin: 0, sortOrder: 15,
      },
    ]

    for (const r of rules) {
      await prisma.$executeRaw`
        INSERT OR IGNORE INTO "BillingRule"
          ("id","name","description","insuranceType","ruleType","cptCode","relatedCptCode",
           "maxUnits","requiresModifier","requiresDxMatch","warningMessage",
           "severity","overrideRequiresAdmin","active","sortOrder","createdAt","updatedAt")
        VALUES
          (${r.id}, ${r.name}, ${r.description}, ${r.insuranceType}, ${r.ruleType},
           ${r.cptCode}, ${r.relatedCptCode}, ${r.maxUnits}, ${r.requiresModifier},
           ${r.requiresDxMatch}, ${r.warningMessage},
           ${r.severity}, ${r.overrideRequiresAdmin}, 1, ${r.sortOrder},
           CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `
    }

    // Update severity on existing rules if they were seeded before columns existed
    const severityUpdates: { id: string; severity: string; overrideRequiresAdmin: number }[] = [
      { id: 'rule-001', severity: 'hard_block', overrideRequiresAdmin: 1 },
      { id: 'rule-003', severity: 'hard_block', overrideRequiresAdmin: 1 },
      { id: 'rule-005', severity: 'hard_block', overrideRequiresAdmin: 0 },
      { id: 'rule-008', severity: 'hard_block', overrideRequiresAdmin: 1 },
      { id: 'rule-015', severity: 'hard_block', overrideRequiresAdmin: 0 },
    ]
    for (const u of severityUpdates) {
      await prisma.$executeRaw`
        UPDATE "BillingRule" SET "severity"=${u.severity}, "overrideRequiresAdmin"=${u.overrideRequiresAdmin}
        WHERE "id"=${u.id}
      `
    }

    results.push(`BillingRule: seeded ${rules.length} rules`)
    results.push('All migrations complete ✓')

    return NextResponse.json({ ok: true, results })
  } catch (err) {
    console.error('[migrate] error:', err)
    return NextResponse.json({ error: String(err), results }, { status: 500 })
  }
}
