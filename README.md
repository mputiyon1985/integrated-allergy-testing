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
- 🔐 **HIPAA-Ready Security** — JWT auth, RBAC, audit logging, security headers
- 📋 **Audit Trail** — Every PHI access and modification logged for compliance
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

Open [http://localhost:3000](http://localhost:3000)

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
│   ├── login/            # Auth pages
│   ├── consent/          # Patient consent flow (public)
│   └── ...               # Protected clinical pages
├── lib/
│   ├── audit.ts          # HIPAA audit logging
│   ├── hipaaHeaders.ts   # Security response headers
│   ├── db.ts             # Prisma client singleton
│   └── auth/             # Auth utilities
├── prisma/               # Database schema & migrations
├── proxy.ts              # Auth middleware (JWT enforcement)
├── HIPAA.md              # Compliance documentation
└── .env.example          # Environment variable template
```

---

## HIPAA Compliance

This application implements technical safeguards required by the HIPAA Security Rule:

- **Access Control** — JWT-based authentication with role enforcement
- **Audit Controls** — All PHI access logged to `AuditLog` table
- **Transmission Security** — HSTS headers enforce HTTPS
- **PHI Minimization** — Non-sequential IDs (nanoid), no PHI in URLs or logs

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
- [ ] See full checklist in [HIPAA.md](./HIPAA.md)

---

## License

Private — All rights reserved. Not for public distribution.
