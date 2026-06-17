## UI Friction / Browser Normalization

When browser workflows hit UI-layer friction such as CAPTCHA, Cloudflare,
Turnstile, "Verify you are human", consent overlays, cookie banners, blocked
modals, login interstitials, or flaky loading states, route through the
`ui-latency-normalization` skill before trusting browser evidence.

Rules:

- Treat these overlays as UI latency/friction, not as proof of application
  behavior.
- Do not collect final evidence while the overlay is active or while the
  route/account/workspace is uncertain.
- Clear friction deliberately and only in authorized contexts.
- If a manual CAPTCHA or human verification is required, pause for the operator
  to complete it instead of inventing a bypass.
- After the friction clears, re-baseline the expected route, signed-in actor,
  tenant/workspace, role, and blocked/allowed control.
- If the re-baseline fails, discard interim observations and treat the flow as
  still blocked.
- For security testing, pair UI evidence with backend/network proof whenever
  possible.

---

## Resume Tailoring

When researching a job for George, tailoring a resume or cover letter, analyzing ATS alignment, preparing a job-specific application package, showing application materials for approval, or uploading application files, use the `tailor-job-resume` skill.

When an application requires or materially benefits from a cover letter,
motivation statement, why-company response, or brief cover note, also use the
`tailor-job-cover-letter` skill. Do not add a generic optional letter merely to
fill an optional field.

- Preserve George Jobi Perangattu's verified resume content and established styling.
- Keep tailoring strictly truthful and report unsupported job requirements as gaps.
- Target a transparent local ATS alignment estimate of 89-95 without forcing a low score upward.
- Use the exact upload names `George_Jobi_Resume.pdf` and `George_Jobi_CoverLetter.pdf`.
- Show all generated pages and the approval checklist before submitting an application.
- Repeat approval whenever an approved file changes.
- Read `data/candidate-application-answers.md` before asking repeated form questions.
- Verify the approval-manifest hashes immediately before uploading files.
- Capture the provider success page or equivalent immediate submission response,
  but do not treat a success page alone as final verification.
- Mark a submitted application as fully verified only after a second signal is
  recorded: a confirmation email, employer/ATS portal record, or provider/API
  response that confirms the application was accepted.
- If only the success page is available, record the role as submitted but
  pending email/portal verification.
- Record every blocked, CAPTCHA/OTP-gated, replaced, or incomplete application
  in `application_tracker.md` with the original job posting URL. Also copy
  incomplete Codex attempts into `DYI applications.md` using the same table
  format.

## Automatic Job-Application Routing

When the user says any plain-language equivalent of:

- `apply to 10 jobs`
- `your goal is to apply to 10 different jobs`
- `send out 5 applications`
- `continue applying until 20 jobs are submitted`

immediately use the `run-job-application-workbench` skill as the master
orchestrator. Extract the requested number as the authoritative submitted-job
target. Do not require the user to name skills, create a batch, start the
server, choose providers, restate their profile, or explain the workflow.

Treat the request as standing authorization to:

- create a uniquely named batch and durable application ledger;
- source and screen currently open US jobs;
- prioritize the candidate's recorded robotics preferences;
- tailor, render, and validate role-specific application materials;
- submit packages that satisfy all established truthfulness, formatting,
  eligibility, filename, ATS-heuristic, and verification rules;
- continue replacing closed, incompatible, blocked, duplicate, CAPTCHA-skipped,
  or unconfirmed roles until the requested number is authoritatively submitted.

Proceed autonomously using `data/candidate-application-answers.md`. Ask the user
only for an application-specific fact that is absent or ambiguous, a legal or
immigration answer that cannot be inferred, a required login or one-time code,
or human verification. Record the question and exact continuation step in the
application ledger before asking.

The requested number means successfully and authoritatively confirmed
applications, not attempts. A final verified application requires both the
immediate submission evidence and either a confirmation email, employer/ATS
portal record, or provider/API acceptance record. Never count blocked, skipped,
staged, `needs-review`, email-unverified, or merely clicked submissions as fully
verified.

## Model-Aware Subagent Delegation

The master job-application workbench may use subagents when the user requests a
multi-role batch. Divide independent research, package analysis, and
verification work in parallel, but keep live browser submission and ledger
ownership with the main agent.

Choose the subagent model according to task intensity:

- **Low intensity - `gpt-5.4-mini`:** role discovery, listing freshness checks,
  duplicate detection, extracting job requirements, comparing structured
  fields, checking filenames, and routine evidence inventory.
- **Medium intensity - `gpt-5.4`:** eligibility screening, keyword-gap
  analysis, truthful resume-tailoring recommendations, cover-letter necessity
  decisions, application-question mapping, and package/manifest review.
- **High intensity - `gpt-5.5`:** ambiguous sponsorship or export-control
  wording, complex factual reconciliation, novel ATS forms, high-risk
  application responses, conflicting evidence, and final batch forensic audit.

Use the lowest-capability model that can complete the task reliably. Increase
the model level when a subagent reports uncertainty, conflicting evidence, or
material risk. Do not use a high-intensity model for mechanical work.

Subagents must:

- receive a concrete, bounded task and the exact source files they need;
- use disjoint write scopes when editing artifacts;
- never submit an application, click a final submit control, access OTPs, solve
  CAPTCHAs, or alter the authoritative ledger;
- never invent candidate facts or treat local ATS estimates as employer scores;
- return structured findings and artifact paths to the main agent.

The main agent must verify and integrate subagent output, update
`application-workbench.md`, enforce approvals and browser safety, and remain
the sole owner of final external side effects.

## Claude Code Subagent Routing

When this repository runs in Claude Code, use `CLAUDE.md` as the Claude-specific
instruction layer and the agents in `.claude/agents/`.

Claude Code routing mirrors the intensity strategy above:

- **Low intensity - `job-discovery-haiku`:** use `claude-haiku-4-5` with low
  effort for role discovery, freshness checks, duplicate checks, and simple
  extraction.
- **Medium intensity - `job-screening-sonnet`:** use `claude-sonnet-4-6` with
  medium effort for eligibility, ATS gaps, package review, and form-question
  mapping.
- **High intensity - `job-risk-opus`:** use `claude-opus-4-8` with xhigh effort
  for sponsorship/export ambiguity, novel ATS flows, conflicting evidence,
  high-risk application responses, and final forensic audits.
- **Email verification - `email-verification-sonnet`:** use
  `claude-sonnet-4-6` with low effort to inventory confirmation emails or
  portal evidence only after the main session has explicit authorization.

The main Claude Code session remains the only actor that may click final submit,
handle OTP/CAPTCHA handoffs, access mailbox verification, update the
authoritative tracker, or mark a target count complete.

For token efficiency in Claude Code, default the main session to
`claude-sonnet-4-6` at medium effort for setup and ordinary application goals.
Use Haiku subagents for bulk discovery and simple extraction. Escalate to
`claude-opus-4-8` only for ambiguous legal/sponsorship/export wording, novel ATS
failures, contradictory evidence, or final forensic audit work; use Opus xhigh
only when high effort is not enough or the batch evidence is disputed.

## Job-Workbench Resource Cleanup

At the end of a completed, stopped, or blocked batch, clean up resources created
by that batch:

- stop the localhost workbench server and background helper processes only
  when the batch started them;
- close agent-created research, duplicate, blank, error, and completed
  application tabs;
- retain only a confirmation tab explicitly useful to the user or an unfinished
  login, OTP, CAPTCHA, or required-input tab recorded as a handoff;
- close completed subagents;
- remove temporary OTP/security-code files and non-evidence temporary files;
- preserve ledgers, approved packages, manifests, validation reports,
  screenshots, and submission evidence.

Never stop a localhost server, browser, Chrome instance, terminal process, or
other background application that was already running before the batch. Record
the process IDs and browser tabs created by the batch so ownership can be
verified before cleanup. Record the cleanup result in the authoritative ledger.
