import prisma from '@/lib/db'

export async function log(params: {
  action: string
  entity?: string
  entityId?: string
  patientId?: string
  details?: string
}): Promise<void> {
  try {
    await prisma.auditLog.create({ data: params })
  } catch {
    // non-fatal
  }
}
