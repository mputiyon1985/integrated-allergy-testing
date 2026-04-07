/**
 * @file lib/audit.ts — HIPAA audit logging helper
 * @description Provides a non-fatal `log()` helper for recording HIPAA-required audit events.
 *   All PHI access and mutations should call this function to ensure compliance.
 *   Failures are swallowed (non-fatal) so audit issues never break core functionality.
 * @usage `import { log } from '@/lib/audit'`
 *         `await log({ action: 'READ', entity: 'Patient', entityId: id, patientId: id })`
 */
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
