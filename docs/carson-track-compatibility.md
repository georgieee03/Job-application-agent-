# Carson-Track Compatibility Notes

This repository state captures the job-application workflow used in Codex:
workbench tracking, role discovery, resume/package preparation, browser
submission guardrails, CAPTCHA/UI-friction handling, and verified-submission
ledger rules.

Use this file as the checklist when adapting or merging the workflow into a
`carson-track` branch.

## Preserve These Workflow Contracts

- `AGENTS.md` is the top-level automation contract.
- `.agents/skills/` contains the Codex workflow skills:
  - `run-job-application-workbench`
  - `verify-job-application-state`
  - `tailor-job-resume`
  - `tailor-job-cover-letter`
  - `submit-job-application`
- `docs/skills/ui-latency-normalization.md` and the matching AGENTS section
  define CAPTCHA, Cloudflare, Turnstile, consent overlay, login interstitial,
  and flaky UI normalization.
- `data/application-tracker.json` is the real workbench tracker at runtime.
  It is intentionally synced through git for duplicate prevention across
  devices.
- `application_tracker.md`, `DYI applications.md`,
  `data/application-reports/*.md`, and active
  `data/<run-name>/application-workbench.*` files are also synced state.
  Keep their schemas compatible so another workspace can resume without
  reapplying to roles already attempted elsewhere.

## Required Tracker Compatibility

The workbench server and UI now support these application statuses:

- `submitted - email verified`
- `submitted - portal verified`
- `submitted - pending email verification`
- `submitted`
- `not submitted`
- `not completed`
- `manual submit needed`
- `rejected`
- `interview`
- `accepted`

When porting to `carson-track`, keep the status list synchronized across:

- `src/workbench-server.ts`
- `ui/app.js`
- `templates/application_tracker.template.md`
- `docs/skills/job-application-tracker.md`

Do not count an application as complete from a success page alone. A counted
submission needs immediate provider evidence plus email, portal, or provider/API
acceptance evidence.

## Required Automation Compatibility

- Keep the master workflow entry point in
  `.agents/skills/run-job-application-workbench/SKILL.md`.
- Keep role-specific package generation separate from live submission.
- Keep live final-submit clicks, OTP/CAPTCHA handoffs, mailbox access, and
  authoritative tracker/ledger writes owned by the main agent.
- Keep every blocked, CAPTCHA/OTP-gated, duplicate, replaced, not-completed, or
  not-submitted role recorded with its job URL.
- Keep email/portal verification as a second-stage check before marking a role
  fully verified.
- Keep one report per role in `data/application-reports/`, including process
  steps, submitted answers, artifacts used, evidence, blockers, and final
  status.
- Pull/rebase `main` before role discovery and push tracker/report-only commits
  after material updates or before switching devices.

## Files To Keep Out Of Git

Do not commit:

- `.env` or `.env.*`
- `data/` runtime screenshots, packages, OTP/security-code files, raw logs, and
  browser/session artifacts
- `application-profile.json`
- `job-sources.json`
- Chrome profiles such as `.chrome-*`
- Playwright auth state
- `node_modules`, Python virtualenvs, caches, and workbench logs

The tracker/report files above may contain personal application answers. Keep
the repository private or add a redaction layer before publishing them.

## Suggested Merge Order

1. Merge tracker status and UI changes first.
2. Merge `.agents/skills/` workflow contracts.
3. Merge submit/tailoring helper scripts needed by those skills.
4. Merge tracker/report sync ignore rules and per-application report handling.
5. Run `npm run check` and the focused workbench tests.
6. Restore local-only data from private storage and verify that
   `data/application-tracker.json` is still readable by the workbench.
