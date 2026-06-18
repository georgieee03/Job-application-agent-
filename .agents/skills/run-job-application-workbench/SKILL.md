---
name: run-job-application-workbench
description: Orchestrate or resume a verified end-to-end job-application batch for George Jobi Perangattu, from US role discovery and visa/fit screening through truthful resume tailoring, optional cover-letter creation, exact-file approval, Playwright form submission, CAPTCHA or OTP handoff, confirmation capture, synced trackers, per-application reports, and durable Markdown state. Automatically use this skill for plain-language requests such as "apply to 10 jobs," "your goal is to apply to 10 different jobs," "send out 5 applications," or "continue until 20 jobs are submitted," even when the user does not name any skill. Also use when Codex must continue an interrupted batch, coordinate application sub-skills, push tracker/report state for cross-device duplicate prevention, or hand the complete workflow to another session without losing context.
---

# Run Job Application Workbench

Run the application pipeline as a resumable state machine. Make
`application-workbench.md` the human-readable source of truth for the batch.

## Single-Command Mode

When the user gives only a target such as `apply to 10 different jobs`:

1. Extract the number as the required count of unique, authoritatively
   confirmed submissions.
2. Create a unique run name using the current month, year, target, and an
   increment when needed, for example `june-2026-next-10-2`.
3. Treat the command as standing authorization to source, tailor, validate,
   upload, and submit any package that passes every deterministic workflow
   gate. Record this authorization in the ledger.
4. Use all preferences and confirmed answers already stored in
   `data/candidate-application-answers.md`. Do not ask setup questions already
   answered there.
5. Keep replacing closed, incompatible, duplicate, CAPTCHA-skipped, blocked,
   or unconfirmed roles until the confirmed-submission target is met.
6. Ask the user only for:
   - an application-specific fact absent from the durable answers;
   - an ambiguous legal, immigration, export-control, or factual answer;
   - required login, OTP, or account recovery;
   - CAPTCHA or other human verification.
7. Before asking, save the exact question, browser handoff, blocker, and next
   action in `application-workbench.md`. Resume from that point after the
   answer without restarting the batch.
8. Before sourcing roles, pull/rebase `main` and read the synced trackers and
   application reports so the batch sees applications attempted from any other
   device or workspace.

Do not ask the user to select jobs, name a batch, invoke sub-skills, start the
workbench, or approve routine implementation choices. Browser/plugin safety
requirements still apply when they require action-time confirmation.

## Delegate By Intensity

For multi-role batches, use subagents to parallelize independent work when
subagent tools are available. Keep the critical path moving locally and never
delegate the live final submission.

### Model Routing

Assign the lowest model tier that safely fits the task:

| Intensity | Preferred model | Suitable work |
| --- | --- | --- |
| Low | `gpt-5.4-mini` | Discover roles, verify freshness, extract requirements, find duplicates, inventory evidence |
| Medium | `gpt-5.4` | Screen eligibility, analyze ATS gaps, review tailoring, map form questions, validate packages |
| High | `gpt-5.5` | Resolve conflicting evidence, analyze novel/high-risk forms, interpret ambiguous legal or sponsorship wording, conduct final forensic audit |

If a listed model is unavailable, select the closest available model and keep
the same intensity boundary. Escalate one tier only when the assigned agent
reports uncertainty, conflict, or risk that materially affects eligibility,
truthfulness, or submission.

### Delegation Boundaries

1. Delegate only concrete, self-contained tasks that can run independently.
2. Give each worker the role ID, authoritative job source, required candidate
   sources, expected output, and a disjoint artifact directory when edits are
   allowed.
3. Parallelize role discovery and package preparation across different roles.
4. Do not have two agents tailor or edit the same application package.
5. Subagents may research, analyze, draft, render, or verify. They must not:
   - change the authoritative ledger;
   - use Gmail or one-time codes;
   - attempt CAPTCHA;
   - click a final submit control;
   - mark a role submitted.
6. The main agent must review every subagent result, run deterministic
   validation, bind approval hashes, update the ledger, and own all browser
   side effects.
7. Record delegated task, model tier, result, and integration decision as a
   ledger event without recording hidden reasoning.

Suggested batch decomposition:

- low-intensity discovery agents source and deduplicate candidate roles;
- medium-intensity role agents screen and prepare separate application
  packages;
- a high-intensity verifier audits only packages with ambiguity or elevated
  risk, plus the final completed batch;
- the main agent serially submits approved packages and records confirmation.

## Start Or Resume

1. Read `data/candidate-application-answers.md`.
2. Run `git pull --rebase origin main` unless local unrelated changes make it
   unsafe; if unsafe, record the blocker before role discovery.
3. Read all duplicate-prevention state:
   - `data/application-tracker.json`
   - `application_tracker.md`
   - `DYI applications.md`
   - `data/application-reports/*.md`
   - active or recent `data/<run-name>/application-workbench.*` files
4. Find the active run's `application-workbench.md`. If none exists, invoke
   `$verify-job-application-state` to initialize one under `data/<run-name>/`.
5. Read the complete ledger before browser or document work. Continue from the
   recorded `Next action`; do not reconstruct state from chat memory alone.
6. Read [references/orchestration-state-machine.md](references/orchestration-state-machine.md).
7. Read [references/role-selection-and-eligibility.md](references/role-selection-and-eligibility.md)
   while sourcing or screening roles.
8. Update the ledger, every tracker, and the per-application report after every
   material transition, blocker, user answer, approval, upload, submitted
   answer, and confirmation.
9. At clean checkpoints, stage only tracker/report artifacts, commit them, and
   push `main` so the next workspace has the duplicate-prevention state.

## Route Work

Use the smallest skill that owns the current transition:

- Invoke `$tailor-job-resume` for job analysis, truthful ATS alignment,
  rendering, visual validation, and approval manifests.
- Invoke `$tailor-job-cover-letter` only when a letter or motivation response
  is required or materially useful.
- Invoke `$submit-job-application` only after the exact current package is
  approved and its hashes match.
- Invoke `$ui-latency-normalization` for CAPTCHA, anti-bot, consent, login,
  modal, loading, or session-state friction.
- Invoke `$verify-job-application-state` before and after every skill handoff
  and for final batch audit.

Do not merge these ownership boundaries into one improvised browser script.
Reuse established provider handlers under `scripts/` when they match the
current form, but re-inspect the live form before relying on selectors.

## Activate The Browser Workbench

1. Start or verify the local workbench with `npm run ui`; its default URL is
   `http://localhost:4321/`.
   Before starting it, detect whether the port is already listening. If this
   batch starts the server, record its process ID and `started_by_batch=true`
   in the ledger. If it already exists, record `started_by_batch=false` and
   never stop it during cleanup.
2. Use `browser:control-in-app-browser` for the local workbench and ordinary
   application pages that do not depend on an existing login.
3. Use `chrome:control-chrome` when the flow depends on the user's logged-in
   Chrome state, Gmail, an existing ATS session, or a page the user already
   opened.
4. Follow the selected browser skill's bootstrap exactly and use its
   Playwright API. Read the browser documentation before acting.
5. Re-baseline the URL, employer, role, signed-in account, and current form
   step whenever control changes, a challenge is cleared, or a page reloads.
6. Keep an unfinished CAPTCHA, login, OTP, or user-input tab as a browser
   handoff. Finalize completed or irrelevant tabs according to the browser
   skill.

## Gates

Enforce these gates in order:

1. **Eligibility:** currently open, US-listed, compatible with current work
   authorization, and truthful future-sponsorship answer.
2. **Fit:** prioritize robotics; reject hard seniority, clearance, citizenship,
   location, or unsupported-skill blockers.
3. **Package:** local ATS heuristic 89-95 where truthfully achievable, one to
   two pages, approved styling, exact filenames.
4. **Approval:** in interactive mode, show every exact page and checklist. In
   single-command mode, the initial standing authorization covers only
   packages that pass all deterministic validation and verification checks.
   Bind either approval mode to manifest hashes; invalidate it after any
   artifact or response change.
5. **Transmission:** verify hashes immediately before upload. Use only
   user-confirmed durable answers; ask for unresolved legal or factual input.
   Record every answer submitted for the role in its application report.
6. **Confirmation:** count only immediate provider evidence plus confirmation
   email, employer/ATS portal evidence, or provider/API acceptance evidence. A
   clicked submit button or success page alone is not a fully verified
   submission.
7. **Cross-device sync:** after tracker/report changes that affect duplicate
   prevention, push a tracker-only commit to `main` before continuing on another
   device or ending the batch.

The user may approve a named batch in advance. Record the scope and exact
manifest hashes. Browser-side confirmations still apply when required by the
active Browser or Chrome safety contract.

## Finish

1. Run the verification ledger audit.
2. Reconcile the Markdown ledger, submission result files, package manifests,
   screenshots, confirmation text, submitted answers, per-application reports,
   and all trackers.
3. Delete one-time OTP/security-code files after use; never preserve their
   contents in the ledger.
4. Clean up batch-owned runtime resources:
   - stop the localhost workbench and helper processes only when their recorded
     `started_by_batch` value is true and the current PID still matches;
   - close agent-created research, duplicate, blank, error, and completed form
     tabs according to the active Browser or Chrome skill;
   - retain only user-facing confirmation tabs or tabs explicitly recorded as
     unfinished handoffs;
   - close all subagents created for the batch;
   - remove non-evidence temporary files while preserving packages, manifests,
     reports, ledgers, screenshots, and confirmation artifacts.
5. Never stop or close a server, browser, tab, process, or application that
   existed before this batch or whose ownership cannot be verified.
6. Record cleanup actions, retained handoffs, and any cleanup failure in
   `application-workbench.md`.
7. Report submitted, blocked, skipped, and input-needed roles separately.
8. Commit and push the final tracker/report sync to `main`, staging only:
   - `data/application-tracker.json`
   - `application_tracker.md`
   - `DYI applications.md`
   - `data/application-reports/`
   - `data/<run-name>/application-workbench.md`
   - `data/<run-name>/application-workbench.json`
9. Mark the batch complete only when the requested number has authoritative
   evidence, the per-application reports are current, the synced trackers are
   updated, and the ledger audit passes.
