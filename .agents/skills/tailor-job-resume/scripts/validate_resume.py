#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

import fitz


EXPECTED_FILENAME = "George_Jobi_Resume.pdf"
LETTER_SIZE = (612.0, 792.0)
REQUIRED_SECTIONS = [
    "PROFESSIONAL SUMMARY",
    "EDUCATION",
    "TECHNICAL SKILLS",
    "PROJECT EXPERIENCE",
    "WORK EXPERIENCE",
]
ORPHAN_HEADING_ANCHORS = REQUIRED_SECTIONS + [
    "Project Experience (Continued)",
    "Efficient TransFuser",
    "Parrot MiniDrone",
    "3D Motion Planning",
    "Spider CAD Robot",
    "Complementarity-Free Dexterous Manipulation with TacDrones",
    "Backend Developer Intern",
    "Full Stack Developer Intern",
]
CONTENT_ANCHORS = [
    "M.S. Robotics and Autonomous Systems",
    "B.S. Computer Science",
    "Efficient TransFuser",
    "Parrot MiniDrone",
    "3D Motion Planning",
    "Spider CAD Robot",
    "Complementarity-Free Dexterous Manipulation with TacDrones",
    "DigiClips Media",
    "Odoo",
    "TicketDex",
]
BOLD_ANCHORS = [
    "M.S. Robotics and Autonomous Systems",
    "B.S. Computer Science",
    "Efficient TransFuser",
    "Parrot MiniDrone",
    "3D Motion Planning",
    "Spider CAD Robot",
    "Complementarity-Free Dexterous Manipulation with TacDrones",
    "Backend Developer Intern",
    "Full Stack Developer Intern",
]


def normalize(value: str) -> str:
    value = value.lower().replace("/", " ")
    value = re.sub(r"[\u2010-\u2015]", "-", value)
    return re.sub(r"\s+", " ", value).strip()


def read_keywords(path: Path | None) -> list[str]:
    if path is None:
        return []
    return [
        line.strip()
        for line in path.read_text(encoding="utf-8-sig").splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    ]


def text_lines(page: fitz.Page) -> list[dict[str, Any]]:
    result = []
    for block in page.get_text("dict")["blocks"]:
        if block.get("type") != 0:
            continue
        for line in block["lines"]:
            spans = line["spans"]
            result.append(
                {
                    "text": "".join(span["text"] for span in spans).strip(),
                    "spans": spans,
                    "bbox": line["bbox"],
                }
            )
    return result


def line_has_bold(line: dict[str, Any]) -> bool:
    return any("bold" in span["font"].lower() for span in line["spans"])


def anchor_is_bold(lines: list[dict[str, Any]], anchor: str) -> bool:
    needle = normalize(anchor)
    return any(needle in normalize(line["text"]) and line_has_bold(line) for line in lines)


def skill_label_checks(lines: list[dict[str, Any]]) -> dict[str, bool]:
    in_skills = False
    checks: dict[str, bool] = {}
    for line in lines:
        text = line["text"].strip()
        upper = text.upper()
        if upper == "TECHNICAL SKILLS":
            in_skills = True
            continue
        if in_skills and (
            "PROJECT EXPERIENCE" in upper
            or upper in {"WORK EXPERIENCE", "EXPERIENCE"}
        ):
            break
        if in_skills and ":" in text:
            label = text.split(":", 1)[0].strip()
            checks[label] = line_has_bold(line)
    return checks


def page_fill_ratio(page: fitz.Page) -> float:
    boxes = [
        block["bbox"]
        for block in page.get_text("dict")["blocks"]
        if block.get("type") == 0 and block.get("lines")
    ]
    if not boxes:
        return 0.0
    top = min(box[1] for box in boxes)
    bottom = max(box[3] for box in boxes)
    return round((bottom - top) / page.rect.height, 3)


def text_block_count(page: fitz.Page) -> int:
    return sum(1 for block in page.get_text("dict")["blocks"] if block.get("type") == 0 and block.get("lines"))


def image_block_count(page: fitz.Page) -> int:
    return sum(1 for block in page.get_text("dict")["blocks"] if block.get("type") == 1)


def page_has_orphan_heading(page_lines: list[dict[str, Any]]) -> list[str]:
    visible_lines = [line for line in page_lines if line["text"]]
    if len(visible_lines) < 2:
        return []
    tail = visible_lines[-2:]
    findings = []
    for line in tail:
        text = normalize(line["text"])
        if any(normalize(anchor) in text for anchor in ORPHAN_HEADING_ANCHORS):
            findings.append(line["text"])
    return findings


def overlapping_lines(page_lines: list[dict[str, Any]]) -> list[tuple[str, str]]:
    overlaps: list[tuple[str, str]] = []
    ordered = sorted(page_lines, key=lambda item: (round(item["bbox"][1], 1), round(item["bbox"][0], 1)))
    for left, right in zip(ordered, ordered[1:]):
        left_box = left["bbox"]
        right_box = right["bbox"]
        same_row = abs(left_box[1] - right_box[1]) < 2.0
        if same_row:
            continue
        vertical_overlap = min(left_box[3], right_box[3]) - max(left_box[1], right_box[1])
        horizontal_overlap = min(left_box[2], right_box[2]) - max(left_box[0], right_box[0])
        if vertical_overlap > 1.0 and horizontal_overlap > 8.0:
            overlaps.append((left["text"], right["text"]))
    return overlaps


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate a tailored George Jobi resume PDF.")
    parser.add_argument("--pdf", required=True, type=Path)
    parser.add_argument("--keywords", type=Path)
    parser.add_argument("--reference", type=Path)
    parser.add_argument("--min-keyword-coverage", type=float, default=89.0)
    parser.add_argument("--min-page-fill", type=float, default=0.55)
    parser.add_argument("--json-out", type=Path)
    args = parser.parse_args()

    failures: list[str] = []
    pdf_path = args.pdf.resolve()
    if not pdf_path.exists():
        print(json.dumps({"valid": False, "failures": [f"Missing PDF: {pdf_path}"]}, indent=2))
        return 2

    doc = fitz.open(pdf_path)
    pages = list(doc)
    page_lines = [text_lines(page) for page in pages]
    all_lines = [line for lines in page_lines for line in lines]
    text = "\n".join(page.get_text() for page in pages)
    normalized_text = normalize(text)

    filename_ok = pdf_path.name == EXPECTED_FILENAME
    if not filename_ok:
        failures.append(f"Resume filename must be {EXPECTED_FILENAME}.")

    page_count_ok = 1 <= doc.page_count <= 2
    if not page_count_ok:
        failures.append(f"Resume must be 1-2 pages; found {doc.page_count}.")

    page_sizes = [(round(page.rect.width, 1), round(page.rect.height, 1)) for page in pages]
    letter_ok = all(
        abs(width - LETTER_SIZE[0]) <= 1 and abs(height - LETTER_SIZE[1]) <= 1
        for width, height in page_sizes
    )
    if not letter_ok:
        failures.append(f"Every page must be US Letter; found {page_sizes}.")

    page_fill = [page_fill_ratio(page) for page in pages]
    page_fill_ok = all(value >= args.min_page_fill for value in page_fill)
    if not page_fill_ok:
        failures.append(
            f"Each page must be substantially filled (minimum {args.min_page_fill:.0%}); found {page_fill}."
        )

    text_blocks = [text_block_count(page) for page in pages]
    image_blocks = [image_block_count(page) for page in pages]
    if any(count == 0 for count in text_blocks):
        failures.append(f"Every page must contain extractable text blocks; found {text_blocks}.")
    if any(count > 0 for count in image_blocks):
        failures.append(f"Resume must be ATS-readable text, not image content; image blocks found {image_blocks}.")

    annotations = [len(list(page.annots() or [])) for page in pages]
    widgets = [len(list(page.widgets() or [])) for page in pages]
    if any(count > 0 for count in annotations):
        failures.append(f"Resume must not include PDF annotations; found {annotations}.")
    if any(count > 0 for count in widgets):
        failures.append(f"Resume must not include form widgets; found {widgets}.")

    orphan_headings = {
        index + 1: page_has_orphan_heading(lines)
        for index, lines in enumerate(page_lines[:-1])
        if page_has_orphan_heading(lines)
    }
    if orphan_headings:
        failures.append(
            "Page break leaves a heading or content anchor separated from its body: "
            + json.dumps(orphan_headings, ensure_ascii=False)
        )

    overlap_findings = {
        index + 1: overlapping_lines(lines)[:5]
        for index, lines in enumerate(page_lines)
        if overlapping_lines(lines)
    }
    if overlap_findings:
        failures.append("Overlapping text lines detected: " + json.dumps(overlap_findings, ensure_ascii=False))

    section_checks = {
        section: (
            normalize(section) in normalized_text
            if section != "PROJECT EXPERIENCE"
            else "project experience" in normalized_text
        )
        for section in REQUIRED_SECTIONS
    }
    missing_sections = [name for name, present in section_checks.items() if not present]
    if missing_sections:
        failures.append("Missing sections: " + ", ".join(missing_sections))

    anchor_checks = {
        anchor: normalize(anchor) in normalized_text for anchor in CONTENT_ANCHORS
    }
    missing_anchors = [name for name, present in anchor_checks.items() if not present]
    if missing_anchors:
        failures.append("Missing preserved content anchors: " + ", ".join(missing_anchors))

    bold_checks = {anchor: anchor_is_bold(all_lines, anchor) for anchor in BOLD_ANCHORS}
    missing_bold = [name for name, present in bold_checks.items() if not present]
    if missing_bold:
        failures.append("Required bold anchors not detected: " + ", ".join(missing_bold))

    skill_checks = skill_label_checks(all_lines)
    skill_labels_ok = bool(skill_checks) and all(skill_checks.values())
    if not skill_checks:
        failures.append("No technical-skill category labels were detected.")
    elif not skill_labels_ok:
        failures.append(
            "Technical-skill labels not bold: "
            + ", ".join(label for label, bold in skill_checks.items() if not bold)
        )

    keywords = read_keywords(args.keywords)
    hits = [keyword for keyword in keywords if normalize(keyword) in normalized_text]
    missing_keywords = [keyword for keyword in keywords if keyword not in hits]
    raw_coverage = round(100 * len(hits) / len(keywords), 1) if keywords else None
    estimated_alignment = min(95.0, raw_coverage) if raw_coverage is not None else None
    keyword_ok = raw_coverage is None or raw_coverage >= args.min_keyword_coverage
    if not keyword_ok:
        failures.append(
            f"Raw keyword coverage {raw_coverage}% is below {args.min_keyword_coverage}%."
        )

    reference = None
    if args.reference:
        reference_path = args.reference.resolve()
        reference = {"path": str(reference_path), "exists": reference_path.exists()}
        if reference_path.exists():
            reference_doc = fitz.open(reference_path)
            reference["pageCount"] = reference_doc.page_count
            reference["pageSizes"] = [
                (round(page.rect.width, 1), round(page.rect.height, 1))
                for page in reference_doc
            ]
            reference_doc.close()

    report = {
        "valid": not failures,
        "pdf": str(pdf_path),
        "filename": {"expected": EXPECTED_FILENAME, "actual": pdf_path.name, "ok": filename_ok},
        "pageCount": {"value": doc.page_count, "ok": page_count_ok},
        "pageSizes": {"values": page_sizes, "letter": letter_ok},
        "pageFillRatios": {"values": page_fill, "minimum": args.min_page_fill, "ok": page_fill_ok},
        "atsReadability": {
            "textBlocks": text_blocks,
            "imageBlocks": image_blocks,
            "annotations": annotations,
            "widgets": widgets,
            "orphanHeadingsAtPageBreak": orphan_headings,
            "overlappingLines": overlap_findings,
            "ok": all(count == 0 for count in image_blocks)
            and all(count == 0 for count in annotations)
            and all(count == 0 for count in widgets)
            and not orphan_headings
            and not overlap_findings
            and all(count > 0 for count in text_blocks),
        },
        "sections": section_checks,
        "preservedContent": anchor_checks,
        "boldAnchors": bold_checks,
        "boldSkillLabels": skill_checks,
        "keywordCoverage": {
            "rawPercent": raw_coverage,
            "estimatedAtsAlignment": estimated_alignment,
            "targetRange": "89-95",
            "hits": hits,
            "missing": missing_keywords,
            "note": "Local phrase-coverage heuristic only; not an employer ATS score.",
        },
        "reference": reference,
        "failures": failures,
    }
    doc.close()

    rendered = json.dumps(report, indent=2)
    print(rendered)
    if args.json_out:
        args.json_out.parent.mkdir(parents=True, exist_ok=True)
        args.json_out.write_text(rendered + "\n", encoding="utf-8")
    return 0 if report["valid"] else 1


if __name__ == "__main__":
    sys.exit(main())
