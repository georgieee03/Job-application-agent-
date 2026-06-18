# Skill: Job Application Tracker

Use this skill when the goal is to record, update, or summarize job applications without creating duplicates.

## Default Tracker

- `data/application-tracker.json` for the workbench UI and duplicate prevention.
- `./application_tracker.md` as the Markdown tracker mirror when present.
- `./DYI applications.md` for incomplete or failed Codex attempts.
- `data/application-reports/<role-id>.md` for one per-application process report.

## Standard Fields

- date
- company
- role
- job link
- board or platform
- status
- submission method
- tailored resume path
- tailored cover letter path
- notes

## Workflow

1. Read the tracker first.
2. Check whether the role already exists.
3. Update the existing entry instead of adding a duplicate.
4. If it does not exist, add one clean new row.
5. Keep statuses and dates consistent.
6. Record every role touched by the workbench, including failed, blocked,
   skipped, CAPTCHA/OTP-gated, duplicate, replaced, and incomplete roles.
7. If submission is uncertain, mark it as `staged`, `in progress`,
   `manual submit needed`, `not completed`, or `not submitted`.
8. Copy incomplete Codex attempts into `DYI applications.md` using the same
   table format.
9. Do not mark a role fully verified from a success page alone. Require a
   second signal: confirmation email, employer/ATS portal record, or provider/API
   acceptance record.
10. For every role touched, update or create its per-application report with:
    what was done, submitted answers, files used, evidence captured, blocker,
    next action, and final status.
11. Before sourcing or submitting, pull/rebase `main` and read all synced
    trackers/reports so duplicate prevention includes other devices.
12. After material tracker/report changes, push a tracker-only commit to
    GitHub. Stage only tracker/report artifacts, not unrelated code, packages,
    screenshots, browser profiles, or secrets.

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

- whether the tracker was updated
- which roles were added or changed
- any duplicates or inconsistencies fixed
- whether follow-up work is still needed
- whether tracker/report changes were committed and pushed
