# Orchestration State Machine

## Statuses

Use one status at a time:

`discovered` -> `screened` -> `tailoring` -> `awaiting-approval` -> `approved`
-> `form-in-progress` -> `awaiting-user` -> `submitted`

Terminal alternatives:

- `skipped`: incompatible, closed, duplicate, CAPTCHA skipped, or user declined.
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
| form-in-progress -> submitted | Success text, confirmation number, confirmation URL, screenshot, or employer email |

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

## Batch Completion

The requested target is met only when the count of unique `submitted` roles
with authoritative evidence is at least the target count. Roles in
`awaiting-user`, `blocked`, `needs-review`, or `skipped` do not count.

