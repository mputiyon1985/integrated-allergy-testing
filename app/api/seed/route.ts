/**
 * @file /api/seed — Full database seeder
 * @description Seeds the database with initial reference data for a fresh deployment.
 *   POST — Creates location, doctor, sample videos, form templates, and allergens. Idempotent.
 * @security Public route — used during initial setup only
 */
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

// Allow GET for easy browser-based seeding
export async function GET(request: NextRequest) {
  return POST(request)
}

export async function POST(request: NextRequest) {
  try {
    // Check if DB is already seeded
    const locationCount = await prisma.location.count()
    if (locationCount > 0) {
      return NextResponse.json({
        message: 'Database already seeded',
        skipped: true,
      })
    }

    // 1. Create location
    const location = await prisma.location.create({
      data: {
        name: 'Integrated Allergy Testing',
        key: 'IAT-001',
        street: '123 Medical Drive',
        city: 'Dumfries',
        state: 'VA',
        zip: '22026',
      },
    })

    // 2. Create doctor
    await prisma.doctor.create({
      data: {
        name: 'Dr. Robert Sikora',
        clinicLocation: location.name,
      },
    })

    // 3. Create videos
    await prisma.video.createMany({
      data: [
        {
          title: 'Welcome to Integrated Allergy',
          description: 'An introduction to Integrated Allergy Testing and our services.',
          url: 'https://example.com/videos/welcome',
          category: 'what',
          order: 1,
        },
        {
          title: 'Understanding Allergy Testing',
          description: 'Learn about the science behind allergy testing and what to expect.',
          url: 'https://example.com/videos/understanding',
          category: 'why',
          order: 2,
        },
        {
          title: 'What to Expect During Testing',
          description: 'A step-by-step walkthrough of the allergy testing process.',
          url: 'https://example.com/videos/expect',
          category: 'how',
          order: 3,
        },
      ],
    })

    // 4. Create forms
    await prisma.form.createMany({
      data: [
        {
          name: 'Patient Consent Form',
          type: 'consent',
          template: '<h1>Patient Consent Form</h1><p>I hereby consent to allergy testing procedures as recommended by my physician...</p>',
        },
        {
          name: 'Allergy Testing Form',
          type: 'testing',
          template: '<h1>Allergy Testing Form</h1><p>Please complete all sections of this form prior to your allergy testing appointment...</p>',
        },
      ],
    })

    // 5. Seed allergens via the allergens/seed route
    const baseUrl = request.nextUrl.origin
    const allergenSeedResponse = await fetch(`${baseUrl}/api/allergens/seed`, {
      method: 'POST',
    })
    const allergenResult = await allergenSeedResponse.json() as { count?: number; message?: string }

    return NextResponse.json({
      message: 'Database seeded successfully',
      location: location.name,
      allergens: allergenResult,
    }, { status: 201 })
  } catch (error) {
    console.error('POST /api/seed error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
