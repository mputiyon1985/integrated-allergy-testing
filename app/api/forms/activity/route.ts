import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      patientId?: string
      formId?: string
      signedAt?: string
      signature?: string
      printedAt?: string
      emailedAt?: string
    }

    const { patientId, formId } = body

    if (!patientId || !formId) {
      return NextResponse.json(
        { error: 'patientId and formId are required' },
        { status: 400 }
      )
    }

    const activity = await prisma.formActivity.create({
      data: {
        patientId,
        formId,
        signedAt: body.signedAt ? new Date(body.signedAt) : null,
        signature: body.signature,
        printedAt: body.printedAt ? new Date(body.printedAt) : null,
        emailedAt: body.emailedAt ? new Date(body.emailedAt) : null,
      },
      include: {
        form: true,
        patient: {
          select: {
            id: true,
            patientId: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    return NextResponse.json(activity, { status: 201 })
  } catch (error) {
    console.error('POST /api/forms/activity error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
