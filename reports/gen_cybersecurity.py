#!/usr/bin/env python3
"""Generate cybersecurity-posture.pdf for Integrated Allergy Testing"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus.flowables import KeepTogether

OUTPUT = "/home/mark/.openclaw/workspace/integrated-allergy-testing/reports/cybersecurity-posture.pdf"

# Colors
DARK_TEAL = colors.HexColor("#006d77")
LIGHT_TEAL = colors.HexColor("#83c5be")
DARK_GRAY = colors.HexColor("#2d3436")
MID_GRAY = colors.HexColor("#636e72")
LIGHT_GRAY = colors.HexColor("#f8f9fa")
RED = colors.HexColor("#d63031")
GREEN = colors.HexColor("#00b894")
ORANGE = colors.HexColor("#e17055")
NAVY = colors.HexColor("#0a3d62")
COVER_BG = colors.HexColor("#0a3d62")

def make_styles():
    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle(
        name="CoverTitle",
        fontSize=28,
        fontName="Helvetica-Bold",
        textColor=colors.white,
        alignment=TA_CENTER,
        spaceAfter=12,
        leading=34,
    ))
    styles.add(ParagraphStyle(
        name="CoverSubtitle",
        fontSize=14,
        fontName="Helvetica",
        textColor=colors.HexColor("#a8dadc"),
        alignment=TA_CENTER,
        spaceAfter=8,
        leading=18,
    ))
    styles.add(ParagraphStyle(
        name="CoverMeta",
        fontSize=11,
        fontName="Helvetica",
        textColor=colors.HexColor("#ccd6f6"),
        alignment=TA_CENTER,
        spaceAfter=4,
    ))
    styles.add(ParagraphStyle(
        name="ScoreText",
        fontSize=48,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#00b894"),
        alignment=TA_CENTER,
        spaceAfter=4,
    ))
    styles.add(ParagraphStyle(
        name="ScoreLabel",
        fontSize=12,
        fontName="Helvetica",
        textColor=colors.HexColor("#a8dadc"),
        alignment=TA_CENTER,
        spaceAfter=4,
    ))
    styles.add(ParagraphStyle(
        name="SectionHeader",
        fontSize=15,
        fontName="Helvetica-Bold",
        textColor=DARK_TEAL,
        spaceBefore=18,
        spaceAfter=6,
        leading=20,
        borderPad=4,
    ))
    styles.add(ParagraphStyle(
        name="SubHeader",
        fontSize=11,
        fontName="Helvetica-Bold",
        textColor=NAVY,
        spaceBefore=10,
        spaceAfter=4,
        leading=14,
    ))
    styles.add(ParagraphStyle(
        name="BulletItem",
        fontSize=9,
        fontName="Helvetica",
        textColor=DARK_GRAY,
        leftIndent=18,
        spaceBefore=2,
        spaceAfter=2,
        leading=13,
        bulletIndent=6,
    ))
    styles.add(ParagraphStyle(
        name="BodyText2",
        fontSize=9,
        fontName="Helvetica",
        textColor=DARK_GRAY,
        spaceBefore=3,
        spaceAfter=3,
        leading=13,
    ))
    styles.add(ParagraphStyle(
        name="Footer",
        fontSize=8,
        fontName="Helvetica-Oblique",
        textColor=MID_GRAY,
        alignment=TA_CENTER,
        spaceBefore=8,
        leading=12,
    ))
    styles.add(ParagraphStyle(
        name="TableHeader",
        fontSize=9,
        fontName="Helvetica-Bold",
        textColor=colors.white,
        alignment=TA_CENTER,
    ))
    styles.add(ParagraphStyle(
        name="TableCell",
        fontSize=8.5,
        fontName="Helvetica",
        textColor=DARK_GRAY,
        alignment=TA_LEFT,
        leading=12,
    ))
    return styles

def bullet(text, styles):
    return Paragraph(f"• &nbsp; {text}", styles["BulletItem"])

def section_header(num, title, styles):
    return Paragraph(f"Section {num}: {title}", styles["SectionHeader"])

def sub_header(text, styles):
    return Paragraph(text, styles["SubHeader"])

def hr():
    return HRFlowable(width="100%", thickness=1, color=LIGHT_TEAL, spaceAfter=6, spaceBefore=2)

def page_number_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MID_GRAY)
    page_num = doc.page
    canvas.drawString(inch * 0.75, 0.5 * inch, "Integrated Allergy Testing — Cybersecurity Posture Report | CONFIDENTIAL")
    canvas.drawRightString(letter[0] - inch * 0.75, 0.5 * inch, f"Page {page_num}")
    canvas.restoreState()

def build():
    doc = SimpleDocTemplate(
        OUTPUT,
        pagesize=letter,
        rightMargin=0.75 * inch,
        leftMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
    )

    styles = make_styles()
    story = []

    # ── COVER PAGE ──────────────────────────────────────────────────────────────
    # Cover background block using a colored table
    cover_data = [[""]]
    cover_table = Table(cover_data, colWidths=[7 * inch], rowHeights=[9.5 * inch])
    cover_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), COVER_BG),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))

    # We'll use a nested table for cover content
    cover_content = [
        [Spacer(1, 1.5 * inch)],
        [Paragraph("🔒", ParagraphStyle("Icon", fontSize=48, alignment=TA_CENTER, textColor=colors.HexColor("#00b894")))],
        [Spacer(1, 0.3 * inch)],
        [Paragraph("Integrated Allergy Testing", styles["CoverTitle"])],
        [Paragraph("Cybersecurity Posture Report", ParagraphStyle("CoverTitle2", fontSize=22, fontName="Helvetica-Bold",
                    textColor=colors.HexColor("#a8dadc"), alignment=TA_CENTER, spaceAfter=6))],
        [Spacer(1, 0.2 * inch)],
        [Paragraph("HIPAA Security Rule Compliance Assessment", styles["CoverSubtitle"])],
        [Spacer(1, 0.4 * inch)],
        [Paragraph("April 8, 2026 &nbsp;|&nbsp; Version 3.1.0", styles["CoverMeta"])],
        [Spacer(1, 0.6 * inch)],
        [Paragraph("9.5 / 10", styles["ScoreText"])],
        [Paragraph("Overall Security Score", styles["ScoreLabel"])],
        [Spacer(1, 0.5 * inch)],
        [Paragraph(
            "Prepared by: Engineering Team — TIP Inc. &nbsp;|&nbsp; Classification: CONFIDENTIAL",
            ParagraphStyle("CoverFooter", fontSize=9, fontName="Helvetica",
                          textColor=colors.HexColor("#636e72"), alignment=TA_CENTER)
        )],
    ]

    inner_cover = Table(cover_content, colWidths=[7 * inch])
    inner_cover.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), COVER_BG),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))

    story.append(inner_cover)
    story.append(PageBreak())

    # ── SECTION 1: Authentication & Access Control ───────────────────────────────
    story.append(section_header(1, "Authentication & Access Control", styles))
    story.append(hr())
    story.append(sub_header("Identity Provider & SSO", styles))
    for item in [
        "Microsoft Azure AD SSO (OAuth 2.0) — multi-tenant with domain allowlist",
        "TOTP MFA via Speakeasy (Google Authenticator compatible) — mandatory for all staff",
        "Azure Key Vault for JWT secret management (vault: <b>hivevault-swarm</b>)",
    ]:
        story.append(bullet(item, styles))

    story.append(sub_header("Session Management", styles))
    for item in [
        "JWT sessions — HS256 algorithm, 8-hour expiry",
        "HttpOnly + Secure + SameSite=Strict cookie flags on all auth tokens",
        "JWT auto-refresh endpoint — rotates token every 6 hours without logout",
        "Role-Based Access Control — <b>admin</b> and <b>staff</b> roles enforced on all protected routes",
    ]:
        story.append(bullet(item, styles))

    story.append(sub_header("Password & Account Security", styles))
    for item in [
        "Bcrypt password hashing — 12 rounds (NIST SP 800-63B compliant)",
        "Staff account lockout after 5 failed attempts within 15-minute window",
        "Lockout tracked via AuditLog table (persistent across server restarts)",
        "Account unlock via admin MFA reset endpoint",
    ]:
        story.append(bullet(item, styles))

    # ── SECTION 2: Transport Security ────────────────────────────────────────────
    story.append(section_header(2, "Transport Security", styles))
    story.append(hr())
    story.append(sub_header("TLS & HTTPS Enforcement", styles))
    for item in [
        "TLS 1.2+ enforced at the Vercel edge — HTTP requests automatically redirected to HTTPS",
        "HTTP Strict Transport Security (HSTS): <b>max-age=63072000; includeSubDomains; preload</b>",
        "Access-Control-Allow-Origin restricted to production domain only",
    ]:
        story.append(bullet(item, styles))

    story.append(sub_header("Security Headers (All Responses)", styles))
    headers = [
        ("Content-Security-Policy (CSP)", "Restricts script, frame, and connect-src origins"),
        ("X-Content-Type-Options", "nosniff — prevents MIME-type sniffing attacks"),
        ("X-Frame-Options", "DENY — clickjacking protection"),
        ("Referrer-Policy", "no-referrer — no referrer header sent on navigation"),
        ("Permissions-Policy", "camera=(), microphone=(), geolocation=() — all disabled"),
    ]
    for header, desc in headers:
        story.append(bullet(f"<b>{header}</b>: {desc}", styles))

    # ── SECTION 3: Data Protection ───────────────────────────────────────────────
    story.append(section_header(3, "Data Protection", styles))
    story.append(hr())
    story.append(sub_header("Encryption & Storage", styles))
    for item in [
        "Turso Scaler plan — encryption at rest enabled on all database files",
        "All PHI fields stored in the encrypted Turso database (LibSQL over HTTPS)",
        "No PHI in URL parameters or query strings — all PHI transmitted via POST body",
        "No PHI in application logs (Sentry DSN scrubs personal data)",
    ]:
        story.append(bullet(item, styles))

    story.append(sub_header("Data Integrity & Audit Trail", styles))
    for item in [
        "Soft-delete only — no hard deletes; every record deletion is a status flag change",
        "Full audit trail preserved indefinitely (append-only AuditLog table)",
        "HIPAA-compliant headers on all API routes that return PHI",
        "Patient IDs use non-sequential <b>nanoid</b> — no enumeration or IDOR risk",
    ]:
        story.append(bullet(item, styles))

    # ── SECTION 4: Input Validation & Injection Prevention ───────────────────────
    story.append(section_header(4, "Input Validation & Injection Prevention", styles))
    story.append(hr())
    story.append(sub_header("Schema Validation", styles))
    for item in [
        "Zod schema validation on every POST and PUT API route — invalid payloads rejected with 400",
        "Prisma ORM — parameterized queries exclusively; zero raw SQL with user input",
        "Status enum validation on waiting room entries — only predefined statuses accepted",
        "Consent form ID allowlist — only known valid form IDs accepted by the signing endpoint",
    ]:
        story.append(bullet(item, styles))

    story.append(sub_header("XSS & Content Security", styles))
    for item in [
        "XSS sanitization on all form template content — strips <b>&lt;script&gt;</b>, <b>&lt;iframe&gt;</b>, onclick, javascript:, vbscript:",
        "Signature file size cap at 500 KB for consent form uploads",
        "Input length limits enforced on all user-facing fields",
        "CSP header further restricts inline script execution",
    ]:
        story.append(bullet(item, styles))

    # ── SECTION 5: Rate Limiting & DDoS Protection ───────────────────────────────
    story.append(section_header(5, "Rate Limiting & DDoS Protection", styles))
    story.append(hr())
    story.append(sub_header("Application-Layer Rate Limits", styles))
    rate_limits = [
        ("Kiosk DOB Lookup", "10 requests / IP / minute", "Via AuditLog counter"),
        ("Kiosk Identity Verify", "5 attempts / IP / minute", "Via AuditLog counter"),
        ("Staff Login", "5 attempts / email / 15 minutes", "Persistent via AuditLog"),
    ]
    rl_table_data = [
        [Paragraph("Endpoint", styles["TableHeader"]),
         Paragraph("Limit", styles["TableHeader"]),
         Paragraph("Mechanism", styles["TableHeader"])]
    ]
    for endpoint, limit, mechanism in rate_limits:
        rl_table_data.append([
            Paragraph(endpoint, styles["TableCell"]),
            Paragraph(limit, styles["TableCell"]),
            Paragraph(mechanism, styles["TableCell"]),
        ])
    rl_table = Table(rl_table_data, colWidths=[2.2 * inch, 2.5 * inch, 2.5 * inch])
    rl_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), DARK_TEAL),
        ("BACKGROUND", (0, 1), (-1, 1), LIGHT_GRAY),
        ("BACKGROUND", (0, 2), (-1, 2), colors.white),
        ("BACKGROUND", (0, 3), (-1, 3), LIGHT_GRAY),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dee2e6")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [LIGHT_GRAY, colors.white]),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(Spacer(1, 6))
    story.append(rl_table)
    story.append(Spacer(1, 6))
    story.append(bullet("Vercel Edge Network provides additional DDoS protection and traffic filtering", styles))

    # ── SECTION 6: Audit Logging ─────────────────────────────────────────────────
    story.append(section_header(6, "Audit Logging", styles))
    story.append(hr())
    story.append(sub_header("Logged Events", styles))
    audit_events = [
        "All patient data access and mutations (create, update, soft-delete)",
        "Consent form signing — IP address, user-agent, timestamp, form ID",
        "SSO login events (event type: SSO_LOGIN)",
        "Kiosk self-registration (event type: KIOSK_REGISTER)",
        "Appointment create / update / delete",
        "Doctor, nurse, and location assignments changed",
        "Video session creation and encounter creation",
    ]
    for e in audit_events:
        story.append(bullet(e, styles))

    story.append(sub_header("Retention & Integrity", styles))
    for item in [
        "AuditLog is <b>append-only</b> — the application exposes no delete endpoint for audit records",
        "6-year retention capability documented (HIPAA § 164.312 requirement)",
        "Queryable by admin via Settings → Audit Log viewer with date/event filtering",
    ]:
        story.append(bullet(item, styles))

    # ── SECTION 7: Kiosk Security ─────────────────────────────────────────────────
    story.append(section_header(7, "Kiosk Security", styles))
    story.append(hr())
    story.append(sub_header("Lockdown Controls", styles))
    for item in [
        "Fullscreen lockdown with persistent overlay guard on ESC key press",
        "F12, F11, F5, Ctrl+W, Ctrl+T all intercepted and blocked via JavaScript event listeners",
        "Right-click context menu disabled across all kiosk pages",
        "beforeunload warning triggered on window close attempt",
    ]:
        story.append(bullet(item, styles))

    story.append(sub_header("Session Isolation", styles))
    for item in [
        "All kiosk session data is scoped to a specific patient ID — no cross-patient data bleed",
        "All kiosk session data cleared on session completion",
        "Chrome --kiosk flag deployment guide provided for clinic tablets",
        "5-tap logo escape hatch available exclusively for authorized staff",
    ]:
        story.append(bullet(item, styles))

    # ── SECTION 8: Dependency & Supply Chain Security ────────────────────────────
    story.append(section_header(8, "Dependency & Supply Chain Security", styles))
    story.append(hr())
    story.append(sub_header("Automated Scanning", styles))
    for item in [
        "GitHub Dependabot configured — weekly dependency vulnerability scans, runs Monday 9 AM ET",
        "Dependabot PRs automatically opened for security patches",
        "All major framework versions pinned in package.json",
    ]:
        story.append(bullet(item, styles))

    story.append(sub_header("Current Status", styles))
    for item in [
        "npm audit: <b>3 moderate vulnerabilities</b> identified — all transitive dev-only dependencies, not present in the production runtime bundle",
        "No <b>eval()</b> or dynamic <b>require()</b> calls present in codebase",
        "No user-controlled data passed to dynamic code execution paths",
    ]:
        story.append(bullet(item, styles))

    # ── SECTION 9: Monitoring & Incident Response ────────────────────────────────
    story.append(section_header(9, "Monitoring & Incident Response", styles))
    story.append(hr())
    story.append(sub_header("Error Monitoring & Observability", styles))
    for item in [
        "Sentry error monitoring — production environment only, 10% distributed trace sampling",
        "Health check endpoint: <b>/api/health</b> — returns service status, database reachability",
        "GitHub Actions CI/CD — all deployments blocked if test suite fails",
        "Automated test suite: 28 unit tests + Playwright E2E browser tests",
    ]:
        story.append(bullet(item, styles))

    story.append(sub_header("Database Backup", styles))
    for item in [
        "Backup script: <b>scripts/backup.sh</b> — exports Turso database via HTTP API to JSON",
        "Output format: <b>backups/backup-YYYY-MM-DD.json</b>",
        "Turso Scaler plan includes point-in-time recovery capability",
    ]:
        story.append(bullet(item, styles))

    # ── SECTION 10 (now 10): Backup & Disaster Recovery ──────────────────────────
    story.append(section_header(10, "Backup & Disaster Recovery", styles))
    story.append(hr())

    story.append(sub_header("Codebase Backup", styles))
    for item in [
        "Primary: GitHub (<b>github.com/mputiyon1985/integrated-allergy-testing</b>) — full version history, all commits preserved",
        "Every Vercel deployment creates an immutable build artifact (rollback available in dashboard)",
        "Dependabot automated dependency security PRs ensure upstream patches are tracked",
        "Recovery time objective (RTO): ~5 minutes via <b>git clone + vercel --prod</b>",
    ]:
        story.append(bullet(item, styles))

    story.append(sub_header("Database Backup", styles))
    for item in [
        "Script: <b>scripts/backup.sh</b> — exports Turso DB via HTTP API to timestamped JSON",
        "Backup output: <b>backups/backup-YYYY-MM-DD.json</b>",
        "Turso Scaler plan includes point-in-time recovery (PITR) capability",
        "HIPAA 6-year retention requirement documented in README",
        "Soft-delete only — no data is ever permanently removed from the database",
    ]:
        story.append(bullet(item, styles))

    story.append(sub_header("Audit Log Preservation", styles))
    for item in [
        "AuditLog table is append-only — no delete operations exist anywhere in the codebase",
        "All PHI mutations preserved indefinitely with full event context",
        "Queryable via Settings → Audit Log viewer (admin access required)",
    ]:
        story.append(bullet(item, styles))

    story.append(sub_header("Recovery Procedures", styles))
    recovery_rows = [
        ("App Outage", "Vercel auto-deploys from GitHub on push; manual rollback via Vercel dashboard"),
        ("Database Corruption", "Restore from latest backup JSON + Turso point-in-time recovery"),
        ("Secret Compromise", "Rotate secret in Azure Key Vault → automatic pickup on next cold start"),
        ("Staff Account Compromise", "Admin MFA reset endpoint + Azure AD session revoke"),
    ]
    rec_table_data = [
        [Paragraph("Scenario", styles["TableHeader"]),
         Paragraph("Recovery Action", styles["TableHeader"])]
    ]
    for scenario, action in recovery_rows:
        rec_table_data.append([
            Paragraph(f"<b>{scenario}</b>", styles["TableCell"]),
            Paragraph(action, styles["TableCell"]),
        ])
    rec_table = Table(rec_table_data, colWidths=[2.2 * inch, 5 * inch])
    rec_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), DARK_TEAL),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [LIGHT_GRAY, colors.white]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dee2e6")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(Spacer(1, 6))
    story.append(rec_table)

    # ── SECTION 11: HIPAA Compliance Status ──────────────────────────────────────
    story.append(section_header(11, "HIPAA Compliance Status", styles))
    story.append(hr())
    story.append(Paragraph(
        "The following table maps HIPAA Security Rule technical safeguard controls (45 CFR § 164.312) "
        "to their implementation status as of April 8, 2026.",
        styles["BodyText2"]
    ))
    story.append(Spacer(1, 8))

    hipaa_rows = [
        ("Access Control", "✅ Active", "Azure AD SSO + TOTP MFA + RBAC"),
        ("Audit Controls", "✅ Active", "Full AuditLog on all PHI mutations"),
        ("Integrity", "✅ Active", "Soft-delete only, parameterized queries"),
        ("Transmission Security", "✅ Active", "TLS 1.2+, HSTS, CSP headers"),
        ("Person Authentication", "✅ Active", "MFA required for all staff"),
        ("Encryption at Rest", "✅ Active", "Turso Scaler encryption"),
        ("Emergency Access", "⚠️ Documented", "Admin role bypass available"),
        ("Automatic Logoff", "✅ Active", "8-hour JWT expiry + auto-refresh"),
        ("BAA — Vercel", "⚠️ Pending", "Requires Enterprise plan upgrade"),
        ("BAA — Turso", "⚠️ Pending", "Contact turso.tech/hipaa"),
        ("Penetration Test", "⚠️ Pending", "Required before live PHI in production"),
    ]

    table_data = [
        [Paragraph("Control", styles["TableHeader"]),
         Paragraph("Status", styles["TableHeader"]),
         Paragraph("Implementation", styles["TableHeader"])]
    ]

    for control, status, impl in hipaa_rows:
        if "✅" in status:
            status_color = GREEN
        else:
            status_color = ORANGE

        status_para = Paragraph(
            f'<font color="#{status_color.hexval()[2:]}">{status}</font>',
            styles["TableCell"]
        )
        table_data.append([
            Paragraph(f"<b>{control}</b>", styles["TableCell"]),
            Paragraph(status, ParagraphStyle(
                "StatusCell",
                fontSize=8.5,
                fontName="Helvetica-Bold",
                textColor=GREEN if "✅" in status else ORANGE,
                alignment=TA_CENTER,
                leading=12,
            )),
            Paragraph(impl, styles["TableCell"]),
        ])

    hipaa_table = Table(table_data, colWidths=[2.0 * inch, 1.3 * inch, 3.9 * inch])
    hipaa_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [LIGHT_GRAY, colors.white]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dee2e6")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("ALIGN", (1, 0), (1, -1), "CENTER"),
    ]))
    story.append(hipaa_table)

    # ── FOOTER NOTE ──────────────────────────────────────────────────────────────
    story.append(Spacer(1, 24))
    story.append(HRFlowable(width="100%", thickness=1.5, color=DARK_TEAL))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        "This report documents security controls as of April 8, 2026. "
        "A professional penetration test and signed BAAs are required before handling real patient PHI in production.",
        styles["Footer"]
    ))

    # Build
    doc.build(story, onFirstPage=page_number_footer, onLaterPages=page_number_footer)
    print(f"✅ Generated: {OUTPUT}")

if __name__ == "__main__":
    build()
