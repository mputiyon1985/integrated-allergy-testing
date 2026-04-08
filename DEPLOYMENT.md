# Deployment Guide

## Required GitHub Secrets (Settings → Secrets → Actions)
- `VERCEL_TOKEN` — Get from https://vercel.com/account/tokens

## Environments
- **Production:** `main` branch → auto-deploys via `vercel --prod`
- **Staging:** `develop` branch → deploys preview via `vercel`

## Manual Deploy
```bash
vercel --prod  # Production
vercel         # Staging/Preview
```

## Database
- Dev: SQLite at `prisma/dev.db`
- Production: Turso at `libsql://integrated-allergy-mputiyon1985.aws-us-east-1.turso.io`
