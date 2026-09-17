# Browser And Provider Playbook

## Surface Selection

| Need | Surface |
| --- | --- |
| Local workbench at localhost | In-app Browser |
| Ordinary public ATS form | In-app Browser |
| Existing logged-in ATS session | Chrome |
| Gmail OTP/code | Chrome |
| User already has target page open | Chrome |
| Possible-spam state differs by profile | Logged-in Chrome |

Always use the selected plugin's browser-client Playwright API. Do not open a
second standalone browser profile unless the user specifically requests it or
the provider-specific script is the approved execution path.

## Required Field Audit

- Before final submit, create a current-step inventory of all visible required
  fields from labels, `required`, `aria-required`, visible asterisks, provider
  metadata, grouped controls, file inputs, and acknowledgements.
- Verify field state after uploads and dropdown/radio interactions because some
  providers re-render the form and silently clear values.
- Treat disabled submit controls, inline validation messages, and missing-field
  banners as incomplete state, not as a reason to reload or restart.
- If final submit returns missing-field errors, capture the exact field labels,
  fill only known answers, re-run the inventory, and make one targeted retry.
- After two failed submits for the same field set, a non-persistent value, or
  an unknown answer, stop and record `needs-review` or `manual submit needed`
  with the retained tab. Do not reopen the same posting into another loop.

## Greenhouse

- Re-inspect generated question IDs on every role.
- Distinguish current work authorization from future sponsorship.
- Audit required custom questions and consent checkboxes before the first
  submit; Greenhouse often reports missing fields only after validation.
- A first submit may trigger an emailed 8-character security code.
- Keep the form alive while waiting. Select the newest email with the exact
  subject/employer; grouped email previews can show a stale code.
- Enter the code once, submit once, capture the confirmation page, and delete
  any temporary code file.

## Ashby

- Resume inputs commonly use `_systemfield_resume`; verify live IDs.
- Required long-answer fields must match the approved response hashes.
- Use Ashby's form metadata when available to identify required questions, then
  re-read the rendered value after setters, dropdowns, or file uploads.
- "Possible spam" or reCAPTCHA states may clear in the user's logged-in Chrome
  profile. Re-baseline after switching surfaces.
- Do not count a disabled button, spinner, or cleared form as confirmation.

## Lever

- Inspect labels and file inputs live.
- Preserve exact approved filenames and verify retained upload state.
- Verify required questions, source/referral fields, and acknowledgements before
  submit; Lever may keep the button active while still returning field errors.
- Capture the explicit thank-you page or confirmation message.

## Workday And Account-Based ATS

- Prefer a proven tenant flow. New tenants may require account creation,
  email verification, legal acknowledgements, or profile parsing review.
- Never save or expose passwords.
- Reconcile parsed resume fields against the approved PDF before submission.
- Verify each required profile section, legal acknowledgement, and parsed file
  attachment at the final review step. Stop for unknown legal or demographic
  answers.
- Record every account/login blocker and retained handoff state.

## Evidence

For each attempt record:

- attempted timestamp;
- browser surface;
- final URL;
- status;
- submitted non-secret answers and acknowledgements;
- exact confirmation phrase or number;
- screenshot path;
- blocker or unresolved question;
- manifest hash verification result.
- updated `data/application-tracker.json` entry fields for status, submitted
  answers, evidence, blocker, and next action.
