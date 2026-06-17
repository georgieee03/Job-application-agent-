# macOS Claude Code Setup

This guide is for cloning the handoff repo on a Mac and running the full
job-application automation with Claude Code.

## Recommended Claude Model For Setup

Use Claude Code with:

- Main setup model: `claude-sonnet-4-6`
- Effort: `medium`

Setup mostly touches local paths, package installs, Playwright, tracker checks,
browser permissions, and local-secret restoration. Sonnet 4.6 at medium effort
is the cost-aware default. Escalate to `claude-opus-4-8` at `high` only if setup
hits ambiguous migration conflicts, repeated dependency failures, or evidence
reconciliation that Sonnet cannot resolve. The final setup verification/audit
pass must use `verification-audit-opus`.

## Recommended Claude Model For Application Goals

For a new goal such as:

```text
apply to 10 different jobs related to robotics field, job postings highly relevant to my resume
```

use:

- Main orchestrator model: `claude-sonnet-4-6`
- Effort: `medium`

The main Sonnet session should own final browser submission, email
authorization, ledger updates, tracker writes, and cleanup. It should delegate
bulk discovery to Haiku and routine screening to Sonnet subagents according to
`CLAUDE.md`. Every verification or audit decision must use Opus 4.8 through
`verification-audit-opus` or `job-risk-opus`.

- Use `verification-audit-opus` at `high` effort for confirmation email/portal
  evidence, provider/API acceptance evidence, tracker/ledger reconciliation,
  package-manifest verification review, and ordinary final batch audit.
- Use `job-risk-opus` at `xhigh` effort for ambiguous
  sponsorship/export-control language, novel ATS behavior, repeated automation
  failures, high-stakes disputed answers, contradictory evidence, or a batch
  that has already shown contradictions.

Do not enable Opus fast mode for this workflow when token/cost efficiency is
the priority.

## Clone And Install

```bash
git clone git@github.com:georgieee03/Job-application-agent-.git
cd Job-application-agent-
npm install
npx playwright install chromium
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

If you use HTTPS instead of SSH:

```bash
git clone https://github.com/georgieee03/Job-application-agent-.git
```

## Restore Local Secrets

Do not commit secrets. Restore them locally from your private storage using
`LOCAL_SECRETS_MANIFEST.md` as the checklist.

At minimum, create:

```bash
cp .env.example .env
cp application-profile.example.json application-profile.json
cp job-sources.example.json job-sources.json
```

Then fill in API keys, alert webhooks, and any mailbox/portal access method you
intend Claude Code to use.

## macOS Browser Permissions

Claude Code and Playwright may need macOS permissions for browser automation:

1. Open System Settings.
2. Go to Privacy & Security.
3. Allow the terminal app used by Claude Code under Automation, Accessibility,
   and Full Disk Access if prompted.
4. Use a dedicated Chrome profile for automation. Do not commit the profile.

## Start The Workbench

```bash
npm run ui
```

Default URL:

```text
http://localhost:4321/
```

The real UI tracker is:

```text
data/application-tracker.json
```

The applied-jobs export is:

```text
data/applied-jobs.xls
```

## Verify The Migrated State

Run:

```bash
npm run check
python .agents/skills/verify-job-application-state/scripts/application_ledger.py audit --run-dir data/june-2026-next-5
```

Then have Claude Code route the interpretation of those results through
`verification-audit-opus`. Commands can produce the raw evidence, but Opus must
make the final ready/not-ready verification call.

Check:

- `data/application-tracker.json` exists and includes prior manual/dashboard
  rows plus Codex-applied rows.
- `DYI applications.md` exists and contains not-submitted/manual-follow-up
  roles.
- Previous application artifacts under `data/` are present.

## Email Verification Setup

The automation can only mark `submitted - email verified` if Claude Code has
authorized access to the relevant mailbox or portal.

Use a dedicated, revocable method:

- Gmail app password for a dedicated mailbox, or
- OAuth credentials scoped to read confirmation emails, or
- manual browser access where George logs in and Claude only searches within
  the authorized mailbox/session.

Do not store OTP values. Do not commit mailbox credentials. Record only:

- employer;
- role;
- email sender/domain;
- email timestamp;
- confirmation subject/snippet;
- evidence screenshot or exported message metadata.

The email or portal confirmation review must use `verification-audit-opus`.
Sonnet or Haiku may not mark a role `submitted - email verified`,
`submitted - portal verified`, or count the role toward a verified target.

## First Claude Code Prompt On Mac

After setup, start Claude Code in the repo and say:

```text
Read CLAUDE.md, AGENTS.md, MACOS_CLAUDE_CODE_SETUP.md, and LOCAL_SECRETS_MANIFEST.md. Verify this Mac workspace is ready to run the job-application workbench. Do not submit applications yet.
Use Sonnet for setup work and verification-audit-opus for the final verification/audit pass.
```

After that passes, run the actual goal:

```text
/goal apply to 10 different jobs related to robotics field, job postings that are highly relevant to my resume. Use AGENTS.md and CLAUDE.md to activate the workflow. Proceed autonomously unless a missing fact, login, OTP, CAPTCHA, or human verification is required.
Use Sonnet as the main orchestrator, Haiku for bulk discovery, Sonnet for routine screening, and Opus for every verification or audit decision.
```
