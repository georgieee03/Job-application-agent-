#!/usr/bin/env python3
import sys
from html import escape
from pathlib import Path

try:
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_CENTER
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import inch
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer
except ModuleNotFoundError:
    REPORTLAB_AVAILABLE = False
else:
    REPORTLAB_AVAILABLE = True


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: text_resume_to_pdf.py input.txt output.pdf", file=sys.stderr)
        return 1

    src = Path(sys.argv[1])
    out = Path(sys.argv[2])
    text = src.read_text(encoding="utf8")

    if REPORTLAB_AVAILABLE:
        render_with_reportlab(text, out)
    else:
        render_minimal_pdf(text, out)

    return 0


def render_with_reportlab(text: str, out: Path) -> None:
    sections = [section.strip() for section in text.split("\n\n") if section.strip()]
    doc = SimpleDocTemplate(
        str(out),
        pagesize=letter,
        rightMargin=0.55 * inch,
        leftMargin=0.55 * inch,
        topMargin=0.45 * inch,
        bottomMargin=0.45 * inch,
    )
    styles = getSampleStyleSheet()
    name_style = ParagraphStyle(
        "name",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=18,
        alignment=TA_CENTER,
        spaceAfter=4,
        textColor=colors.HexColor("#111111"),
    )
    meta_style = ParagraphStyle(
        "meta",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=11,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#333333"),
    )
    section_style = ParagraphStyle(
        "section",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=12,
        spaceBefore=6,
        spaceAfter=4,
        textColor=colors.HexColor("#111111"),
    )
    body_style = ParagraphStyle(
        "body",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.8,
        leading=11,
        textColor=colors.HexColor("#111111"),
    )
    small_style = ParagraphStyle(
        "small",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=10.5,
        textColor=colors.HexColor("#111111"),
    )

    story = []
    for index, section in enumerate(sections):
        lines = [line.strip() for line in section.splitlines() if line.strip()]
        if index == 0 and len(lines) >= 2:
            story.append(Paragraph(escape(lines[0]), name_style))
            story.append(Paragraph("<br/>".join(escape(line) for line in lines[1:]), meta_style))
            story.append(Spacer(1, 0.08 * inch))
            continue
        if lines[0].startswith("# "):
            story.append(Paragraph(escape(lines[0][2:]), section_style))
            lines = lines[1:]
        for line in lines:
            if line.startswith("- "):
                story.append(Paragraph("&bull; " + escape(line[2:]), body_style))
            elif line.startswith("* "):
                story.append(Paragraph("&bull; " + escape(line[2:]), body_style))
            else:
                story.append(Paragraph(escape(line), small_style))
        story.append(Spacer(1, 0.05 * inch))

    doc.build(story)


def render_minimal_pdf(text: str, out: Path) -> None:
    lines = normalize_lines(text)
    pages = paginate(lines, lines_per_page=56)
    objects: list[bytes] = []
    page_object_numbers: list[int] = []

    def add_object(body: bytes) -> int:
        objects.append(body)
        return len(objects)

    pages_object_number = add_object(b"")
    font_object_number = add_object(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    for page in pages:
        content = build_page_content(page)
        content_object_number = add_object(
            b"<< /Length " + str(len(content)).encode("ascii") + b" >>\nstream\n" + content + b"endstream"
        )
        page_object_number = add_object(
            (
                f"<< /Type /Page /Parent {pages_object_number} 0 R "
                f"/MediaBox [0 0 612 792] /Resources << /Font << /F1 {font_object_number} 0 R >> >> "
                f"/Contents {content_object_number} 0 R >>"
            ).encode("ascii")
        )
        page_object_numbers.append(page_object_number)

    kids = " ".join(f"{page_number} 0 R" for page_number in page_object_numbers)
    objects[pages_object_number - 1] = f"<< /Type /Pages /Kids [{kids}] /Count {len(page_object_numbers)} >>".encode("ascii")
    catalog_object_number = add_object(f"<< /Type /Catalog /Pages {pages_object_number} 0 R >>".encode("ascii"))

    write_pdf(out, objects, catalog_object_number)


def normalize_lines(text: str) -> list[str]:
    lines: list[str] = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            lines.append("")
        elif line.startswith("# "):
            lines.append(line[2:].upper())
        elif line.startswith("- ") or line.startswith("* "):
            lines.append("- " + line[2:])
        else:
            lines.append(line)
    return lines or [""]


def paginate(lines: list[str], lines_per_page: int) -> list[list[str]]:
    pages = [lines[index : index + lines_per_page] for index in range(0, len(lines), lines_per_page)]
    return pages or [[""]]


def build_page_content(lines: list[str]) -> bytes:
    commands = ["BT", "/F1 10 Tf", "50 750 Td", "14 TL"]
    for index, line in enumerate(lines):
        if index > 0:
            commands.append("T*")
        commands.append(f"({escape_pdf_text(line[:110])}) Tj")
    commands.append("ET")
    return ("\n".join(commands) + "\n").encode("latin-1", errors="replace")


def escape_pdf_text(value: str) -> str:
    return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def write_pdf(out: Path, objects: list[bytes], catalog_object_number: int) -> None:
    chunks = [b"%PDF-1.4\n"]
    offsets = [0]
    for index, body in enumerate(objects, start=1):
        offsets.append(sum(len(chunk) for chunk in chunks))
        chunks.append(f"{index} 0 obj\n".encode("ascii"))
        chunks.append(body)
        chunks.append(b"\nendobj\n")

    xref_offset = sum(len(chunk) for chunk in chunks)
    chunks.append(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    chunks.append(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        chunks.append(f"{offset:010d} 00000 n \n".encode("ascii"))
    chunks.append(
        (
            f"trailer\n<< /Size {len(objects) + 1} /Root {catalog_object_number} 0 R >>\n"
            f"startxref\n{xref_offset}\n%%EOF\n"
        ).encode("ascii")
    )
    out.write_bytes(b"".join(chunks))


if __name__ == "__main__":
    raise SystemExit(main())
