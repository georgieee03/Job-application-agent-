# macOS Claude Code Setup

This guide is for cloning the handoff repo on a Mac and running the full
job-application automation with Claude Code.

## Which Claude App Mode To Use

Use the **Code** tab in Claude Desktop.

- **Use Code, Local session:** this workflow needs direct access to the cloned
  repo, local files, the integrated terminal, Playwright, Git, browser evidence,
  and visible diffs. In Claude Desktop, open `Code`, choose `Local`, then select
  the cloned `Job-application-agent-` folder.
- **Do not use Chat for the automation:** Chat is for general conversation and
  does not provide the local repo/file/terminal workflow this project needs.
- **Do not start with Cowork for this repo:** Cowork is useful for autonomous
  background tasks, but this workflow has local browser state, mailbox/portal
  authorization, final-submit safety gates, and tracker writes that are better
  handled in the Code tab where you can review changes and terminal output.
  After the repo is proven working, Cowork may be used only for bounded
  non-submission research or documentation tasks.

The first time you use Claude Desktop, confirm you have a paid Claude plan that
includes Claude Code, sign in, update the app, open the `Code` tab, and start a
`Local` session.

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

## Fresh Mac Prerequisites

Because this may be a new MacBook Air, verify these once before cloning.

### 1. Update macOS And Claude Desktop

1. Open System Settings and install any macOS updates.
2. Open Claude Desktop.
3. Use `Claude > Check for Updates`.
4. Sign in with the Claude account that has Claude Code access.
5. Open the `Code` tab. If Claude asks you to upgrade or subscribe, complete
   that before continuing.

### 2. Install Apple's Command Line Tools

Open Terminal and run:

```bash
xcode-select --install
```

If it says the tools are already installed, continue.

Verify:

```bash
git --version
python3 --version
```

### 3. Install Homebrew

If `brew --version` fails, install Homebrew:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

After installation, follow Homebrew's terminal output to add `brew` to your
shell path. On Apple Silicon Macs, that usually means adding this to
`~/.zprofile`:

```bash
eval "$(/opt/homebrew/bin/brew shellenv)"
```

Then reload your shell:

```bash
source ~/.zprofile
brew --version
```

### 4. Install Runtime Dependencies

Install the tools this repo expects:

```bash
brew install node git python
brew install --cask google-chrome
```

Verify:

```bash
node --version
npm --version
git --version
python3 --version
google-chrome --version || true
```

If the `google-chrome` command is unavailable, that is usually okay; the app
should still exist at `/Applications/Google Chrome.app`.

### 5. Set Up GitHub Access

Use either SSH or HTTPS.

Recommended SSH path:

```bash
ssh-keygen -t ed25519 -C "gjobiper@asu.edu"
eval "$(ssh-agent -s)"
ssh-add --apple-use-keychain ~/.ssh/id_ed25519
pbcopy < ~/.ssh/id_ed25519.pub
```

Then add the copied public key in GitHub under `Settings > SSH and GPG keys`.

Test:

```bash
ssh -T git@github.com
```

HTTPS is also fine if GitHub prompts you to authenticate in the browser.

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

For a new Mac, create a local-only secrets folder outside the repo, for example:

```bash
mkdir -p ~/Private/job-application-agent-secrets
```

Put copies of `.env`, any mailbox access notes, and any Google Drive-downloaded
secret files there. Copy only the needed files into the repo working directory.
Do not copy browser profile folders into git.

## macOS Browser Permissions

Claude Code and Playwright may need macOS permissions for browser automation:

1. Open System Settings.
2. Go to Privacy & Security.
3. Allow the terminal app used by Claude Code under Automation, Accessibility,
   and Full Disk Access if prompted.
4. Use a dedicated Chrome profile for automation. Do not commit the profile.

If Claude Desktop asks for filesystem access to the cloned repo, allow it. If
browser automation fails to click/type, grant permissions to Claude Desktop,
Terminal, and Google Chrome under:

- Privacy & Security > Accessibility
- Privacy & Security > Automation
- Privacy & Security > Full Disk Access, only if needed
- Privacy & Security > Screen & System Audio Recording, only if screenshots or
  screen inspection are needed

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

After setup, open Claude Desktop and:

1. Click `Code`.
2. Choose `Local`.
3. Select the cloned `Job-application-agent-` folder.
4. Select `claude-sonnet-4-6` with medium effort for setup.
5. Say:

```text
Read CLAUDE.md, AGENTS.md, MACOS_CLAUDE_CODE_SETUP.md, and LOCAL_SECRETS_MANIFEST.md. Verify this Mac workspace is ready to run the job-application workbench. Do not submit applications yet.
Use Sonnet for setup work and verification-audit-opus for the final verification/audit pass.
```

After that passes, run the actual goal:

```text
/goal apply to 10 different jobs related to robotics field, job postings that are highly relevant to my resume. Use AGENTS.md and CLAUDE.md to activate the workflow. Proceed autonomously unless a missing fact, login, OTP, CAPTCHA, or human verification is required.
Use Sonnet as the main orchestrator, Haiku for bulk discovery, Sonnet for routine screening, and Opus for every verification or audit decision.
```
