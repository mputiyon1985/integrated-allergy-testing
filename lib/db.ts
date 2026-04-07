import { PrismaClient } from '@/app/generated/prisma'
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

globalForPrisma.prisma = prisma

export default prisma
