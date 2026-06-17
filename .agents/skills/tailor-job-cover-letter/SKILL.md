---
name: tailor-job-cover-letter
description: Create, tailor, render, validate, preview, and approval-bind George Jobi Perangattu's truthful job-specific cover letter or short application cover note. Use when a US robotics, autonomy, controls, automation, PLC, perception, navigation, integration, manufacturing-test, or software application requires or benefits materially from a cover letter, motivation statement, why-company response, brief cover note, or supporting-letter PDF.
---

# Tailor Job Cover Letter

Create a concise, evidence-based letter that complements the approved resume
without repeating it or introducing unsupported claims.

## Load Context

1. Read the target employer's current job description and live application form.
2. Read `data/candidate-application-answers.md`.
3. Read the current role's approved resume, keyword analysis, validation report,
   and `approval-manifest.json`.
4. Read the shared candidate contract in
   `../tailor-job-resume/references/candidate-and-formatting.md`.
5. Read [references/decision-and-content.md](references/decision-and-content.md).

## Decide Whether To Include One

Choose one primary output:

- **Required or requested text field:** draft an exact text response.
- **Required PDF/file upload:** create `George_Jobi_CoverLetter.pdf`.
- **Optional PDF with no cover-letter prompt:** leave it empty unless a distinct
  letter resolves a material fit question that the resume and required fields
  cannot address, or the user explicitly asks for it.

When a form has both a required motivation field and an optional attachment,
default to the required text field only. Create both only when the PDF is
separately required or adds distinct, non-duplicative evidence. Record the
decision and rationale in the package analysis.

Do not attach a generic optional letter merely to fill an optional field.
Record `not needed` in the package analysis when the resume and form already
communicate fit adequately.

## Draft

1. Address the hiring team unless a verified recipient name is available.
2. Name the exact company and role.
3. Open with the strongest verified match, not enthusiasm alone.
4. Use two or three evidence paragraphs grounded in existing resume facts.
5. Connect the evidence to the employer's responsibilities and environment.
6. Close with interest in discussing the role and a professional sign-off.
7. Keep a PDF letter to one page and normally 250-400 words.
8. Respect any form-specific word or character limit.

Never invent employers, dates, degrees, tools, metrics, citizenship,
clearances, sponsorship promises, publications, production ownership, or
project outcomes. Do not claim employer-side ATS access or guaranteed scores.

## Render

For a PDF, write the candidate draft to UTF-8 text and run:

```powershell
python .agents\skills\tailor-job-cover-letter\scripts\render_cover_letter.py `
  --company "<company>" `
  --role "<role>" `
  --body-file "<role-folder>\cover-letter-body.txt" `
  --out "<role-folder>\George_Jobi_CoverLetter.pdf"
```

Use the exact upload filename `George_Jobi_CoverLetter.pdf`. Do not append the
company, role, date, version, or candidate name to the filename.

For a text-only application field, preserve the exact response in a UTF-8
`application-responses.json` file beside the package. Do not create a PDF
unless it will be uploaded.

## Validate

1. Confirm the PDF is exactly one US Letter page.
2. Extract text and verify the candidate, company, role, and expected evidence
   survived rendering.
3. Visually inspect the rendered PNG for clipping, overlap, sparse layout,
   malformed characters, and inconsistent typography.
4. Confirm every factual claim is supported by the approved resume or durable
   answer file.
5. Run the renderer's built-in structural validation and complete every manual
   verification item in its JSON report.
6. Add the letter and its validation report to the package manifest using the
   shared resume skill's `build_package_manifest.py --cover-validation`.
7. Add exact text responses with repeatable `--response` arguments so approval
   is bound to their hashes even though they are not uploaded as files.

## Approval And Submission

1. Show the user every page of the exact PDF and the complete exact text of
   each form response.
2. Summarize why each artifact was included and identify the resume evidence
   used.
3. Obtain explicit approval of the exact current PDF and text responses. A
   separate pre-render draft approval is optional, not required.
4. Repeat approval after any edit, regeneration, or response-text change.
5. Verify every approved SHA-256 still matches `approval-manifest.json`
   immediately before upload or form entry.
6. Upload only `George_Jobi_CoverLetter.pdf`; never upload drafts, previews,
   source text, response records, or validation files.
