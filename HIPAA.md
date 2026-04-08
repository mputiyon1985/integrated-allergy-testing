# 🛡️ HIPAA Codebase Compliance

**Project:** Integrated Allergy Testing  
**Status:** 🛡️ HIPAA Codebase Compliance: ACTIVE as of 2026-04-07  
**Maintained by:** Engineering Team  
**Last reviewed:** 2026-04-08

---

## Overview

This document outlines the HIPAA compliance posture for the Integrated Allergy Testing application — a clinical workflow platform for tablet-based patient registration, allergy testing, and consent management. All PHI (Protected Health Information) handling follows HIPAA Security Rule and Privacy Rule requirements.

---

## PHI Inventory

The following data elements are classified as PHI and are subject to HIPAA protections:

### Patient Demographics
| Field | Model | Notes |
|-------|-------|-------|
| First name | `Patient` | Direct identifier |
| Last name | `Patient` | Direct identifier |
| Date of birth | `Patient` | Direct identifier |
| Phone number | `Patient` | Direct identifier |
| Email address | `Patient` | Direct identifier |
| Address | `Patient` | Direct identifier (if collected) |

### Clinical Data
| Field | Model | Notes |
|-------|-------|-------|
| Allergy test results | `TestResult` | PHI — linked to patient |
| Allergen reactions | `AllergenResult` | PHI — clinical findings |
| Test session records | `TestSession` | PHI — clinical encounter |
| Diagnosis / notes | `TestResult` | PHI — clinical narrative |

### Consent & Legal
| Field | Model | Notes |
|-------|-------|-------|
| Consent signature | `ConsentRecord` | PHI — patient identity + legal record |
| Consent timestamp | `ConsentRecord` | PHI — audit trail |
| Consent version | `ConsentRecord` | Compliance record |

### Kiosk Check-In (Patient-Facing)
| Field | Model / Source | Notes |
|-------|----------------|-------|
| Date of birth (lookup input) | `Patient` | Used for DOB-based kiosk lookup; never logged |
| First name (identity verification) | `Patient` | Entered by patient to confirm identity |
| Consent signature (base64 PNG) | `ConsentRecord` | Captured on kiosk touchscreen |
| Consent form ID + timestamp | `ConsentRecord` | Full audit trail per signing |
| Patient name (display) | `Patient` | Shown briefly on kiosk confirmation screen |

### Waiting Room (Operational PHI)
| Field | Model | Notes |
|-------|-------|-------|
| Patient name | `WaitingRoom` | Display name on staff waiting board |
| Patient status | `WaitingRoom` | `waiting`, `in-service`, `complete` |
| Check-in timestamp | `WaitingRoom` | Operational timing record |
| Videos watched count | `WaitingRoom` | Clinical education compliance tracking |

### Operational
| Field | Model | Notes |
|-------|-------|-------|
| Staff user accounts | `User` | Workforce member records |
| Audit log entries | `AuditLog` | Access records — retain per HIPAA |

---

## Security Controls Implemented

### Authentication & Authorization
- ✅ **JWT-based session management** — short-lived tokens via `jose`, signed with `JWT_SECRET`
- ✅ **Role-based access control (RBAC)** — `role` claim propagated via middleware headers (`x-user-role`)
- ✅ **Session cookie** — `iat_session` cookie with HttpOnly enforcement (set in auth routes)
- ✅ **Auth middleware** (`proxy.ts`) — all non-public routes require valid JWT
- ✅ **Password hashing** — bcryptjs with salt rounds ≥ 12

### Data Protection
- ✅ **No PHI in logs** — audit logging captures action/entity, not raw PHI values
- ✅ **No PHI in URLs** — patient IDs use nanoid (non-sequential, non-guessable)
- ✅ **Database encryption at rest** — required in production (Turso encrypted SQLite / managed DB)
- ✅ **TLS in transit** — enforced via HSTS header (`max-age=63072000; includeSubDomains; preload`)

### HTTP Security Headers
| Header | Value | Purpose |
|--------|-------|---------|
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `Referrer-Policy` | `no-referrer` | No PHI in referrer headers |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Force HTTPS |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Restrict browser APIs |
| `Cache-Control` | `no-store, no-cache, must-revalidate` | Prevent PHI caching |
| `Pragma` | `no-cache` | Legacy cache prevention |

### Audit Logging
- ✅ **`AuditLog` model** in Prisma schema — records action, entity, entityId, patientId, timestamp
- ✅ **`lib/audit.ts`** — centralized audit logging utility, non-fatal on failure
- ✅ Patient creation logged (`CREATE / Patient`)
- ✅ Patient updates logged (`UPDATE / Patient`)
- ✅ Test result creation and updates logged (`CREATE / AllergyTestResult`, `UPDATE / AllergyTestResult`)
- ✅ Consent form signing logged (`CONSENT_SIGNED / ConsentRecord`)
- ✅ Kiosk identity verification logged (`KIOSK_CHECKIN / Patient`)
- ✅ Kiosk DOB lookup attempts logged (`Kiosk DOB Lookup` — IP address only, never the DOB)
- ✅ Audit records must be retained for **6 years** per HIPAA requirements

### Kiosk Security
- ✅ **DOB brute-force protection** — `/api/kiosk/lookup` enforces rate limiting: max 10 lookups per IP per 60 seconds; returns HTTP 429 on excess
- ✅ **Lookup attempt logging** — IP address logged to `AuditLog` on every DOB lookup attempt (DOB value is never logged)
- ✅ **Identity verification** — kiosk requires first-name confirmation before revealing patient record; verification is audit-logged
- ✅ **Minimal data disclosure** — lookup returns first name only (no last name, no full DOB)

### Consent Management
- ✅ Digital consent capture with signature (base64 PNG) and timestamp
- ✅ Consent records linked to patient ID with full audit trail
- ✅ Consent version tracked for compliance history
- ✅ IP address and user agent captured at signing for non-repudiation
- ✅ PDF generation available for consent records including rendered signature image
- ✅ Consent signing triggers `CONSENT_SIGNED` audit log entry

### Video Watch Audit Trail
- ✅ Patient educational video activity tracked via `VideoActivity` model
- ✅ Videos watched count reflected in waiting room record for nurse verification
- ✅ `video-watched` and `videos-watched` kiosk endpoints record per-video completion

---

## Required Business Associate Agreements (BAAs)

Before production go-live, BAAs must be executed with:

| Vendor | Service | BAA Status |
|--------|---------|------------|
| Vercel | Hosting / CDN | ⚠️ Required — use Vercel Enterprise or self-host |
| Turso / SQLite provider | Database | ⚠️ Required if using managed DB |
| Email provider (if applicable) | Notifications | ⚠️ Required |
| Any analytics platform | Usage tracking | ⚠️ Required or disable entirely |

> **Note:** Standard Vercel plans do not include a BAA. For HIPAA production deployments, either use Vercel Enterprise (BAA available) or deploy to a self-managed environment (AWS, Azure, GCP with BAA).

---

## Access Control Policy

- **Minimum Necessary:** Staff should only access PHI required for their role
- **Role definitions:**
  - `admin` — full access, user management
  - `staff` — patient registration, test recording
  - `viewer` — read-only access to results (if applicable)
- **Workforce training** required before accessing PHI in production

---

## Incident Response

In the event of a suspected PHI breach:

1. **Contain** — disable affected accounts, rotate secrets
2. **Assess** — review `AuditLog` to determine scope
3. **Notify** — HIPAA requires notification within 60 days of discovery
   - Affected individuals
   - HHS (if ≥ 500 individuals: immediate; otherwise: annual report)
   - Media (if ≥ 500 individuals in a state/jurisdiction)
4. **Document** — maintain breach investigation records for 6 years

---

## Pre-Production Checklist

### Security
- [ ] `JWT_SECRET` set to cryptographically random value (≥ 32 chars) in production env
- [ ] `DATABASE_URL` points to encrypted production database
- [ ] `.env` and `.env.local` confirmed NOT committed to git
- [ ] `prisma/dev.db` confirmed NOT committed to git
- [ ] HTTPS enforced (Vercel auto-handles; verify custom domains)
- [ ] Session cookies have `Secure`, `HttpOnly`, `SameSite=Strict` attributes

### Compliance
- [ ] BAA executed with hosting provider
- [ ] BAA executed with database provider
- [ ] Workforce HIPAA training completed
- [ ] Privacy policy published and accessible to patients
- [ ] Consent form reviewed by legal counsel
- [ ] Data retention policy defined (audit logs ≥ 6 years, patient records per state law)

### Operations
- [ ] Database backups configured and tested
- [ ] Monitoring / alerting configured (no PHI in alert payloads)
- [ ] Incident response plan documented
- [ ] Access review process defined (quarterly recommended)

### Application
- [ ] All patient-facing routes protected by auth middleware
- [ ] Audit logging implemented on all PHI access/modification endpoints
- [ ] No PHI returned in error messages or stack traces
- [ ] Rate limiting on auth endpoints
- [x] Rate limiting on kiosk DOB lookup (10 req/IP/min — implemented)
- [ ] Input validation on all patient data fields

---

## Compliance References

- [HIPAA Security Rule (45 CFR Part 164)](https://www.hhs.gov/hipaa/for-professionals/security/index.html)
- [HIPAA Privacy Rule (45 CFR Part 164)](https://www.hhs.gov/hipaa/for-professionals/privacy/index.html)
- [HHS Breach Notification Rule](https://www.hhs.gov/hipaa/for-professionals/breach-notification/index.html)
- [NIST SP 800-66r2 — Implementing HIPAA Security Rule](https://csrc.nist.gov/publications/detail/sp/800-66/rev-2/final)

---

*This document is a living record. Update it when new PHI fields are added, controls change, or vendors change.*
