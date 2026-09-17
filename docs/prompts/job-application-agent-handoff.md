# Job Application Agent Handoff

Use this document as the operating spec for any agent applying to jobs from this repository.

## Primary Goal

Apply to strong-fit roles efficiently without duplicate submissions while keeping tracker data, resume choices, and confirmation artifacts clean enough for future runs to continue safely.

## Source Of Truth

- Tracker: `./data/application-tracker.json`
- Candidate answers: `./data/candidate-application-answers.md`
- Legacy Handshake profile mirror: `./application-profile.json`
- Handshake assistant: `./src/handshake.ts`
- Ashby helper: `./scripts/ashby_api_apply.py`
- Board fetch helper: `./scripts/job_board_fetch.sh`
- Resume renderer: `./scripts/text_resume_to_pdf.py`

## Non-Negotiable Rules

### 1. Reapply Only When Clearly Allowed

Before opening or submitting any role, check the tracker by:

- company name
- exact role title
- normalized job URL or job ID

If there is ambiguity, treat it as a blocker for ordinary discovery.
`workflowExcluded=true` means the role is visible for duplicate prevention and
should be skipped by default, not that it can never be retried. Do not
proactively recheck old excluded roles. Re-enter a rejected, incomplete,
skipped, blocked, or pending role only when normal sourcing rediscovers it
naturally as a strong current match and a fast live check records
`reapplyAllowed=true` and proves the listing is open and no employer, ATS,
duplicate, cooldown, account, or application-history restriction blocks another
submission.

### 2. The Tracker Is Mandatory

Every submitted application must update the matching
`data/application-tracker.json` entry with resume used, path taken, submitted
answers, confirmation evidence, status, blocker if any, and next action.

### 3. Resume Selection Must Be Deliberate

- Prefer the strongest existing resume before creating a new version.
- Compare multiple options when a role spans software, customer engineering, implementation, or forward deployed lanes.
- Tailor only when the role justifies it.

### 4. Keep Claims Truthful

- Do not invent companies, dates, titles, technologies, or degrees.
- Do not answer required questions with fabricated content.
- If a required field cannot be answered truthfully, stop and report the blocker.

## Standard Workflow

### Phase 1: Discover

Use:

- `npm run search`
- the local workbench UI
- `./scripts/job_board_fetch.sh`

Prefer public board APIs and normalized search output before manual browsing.

### Phase 2: Duplicate Check

Search the tracker before any submission work:

```bash
rg -n "Company Name|Exact Role Title|job-id-or-url-fragment" ./data/application-tracker.json
```

### Phase 3: Choose Resume

For each role:

1. Read the title and core requirements.
2. Identify the most likely resume family.
3. Compare against at least one alternate.
4. Tailor only if the fit is still weak.

### Phase 4: Prepare Answers

- Use `data/candidate-application-answers.md` for repeated answers. Search it
  by exact wording and semantic equivalent before asking George a question.
- Keep short-form answers concrete and truthful.
- Prefer specific project examples over generic enthusiasm.

### Phase 5: Submit

- Prefer API-first when the target flow is stable.
- Use browser-backed submission when the form is dynamic or anti-bot protections make raw replay brittle.
- Confirm a real success state before calling the application submitted.

### Phase 6: Normalize UI Friction When Needed

If a browser flow is blocked by Cloudflare, Turnstile, reCAPTCHA, hCaptcha, cookie banners, consent overlays, or stale challenge-driven rerenders:

1. Preserve the same tab and same session.
2. Treat the current live challenge instance as progress.
3. Solve or dismiss the blocker deliberately.
4. Re-verify route, actor, and blocked control after the blocker clears.
5. Resume only from a fresh baseline.

## Required Output Per Role

- company
- role
- job URL
- duplicate-check result
- selected resume
- whether tailoring happened
- submission path
- confirmation artifact path
- tracker update result in `data/application-tracker.json`
- blocker if not submitted

## Completion Standard

A role is complete only if:

- duplicate checks passed
- the best resume was chosen deliberately
- the application reached a real success state
- a confirmation artifact was saved
- `data/application-tracker.json` was updated

If one of those is missing, the role is not complete.
