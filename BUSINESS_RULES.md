# BUSINESS_RULES.md — Integrated Allergy Testing

Clinical and operational rules governing data integrity and workflow in the IAT system.

---

## Patient Registration

### Required Fields
- `firstName` — Patient given name (required)
- `lastName` — Patient surname (required)
- `dob` — Date of birth (required, stored as DateTime)

### Optional but Important
- `email` — Used for emailing consent forms and results
- `cellPhone` / `homePhone` — Contact numbers
- `doctorId` — Referring physician assignment
- `locationId` — Clinic location assignment
- `insuranceId` / `insuranceProvider` — Insurance on file

### Patient ID Format
- Auto-generated at creation: `PAT-` + `Date.now().toString(36).toUpperCase()`
- Example: `PAT-M3X8K2J9`
- Stored in `patientId` field (unique); internal DB `id` is a CUID

### Patient Status Lifecycle
```
registered → consented → tested → complete
```
- `registered` — Default at creation
- `consented` — Consent form signed
- `tested` — Allergy testing administered
- `complete` — All workflow steps finished

---

## Allergy Testing

### Test Types
- **Scratch (Prick) Test** — `testType: 'scratch'` — First-line panel; applied to skin surface
- **Intradermal Test** — `testType: 'intradermal'` — Second-panel; injected intradermally for borderline results

### Reaction Scale
| Score | Interpretation |
|---|---|
| 0 | Negative — no reaction |
| 1 | Doubtful / trace reaction |
| 2 | Mild positive |
| 3 | Moderate positive |
| 4 | Strong positive |

> **Note:** Validation enforces `reaction` must be 0–4 (integer). The schema stores as `Int`.

### Wheal/Flare Measurements
- `wheal` — Stored as `String?` to allow values like `"5mm"`, `"8x10mm"`, or `"—"`
- Represents the raised skin bump at the test site
- Flare (surrounding redness) is noted in `notes` field if needed

### Testing Panels
- Standard panel defined in `app/api/allergens/seed/route.ts`
- Categories: pollen, mold, dust, animal, food
- 25 allergens seeded by default

---

## Consent Forms

### Pre-Testing Requirement
- Consent form **must be signed before testing begins**
- `FormActivity.signedAt` must be set before allergy test results can be recorded
- Consent is tracked via `FormActivity` linked to both `Patient` and `Form`

### Signature Storage
- Signatures stored as base64 PNG in `FormActivity.signature`
- Referenced when generating consent PDFs via `/api/forms/pdf?type=consent`

### Form Types
| Type | Description |
|---|---|
| `consent` | Patient consent to allergy testing procedure |
| `testing` | Allergy testing intake form |
| `intake` | General patient intake |

---

## PDF Generation

### Available PDF Types
- `consent` — Consent form with patient info + signature (if signed)
- `results` — Tabular allergy test results report

### Access
- GET `/api/forms/pdf?patientId=<id>&type=<consent|results>`
- `patientId` can be either the internal CUID `id` or the human-readable `patientId` (PAT-XXXXXX)

---

## Soft Delete Policy

> **No hard deletes on any PHI records. Ever.**

All PHI-bearing models include a `deletedAt DateTime?` field:
- `Patient`
- `AllergyTestResult`
- `Location`
- `Doctor`
- `Nurse`

Deactivation is done by setting `active = false` (and optionally `deletedAt = now()`).  
Queries always filter by `active: true` to exclude deactivated records.

**Rationale:** HIPAA requires data retention. Hard deletes are a compliance violation.

---

## Audit Log Requirements

### When to Log
| Event | Action String | Notes |
|---|---|---|
| Patient created | `CREATE` | entity = `Patient` |
| Patient updated | `UPDATE` | entity = `Patient` |
| Test result created | `CREATE` | entity = `AllergyTestResult` |
| Test result updated | `UPDATE` | entity = `AllergyTestResult` |
| Consent signed | `CONSENT_SIGNED` | entity = `FormActivity` |
| Form activity | `FORM_ACTIVITY_CREATED` | entity = `FormActivity` |
| PDF generated | `PDF_GENERATED` | entity = `Patient` |
| Video watched | `VIDEO_ACTIVITY` | entity = `VideoActivity` |
| Staff login success | `LOGIN_SUCCESS` | entity = `StaffUser` |
| Staff login failure | `LOGIN_FAILED` | entity = `StaffUser` |
| Rate limit triggered | `LOGIN_RATE_LIMITED` | entity = `StaffUser` |
| Staff account created | `STAFF_CREATED` | entity = `StaffUser` |

### AuditLog Schema
```
id         — CUID
action     — String (required)
entity     — String? (model name)
entityId   — String? (model record ID)
patientId  — String? (FK to Patient for PHI traceability)
details    — String? (human-readable summary)
createdAt  — DateTime
```

### Implementation
- Use `prisma.auditLog.create({...})` directly in route handlers for critical events
- Use `log()` from `@/lib/audit` for non-critical events (errors are swallowed)
- Always include `patientId` when the event relates to a patient

---

## Rate Limiting

- Login endpoint enforces **5 failed attempts per 15-minute window** per email
- Implemented via AuditLog count query (no external Redis dependency)
- Exceeding limit returns HTTP 429 and logs a `LOGIN_RATE_LIMITED` event

---

## Staff Roles

| Role | Permissions |
|---|---|
| `staff` | Patient registration, testing, forms, PDFs, videos |
| `admin` | All staff permissions + staff user management (/api/staff) |

Role is enforced in `proxy.ts` (JWT payload) and additionally checked inline in admin routes.
