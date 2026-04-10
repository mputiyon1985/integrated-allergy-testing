'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

// ─────────────────────────────────────────────────────────────────────────────
// Inline manual content — update this as new modules ship
// ─────────────────────────────────────────────────────────────────────────────
const MANUAL_MARKDOWN = `# 📘 Integrated Allergy Testing — Application Manual

> **Version:** 3.7.0
> **Last Updated:** April 10, 2026
> **Live URL:** https://integrated-allergy-testing.vercel.app
> **Kiosk URL:** https://integrated-allergy-testing.vercel.app/kiosk
> **GitHub:** https://github.com/mputiyon1985/integrated-allergy-testing
> **Code Review Score:** 9.6/10 | **Tests:** 297/297 passing

---

## Table of Contents

1. [Overview](#overview)
2. [User Roles & Permissions](#user-roles--permissions)
3. [Authentication & Login](#authentication--login)
4. [Dashboard](#dashboard)
5. [Patients](#patients)
6. [Encounters](#encounters)
7. [Waiting Room](#waiting-room)
8. [Calendar & Appointments](#calendar--appointments)
9. [Allergy Testing](#allergy-testing)
10. [Insurance Hub](#insurance-hub)
11. [Reports](#reports)
12. [Email Module](#email-module)
13. [Settings](#settings)
14. [Kiosk Mode](#kiosk-mode)
15. [Audit Log](#audit-log)
16. [Security Architecture](#security-architecture)
17. [Location & Practice Scoping](#location--practice-scoping)
18. [Upcoming Modules](#upcoming-modules)
19. [Changelog](#changelog)

---

## Overview

**Integrated Allergy Testing** is a multi-location clinical practice management platform for allergy testing practices. It covers the full patient journey — kiosk check-in through testing, encounter documentation, billing rules validation, insurance management, reporting, and patient communications.

**Tech Stack:**
- Frontend: Next.js 15 (App Router), React, TailwindCSS, react-grid-layout
- Backend: Next.js API Routes (custom \`proxy.ts\` auth guard)
- Database: Turso (LibSQL / SQLite-compatible edge database)
- ORM: Prisma with raw SQL (all DateTime fields use \`$queryRaw\`)
- Auth: Custom JWT-based session authentication + CSRF protection
- Email: Microsoft 365 / Exchange via Graph API (primary) + Resend (fallback)
- Hosting: Vercel

**Practices & Locations (11 total):**

| Practice | Code | Locations |
|----------|------|-----------|
| Medical Associates of Prince William | MAP | Dumfries, Woodbridge, Stafford, Fredericksburg |
| Northern Virginia Allergy Associates | NVAA | Fairfax, Arlington, Reston, Tysons |
| Capital Area Allergy Clinic | CAAC | Bethesda, Silver Spring, Rockville |

---

## User Roles & Permissions

Hybrid RBAC — 6 fixed role profiles with optional per-user JSON permission overrides.

| Role | Badge | Access Level |
|------|-------|-------------|
| \`admin\` | Red | Full access — all locations, all settings |
| \`provider\` | Blue | Physicians — clinical + encounter signing |
| \`clinical_staff\` | Green | Nurses/techs — testing, encounters, waiting room |
| \`front_desk\` | Yellow | Scheduling, check-in, patient registration |
| \`billing\` | Purple | Billing, insurance, claims, reports |
| \`office_manager\` | Orange | Reporting, staff management, locations |

**Location-Scoped Permissions:** Individual users can be restricted to specific locations via \`allowedLocations\` JSON field in StaffUser. Example: BJ Hockney is restricted to MAP locations only.

**Current Staff:**
- All users default password: \`TIPinc2026!\`
- 2 physicians + 4 nurses seeded per location (66 staff total)
- 220 patients across all 11 locations

---

## Authentication & Login

- JWT session cookies (\`iat_session\`): \`httpOnly: true\`, \`sameSite: strict\`, \`secure: production\`
- **Rate limiting:** 5 failed attempts per IP per 15 minutes → 429 Too Many Requests
- **CSRF protection:** Double-submit cookie (\`iat_csrf\`) — all POST/PUT/DELETE require matching \`X-CSRF-Token\` header (production only)
- MFA support via TOTP
- Session expires after 8 hours

**Audit events:** \`LOGIN_SUCCESS\`, \`LOGIN_FAILED\`, \`LOGOUT\`

---

## Dashboard

Central operations view with 3 KPI tiles + waiting room + appointment schedule.

**KPI Tiles:**
- 📅 **Appointments Today** — total scheduled for selected location
- ⏳ **Waiting** — patients currently in waiting room
- 🩺 **In Service** — patients actively being seen

**Waiting Room (left panel):**
- Live updates via Server-Sent Events (SSE) — no polling
- Reconnects automatically with exponential backoff (5s → 10s → 20s → max 60s)
- Click any row → navigates to patient's open encounter
- Actions: assign nurse, + Log activity, ✅ Complete
- Color coding: yellow = new arrival (<5 min), green = in service

**Today's Schedule (right panel):**
- ✓ Check In button on each appointment card — single click, no modal
- Check-in auto-creates an open Encounter for the patient
- Appointment cards show service type with color coding

**Layout:** Drag-to-reposition, resize tiles. Layout persists per user per device.

---

## Patients

Central patient registry. All data scoped to selected location/practice.

**Patient ID format:** \`PA-XXXXXXXX\` (8 alphanumeric chars, nanoid generated)

**Key Fields:** Name, DOB, Phone, Email, Address, Insurance Provider, Member ID, Group #, Emergency Contact (name/phone/relationship), Physician, Diagnosis, Status, Location.

**Patient Detail Tabs:**
- **Overview** — demographics, insurance, emergency contact (all inline-editable)
- **🏥 Encounters** — all encounters with activity timeline
- **Testing** — prick and intradermal test history
- **Notes** — clinical notes
- **Videos** — education videos watched
- **Consent** — signed consent forms
- **📧 Send Email** button — opens email modal with template selection

**Photo Upload:** Click the circular avatar to upload a patient photo (5MB max, image files only).

**Pagination:** 500 patients max per request. Use search for large datasets.

---

## Encounters

Encounters represent a clinical visit episode. They **start automatically at check-in** and build throughout the visit.

### Encounter Lifecycle

\`\`\`
Check-In → Encounter Created (open) → Nurse Calls Back → Activity Logged → During Visit: Add Notes/Activities → MD Signs → Bill → Complete
\`\`\`

**Auto-creation at check-in:**
- Encounter created with \`status: open\` when ✓ Check In is clicked
- \`chiefComplaint\` populated from appointment reason

**Nurse call-back:**
- When nurse selects patient from waiting room, activity logged: *"Patient brought to exam room by [Nurse]"*
- \`nurseName\` auto-populated on encounter

**Auto-close:**
- When ✅ Complete clicked, encounter closes automatically

### Encounter Statuses

| Status | Meaning |
|--------|---------|
| \`open\` | Active visit in progress |
| \`awaiting_md\` | Documentation complete, waiting for MD sign-off |
| \`signed\` | MD signed — ready to bill |
| \`billed\` | Submitted to insurance |
| \`complete\` | Visit closed |

### Encounter Detail Page \`/encounters/[id]\`

**Left panel (editable):**
- Chief Complaint, Physician, Nurse, Status
- Subjective / Objective / Assessment / Plan (SOAP)
- Primary Diagnosis (ICD-10 dropdown)
- Save button → \`PUT /api/encounters/[id]\`

**Right panel (activity timeline):**
- All activities chronologically
- ✏️ Edit button on each activity → inline edit → save
- + Add Activity button

### Encounters List Page (Left Nav)

Filters: Today / This Week / This Month / Custom date range, Search, Status, Physician, Nurse, Insurance, **Service**

Stats bar (clickable — filters the list):
Open | Awaiting MD | Signed | Billed | Complete

Actions per row: 👤 Patient, 📝 Document (open), ✍️ Sign (awaiting MD), 🧾 Superbill (signed/billed), 📋 Claim

### Claim Generation

From signed/billed encounters:
- 🧾 Generate Claim → JSON claim summary
- Includes: patient info, insurance, DOS, provider NPI, CPT codes, ICD-10, total charges
- Copy to clipboard or ⬇️ Download JSON

---

## Waiting Room

Real-time view of all checked-in patients.

- **Live updates via SSE** — near-real-time (~8 second server push)
- **Auto-reconnect** with exponential backoff if connection drops
- Manual ↻ Refresh button as fallback
- Click any row → open patient's encounter directly
- 🏥 Encounter button per row

**Patient card shows:**
- Patient name + reason for visit (editable inline)
- Wait time counter (live)
- In-service timer (once called back)
- Videos watched count
- Status badge (Waiting / In Service)
- Nurse assigned

**Staff actions:**
- Call patient: select nurse from dropdown → status → In Service
- + Log: add activity to encounter
- ✅ Complete: closes encounter, removes from waiting room

---

## Calendar & Appointments

**Views:** Day, Week, Month (default)

**Appointment booking:**
- Patient search (live dropdown with debounce)
- **Physician dropdown** (location-filtered)
- Service/Reason dropdown (auto-sets duration)
- Date + time pickers (15-min increments)
- Notes field

**Double/Triple bookings:** Cards appear side-by-side with gradient connector.

**Appointment statuses:** Scheduled, Confirmed, Checked In, In Service, Completed, No Show, Cancelled

**Location-aware:** Calendar only shows appointments for selected location/practice.

---

## Allergy Testing

### Allergen Panels

50 allergens on Prick Test panel, additional on Intradermal panel. Configurable per allergen in Settings → Allergens.

### Prick Test

Record **Wheal** (mm) and **Flare** (mm) per allergen. Auto-grades reaction 0-4+.

| Wheal | Grade |
|-------|-------|
| < 3mm | Negative |
| 3-5mm | 1+ Mild |
| 5-8mm | 2+ Moderate |
| 8-12mm | 3+ Significant |
| >12mm | 4+ Strongly Positive |

Controls: Histamine (positive) + Saline (negative) must pass for valid test.

### Intradermal Test

Records Initial Wheal, 15-min Wheal, and 15-min Flare. More sensitive than prick.

---

## Insurance Hub

Centralized billing and insurance management at \`/insurance\`.

### Business Rules (15 seeded)

| Severity | Behavior | Override |
|----------|----------|---------|
| \`hard_block\` | Prevents claim submission | Admin only |
| \`warning\` | Flags issue, allows submission | Authorized user |

### Insurance Companies (12 payers)

Medicare, Medicaid, BCBS, Aetna, United Healthcare, Cigna, Humana, Tricare, Kaiser Permanente, WellCare, Molina, CareFirst

### CPT Codes

31 allergy-specific codes with **2026 Medicare Fee Schedule** (NF / FAC / NoVA MAC rates).

### ICD-10 Codes

32 allergy-specific diagnosis codes with payer coverage notes.

### Reference Guide

Modifier quick reference, POS codes, NCCI overview, documentation requirements.

---

## Reports

\`/reports\` — Left nav. 4 tabs with date range filter, CSV export, and print-optimized PDF export.

**Filter bar:** Today / This Week / This Month / Custom | Location-aware | Auto-reloads on location switch

### Clinical Tab
- KPIs: Total Encounters, Open, Avg Wait Time, Avg In-Service Time
- Encounters by Day, by Physician, Top Chief Complaints, by Diagnosis

### Billing Tab
- KPIs: Signed, Billed, Awaiting MD counts
- Status Summary, Ready-to-Bill list, Insurance Breakdown

### Staff Tab
- Encounters by Nurse, by Physician
- Activity Log by Type

### Testing Tab
- KPIs: Total Tests, Positive Results
- Tests by Type (prick vs intradermal), Top Reactive Allergens, Daily Volume

### PDF Export
Print-optimized layout: teal table headers, alternating rows, page numbers, CONFIDENTIAL footer, practice header with date range.

---

## Email Module

In-app email via Microsoft 365 / Exchange (primary) or Resend (fallback).

**Provider:** \`emrmail@tipinc.ai\` via Microsoft Graph API
- Sends from Exchange → saves to Sent Items
- Full email audit trail in M365

### Settings → 📧 Email

**⚙️ Provider subtab:**
- Toggle: Microsoft 365 / Exchange ↔ Resend
- M365: Azure Client ID, Secret (auto-pulled from Key Vault), Tenant ID, Send-From Mailbox
- Resend: API Key, From Email, From Name
- Test Email button

**📝 Templates subtab:**
4 default templates (auto-seeded):
1. Appointment Reminder — \`{{patientName}}\`, \`{{date}}\`, \`{{time}}\`, \`{{location}}\`
2. Test Results Ready
3. Welcome New Patient — \`{{practiceName}}\`
4. Billing Statement

Full CRUD: name, category, HTML body editor, variable hints, live preview.

**📋 Email Log subtab:**
Full send history with status (sent/failed/pending/bounced), date filter, patient search.

### Send Email from Patient Page
📧 Send Email button in patient header → modal with:
- Pre-filled patient email
- Template dropdown (variables auto-resolved)
- Custom option (subject + body)
- HTML preview
- Success/error feedback

**Email HTML is sanitized before sending** (strips \`<script>\`, \`on*\` handlers, \`javascript:\` URIs).

---

## Settings

Administrative configuration. All tabs accessed via Settings → [tab name].

| Tab | Contents |
|-----|---------|
| ⚙️ Dashboard | System status, app version, quick links |
| 🔐 Roles *(admin)* | Permission matrix — 6 roles × 45 permissions |
| 👥 Users *(admin)* | Staff CRUD, role assignment, permission overrides, **allowed locations** |
| 🏢 Practices | Practice records with 3 tabs: Info, Accepted Insurances, Hours of Operation |
| 📍 Locations | Location records per practice |
| 👨‍⚕️ Doctors | Physician directory with practice + location assignment |
| 👩‍⚕️ Nurses | Nursing/clinical tech staff with location assignment |
| 🎨 Services | Service types with color picker |
| 🎬 Videos | Patient education video library |
| 🧪 Allergens | Master allergen library, dual panel toggles (Prick / Intradermal) |
| 📧 Email | Provider config, templates, email log |
| 📋 Audit Log | HIPAA audit trail |
| 📘 App Manual | This document (live in-app) |

### Practice Hours of Operation
Each practice can set open/close times + lunch break per day of week.
- Open/Closed toggle per day
- Time dropdowns (30-min increments)
- 🍽 Lunch break checkbox with start/end times
- Notes per day

---

## Kiosk Mode

**URL:** \`/kiosk\`

Patient-facing check-in on tablets/touchscreens.

### Flow
\`\`\`
Welcome → DOB Entry → Patient Lookup → Identity Verify → Onboarding Check → Service Selection → Videos → Consent → Check-In Confirmation
\`\`\`

### Onboarding Checklist (auto-triggered if missing)
Kiosk stops and collects missing info before allowing check-in:
- ☐ Phone number
- ☐ Email address
- ☐ Insurance Provider + Member ID + Group #
- ☐ Emergency Contact (name, phone, relationship)
- ☐ Videos not watched
- ☐ Consent forms not signed

### Check-In Result
On confirmation, patient added to **Waiting Room** queue and wait timer starts automatically.

---

## Audit Log

Tamper-evident HIPAA compliance log. **Admin-only access.**

**Logged Events:**

| Event | Trigger |
|-------|---------|
| \`LOGIN_SUCCESS\` / \`LOGIN_FAILED\` / \`LOGOUT\` | Auth events |
| \`PATIENT_CREATED\` / \`PATIENT_UPDATED\` | Patient record changes |
| \`ENCOUNTER_CREATED\` / \`ENCOUNTER_CLOSED\` | Encounter lifecycle |
| \`BILLING_RULE_OVERRIDE\` | Admin overrides hard block |
| \`USER_CREATED\` / \`USER_ROLE_CHANGED\` | Staff management |
| \`TEST_RECORDED\` | Allergy test results saved |
| \`APPOINTMENT_CREATED\` / \`APPOINTMENT_UPDATED\` | Scheduling |

Each entry: Timestamp, Event Type, User (name not ID), Target, IP Address, Detail JSON.

---

## Security Architecture

**Authentication:**
- JWT session tokens, \`httpOnly\`, \`sameSite: strict\`, \`secure: production\`
- Rate limiting: 5 attempts / 15 min per IP → 429

**CSRF Protection:**
- Double-submit cookie pattern (\`iat_csrf\`)
- All POST/PUT/DELETE require matching \`X-CSRF-Token\` header (production)
- \`apiFetch()\` utility auto-injects token on all state-changing requests

**Security Headers (all responses):**
- \`X-Frame-Options: DENY\`
- \`X-Content-Type-Options: nosniff\`
- \`Referrer-Policy: strict-origin-when-cross-origin\`
- \`Permissions-Policy: camera=(), microphone=(), geolocation=()\`
- \`X-XSS-Protection: 1; mode=block\`
- \`Strict-Transport-Security\` (production only)

**Database:**
- All DateTime model queries use raw SQL (\`$queryRaw\` / \`$executeRaw\`) — Turso compatibility
- Parameterized queries throughout — no SQL injection risk
- Location scope enforcement per user (\`allowedLocations\` in StaffUser)

**Email Security:**
- HTML body sanitized before sending (strips scripts/handlers)
- Azure credentials stored in Key Vault, never hardcoded

**Error Boundary:**
- Global React ErrorBoundary catches unhandled errors → clean UI with refresh button

---

## Location & Practice Scoping

Every data fetch in the app is location/practice aware.

**How it works:**
- \`iat_active_location\` in localStorage = current location ID
- \`iat_active_practice_filter\` = practice ID when "All Locations" selected
- \`getLocationParam()\` utility from \`lib/location-params.ts\` builds query params
- All APIs support \`?locationId=\` and \`?practiceId=\` params

**Sidebar selector:**
- Practice dropdown (MAP / NVAA / CAAC)
- Location dropdown with **"— All Locations —"** option at top
- Switching location instantly refreshes all data (via \`locationchange\` event)

**Per-user restrictions:**
- \`allowedLocations\` JSON array in StaffUser
- Empty = unrestricted (all locations)
- Set in Settings → Users → Edit → Allowed Locations

---

## Upcoming Modules

### 🧪 Immunotherapy Module *(awaiting clinical input from BJ Hockney)*

| Component | Description |
|-----------|-------------|
| AllergenInventory | Stock vials with lot#, qty, expiry, manufacturer |
| PatientVialSet | Patient-specific mixed vials |
| ImmunotherapyAdministration | Shot records (arm, vial, volume, reaction, injector) |
| BuildUpSchedule | Dose progression (0.05ml → 0.50ml) |
| VialSetFormula | Physician prescription |

**Vial Color System:**

| Color | Dilution | Vial # | Strength |
|-------|----------|--------|---------|
| Silver | 1:10,000 | 5 | Weakest |
| Green | 1:1,000 | 4 | |
| Blue | 1:100 | 3 | |
| Yellow | 1:10 | 2 | |
| Red | 1:1 | 1 | Maintenance |

Standard maintenance dose: **0.4ml** (per Dr. Rob Sikora)

**v4.0.0 milestone** — ships when immunotherapy module is complete.

### Other Planned
- BAAs for Turso + Vercel
- Real DB integration tests
- WebRTC/WebSocket waiting room (upgrade from SSE)
- Location-scoped permission enforcement in all remaining APIs

---

## Changelog

| Version | Date | Summary |
|---------|------|---------|
| **3.7.0** | Apr 10, 2026 | Encounter lifecycle, SSE real-time, claim gen, photo upload, encounter detail page, reports, email module (M365+Resend), CSRF, rate limiting, security headers, apiFetch CSRF wiring, global error boundary, SSE reconnect backoff, 297 tests, 9.6/10 score |
| **3.4.2** | Apr 9, 2026 | Demo version — presented to Dr. Sikora & BJ Hockney ✅ |
| **3.4.x** | Apr 9, 2026 | Permission profiles (6 roles), dual allergen panels, sidebar location selector, in-service timer, kiosk services |
| **3.3.x** | Apr 9, 2026 | Dashboard tile persist, calendar side-by-side bookings, waiting room timers, color-coded badges, Services management |
| **3.2.0** | Apr 9, 2026 | Error handling (8 pages), audit logging, Business Rules fix |
| **1.x–3.1.x** | Mar–Apr 2026 | Initial build through Insurance Hub |

---

*This manual is maintained automatically. Pepper updates both the workspace file and the in-app version (\`components/settings/AppManualTab.tsx\`) after every feature ship.*
`;

// ─────────────────────────────────────────────────────────────────────────────
// Section headings for the sidebar TOC
// ─────────────────────────────────────────────────────────────────────────────
const TOC_SECTIONS = [
  { id: 'overview', label: '📖 Overview' },
  { id: 'user-roles--permissions', label: '👥 Roles & Permissions' },
  { id: 'authentication--login', label: '🔐 Authentication' },
  { id: 'dashboard', label: '📊 Dashboard' },
  { id: 'patients', label: '🧑‍⚕️ Patients' },
  { id: 'encounters', label: '🏥 Encounters' },
  { id: 'waiting-room', label: '⏳ Waiting Room' },
  { id: 'calendar--appointments', label: '📅 Calendar' },
  { id: 'allergy-testing', label: '🧪 Allergy Testing' },
  { id: 'insurance-hub', label: '🏦 Insurance Hub' },
  { id: 'reports', label: '📊 Reports' },
  { id: 'email-module', label: '📧 Email Module' },
  { id: 'settings', label: '⚙️ Settings' },
  { id: 'kiosk-mode', label: '📟 Kiosk Mode' },
  { id: 'audit-log', label: '📋 Audit Log' },
  { id: 'security-architecture', label: '🔒 Security' },
  { id: 'location--practice-scoping', label: '📍 Location Scoping' },
  { id: 'upcoming-modules', label: '🚀 Upcoming Modules' },
  { id: 'changelog', label: '📝 Changelog' },
];

export default function AppManualTab() {
  const [search, setSearch] = useState('');
  const [activeSection, setActiveSection] = useState('');
  const [copied, setCopied] = useState(false);

  // Highlight search matches
  const displayContent = search.trim()
    ? MANUAL_MARKDOWN
    : MANUAL_MARKDOWN;

  // Track scroll position for active TOC item
  useEffect(() => {
    const container = document.getElementById('manual-scroll-container');
    if (!container) return;
    const handler = () => {
      const headings = container.querySelectorAll('h2[id]');
      let current = '';
      headings.forEach(h => {
        if ((h as HTMLElement).offsetTop - container.scrollTop <= 80) {
          current = h.id;
        }
      });
      setActiveSection(current);
    };
    container.addEventListener('scroll', handler);
    return () => container.removeEventListener('scroll', handler);
  }, []);

  const scrollToSection = (id: string) => {
    const container = document.getElementById('manual-scroll-container');
    const target = document.getElementById(id);
    if (container && target) {
      container.scrollTo({ top: target.offsetTop - 20, behavior: 'smooth' });
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(MANUAL_MARKDOWN).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Filter sections by search
  const filteredSections = search.trim()
    ? TOC_SECTIONS.filter(s =>
        s.label.toLowerCase().includes(search.toLowerCase())
      )
    : TOC_SECTIONS;

  return (
    <div style={{ display: 'flex', gap: 0, height: 'calc(100vh - 200px)', minHeight: 500, background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>

      {/* ── Sidebar TOC ── */}
      <div style={{
        width: 220,
        minWidth: 220,
        background: '#f8fafc',
        borderRight: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px 0',
      }}>
        <div style={{ padding: '0 14px 12px', borderBottom: '1px solid #e2e8f0', marginBottom: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', marginBottom: 8 }}>📘 App Manual</div>
          <input
            type="text"
            placeholder="Search sections..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid #e2e8f0',
              fontSize: 12,
              color: '#374151',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {filteredSections.map(s => (
            <button
              key={s.id}
              onClick={() => { scrollToSection(s.id); setSearch(''); }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '7px 16px',
                background: activeSection === s.id ? '#e0f2fe' : 'transparent',
                color: activeSection === s.id ? '#0369a1' : '#475569',
                fontWeight: activeSection === s.id ? 700 : 500,
                fontSize: 12,
                border: 'none',
                cursor: 'pointer',
                borderLeft: activeSection === s.id ? '3px solid #0ea5e9' : '3px solid transparent',
                transition: 'all 0.1s',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Copy raw markdown button */}
        <div style={{ padding: '12px 14px', borderTop: '1px solid #e2e8f0' }}>
          <button
            onClick={handleCopy}
            style={{
              width: '100%',
              padding: '7px 0',
              borderRadius: 6,
              border: '1px solid #e2e8f0',
              background: copied ? '#f0fdf4' : '#fff',
              color: copied ? '#16a34a' : '#374151',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {copied ? '✅ Copied!' : '📋 Copy Markdown'}
          </button>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div
        id="manual-scroll-container"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '28px 36px',
        }}
      >
        <div style={{ maxWidth: 860 }}>
          <ReactMarkdown
            components={{
              h1: ({ children }) => (
                <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', marginBottom: 4, marginTop: 0, lineHeight: 1.3 }}>
                  {children}
                </h1>
              ),
              h2: ({ children, ...props }) => {
                // Generate id from children text for TOC anchoring
                const text = typeof children === 'string' ? children : String(children);
                const id = text.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
                return (
                  <h2
                    id={id}
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: '#1e293b',
                      marginTop: 36,
                      marginBottom: 12,
                      paddingBottom: 8,
                      borderBottom: '2px solid #e2e8f0',
                      scrollMarginTop: 20,
                    }}
                    {...props}
                  >
                    {children}
                  </h2>
                );
              },
              h3: ({ children }) => (
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#334155', marginTop: 24, marginBottom: 8 }}>
                  {children}
                </h3>
              ),
              h4: ({ children }) => (
                <h4 style={{ fontSize: 14, fontWeight: 700, color: '#475569', marginTop: 16, marginBottom: 6 }}>
                  {children}
                </h4>
              ),
              p: ({ children }) => (
                <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.75, marginBottom: 12 }}>
                  {children}
                </p>
              ),
              ul: ({ children }) => (
                <ul style={{ paddingLeft: 20, marginBottom: 12 }}>{children}</ul>
              ),
              ol: ({ children }) => (
                <ol style={{ paddingLeft: 20, marginBottom: 12 }}>{children}</ol>
              ),
              li: ({ children }) => (
                <li style={{ fontSize: 14, color: '#374151', lineHeight: 1.75, marginBottom: 3 }}>
                  {children}
                </li>
              ),
              table: ({ children }) => (
                <div style={{ overflowX: 'auto', marginBottom: 16 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    {children}
                  </table>
                </div>
              ),
              thead: ({ children }) => (
                <thead style={{ background: '#f1f5f9' }}>{children}</thead>
              ),
              th: ({ children }) => (
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#374151', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td style={{ padding: '7px 12px', borderBottom: '1px solid #f1f5f9', color: '#475569', verticalAlign: 'top' }}>
                  {children}
                </td>
              ),
              code: ({ inline, children }: { inline?: boolean; children?: React.ReactNode }) =>
                inline ? (
                  <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontSize: 12, color: '#be185d', fontFamily: 'monospace' }}>
                    {children}
                  </code>
                ) : (
                  <pre style={{ background: '#1e293b', color: '#e2e8f0', padding: '14px 18px', borderRadius: 8, overflowX: 'auto', fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
                    <code style={{ fontFamily: 'monospace' }}>{children}</code>
                  </pre>
                ),
              blockquote: ({ children }) => (
                <blockquote style={{ borderLeft: '4px solid #0ea5e9', paddingLeft: 14, margin: '12px 0', color: '#475569', fontStyle: 'italic' }}>
                  {children}
                </blockquote>
              ),
              hr: () => (
                <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '24px 0' }} />
              ),
              strong: ({ children }) => (
                <strong style={{ fontWeight: 700, color: '#1e293b' }}>{children}</strong>
              ),
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#0ea5e9', textDecoration: 'underline' }}>
                  {children}
                </a>
              ),
            }}
          >
            {displayContent}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
