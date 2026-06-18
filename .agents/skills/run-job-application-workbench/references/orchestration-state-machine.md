# Orchestration State Machine

## Statuses

Use one status at a time:

`discovered` -> `screened` -> `tailoring` -> `awaiting-approval` -> `approved`
-> `form-in-progress` -> `awaiting-user` -> `submitted - pending email verification`
-> `submitted - email verified` or `submitted - portal verified`

Terminal alternatives:

- `skipped`: incompatible, closed, duplicate, CAPTCHA skipped, or user declined.
- `not submitted`: the role was touched but no submission was transmitted.
- `not completed`: the application could not be completed and should be left
  for manual/DIY follow-up.
- `manual submit needed`: a prepared or partially completed application needs
  user action outside the automation.
- `blocked`: external or technical condition prevents progress.
- `needs-review`: submission was attempted but no authoritative confirmation
  was captured.

## Required Transition Evidence

| Transition | Required evidence |
| --- | --- |
| discovered -> screened | Authoritative job URL, full description, US location, eligibility and fit notes |
| screened -> tailoring | Role selected and no hard blocker |
| tailoring -> awaiting-approval | Resume PDF, validation report, ATS heuristic, rendered preview, manifest |
| awaiting-approval -> approved | User approval timestamp and manifest hash binding |
| approved -> form-in-progress | Pre-upload hash verification passed |
| form-in-progress -> awaiting-user | Exact question, challenge, or missing answer plus retained browser handoff |
| form-in-progress -> submitted - pending email verification | Immediate provider success text, confirmation URL/number, screenshot, or provider/API response |
| submitted - pending email verification -> submitted - email verified | Matching confirmation email captured and recorded |
| submitted - pending email verification -> submitted - portal verified | Employer/ATS portal or provider/API acceptance evidence captured and recorded |
| any active state -> not submitted/not completed/manual submit needed | Job URL, blocker, next action, and DIY tracker row when incomplete |

For every role touched, write or update `data/application-reports/<role-id>.md`
with the process steps, non-secret submitted answers, artifacts used, evidence,
blocker, next action, and final status.

## Resume Rules

- Resume tailoring never creates eligibility.
- Preserve every verified education, experience, project, date, metric, and
  substantive skill. Reorder or rephrase for emphasis.
- Never guarantee an employer-side ATS score. Record the 89-95 score as a local
  keyword-alignment heuristic.
- Do not tailor against an aggregator excerpt when the employer listing is
  available.

## Resume Across Sessions

At the start of a new session:

1. Read the entire `application-workbench.md`.
2. Confirm the JSON mirror has the same `updated_at`.
3. Inspect only artifacts referenced by the active role's `Next action`.
4. Re-open or claim the recorded browser handoff only after verifying the URL,
   employer, role, account, and form step.
5. Treat stale OTPs, stale form previews, and unconfirmed submit attempts as
   invalid.
6. Pull/rebase `main` before role discovery and read the synced trackers and
   `data/application-reports/*.md` before opening a new posting.

## Batch Completion

The requested target is met only when the count of unique
`submitted - email verified` or `submitted - portal verified` roles is at least
the target count. Roles in `submitted`, `submitted - pending email
verification`, `awaiting-user`, `blocked`, `needs-review`, `manual submit
needed`, `not submitted`, `not completed`, or `skipped` do not count.

Before completion or device handoff, push a tracker-only commit containing the
updated trackers, active ledger, and application reports.
