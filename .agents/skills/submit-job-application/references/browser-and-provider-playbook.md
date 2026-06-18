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

## Greenhouse

- Re-inspect generated question IDs on every role.
- Distinguish current work authorization from future sponsorship.
- A first submit may trigger an emailed 8-character security code.
- Keep the form alive while waiting. Select the newest email with the exact
  subject/employer; grouped email previews can show a stale code.
- Enter the code once, submit once, capture the confirmation page, and delete
  any temporary code file.

## Ashby

- Resume inputs commonly use `_systemfield_resume`; verify live IDs.
- Required long-answer fields must match the approved response hashes.
- "Possible spam" or reCAPTCHA states may clear in the user's logged-in Chrome
  profile. Re-baseline after switching surfaces.
- Do not count a disabled button, spinner, or cleared form as confirmation.

## Lever

- Inspect labels and file inputs live.
- Preserve exact approved filenames and verify retained upload state.
- Capture the explicit thank-you page or confirmation message.

## Workday And Account-Based ATS

- Prefer a proven tenant flow. New tenants may require account creation,
  email verification, legal acknowledgements, or profile parsing review.
- Never save or expose passwords.
- Reconcile parsed resume fields against the approved PDF before submission.
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
- application report path under `data/application-reports/`;
- tracker/report Git sync commit, when pushed.
