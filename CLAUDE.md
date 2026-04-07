# CLAUDE.md — Integrated Allergy Testing

## What this project is
Clinical allergy testing workflow application. Tablet-kiosk for patient registration + two-panel allergy testing (prick + intradermal) + consent forms + PDF generation.

## Tech Stack
- Next.js 15 (App Router), TypeScript, Tailwind CSS
- Prisma 7 + SQLite (dev) / Turso libSQL (prod)
- JWT auth via jose (proxy.ts handles middleware)
- PDF generation: jsPDF
- Deployed: Vercel

## Auth
- `proxy.ts` at root — NAMED export `export async function proxy(...)` — NOT default export
- Cookie: `iat_session`
- Public paths: /login, /api/auth, /consent, /api/seed, /api/allergens/seed, /_next

## Key Conventions
- All API routes: `export const dynamic = 'force-dynamic'`
- HIPAA headers on PHI responses: import from `@/lib/hipaaHeaders`
- Audit logging: import `log` from `@/lib/audit`
- DB: import `prisma` from `@/lib/db`
- No hard deletes — soft delete only (deletedAt field)

## Database
- SQLite in dev (prisma/dev.db)
- Prisma migrations in prisma/migrations/
- Schema: prisma/schema.prisma

## Key Models
Patient, Doctor, Nurse, Location, Allergen, AllergyTestResult, Video, VideoActivity, Form, FormActivity, AuditLog, StaffUser

## API Route Map
| Route | Methods | Auth | Notes |
|---|---|---|---|
| /api/auth/login | POST | Public | Rate-limited (5/15min) |
| /api/auth/logout | POST | Session | Clears cookie |
| /api/auth/me | GET | Session | Returns current user |
| /api/patients | GET, POST | Session | PHI — HIPAA headers required |
| /api/patients/[id] | GET, PUT | Session | PHI — HIPAA headers required |
| /api/test-results | GET, POST | Session | PHI — HIPAA headers required |
| /api/test-results/[id] | PUT | Session | Update reaction/wheal |
| /api/forms | GET, POST | Session | Form templates |
| /api/forms/activity | POST | Session | Consent signing |
| /api/forms/pdf | GET | Session | PHI — HIPAA headers required |
| /api/allergens | GET, POST | Session | Reference data |
| /api/doctors | GET, POST | Session | Reference data |
| /api/locations | GET, POST | Session | Reference data |
| /api/videos | GET, POST | Session | Education videos |
| /api/videos/activity | POST | Session | Watch tracking |
| /api/audit | GET | Session | HIPAA audit log |
| /api/staff | GET, POST | Admin only | Staff management |
| /api/seed | POST | Public | Dev seed — idempotent |
| /api/allergens/seed | POST | Public | Allergen seed — idempotent |

## Security Architecture
- `proxy.ts` intercepts every request before routing
- Unauthenticated API calls → 401 JSON response
- Unauthenticated page visits → redirect to /login
- JWT payload carries `userId` and `role` — forwarded as `x-user-id` and `x-user-role` headers
- All PHI responses include `HIPAA_HEADERS` (Cache-Control: no-store, X-Frame-Options: DENY, etc.)

## Audit Logging Requirements
- All PHI reads should log `READ` events
- All PHI mutations log `CREATE` / `UPDATE` events
- Consent signing logs `CONSENT_SIGNED`
- PDF generation logs `PDF_GENERATED`
- Login events log `LOGIN_SUCCESS` / `LOGIN_FAILED` / `LOGIN_RATE_LIMITED`
