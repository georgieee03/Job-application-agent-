# Claude Code Operating Instructions

This repository is a portable job-application automation workspace for George
Jobi Perangattu. Claude Code should use this file as the primary project
instruction layer, with `AGENTS.md` as the detailed workflow contract.

## Required Claude Surface

Run this project from the **Code** tab in Claude Desktop as a **Local** session
pointed at the cloned repository folder.

- Do not run the automation from Chat; Chat is for conversation and lacks the
  local repo/terminal/diff workflow this project requires.
- Do not use Cowork as the first setup or live-application surface. Cowork may
  be used later only for bounded non-submission research or documentation tasks.
- The Code tab is required for local files, integrated terminal commands,
  Playwright setup, tracker edits, visible diffs, and safe final-submit
  supervision.

## Primary Goal Mode

When George prompts a goal like:

> apply to 10 jobs preferably related to robotics, use AGENTS.md to activate workflow

Claude Code must activate the job-application workbench workflow immediately.
The requested number means verified applications, not attempts.

Use these files first:

1. `AGENTS.md`
2. `data/candidate-application-answers.md`
3. `data/application-tracker.json`
4. `.agents/skills/run-job-application-workbench/SKILL.md`
5. `.agents/skills/verify-job-application-state/SKILL.md`
6. `.agents/skills/tailor-job-resume/SKILL.md`
7. `.agents/skills/submit-job-application/SKILL.md`
8. `docs/skills/ui-latency-normalization.md`

## Automation Contract

- Proceed autonomously using confirmed facts already recorded in
  `data/candidate-application-answers.md`.
- Ask George only for missing application-specific facts, ambiguous legal or
  immigration answers, login, OTP/security code, CAPTCHA/human verification, or
  mailbox/portal authorization.
- Use `data/application-tracker.json` as the real workbench tracker and
  duplicate-prevention source of truth.
- Record every touched role in the tracker, including failed, blocked,
  CAPTCHA/OTP-gated, duplicate, replaced, not-completed, and not-submitted
  roles.
- Copy incomplete Codex/Claude attempts into `DYI applications.md`.
- Do not mark a role fully verified from a success page alone. A verified
  submission requires immediate provider evidence plus confirmation email,
  employer/ATS portal evidence, or provider/API acceptance evidence.
- If only the success page is available, mark the tracker status as
  `submitted - pending email verification`.

## Live Submission Ownership

The main Claude session owns all final external side effects:

- final browser submit clicks;
- email/OTP access;
- CAPTCHA/human-verification handoffs;
- authoritative ledger and tracker writes;
- final audit and cleanup.

Subagents may research, screen, extract requirements, review packages, or audit
evidence. Any verification or audit judgment must use Opus through
`verification-audit-opus` or `job-risk-opus`. Subagents must not submit
applications, solve CAPTCHA, access OTPs, or alter the authoritative
tracker/ledger.

## Claude Model Routing

Use Claude Code subagents from `.claude/agents/` when work can run in parallel.
Choose the lowest-capability model and effort that are reliable for the task:

| Intensity | Agent | Model | Effort | Use For |
| --- | --- | --- | --- | --- |
| Low | `job-discovery-haiku` | `claude-haiku-4-5` | `low` | finding roles, freshness checks, duplicate checks, extracting simple fields |
| Medium | `job-screening-sonnet` | `claude-sonnet-4-6` | `medium` | eligibility screening, ATS keyword gaps, package review, application-question mapping |
| Verification/Audit | `verification-audit-opus` | `claude-opus-4-8` | `high` | confirmation email/portal evidence, provider acceptance evidence, tracker/ledger reconciliation, package-manifest verification review, final batch audit |
| High Risk | `job-risk-opus` | `claude-opus-4-8` | `xhigh` | sponsorship/export ambiguity, high-risk answers, novel ATS flows, contradictory evidence, disputed final audit |

Route every verification or audit decision to `verification-audit-opus`, even
when the main session is Sonnet. Deterministic commands may calculate hashes,
run tests, search mail metadata, or inspect files, but the judgment that marks
evidence verified, audit-passed, or countable must be Opus.

Escalate from `verification-audit-opus` to `job-risk-opus` when evidence is
contradictory, legally sensitive, immigration-related, export-control-related,
or when a risk could lead to a false submission claim. Use Opus xhigh for final
batch audits when the evidence is disputed or the batch has shown
contradictions.

## Recommended Main Session Models

Use the token-efficient default first and escalate only when the evidence or
risk demands it.

- Initial Mac setup: start Claude Code with `claude-sonnet-4-6` at `medium`
  effort. This is accurate enough for dependency setup, path fixes, tracker
  checks, and local setup while avoiding an Opus burn. Use
  `verification-audit-opus` for the final setup verification/audit pass.
- Routine application goal: start with `claude-sonnet-4-6` at `medium` effort
  for the main orchestrator. Keep live submission and tracker ownership in the
  main session, but delegate discovery to Haiku and screening/review to Sonnet
  subagents. Route every verification/audit gate to Opus.
- Discovery-only or tracker-inventory work: `claude-haiku-4-5` at `low` effort
  is acceptable when there will be no live submission, legal answer, mailbox
  access, verification decision, audit decision, or authoritative tracker write.
- Opus escalation: switch to `claude-opus-4-8` at `high` effort only for
  verification/audit judgments, ambiguous sponsorship/export-control language,
  novel ATS behavior, repeated automation failures, or conflicting evidence.
  Use `xhigh` only for final forensic audits, high-stakes disputed answers, or
  a batch that has already shown contradictions.
- Do not use Opus fast mode for this workflow unless latency matters more than
  cost. Fast mode is not the token-efficient option.

When Claude Code supports an advisor/escalation workflow, prefer a Sonnet main
session with an Opus advisor or `job-risk-opus` subagent over running the whole
batch on Opus.

## Safety Boundaries

Do not commit or publish:

- `.env` or `.env.*`;
- OAuth tokens, mailbox credentials, app passwords, cookies, Chrome profiles,
  Playwright auth state, or exported browser profiles;
- OTP/security-code contents;
- raw session logs containing secrets.

Use `LOCAL_SECRETS_MANIFEST.md` as a checklist for local setup on the Mac.
