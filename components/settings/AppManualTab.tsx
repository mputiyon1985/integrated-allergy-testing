'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

// ─────────────────────────────────────────────────────────────────────────────
// Inline manual content — update this as new modules ship
// ─────────────────────────────────────────────────────────────────────────────
const MANUAL_MARKDOWN = `# 📘 Integrated Allergy Testing — Application Manual

> **Version:** 3.4.2 | **Last Updated:** April 10, 2026
> **Live URL:** https://integrated-allergy-testing.vercel.app
> **Kiosk URL:** https://integrated-allergy-testing.vercel.app/kiosk
> **GitHub:** https://github.com/mputiyon1985/integrated-allergy-testing

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
11. [Settings](#settings)
12. [Kiosk Mode](#kiosk-mode)
13. [Audit Log](#audit-log)
14. [Upcoming Modules](#upcoming-modules)
15. [Changelog](#changelog)

---

## Overview

**Integrated Allergy Testing** is a clinical practice management application purpose-built for allergy testing practices. It covers the full patient journey — from kiosk check-in through testing, encounter documentation, billing rules validation, and insurance management.

**Tech Stack:**
- Frontend: Next.js (App Router), React, TailwindCSS, react-grid-layout
- Backend: Next.js API Routes (custom \`proxy.ts\` auth guard)
- Database: Turso (LibSQL / SQLite-compatible edge database)
- ORM: Prisma with raw SQL fallback
- Auth: Custom JWT-based session authentication
- Hosting: Vercel

**Practices & Locations:**

| Practice | Code |
|----------|------|
| Medical Associates of Prince William | MAP |
| Northern Virginia Allergy Associates | NVAA |
| Capital Area Allergy Clinic | CAAC |

Currently: 3 practices, 11 locations, 130 allergens.

---

## User Roles & Permissions

The application uses a **hybrid RBAC system** — fixed role profiles with optional per-user JSON permission overrides.

| Role | Badge Color | Intended For |
|------|-------------|--------------|
| \`admin\` | Red | Practice administrators, IT staff |
| \`provider\` | Blue | Physicians |
| \`clinical_staff\` | Green | Nurses, medical technicians |
| \`front_desk\` | Yellow | Receptionist, check-in staff |
| \`billing\` | Purple | Billing and insurance specialists |
| \`office_manager\` | Orange | Office managers |

**45 discrete permissions** spanning: patient management, encounters, testing, billing, insurance, reports, settings, and user management.

Admins can set **JSON permission overrides** on individual users to grant or restrict specific permissions beyond their role defaults.

**Current Admin Users:**

| Name | Email |
|------|-------|
| Mark Putiyon | mputiyon@tipinc.ai |
| Sebastian Paliath | spaliath@tipinc.ai |
| BJ Hockney | bjhockney@vcfaa.com |
| Dr. Rob Sikora | sikora398@yahoo.com |
| Brandon Pople | bpople@tipinc.ai |

> Default password for all users: \`TIPinc2026!\`

---

## Authentication & Login

1. Navigate to the app URL
2. Enter **email** and **password**
3. On success, a JWT session token is issued as a \`strict\` SameSite HTTP cookie
4. All API routes are protected by the \`proxy.ts\` auth guard

**Audit Events:** Every login/logout generates \`LOGIN_SUCCESS\`, \`LOGIN_FAILED\`, or \`LOGOUT\` entries in the audit log.

---

## Dashboard

The Dashboard provides an at-a-glance view through **8 draggable, resizable tiles**:

| Tile | Description |
|------|-------------|
| Today's Appointments | Count for the current day |
| Patients in Waiting Room | Live checked-in count |
| Patients In Service | Currently active encounters |
| Recent Patients | Recently added/updated records |
| Upcoming Appointments | Next appointments with time + patient |
| Testing Queue | Patients awaiting prick or intradermal test |
| Billing Alerts | Pending billing rule warnings or hard blocks |
| Quick Stats | Aggregate numbers (total patients, encounters today) |

**Layout:** Drag tiles to reposition, drag bottom-right corner to resize. Layout persists to localStorage.

**Appointment Color Coding:**
- 🟢 Green — Confirmed / Checked In
- 🟡 Yellow — Pending / Waiting
- 🔵 Blue — In Service
- 🔴 Red — Cancelled or No-Show

---

## Patients

The Patients module is the central patient registry. All clinical activity ties back to a patient record.

**Key Fields:** Patient ID (auto-generated \`PA-XXXXXXXX\`), Name, DOB, Gender, Phone, Email, Address, Insurance (dropdown), Member ID, Group Number, Practice/Location, Notes.

**Patient Detail Tabs:**
- **Overview** — Demographics + insurance summary
- **🏥 Encounters** — All encounters for this patient
- **Testing** — Prick and intradermal test history
- **Notes** — Clinical notes history
- **Billing** — Billing rule results

**Pagination:** 50 patients per page (max 200 per request).

---

## Encounters

Encounters represent a single clinical visit. Accessed via the patient's **🏥 Encounters tab** (not a top-level nav item).

**Lifecycle:**
\`\`\`
Check-In (Waiting Room) → In Service → Encounter Closed
\`\`\`

- **Wait time** — check-in to service start (auto-calculated)
- **In-service time** — service start to close (auto-calculated)
- Both are stored on the encounter for reporting

**Closing an Encounter:** System validates billing rules. Hard block violations prevent close until resolved or admin-overridden.

---

## Waiting Room

Real-time view of patients who have checked in and are waiting.

- **Live patient list** — wait time counter per patient
- **In-service timer** — live timer once provider starts service
- **Service assignment** — select service from dropdown
- **Status progression:** Waiting → In Service → Done
- **Polling:** 10-second refresh (WebSockets on roadmap)

---

## Calendar & Appointments

**Views:** Day, Week, Month

**Double/Triple Bookings:** Cards appear side-by-side with a gradient connecting bar — scheduling conflicts are immediately visible.

**Appointment Statuses:** Scheduled, Confirmed, Checked In, In Service, Completed, No Show, Cancelled.

---

## Allergy Testing

### Allergen Panels

Allergens support a **dual-panel structure**:

| Panel | Flag | Used For |
|-------|------|---------|
| Prick Test Panel | \`showOnPrickTest\` | Percutaneous / scratch test |
| Intradermal Panel | \`showOnIntradermalTest\` | Intradermal (deeper skin) test |

### Prick Test

For each allergen: record **Wheal** (mm) and **Flare** (mm) in 0.1 increments.

**Result Classification:**

| Wheal Size | Classification |
|-----------|---------------|
| < 3mm | Negative |
| 3–5mm | 1+ (Mild) |
| 5–8mm | 2+ (Moderate) |
| 8–12mm | 3+ (Significant) |
| > 12mm | 4+ (Strongly Positive) |

**Controls:** Histamine (positive) + Saline (negative) must pass to validate the test.

### Intradermal Test

For each allergen: record **Initial Wheal**, **15-Minute Wheal**, and **15-Minute Flare** (all in mm).

More sensitive than prick — detects lower levels of IgE reactivity. Typically performed after a negative prick test.

---

## Insurance Hub

The Insurance Hub (\`/insurance\`) is the centralized billing and insurance management area. It contains **5 tabs**:

### Business Rules

Billing rules that must be satisfied before a claim can be submitted.

| Severity | Behavior | Override |
|----------|----------|---------|
| \`hard_block\` | Prevents claim submission | Admin only |
| \`warning\` | Flags issue, allows submission | Any authorized user |

**15 rules seeded** covering: missing diagnosis codes, CPT/ICD-10 compatibility, units billed, Medicare documentation requirements, modifier requirements, age restrictions, duplicate claim detection.

### Insurance Companies

**12 payers configured:** Medicare, Medicaid, BCBS, Aetna, United Healthcare, Cigna, Humana, Tricare, Kaiser Permanente, WellCare, Molina Healthcare, CareFirst.

Each record includes: Company Name, Payer ID (EDI), Address, Phone, Website, Notes, Active toggle.

### CPT Codes

**31 allergy-specific CPT codes** with the **2026 Medicare Fee Schedule**:

| Rate Type | Description |
|-----------|-------------|
| NF | Non-Facility (office/clinic) |
| FAC | Facility (hospital) |
| NoVA MAC | Northern Virginia local contractor rate |

### ICD-10 Codes

**32 allergy-specific diagnosis codes** with category grouping, common allergen associations, and payer coverage notes.

### Reference Guide

Read-only quick reference for staff covering: modifier quick reference, place of service codes, NCCI edit overview, allergy testing protocol summary, Medicare documentation requirements, prior authorization guide.

---

## Settings

Administrative configuration hub. All sections support drag-and-drop reordering and resizing.

| Tab | Contents |
|-----|---------|
| ⚙️ Dashboard | System status, app version, quick links |
| 🔐 Roles *(admin only)* | Permission matrix — all 6 roles × 45 permissions |
| 👥 Users *(admin only)* | Staff user CRUD, role assignment, permission overrides |
| 🏢 Practices | Practice records |
| 📍 Locations | Location records per practice |
| 👨‍⚕️ Doctors | Physician records + NPI numbers |
| 👩‍⚕️ Nurses | Nursing/clinical tech staff |
| 🎨 Services | Service types with color picker (propagates to calendar badges) |
| 🎬 Videos | Patient education video library |
| 🧪 Allergens | Master allergen library with dual panel toggles |
| 📋 Audit Log | Tamper-evident event log |
| 📘 App Manual *(you are here)* | This application manual |

---

## Kiosk Mode

**URL:** \`/kiosk\`

Patient-facing check-in interface for tablets/touchscreens.

**Flow:**
\`\`\`
Welcome Screen → Patient Lookup (DOB) → Service Selection → Check-In Confirmation
\`\`\`

On confirmation, the patient is added to the **Waiting Room** queue and the wait timer starts automatically.

---

## Audit Log

Captures a tamper-evident record of security-relevant and clinical events.

**Logged Events:** LOGIN_SUCCESS, LOGIN_FAILED, LOGOUT, PATIENT_CREATED, PATIENT_UPDATED, ENCOUNTER_CREATED, ENCOUNTER_CLOSED, BILLING_RULE_OVERRIDE, USER_CREATED, USER_ROLE_CHANGED, TEST_RECORDED.

Each entry includes: Timestamp, Event Type, User (patient name, not just ID), Target, IP Address, Detail JSON.

---

## Upcoming Modules

### 🧪 Immunotherapy Module *(in design — awaiting BJ Hockney clinical input)*

Full allergy shot workflow covering:
- **AllergenInventory** — stock vials (lot#, qty, expiry, manufacturer)
- **PatientVialSet** — patient-specific mixed vials
- **ImmunotherapyAdministration** — shot records (arm, vial, volume, reaction, injector)
- **BuildUpSchedule** — dose progression (0.05ml → 0.50ml)
- **VialSetFormula** — physician prescription

**Vial Color System:**

| Color | Dilution | Vial # | Strength |
|-------|----------|--------|---------|
| Silver | 1:10,000 | 5 | Weakest |
| Green | 1:1,000 | 4 | |
| Blue | 1:100 | 3 | |
| Yellow | 1:10 | 2 | |
| Red | 1:1 | 1 | Maintenance |

Standard maintenance dose: **0.4ml** (per Dr. Rob Sikora)

### 📊 Reports Module *(planned)*
- Encounter volume by provider/location/date
- Testing result summaries
- Billing rule violation reports
- Revenue cycle metrics

### Other Planned Features
- Claim generation (837P EDI files)
- WebSocket waiting room (replace 10-second polling)
- Location-scoped permissions
- Patient photo upload
- Integration testing coverage

---

## Changelog

| Version | Date | Summary |
|---------|------|---------|
| **3.4.2** | Apr 9, 2026 | Demo version — presented to Dr. Sikora & BJ Hockney ✅ |
| **3.4.x** | Apr 9, 2026 | Permission profiles (6 roles), dual allergen panels, sidebar location selector, in-service timer, kiosk services |
| **3.3.x** | Apr 9, 2026 | Dashboard tile persist, calendar side-by-side bookings, waiting room timers, color-coded badges, Services management |
| **3.2.0** | Apr 9, 2026 | Error handling (8 pages), audit logging, Business Rules fix, Sebastian added |
| **3.1.0** | Apr 8–9, 2026 | Insurance Hub (5 tabs), 12 payers, 15 billing rules, 2026 Medicare fee schedule, drag+resize |
| **2.x** | Apr 3–6, 2026 | Code review hardening — SQL injection fix, pagination, cookie security, auth guard |
| **1.x** | Mar 2026 | Initial build — patients, basic testing, appointments |

---

*This manual lives in Settings → 📘 App Manual. Update it whenever new modules ship.*
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
  { id: 'settings', label: '⚙️ Settings' },
  { id: 'kiosk-mode', label: '📟 Kiosk Mode' },
  { id: 'audit-log', label: '📋 Audit Log' },
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
