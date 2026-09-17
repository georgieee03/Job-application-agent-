#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
TRACKER = ROOT / "data" / "application-tracker.json"
ARCHIVE_ROOT = ROOT / "Incomplete Application"
MANIFEST = ARCHIVE_ROOT / "archive-manifest.json"

VERIFIED_STATUSES = {"submitted - email verified", "submitted - portal verified", "interview", "accepted"}
LEGACY_STATUS_ALIASES = {
    "ready-to-submit": "approved",
    "submitted-pending-verification": "submitted - pending email verification",
    "submitted - pending email/portal verification": "submitted - pending email verification",
    "blocked - replaced": "skipped",
}
PATH_FIELDS = {
    "packageDir",
    "package_dir",
    "resumePath",
    "resume_path",
    "coverLetterPath",
    "cover_letter_path",
    "validationReport",
    "validation_report",
    "approvalManifest",
    "approval_manifest",
    "applicationResponses",
    "application_responses",
    "confirmation_screenshot",
    "confirmationScreenshot",
    "provider_response_path",
    "providerResponsePath",
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def load_tracker() -> list[dict[str, Any]]:
    return json.loads(TRACKER.read_text(encoding="utf-8-sig"))


def save_tracker(entries: list[dict[str, Any]]) -> None:
    TRACKER.write_text(json.dumps(entries, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def canonical_status(status: Any) -> str:
    value = str(status or "").strip().lower()
    return LEGACY_STATUS_ALIASES.get(value, value)


def is_incomplete(entry: dict[str, Any]) -> bool:
    status = canonical_status(entry.get("status"))
    return status not in VERIFIED_STATUSES


def resolve_workspace_path(value: Any) -> Path | None:
    if not isinstance(value, str) or not value.strip():
        return None
    candidate = Path(value.strip())
    if not candidate.is_absolute():
        candidate = ROOT / candidate
    try:
        resolved = candidate.resolve()
    except OSError:
        return None
    try:
        resolved.relative_to(ROOT)
    except ValueError:
        return None
    return resolved


def candidate_dirs(entry: dict[str, Any]) -> set[Path]:
    dirs: set[Path] = set()
    for field in PATH_FIELDS:
        path = resolve_workspace_path(entry.get(field))
        if not path:
            continue
        dirs.add(path if path.is_dir() else path.parent)
    return {path for path in dirs if should_archive_dir(path)}


def should_archive_dir(path: Path) -> bool:
    try:
        path.relative_to(ARCHIVE_ROOT)
        return False
    except ValueError:
        pass
    if not path.exists() or not path.is_dir():
        return False
    if path == ROOT or path == ROOT / "data" or path == ROOT / "scripts":
        return False
    if path.parent == ROOT:
        return False
    return True


def archive_destination(path: Path) -> Path:
    relative = path.relative_to(ROOT)
    destination = ARCHIVE_ROOT / relative
    if not destination.exists():
        return destination
    suffix = 2
    while True:
        candidate = destination.with_name(f"{destination.name}-{suffix}")
        if not candidate.exists():
            return candidate
        suffix += 1


def rel(path: Path) -> str:
    return str(path.relative_to(ROOT))


def replace_path_value(value: Any, moves: dict[Path, Path]) -> Any:
    if isinstance(value, list):
        return [replace_path_value(item, moves) for item in value]
    if isinstance(value, dict):
        return {key: replace_path_value(item, moves) for key, item in value.items()}
    path = resolve_workspace_path(value)
    if not path:
        return value
    for source, destination in sorted(moves.items(), key=lambda item: len(str(item[0])), reverse=True):
        try:
            suffix = path.relative_to(source)
        except ValueError:
            continue
        return rel(destination / suffix)
    return value


def main() -> int:
    parser = argparse.ArgumentParser(description="Move incomplete application package artifacts into Incomplete Application.")
    parser.add_argument("--apply", action="store_true", help="Actually move directories and update tracker paths.")
    args = parser.parse_args()

    entries = load_tracker()
    incomplete = [entry for entry in entries if is_incomplete(entry)]
    directories: dict[Path, list[str]] = {}
    for entry in incomplete:
        for path in candidate_dirs(entry):
            directories.setdefault(path, []).append(str(entry.get("id") or "unknown"))

    moves = {path: archive_destination(path) for path in sorted(directories)}
    now = utc_now()
    manifest = {
        "generatedAt": now,
        "applied": bool(args.apply),
        "archiveRoot": rel(ARCHIVE_ROOT),
        "incompleteEntries": len(incomplete),
        "moves": [
            {
                "from": rel(source),
                "to": rel(destination),
                "entryIds": sorted(set(directories[source])),
            }
            for source, destination in moves.items()
        ],
    }

    if args.apply:
        ARCHIVE_ROOT.mkdir(parents=True, exist_ok=True)
        for source, destination in moves.items():
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(source), str(destination))
        for entry in incomplete:
            entry["workflowExcluded"] = True
            entry["workflowExcludedReason"] = (
                "Incomplete/stale role archived under Incomplete Application; skip during ordinary discovery. "
                "Reapply only if normal sourcing rediscovers it naturally as a strong current match and a fast "
                "live check proves the listing is open and no employer, ATS, duplicate, cooldown, account, "
                "or application-history restriction blocks another submission."
            )
            entry["workflowExcludedAt"] = entry.get("workflowExcludedAt") or now
            entry["incompleteArchiveRoot"] = rel(ARCHIVE_ROOT)
            for key, value in list(entry.items()):
                entry[key] = replace_path_value(value, moves)
        save_tracker(entries)
        MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(json.dumps(manifest, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
