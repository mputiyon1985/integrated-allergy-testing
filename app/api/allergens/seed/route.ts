import { NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

const ALLERGENS: { name: string; category: string }[] = [
  // Pollen
  { name: 'Timothy Grass', category: 'pollen' },
  { name: 'Bermuda Grass', category: 'pollen' },
  { name: 'Kentucky Blue Grass', category: 'pollen' },
  { name: 'Ragweed', category: 'pollen' },
  { name: 'Mountain Cedar', category: 'pollen' },
  { name: 'Elm', category: 'pollen' },
  { name: 'Oak', category: 'pollen' },
  { name: 'Birch', category: 'pollen' },
  { name: 'Maple', category: 'pollen' },
  { name: 'Ash', category: 'pollen' },
  // Mold
  { name: 'Alternaria', category: 'mold' },
  { name: 'Aspergillus', category: 'mold' },
  { name: 'Cladosporium', category: 'mold' },
  { name: 'Penicillium', category: 'mold' },
  // Dust
  { name: 'Dust Mite (Dermatophagoides farinae)', category: 'dust' },
  { name: 'Dust Mite (Dermatophagoides pteronyssinus)', category: 'dust' },
  { name: 'Cockroach', category: 'dust' },
  // Animal
  { name: 'Cat', category: 'animal' },
  { name: 'Dog', category: 'animal' },
  { name: 'Horse', category: 'animal' },
  { name: 'Mouse', category: 'animal' },
  // Food
  { name: 'Peanut', category: 'food' },
  { name: 'Tree Nut Mix', category: 'food' },
  { name: 'Shellfish Mix', category: 'food' },
  { name: 'Egg White', category: 'food' },
  { name: 'Milk', category: 'food' },
]

export async function POST() {
  try {
    const count = await prisma.allergen.count()

    if (count > 0) {
      return NextResponse.json({
        message: 'Allergens already seeded',
        skipped: true,
        count,
      })
    }

    const created = await prisma.allergen.createMany({
      data: ALLERGENS,
    })

    return NextResponse.json({
      message: 'Allergens seeded successfully',
      count: created.count,
    }, { status: 201 })
  } catch (error) {
    console.error('POST /api/allergens/seed error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
