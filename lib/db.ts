/**
 * @file lib/db.ts — Prisma client singleton for Turso/LibSQL
 *
 * @description
 * Exports a single shared PrismaClient instance that works with both local SQLite
 * (dev) and Turso remote databases (staging/production) via the libsql adapter.
 *
 * The singleton pattern (globalForPrisma) prevents new connections from being
 * created on every module load during Next.js hot reload in development, and
 * ensures warm serverless Lambda invocations reuse the existing connection pool
 * rather than creating a new one on each request.
 *
 * Configuration:
 * - DATABASE_URL: libsql:// URL for Turso (or file:./prisma/dev.db for local dev)
 * - DATABASE_AUTH_TOKEN: Turso auth token (not required for local file databases)
 *
 * @example
 * import prisma from '@/lib/db';
 * const patients = await prisma.patient.findMany({ where: { deletedAt: null } });
 */
import { PrismaClient } from '@/app/generated/prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createPrismaClient() {
  const url = process.env.DATABASE_URL ?? 'file:./prisma/dev.db'
  const authToken = process.env.DATABASE_AUTH_TOKEN

  // Pass auth token to PrismaLibSql for Turso remote databases
  const adapterConfig = authToken ? { url, authToken } : { url }
  const adapter = new PrismaLibSql(adapterConfig)
  // log: [] suppresses verbose query/info logs in production
  return new PrismaClient({ adapter, log: [] })
}

// Singleton: reuse the client across warm serverless invocations in all environments.
// Without this, every cold start in production creates a new connection pool.
export const prisma = globalForPrisma.prisma ?? createPrismaClient()

// Always persist to global (not just dev) so Vercel warm lambdas reuse the connection.
globalForPrisma.prisma = prisma

export default prisma
