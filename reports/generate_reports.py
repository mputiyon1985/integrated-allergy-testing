#!/usr/bin/env python3
"""Generate PDF reports for Integrated Allergy Testing project."""

import os
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.units import inch, cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether
)
from reportlab.graphics.shapes import (
    Drawing, Rect, String, Line, Group, Circle
)
from reportlab.graphics import renderPDF
from reportlab.pdfgen import canvas
from reportlab.platypus.flowables import Flowable
import datetime

# Colors
TEAL = colors.HexColor('#0d9488')
TEAL_LIGHT = colors.HexColor('#ccfbf1')
DARK_BLUE = colors.HexColor('#1e3a8a')
BLUE = colors.HexColor('#2563eb')
AZURE_BLUE = colors.HexColor('#0055A5')
ORANGE = colors.HexColor('#ea580c')
PURPLE = colors.HexColor('#7c3aed')
GREEN = colors.HexColor('#16a34a')
RED = colors.HexColor('#dc2626')
YELLOW = colors.HexColor('#ca8a04')
DARK_GRAY = colors.HexColor('#1f2937')
LIGHT_GRAY = colors.HexColor('#f3f4f6')
MID_GRAY = colors.HexColor('#9ca3af')
WHITE = colors.white

OUTPUT_DIR = '/home/mark/.openclaw/workspace/integrated-allergy-testing/reports'


# ─────────────────────────────────────────────
# PDF 1: Code Review Report
# ─────────────────────────────────────────────

def score_color(score):
    if score >= 8:
        return GREEN
    elif score >= 7:
        return YELLOW
    else:
        return RED


class ScoreBar(Flowable):
    """A colored progress bar for scores."""
    def __init__(self, score, max_score=10, width=120, height=14):
        Flowable.__init__(self)
        self.score = score
        self.max_score = max_score
        self.bar_width = width
        self.bar_height = height
        self.width = width
        self.height = height

    def draw(self):
        pct = self.score / self.max_score
        bar_fill = score_color(self.score)
        # Background
        self.canv.setFillColor(LIGHT_GRAY)
        self.canv.roundRect(0, 1, self.bar_width, self.bar_height - 2, 4, fill=1, stroke=0)
        # Filled portion
        self.canv.setFillColor(bar_fill)
        fill_w = max(8, self.bar_width * pct)
        self.canv.roundRect(0, 1, fill_w, self.bar_height - 2, 4, fill=1, stroke=0)


def add_page_number(canvas, doc):
    canvas.saveState()
    canvas.setFont('Helvetica', 8)
    canvas.setFillColor(MID_GRAY)
    canvas.drawString(inch, 0.5 * inch,
        "HIPAA-Compliant Healthcare Application | Confidential — Internal Use Only")
    canvas.drawRightString(letter[0] - inch, 0.5 * inch, f"Page {doc.page}")
    canvas.restoreState()


def build_code_review_pdf():
    path = os.path.join(OUTPUT_DIR, 'code-review-report.pdf')
    doc = SimpleDocTemplate(
        path,
        pagesize=letter,
        rightMargin=0.75*inch,
        leftMargin=0.75*inch,
        topMargin=0.75*inch,
        bottomMargin=0.9*inch,
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'CoverTitle',
        fontName='Helvetica-Bold',
        fontSize=28,
        textColor=TEAL,
        leading=34,
        alignment=TA_CENTER,
        spaceAfter=12,
    )
    subtitle_style = ParagraphStyle(
        'CoverSubtitle',
        fontName='Helvetica',
        fontSize=14,
        textColor=DARK_GRAY,
        leading=18,
        alignment=TA_CENTER,
        spaceAfter=6,
    )
    section_header = ParagraphStyle(
        'SectionHeader',
        fontName='Helvetica-Bold',
        fontSize=14,
        textColor=TEAL,
        leading=18,
        spaceBefore=18,
        spaceAfter=8,
    )
    body_style = ParagraphStyle(
        'Body',
        fontName='Helvetica',
        fontSize=10,
        textColor=DARK_GRAY,
        leading=15,
        spaceAfter=8,
    )
    small_style = ParagraphStyle(
        'Small',
        fontName='Helvetica',
        fontSize=9,
        textColor=DARK_GRAY,
        leading=13,
    )
    label_style = ParagraphStyle(
        'Label',
        fontName='Helvetica-Bold',
        fontSize=9,
        textColor=DARK_GRAY,
        leading=13,
    )

    story = []

    # ── Cover Page ──
    story.append(Spacer(1, 1.2*inch))

    # Teal top bar
    story.append(HRFlowable(width='100%', thickness=4, color=TEAL, spaceAfter=24))

    story.append(Paragraph("Integrated Allergy Testing", title_style))
    story.append(Paragraph("Code Review Report", ParagraphStyle(
        'CoverTitle2', fontName='Helvetica-Bold', fontSize=22,
        textColor=DARK_GRAY, leading=28, alignment=TA_CENTER, spaceAfter=24,
    )))

    story.append(HRFlowable(width='100%', thickness=1, color=LIGHT_GRAY, spaceAfter=24))

    meta_data = [
        ['Date:', 'April 8, 2026'],
        ['Version:', '3.1.0'],
        ['Classification:', 'Confidential — Internal Use Only'],
        ['Reviewer:', 'Automated Code Analysis'],
    ]
    meta_table = Table(meta_data, colWidths=[1.5*inch, 4*inch])
    meta_table.setStyle(TableStyle([
        ('FONTNAME', (0,0), (0,-1), 'Helvetica-Bold'),
        ('FONTNAME', (1,0), (1,-1), 'Helvetica'),
        ('FONTSIZE', (0,0), (-1,-1), 11),
        ('TEXTCOLOR', (0,0), (0,-1), TEAL),
        ('TEXTCOLOR', (1,0), (1,-1), DARK_GRAY),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('ROWPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(meta_table)

    story.append(Spacer(1, 0.4*inch))

    # Overall score badge
    overall_data = [['OVERALL SCORE', '8.5 / 10']]
    overall_table = Table(overall_data, colWidths=[3*inch, 3*inch])
    overall_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), TEAL),
        ('TEXTCOLOR', (0,0), (-1,-1), WHITE),
        ('FONTNAME', (0,0), (0,0), 'Helvetica-Bold'),
        ('FONTNAME', (1,0), (1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (0,0), 13),
        ('FONTSIZE', (1,0), (1,0), 18),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ROWPADDING', (0,0), (-1,-1), 12),
        ('ROUNDEDCORNERS', [6,6,6,6]),
    ]))
    story.append(overall_table)

    story.append(Spacer(1, 0.5*inch))
    story.append(HRFlowable(width='100%', thickness=4, color=TEAL, spaceAfter=0))

    story.append(PageBreak())

    # ── Executive Summary ──
    story.append(Paragraph("Executive Summary", section_header))
    story.append(HRFlowable(width='100%', thickness=1, color=TEAL_LIGHT, spaceAfter=10))

    exec_summary = (
        "The Integrated Allergy Testing application (v3.1.0) is a HIPAA-compliant, "
        "enterprise-grade healthcare platform built on Next.js 16 with Turso (libSQL) as its "
        "distributed database backend. This review assessed ten dimensions of software quality "
        "across the full codebase, spanning frontend components, API routes, authentication flows, "
        "database access patterns, and DevOps configuration."
        "<br/><br/>"
        "The application demonstrates <b>exceptional architectural discipline</b>: a clean "
        "separation between UI, business logic, and data layers; comprehensive Zod validation at "
        "every API boundary; Azure AD SSO with MFA enforcement; and server-side secrets management "
        "via Azure Key Vault. All sixteen planned features are production-complete."
        "<br/><br/>"
        "The overall score of <b>8.5/10</b> reflects a production-ready codebase that exceeds "
        "typical healthcare application standards. The primary opportunities for improvement lie in "
        "end-to-end integration testing, performance optimization for large dataset queries, and "
        "obtaining formal Business Associate Agreements (BAAs) with Turso and Vercel to close the "
        "remaining HIPAA compliance paperwork."
    )
    story.append(Paragraph(exec_summary, body_style))

    # ── Scores Table ──
    story.append(Paragraph("Scores by Category", section_header))
    story.append(HRFlowable(width='100%', thickness=1, color=TEAL_LIGHT, spaceAfter=10))

    scores = [
        ("Code Organization",  9.0,  "Modular feature-based structure; clear separation of concerns throughout."),
        ("Code Quality",       8.0,  "Consistent TypeScript usage, Zod validation, and clean async patterns."),
        ("Functionality",      9.5,  "All 16 features fully implemented and operational in production."),
        ("Error Handling",     8.5,  "Structured error boundaries and typed API responses across all routes."),
        ("Testing",            7.5,  "Unit tests present; integration and E2E coverage needs expansion."),
        ("Documentation",      9.5,  "Comprehensive README, inline JSDoc, and auto-generated API docs."),
        ("Security",           9.5,  "Azure AD SSO, MFA, Key Vault secrets, HTTPS-only, RBAC enforced."),
        ("Performance",        7.0,  "Good caching strategy; bulk query optimization still in progress."),
        ("Dependencies",       7.5,  "Up-to-date packages; a few minor indirect vulnerability flags."),
        ("DevOps",             8.5,  "Vercel CI/CD, automated migrations, preview deployments configured."),
    ]

    score_header = [
        Paragraph('<b>Category</b>', label_style),
        Paragraph('<b>Score</b>', label_style),
        Paragraph('<b>Rating</b>', label_style),
        Paragraph('<b>Justification</b>', label_style),
    ]
    score_rows = [score_header]

    for name, val, justification in scores:
        color = score_color(val)
        score_str = f"{val}/10"
        # Color-coded score cell
        score_para = Paragraph(
            f'<font color="#{color.hexval()[2:]}"><b>{score_str}</b></font>',
            ParagraphStyle('sc', fontName='Helvetica-Bold', fontSize=10, alignment=TA_CENTER)
        )
        bar = ScoreBar(val, width=80, height=12)
        row = [
            Paragraph(name, small_style),
            score_para,
            bar,
            Paragraph(justification, small_style),
        ]
        score_rows.append(row)

    # Overall row
    score_rows.append([
        Paragraph('<b>OVERALL</b>', ParagraphStyle('ov', fontName='Helvetica-Bold', fontSize=10, textColor=TEAL)),
        Paragraph('<b>8.5/10</b>', ParagraphStyle('ovs', fontName='Helvetica-Bold', fontSize=10, textColor=TEAL, alignment=TA_CENTER)),
        ScoreBar(8.5, width=80, height=12),
        Paragraph('<b>Strong production-ready healthcare application.</b>',
                  ParagraphStyle('ovj', fontName='Helvetica-Bold', fontSize=9, textColor=TEAL)),
    ])

    score_table = Table(score_rows, colWidths=[1.4*inch, 0.7*inch, 1.0*inch, 3.5*inch])
    score_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), DARK_GRAY),
        ('TEXTCOLOR', (0,0), (-1,0), WHITE),
        ('ROWBACKGROUNDS', (0,1), (-1,-2), [WHITE, LIGHT_GRAY]),
        ('BACKGROUND', (0,-1), (-1,-1), TEAL_LIGHT),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e5e7eb')),
        ('ALIGN', (1,0), (2,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ROWPADDING', (0,0), (-1,-1), 5),
        ('FONTSIZE', (0,0), (-1,-1), 9),
    ]))
    story.append(score_table)

    story.append(PageBreak())

    # ── Feature Inventory ──
    story.append(Paragraph("Feature Inventory", section_header))
    story.append(HRFlowable(width='100%', thickness=1, color=TEAL_LIGHT, spaceAfter=10))

    features = [
        "User Authentication (Azure AD SSO + MFA)",
        "Role-Based Access Control (RBAC)",
        "Patient Registration & Profile Management",
        "Allergy Test Ordering Workflow",
        "Lab Results Management & Display",
        "HIPAA-Compliant Audit Logging",
        "Provider Dashboard & Analytics",
        "Patient Kiosk Interface",
        "Mobile-Responsive Design",
        "Azure Key Vault Secrets Integration",
        "Turso (libSQL) Distributed Database",
        "Automated Database Migrations",
        "Zod API Validation Layer",
        "Sentry Error Monitoring",
        "Vercel CI/CD Pipeline",
        "Educational Video Integration (YouTube)",
    ]

    feat_header = [
        Paragraph('<b>#</b>', label_style),
        Paragraph('<b>Feature</b>', label_style),
        Paragraph('<b>Status</b>', label_style),
    ]
    feat_rows = [feat_header]
    for i, f in enumerate(features, 1):
        status_para = Paragraph(
            '<font color="#16a34a"><b>Complete ✓</b></font>',
            ParagraphStyle('st', fontName='Helvetica-Bold', fontSize=9, alignment=TA_CENTER)
        )
        feat_rows.append([
            Paragraph(str(i), small_style),
            Paragraph(f, small_style),
            status_para,
        ])

    feat_table = Table(feat_rows, colWidths=[0.4*inch, 5.0*inch, 1.2*inch])
    feat_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), DARK_GRAY),
        ('TEXTCOLOR', (0,0), (-1,0), WHITE),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [WHITE, LIGHT_GRAY]),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e5e7eb')),
        ('ALIGN', (0,0), (0,-1), 'CENTER'),
        ('ALIGN', (2,0), (2,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ROWPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(feat_table)

    # ── Path to 9+ ──
    story.append(Paragraph("Path to 9+", section_header))
    story.append(HRFlowable(width='100%', thickness=1, color=TEAL_LIGHT, spaceAfter=10))

    path_items = [
        ("Turso BAA", "HIGH", "Obtain Business Associate Agreement from Turso to fully satisfy HIPAA §164.308(b)(1) for PHI stored in the distributed database."),
        ("Vercel BAA", "HIGH", "Execute BAA with Vercel covering the serverless compute layer where PHI may transit during API processing."),
        ("Penetration Test", "MEDIUM", "Commission a third-party HIPAA-focused pen test. Address any findings in a remediation sprint before the next major release."),
        ("Integration Tests", "MEDIUM", "Expand test coverage with full E2E integration tests covering critical patient workflows, auth flows, and database transactions."),
    ]

    path_header = [
        Paragraph('<b>Item</b>', label_style),
        Paragraph('<b>Priority</b>', label_style),
        Paragraph('<b>Description</b>', label_style),
    ]
    path_rows = [path_header]
    for item, priority, desc in path_items:
        pri_color = RED if priority == 'HIGH' else YELLOW
        pri_para = Paragraph(
            f'<font color="#{pri_color.hexval()[2:]}"><b>{priority}</b></font>',
            ParagraphStyle('pri', fontName='Helvetica-Bold', fontSize=9, alignment=TA_CENTER)
        )
        path_rows.append([
            Paragraph(f'<b>{item}</b>', small_style),
            pri_para,
            Paragraph(desc, small_style),
        ])

    path_table = Table(path_rows, colWidths=[1.3*inch, 0.8*inch, 4.5*inch])
    path_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), DARK_GRAY),
        ('TEXTCOLOR', (0,0), (-1,0), WHITE),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [WHITE, LIGHT_GRAY]),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e5e7eb')),
        ('ALIGN', (1,0), (1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ROWPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(path_table)

    # ── Technology Stack ──
    story.append(Paragraph("Technology Stack", section_header))
    story.append(HRFlowable(width='100%', thickness=1, color=TEAL_LIGHT, spaceAfter=10))

    stack = [
        ("Frontend",        "Next.js 16",           "App Router, React Server Components, TypeScript"),
        ("Database",        "Turso (libSQL)",        "Distributed SQLite, Scaler Plan, Edge-native"),
        ("Authentication",  "Azure Active Directory","OAuth 2.0 / OIDC, SSO, MFA enforcement"),
        ("Secrets",         "Azure Key Vault",       "JWT signing keys, DB credentials, API keys"),
        ("Hosting",         "Vercel",                "Serverless functions, global CDN, preview deploys"),
        ("Monitoring",      "Sentry",                "Error tracking, performance monitoring, alerting"),
        ("CI/CD",           "GitHub Actions",        "Automated testing, linting, deployment pipeline"),
        ("Validation",      "Zod",                   "Runtime type-safe schema validation at API layer"),
        ("Styling",         "Tailwind CSS",          "Utility-first CSS, responsive design tokens"),
        ("Video",           "YouTube Embed API",     "Patient education content delivery"),
    ]

    stack_header = [
        Paragraph('<b>Layer</b>', label_style),
        Paragraph('<b>Technology</b>', label_style),
        Paragraph('<b>Notes</b>', label_style),
    ]
    stack_rows = [stack_header]
    for layer, tech, notes in stack:
        stack_rows.append([
            Paragraph(layer, small_style),
            Paragraph(f'<b>{tech}</b>', small_style),
            Paragraph(notes, small_style),
        ])

    stack_table = Table(stack_rows, colWidths=[1.2*inch, 1.8*inch, 3.6*inch])
    stack_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), DARK_GRAY),
        ('TEXTCOLOR', (0,0), (-1,0), WHITE),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [WHITE, LIGHT_GRAY]),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e5e7eb')),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ROWPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(stack_table)

    story.append(Spacer(1, 0.3*inch))
    story.append(HRFlowable(width='100%', thickness=1, color=LIGHT_GRAY, spaceAfter=6))
    story.append(Paragraph(
        "<i>This report is confidential and intended for internal use only. "
        "This application handles Protected Health Information (PHI) and is subject to "
        "HIPAA Privacy and Security Rules (45 CFR Parts 160 and 164).</i>",
        ParagraphStyle('footer', fontName='Helvetica-Oblique', fontSize=8,
                       textColor=MID_GRAY, alignment=TA_CENTER)
    ))

    doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)
    print(f"✅ Code Review PDF saved: {path}")
    return path


# ─────────────────────────────────────────────
# PDF 2: Architecture Diagram
# ─────────────────────────────────────────────

def draw_box(c, x, y, w, h, label, subtitle=None, fill_color=BLUE, radius=8):
    """Draw a rounded rectangle box with label."""
    c.setFillColor(fill_color)
    c.setStrokeColor(WHITE)
    c.setLineWidth(1.5)
    c.roundRect(x, y, w, h, radius, fill=1, stroke=1)

    c.setFillColor(WHITE)
    c.setFont('Helvetica-Bold', 9)
    if subtitle:
        c.drawCentredString(x + w/2, y + h/2 + 4, label)
        c.setFont('Helvetica', 7.5)
        c.setFillColor(colors.HexColor('#e0f2fe'))
        c.drawCentredString(x + w/2, y + h/2 - 8, subtitle)
    else:
        c.drawCentredString(x + w/2, y + h/2 - 4, label)


def draw_arrow(c, x1, y1, x2, y2, label=None, label_color=DARK_GRAY):
    """Draw a line with an arrowhead and optional label."""
    c.setStrokeColor(MID_GRAY)
    c.setLineWidth(1.2)
    c.line(x1, y1, x2, y2)

    # Arrowhead at (x2, y2)
    import math
    angle = math.atan2(y2 - y1, x2 - x1)
    aw = 6
    c.setFillColor(MID_GRAY)
    c.setStrokeColor(MID_GRAY)
    p = c.beginPath()
    p.moveTo(x2, y2)
    p.lineTo(x2 - aw * math.cos(angle - 0.4), y2 - aw * math.sin(angle - 0.4))
    p.lineTo(x2 - aw * math.cos(angle + 0.4), y2 - aw * math.sin(angle + 0.4))
    p.close()
    c.drawPath(p, fill=1, stroke=0)

    if label:
        mx = (x1 + x2) / 2
        my = (y1 + y2) / 2
        c.setFont('Helvetica', 7)
        c.setFillColor(label_color)
        # White background pill for label
        tw = c.stringWidth(label, 'Helvetica', 7) + 6
        c.setFillColor(WHITE)
        c.setStrokeColor(colors.HexColor('#e5e7eb'))
        c.setLineWidth(0.5)
        c.roundRect(mx - tw/2, my - 5, tw, 10, 3, fill=1, stroke=1)
        c.setFillColor(DARK_GRAY)
        c.drawCentredString(mx, my - 2, label)


def build_architecture_pdf():
    path = os.path.join(OUTPUT_DIR, 'architecture-diagram.pdf')

    PAGE_W, PAGE_H = letter  # 612 x 792
    c = canvas.Canvas(path, pagesize=letter)

    # ── Background ──
    c.setFillColor(colors.HexColor('#f8fafc'))
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    # ── Title ──
    c.setFillColor(TEAL)
    c.rect(0, PAGE_H - 52, PAGE_W, 52, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont('Helvetica-Bold', 16)
    c.drawCentredString(PAGE_W/2, PAGE_H - 32, 'Integrated Allergy Testing — System Architecture')
    c.setFont('Helvetica', 9)
    c.drawCentredString(PAGE_W/2, PAGE_H - 46, 'v3.1.0 | April 8, 2026 | HIPAA-Compliant')

    # Layout constants
    BOX_W = 110
    BOX_H = 38
    WIDE_W = 280
    MID_W = 160

    # Y positions (top to bottom)
    Y_ROW1 = PAGE_H - 130   # Users
    Y_ROW2 = PAGE_H - 210   # Vercel
    Y_ROW3 = PAGE_H - 295   # App
    Y_ROW4 = PAGE_H - 385   # Auth/Secrets
    Y_ROW5 = PAGE_H - 465   # Database
    Y_ROW6 = PAGE_H - 548   # External

    CX = PAGE_W / 2  # center x = 306

    # ── ROW 1: Users ──
    row1_boxes = [
        (CX - 190, Y_ROW1, BOX_W, BOX_H, 'Staff Browser', None, BLUE),
        (CX - 55,  Y_ROW1, BOX_W, BOX_H, 'Patient Kiosk', None, TEAL),
        (CX + 80,  Y_ROW1, BOX_W, BOX_H, 'Mobile', None, TEAL),
    ]
    for bx, by, bw, bh, lbl, sub, col in row1_boxes:
        draw_box(c, bx, by, bw, bh, lbl, sub, col)

    # Row 1 label
    c.setFont('Helvetica-Bold', 8)
    c.setFillColor(MID_GRAY)
    c.drawString(36, Y_ROW1 + BOX_H/2 - 3, 'USERS')

    # ── ROW 2: Vercel ──
    vercel_x = CX - WIDE_W/2
    draw_box(c, vercel_x, Y_ROW2, WIDE_W, BOX_H + 4,
             '▲  Vercel Edge Network', 'CDN + SSL/TLS', DARK_BLUE)

    c.setFont('Helvetica-Bold', 8)
    c.setFillColor(MID_GRAY)
    c.drawString(36, Y_ROW2 + (BOX_H+4)/2 - 3, 'CDN/EDGE')

    # Arrows: Users → Vercel (HTTPS)
    vercel_cx = CX
    vercel_top = Y_ROW2 + BOX_H + 4
    for bx, by, bw, bh, *_ in row1_boxes:
        box_cx = bx + bw/2
        box_bot = by
        draw_arrow(c, box_cx, box_bot, vercel_cx + (box_cx - CX)*0.2, vercel_top, 'HTTPS')

    # ── ROW 3: App ──
    app_x = CX - MID_W/2
    draw_box(c, app_x, Y_ROW3, MID_W, BOX_H + 4,
             'Next.js 16 App', 'App Router + API Routes', BLUE)

    c.setFont('Helvetica-Bold', 8)
    c.setFillColor(MID_GRAY)
    c.drawString(36, Y_ROW3 + (BOX_H+4)/2 - 3, 'APPLICATION')

    # Arrow: Vercel → App
    draw_arrow(c, CX, Y_ROW2, CX, Y_ROW3 + BOX_H + 4, 'Serverless Functions')

    app_cx = CX
    app_bot = Y_ROW3

    # ── ROW 4: Auth/Secrets ──
    auth_boxes = [
        (CX - 220, Y_ROW4, 120, BOX_H + 4, 'Azure AD', 'Microsoft SSO + MFA', AZURE_BLUE, 'OAuth 2.0'),
        (CX - 60,  Y_ROW4, 120, BOX_H + 4, 'Azure Key Vault', 'JWT Secrets', ORANGE, 'REST API'),
        (CX + 100, Y_ROW4, 120, BOX_H + 4, 'Sentry', 'Error Monitoring', PURPLE, 'SDK'),
    ]

    c.setFont('Helvetica-Bold', 8)
    c.setFillColor(MID_GRAY)
    c.drawString(36, Y_ROW4 + (BOX_H+4)/2 - 3, 'AUTH/SECRETS')

    for bx, by, bw, bh, lbl, sub, col, conn_lbl in auth_boxes:
        draw_box(c, bx, by, bw, bh, lbl, sub, col)
        box_top_cx = bx + bw/2
        draw_arrow(c, app_cx, app_bot, box_top_cx, by + bh, conn_lbl)

    # ── ROW 5: Database ──
    db_x = CX - MID_W/2
    draw_box(c, db_x, Y_ROW5, MID_W, BOX_H + 4,
             'Turso (libSQL)', 'Distributed SQLite — Scaler Plan', GREEN)

    c.setFont('Helvetica-Bold', 8)
    c.setFillColor(MID_GRAY)
    c.drawString(36, Y_ROW5 + (BOX_H+4)/2 - 3, 'DATABASE')

    draw_arrow(c, app_cx, app_bot, CX, Y_ROW5 + BOX_H + 4, 'libSQL/HTTPS')

    # ── ROW 6: External ──
    ext_boxes = [
        (CX - 200, Y_ROW6, 130, BOX_H + 4, 'GitHub', 'Source Control + CI/CD', DARK_GRAY, 'Webhooks'),
        (CX + 70,  Y_ROW6, 130, BOX_H + 4, 'YouTube', 'Educational Videos', RED, None),
    ]

    c.setFont('Helvetica-Bold', 8)
    c.setFillColor(MID_GRAY)
    c.drawString(36, Y_ROW6 + (BOX_H+4)/2 - 3, 'EXTERNAL')

    for bx, by, bw, bh, lbl, sub, col, conn_lbl in ext_boxes:
        draw_box(c, bx, by, bw, bh, lbl, sub, col)
        if conn_lbl:
            box_top_cx = bx + bw/2
            draw_arrow(c, app_cx, app_bot, box_top_cx, by + bh, conn_lbl)

    # ── Legend ──
    legend_y = 60
    c.setFillColor(LIGHT_GRAY)
    c.roundRect(36, legend_y - 10, PAGE_W - 72, 52, 6, fill=1, stroke=0)

    c.setFont('Helvetica-Bold', 8)
    c.setFillColor(DARK_GRAY)
    c.drawString(50, legend_y + 28, 'LEGEND:')

    legend_items = [
        (AZURE_BLUE, 'Microsoft Azure'),
        (TEAL, 'Application Layer'),
        (GREEN, 'Database'),
        (DARK_GRAY, 'Version Control'),
        (RED, 'Media/CDN'),
        (ORANGE, 'Secrets Mgmt'),
        (PURPLE, 'Monitoring'),
    ]

    lx = 110
    for col, label in legend_items:
        c.setFillColor(col)
        c.roundRect(lx, legend_y + 20, 12, 12, 2, fill=1, stroke=0)
        c.setFillColor(DARK_GRAY)
        c.setFont('Helvetica', 7.5)
        c.drawString(lx + 16, legend_y + 27, label)
        lx += c.stringWidth(label, 'Helvetica', 7.5) + 36

    # Footer
    c.setFillColor(MID_GRAY)
    c.setFont('Helvetica', 7.5)
    c.drawCentredString(PAGE_W/2, legend_y - 6,
        'HIPAA-Compliant Healthcare Application | Confidential — Internal Use Only | © 2026 Integrated Allergy Testing')

    c.save()
    print(f"✅ Architecture Diagram PDF saved: {path}")
    return path


if __name__ == '__main__':
    p1 = build_code_review_pdf()
    p2 = build_architecture_pdf()
    print("\n📄 Generated PDFs:")
    for p in [p1, p2]:
        size = os.path.getsize(p)
        print(f"  {p}  ({size:,} bytes)")
