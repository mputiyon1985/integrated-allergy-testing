/**
 * Migration: Add billing/signing fields to Encounter table.
 * Run: npx tsx scripts/migrate-encounter-billing.ts
 */
import prisma from '../lib/db'

async function main() {
  const stmts = [
    `ALTER TABLE "Encounter" ADD COLUMN "signedBy" TEXT`,
    `ALTER TABLE "Encounter" ADD COLUMN "signedAt" DATETIME`,
    `ALTER TABLE "Encounter" ADD COLUMN "billedAt" DATETIME`,
    `ALTER TABLE "Encounter" ADD COLUMN "mdAttestation" TEXT`,
    `ALTER TABLE "Encounter" ADD COLUMN "cptSummary" TEXT`,
    `ALTER TABLE "Encounter" ADD COLUMN "diagnosisCode" TEXT`,
  ]

  for (const stmt of stmts) {
    try {
      await prisma.$executeRawUnsafe(stmt)
      console.log('✅', stmt.trim().slice(0, 70))
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('duplicate column') || msg.includes('already exists')) {
        console.log('ℹ️  Already exists, skipping:', stmt.slice(0, 60))
      } else {
        console.log('❌', msg.slice(0, 100))
      }
    }
  }
  console.log('✅ Encounter billing migration complete')
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
