# Workbench Tracker Schema

The single durable tracking file is `data/application-tracker.json`. It is read
and written by the workbench UI through `src/workbench-server.ts`.

## Existing UI Fields

The UI already normalizes these fields:

- `id`
- `provider`
- `title`
- `company`
- `location`
- `employmentType`
- `listingUrl`
- `applyUrl`
- `description`
- `score`
- `sourceRunAt`
- `firstVisitedAt`
- `lastVisitedAt`
- `visitCount`
- `openCount`
- `applyClickCount`
- `lastAction`
- `applied`
- `appliedAt`
- `status`
- `statusUpdatedAt`
- `resumeNotes`
- `resumeDraft`
- `jobDescriptionOverride`
- `resumeUpdatedAt`

## Workflow Extension Fields

Workflow agents may preserve additional JSON fields on tracker entries for
application evidence and continuation state. Prefer these names:

- `role_id`
- `duplicate_check`
- `fit_notes`
- `eligibility_notes`
- `package_dir`
- `resume_path`
- `cover_letter_path`
- `ats_score`
- `approval_manifest`
- `approval_manifest_sha256`
- `approval_status`
- `approved_at`
- `approval_evidence`
- `submitted_answers`
- `confirmation_type`
- `confirmation_text`
- `confirmation_url`
- `confirmation_number`
- `confirmation_screenshot`
- `provider_response_path`
- `submitted_at`
- `browser_surface`
- `browser_url`
- `browser_account`
- `browser_step`
- `blocker`
- `unresolved_question`
- `next_action`
- `cleanup_notes`
- `email_evidence` or `emailEvidence`
- `email_last_checked_at` or `emailLastCheckedAt`
- `workflow_excluded` or `workflowExcluded`
- `workflow_excluded_reason` or `workflowExcludedReason`
- `reapply_allowed` or `reapplyAllowed`
- `reapply_checked_at` or `reapplyCheckedAt`
- `reapply_rationale` or `reapplyRationale`
- `reapply_restriction` or `reapplyRestriction`
- `incomplete_archive_root` or `incompleteArchiveRoot`

Unknown values are blank or absent, not guessed. Do not store passwords,
cookies, CAPTCHA answers, one-time codes, raw session data, or private auth
state.

## Status Contract

Allowed workflow statuses:

- `discovered`
- `screened`
- `tailoring`
- `awaiting-approval`
- `approved`
- `form-in-progress`
- `awaiting-user`
- `submitted`
- `submitted - email verified`
- `submitted - portal verified`
- `submitted - pending email verification`
- `not submitted`
- `not completed`
- `manual submit needed`
- `rejected`
- `interview`
- `accepted`
- `needs-review`
- `blocked`
- `skipped`

The current workbench UI accepts the subset it exposes directly. If a new
status needs to be editable in the UI, add it to `TRACKER_STATUSES` in
`src/workbench-server.ts` and the matching UI controls.

Legacy statuses must be normalized before discovery:

- `ready-to-submit` -> `approved`
- `submitted-pending-verification` -> `submitted - pending email verification`
- `submitted - pending email/portal verification` -> `submitted - pending email verification`
- `blocked - replaced` -> `skipped`

Any submitted status requires at least one of confirmation text, number, URL,
screenshot, confirmation type, provider/API response path, or recorded employer
email. A generic application URL alone is insufficient.

Only `submitted - email verified` and `submitted - portal verified` count
toward a requested application target.

## Handoff Contract

Another local session must be able to answer from `data/application-tracker.json`:

1. What roles are active, done, blocked, skipped, or waiting on the user?
2. Which exact artifacts were approved and do their hashes still match?
3. What user questions remain unresolved?
4. Which browser/account/form step is retained?
5. What exact action should happen next?

Entries with `workflowExcluded=true` remain visible and part of duplicate
prevention but must be ignored during ordinary role discovery and submission.
They are not permanent "never apply" records. A workflow may reopen one only
when normal sourcing rediscovered it naturally as a strong current match and a
fast live check records `reapplyAllowed=true`, `reapplyCheckedAt`, and
`reapplyRationale`, and proves the current listing is open, candidate
eligibility still passes, and no employer, ATS, duplicate, cooldown, account,
or application-history restriction blocks another application. Do not
proactively scan old excluded roles just to look for reapply opportunities. If
a restriction is visible or the check would require a time-consuming login
reset, CAPTCHA-only loop, unclear cooldown interpretation, or unresolved
account state, keep the entry excluded, set `reapplyAllowed=false`, record
`reapplyRestriction`, and move on.

Do not rely on dated batch ledgers, Markdown mirrors, or per-application report
files for this handoff.
