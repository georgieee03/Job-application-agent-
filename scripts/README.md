# Helper Scripts

This directory contains small command-line helpers for public job-board discovery, direct ATS source checks, Ashby form inspection/replay, and text resume rendering.

## Scripts

- `ashby_api_apply.py`: inspect public Ashby job forms and replay public GraphQL form operations for mapping or dry runs.
- `job_board_fetch.sh`: fetch public Greenhouse, Lever, or Ashby board data from a shell.
- Search discovery in the main app also supports configured aggregators such as Jooble and Adzuna. Treat aggregator results as leads and resolve promising roles to the official employer ATS before applying.
- `workday_source_probe.mjs`: normalize pasted Workday careers/CXS URLs into `job-sources.json` board entries, with optional limit-1 public feed validation.
- `audit_application_tracker.py`: audit `data/application-tracker.json`, normalize legacy workflow statuses with `--fix`, require evidence on verified submissions, and mark incomplete/rejected/pending roles as excluded from ordinary future runs.
- `migrate_application_report_evidence.py`: copy historical evidence from `data/application-reports/*.md` into the single tracker so older verified applications can pass the current audit contract.
- `archive_incomplete_applications.py`: move package artifacts for incomplete tracker entries into `Incomplete Application` and rewrite the affected tracker paths.
- `sync_email_application_outcomes.py`: apply read-only Gmail outcome findings, such as rejection and confirmation messages, to the tracker so rejected roles remain duplicate-prevention records.
- `text_resume_to_pdf.py`: render a plain-text resume into a compact PDF using ReportLab.
- `check_python_helpers.py`: compile Python helpers, syntax-check shell helpers, and smoke-test text-to-PDF rendering.

## Setup

Install Python dependencies before using the Python helpers:

```bash
python3 -m pip install -r requirements.txt
```

## Validation

Run the helper smoke gate directly:

```bash
npm run check:python
```

Normalize and validate a batch of public Workday careers URLs:

```bash
cat workday-urls.txt | node scripts/workday_source_probe.mjs --validate
```

Audit and normalize the tracker before a new application run:

```bash
npm run tracker:audit:fix
```

Move incomplete package artifacts out of the active workspace:

```bash
npm run tracker:archive-incomplete
```

Migrate legacy report evidence into the single tracker:

```bash
npm run tracker:migrate-report-evidence
```

After using the Gmail connector to create `data/email-application-outcomes.json`
from read-only rejection or confirmation findings, sync those outcomes:

```bash
npm run tracker:sync-email
```

`npm run ci` also runs this gate before the rendered workbench tests.

## Safety Notes

- Keep credentials in `.env` or local runtime state, not in committed scripts.
- Treat API replay helpers as mapping and review tools unless you have explicitly opted into a real submission flow.
- The PDF renderer escapes resume text before passing it to ReportLab paragraphs, so characters such as `&` and `<` are handled safely.

## Collaboration

Keep helper output local unless the active workflow records a referenced
artifact path in `data/application-tracker.json`.
