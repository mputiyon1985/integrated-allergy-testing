/**
 * @file /api/allergens — Allergen reference list
 * @description Manages the allergen catalog used for allergy testing panels.
 *   GET  — Return all active allergens sorted by type and name.
 *   POST — Create a new allergen entry (name required, type optional).
 * @security Requires authenticated session (iat_session cookie via proxy.ts)
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const testingOnly = req.nextUrl.searchParams.get('testingScreen') === 'true';
    const prickOnly = req.nextUrl.searchParams.get('prickOnly') === 'true';
    const intradermalOnly = req.nextUrl.searchParams.get('intradermalOnly') === 'true';
    const showDeleted = req.nextUrl.searchParams.get('showDeleted') === 'true';
    const allergens = await prisma.allergen.findMany({
      where: {
        ...(showDeleted ? {} : { deletedAt: null }),
        ...(testingOnly ? { showOnTestingScreen: true } : {}),
        ...(prickOnly ? { showOnPrickTest: true } : {}),
        ...(intradermalOnly ? { showOnIntradermalTest: true } : {}),
      },
      orderBy: [{ id: 'asc' }],
    })

    return NextResponse.json(allergens)
  } catch (error) {
    console.error('GET /api/allergens error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { name?: string; type?: string; showOnPrickTest?: boolean; showOnIntradermalTest?: boolean }
    const { name, type, showOnPrickTest, showOnIntradermalTest } = body

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const allergen = await prisma.allergen.create({
      data: {
        name,
        ...(type ? { type } : {}),
        ...(showOnPrickTest !== undefined && { showOnPrickTest }),
        ...(showOnIntradermalTest !== undefined && { showOnIntradermalTest }),
      },
    })

    return NextResponse.json(allergen, { status: 201 })
  } catch (error) {
    console.error('POST /api/allergens error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
