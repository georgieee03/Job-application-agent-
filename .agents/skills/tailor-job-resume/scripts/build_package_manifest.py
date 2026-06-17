#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


EXPECTED_RESUME = "George_Jobi_Resume.pdf"
EXPECTED_COVER_LETTER = "George_Jobi_CoverLetter.pdf"


def file_record(path: Path, expected_name: str) -> dict[str, Any]:
    resolved = path.resolve()
    if not resolved.is_file():
        raise FileNotFoundError(f"Missing package file: {resolved}")
    if resolved.name != expected_name:
        raise ValueError(f"Expected filename {expected_name}, found {resolved.name}")

    digest = hashlib.sha256()
    with resolved.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)

    return {
        "filename": resolved.name,
        "path": str(resolved),
        "bytes": resolved.stat().st_size,
        "sha256": digest.hexdigest(),
    }

def validation_record(path: Path, label: str) -> dict[str, Any]:
    resolved = path.resolve()
    if not resolved.is_file():
        raise FileNotFoundError(f"Missing {label} validation report: {resolved}")
    payload = json.loads(resolved.read_text(encoding="utf-8-sig"))
    if not payload.get("valid"):
        raise ValueError(f"{label} validation report does not mark the artifact as valid.")
    return {
        "report": str(resolved),
        "valid": True,
        "estimatedAtsAlignment": payload.get("keywordCoverage", {}).get(
            "estimatedAtsAlignment"
        ),
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build an approval manifest for an exact job-application PDF package."
    )
    parser.add_argument("--company", required=True)
    parser.add_argument("--role", required=True)
    parser.add_argument("--job-url", required=True)
    parser.add_argument("--resume", required=True, type=Path)
    parser.add_argument("--cover-letter", type=Path)
    parser.add_argument(
        "--attachment",
        action="append",
        default=[],
        type=Path,
        help="Additional role-specific file included in the approved package.",
    )
    parser.add_argument("--validation", type=Path)
    parser.add_argument("--cover-validation", type=Path)
    parser.add_argument(
        "--response",
        action="append",
        default=[],
        type=Path,
        help="Exact application-response JSON/text file included in approval, but not uploaded.",
    )
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()

    files = {
        "resume": file_record(args.resume, EXPECTED_RESUME),
        "coverLetter": (
            file_record(args.cover_letter, EXPECTED_COVER_LETTER)
            if args.cover_letter
            else None
        ),
        "attachments": [
            {
                **file_record(path, path.name),
                "kind": "additional",
            }
            for path in args.attachment
        ],
        "responses": [
            {
                **file_record(path, path.name),
                "kind": "application-response",
                "upload": False,
            }
            for path in args.response
        ],
    }

    resume_validation = (
        validation_record(args.validation, "Resume") if args.validation else None
    )
    cover_validation = (
        validation_record(args.cover_validation, "Cover-letter")
        if args.cover_validation
        else None
    )
    if args.cover_letter and not cover_validation:
        raise ValueError("A cover letter requires --cover-validation.")
    if args.cover_validation and not args.cover_letter:
        raise ValueError("--cover-validation requires --cover-letter.")

    manifest = {
        "schemaVersion": 2,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "company": args.company,
        "role": args.role,
        "jobUrl": args.job_url,
        "approvalAppliesToExactHashes": True,
        "files": files,
        "validation": {
            # Preserve the original top-level fields for existing consumers.
            "report": resume_validation["report"] if resume_validation else None,
            "valid": resume_validation["valid"] if resume_validation else None,
            "estimatedAtsAlignment": (
                resume_validation["estimatedAtsAlignment"]
                if resume_validation
                else None
            ),
            "resume": resume_validation,
            "coverLetter": cover_validation,
        },
    }

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
