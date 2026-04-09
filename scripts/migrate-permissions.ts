/**
 * One-time migration: Add `permissions` column to StaffUser table.
 * Run: npx tsx scripts/migrate-permissions.ts
 */
import prisma from '../lib/db'

async function main() {
  console.log('Adding permissions column to StaffUser...')
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "StaffUser" ADD COLUMN "permissions" TEXT`)
    console.log('✅ Column added successfully')
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('duplicate column name')) {
      console.log('ℹ️  Column already exists, skipping')
    } else {
      throw err
    }
  }

  // Also add mfaEnabled and mfaSecret if missing (may not exist in Turso)
  for (const stmt of [
    `ALTER TABLE "StaffUser" ADD COLUMN "mfaEnabled" BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE "StaffUser" ADD COLUMN "mfaSecret" TEXT`,
    `ALTER TABLE "StaffUser" ADD COLUMN "tempToken" TEXT`,
    `ALTER TABLE "StaffUser" ADD COLUMN "tempTokenExpiry" DATETIME`,
    `ALTER TABLE "StaffUser" ADD COLUMN "defaultLocationId" TEXT`,
  ]) {
    try {
      await prisma.$executeRawUnsafe(stmt)
    } catch {
      // ignore if already exists
    }
  }

  console.log('✅ Migration complete')
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
