import { createClient } from '@libsql/client'

const client = createClient({
  url: 'libsql://integrated-allergy-mputiyon1985.aws-us-east-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzQ0NzU1NzAsImlkIjoiMDE5ZDI2ZmMtMGIwMS03MzVmLThkODEtNWRlYzA1ZmI2MGQyIiwicmlkIjoiYjYwYjg5NzMtNGJlYy00MGNiLThkYjItOTIyNzExN2M0OWJjIn0.S91wj7247eU8omocZwiZhBkQ7BUSOtI0vlUXTmY2rFzwEYInAw0e9Nk7OfRWWFESusL1TuxZsrUnsxDRL_G_AA'
})

async function run() {
  // Create table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS PracticeInsurance (
      id           TEXT NOT NULL PRIMARY KEY,
      practiceId   TEXT NOT NULL,
      insuranceId  TEXT NOT NULL,
      sortOrder    INTEGER NOT NULL DEFAULT 0,
      createdAt    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(practiceId, insuranceId)
    )
  `)
  console.log('Table created OK')

  // Seed
  const result = await client.execute(`
    INSERT OR IGNORE INTO PracticeInsurance (id, practiceId, insuranceId, sortOrder, createdAt)
    SELECT 'pi-' || id, 'practice-001', id, sortOrder, CURRENT_TIMESTAMP FROM InsuranceCompany WHERE active=1
  `)
  console.log('Seeded rows:', result.rowsAffected)

  // Verify
  const rows = await client.execute('SELECT * FROM PracticeInsurance')
  console.log('PracticeInsurance rows:', rows.rows.length)
  rows.rows.forEach(r => console.log(' -', r))
}

run().catch(e => { console.error(e); process.exit(1) })
