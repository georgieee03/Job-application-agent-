# macOS Claude Code Setup

This guide is for cloning the handoff repo on a Mac and running the full
job-application automation with Claude Code.

## Recommended Claude Model For Setup

Use Claude Code with:

- Main setup model: `claude-opus-4-8`
- Effort: `xhigh`

Setup touches local paths, Playwright, tracker migration, browser permissions,
mailbox access, and artifact validation. That is high-leverage work, so use the
most reliable model first.

## Recommended Claude Model For Application Goals

For a new goal such as:

```text
apply to 10 different jobs related to robotics field, job postings highly relevant to my resume
```

use:

- Main orchestrator model: `claude-opus-4-8`
- Effort: `high`

The main Opus session should own final browser submission, email verification,
ledger updates, and cleanup. It should delegate discovery and screening to
Haiku/Sonnet subagents according to `CLAUDE.md`.

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

## First Claude Code Prompt On Mac

After setup, start Claude Code in the repo and say:

```text
Read CLAUDE.md, AGENTS.md, MACOS_CLAUDE_CODE_SETUP.md, and LOCAL_SECRETS_MANIFEST.md. Verify this Mac workspace is ready to run the job-application workbench. Do not submit applications yet.
```

After that passes, run the actual goal:

```text
/goal apply to 10 different jobs related to robotics field, job postings that are highly relevant to my resume. Use AGENTS.md and CLAUDE.md to activate the workflow. Proceed autonomously unless a missing fact, login, OTP, CAPTCHA, or human verification is required.
```
