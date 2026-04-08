# Changelog

## [3.1.0] — 2026-04-08
### Added
- Encounter Records (SOAP notes) — full clinical visit documentation
- Encounter PDF generation with clinical summary
- Encounter history per patient (new tab)
- Encounters list page (/encounters)

## [3.0.0] — 2026-04-08
### Added
- Appointment Calendar with booking, edit, delete
- 8 Appointment Reason types with icons and colors
- Book Appointment buttons on dashboard and patient detail
- Microsoft Azure AD SSO (multi-tenant with domain allowlist)
- TOTP MFA enforcement for non-SSO staff
- Azure Key Vault integration for JWT secrets
- Kiosk fullscreen mode with overlay guard
- Chrome kiosk launcher scripts (Windows + Mac)
- Audit log viewer in Settings
- Comprehensive audit logging across all screens
- Patient Kiosk (DOB → Verify → Videos → Consent → Done)

## [2.3.1] — 2026-04-07
### Fixed
- Multiple security patches (4 critical, 6 high, 3 medium)
- CSP headers, CORS policy, JWT auto-refresh
- Waiting room dedup, soft deletes enforced everywhere

## [2.0.0] — 2026-04-07
### Added
- Full allergy testing matrix (Prick + Intradermal panels)
- Patient kiosk self-registration
- Consent forms with finger signature capture
- Waiting room dashboard
- Sentry error monitoring
- 28 automated tests + Playwright E2E
- CI/CD pipeline with GitHub Actions
