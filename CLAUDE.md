# CLAUDE.md — Integrated Allergy Testing

## What this project is
Clinical allergy testing workflow application. Tablet-kiosk for patient registration + two-panel allergy testing (prick + intradermal) + consent forms + PDF generation. Also includes a self-service patient kiosk (/kiosk) for check-in, video education, and digital consent.

## Tech Stack
- Next.js 15 (App Router), TypeScript, Tailwind CSS
- Prisma 7 + SQLite (dev) / Turso libSQL (prod)
- JWT auth via jose (proxy.ts handles middleware)
- PDF generation: jsPDF
- Signature capture: HTML5 Canvas (finger/stylus)
- Deployed: Vercel

## Auth
- `proxy.ts` at root — NAMED export `export async function proxy(...)` — NOT default export
- Cookie: `iat_session`
- Public paths: /login, /api/auth, /consent, /api/seed, /api/allergens/seed, /_next
- `/kiosk/*` is fully public — no session required; patients self-identify via DOB + first name

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
Patient, Doctor, Nurse, Location, Allergen, AllergyTestResult, Video, VideoActivity, Form, FormActivity, AuditLog, StaffUser, WaitingRoom, ConsentRecord

### WaitingRoom
Tracks patients who have completed kiosk check-in. Fields: patientId, patientName, status (waiting/in-service/complete), checkedInAt, videosWatched, videoAckBy, videoAckAt, nurseId.

### ConsentRecord
Stores signed consent forms captured via kiosk or legacy consent flow. Fields: patientId, formId, signedAt, signature (base64 PNG), ipAddress, userAgent, version.

## Route Map

### Kiosk Routes (Public — no auth)
| Route | Description |
|---|---|
| /kiosk | DOB entry — start of check-in flow |
| /kiosk/verify | Identity confirm (first name match) |
| /kiosk/register | New patient registration wizard |
| /kiosk/update-info | Contact/insurance update (if info missing) |
| /kiosk/videos | Educational video player |
| /kiosk/consent | Digital signature consent forms |
| /kiosk/done | Check-in complete; auto-resets after 10s |

### Kiosk API Routes (Public)
| Route | Methods | Notes |
|---|---|---|
| /api/kiosk/lookup | POST | DOB lookup |
| /api/kiosk/check-in | POST | Add patient to WaitingRoom |
| /api/kiosk/consent | GET, POST | Check/record consent signatures |
| /api/kiosk/videos | GET, POST | Check/record video activity |

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
| /api/waiting-room | GET | Session | Nurse waiting room view |
| /api/waiting-room/[id] | PUT | Session | Update waiting room status |
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
- `/kiosk/*` bypasses JWT enforcement — no cookies set or read

## Audit Logging Requirements
- All PHI reads should log `READ` events
- All PHI mutations log `CREATE` / `UPDATE` events
- Consent signing logs `CONSENT_SIGNED`
- PDF generation logs `PDF_GENERATED`
- Login events log `LOGIN_SUCCESS` / `LOGIN_FAILED` / `LOGIN_RATE_LIMITED`
