# Tailoring And Approval Workflow

## Required Analysis

Return these items for each job:

1. High-value keyword and requirement list
2. Missing or weakly represented keyword list
3. Truthfulness classification for each gap
4. Tailored professional summary
5. Revised technical-skills emphasis
6. Revised project and experience bullets
7. Final tailored resume package
8. Items requiring manual verification

## ATS Heuristic

Use exact and normalized phrase coverage as one local signal. Include responsibilities, qualifications, domain terminology, tools, and role-specific nouns in the keyword set.

- Report raw keyword coverage.
- Report an estimated ATS alignment capped at 95 to avoid false precision.
- Require the raw result to support an estimated alignment of at least 89.
- Never set a minimum score programmatically or claim employer ATS access.
- Penalize unsupported claims, unexplained keyword stuffing, missing required sections, poor extraction, and unreadable density.
- Prefer natural repetition across summary, skills, projects, and experience over a keyword dump.

## Manual Verification

Ask only for facts that cannot be verified from the resume, job listing, application profile, or prior confirmed answers. Typical examples:

- exact years or proficiency ratings
- willingness to meet unusual travel or onsite requirements
- security clearance or citizenship restrictions
- employer-specific sponsorship wording
- salary when the posting supplies no usable range
- application-specific essays

Do not guess. Keep uncertain applications separate from packages ready for approval.

## User Approval Checklist

Present this checklist with each package:

- [ ] I reviewed every page of `George_Jobi_Resume.pdf`.
- [ ] The resume preserves my existing education, projects, experience, dates, and verified metrics.
- [ ] The emphasized tools and skills are truthful.
- [ ] Degrees, project titles, job title/company lines, and skill-category labels are bold.
- [ ] The formatting matches the approved reference and contains no sparse, clipped, overlapping, or missing content.
- [ ] The resume is one or two pages and the filename is correct.
- [ ] I reviewed `George_Jobi_CoverLetter.pdf`, if included.
- [ ] I approve these exact files for this company and position.

Do not interpret a general batch approval as approval for a package that was edited afterward.
