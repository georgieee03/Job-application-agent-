---
name: run-job-application-workbench
description: Orchestrate or resume a verified end-to-end job-application run for George Jobi Perangattu, from US role discovery and visa/fit screening through truthful resume tailoring, optional cover-letter creation, exact-file approval, Playwright form submission, CAPTCHA or OTP handoff, confirmation capture, and updates to the single workbench tracker. Automatically use this skill for plain-language requests such as "apply to 10 jobs," "your goal is to apply to 10 different jobs," "send out 5 applications," or "continue until 20 jobs are submitted," even when the user does not name any skill. Also use when Codex must continue an interrupted run, coordinate application sub-skills, or hand the workflow to another session without losing local tracker context.
---

# Run Job Application Workbench

Run the application pipeline as a resumable state machine. The source of truth
is `data/application-tracker.json`, because that is the file read and written
by the local workbench UI. Do not create dated batch ledgers such as
legacy run-specific sidecar files for new work.

Generated resumes, manifests, screenshots, and validation artifacts may still
live as separate files. Their paths, statuses, blockers, submitted-answer
summaries, confirmation evidence, and next actions must be recorded on the
corresponding tracker entries in `data/application-tracker.json`.

## Single-Command Mode

When the user gives only a target such as `apply to 10 different jobs`:

1. Extract the number as the required count of unique, authoritatively
   confirmed submissions.
2. Do not create a new run name, run directory, or batch ledger.
3. Treat the command as standing authorization to source, tailor, validate,
   upload, and submit any package that passes every deterministic workflow
   gate. Record that authorization on the tracker entries for touched roles.
4. Use all preferences and confirmed answers already stored in
   `data/candidate-application-answers.md`. Do not ask setup questions already
   answered there.
5. Keep replacing closed, incompatible, duplicate, CAPTCHA-skipped, blocked,
   restricted-reapply, or unconfirmed roles until the confirmed-submission
   target is met.
6. Ask the user only for an application-specific fact absent from durable
   answers, an ambiguous legal or immigration answer, a required login or
   one-time code, or human verification.
7. Before asking, save the exact question, browser handoff, blocker, and next
   action on the role's tracker entry. Resume from that point after the answer
   without restarting the run.
8. Before sourcing roles, read `data/application-tracker.json`; it is the only
   duplicate-prevention source for this workflow.
9. Keep job tracking and handoff local to `data/application-tracker.json`.
10. During role discovery, record provider coverage on candidate tracker
    entries or a local note field before selecting roles: configured sources,
    completed sources, fetched listings, zero-result sources, and errors.
11. Run tracker hygiene before discovery: audit the tracker, reconcile
    Gmail rejection/confirmation findings when the Gmail connector is
    available, and exclude incomplete, rejected, blocked, skipped, and pending
    roles from ordinary candidate selection. Do not proactively revisit old
    excluded roles. If one is rediscovered naturally as a strong current match,
    run a fast reapply-eligibility check and continue only when it proves there
    is no employer, ATS, duplicate, cooldown, or account restriction.

Do not ask the user to select jobs, name a batch, invoke sub-skills, start the
workbench, or approve routine implementation choices. Browser/plugin safety
requirements still apply when they require action-time confirmation.

## Delegate By Intensity

For multi-role runs, use subagents to parallelize independent work when
subagent tools are available. Keep live browser submission and final tracker
ownership with the main agent.

Assign the lowest model tier that safely fits the task:

| Intensity | Preferred model | Suitable work |
| --- | --- | --- |
| Low | `gpt-5.4-mini` | Discover roles, verify freshness, extract requirements, find duplicates, inventory evidence |
| Medium | `gpt-5.4` | Screen eligibility, analyze ATS gaps, review tailoring, map form questions, validate packages |
| High | `gpt-5.5` | Resolve conflicting evidence, analyze novel/high-risk forms, interpret ambiguous legal or sponsorship wording, conduct final forensic audit |

Subagents may research, analyze, draft, render, or verify. They must not change
`data/application-tracker.json`, submit an application, click a final submit
control, access OTPs, solve CAPTCHAs, or invent candidate facts. The main
agent verifies and integrates their output, updates the tracker, and owns all
external side effects.

## Start Or Resume

1. Read `data/candidate-application-answers.md`.
2. Read `data/application-tracker.json`.
3. Run `python scripts/audit_application_tracker.py --fix` before opening new
   roles. Treat entries with `workflowExcluded=true` as duplicate-prevention
   records, not active candidates. Do not proactively recheck them. Re-enter
   one only when it is rediscovered naturally as a strong current match and a
   quick live check records `reapplyAllowed=true`, shows the current listing is
   open, confirms the candidate still passes eligibility, and finds no
   employer/ATS block against another application.
4. When the Gmail connector is available, perform a read-only mailbox
   reconciliation across all available mailbox history for application
   confirmations, rejections, interviews,
   and follow-ups. Store only non-secret email metadata and snippets required
   for evidence in the tracker; never store raw mailbox exports, passwords,
   cookies, OTPs, or private auth state.
5. Read [references/orchestration-state-machine.md](references/orchestration-state-machine.md).
6. Read [references/role-selection-and-eligibility.md](references/role-selection-and-eligibility.md)
   while sourcing or screening roles.
7. Continue from the tracker entry's recorded status, blocker, and next action.
   Do not reconstruct state from chat memory alone.
8. If no tracker entry exists for a role, create or update one through the
   workbench tracker path before tailoring or submitting.
9. Do not initialize dated batch ledgers, Markdown tracker mirrors, or
   per-application report files for new work.
10. Run a provider-coverage pass before opening new roles. Include search
   providers such as Jooble and Adzuna, direct employer boards such as
   Greenhouse, Lever, Workday, SmartRecruiters, Workable, iCIMS, Oracle, Taleo,
   and Ashby, plus user-visible email or aggregator leads when available.
11. Update `data/application-tracker.json` after every material transition,
   blocker, user answer, approval, upload, submitted answer, and confirmation.

## Route Work

Use the smallest skill that owns the current transition:

- Invoke `$tailor-job-resume` for job analysis, truthful ATS alignment,
  rendering, visual validation, and approval manifests.
- Invoke `$tailor-job-cover-letter` only when a letter or motivation response
  is required or materially useful.
- Invoke `$submit-job-application` only after the exact current package is
  approved and its hashes match.
- Use `gmail:gmail` in read-only mode for rejection, confirmation, interview,
  and follow-up reconciliation before discovery and after submissions.
- Invoke `$ui-latency-normalization` for CAPTCHA, anti-bot, consent, login,
  modal, loading, or session-state friction.
- Invoke `$verify-job-application-state` before and after every skill handoff
  and for final tracker audit.

Do not merge these ownership boundaries into one improvised browser script.
Reuse established provider handlers under `scripts/` when they match the
current form, but re-inspect the live form before relying on selectors.

## Activate The Browser Workbench

1. Start or verify the local workbench with `npm run ui`; its default URL is
   `http://localhost:4321/`.
2. Use `browser:control-in-app-browser` for the local workbench and ordinary
   application pages that do not depend on an existing login.
3. Use `chrome:control-chrome` when the flow depends on the user's logged-in
   Chrome state, Gmail, an existing ATS session, or a page the user already
   opened.
4. Re-baseline the URL, employer, role, signed-in account, and current form
   step whenever control changes, a challenge is cleared, or a page reloads.
5. Keep an unfinished CAPTCHA, login, OTP, or user-input tab as a browser
   handoff and record that handoff on the tracker entry.

## Gates

Enforce these gates in order:

1. **Eligibility:** currently open, US-listed, compatible with current work
   authorization, and truthful future-sponsorship answer.
2. **Fit:** prioritize robotics; reject hard seniority, clearance, citizenship,
   location, or unsupported-skill blockers.
3. **Provider coverage:** shortlist from the current provider-coverage record,
   not from the first easy ATS only. A single-provider run is allowed only when
   the tracker records why other checked sources were unavailable, duplicate,
   incompatible, stale, blocked, or lower ranked after screening.
4. **Package:** local ATS heuristic 89-95 where truthfully achievable, one to
   two pages, approved styling, exact filenames.
5. **Approval:** in interactive mode, show every exact page and checklist. In
   single-command mode, standing authorization covers only packages that pass
   deterministic validation and verification checks. Bind approval to manifest
   hashes; invalidate it after any artifact or response change.
6. **Transmission:** verify hashes immediately before upload. Use only
   user-confirmed durable answers; ask for unresolved legal or factual input.
   Record every answer submitted for the role on the tracker entry.
7. **Confirmation:** count only immediate provider evidence plus confirmation
   email, employer/ATS portal evidence, or provider/API acceptance evidence. A
   clicked submit button or success page alone is not a fully verified
   submission.
8. **Tracker persistence:** write every duplicate-prevention update to
   `data/application-tracker.json` immediately.
9. **Incomplete isolation:** incomplete, rejected, blocked, skipped,
   needs-review, awaiting-user, and pending-verification roles must stay in
   the tracker with `workflowExcluded=true` and any package artifacts moved to
   `Incomplete Application/` when cleanup is requested. Do not spend ordinary
   discovery time on them or proactively recheck them. Reapply only when the
   role is rediscovered naturally as a strong current match and a fast live
   check proves the same or reopened listing accepts another application
   without duplicate, cooldown, CAPTCHA-only, login-reset, or unresolved
   employer/account restriction; record the check timestamp, result, and
   rationale on the tracker entry before tailoring or submitting.

## Finish

1. Run the verification tracker audit.
2. Reconcile tracker entries with submission result files, package manifests,
   screenshots, confirmation text, and submitted answers.
3. Reconcile Gmail rejection/confirmation/interview evidence when available
   and update the tracker before counting or excluding roles.
4. Delete one-time OTP/security-code files after use; never preserve their
   contents in the tracker.
5. Clean up run-owned runtime resources only when ownership is verified.
6. Never stop or close a server, browser, tab, process, or application that
   existed before this run or whose ownership cannot be verified.
7. Record cleanup actions, retained handoffs, and any cleanup failure on the
   tracker entry when that state affects continuation.
8. Report submitted, blocked, skipped, and input-needed roles separately.
9. Mark the run complete only when the requested number has authoritative
   evidence, `data/application-tracker.json` is current, and the tracker audit
   passes.
