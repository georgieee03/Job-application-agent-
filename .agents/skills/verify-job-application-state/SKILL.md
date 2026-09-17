---
name: verify-job-application-state
description: Create, update, reconcile, and audit the single workbench tracker for a job-application run. Use when Codex must resume a run, record role status and evidence, preserve approvals and browser handoffs, list unresolved questions, verify manifest hashes and submission confirmations, maintain data/application-tracker.json, or decide whether the requested submitted-application target is actually complete.
---

# Verify Job Application State

Keep the whole run understandable from one file:

- `data/application-tracker.json`

That file is the durable source of truth and the workbench UI persistence
layer. Do not create new dated run ledgers such as
legacy run-specific sidecar files, Markdown tracker mirrors, or per-application
report files for new workflow state.

Generated packages, manifests, rendered previews, screenshots, and submission
result files may remain separate artifacts. Their paths and meaning must be
recorded on the corresponding tracker entry.

Read [references/ledger-schema.md](references/ledger-schema.md) before adding
new tracker fields or statuses.

## Tracker Entry Requirements

Each touched role in `data/application-tracker.json` should be able to answer:

- company, role, provider, location, and authoritative job URL;
- current status and when it changed;
- duplicate-check outcome;
- package directory and approved resume/cover-letter paths;
- approval manifest path and SHA-256 binding when a package is approved;
- submitted non-secret answers or an answer-summary field;
- browser surface, URL, account context, form step, and handoff state when
  unfinished;
- confirmation type, text, URL/number, screenshot path, provider/API response
  path, and submitted timestamp when submitted;
- blocker, unresolved question, and exact next action when incomplete;
- cleanup notes when a run created local resources that may need stopping.

Unknown values stay blank or absent. Do not guess.

## Update Rules

1. Update `data/application-tracker.json` after every status transition,
   approval, blocker, user answer, browser handoff, submission attempt, and
   confirmation.
2. Store paths relative to the workspace when practical.
3. Do not store passwords, cookies, CAPTCHA answers, one-time codes, raw
   session data, or private auth state in the tracker.
4. Bind approval to an `approval_manifest` path and
   `approval_manifest_sha256` when a tailored package is approved.
5. Mark `submitted` only with non-empty authoritative confirmation evidence.
6. Put the exact continuation instruction in a `next_action` or tracker notes
   field.
7. Record every answer actually submitted before marking a role
   `submitted - email verified` or `submitted - portal verified`.
8. Before starting discovery in a resumed run, read
   `data/application-tracker.json`.
9. Run `python scripts/audit_application_tracker.py --fix` before discovery or
   completion. Fix evidence gaps, status drift, and excluded-role state in the
   tracker instead of relying on chat memory.
10. When Gmail is available and authorized, reconcile rejection,
   confirmation, interview, and follow-up messages across all available
   mailbox history through read-only message searches. Store only bounded metadata/snippets needed for evidence in
   `emailEvidence`; do not store raw mailbox exports, OTPs, auth state, or
   sensitive message bodies.
11. Keep tracker updates in the local workbench tracker unless the user
   explicitly asks for a separate export.

## Reconcile

Compare the tracker against:

- each role's approval manifest, if present;
- validation reports and ATS heuristic artifacts, if present;
- submission result JSON, if present;
- confirmation screenshots and text;
- any employer confirmation email or portal/API acceptance evidence;
- one-time code files, which must be absent after completion.
- Gmail rejection and confirmation findings recorded in `emailEvidence`, when
  mailbox access was available.

Fix inconsistencies in evidence, not merely in summary text.

## Completion Audit

The requested target is met only when the count of unique tracker entries with
`submitted - email verified` or `submitted - portal verified` is at least the
target count.

Verified submissions must include:

- authoritative job URL;
- approved package path or explicit no-tailoring rationale;
- submitted-answer summary;
- confirmation text/number/URL/screenshot and either email, employer/ATS portal
  evidence, or provider/API acceptance evidence.

Roles in `submitted`, `submitted - pending email verification`,
`awaiting-user`, `blocked`, `needs-review`, `manual submit needed`,
`not submitted`, `not completed`, or `skipped` do not count.

Roles marked `workflowExcluded=true` must not be selected for ordinary role
discovery. They remain visible in `data/application-tracker.json` for duplicate
prevention, outcome review, and reapply decisions. Do not proactively recheck
old excluded roles. A later run may re-enter one only when normal sourcing
rediscovered it naturally as a strong current match and a quick live reapply
check records `reapplyAllowed=true`, `reapplyCheckedAt`, and
`reapplyRationale`, and verifies that the current listing is open, candidate
eligibility still passes, and the employer/ATS does not block another
application through a duplicate, cooldown, account, or application-history
restriction.

## Local-Only Contract

A clean handoff to a future local session consists of:

1. `data/application-tracker.json` saved with all touched roles current.
2. Referenced artifacts still present on disk.
3. No active CAPTCHA, OTP, or login state left unrecorded.
4. No one-time code files retained.
