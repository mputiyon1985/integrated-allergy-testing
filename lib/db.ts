import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

// Use a getter pattern so DATABASE_URL is read at request time, not module load time
let _prisma: PrismaClient | null = null

function getPrisma(): PrismaClient {
  if (_prisma) return _prisma

  const url = process.env.DATABASE_URL
  const authToken = process.env.DATABASE_AUTH_TOKEN

  if (!url) {
    throw new Error('DATABASE_URL environment variable is not set')
  }

  const adapterConfig = authToken ? { url, authToken } : { url }
  const adapter = new PrismaLibSql(adapterConfig)
  _prisma = new PrismaClient({ adapter, log: [] })
  return _prisma
}

// Proxy object that lazily initializes Prisma on first use
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma()
    const value = (client as unknown as Record<string | symbol, unknown>)[prop]
    if (typeof value === 'function') {
      return value.bind(client)
    }
    return value
  }
})

export default prisma
