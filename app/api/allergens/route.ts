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

    // Use raw SQL to avoid Prisma type mismatch on deletedAt (stored as INTEGER in Turso)
    const conditions: string[] = [];
    if (!showDeleted) conditions.push('deletedAt IS NULL');
    if (testingOnly) conditions.push('showOnTestingScreen = 1');
    if (prickOnly) conditions.push('showOnPrickTest = 1');
    if (intradermalOnly) conditions.push('showOnIntradermalTest = 1');

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT id, name, type, manufacturer, lotNumber, stockConc, expiresAt, showOnTestingScreen, showOnPrickTest, showOnIntradermalTest, createdAt, deletedAt FROM Allergen ${where} ORDER BY id ASC`;

    const result = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(sql);

    // Normalize boolean fields (SQLite stores as 0/1)
    const allergens = result.map(a => ({
      ...a,
      showOnTestingScreen: Boolean(a.showOnTestingScreen),
      showOnPrickTest: Boolean(a.showOnPrickTest),
      showOnIntradermalTest: Boolean(a.showOnIntradermalTest),
    }));

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
