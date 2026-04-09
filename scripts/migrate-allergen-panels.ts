/**
 * One-time migration: Add showOnPrickTest and showOnIntradermalTest columns to Allergen table.
 * Run: npx tsx scripts/migrate-allergen-panels.ts
 */
import prisma from '../lib/db'

async function main() {
  console.log('Adding showOnPrickTest and showOnIntradermalTest columns to Allergen...')

  for (const stmt of [
    `ALTER TABLE "Allergen" ADD COLUMN "showOnPrickTest" INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE "Allergen" ADD COLUMN "showOnIntradermalTest" INTEGER NOT NULL DEFAULT 0`,
  ]) {
    try {
      await prisma.$executeRawUnsafe(stmt)
      console.log(`✅ Executed: ${stmt.slice(0, 60)}...`)
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('duplicate column name')) {
        console.log('ℹ️  Column already exists, skipping')
      } else {
        throw err
      }
    }
  }

  console.log('✅ Migration complete')
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
