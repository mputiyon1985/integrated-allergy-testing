export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

interface EvaluateBody {
  patientId?: string
  insuranceType: string
  cptCodes: string[]
  icd10Code?: string
  encounterDate: string
}

interface BillingWarning {
  ruleId: string
  ruleName: string
  message: string
  severity: 'warning'
}

export async function POST(req: NextRequest) {
  try {
    const body: EvaluateBody = await req.json()
    const { insuranceType, cptCodes, icd10Code } = body

    if (!insuranceType || !Array.isArray(cptCodes)) {
      return NextResponse.json(
        { error: 'insuranceType and cptCodes are required' },
        { status: 400 }
      )
    }

    // Load all active rules matching insuranceType or 'all'
    const rules = await prisma.billingRule.findMany({
      where: {
        active: true,
        insuranceType: {
          in: [insuranceType.toLowerCase(), 'all'],
        },
      },
      orderBy: { sortOrder: 'asc' },
    })

    const warnings: BillingWarning[] = []

    for (const rule of rules) {
      if (!rule.cptCode) continue

      // Check if any provided CPT code matches this rule's trigger code
      const cptMatch = cptCodes.includes(rule.cptCode)
      if (!cptMatch) continue

      // If rule requires dx match, skip if no icd10Code provided
      if (rule.requiresDxMatch && !icd10Code) continue

      warnings.push({
        ruleId: rule.id,
        ruleName: rule.name,
        message: rule.warningMessage,
        severity: 'warning',
      })
    }

    return NextResponse.json({ warnings })
  } catch (err) {
    console.error('[BillingRules] evaluate error:', err)
    return NextResponse.json({ error: 'Failed to evaluate billing rules' }, { status: 500 })
  }
}
