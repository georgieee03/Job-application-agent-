#!/usr/bin/env python3
from __future__ import annotations

import os as _profile_environment
if __name__ == "__main__" and _profile_environment.environ.get("JOB_APPLICATION_REVIEWED_LOCAL_HELPERS") != "true":
    raise SystemExit("Public example helper: configure local candidate facts, paths, role configuration, and authorization first; see docs/public-repository-setup.md.")

import json
import sys
from html import escape
from pathlib import Path
from typing import Any

import fitz
from PIL import Image
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer


ROOT = Path(__file__).resolve().parents[1]
ORIGINAL_RESUME = Path(r"F:\Resume tracker\George_Jobi_Resume_generalrobotics.pdf")
OUT_ROOT = ROOT / "data" / "next-five-applications"


def register_fonts() -> tuple[str, str]:
    regular = Path(r"C:\Windows\Fonts\Carlito-Regular.ttf")
    bold = Path(r"C:\Windows\Fonts\Carlito-Bold.ttf")
    if regular.exists() and bold.exists():
        pdfmetrics.registerFont(TTFont("Carlito", str(regular)))
        pdfmetrics.registerFont(TTFont("Carlito-Bold", str(bold)))
        return "Carlito", "Carlito-Bold"
    return "Helvetica", "Helvetica-Bold"


def para(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(escape(text), style)


def render_resume(role: dict[str, Any]) -> Path:
    regular_font, bold_font = register_fonts()
    role_dir = OUT_ROOT / role["folder"]
    role_dir.mkdir(parents=True, exist_ok=True)
    out = role_dir / "George_Jobi_Resume.pdf"

    doc = SimpleDocTemplate(
        str(out),
        pagesize=letter,
        leftMargin=0.42 * inch,
        rightMargin=0.42 * inch,
        topMargin=0.32 * inch,
        bottomMargin=0.34 * inch,
    )
    name = ParagraphStyle(
        "name",
        fontName=bold_font,
        fontSize=13.5,
        leading=15,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#111111"),
        spaceAfter=2,
    )
    contact = ParagraphStyle(
        "contact",
        fontName=regular_font,
        fontSize=8.7,
        leading=10,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#111111"),
        spaceAfter=5,
    )
    heading = ParagraphStyle(
        "heading",
        fontName=bold_font,
        fontSize=9.2,
        leading=10.2,
        alignment=TA_LEFT,
        textColor=colors.HexColor("#111111"),
        spaceBefore=4,
        spaceAfter=2,
    )
    body = ParagraphStyle(
        "body",
        fontName=regular_font,
        fontSize=8.25,
        leading=9.75,
        alignment=TA_LEFT,
        textColor=colors.HexColor("#111111"),
        spaceAfter=1.15,
    )
    bullet = ParagraphStyle(
        "bullet",
        parent=body,
        leftIndent=8,
        firstLineIndent=-6,
    )
    story = [
        para("GEORGE JOBI PERANGATTU", name),
        para("Example City, Example State | +1 555-010-0200 | candidate@example.com", contact),
    ]

    for section in role["resume"]:
        story.append(para(section["title"].upper(), heading))
        for line in section["lines"]:
            if line.startswith("- "):
                story.append(Paragraph("&bull; " + escape(line[2:]), bullet))
            else:
                story.append(para(line, body))
        story.append(Spacer(1, 0.018 * inch))

    doc.build(story)
    return out


def render_cover_letter(role: dict[str, Any]) -> Path | None:
    regular_font, _ = register_fonts()
    cover = role.get("coverLetter")
    if not cover:
        return None
    role_dir = OUT_ROOT / role["folder"]
    role_dir.mkdir(parents=True, exist_ok=True)
    txt = role_dir / "George_Jobi_CoverLetter.txt"
    txt.write_text(cover, encoding="utf-8")
    out = role_dir / "George_Jobi_CoverLetter.pdf"
    doc = SimpleDocTemplate(
        str(out),
        pagesize=letter,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.7 * inch,
        bottomMargin=0.7 * inch,
    )
    body = ParagraphStyle(
        "letter",
        fontName=regular_font,
        fontSize=10,
        leading=13,
        textColor=colors.HexColor("#111111"),
        spaceAfter=8,
    )
    story = [Paragraph(escape(p), body) for p in cover.split("\n\n") if p.strip()]
    doc.build(story)
    return out


def render_png(pdf: Path, prefix: str, zoom: float = 1.6) -> list[Path]:
    doc = fitz.open(pdf)
    outputs: list[Path] = []
    for index, page in enumerate(doc, start=1):
        pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
        out = pdf.parent / f"{prefix}-page-{index}.png"
        pix.save(out)
        outputs.append(out)
    doc.close()
    return outputs


def compare_first_page(original_png: Path, generated_png: Path, out: Path) -> None:
    left = Image.open(original_png).convert("RGB")
    right = Image.open(generated_png).convert("RGB")
    height = min(left.height, right.height)
    left = left.crop((0, 0, left.width, height))
    right = right.crop((0, 0, right.width, height))
    combined = Image.new("RGB", (left.width + right.width + 12, height), "white")
    combined.paste(left, (0, 0))
    combined.paste(right, (left.width + 12, 0))
    combined.save(out)


def text_coverage(pdf: Path, keywords: list[str]) -> dict[str, Any]:
    doc = fitz.open(pdf)
    text = "\n".join(page.get_text() for page in doc).lower().replace("/", " ")
    doc.close()
    hits = [term for term in keywords if term.lower().replace("/", " ") in text]
    missing = [term for term in keywords if term not in hits]
    return {
        "hits": len(hits),
        "total": len(keywords),
        "score": round(100 * len(hits) / max(1, len(keywords))),
        "missing": missing,
    }


def main() -> int:
    config_path = Path(sys.argv[1]) if len(sys.argv) > 1 else OUT_ROOT / "application-packages.json"
    data = json.loads(config_path.read_text(encoding="utf-8"))
    OUT_ROOT.mkdir(parents=True, exist_ok=True)
    original_pages = render_png(ORIGINAL_RESUME, "original-reference")
    summary = []

    for role in data["roles"]:
        pdf = render_resume(role)
        cover = render_cover_letter(role)
        pages = render_png(pdf, "resume-preview")
        cover_pages = render_png(cover, "cover-letter-preview") if cover else []
        compare = pdf.parent / "format-comparison-page-1.png"
        compare_first_page(original_pages[0], pages[0], compare)
        coverage = text_coverage(pdf, role["keywords"])
        summary.append(
            {
                "role": role["role"],
                "company": role["company"],
                "resume": str(pdf),
                "coverLetter": str(cover) if cover else None,
                "coverLetterPreviewPages": [str(p) for p in cover_pages],
                "previewPages": [str(p) for p in pages],
                "formatComparison": str(compare),
                "atsCoverage": coverage,
                "applicationUrl": role["applicationUrl"],
                "requiresConfirmation": role.get("requiresConfirmation", []),
            }
        )

    (OUT_ROOT / "package-summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
