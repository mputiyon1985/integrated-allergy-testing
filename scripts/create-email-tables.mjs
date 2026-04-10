/**
 * Creates EmailTemplate, EmailLog, and SystemSetting tables in Turso DB
 */
import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

const sql = [
  `CREATE TABLE IF NOT EXISTS EmailTemplate (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    category TEXT,
    active INTEGER DEFAULT 1,
    createdAt TEXT NOT NULL DEFAULT '',
    updatedAt TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS EmailLog (
    id TEXT PRIMARY KEY,
    patientId TEXT,
    patientEmail TEXT NOT NULL,
    subject TEXT NOT NULL,
    templateId TEXT,
    status TEXT DEFAULT 'pending',
    errorMessage TEXT,
    sentAt TEXT,
    createdAt TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS SystemSetting (
    key TEXT PRIMARY KEY,
    value TEXT,
    updatedAt TEXT NOT NULL DEFAULT ''
  )`,
];

for (const stmt of sql) {
  console.log('Running:', stmt.slice(0, 60) + '...');
  await client.execute(stmt);
  console.log('  ✅ Done');
}

console.log('\n✅ Email tables created successfully!');
client.close();
