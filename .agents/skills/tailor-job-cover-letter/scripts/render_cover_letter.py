#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from datetime import date
from html import escape
from pathlib import Path

import fitz
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer


EXPECTED_FILENAME = "George_Jobi_CoverLetter.pdf"


def register_fonts() -> tuple[str, str]:
    regular = Path(r"C:\Windows\Fonts\Carlito-Regular.ttf")
    bold = Path(r"C:\Windows\Fonts\Carlito-Bold.ttf")
    if regular.exists() and bold.exists():
        pdfmetrics.registerFont(TTFont("Carlito", str(regular)))
        pdfmetrics.registerFont(TTFont("Carlito-Bold", str(bold)))
        return "Carlito", "Carlito-Bold"
    return "Helvetica", "Helvetica-Bold"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Render and validate George Jobi's role-specific cover letter."
    )
    parser.add_argument("--company", required=True)
    parser.add_argument("--role", required=True)
    parser.add_argument("--body-file", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--date", default=date.today().strftime("%B %d, %Y"))
    parser.add_argument("--report", type=Path)
    return parser.parse_args()


def paragraph(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(escape(text).replace("\n", "<br/>"), style)


def normalize_text(value: str) -> str:
    return " ".join(
        value.replace("\u2013", "-")
        .replace("\u2014", "-")
        .replace("\u2019", "'")
        .split()
    ).lower()


def main() -> int:
    args = parse_args()
    if args.out.name != EXPECTED_FILENAME:
        raise SystemExit(f"Output filename must be exactly {EXPECTED_FILENAME}")

    body_text = args.body_file.read_text(encoding="utf-8").strip()
    body_paragraphs = [part.strip() for part in body_text.split("\n\n") if part.strip()]
    if not 2 <= len(body_paragraphs) <= 6:
        raise SystemExit("Cover-letter body must contain 2-6 paragraphs")

    word_count = len(body_text.split())
    if not 180 <= word_count <= 475:
        raise SystemExit(f"Cover-letter body must contain 180-475 words; found {word_count}")

    args.out.parent.mkdir(parents=True, exist_ok=True)
    regular, bold = register_fonts()
    body = ParagraphStyle(
        "body",
        fontName=regular,
        fontSize=10.3,
        leading=13.4,
        textColor=colors.HexColor("#111111"),
        spaceAfter=10,
    )
    header = ParagraphStyle(
        "header",
        parent=body,
        fontName=bold,
        fontSize=11,
        leading=13,
        spaceAfter=2,
    )
    contact = ParagraphStyle(
        "contact",
        parent=body,
        fontSize=9.4,
        leading=11.5,
        spaceAfter=12,
    )

    story = [
        paragraph("George Jobi Perangattu", header),
        paragraph(
            "Tempe, Arizona | +1 555-010-0200 | candidate@example.com | "
            "linkedin.com/in/candidate-profile/",
            contact,
        ),
        paragraph(args.date, body),
        Spacer(1, 3),
        paragraph("Hiring Team", body),
        paragraph(args.company, body),
        paragraph(f"Re: {args.role}", header),
        Spacer(1, 4),
        paragraph("Dear Hiring Team,", body),
    ]
    story.extend(paragraph(part, body) for part in body_paragraphs)
    story.extend(
        [
            Spacer(1, 2),
            paragraph("Sincerely,", body),
            paragraph("George Jobi Perangattu", header),
        ]
    )

    doc = SimpleDocTemplate(
        str(args.out),
        pagesize=letter,
        leftMargin=0.78 * inch,
        rightMargin=0.78 * inch,
        topMargin=0.62 * inch,
        bottomMargin=0.62 * inch,
        title=f"Cover Letter - {args.role}",
        author="George Jobi Perangattu",
    )
    doc.build(story)

    pdf = fitz.open(args.out)
    extracted = "\n".join(page.get_text() for page in pdf)
    pages = len(pdf)
    page_width = round(pdf[0].rect.width, 2)
    page_height = round(pdf[0].rect.height, 2)
    words = pdf[0].get_text("words")
    min_y = min((word[1] for word in words), default=0)
    max_y = max((word[3] for word in words), default=0)
    vertical_fill = round((max_y - min_y) / max(1, page_height), 3)
    pix = pdf[0].get_pixmap(matrix=fitz.Matrix(1.6, 1.6), alpha=False)
    preview = args.out.with_name("cover-letter-preview-page-1.png")
    pix.save(preview)
    pdf.close()

    required_text = [
        "George Jobi Perangattu",
        args.company,
        args.role,
        "Dear Hiring Team",
        "Sincerely",
    ]
    missing = [value for value in required_text if value.lower() not in extracted.lower()]
    malformed = [char for char in ("\ufffd", "\x00") if char in extracted]
    is_letter = abs(page_width - 612) < 0.1 and abs(page_height - 792) < 0.1
    normalized_source = normalize_text(body_text)
    normalized_extracted = normalize_text(extracted)
    body_survived = normalized_source in normalized_extracted
    report = {
        "valid": (
            pages == 1
            and is_letter
            and not missing
            and not malformed
            and body_survived
        ),
        "filename": args.out.name,
        "pages": pages,
        "pageSizePoints": [page_width, page_height],
        "isUsLetter": is_letter,
        "bodyWordCount": word_count,
        "verticalContentFill": vertical_fill,
        "missingExpectedText": missing,
        "malformedExtractedCharacters": malformed,
        "bodyTextSurvivedExtraction": body_survived,
        "preview": str(preview.resolve()),
        "manualVerificationRequired": [
            "Every factual claim is supported by the approved resume or durable answers.",
            "No clipping, overlap, sparse layout, or inconsistent typography is visible.",
            "The letter complements rather than duplicates required application responses.",
        ],
    }
    report_path = args.report or args.out.with_name("cover-letter-validation.json")
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0 if report["valid"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
