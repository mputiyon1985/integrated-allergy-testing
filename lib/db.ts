/**
 * Prisma client singleton for Next.js / serverless environments.
 * Uses libSQL adapter for both local SQLite (dev) and Turso (prod).
 */
import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createPrismaClient() {
  const url = process.env.DATABASE_URL ?? 'file:./prisma/dev.db'
  const authToken = process.env.DATABASE_AUTH_TOKEN

  const adapterConfig = authToken ? { url, authToken } : { url }
  const adapter = new PrismaLibSql(adapterConfig)
  return new PrismaClient({ adapter, log: [] })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
