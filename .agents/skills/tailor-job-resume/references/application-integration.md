# Application Integration

Use this workflow when tailoring is part of searching for or submitting a job application.

## Eligibility Screen

Before generating files, confirm:

- the job is currently open and located in the United States;
- the role is compatible with OPT/STEM OPT and does not require US citizenship, permanent residence, or an unavailable clearance;
- future H-1B sponsorship is not explicitly prohibited;
- the role is materially relevant to the candidate's robotics, autonomy, controls, automation, integration, perception, navigation, manufacturing-test, or software background;
- the exact company and role are not already recorded as submitted, attempted,
  blocked, not completed, or not submitted in `data/application-tracker.json`,
  `application_tracker.md`, `DYI applications.md`, or
  `data/application-reports/*.md`.

Treat missing sponsorship language as unknown, not as proof of sponsorship. Record any material uncertainty for user review.

## Package Directory

Use one role-specific directory per application. Keep:

- authoritative job description or structured notes;
- `ats-keywords.txt`;
- keyword-gap analysis;
- `George_Jobi_Resume.pdf`;
- `George_Jobi_CoverLetter.pdf`, when used;
- rendered PNG previews for every page;
- `validation-report.json`;
- `approval-manifest.json`;
- submission evidence after completion.

Upload only the approved resume and cover letter.

## Form Answers

Read `data/candidate-application-answers.md` before filling forms.

- Reuse confirmed answers only when the employer's wording has the same meaning.
- Distinguish current work authorization from future sponsorship.
- Do not infer voluntary EEO answers beyond the recorded choices.
- Add unresolved questions to the Open Questions table before asking the user.
- Append each new user-confirmed answer with enough company/role context to reuse it safely.

## Browser Handoff

After role-specific approval:

1. Open the authoritative application form.
2. Re-baseline the page before trusting element state.
3. Fill from the durable answer file and the approved package.
4. Pause for any unresolved factual question.
5. Never bypass CAPTCHA or human verification. Let the user complete it; skip the role if it cannot be completed manually.
6. Before upload, compare file hashes with `approval-manifest.json`.
7. Submit only when no unanswered required field remains.
8. Capture immediate provider evidence, then require confirmation email,
   employer/ATS portal evidence, or provider/API acceptance evidence before
   marking the role fully verified.
9. Update `data/application-tracker.json`, `application_tracker.md`,
   `DYI applications.md` when incomplete, and
   `data/application-reports/<role-id>.md` with the exact role, company, URL,
   date, submitted answers, evidence, blocker, and final status.
10. Push a tracker/report-only commit before ending or switching devices.

Use `$ui-latency-normalization` for CAPTCHA, Cloudflare, consent overlays, blocked modals, login interstitials, or flaky loading. Re-inspect the page after the friction is cleared.

## Completion Rule

Do not count:

- a saved draft;
- an uploaded resume without final submission;
- a form blocked by CAPTCHA;
- a page that merely returned to the job listing;
- a browser click with no authoritative confirmation.

Count only independently evidenced successful submissions.
