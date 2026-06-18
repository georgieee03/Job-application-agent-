#!/usr/bin/env python3
"""Maintain a complete Markdown and JSON job-application handoff ledger."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


STATUSES = {
    "discovered",
    "screened",
    "tailoring",
    "awaiting-approval",
    "approved",
    "form-in-progress",
    "awaiting-user",
    "submitted",
    "submitted - email verified",
    "submitted - portal verified",
    "submitted - pending email verification",
    "not submitted",
    "not completed",
    "manual submit needed",
    "rejected",
    "interview",
    "accepted",
    "needs-review",
    "blocked",
    "skipped",
}

COUNTABLE_SUBMITTED_STATUSES = {
    "submitted - email verified",
    "submitted - portal verified",
}

SUBMITTED_STATUSES = {
    "submitted",
    "submitted - email verified",
    "submitted - portal verified",
    "submitted - pending email verification",
}

APPLICATION_FIELDS = [
    "company",
    "role",
    "job_url",
    "location",
    "provider",
    "visa_compatible",
    "fit_notes",
    "eligibility_notes",
    "package_dir",
    "resume_path",
    "cover_letter_path",
    "ats_score",
    "approval_manifest",
    "approval_manifest_sha256",
    "approval_status",
    "approved_at",
    "approval_evidence",
    "browser_surface",
    "browser_url",
    "browser_account",
    "browser_step",
    "status",
    "attempted_at",
    "blocker",
    "next_action",
    "confirmation_type",
    "confirmation_text",
    "confirmation_url",
    "confirmation_number",
    "confirmation_screenshot",
    "submitted_at",
    "submitted_answers",
    "application_report",
    "tracker_sync_status",
    "tracker_synced_at",
    "tracker_sync_commit",
]

RUN_MUTABLE_FIELDS = {
    "objective",
    "target_count",
    "candidate_answers",
    "workbench_url",
    "next_action",
    "workbench_started_by_batch",
    "workbench_pid",
    "background_processes",
    "created_browser_tabs",
    "created_subagents",
    "cleanup_status",
    "cleanup_actions",
    "retained_handoffs",
}


def now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def paths(run_dir: str) -> tuple[Path, Path]:
    root = Path(run_dir).resolve()
    return root / "application-workbench.json", root / "application-workbench.md"


def empty_application(role_id: str) -> dict[str, Any]:
    item: dict[str, Any] = {"role_id": role_id}
    item.update({field: "" for field in APPLICATION_FIELDS})
    item["status"] = "discovered"
    return item


def load_state(run_dir: str) -> dict[str, Any]:
    json_path, _ = paths(run_dir)
    if not json_path.exists():
        raise SystemExit(f"Ledger not initialized: {json_path}")
    return json.loads(json_path.read_text(encoding="utf-8"))


def atomic_write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temp_name = tempfile.mkstemp(
        prefix=f".{path.name}.", suffix=".tmp", dir=path.parent
    )
    try:
        with os.fdopen(handle, "w", encoding="utf-8", newline="\n") as stream:
            stream.write(text)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp_name, path)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)


def save_state(run_dir: str, state: dict[str, Any]) -> None:
    state["updated_at"] = now()
    json_path, md_path = paths(run_dir)
    ensure_application_report_paths(state)
    atomic_write(json_path, json.dumps(state, indent=2, ensure_ascii=True) + "\n")
    atomic_write(md_path, render_markdown(state))
    write_application_reports(state)


def md(value: Any) -> str:
    return str(value if value not in (None, "") else "-").replace("|", r"\|").replace(
        "\n", "<br>"
    )


def link_or_text(value: Any) -> str:
    text = str(value or "")
    if not text:
        return "-"
    if text.startswith(("http://", "https://")):
        return f"[link]({text})"
    return f"`{md(text)}`"


def render_markdown(state: dict[str, Any]) -> str:
    apps = state.get("applications", [])
    submitted = [app for app in apps if app.get("status") in COUNTABLE_SUBMITTED_STATUSES]
    unresolved = [q for q in state.get("questions", []) if not q.get("answer")]
    status_counts: dict[str, int] = {}
    for app in apps:
        status = app.get("status", "discovered")
        status_counts[status] = status_counts.get(status, 0) + 1

    lines = [
        "# Application Workbench",
        "",
        "## Run",
        "",
        f"- Objective: {md(state.get('objective'))}",
        f"- Target submitted: {state.get('target_count', 0)}",
        f"- Authoritatively submitted: {len(submitted)}",
        f"- Created: {md(state.get('created_at'))}",
        f"- Updated: {md(state.get('updated_at'))}",
        f"- Workspace: `{md(state.get('workspace'))}`",
        f"- Candidate answers: `{md(state.get('candidate_answers'))}`",
        f"- Workbench URL: {link_or_text(state.get('workbench_url'))}",
        f"- Next action: {md(state.get('next_action'))}",
        "",
        "## Runtime Ownership And Cleanup",
        "",
        f"- Workbench started by batch: {md(state.get('workbench_started_by_batch'))}",
        f"- Workbench PID: {md(state.get('workbench_pid'))}",
        f"- Background processes: {md(state.get('background_processes'))}",
        f"- Created browser tabs: {md(state.get('created_browser_tabs'))}",
        f"- Created subagents: {md(state.get('created_subagents'))}",
        f"- Cleanup status: {md(state.get('cleanup_status'))}",
        f"- Cleanup actions: {md(state.get('cleanup_actions'))}",
        f"- Retained handoffs: {md(state.get('retained_handoffs'))}",
        "",
        "## Verification Panel",
        "",
        f"- Target met: {'yes' if len(submitted) >= int(state.get('target_count', 0)) else 'no'}",
        f"- Unresolved questions: {len(unresolved)}",
        f"- Last audit passed: {'yes' if state.get('audit', {}).get('passed') else 'no'}",
        f"- Status counts: {md(', '.join(f'{key}={value}' for key, value in sorted(status_counts.items())))}",
        "",
        "## Applications",
        "",
        "| ID | Company | Role | Status | ATS | Approval | Confirmation | Blocker | Next action |",
        "| --- | --- | --- | --- | ---: | --- | --- | --- | --- |",
    ]
    for app in apps:
        confirmation = (
            app.get("confirmation_number")
            or app.get("confirmation_text")
            or app.get("confirmation_type")
            or app.get("confirmation_screenshot")
            or app.get("confirmation_url")
        )
        lines.append(
            "| {id} | {company} | {role} | {status} | {ats} | {approval} | "
            "{confirmation} | {blocker} | {next_action} |".format(
                id=md(app.get("role_id")),
                company=md(app.get("company")),
                role=md(app.get("role")),
                status=md(app.get("status")),
                ats=md(app.get("ats_score")),
                approval=md(app.get("approval_status")),
                confirmation=md(confirmation),
                blocker=md(app.get("blocker")),
                next_action=md(app.get("next_action")),
            )
        )

    lines.extend(["", "## Role Details", ""])
    for app in apps:
        lines.extend(
            [
                f"### {md(app.get('company'))} - {md(app.get('role'))}",
                "",
                f"- Role ID: `{md(app.get('role_id'))}`",
                f"- Job: {link_or_text(app.get('job_url'))}",
                f"- Location / provider: {md(app.get('location'))} / {md(app.get('provider'))}",
                f"- Visa compatible: {md(app.get('visa_compatible'))}",
                f"- Fit: {md(app.get('fit_notes'))}",
                f"- Eligibility: {md(app.get('eligibility_notes'))}",
                f"- Package: `{md(app.get('package_dir'))}`",
                f"- Resume: `{md(app.get('resume_path'))}`",
                f"- Cover letter: `{md(app.get('cover_letter_path'))}`",
                f"- ATS heuristic: {md(app.get('ats_score'))}",
                f"- Manifest: `{md(app.get('approval_manifest'))}`",
                f"- Manifest SHA-256: `{md(app.get('approval_manifest_sha256'))}`",
                f"- Approval: {md(app.get('approval_status'))} at {md(app.get('approved_at'))}",
                f"- Approval evidence: {md(app.get('approval_evidence'))}",
                f"- Browser: {md(app.get('browser_surface'))} / {link_or_text(app.get('browser_url'))}",
                f"- Browser account / step: {md(app.get('browser_account'))} / {md(app.get('browser_step'))}",
                f"- Attempted / submitted: {md(app.get('attempted_at'))} / {md(app.get('submitted_at'))}",
                f"- Confirmation type: {md(app.get('confirmation_type'))}",
                f"- Confirmation text: {md(app.get('confirmation_text'))}",
                f"- Confirmation number: {md(app.get('confirmation_number'))}",
                f"- Confirmation URL: {link_or_text(app.get('confirmation_url'))}",
                f"- Confirmation screenshot: `{md(app.get('confirmation_screenshot'))}`",
                f"- Submitted answers: {md(app.get('submitted_answers'))}",
                f"- Application report: `{md(app.get('application_report'))}`",
                f"- Tracker sync: {md(app.get('tracker_sync_status'))} at {md(app.get('tracker_synced_at'))}",
                f"- Tracker sync commit: `{md(app.get('tracker_sync_commit'))}`",
                f"- Blocker: {md(app.get('blocker'))}",
                f"- Next action: {md(app.get('next_action'))}",
                "",
            ]
        )

    lines.extend(
        [
            "## Unresolved Questions",
            "",
            "| Time | Role ID | Question | Answer |",
            "| --- | --- | --- | --- |",
        ]
    )
    for question in state.get("questions", []):
        lines.append(
            f"| {md(question.get('time'))} | {md(question.get('role_id'))} | "
            f"{md(question.get('question'))} | {md(question.get('answer'))} |"
        )

    lines.extend(
        [
            "",
            "## Event Log",
            "",
            "| Time | Role ID | Event |",
            "| --- | --- | --- |",
        ]
    )
    for event in state.get("events", []):
        lines.append(
            f"| {md(event.get('time'))} | {md(event.get('role_id'))} | {md(event.get('message'))} |"
        )

    audit = state.get("audit", {})
    lines.extend(
        [
            "",
            "## Last Audit",
            "",
            f"- Time: {md(audit.get('time'))}",
            f"- Passed: {md(audit.get('passed'))}",
            f"- Submitted count: {md(audit.get('submitted_count'))}",
            f"- Issues: {md('; '.join(audit.get('issues', [])))}",
            "",
            "## Machine-Readable Snapshot",
            "",
            "The JSON mirror is `application-workbench.json`. Its `updated_at` must",
            "match this document before another session continues.",
            "",
        ]
    )
    return "\n".join(lines)


def safe_report_name(app: dict[str, Any]) -> str:
    role_id = str(app.get("role_id") or "unknown-role")
    safe = "".join(
        character.lower() if character.isalnum() else "-"
        for character in role_id.strip()
    ).strip("-")
    return safe or "unknown-role"


def application_report_path(state: dict[str, Any], app: dict[str, Any]) -> Path:
    workspace = Path(state["workspace"])
    return workspace / "data" / "application-reports" / f"{safe_report_name(app)}.md"


def ensure_application_report_paths(state: dict[str, Any]) -> None:
    workspace = Path(state["workspace"])
    for app in state.get("applications", []):
        report_path = app.get("application_report")
        if not report_path:
            app["application_report"] = str(
                application_report_path(state, app).relative_to(workspace)
            ).replace(os.sep, "/")


def write_application_reports(state: dict[str, Any]) -> None:
    for app in state.get("applications", []):
        atomic_write(application_report_path(state, app), render_application_report(state, app))


def render_application_report(state: dict[str, Any], app: dict[str, Any]) -> str:
    lines = [
        f"# Application Report - {md(app.get('company'))} - {md(app.get('role'))}",
        "",
        "## Identity",
        "",
        f"- Role ID: `{md(app.get('role_id'))}`",
        f"- Company: {md(app.get('company'))}",
        f"- Role: {md(app.get('role'))}",
        f"- Job URL: {link_or_text(app.get('job_url'))}",
        f"- Location: {md(app.get('location'))}",
        f"- Provider: {md(app.get('provider'))}",
        f"- Status: {md(app.get('status'))}",
        "",
        "## Process Summary",
        "",
        f"- Attempted at: {md(app.get('attempted_at'))}",
        f"- Submitted at: {md(app.get('submitted_at'))}",
        f"- Approval status: {md(app.get('approval_status'))}",
        f"- Approval evidence: {md(app.get('approval_evidence'))}",
        f"- Package directory: `{md(app.get('package_dir'))}`",
        f"- Resume path: `{md(app.get('resume_path'))}`",
        f"- Cover letter path: `{md(app.get('cover_letter_path'))}`",
        f"- ATS heuristic: {md(app.get('ats_score'))}",
        f"- Fit notes: {md(app.get('fit_notes'))}",
        f"- Eligibility notes: {md(app.get('eligibility_notes'))}",
        f"- Blocker: {md(app.get('blocker'))}",
        f"- Next action: {md(app.get('next_action'))}",
        "",
        "## Submitted Answers",
        "",
        md(app.get("submitted_answers")),
        "",
        "## Evidence",
        "",
        f"- Confirmation type: {md(app.get('confirmation_type'))}",
        f"- Confirmation text: {md(app.get('confirmation_text'))}",
        f"- Confirmation number: {md(app.get('confirmation_number'))}",
        f"- Confirmation URL: {link_or_text(app.get('confirmation_url'))}",
        f"- Confirmation screenshot: `{md(app.get('confirmation_screenshot'))}`",
        f"- Browser surface: {md(app.get('browser_surface'))}",
        f"- Browser URL: {link_or_text(app.get('browser_url'))}",
        f"- Browser account: {md(app.get('browser_account'))}",
        f"- Browser step: {md(app.get('browser_step'))}",
        "",
        "## Tracker Sync",
        "",
        f"- Tracker sync status: {md(app.get('tracker_sync_status'))}",
        f"- Tracker synced at: {md(app.get('tracker_synced_at'))}",
        f"- Tracker sync commit: `{md(app.get('tracker_sync_commit'))}`",
        "",
        "## Notes",
        "",
        "- Do not store passwords, cookies, raw session data, CAPTCHA answers, or one-time codes in this report.",
        "- This report is intended to sync through git with the application trackers for cross-device duplicate prevention.",
        "",
    ]
    return "\n".join(lines)


def parse_sets(values: list[str]) -> dict[str, str]:
    updates: dict[str, str] = {}
    for value in values:
        if "=" not in value:
            raise SystemExit(f"--set requires key=value: {value}")
        key, item = value.split("=", 1)
        if key not in APPLICATION_FIELDS:
            raise SystemExit(f"Unknown application field: {key}")
        updates[key] = item
    if "status" in updates and updates["status"] not in STATUSES:
        raise SystemExit(f"Unknown status: {updates['status']}")
    return updates


def parse_run_sets(values: list[str]) -> dict[str, Any]:
    updates: dict[str, Any] = {}
    for value in values:
        if "=" not in value:
            raise SystemExit(f"--set requires key=value: {value}")
        key, item = value.split("=", 1)
        if key not in RUN_MUTABLE_FIELDS:
            raise SystemExit(f"Unknown run field: {key}")
        if key == "target_count":
            try:
                parsed = int(item)
            except ValueError as error:
                raise SystemExit("target_count must be an integer") from error
            if parsed < 0:
                raise SystemExit("target_count must be non-negative")
            updates[key] = parsed
        else:
            updates[key] = item
    return updates


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def resolve_workspace_path(state: dict[str, Any], value: str) -> Path:
    path = Path(value)
    return path if path.is_absolute() else Path(state["workspace"]) / path


def verify_manifest(state: dict[str, Any], app: dict[str, Any], issues: list[str]) -> None:
    manifest_value = app.get("approval_manifest")
    if not manifest_value:
        issues.append(f"{app['role_id']}: approved/submitted role has no manifest")
        return
    manifest_path = resolve_workspace_path(state, manifest_value)
    if not manifest_path.exists():
        issues.append(f"{app['role_id']}: manifest missing: {manifest_path}")
        return
    actual_manifest_hash = sha256(manifest_path)
    expected_manifest_hash = app.get("approval_manifest_sha256")
    if expected_manifest_hash and actual_manifest_hash != expected_manifest_hash.lower():
        issues.append(f"{app['role_id']}: manifest hash mismatch")
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        issues.append(f"{app['role_id']}: manifest unreadable: {error}")
        return
    for entry in manifest.get("files", {}).values():
        entries = entry if isinstance(entry, list) else [entry]
        for file_info in entries:
            if not isinstance(file_info, dict) or not file_info.get("path"):
                continue
            file_path = Path(file_info["path"])
            if not file_path.is_absolute():
                file_path = manifest_path.parent / file_path
            if not file_path.exists():
                issues.append(f"{app['role_id']}: approved file missing: {file_path}")
            elif file_info.get("sha256") and sha256(file_path) != file_info["sha256"].lower():
                issues.append(f"{app['role_id']}: approved file hash mismatch: {file_path.name}")


def command_init(args: argparse.Namespace) -> None:
    json_path, _ = paths(args.run_dir)
    if json_path.exists() and not args.force:
        raise SystemExit(f"Ledger already exists: {json_path}")
    timestamp = now()
    state = {
        "schema_version": 1,
        "objective": args.objective,
        "target_count": args.target_count,
        "created_at": timestamp,
        "updated_at": timestamp,
        "workspace": str(Path(args.workspace or Path.cwd()).resolve()),
        "candidate_answers": args.candidate_answers,
        "workbench_url": args.workbench_url,
        "next_action": args.next_action,
        "workbench_started_by_batch": "",
        "workbench_pid": "",
        "background_processes": "",
        "created_browser_tabs": "",
        "created_subagents": "",
        "cleanup_status": "not-started",
        "cleanup_actions": "",
        "retained_handoffs": "",
        "applications": [],
        "questions": [],
        "events": [{"time": timestamp, "role_id": "", "message": "Ledger initialized"}],
        "audit": {"time": "", "passed": False, "submitted_count": 0, "issues": ["Not audited"]},
    }
    save_state(args.run_dir, state)


def command_upsert(args: argparse.Namespace) -> None:
    state = load_state(args.run_dir)
    app = next(
        (item for item in state["applications"] if item["role_id"] == args.role_id),
        None,
    )
    if app is None:
        app = empty_application(args.role_id)
        state["applications"].append(app)
    for key, value in {
        "company": args.company,
        "role": args.role,
        "job_url": args.job_url,
    }.items():
        if value is not None:
            app[key] = value
    app.update(parse_sets(args.set))
    if app["status"] in SUBMITTED_STATUSES and not any(
        app.get(field)
        for field in (
            "confirmation_text",
            "confirmation_number",
            "confirmation_url",
            "confirmation_screenshot",
            "confirmation_type",
        )
    ):
        raise SystemExit("submitted status requires authoritative confirmation evidence")
    save_state(args.run_dir, state)


def command_event(args: argparse.Namespace) -> None:
    state = load_state(args.run_dir)
    state["events"].append(
        {"time": now(), "role_id": args.role_id or "", "message": args.message}
    )
    save_state(args.run_dir, state)


def command_set_run(args: argparse.Namespace) -> None:
    state = load_state(args.run_dir)
    state.update(parse_run_sets(args.set))
    save_state(args.run_dir, state)


def command_question(args: argparse.Namespace) -> None:
    state = load_state(args.run_dir)
    state["questions"].append(
        {
            "time": now(),
            "role_id": args.role_id or "",
            "question": args.question,
            "answer": args.answer or "",
        }
    )
    save_state(args.run_dir, state)


def command_audit(args: argparse.Namespace) -> None:
    state = load_state(args.run_dir)
    issues: list[str] = []
    apps = state.get("applications", [])
    submitted = [app for app in apps if app.get("status") in COUNTABLE_SUBMITTED_STATUSES]
    if len({app["role_id"] for app in submitted}) != len(submitted):
        issues.append("Duplicate submitted role IDs")
    for app in apps:
        if app.get("status") in {"approved", "form-in-progress"} | SUBMITTED_STATUSES:
            verify_manifest(state, app, issues)
        if app.get("status") in SUBMITTED_STATUSES and not any(
            app.get(field)
            for field in (
                "confirmation_text",
                "confirmation_number",
                "confirmation_url",
                "confirmation_screenshot",
                "confirmation_type",
            )
        ):
            issues.append(f"{app['role_id']}: submitted without confirmation evidence")
        if app.get("status") in COUNTABLE_SUBMITTED_STATUSES and not app.get("submitted_answers"):
            issues.append(f"{app['role_id']}: verified submission missing submitted answers")
        if app.get("status") in COUNTABLE_SUBMITTED_STATUSES and not app.get("application_report"):
            issues.append(f"{app['role_id']}: verified submission missing application report")
    if len(submitted) < int(state.get("target_count", 0)):
        issues.append(
            f"Target not met: {len(submitted)}/{int(state.get('target_count', 0))} submitted"
        )
    run_root = paths(args.run_dir)[0].parent
    otp_files = [
        path
        for path in run_root.rglob("*")
        if path.is_file()
        and path.suffix.lower() in {".txt", ".code", ".json"}
        and any(token in path.name.lower() for token in ("security-code", "otp-code"))
    ]
    if otp_files:
        issues.append(f"One-time code files remain: {len(otp_files)}")
    state["audit"] = {
        "time": now(),
        "passed": not issues,
        "submitted_count": len(submitted),
        "issues": issues,
    }
    save_state(args.run_dir, state)
    print(json.dumps(state["audit"], indent=2))
    if issues:
        raise SystemExit(1)


def command_render(args: argparse.Namespace) -> None:
    state = load_state(args.run_dir)
    save_state(args.run_dir, state)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)

    init = subparsers.add_parser("init")
    init.add_argument("--run-dir", required=True)
    init.add_argument("--objective", required=True)
    init.add_argument("--target-count", type=int, required=True)
    init.add_argument("--workspace")
    init.add_argument("--candidate-answers", default="data/candidate-application-answers.md")
    init.add_argument("--workbench-url", default="http://localhost:4321/")
    init.add_argument("--next-action", default="Source and screen compatible roles")
    init.add_argument("--force", action="store_true")
    init.set_defaults(func=command_init)

    upsert = subparsers.add_parser("upsert")
    upsert.add_argument("--run-dir", required=True)
    upsert.add_argument("--role-id", required=True)
    upsert.add_argument("--company")
    upsert.add_argument("--role")
    upsert.add_argument("--job-url")
    upsert.add_argument("--set", action="append", default=[])
    upsert.set_defaults(func=command_upsert)

    event = subparsers.add_parser("event")
    event.add_argument("--run-dir", required=True)
    event.add_argument("--role-id")
    event.add_argument("--message", required=True)
    event.set_defaults(func=command_event)

    set_run = subparsers.add_parser("set-run")
    set_run.add_argument("--run-dir", required=True)
    set_run.add_argument("--set", action="append", required=True)
    set_run.set_defaults(func=command_set_run)

    question = subparsers.add_parser("question")
    question.add_argument("--run-dir", required=True)
    question.add_argument("--role-id")
    question.add_argument("--question", required=True)
    question.add_argument("--answer")
    question.set_defaults(func=command_question)

    audit = subparsers.add_parser("audit")
    audit.add_argument("--run-dir", required=True)
    audit.set_defaults(func=command_audit)

    render = subparsers.add_parser("render")
    render.add_argument("--run-dir", required=True)
    render.set_defaults(func=command_render)
    return parser


def main() -> None:
    args = build_parser().parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
