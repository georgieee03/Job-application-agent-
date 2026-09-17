#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
TRACKER = ROOT / "data" / "application-tracker.json"
REPORT = ROOT / "data" / "application-tracker-audit.json"

VERIFIED_STATUSES = {"submitted - email verified", "submitted - portal verified"}
PENDING_STATUSES = {
    "",
    "discovered",
    "screened",
    "tailoring",
    "awaiting-approval",
    "approved",
    "form-in-progress",
    "awaiting-user",
    "submitted",
    "submitted - pending email verification",
    "not submitted",
    "not completed",
    "manual submit needed",
    "needs-review",
    "blocked",
    "skipped",
}
OUTCOME_STATUSES = {"rejected", "interview", "accepted"}
ALLOWED_STATUSES = VERIFIED_STATUSES | PENDING_STATUSES | OUTCOME_STATUSES
LEGACY_STATUS_ALIASES = {
    "ready-to-submit": "approved",
    "submitted-pending-verification": "submitted - pending email verification",
    "submitted - pending email/portal verification": "submitted - pending email verification",
    "blocked - replaced": "skipped",
}
REJECTION_STATUSES = {"rejected"}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def load_tracker(path: Path) -> list[dict[str, Any]]:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_tracker(path: Path, entries: list[dict[str, Any]]) -> None:
    path.write_text(json.dumps(entries, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def canonical_status(status: Any) -> str:
    value = str(status or "").strip().lower()
    return LEGACY_STATUS_ALIASES.get(value, value)


def has_list_value(entry: dict[str, Any], *names: str) -> bool:
    for name in names:
        value = entry.get(name)
        if isinstance(value, list) and value:
            return True
    return False


def has_scalar_value(entry: dict[str, Any], *names: str) -> bool:
    return any(bool(entry.get(name)) for name in names)


def has_confirmation_evidence(entry: dict[str, Any]) -> bool:
    return has_list_value(entry, "confirmationEvidence", "confirmation_evidence", "email_evidence") or has_scalar_value(
        entry,
        "confirmation_type",
        "confirmation_text",
        "confirmation_url",
        "confirmation_number",
        "confirmation_screenshot",
        "provider_response_path",
        "confirmationType",
        "confirmationText",
        "confirmationUrl",
        "confirmationNumber",
        "confirmationScreenshot",
        "providerResponsePath",
        "emailConfirmationPath",
        "confirmationEmailSubject",
    )


def has_submitted_answers(entry: dict[str, Any]) -> bool:
    return has_list_value(entry, "submittedAnswers", "submitted_answers") or has_scalar_value(
        entry,
        "submittedAnswerSummary",
        "submitted_answer_summary",
    )


def has_package_or_exemption(entry: dict[str, Any]) -> bool:
    return has_scalar_value(
        entry,
        "packageDir",
        "package_dir",
        "resumePath",
        "resume_path",
        "noTailoringRationale",
        "no_tailoring_rationale",
    )


def audit(entries: list[dict[str, Any]], *, fix: bool) -> dict[str, Any]:
    now = utc_now()
    status_counts: dict[str, int] = {}
    issues: list[dict[str, Any]] = []
    normalized = 0
    excluded = 0

    for entry in entries:
        original_status = str(entry.get("status") or "")
        status = canonical_status(original_status)
        if fix and status != original_status:
            entry["status"] = status
            entry["statusUpdatedAt"] = entry.get("statusUpdatedAt") or now
            normalized += 1

        status_counts[status or "<blank>"] = status_counts.get(status or "<blank>", 0) + 1

        if status not in ALLOWED_STATUSES:
            issues.append({
                "id": entry.get("id"),
                "company": entry.get("company"),
                "title": entry.get("title"),
                "issue": "unknown-status",
                "status": original_status,
            })

        if status in VERIFIED_STATUSES:
            missing = []
            if not has_confirmation_evidence(entry):
                missing.append("confirmation evidence")
            if not has_submitted_answers(entry):
                missing.append("submitted answers")
            if not has_package_or_exemption(entry):
                missing.append("package path or no-tailoring rationale")
            if missing:
                issues.append({
                    "id": entry.get("id"),
                    "company": entry.get("company"),
                    "title": entry.get("title"),
                    "issue": "verified-entry-missing-evidence",
                    "missing": missing,
                    "status": status,
                })

        if status in PENDING_STATUSES | REJECTION_STATUSES:
            if fix and not entry.get("workflowExcluded"):
                entry["workflowExcluded"] = True
                entry["workflowExcludedReason"] = (
                    "Incomplete, unresolved, skipped, rejected, or pending role. "
                    "Skip during ordinary discovery. Reapply only if normal sourcing rediscovers "
                    "it naturally as a strong current match and a fast live check proves the listing "
                    "is open and no employer, ATS, duplicate, cooldown, account, or application-history "
                    "restriction blocks another submission."
                )
                entry["workflowExcludedAt"] = now
                excluded += 1

    return {
        "generatedAt": now,
        "tracker": str(TRACKER.relative_to(ROOT)),
        "total": len(entries),
        "statusCounts": dict(sorted(status_counts.items())),
        "verifiedCount": sum(status_counts.get(status, 0) for status in VERIFIED_STATUSES),
        "issueCount": len(issues),
        "normalizedStatuses": normalized,
        "workflowExcludedMarked": excluded,
        "issues": issues,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit application tracker evidence and status consistency.")
    parser.add_argument("--tracker", type=Path, default=TRACKER)
    parser.add_argument("--report", type=Path, default=REPORT)
    parser.add_argument("--fix", action="store_true", help="Normalize legacy statuses and mark incomplete roles excluded.")
    args = parser.parse_args()

    entries = load_tracker(args.tracker)
    report = audit(entries, fix=args.fix)
    if args.fix:
        write_tracker(args.tracker, entries)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 1 if report["issueCount"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
