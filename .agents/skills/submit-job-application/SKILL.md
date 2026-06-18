---
name: submit-job-application
description: Fill, verify, submit, and confirm a live employer application using an already approved job-specific package. Use when Codex must operate Greenhouse, Ashby, Lever, Workday, or another ATS form; upload the exact approved resume and cover letter; answer application questions from durable candidate facts; record submitted answers in the per-application report; handle OTP or CAPTCHA handoffs; use logged-in Chrome when needed; capture authoritative evidence; or update synced trackers and the application ledger.
---

# Submit Job Application

Submit one approved package without changing its content or inventing answers.

## Preconditions

1. Read the active role in `application-workbench.md`.
2. Read `data/candidate-application-answers.md`.
3. Read the role's `approval-manifest.json`, validation report, and exact
   application responses.
4. Require status `approved`, explicit approval evidence, and a current hash
   match for every artifact and text response.
5. Require an authoritative live job URL. Stop if the role is closed, changed
   materially, or no longer eligible.

If any precondition fails, return control to
`$run-job-application-workbench`; do not repair the package inside this skill.

## Browser Route

1. Read [references/browser-and-provider-playbook.md](references/browser-and-provider-playbook.md).
2. Use `browser:control-in-app-browser` for ordinary forms.
3. Use `chrome:control-chrome` for logged-in state, Gmail codes, possible-spam
   interstitials, or an existing user tab.
4. Follow the selected browser skill's Playwright bootstrap and confirmation
   rules.
5. Before entering data, verify the URL, employer, role, and form step.

## Fill And Verify

1. Inspect the current form; do not trust stale selector mappings blindly.
2. Fill only fields whose meaning is clear.
3. Use durable confirmed answers exactly according to the form wording,
   especially current authorization versus future sponsorship.
4. Leave optional salary blank unless the form requires it. Use a stated job
   range only as directed by the durable answer contract.
5. Complete voluntary EEO only with confirmed answers. Do not infer missing
   demographics.
6. Upload only the exact approved files:
   - `George_Jobi_Resume.pdf`
   - `George_Jobi_CoverLetter.pdf`, when approved and needed
7. Verify each upload persisted and the displayed filename is correct.
8. Record any new required question in the ledger and ask the user. Keep the
   browser tab as a handoff when possible.
9. Maintain a submitted-answer log for the role. Record every non-secret answer
   actually entered or selected, including yes/no authorization answers,
   sponsorship answers, location/work-mode answers, EEO choices when provided,
   acknowledgements, and custom short or long responses. Do not record
   passwords, CAPTCHA answers, OTP/security codes, cookies, or raw session data.

## Friction

Invoke `$ui-latency-normalization` for CAPTCHA, anti-bot, login, consent,
overlay, or unstable loading. Never claim a CAPTCHA bypass.

- Ask before attempting each CAPTCHA, as required by the browser safety
  contract.
- If the user directs CAPTCHA applications to be skipped, record `skipped` and
  preserve the application link.
- For an emailed OTP, access only the narrowly authorized mailbox/code,
  identify the newest message for the exact employer/form, use the code once,
  and do not retain it.
- After any challenge, re-baseline URL, employer, role, account, and form step.

## Submit And Confirm

1. Recheck artifact hashes immediately before upload or final submission.
2. Review all visible answers, required fields, sponsorship semantics,
   attachments, and acknowledgements.
3. Obtain action-time confirmation when the active browser safety contract
   requires it and the user's prior approval does not narrowly cover this exact
   submission.
4. Submit once. Avoid duplicate clicks while the page is processing.
5. Capture the immediate provider evidence, then require a second signal before
   marking the role fully verified: confirmation email, employer/ATS portal
   record, or provider/API acceptance evidence.
6. Capture confirmation text, URL, timestamp, and screenshot when available.
7. If only the success page is available, mark the role
   `submitted - pending email verification`, not complete.
8. Mark an ambiguous result `needs-review`, never verified.
9. Invoke `$verify-job-application-state` to persist the outcome, evidence,
   submitted answers, application report, tracker update, and Git sync status.
10. If the application is blocked, CAPTCHA/OTP-gated, impossible to complete, or
    skipped, persist it as `not completed`, `not submitted`, `manual submit
    needed`, `blocked`, or `skipped` with the job URL and copy it to
    `DYI applications.md` when incomplete.
