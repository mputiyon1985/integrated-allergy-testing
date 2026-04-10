/**
 * @file /api/patients/[id]/photo — Patient photo upload
 * @description
 *   POST — Accepts multipart form data with a `photo` field,
 *          saves to /public/uploads/patients/, stores path in Patient.photoUrl.
 *          Auto-adds photoUrl column if missing.
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { HIPAA_HEADERS } from '@/lib/hipaaHeaders'
import { requirePermission } from '@/lib/api-permissions'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

export const dynamic = 'force-dynamic'

async function ensurePhotoUrlColumn() {
  try {
    const cols = await prisma.$queryRawUnsafe<{ name: string }[]>(
      `SELECT name FROM pragma_table_info('Patient')`
    )
    const hasPhotoUrl = cols.some(c => c.name === 'photoUrl')
    if (!hasPhotoUrl) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Patient" ADD COLUMN photoUrl TEXT`)
    }
  } catch {
    // ignore if already exists or unsupported
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requirePermission(request, 'patients_edit')
  if (denied) return denied

  try {
    const { id } = await params

    // Verify patient exists
    const patientRows = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "Patient" WHERE id=? AND deletedAt IS NULL`, id
    )
    if (!patientRows.length) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404, headers: HIPAA_HEADERS })
    }

    // Ensure column exists
    await ensurePhotoUrlColumn()

    const formData = await request.formData()
    const photo = formData.get('photo') as File | null

    if (!photo) {
      return NextResponse.json({ error: 'No photo file provided' }, { status: 400, headers: HIPAA_HEADERS })
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(photo.type)) {
      return NextResponse.json({ error: 'Invalid file type. Use JPEG, PNG, GIF, or WebP.' }, { status: 400, headers: HIPAA_HEADERS })
    }

    // Validate file size (5MB max)
    if (photo.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Max 5MB.' }, { status: 400, headers: HIPAA_HEADERS })
    }

    const ext = photo.type.split('/')[1].replace('jpeg', 'jpg')
    const filename = `patient-${id}-${Date.now()}.${ext}`
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'patients')

    await mkdir(uploadsDir, { recursive: true })

    const bytes = await photo.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(path.join(uploadsDir, filename), buffer)

    const photoUrl = `/uploads/patients/${filename}`

    // Update patient record
    await prisma.$executeRawUnsafe(
      `UPDATE "Patient" SET photoUrl=?, updatedAt=? WHERE id=?`,
      photoUrl,
      new Date().toISOString(),
      id
    )

    return NextResponse.json({ photoUrl }, { headers: HIPAA_HEADERS })
  } catch (err) {
    console.error('POST /api/patients/[id]/photo error:', err)
    return NextResponse.json({ error: 'Photo upload failed' }, { status: 500, headers: HIPAA_HEADERS })
  }
}
