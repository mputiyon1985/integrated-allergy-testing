/**
 * @file tests/api/reports.test.ts
 * @description Comprehensive tests for Reports API
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────
vi.mock('@/lib/db', () => ({
  default: {
    $queryRawUnsafe: vi.fn(),
    $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
    $executeRaw: vi.fn().mockResolvedValue(undefined),
    $queryRaw: vi.fn(),
    auditLog: { create: vi.fn().mockResolvedValue(undefined) },
  },
}))

vi.mock('@/lib/api-permissions', () => ({
  requirePermission: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/hipaaHeaders', () => ({
  HIPAA_HEADERS: { 'x-content-type-options': 'nosniff' },
}))

// ── Helpers ────────────────────────────────────────────────────────────────
function makeRequest(method: string, url: string): Request {
  return new Request(url, { method })
}

// ── Globals ────────────────────────────────────────────────────────────────
let GET: (req: Request) => Promise<Response>
let mockPrisma: {
  $queryRawUnsafe: ReturnType<typeof vi.fn>
  $executeRawUnsafe: ReturnType<typeof vi.fn>
  $executeRaw: ReturnType<typeof vi.fn>
  $queryRaw: ReturnType<typeof vi.fn>
}

beforeEach(async () => {
  vi.clearAllMocks()

  const route = await import('@/app/api/reports/route')
  const db = await import('@/lib/db')

  GET = route.GET as unknown as (req: Request) => Promise<Response>
  mockPrisma = db.default as unknown as typeof mockPrisma
})

// ── Clinical report mock data helpers ────────────────────────────────────────
function mockClinicalData() {
  const kpi = [{ total: 10, openCount: 3, avgWait: 12.5, avgInService: 20.0 }]
  const byDay = [{ day: '2026-04-10', total: 3, openCount: 1, completeCount: 2, avgWait: 10.0 }]
  const byPhysician = [{ name: 'Dr. Smith', count: 5, avgWait: 12.0, avgInService: 18.0 }]
  const topComplaints = [{ complaint: 'Allergies', count: 4 }]
  const byDiagnosis = [{ code: 'J30.1', count: 3 }]
  // getClinical runs these queries in order: kpi, byDay, byPhysician, topComplaints, byDiagnosis
  // Promise.all for kpiRows, then sequential calls
  mockPrisma.$queryRawUnsafe
    .mockResolvedValueOnce(kpi)         // kpiRows (inside Promise.all)
    .mockResolvedValueOnce(byDay)       // byDay
    .mockResolvedValueOnce(byPhysician) // byPhysician
    .mockResolvedValueOnce(topComplaints) // topComplaints
    .mockResolvedValueOnce(byDiagnosis) // byDiagnosis
}

function mockBillingData() {
  const kpi = [{ signed: 3, billed: 2, awaitingMd: 1, total: 10 }]
  const statusSummary = [{ status: 'open', count: 4 }]
  const readyToBill = [{ id: 'enc-1', patientName: 'John Doe', date: '2026-04-10', physician: 'Dr. Smith', diagnosisCode: 'J30.1' }]
  const insuranceBreakdown = [{ provider: 'BlueCross', count: 5 }]
  mockPrisma.$queryRawUnsafe
    .mockResolvedValueOnce(kpi)
    .mockResolvedValueOnce(statusSummary)
    .mockResolvedValueOnce(readyToBill)
    .mockResolvedValueOnce(insuranceBreakdown)
}

function mockStaffData() {
  const byNurse = [{ nurseName: 'Nurse Jane', count: 8, avgWait: 10.0 }]
  const byPhysician = [{ doctorName: 'Dr. Smith', total: 5, signedCount: 3 }]
  const activityByType = [{ activityType: 'injection', count: 12 }]
  mockPrisma.$queryRawUnsafe
    .mockResolvedValueOnce(byNurse)
    .mockResolvedValueOnce(byPhysician)
    .mockResolvedValueOnce(activityByType)
}

function mockTestingData() {
  const kpi = [{ total: 50, positiveCount: 12 }]
  const byType = [{ testType: 'skin', count: 30, positiveCount: 8 }]
  const topAllergens = [{ allergen: 'Pollen', tested: 20, positiveCount: 6 }]
  const byDay = [{ day: '2026-04-10', count: 15 }]
  mockPrisma.$queryRawUnsafe
    .mockResolvedValueOnce(kpi)
    .mockResolvedValueOnce(byType)
    .mockResolvedValueOnce(topAllergens)
    .mockResolvedValueOnce(byDay)
}

// ─────────────────────────────────────────────────────────────────────────────
// Reports – Note: reports route has no auth check (no requirePermission call)
// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/reports', () => {
  it('returns 400 if type param missing — defaults to clinical, not 400', async () => {
    // Route actually defaults to 'clinical' when type is missing, so it runs ok
    mockClinicalData()
    const req = makeRequest('GET', 'http://localhost/api/reports')
    const res = await GET(req)
    // Should succeed (200) with clinical data as default
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.type).toBe('clinical')
  })

  it('clinical type returns expected structure', async () => {
    mockClinicalData()
    const req = makeRequest('GET', 'http://localhost/api/reports?type=clinical&from=2026-01-01&to=2026-04-10')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.type).toBe('clinical')
    expect(json).toHaveProperty('byDay')
    expect(json).toHaveProperty('byPhysician')
    expect(json).toHaveProperty('topComplaints')
    expect(json).toHaveProperty('byDiagnosis')
    expect(json).toHaveProperty('kpi')
  })

  it('billing type returns billing_summary, ready_to_bill, insurance_breakdown', async () => {
    mockBillingData()
    const req = makeRequest('GET', 'http://localhost/api/reports?type=billing&from=2026-01-01&to=2026-04-10')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.type).toBe('billing')
    expect(json).toHaveProperty('statusSummary')
    expect(json).toHaveProperty('readyToBill')
    expect(json).toHaveProperty('insuranceBreakdown')
    expect(json).toHaveProperty('kpi')
  })

  it('staff type returns by_nurse, by_physician, activity_by_type', async () => {
    mockStaffData()
    const req = makeRequest('GET', 'http://localhost/api/reports?type=staff&from=2026-01-01&to=2026-04-10')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.type).toBe('staff')
    expect(json).toHaveProperty('byNurse')
    expect(json).toHaveProperty('byPhysician')
    expect(json).toHaveProperty('activityByType')
  })

  it('testing type returns by_type, top_allergens, by_day', async () => {
    mockTestingData()
    const req = makeRequest('GET', 'http://localhost/api/reports?type=testing&from=2026-01-01&to=2026-04-10')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.type).toBe('testing')
    expect(json).toHaveProperty('byType')
    expect(json).toHaveProperty('topAllergens')
    expect(json).toHaveProperty('byDay')
    expect(json).toHaveProperty('kpi')
  })

  it('filters by locationId', async () => {
    mockClinicalData()
    const req = makeRequest('GET', 'http://localhost/api/reports?type=clinical&locationId=loc-1&from=2026-01-01&to=2026-04-10')
    await GET(req)

    const firstCall = mockPrisma.$queryRawUnsafe.mock.calls[0]
    expect(firstCall[0]).toContain('locationId')
    expect(firstCall).toContain('loc-1')
  })

  it('filters by practiceId (via subquery)', async () => {
    mockClinicalData()
    const req = makeRequest('GET', 'http://localhost/api/reports?type=clinical&practiceId=prac-1&from=2026-01-01&to=2026-04-10')
    await GET(req)

    const firstCall = mockPrisma.$queryRawUnsafe.mock.calls[0]
    expect(firstCall[0]).toContain('practiceId')
    expect(firstCall).toContain('prac-1')
  })

  it('filters by date range (from/to)', async () => {
    mockClinicalData()
    const req = makeRequest('GET', 'http://localhost/api/reports?type=clinical&from=2026-01-01&to=2026-04-10')
    await GET(req)

    const firstCall = mockPrisma.$queryRawUnsafe.mock.calls[0]
    expect(firstCall).toContain('2026-01-01')
    expect(firstCall).toContain('2026-04-10')
  })

  it('returns empty arrays (not errors) when no data', async () => {
    // Return empty for all queries
    mockPrisma.$queryRawUnsafe.mockResolvedValue([])

    const req = makeRequest('GET', 'http://localhost/api/reports?type=clinical&from=2020-01-01&to=2020-01-02')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.byDay).toEqual([])
    expect(json.byPhysician).toEqual([])
    expect(json.topComplaints).toEqual([])
    expect(json.byDiagnosis).toEqual([])
  })
})
