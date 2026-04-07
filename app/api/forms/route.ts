import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const forms = await prisma.form.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(forms)
  } catch (error) {
    console.error('GET /api/forms error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      name?: string
      type?: string
      template?: string
    }

    const { name, type, template } = body

    if (!name || !type || !template) {
      return NextResponse.json(
        { error: 'name, type, and template are required' },
        { status: 400 }
      )
    }

    const form = await prisma.form.create({
      data: { name, type, template },
    })

    return NextResponse.json(form, { status: 201 })
  } catch (error) {
    console.error('POST /api/forms error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
