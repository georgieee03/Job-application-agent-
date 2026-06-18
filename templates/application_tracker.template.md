# Application Tracker

Updated: YYYY-MM-DD

Use this file as the source of truth for duplicate prevention.
Keep it synchronized with `data/application-tracker.json`,
`DYI applications.md`, `data/application-reports/*.md`, and the active
`data/<run-name>/application-workbench.*` files before switching devices.

## Summary Table

| Date | Company | Role | Status | Submission Mode | Board | Resume | Cover Letter | Job URL |
|---|---|---|---|---|---|---|---|---|
| 2026-03-30 | Example Co | Forward Deployed Engineer | staged | Browser | Ashby | `./resumes/example-company/resume.pdf` | `./resumes/example-company/cover_letter.txt` | `https://jobs.example.com/role/123` |

## Notes

- 2026-03-30: Example Co, Forward Deployed Engineer. Duplicate check: company/title/url clear. Resume used: `./resumes/example-company/resume.pdf`. Submission path: browser. Status: staged. Next step: final review and submit.

## Status Conventions

- `submitted - email verified`
- `submitted - portal verified`
- `submitted - pending email verification`
- `not submitted`
- `not completed`
- `staged`
- `in progress`
- `submitted`
- `manual submit needed`
- `rejected`
- `withdrawn`
- `response received`

## Update Rules

- Search by company, exact role title, and job URL or ID before applying.
- Update an existing row instead of creating a duplicate when the role is already tracked.
- Record every role touched by the workbench, including failed, blocked, skipped, CAPTCHA/OTP-gated, duplicate, and replaced roles.
- If CAPTCHA, human verification, login, OTP, security code, or site instability prevents completion, mark the role `not submitted` or `not completed` and include the live job posting URL.
- For future verification, do not treat a success page alone as final verification. Pair it with confirmation email evidence or employer/ATS portal/API evidence before marking it `submitted - email verified` or `submitted - portal verified`.
- Copy incomplete Codex attempts into `DYI applications.md` using the same table format.
- Create or update `data/application-reports/<role-id>.md` for every role
  touched. Include what was done, submitted answers, files used, evidence,
  blocker, next action, and final status.
- Pull/rebase `main` before sourcing new roles, then push tracker/report
  updates to GitHub after clean checkpoints so another workspace sees them.
- Add a short factual note for each material change.
- Do not store secrets, cookies, tokens, or raw session data here.
