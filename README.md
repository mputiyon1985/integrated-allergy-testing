# Integrated Allergy Testing

[![HIPAA Compliant](https://img.shields.io/badge/HIPAA-Compliant-green?style=flat-square&logo=shield)](./HIPAA.md)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)](https://typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?style=flat-square&logo=prisma)](https://prisma.io)

**Clinical allergy testing workflow application for tablet-based patient registration, allergy testing, and consent management.**

Designed for clinical environments requiring HIPAA-compliant handling of patient data, test results, and digital consent signatures.

---

## Features

- 🏥 **Patient Registration** — Tablet-optimized intake flow with demographics capture
- 🧪 **Allergy Testing Workflow** — Structured test sessions with per-allergen result recording
- ✍️ **Digital Consent Management** — Signature capture, versioned consent forms, audit trail
- 📺 **Patient Kiosk** — Self-service touch-screen check-in with DOB lookup and smart routing
- 🎬 **Video Tracking** — Educational videos with per-patient watch tracking; skipped if already viewed
- 📋 **Waiting Room Dashboard** — Live nurse-facing view of checked-in patients with video/consent status
- 🔐 **HIPAA-Ready Security** — JWT auth, RBAC, audit logging, security headers
- 📊 **Audit Trail** — Every PHI access and modification logged for compliance
- 📄 **PDF Generation** — Patient-ready result summaries via jsPDF
- 🔑 **Staff Authentication** — Role-based login (admin / staff)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Database | SQLite via Prisma (libsql/Turso) |
| Auth | JWT (jose), bcryptjs |
| Styling | Tailwind CSS 4 |
| ORM | Prisma 7 |
| PDF | jsPDF |
| 2FA | speakeasy (TOTP) |
| Signatures | HTML5 Canvas (finger/stylus) |

---

## Staff App vs Patient Kiosk

The application has **two entry points** serving different audiences:

| | Staff App | Patient Kiosk |
|---|---|---|
| **URL** | `/login` → `/` | `/kiosk` |
| **Users** | Nurses, admins | Patients (self-service) |
| **Auth** | JWT session (iat_session cookie) | Public — no login required |
| **Purpose** | Clinical workflow, allergy testing, reporting | Check-in, video consent, signature |
| **Device** | Any browser | Touch-screen tablet (lobby) |

---

## Patient Kiosk Flow

The kiosk is a 5-step self-service check-in flow. Smart routing skips completed steps automatically.

1. **DOB Entry** (`/kiosk`) — Patient enters their date of birth
2. **Identity Verify** (`/kiosk/verify`) — Patient enters first name to confirm identity
3. **Update Info** (`/kiosk/update-info`) — Prompted only if contact or insurance info is missing
4. **Watch Videos** (`/kiosk/videos`) — Educational videos; skipped if already watched
5. **Sign Consent** (`/kiosk/consent`) — Two consent forms with finger signature pad; skipped if already signed
6. **Done** (`/kiosk/done`) — "Please be seated" screen with 10-second countdown, then auto-resets

> See [KIOSK.md](./KIOSK.md) for full kiosk documentation including smart routing, staff integration, and data captured.

---

## Quick Start

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local — set JWT_SECRET to a strong random value

# 3. Initialize database
npx prisma migrate dev --name init

# 4. Seed initial data (optional)
npm run db:seed

# 5. Start development server
npm run dev
```

- **Staff App:** Open [http://localhost:3000](http://localhost:3000) → login with staff credentials
- **Patient Kiosk:** Open [http://localhost:3000/kiosk](http://localhost:3000/kiosk) → no login needed

---

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | SQLite file path or Turso connection URL | ✅ |
| `JWT_SECRET` | Secret for signing session tokens (≥ 32 chars) | ✅ |
| `NODE_ENV` | `development` or `production` | ✅ |

> ⚠️ **Never commit `.env` or `.env.local` to git.** These are in `.gitignore`.

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server with Turbo |
| `npm run build` | Generate Prisma client + production build |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:push` | Push schema changes to DB |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:seed` | Seed initial data via API |

---

## Project Structure

```
├── app/                  # Next.js App Router pages & API routes
│   ├── api/              # API endpoints
│   ├── login/            # Auth pages (staff)
│   ├── kiosk/            # Patient kiosk (public, touch-screen)
│   │   ├── page.tsx      # DOB entry
│   │   ├── verify/       # Identity confirm
│   │   ├── register/     # New patient registration wizard
│   │   ├── update-info/  # Contact/insurance update
│   │   ├── videos/       # Educational video player
│   │   ├── consent/      # Digital signature consent forms
│   │   └── done/         # Check-in complete screen
│   ├── consent/          # Legacy consent flow (public)
│   └── ...               # Protected clinical pages (staff)
├── lib/
│   ├── audit.ts          # HIPAA audit logging
│   ├── hipaaHeaders.ts   # Security response headers
│   ├── db.ts             # Prisma client singleton
│   └── auth/             # Auth utilities
├── prisma/               # Database schema & migrations
├── proxy.ts              # Auth middleware (JWT enforcement)
├── HIPAA.md              # Compliance documentation
├── KIOSK.md              # Patient kiosk documentation
└── .env.example          # Environment variable template
```

---

## HIPAA Compliance

This application implements technical safeguards required by the HIPAA Security Rule:

- **Access Control** — JWT-based authentication with role enforcement
- **Audit Controls** — All PHI access logged to `AuditLog` table
- **Transmission Security** — HSTS headers enforce HTTPS
- **PHI Minimization** — Non-sequential IDs (nanoid), no PHI in URLs or logs
- **Public Kiosk Isolation** — `/kiosk/*` routes are public but capture no credentials; PHI is fetched via short-lived session storage only

See [HIPAA.md](./HIPAA.md) for full compliance documentation, PHI inventory, and pre-production checklist.

---

## Deployment

### Vercel (Recommended for development/staging)

```bash
npm i -g vercel
vercel
```

Set environment variables in Vercel dashboard. **For HIPAA production deployments, a Vercel Enterprise plan with BAA is required.**

### Production Checklist

- [ ] Strong `JWT_SECRET` set in production environment
- [ ] Database encrypted at rest
- [ ] BAA executed with all vendors handling PHI
- [ ] HTTPS enforced
- [ ] Kiosk device locked to `/kiosk` URL (kiosk browser mode)
- [ ] See full checklist in [HIPAA.md](./HIPAA.md)

---

## License

Private — All rights reserved. Not for public distribution.
