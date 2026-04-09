export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

interface EvaluateBody {
  patientId?: string
  insuranceType: string
  cptCodes: string[]
  icd10Code?: string
  encounterDate?: string
}

interface RuleResult {
  ruleId: string
  ruleName: string
  message: string
  severity: 'warning' | 'hard_block' | 'info'
  overrideRequiresAdmin: boolean
  ruleType: string
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
        insuranceType: { in: [insuranceType.toLowerCase(), 'all'] },
      },
      orderBy: { sortOrder: 'asc' },
    })

    const warnings: RuleResult[] = []
    const hardBlocks: RuleResult[] = []

    for (const rule of rules) {
      if (!rule.cptCode) continue

      // Check if any provided CPT code matches this rule's trigger code
      const cptMatch = cptCodes.includes(rule.cptCode)
      if (!cptMatch) continue

      // If rule requires dx match, skip if no icd10Code provided
      if (rule.requiresDxMatch && !icd10Code) continue

      const result: RuleResult = {
        ruleId: rule.id,
        ruleName: rule.name,
        message: rule.warningMessage,
        severity: (rule.severity ?? 'warning') as 'warning' | 'hard_block' | 'info',
        overrideRequiresAdmin: rule.overrideRequiresAdmin ?? false,
        ruleType: rule.ruleType,
      }

      if (rule.severity === 'hard_block') {
        hardBlocks.push(result)
      } else {
        warnings.push(result)
      }
    }

    // canProceed: false if any hard_block exists (admin can override if overrideRequiresAdmin=false,
    // but only the billing system decides — we just report the state)
    const canProceed = hardBlocks.length === 0

    return NextResponse.json({ warnings, hardBlocks, canProceed })
  } catch (err) {
    console.error('[BillingRules] evaluate error:', err)
    return NextResponse.json({ error: 'Failed to evaluate billing rules' }, { status: 500 })
  }
}
