#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
TRACKER = ROOT / "data" / "application-tracker.json"
REPORTS = ROOT / "data" / "application-reports"
OUT = ROOT / "data" / "application-report-evidence-migration.json"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def normalize(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


def field(text: str, name: str) -> str | None:
    match = re.search(rf"^- {re.escape(name)}:\s*(.+)$", text, re.MULTILINE)
    if not match:
        return None
    value = match.group(1).strip()
    return None if value in {"-", "`-`"} else value.strip("`")


def link_value(value: str | None) -> str | None:
    if not value:
        return None
    match = re.search(r"\((https?://[^)]+)\)", value)
    if match:
        return match.group(1)
    return value.strip("`")


def section(text: str, heading: str) -> str | None:
    pattern = rf"^## {re.escape(heading)}\s*$([\s\S]*?)(?=^## |\Z)"
    match = re.search(pattern, text, re.MULTILINE)
    return match.group(1).strip() if match else None


def parse_report(path: Path) -> dict[str, Any]:
    text = path.read_text(encoding="utf-8-sig")
    submitted_answers = section(text, "Submitted Answers")
    evidence = {
        "type": field(text, "Confirmation type"),
        "text": field(text, "Confirmation text"),
        "number": field(text, "Confirmation number"),
        "url": link_value(field(text, "Confirmation URL")),
        "screenshot": field(text, "Confirmation screenshot"),
        "browserSurface": field(text, "Browser surface"),
        "browserUrl": link_value(field(text, "Browser URL")),
        "browserAccount": field(text, "Browser account"),
        "browserStep": field(text, "Browser step"),
        "sourceReport": str(path.relative_to(ROOT)),
    }
    return {
        "roleId": field(text, "Role ID") or path.stem,
        "company": field(text, "Company"),
        "title": field(text, "Role"),
        "jobUrl": link_value(field(text, "Job URL")),
        "provider": field(text, "Provider"),
        "status": field(text, "Status"),
        "submittedAt": field(text, "Submitted at"),
        "packageDir": field(text, "Package directory"),
        "resumePath": field(text, "Resume path"),
        "coverLetterPath": field(text, "Cover letter path"),
        "atsScore": field(text, "ATS heuristic"),
        "approvalStatus": field(text, "Approval status"),
        "approvalEvidence": field(text, "Approval evidence"),
        "fitNotes": field(text, "Fit notes"),
        "eligibilityNotes": field(text, "Eligibility notes"),
        "blocker": field(text, "Blocker"),
        "nextAction": field(text, "Next action"),
        "submittedAnswers": submitted_answers,
        "confirmationEvidence": evidence,
    }


def match_entry(entries: list[dict[str, Any]], report: dict[str, Any]) -> dict[str, Any] | None:
    role_id = normalize(report.get("roleId"))
    company = normalize(report.get("company"))
    title = normalize(report.get("title"))
    url = normalize(report.get("jobUrl"))
    scored: list[tuple[int, dict[str, Any]]] = []
    for entry in entries:
        score = 0
        if role_id and role_id == normalize(entry.get("id")):
            score += 10
        if company and company == normalize(entry.get("company")):
            score += 4
        if title and title == normalize(entry.get("title")):
            score += 4
        entry_url = normalize(entry.get("listingUrl") or entry.get("applyUrl"))
        if url and entry_url and (url in entry_url or entry_url in url):
            score += 8
        if score >= 8:
            scored.append((score, entry))
    scored.sort(key=lambda pair: pair[0], reverse=True)
    return scored[0][1] if scored else None


def has_value(entry: dict[str, Any], *names: str) -> bool:
    return any(bool(entry.get(name)) for name in names)


def add_if_missing(entry: dict[str, Any], key: str, value: Any) -> None:
    if value and not entry.get(key):
        entry[key] = value


def migrate(entries: list[dict[str, Any]], reports: list[Path]) -> dict[str, Any]:
    now = utc_now()
    results = []
    for path in reports:
        parsed = parse_report(path)
        entry = match_entry(entries, parsed)
        if not entry:
            results.append({"report": str(path.relative_to(ROOT)), "action": "unmatched"})
            continue

        changed = False
        before = json.dumps(entry, sort_keys=True, default=str)
        add_if_missing(entry, "roleId", parsed.get("roleId"))
        add_if_missing(entry, "packageDir", parsed.get("packageDir"))
        add_if_missing(entry, "resumePath", parsed.get("resumePath"))
        add_if_missing(entry, "coverLetterPath", parsed.get("coverLetterPath"))
        add_if_missing(entry, "atsScore", parsed.get("atsScore"))
        add_if_missing(entry, "approvalStatus", parsed.get("approvalStatus"))
        add_if_missing(entry, "approvalEvidence", parsed.get("approvalEvidence"))
        add_if_missing(entry, "fitNotes", parsed.get("fitNotes"))
        add_if_missing(entry, "eligibilityNotes", parsed.get("eligibilityNotes"))
        add_if_missing(entry, "blocker", parsed.get("blocker"))
        add_if_missing(entry, "nextAction", parsed.get("nextAction"))
        add_if_missing(entry, "submittedAt", parsed.get("submittedAt"))
        if parsed.get("submittedAnswers") and not has_value(entry, "submittedAnswers", "submitted_answers"):
            entry["submittedAnswers"] = [parsed["submittedAnswers"]]
        evidence = parsed.get("confirmationEvidence")
        if evidence and any(value for key, value in evidence.items() if key != "sourceReport"):
            existing_evidence = list(entry.get("confirmationEvidence") or [])
            if not existing_evidence:
                entry["confirmationEvidence"] = [evidence]
        entry["evidenceMigratedFromReportAt"] = entry.get("evidenceMigratedFromReportAt") or now
        after = json.dumps(entry, sort_keys=True, default=str)
        changed = before != after
        results.append({
            "report": str(path.relative_to(ROOT)),
            "trackerId": entry.get("id"),
            "company": entry.get("company"),
            "title": entry.get("title"),
            "changed": changed,
        })

    return {
        "generatedAt": now,
        "reportsRead": len(reports),
        "matched": sum(1 for result in results if result.get("trackerId")),
        "changed": sum(1 for result in results if result.get("changed")),
        "results": results,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Migrate legacy application report evidence into the single tracker.")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    entries = json.loads(TRACKER.read_text(encoding="utf-8-sig"))
    reports = sorted(REPORTS.glob("*.md"))
    report = migrate(entries, reports)
    OUT.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    if args.apply:
        TRACKER.write_text(json.dumps(entries, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
