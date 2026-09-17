# Skill: Job Application Tracker

Use this skill when the goal is to record, update, or summarize job
applications without creating duplicates.

## Default Tracker

- `data/application-tracker.json` is the single durable tracker.
- The local workbench UI reads and writes this file through
  `src/workbench-server.ts`.
- Do not create new Markdown tracker mirrors, dated batch ledgers, or
  per-application report files for new workflow state.

Generated resumes, manifests, screenshots, and validation artifacts may remain
as separate files. Store their paths and meaning on the relevant tracker entry.

## Standard Fields

Use existing UI fields when they fit:

- company
- title / role
- listing URL
- apply URL
- board or provider
- status
- applied flag and applied date
- resume notes
- resume draft
- job description override

Use workflow extension fields when needed:

- duplicate-check result
- package directory
- tailored resume path
- tailored cover letter path
- approval manifest path and hash
- submitted answers
- confirmation type/text/URL/number/screenshot
- provider/API response path
- blocker
- unresolved question
- next action

## Workflow

1. Read `data/application-tracker.json` first.
2. Check whether the role already exists by company, title, job URL, and ATS
   job ID or slug.
3. Update the existing entry instead of adding a duplicate.
4. If it does not exist, add one clean new tracker entry.
5. Keep statuses and dates consistent.
6. Record every role touched by the workbench, including failed, blocked,
   skipped, CAPTCHA/OTP-gated, duplicate, replaced, and incomplete roles.
7. If submission is uncertain, mark it as `staged`, `in progress`,
   `manual submit needed`, `not completed`, or `not submitted`.
8. Do not mark a role fully verified from a success page alone. Require a
   second signal: confirmation email, employer/ATS portal record, or
   provider/API acceptance record.
9. For every role touched, record what was done, submitted answers, files used,
   evidence captured, blocker, next action, and final status on the tracker
   entry.
10. Keep tracker maintenance local to `data/application-tracker.json` unless
    the user explicitly asks for an export.

## Preferred Status Values

- `submitted - email verified`
- `submitted - portal verified`
- `submitted - pending email verification`
- `not submitted`
- `not completed`
- `submitted`
- `staged`
- `in progress`
- `manual submit needed`
- `rejected`
- `withdrawn`
- `response received`

## Output Expectations

Return:

- whether `data/application-tracker.json` was updated
- which roles were added or changed
- any duplicates or inconsistencies fixed
- whether follow-up work is still needed
