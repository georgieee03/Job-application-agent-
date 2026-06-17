# Helper Scripts

This directory contains small command-line helpers for public job-board discovery, Ashby form inspection/replay, and text resume rendering.

## Scripts

- `ashby_api_apply.py`: inspect public Ashby job forms and replay public GraphQL form operations for mapping or dry runs.
- `job_board_fetch.sh`: fetch public Greenhouse, Lever, or Ashby board data from a shell.
- `workday_source_probe.mjs`: normalize pasted Workday careers/CXS URLs into `job-sources.json` board entries, with optional limit-1 public feed validation.
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

`npm run ci` also runs this gate before the rendered workbench tests.

## Safety Notes

- Keep credentials in `.env` or local runtime state, not in committed scripts.
- Treat API replay helpers as mapping and review tools unless you have explicitly opted into a real submission flow.
- The PDF renderer escapes resume text before passing it to ReportLab paragraphs, so characters such as `&` and `<` are handled safely.

## Collaboration

The active polish branch is `geo-track`. When referencing Georgie's work in GitHub or docs, use `@georgieee`.
