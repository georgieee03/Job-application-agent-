---
name: verify-job-application-state
description: Create, update, render, reconcile, and audit the durable state of a job-application run. Use when Codex must initialize or resume a batch, record role status and evidence, preserve approvals and browser handoffs, list unresolved questions, verify manifest hashes and submission confirmations, produce a complete application-workbench.md for another session, or decide whether the requested submitted-application target is actually complete.
---

# Verify Job Application State

Keep the whole run understandable without chat history. The Markdown panel is
the handoff; the JSON mirror enables deterministic updates and audits.

## Files

For each run directory maintain:

- `application-workbench.md`: complete human-readable state and next actions.
- `application-workbench.json`: machine-readable mirror.

Read [references/ledger-schema.md](references/ledger-schema.md) before adding
new fields or statuses.

## Commands

Initialize:

```powershell
python .agents\skills\verify-job-application-state\scripts\application_ledger.py init `
  --run-dir "data\<run-name>" `
  --objective "<objective>" `
  --target-count 10
```

Add or update a role:

```powershell
python .agents\skills\verify-job-application-state\scripts\application_ledger.py upsert `
  --run-dir "data\<run-name>" `
  --role-id "<stable-slug>" `
  --company "<company>" `
  --role "<role>" `
  --job-url "<authoritative URL>" `
  --set "status=screened" `
  --set "next_action=Tailor resume"
```

Add an event or unresolved question:

```powershell
python .agents\skills\verify-job-application-state\scripts\application_ledger.py event `
  --run-dir "data\<run-name>" --role-id "<stable-slug>" --message "<event>"

python .agents\skills\verify-job-application-state\scripts\application_ledger.py question `
  --run-dir "data\<run-name>" --role-id "<stable-slug>" `
  --question "<exact question>" --answer "<answer or blank>"
```

Update run-level handoff fields:

```powershell
python .agents\skills\verify-job-application-state\scripts\application_ledger.py set-run `
  --run-dir "data\<run-name>" `
  --set "next_action=Continue the first awaiting-user role"
```

Audit and re-render:

```powershell
python .agents\skills\verify-job-application-state\scripts\application_ledger.py audit `
  --run-dir "data\<run-name>"
```

## Update Rules

1. Update after every status transition, approval, blocker, user answer,
   browser handoff, submission attempt, and confirmation.
2. Store paths relative to the workspace when practical.
3. Do not store passwords, cookies, CAPTCHA answers, or one-time codes.
4. Bind approval to `approval_manifest` and `approval_manifest_sha256`.
5. Mark `submitted` only with non-empty authoritative confirmation evidence.
6. Put the exact continuation instruction in `next_action`.
7. Use the browser handoff fields for an unfinished live tab:
   `browser_surface`, `browser_url`, `browser_account`, `browser_step`.
8. Run `audit` before declaring the batch complete or handing it to another
   session.

## Reconcile

Compare the ledger against:

- each role's `approval-manifest.json`;
- validation reports and ATS heuristic;
- submission result JSON;
- confirmation screenshots and text;
- `data/application-tracker.json`;
- any employer confirmation email;
- one-time code files, which must be absent after completion.

Fix inconsistencies in evidence, not merely in the summary text.
