---
name: tailor-job-resume
description: Tailor George Jobi Perangattu's resume and optional cover letter for a specific US robotics, autonomy, controls, automation, PLC, perception, navigation, integration, manufacturing-test, or software role. Use when researching a compatible job, analyzing its description, producing a truthful ATS-aligned application package, preserving the established one-to-two-page styling and verified content, validating PDF formatting and keyword coverage, presenting exact files for approval, or handing approved files to browser automation for submission.
---

# Tailor Job Resume

Create a truthful, job-specific application package while preserving the candidate's verified background and established resume design.

## Load Context

1. Read [references/candidate-and-formatting.md](references/candidate-and-formatting.md).
2. Read [references/tailoring-and-approval.md](references/tailoring-and-approval.md).
3. Read [references/application-integration.md](references/application-integration.md) when the request includes searching, applying, uploading, or submitting.
4. Read `data/candidate-application-answers.md` for durable user-confirmed application answers. Treat it as the source of truth for repeated form questions and append newly confirmed answers there.
5. Inspect the complete job description from the employer's current listing. Prefer the employer's current career page or ATS. If the description is incomplete, stale, or from an aggregator, retrieve the authoritative listing before tailoring.
6. Use these resume references:
   - `F:\Resume tracker\George_Jobi_Resume_generalrobotics.pdf` for the original content and layout.
   - `F:\Resume tracker\George_Jobi_Resume_Kforce.pdf` for the approved optimized styling and bold hierarchy.
7. Prefer the workspace's preserved-layout generators over generic text-to-PDF rendering:
   - `scripts/build_preserved_resume_packages.py`
   - `scripts/build_next_ten_resume_packages.py`
   - `scripts/render_original_style_resume.py`

## Tailor

1. Extract the role's high-value responsibilities, required qualifications, preferred qualifications, domain nouns, tools, and exact ATS phrases.
2. Classify every term as:
   - verified and already strong;
   - verified but weakly represented;
   - adjacent experience that must be qualified;
   - unsupported and prohibited.
3. Produce a keyword-gap analysis before editing.
4. Rewrite the professional summary, technical-skill emphasis, and project or experience bullets to foreground verified evidence relevant to the role.
5. Preserve all existing verified education, projects, employment, dates, organizations, metrics, and substantive content. Reorder or rephrase for emphasis, but do not remove an existing item without explicit user approval.
6. Never invent or inflate employers, dates, degrees, tools, years of experience, metrics, outcomes, publications, clearances, citizenship, visa status, production ownership, PLC depth, or sponsorship status.
7. Describe limited or upcoming experience honestly with terms such as `fundamentals`, `concepts`, `coursework`, `in progress`, or `upcoming` where applicable.
8. Target an estimated ATS alignment of 89-95. Treat it as a transparent local heuristic, never as a guarantee from an employer's ATS and never force a low result upward.
9. If truthful alignment remains below 89, report the gap and ask for evidence or user guidance instead of adding unsupported claims.
10. Do not add immigration, salary, EEO, favorite-fruit, or application-form answers to the resume or cover letter unless they are relevant and the user explicitly requests them.
11. Do not keyword-stuff. Increase ATS alignment by naturally distributing
   truthful terms across summary, skills, projects, and experience while
   preserving verified content and readability.

## Render

1. Output the resume as `George_Jobi_Resume.pdf`.
2. When a cover letter, motivation statement, why-company response, or cover
   note is requested or materially useful, invoke `tailor-job-cover-letter`.
   Output an uploaded PDF as `George_Jobi_CoverLetter.pdf`.
3. Keep the resume between one and two full pages; prefer two pages when needed to preserve established content.
4. Preserve the approved section order, compact spacing, black text, horizontal section rules, Letter page size, and Carlito-like typography.
5. Bold section headings, both degree names, every project heading, each job title plus company, and each technical-skill category label.
6. Do not produce a sparse or half-empty page. Adjust spacing and wording without deleting verified content.
7. Keep the uploaded filenames exact even when role-specific source files use internal names:
   - `George_Jobi_Resume.pdf`
   - `George_Jobi_CoverLetter.pdf`
8. No page break may leave a section heading, project title, job title, degree
   line, or other content anchor separated from the body it introduces.
9. Keep the PDF ATS-readable: extractable text only, no image-only resume
   pages, no icons, no tables, no text boxes, no form widgets, no annotations,
   no overlapping text, and no decorative objects except the established
   horizontal section rules.

## Validate

1. Create a UTF-8 keyword file with one job keyword or phrase per line.
2. Run:

```powershell
python .agents\skills\tailor-job-resume\scripts\validate_resume.py `
  --pdf "<role-folder>\George_Jobi_Resume.pdf" `
  --keywords "<role-folder>\ats-keywords.txt" `
  --reference "F:\Resume tracker\George_Jobi_Resume_Kforce.pdf"
```

3. Fix every failed structural check.
4. Render every PDF page to PNG and visually inspect it.
5. Compare page one against the approved reference. Verify hierarchy, margins, rules, font appearance, density, wrapping, clipping, and absence of overlap.
6. Extract PDF text and confirm that all expected sections and verified content survived rendering.
7. Treat any validator failure in filename, page size, page count, page fill,
   ATS-readable extraction, image/text-box/widget/annotation checks,
   overlapping text, orphan page-break checks, missing bold anchors, missing
   verified content, or keyword coverage as blocking.
8. Generate an approval manifest:

```powershell
python .agents\skills\tailor-job-resume\scripts\build_package_manifest.py `
  --company "<company>" `
  --role "<role>" `
  --job-url "<authoritative URL>" `
  --resume "<role-folder>\George_Jobi_Resume.pdf" `
  --cover-letter "<role-folder>\George_Jobi_CoverLetter.pdf" `
  --validation "<role-folder>\validation-report.json" `
  --out "<role-folder>\approval-manifest.json"
```

Omit `--cover-letter` when the package does not include one.

## Approval Gate

Before any submission:

1. Show the user every resume page and cover-letter page being sent.
2. Provide the keyword-gap analysis, changes made, validation report, and manual-verification items.
3. Present the checklist from [references/tailoring-and-approval.md](references/tailoring-and-approval.md).
4. Wait for explicit approval of that application package.
5. After approval, submit exactly the approved files. If the files change, repeat the preview and approval gate.
6. Verify the current file hashes still match `approval-manifest.json` immediately before upload.
7. Count an application as fully verified only after immediate provider evidence
   plus a confirmation email, employer/ATS portal record, or provider/API
   acceptance record is captured.

Use `$ui-latency-normalization` if browser friction interrupts the later application workflow.
