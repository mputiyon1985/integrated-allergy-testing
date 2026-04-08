#!/usr/bin/env python3
"""Generate source-code.pdf for Integrated Allergy Testing — prints all source files with syntax highlighting."""

import os
import re
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable, PageBreak
from reportlab.lib.enums import TA_LEFT, TA_CENTER

BASE = "/home/mark/.openclaw/workspace/integrated-allergy-testing"
OUTPUT = f"{BASE}/reports/source-code.pdf"

# Colors
TEAL = colors.HexColor("#0077aa")
GRAY_PATH = colors.HexColor("#888888")
DARK_BG = colors.HexColor("#f6f8fa")
DARK_GRAY = colors.HexColor("#24292e")
COMMENT_GREEN = colors.HexColor("#22863a")
STRING_BROWN = colors.HexColor("#032f62")
KEYWORD_RED = colors.HexColor("#d73a49")
TYPE_BLUE = colors.HexColor("#005cc5")
PAGE_BG = colors.white

def page_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(colors.HexColor("#888888"))
    canvas.drawString(inch * 0.75, 0.45 * inch, "Integrated Allergy Testing — Full Source Code")
    canvas.drawRightString(letter[0] - inch * 0.75, 0.45 * inch, f"Page {doc.page}")
    canvas.restoreState()

def escape_xml(text):
    """Escape XML special chars for ReportLab paragraphs."""
    text = text.replace("&", "&amp;")
    text = text.replace("<", "&lt;")
    text = text.replace(">", "&gt;")
    text = text.replace('"', "&quot;")
    return text

def colorize_line(raw_line):
    """
    Very lightweight syntax coloring:
    - Full-line comments (// ...) → green
    - Inline comments at end → green for the comment portion
    - Otherwise → dark gray
    Returns HTML-ish markup for ReportLab Paragraph.
    """
    # Preserve leading spaces by replacing with non-breaking spaces
    stripped = raw_line.rstrip("\n")
    
    # Count leading spaces
    leading = len(stripped) - len(stripped.lstrip(" "))
    indent = "&nbsp;" * leading
    content = stripped.lstrip(" ")
    
    # Escape XML
    content_esc = escape_xml(content)
    
    # Full-line comment
    if content.startswith("//") or content.startswith("*") or content.startswith("/*") or content.startswith("#"):
        return f'{indent}<font color="#{COMMENT_GREEN.hexval()[2:]}">{content_esc}</font>'
    
    # Check for inline comment
    # Simple heuristic: find " //" not inside a string
    # We'll do a basic split — not perfect but good for visual output
    comment_idx = -1
    in_single = False
    in_double = False
    i = 0
    while i < len(content):
        c = content[i]
        if c == "'" and not in_double:
            in_single = not in_single
        elif c == '"' and not in_single:
            in_double = not in_double
        elif c == "/" and not in_single and not in_double and i + 1 < len(content) and content[i+1] == "/":
            comment_idx = i
            break
        i += 1
    
    if comment_idx > 0:
        code_part = escape_xml(content[:comment_idx])
        comment_part = escape_xml(content[comment_idx:])
        return (
            f'{indent}'
            f'<font color="#{DARK_GRAY.hexval()[2:]}">{code_part}</font>'
            f'<font color="#{COMMENT_GREEN.hexval()[2:]}">{comment_part}</font>'
        )
    
    # Regular code line
    return f'{indent}<font color="#{DARK_GRAY.hexval()[2:]}">{content_esc}</font>'

def read_file_safe(path):
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            return f.readlines()
    except Exception as e:
        return [f"// ERROR READING FILE: {e}\n"]

def build():
    doc = SimpleDocTemplate(
        OUTPUT,
        pagesize=letter,
        rightMargin=0.6 * inch,
        leftMargin=0.6 * inch,
        topMargin=0.65 * inch,
        bottomMargin=0.65 * inch,
    )

    code_style = ParagraphStyle(
        "Code",
        fontName="Courier",
        fontSize=7.5,
        leading=10.5,
        textColor=DARK_GRAY,
        leftIndent=0,
        spaceAfter=0,
        spaceBefore=0,
        splitLongWords=True,
        wordWrap="CJK",
    )

    file_header_style = ParagraphStyle(
        "FileHeader",
        fontName="Helvetica-Bold",
        fontSize=11,
        textColor=TEAL,
        spaceBefore=8,
        spaceAfter=2,
        leading=14,
    )

    path_style = ParagraphStyle(
        "FilePath",
        fontName="Courier",
        fontSize=8,
        textColor=GRAY_PATH,
        spaceAfter=6,
        leading=10,
    )

    cover_title_style = ParagraphStyle(
        "CoverTitle",
        fontName="Helvetica-Bold",
        fontSize=26,
        textColor=TEAL,
        alignment=TA_CENTER,
        spaceAfter=10,
        spaceBefore=0,
    )
    cover_sub_style = ParagraphStyle(
        "CoverSub",
        fontName="Helvetica",
        fontSize=12,
        textColor=GRAY_PATH,
        alignment=TA_CENTER,
        spaceAfter=4,
    )

    story = []

    # ── COVER ────────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 2.5 * inch))
    story.append(Paragraph("Integrated Allergy Testing", cover_title_style))
    story.append(Paragraph("Full Source Code Document", cover_title_style))
    story.append(Spacer(1, 0.3 * inch))
    story.append(Paragraph("April 8, 2026  |  Version 3.1.0", cover_sub_style))
    story.append(Paragraph("All TypeScript &amp; TSX source files", cover_sub_style))
    story.append(Spacer(1, 0.3 * inch))
    story.append(HRFlowable(width="60%", thickness=2, color=TEAL, hAlign="CENTER"))
    story.append(Spacer(1, 0.2 * inch))
    story.append(Paragraph(
        "<font color='#888888'>Comments are rendered in green. Code in dark gray. "
        "Monospace font throughout.</font>",
        ParagraphStyle("CoverNote", fontName="Courier", fontSize=9, alignment=TA_CENTER,
                       textColor=GRAY_PATH)
    ))
    story.append(PageBreak())

    # ── FILE LIST ────────────────────────────────────────────────────────────────
    # Build ordered file list
    lib_files = sorted([
        f"{BASE}/lib/audit.ts",
        f"{BASE}/lib/auth/session.ts",
        f"{BASE}/lib/db.ts",
        f"{BASE}/lib/hipaaHeaders.ts",
        f"{BASE}/lib/keyVault.ts",
        f"{BASE}/lib/pdf.ts",
    ])

    schema_files = [f"{BASE}/prisma/schema.prisma"]

    api_files = sorted([
        f"{BASE}/app/api/allergens/route.ts",
        f"{BASE}/app/api/allergens/seed/route.ts",
        f"{BASE}/app/api/appointment-reasons/route.ts",
        f"{BASE}/app/api/appointment-reasons/[id]/route.ts",
        f"{BASE}/app/api/audit/route.ts",
        f"{BASE}/app/api/auth/[...nextauth]/route.ts",
        f"{BASE}/app/api/auth/azure-callback/route.ts",
        f"{BASE}/app/api/auth/login/route.ts",
        f"{BASE}/app/api/auth/logout/route.ts",
        f"{BASE}/app/api/auth/me/route.ts",
        f"{BASE}/app/api/auth/mfa-setup/route.ts",
        f"{BASE}/app/api/auth/mfa-verify/route.ts",
        f"{BASE}/app/api/auth/refresh/route.ts",
        f"{BASE}/app/api/clinic-hours/route.ts",
        f"{BASE}/app/api/consent/check/route.ts",
        f"{BASE}/app/api/consent/pdf/route.ts",
        f"{BASE}/app/api/consent/sign/route.ts",
        f"{BASE}/app/api/doctors/route.ts",
        f"{BASE}/app/api/doctors/[id]/route.ts",
        f"{BASE}/app/api/encounters/route.ts",
        f"{BASE}/app/api/encounters/[id]/route.ts",
        f"{BASE}/app/api/encounters/[id]/pdf/route.ts",
        f"{BASE}/app/api/forms/route.ts",
        f"{BASE}/app/api/forms/activity/route.ts",
        f"{BASE}/app/api/forms/pdf/route.ts",
        f"{BASE}/app/api/health/route.ts",
        f"{BASE}/app/api/iat-appointments/route.ts",
        f"{BASE}/app/api/iat-appointments/[id]/route.ts",
        f"{BASE}/app/api/kiosk/lookup/route.ts",
        f"{BASE}/app/api/kiosk/register/route.ts",
        f"{BASE}/app/api/kiosk/update-patient/route.ts",
        f"{BASE}/app/api/kiosk/verify/route.ts",
        f"{BASE}/app/api/kiosk/video-watched/route.ts",
        f"{BASE}/app/api/kiosk/videos-watched/route.ts",
        f"{BASE}/app/api/locations/route.ts",
        f"{BASE}/app/api/locations/[id]/route.ts",
        f"{BASE}/app/api/nurses/route.ts",
        f"{BASE}/app/api/nurses/[id]/route.ts",
        f"{BASE}/app/api/patients/route.ts",
        f"{BASE}/app/api/patients/[id]/route.ts",
        f"{BASE}/app/api/seed/route.ts",
        f"{BASE}/app/api/staff/route.ts",
        f"{BASE}/app/api/staff/[id]/reset-mfa/route.ts",
        f"{BASE}/app/api/test-results/route.ts",
        f"{BASE}/app/api/test-results/[id]/route.ts",
        f"{BASE}/app/api/videos/route.ts",
        f"{BASE}/app/api/videos/[id]/route.ts",
        f"{BASE}/app/api/videos/activity/route.ts",
        f"{BASE}/app/api/waiting-room/route.ts",
        f"{BASE}/app/api/waiting-room/[id]/route.ts",
    ])

    page_files = [
        f"{BASE}/app/layout.tsx",
        f"{BASE}/app/page.tsx",
        f"{BASE}/app/patients/page.tsx",
        f"{BASE}/app/patients/new/page.tsx",
        f"{BASE}/app/patients/[id]/page.tsx",
        f"{BASE}/app/calendar/page.tsx",
        f"{BASE}/app/encounters/page.tsx",
        f"{BASE}/app/kiosk/layout.tsx",
        f"{BASE}/app/kiosk/page.tsx",
        f"{BASE}/app/kiosk/verify/page.tsx",
        f"{BASE}/app/kiosk/register/page.tsx",
        f"{BASE}/app/kiosk/videos/page.tsx",
        f"{BASE}/app/kiosk/consent/page.tsx",
        f"{BASE}/app/kiosk/done/page.tsx",
        f"{BASE}/app/login/page.tsx",
        f"{BASE}/app/settings/page.tsx",
    ]

    config_files = [
        f"{BASE}/proxy.ts",
        f"{BASE}/next.config.ts",
        f"{BASE}/.github/workflows/ci.yml",
    ]

    all_files = lib_files + schema_files + api_files + page_files + config_files

    def add_file(filepath):
        # Strip base from display path
        display_path = filepath.replace(BASE + "/", "")
        filename = os.path.basename(filepath)

        story.append(HRFlowable(width="100%", thickness=1.5, color=TEAL, spaceAfter=4))
        story.append(Paragraph(f"<b>{escape_xml(filename)}</b>", file_header_style))
        story.append(Paragraph(escape_xml(display_path), path_style))

        if not os.path.exists(filepath):
            story.append(Paragraph(
                f'<font color="#d73a49">// FILE NOT FOUND: {escape_xml(filepath)}</font>',
                code_style
            ))
            return

        lines = read_file_safe(filepath)
        if not lines:
            story.append(Paragraph('<font color="#888888">// (empty file)</font>', code_style))
            return

        # Batch lines into paragraphs (each line = one paragraph for proper line rendering)
        for line in lines:
            rendered = colorize_line(line)
            # Empty lines → small spacer
            if rendered.strip() in ("", "&nbsp;") or not line.strip():
                story.append(Spacer(1, 2))
            else:
                story.append(Paragraph(rendered, code_style))

    # Section labels
    sections = [
        ("lib/", lib_files),
        ("prisma/", schema_files),
        ("app/api/", api_files),
        ("app/ (pages & layouts)", page_files),
        ("config & CI", config_files),
    ]

    for section_label, files in sections:
        # Section divider
        story.append(Spacer(1, 0.15 * inch))
        story.append(Paragraph(
            f'<font color="#0a3d62">── {escape_xml(section_label)} ──</font>',
            ParagraphStyle("SectionDiv", fontName="Helvetica-Bold", fontSize=12,
                          textColor=colors.HexColor("#0a3d62"), spaceBefore=6, spaceAfter=4)
        ))

        for fp in files:
            add_file(fp)

    # Build
    doc.build(story, onFirstPage=page_footer, onLaterPages=page_footer)
    print(f"✅ Generated: {OUTPUT}")

if __name__ == "__main__":
    build()
