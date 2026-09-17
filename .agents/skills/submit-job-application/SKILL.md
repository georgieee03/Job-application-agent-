---
name: submit-job-application
description: Fill, verify, submit, and confirm a live employer application using an already approved job-specific package. Use when Codex must operate Greenhouse, Ashby, Lever, Workday, or another ATS form; upload the exact approved resume and cover letter; answer application questions from durable candidate facts; record submitted answers on the workbench tracker entry; handle OTP or CAPTCHA handoffs; use logged-in Chrome when needed; capture authoritative evidence; or update data/application-tracker.json.
---

# Submit Job Application

Submit one approved package without changing its content or inventing answers.

## Preconditions

1. Read the active role entry in `data/application-tracker.json`.
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
3. Before asking the user any form question, search
   `data/candidate-application-answers.md` by exact wording and by semantic
   equivalent. Use `application-profile.json` only as a legacy compatibility
   mirror; the Markdown file is the source of truth for repeated answers.
4. Use durable confirmed answers exactly according to the form wording,
   especially current authorization versus future sponsorship.
5. Leave optional salary blank unless the form requires it. Use a stated job
   range only as directed by the durable answer contract.
6. Complete voluntary EEO only with confirmed answers. Do not infer missing
   demographics.
7. Upload only the exact approved files:
   - `George_Jobi_Resume.pdf`
   - `George_Jobi_CoverLetter.pdf`, when approved and needed
8. Verify each upload persisted and the displayed filename is correct.
9. Build a required-field inventory for the current step before submit. Include
   visible labels, `required` and `aria-required` attributes, asterisks,
   provider metadata, grouped radio/checkbox controls, dropdowns, file inputs,
   acknowledgements, and custom questions.
10. Verify every required item in the inventory is satisfied:
   - text fields contain the intended answer;
   - select/dropdown/radio groups have the intended selected option;
   - required checkboxes and acknowledgements are checked;
   - files show the exact approved filename;
   - EEO and sponsorship answers match durable confirmed answers.
11. Scan for visible inline errors, missing-field banners, red required
    labels, disabled submit controls, or required fields that lost state after
    upload/dropdown interactions. Resolve known fields and re-run the inventory.
12. Record any new required question on the tracker entry and ask the user.
    Keep the browser tab as a handoff when possible.
13. Maintain a submitted-answer log for the role. Record every non-secret answer
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
5. If the provider returns missing-field or validation errors, capture the
   exact messages and labels, update the tracker entry, fill only known
   answers, re-run the required-field inventory, and make at most one targeted
   retry for that same submit step.
6. If the same missing fields remain after the retry, a field value will not
   persist, or the answer is not in the durable facts, mark the role
   `needs-review` or `manual submit needed`. Do not reopen the same application
   page or repeat the same failed submit loop.
7. Capture the immediate provider evidence, then require a second signal before
   marking the role fully verified: confirmation email, employer/ATS portal
   record, or provider/API acceptance evidence.
8. Capture confirmation text, URL, timestamp, and screenshot when available.
9. If only the success page is available, mark the role
   `submitted - pending email verification`, not complete.
10. After submission, run read-only email reconciliation when Gmail is
    available. Confirmation emails may move a pending role to
   `submitted - email verified`; rejection emails must move the role to
   `rejected`, mark it `workflowExcluded=true`, and preserve it for duplicate
   prevention. A rejected role may be considered again only when normal
   sourcing rediscovers it naturally as a strong current match and a fast live
   reapply check proves there is no employer, ATS, duplicate, cooldown, or
   account restriction; otherwise skip it quickly.
11. Mark an ambiguous result `needs-review`, never verified.
12. Invoke `$verify-job-application-state` to persist the outcome, evidence,
   submitted answers, blocker, and next action in `data/application-tracker.json`.
13. If the application is blocked, CAPTCHA/OTP-gated, impossible to complete, or
    skipped, persist it as `not completed`, `not submitted`, `manual submit
    needed`, `blocked`, or `skipped` with the job URL in the tracker.
