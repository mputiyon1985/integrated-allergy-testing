/**
 * Migration: Create MaintenanceVial and MaintenanceShot tables.
 * Run: npx tsx scripts/migrate-maintenance.ts
 */
import prisma from '../lib/db'

async function main() {
  const stmts = [
    `CREATE TABLE IF NOT EXISTS "MaintenanceVial" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "patientId" TEXT NOT NULL,
      "vialMode" TEXT NOT NULL DEFAULT 'single',
      "label" TEXT NOT NULL DEFAULT 'Set A',
      "currentDose" REAL NOT NULL DEFAULT 0.4,
      "maxDose" REAL NOT NULL DEFAULT 0.5,
      "concentration" TEXT NOT NULL DEFAULT '1:1',
      "intervalWeeks" INTEGER NOT NULL DEFAULT 4,
      "lastShotDate" DATETIME,
      "nextDueDate" DATETIME,
      "expiresAt" DATETIME,
      "active" INTEGER NOT NULL DEFAULT 1,
      "notes" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("patientId") REFERENCES "Patient"("id")
    )`,
    `CREATE TABLE IF NOT EXISTS "MaintenanceShot" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "vialId" TEXT NOT NULL,
      "patientId" TEXT NOT NULL,
      "doseGiven" REAL NOT NULL DEFAULT 0.4,
      "arm" TEXT NOT NULL DEFAULT 'Left',
      "reaction" INTEGER NOT NULL DEFAULT 0,
      "reactionNotes" TEXT,
      "givenBy" TEXT,
      "givenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "waitMinutes" INTEGER NOT NULL DEFAULT 30,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("vialId") REFERENCES "MaintenanceVial"("id")
    )`,
    `CREATE INDEX IF NOT EXISTS "MaintenanceVial_patientId_idx" ON "MaintenanceVial"("patientId")`,
    `CREATE INDEX IF NOT EXISTS "MaintenanceShot_vialId_idx" ON "MaintenanceShot"("vialId")`,
    `CREATE INDEX IF NOT EXISTS "MaintenanceShot_patientId_idx" ON "MaintenanceShot"("patientId")`,
    `CREATE INDEX IF NOT EXISTS "MaintenanceShot_givenAt_idx" ON "MaintenanceShot"("givenAt")`,
  ]

  for (const stmt of stmts) {
    try {
      await prisma.$executeRawUnsafe(stmt)
      console.log('✅', stmt.trim().slice(0, 70))
    } catch (e: unknown) {
      console.log('ℹ️ ', e instanceof Error ? e.message.slice(0, 80) : e)
    }
  }
  console.log('✅ Maintenance migration complete')
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
