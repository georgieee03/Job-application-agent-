# Ledger Schema

## Run Fields

- `objective`
- `target_count`
- `created_at`
- `updated_at`
- `workspace`
- `candidate_answers`
- `workbench_url`
- `next_action`
- runtime ownership: `workbench_started_by_batch`, `workbench_pid`,
  `background_processes`, `created_browser_tabs`, `created_subagents`
- cleanup: `cleanup_status`, `cleanup_actions`, `retained_handoffs`

## Application Fields

- identity: `role_id`, `company`, `role`, `job_url`, `location`, `provider`
- screening: `visa_compatible`, `fit_notes`, `eligibility_notes`
- package: `package_dir`, `resume_path`, `cover_letter_path`,
  `ats_score`, `approval_manifest`, `approval_manifest_sha256`
- approval: `approval_status`, `approved_at`, `approval_evidence`
- browser: `browser_surface`, `browser_url`, `browser_account`, `browser_step`
- execution: `status`, `attempted_at`, `blocker`, `next_action`
- confirmation: `confirmation_type`, `confirmation_text`,
  `confirmation_url`, `confirmation_number`, `confirmation_screenshot`,
  `submitted_at`

Unknown values are blank, not guessed.

## Status Contract

Allowed statuses:

- `discovered`
- `screened`
- `tailoring`
- `awaiting-approval`
- `approved`
- `form-in-progress`
- `awaiting-user`
- `submitted`
- `needs-review`
- `blocked`
- `skipped`

`submitted` requires at least one of confirmation text, number, URL, screenshot,
or recorded employer email. A generic application URL alone is insufficient.

## Handoff Contract

Another session must be able to answer:

1. What is the batch objective and current verified count?
2. Which exact roles are active, done, blocked, or skipped?
3. Which exact artifacts were approved and do their hashes still match?
4. What user questions remain unresolved?
5. Which browser/account/form step is retained?
6. What exact action should happen next?
