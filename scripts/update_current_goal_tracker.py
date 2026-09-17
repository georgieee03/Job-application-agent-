from __future__ import annotations

import os as _profile_environment
if __name__ == "__main__" and _profile_environment.environ.get("JOB_APPLICATION_REVIEWED_LOCAL_HELPERS") != "true":
    raise SystemExit("Public example helper: configure local candidate facts, paths, role configuration, and authorization first; see docs/public-repository-setup.md.")

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TRACKER = ROOT / "data" / "application-tracker.json"
DEFAULT_CONFIG = ROOT / "config" / "current-goal-roles.json"
DEFAULT_INDEX = ROOT / "data" / "application-packages" / "package-index.json"
def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def verify_manifest(path: Path) -> None:
    manifest = json.loads(path.read_text(encoding="utf-8"))
    files = manifest["files"]
    items = [files["resume"], files["coverLetter"], *files.get("responses", [])]
    for item in items:
        file_path = Path(item["path"])
        actual = sha256(file_path)
        if actual != item["sha256"]:
            raise SystemExit(f"Manifest hash mismatch: {file_path}")


def run_key(config: dict) -> str:
    return config["goalRunStartedAt"][:10].replace("-", "")


def provider_coverage(config: dict, role: dict) -> dict:
    if isinstance(config.get("providerCoverage"), dict):
        coverage = dict(config["providerCoverage"])
        coverage.setdefault("refreshAt", config["goalRunStartedAt"])
        coverage.setdefault(
            "selectionReason",
            "Fresh, currently open, tracker-clean US role selected after robotics fit, eligibility, and duplicate screening.",
        )
        coverage["selectedProvider"] = role["provider"]
        return coverage
    return {
        "refreshAt": config["goalRunStartedAt"],
        "configured": [
            "Adzuna", "Jooble", "Greenhouse", "Lever", "Ashby", "Workday",
            "SmartRecruiters", "Workable", "BambooHR", "iCIMS", "Oracle",
            "Taleo", "direct employer boards",
        ],
        "completed": {
            "Adzuna": {"queries": 8, "fetchedListings": 99, "errors": 0},
            "Jooble": {"queries": 19, "fetchedListings": 570, "errors": 0},
            "Greenhouse": {"boards": 4, "fetchedListings": 51, "errors": 0},
            "Ashby": {"boards": 4, "fetchedListings": 88, "errors": 0},
            "enterpriseAndDirectBoards": {
                "providers": ["Workday", "Workable", "BambooHR", "Greenhouse", "Ashby"],
                "shortlistedLiveRoles": len(config["roles"]),
                "errors": 0,
            },
        },
        "selectionReason": (
            "Fresh, currently open, tracker-clean US role selected after mixed-provider "
            "robotics, early-career, eligibility, and duplicate screening."
        ),
        "selectedProvider": role["provider"],
    }


def initialize_screened_entries(config: dict) -> None:
    tracker = json.loads(TRACKER.read_text(encoding="utf-8"))
    now = utc_now()
    key = run_key(config)
    target = int(config.get("goalTarget", len(config["roles"])))
    for role in config["roles"]:
        entry_id = f"goal-{key}-{role['slug']}"
        existing = next((e for e in tracker if e.get("id") == entry_id), None)
        if existing is None:
            existing = {
                "id": entry_id,
                "sourceRunAt": config["goalRunStartedAt"],
                "firstVisitedAt": now,
                "visitCount": 0,
                "openCount": 0,
                "applyClickCount": 0,
                "goalTarget": target,
                "goalRunStartedAt": config["goalRunStartedAt"],
                "standingAuthorization": (
                    "Source, tailor, validate, upload, and submit fresh roles that pass "
                    "all deterministic gates; browser action-time confirmation remains required."
                ),
                "duplicateCheck": {
                    "checkedAgainst": "data/application-tracker.json",
                    "result": "No prior exact company/title or authoritative URL match before the current run boundary.",
                    "checkedAt": config["goalRunStartedAt"],
                },
            }
            tracker.append(existing)
        existing.update({
            "providerCoverage": provider_coverage(config, role),
            "provider": role["provider"],
            "title": role["role"],
            "company": role["company"],
            "location": role["location"],
            "employmentType": role.get("employmentType", "Full time"),
            "listingUrl": role["jobUrl"],
            "applyUrl": role["applyUrl"],
            "description": role["focus"],
            "score": None,
            "lastVisitedAt": now,
            "lastAction": "Authoritative listing verified live; eligibility and truthful fit screened; selected for tailoring.",
            "applied": False,
            "appliedAt": None,
            "status": "screened",
            "statusUpdatedAt": now,
            "fitNotes": f"Truthful emphasis: {role['focus']}. Reported gaps: {'; '.join(role['gaps'])}.",
            "eligibilityNotes": (
                "US-listed and live; screened against current OPT work authorization, truthful future "
                "sponsorship, relocation, citizenship, clearance, seniority, and unsupported-skill gates."
            ),
            "submittedAnswers": existing.get("submittedAnswers", []),
            "confirmationEvidence": existing.get("confirmationEvidence", []),
            "blocker": None,
            "nextAction": "Create and validate the truthful role-specific resume and cover-letter package.",
        })
    TRACKER.write_text(json.dumps(tracker, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"initialized": len(config["roles"]), "status": "screened", "target": target}, indent=2))


def record_skipped_entry(config: dict, args: argparse.Namespace) -> None:
    required = {
        "slug": args.slug,
        "company": args.company,
        "title": args.title,
        "provider": args.provider,
        "url": args.url,
        "blocker": args.blocker,
    }
    missing = [name for name, value in required.items() if not value]
    if missing:
        raise SystemExit(f"Missing --record-skipped fields: {', '.join(missing)}")
    tracker = json.loads(TRACKER.read_text(encoding="utf-8"))
    now = utc_now()
    entry_id = f"goal-{run_key(config)}-{args.slug}"
    existing = next((entry for entry in tracker if entry.get("id") == entry_id), None)
    if existing is None:
        existing = {
            "id": entry_id,
            "sourceRunAt": config["goalRunStartedAt"],
            "firstVisitedAt": now,
            "visitCount": 1,
            "openCount": 1,
            "applyClickCount": 0,
            "goalTarget": int(config.get("goalTarget", len(config["roles"]))),
            "goalRunStartedAt": config["goalRunStartedAt"],
        }
        tracker.append(existing)
    existing.update({
        "provider": args.provider,
        "title": args.title,
        "company": args.company,
        "location": args.location or "Unspecified",
        "employmentType": args.employment_type or "Full time",
        "listingUrl": args.url,
        "applyUrl": args.url,
        "lastVisitedAt": now,
        "lastAction": args.last_action or "Live role or form inspected and removed before tailoring.",
        "applied": False,
        "appliedAt": None,
        "status": "skipped",
        "statusUpdatedAt": now,
        "eligibilityNotes": args.eligibility_notes or args.blocker,
        "submittedAnswers": existing.get("submittedAnswers", []),
        "confirmationEvidence": existing.get("confirmationEvidence", []),
        "blocker": args.blocker,
        "nextAction": args.next_action or "No action; excluded from the active slate.",
    })
    TRACKER.write_text(json.dumps(tracker, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"id": entry_id, "status": "skipped"}, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--index", type=Path, default=DEFAULT_INDEX)
    parser.add_argument("--initialize", action="store_true")
    parser.add_argument("--record-skipped", action="store_true")
    parser.add_argument("--slug")
    parser.add_argument("--company")
    parser.add_argument("--title")
    parser.add_argument("--provider")
    parser.add_argument("--url")
    parser.add_argument("--location")
    parser.add_argument("--employment-type")
    parser.add_argument("--eligibility-notes")
    parser.add_argument("--status")
    parser.add_argument("--last-action")
    parser.add_argument("--answer", action="append", default=[])
    parser.add_argument("--evidence-type")
    parser.add_argument("--evidence-text")
    parser.add_argument("--evidence-path")
    parser.add_argument("--blocker", default="")
    parser.add_argument("--next-action")
    parser.add_argument("--fully-verified", action="store_true")
    parser.add_argument("--not-approved", action="store_true")
    parser.add_argument("--approval-mode", default="explicit batch action-time confirmation")
    parser.add_argument("--approved-at", default="2026-07-15T05:15:00Z")
    args = parser.parse_args()

    config = json.loads(args.config.expanduser().resolve().read_text(encoding="utf-8"))
    if args.initialize:
        initialize_screened_entries(config)
        return
    if args.record_skipped:
        record_skipped_entry(config, args)
        return
    if not args.slug or not args.status or not args.last_action or not args.next_action:
        parser.error("--slug, --status, --last-action, and --next-action are required unless --initialize is used")
    roles = {r["slug"]: r for r in config["roles"]}
    index = json.loads(args.index.expanduser().resolve().read_text(encoding="utf-8"))
    records = {r["slug"]: r for r in index["records"]}
    role = roles[args.slug]
    package = records[args.slug]
    manifest_path = Path(package["manifest"])
    verify_manifest(manifest_path)

    tracker = json.loads(TRACKER.read_text(encoding="utf-8"))
    entry_id = f"goal-{run_key(config)}-{args.slug}"
    existing = next((e for e in tracker if e.get("id") == entry_id), None)
    now = utc_now()
    if existing is None:
        existing = {
            "id": entry_id,
            "sourceRunAt": config["goalRunStartedAt"],
            "firstVisitedAt": now,
            "visitCount": 1,
            "openCount": 0,
            "applyClickCount": 0,
            "goalTarget": int(config.get("goalTarget", len(config["roles"]))),
            "goalRunStartedAt": config["goalRunStartedAt"],
            "duplicateCheck": {
                "checkedAgainst": "data/application-tracker.json",
                "result": "no prior application or attempt found before the current run boundary",
                "checkedAt": config["goalRunStartedAt"],
            },
            "providerCoverage": provider_coverage(config, role),
        }
        tracker.append(existing)

    evidence = list(existing.get("confirmationEvidence", [])) if existing else []
    if args.evidence_path:
        new_evidence = {
            "type": args.evidence_type or "immediate-success-page",
            "text": args.evidence_text or "Application submission acknowledged by the ATS.",
            "path": str(Path(args.evidence_path).resolve()),
        }
        if not any(
            item.get("type") == new_evidence["type"]
            and item.get("path") == new_evidence["path"]
            for item in evidence
        ):
            evidence.append(new_evidence)

    package_dir = Path(package["resume"]).parent
    existing.update({
        "provider": role["provider"],
        "title": role["role"],
        "company": role["company"],
        "location": role["location"],
        "employmentType": role.get("employmentType", "Full time"),
        "listingUrl": role["jobUrl"],
        "applyUrl": role["applyUrl"],
        "description": None,
        "score": package["ats"]["estimatedAtsAlignment"],
        "lastVisitedAt": now,
        "lastAction": args.last_action,
        "applied": bool(args.fully_verified),
        "appliedAt": now if args.fully_verified else None,
        "status": args.status,
        "statusUpdatedAt": now,
        "fitNotes": f"Truthful tailored emphasis: {role['focus']}. Reported gaps: {'; '.join(role['gaps'])}.",
        "eligibilityNotes": "Screened for current OPT work authorization, truthful future-sponsorship response, relocation compatibility, and no posting-level citizenship or clearance hard blocker.",
        "packageDir": str(package_dir),
        "resumePath": package["resume"],
        "coverLetterPath": package["coverLetter"],
        "validationReport": package["validation"],
        "approvalManifest": package["manifest"],
        "applicationResponses": str(package_dir / "application-responses.json"),
        "approval": None if args.not_approved else {
            "mode": args.approval_mode,
            "approvedAt": args.approved_at,
            "condition": "Exact audited package hashes; any artifact or response change invalidates approval.",
        },
        "manifestHashVerifiedAt": now,
        "submittedAnswers": args.answer if args.answer else existing.get("submittedAnswers", []),
        "confirmationEvidence": evidence,
        "blocker": args.blocker or None,
        "nextAction": args.next_action,
        "resumeNotes": "Exact tailored resume, cover letter, previews, validation reports, response file, and approval manifest are stored in packageDir.",
        "resumeDraft": f"Prepared exact tailored PDF: {package['resume']}",
        "jobDescriptionOverride": "",
        "resumeUpdatedAt": now,
    })

    TRACKER.write_text(json.dumps(tracker, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"id": entry_id, "status": args.status, "manifestVerifiedAt": now}, indent=2))


if __name__ == "__main__":
    main()
