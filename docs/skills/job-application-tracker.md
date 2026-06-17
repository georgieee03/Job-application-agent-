# Skill: Job Application Tracker

Use this skill when the goal is to record, update, or summarize job applications without creating duplicates.

## Default Tracker

- `./application_tracker.md`

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
