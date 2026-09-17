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
DEFAULT_INPUT = ROOT / "data" / "email-application-outcomes.json"
DEFAULT_REPORT = ROOT / "data" / "email-application-outcome-sync.json"

REJECTION_WORDS = re.compile(
    r"\b(unfortunately|not moving forward|not proceed|not selected|decided to move forward with other|"
    r"pursue other candidates|no longer under consideration|will not be moving forward|unable to offer)\b",
    re.IGNORECASE,
)
CONFIRMATION_WORDS = re.compile(
    r"\b(application received|thanks for applying|thank you for applying|we received your application|"
    r"application has been submitted|successfully submitted)\b",
    re.IGNORECASE,
)
INTERVIEW_WORDS = re.compile(r"\b(interview|phone screen|schedule a call|next step)\b", re.IGNORECASE)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def normalize(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def save_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def infer_outcome(item: dict[str, Any]) -> str:
    explicit = normalize(item.get("outcome"))
    if explicit in {"rejected", "rejection", "declined"}:
        return "rejected"
    if explicit in {"confirmation", "confirmed", "application received", "submitted"}:
        return "confirmation"
    if explicit in {"interview", "screen"}:
        return "interview"
    text = " ".join(str(item.get(key) or "") for key in ("subject", "snippet", "body", "text"))
    if REJECTION_WORDS.search(text):
        return "rejected"
    if INTERVIEW_WORDS.search(text):
        return "interview"
    if CONFIRMATION_WORDS.search(text):
        return "confirmation"
    return "unknown"


def match_entry(entries: list[dict[str, Any]], item: dict[str, Any]) -> dict[str, Any] | None:
    company = normalize(item.get("company"))
    title = normalize(item.get("title") or item.get("role"))
    url = normalize(item.get("url") or item.get("listingUrl") or item.get("applyUrl"))
    subject = normalize(item.get("subject"))
    sender = normalize(item.get("from") or item.get("sender"))

    scored: list[tuple[int, dict[str, Any]]] = []
    for entry in entries:
        score = 0
        entry_company = normalize(entry.get("company"))
        entry_title = normalize(entry.get("title"))
        entry_url = normalize(entry.get("listingUrl") or entry.get("applyUrl"))
        if company and (company == entry_company or company in entry_company or entry_company in company):
            score += 5
        if title and (title == entry_title or title in entry_title or entry_title in title):
            score += 4
        if url and entry_url and (url in entry_url or entry_url in url):
            score += 8
        if entry_company and entry_company in subject:
            score += 3
        if entry_title and entry_title in subject:
            score += 3
        if entry_company and entry_company in sender:
            score += 2
        if score >= 5:
            scored.append((score, entry))

    scored.sort(key=lambda pair: pair[0], reverse=True)
    return scored[0][1] if scored else None


def email_evidence(item: dict[str, Any], outcome: str, now: str) -> dict[str, Any]:
    return {
        "type": f"email-{outcome}",
        "subject": item.get("subject"),
        "from": item.get("from") or item.get("sender"),
        "date": item.get("date") or item.get("internalDate"),
        "messageId": item.get("message_id") or item.get("messageId") or item.get("id"),
        "threadId": item.get("thread_id") or item.get("threadId"),
        "snippet": item.get("snippet"),
        "recordedAt": now,
    }


def append_unique(values: list[dict[str, Any]], evidence: dict[str, Any]) -> list[dict[str, Any]]:
    key = (evidence.get("messageId"), evidence.get("threadId"), evidence.get("subject"), evidence.get("type"))
    for existing in values:
        existing_key = (
            existing.get("messageId"),
            existing.get("threadId"),
            existing.get("subject"),
            existing.get("type"),
        )
        if existing_key == key:
            return values
    return [*values, evidence]


def apply_outcome(entry: dict[str, Any], item: dict[str, Any], outcome: str, now: str) -> str:
    evidence = email_evidence(item, outcome, now)
    entry["emailEvidence"] = append_unique(list(entry.get("emailEvidence") or []), evidence)
    entry["emailLastCheckedAt"] = now

    if outcome == "rejected":
        entry["status"] = "rejected"
        entry["statusUpdatedAt"] = now
        entry["applied"] = True
        entry["workflowExcluded"] = True
        entry["workflowExcludedReason"] = (
            "Rejection email found; keep visible for duplicate prevention and skip during ordinary discovery. "
            "Reapply only if normal sourcing rediscovers it naturally as a strong current match and a fast live "
            "check proves the listing is open and no employer, ATS, duplicate, cooldown, account, or "
            "application-history restriction blocks another submission."
        )
        entry["reapplyAllowed"] = False
        entry["reapplyRestriction"] = "Rejected; no fresh no-restriction check has passed."
        entry["nextAction"] = (
            "Skip in ordinary runs. If rediscovered as a strong live match, perform a quick reapply-eligibility "
            "check and record the result before tailoring or submitting."
        )
        return "rejected"

    if outcome == "interview":
        entry["status"] = "interview"
        entry["statusUpdatedAt"] = now
        entry["applied"] = True
        entry["nextAction"] = "Review interview email and respond manually or with explicit user approval."
        return "interview"

    if outcome == "confirmation" and entry.get("status") == "submitted - pending email verification":
        entry["status"] = "submitted - email verified"
        entry["statusUpdatedAt"] = now
        entry["applied"] = True
        evidence_list = list(entry.get("confirmationEvidence") or [])
        entry["confirmationEvidence"] = append_unique(evidence_list, {
            **evidence,
            "type": "confirmation-email",
        })
        entry["nextAction"] = "Watch for employer follow-up."
        return "submitted - email verified"

    return "recorded-email-evidence"


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Apply read-only Gmail outcome findings to data/application-tracker.json. "
            "Input is a JSON array of normalized message summaries from the Gmail connector."
        )
    )
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--tracker", type=Path, default=TRACKER)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    entries = load_json(args.tracker)
    findings = load_json(args.input)
    if not isinstance(findings, list):
        raise SystemExit("Email outcome input must be a JSON array.")

    now = utc_now()
    results: list[dict[str, Any]] = []
    for item in findings:
        if not isinstance(item, dict):
            continue
        outcome = infer_outcome(item)
        entry = match_entry(entries, item)
        if not entry:
            results.append({"outcome": outcome, "action": "unmatched", "subject": item.get("subject")})
            continue
        action = apply_outcome(entry, item, outcome, now) if outcome != "unknown" else "unknown-outcome"
        results.append({
            "outcome": outcome,
            "action": action,
            "trackerId": entry.get("id"),
            "company": entry.get("company"),
            "title": entry.get("title"),
            "subject": item.get("subject"),
        })

    report = {
        "generatedAt": now,
        "dryRun": args.dry_run,
        "input": str(args.input),
        "matched": sum(1 for result in results if result.get("trackerId")),
        "unmatched": sum(1 for result in results if result.get("action") == "unmatched"),
        "results": results,
    }
    save_json(args.report, report)
    if not args.dry_run:
        save_json(args.tracker, entries)
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
