# Public repository setup and migration handoff

Repository: [Job-application-agent-](https://github.com/georgieee03/Job-application-agent-)

Owner: @georgieee03

This public distribution replaces the previous repository tree with the useful
current application code, workflow skills, tests, and documentation from the
local job-application workbench. It includes the detailed
[workflow, target jobs, and resume-format handoff](job-application-workflow-handoff.md).
The replacement is a normal commit; earlier history is retained.

## Included

- TypeScript discovery providers, workbench server, dashboard, and tracker UI.
- Current application workflow, tailoring, submission, and verification skills.
- PDF renderers, validators, manifest tools, tracker maintenance, and provider helpers.
- Tests and dependency manifests, including the PDF/image Python dependencies.
- Detailed workflow analysis, job-target profile, resume-format specification,
  known implementation gaps, and next-session instructions.
- Empty tracker, candidate-answer, application-profile, and role-configuration examples.

## Kept local

The public tree contains no live application tracker, personal answer document,
actual resume/cover-letter packages, submission screenshots, email findings,
browser profiles, credentials, caches, virtual environments, dependencies,
temporary scripts, or stale run ledgers. These remain in the original local
workspace. Do not mistake the empty example tracker for the user's application
history; restore the real tracker locally before resuming applications.

The historical analysis contains aggregate counts and references to local
artifacts. They document the inspected source workspace, not files supplied by
this checkout. Exact PDF filenames and named format/content anchors are kept
because they are part of the requested workflow specification.

## Fresh laptop setup

```powershell
git clone https://github.com/georgieee03/Job-application-agent-.git
Set-Location Job-application-agent-
npm ci
npx playwright install chromium
python -m pip install -r requirements.txt
Copy-Item .env.example .env
Copy-Item job-sources.example.json job-sources.json
Copy-Item application-profile.example.json application-profile.json
New-Item -ItemType Directory -Force data
Copy-Item templates/candidate-application-answers.example.md data/candidate-application-answers.md
```

For a new, empty installation only:

```powershell
Copy-Item templates/application-tracker.example.json data/application-tracker.json
```

For continuation of the existing search, restore the actual tracker and its
referenced packages/evidence from private storage instead of creating an empty
tracker. Do not overwrite a populated tracker with the example. Restore the
canonical answers privately and check time-sensitive facts. The public profile
example deliberately supplies no work-authorization or sponsorship defaults.

Add any provider keys to the ignored `.env` file. Do not commit secrets. Use the
configured public board example for discovery when aggregator keys are absent.
Start the review application with `npm run ui`, then open
`http://localhost:4321/tracker`. Opening the UI does not start an application run.

On systems where the interpreter is named `python` rather than `python3`, run
Python helper commands directly with that interpreter; the existing npm helper
scripts use `python3`.

## Resume references and older personalized helpers

The resume contract uses the original robotics PDF for verified content and
the approved Kforce PDF for styling, as documented in the main handoff. Those
PDFs are not public assets. Restore them locally and update machine-specific
paths such as `F:\Resume tracker` before use. Install Carlito or inspect/reapprove
the documented fallback typography. Render and visually verify every final page.

Some preserved helper scripts were written for particular historical runs and
contain example candidate wording, dates, skill emphasis, role-specific field
mappings, and old configuration paths. Contact literals have been replaced with
fictional placeholders, but the scripts are not universally configured
application engines. Read and personalize them before use; examples do not
establish any candidate fact or submission permission.

The following helpers now fail immediately unless the local operator sets
`JOB_APPLICATION_REVIEWED_LOCAL_HELPERS=true` after reviewing and configuring
their candidate facts, paths, target roles, required inputs, and authorization:

- `scripts/build_current_goal_packages.py`
- `scripts/render_original_style_resume.py`
- `scripts/update_current_goal_tracker.py`
- `scripts/submit_greenhouse_batch.mjs`
- `scripts/submit_lever_batch.mjs`
- `scripts/greenhouse_code_submit_worker.mjs`
- `scripts/greenhouse_repl_helpers.mjs`

This switch is an example-use safeguard, not an approval manifest or permission
to submit. All live eligibility, exact-file approval, required-field, and
two-signal verification rules still apply. Do not copy historical dates or
answers into a new application without verification.

The generic Ashby and Handshake tools retain their own documented configuration
and action requirements. `npm run apply` is the older Handshake helper; the
master agent workflow is described in the skills rather than implemented by
that single CLI command.

## Removed from the current tree

- The obsolete compatibility document removed in the source workspace.
- Old parallel-agent configuration, source-specific local setup notes, and
  deleted legacy scripts absent from the current source.
- Actual application records and generated artifacts previously present in
  the destination repository.

Removing files in this commit does not purge earlier Git history. Prior public
personal files can remain accessible in historical commits. This migration
does not change repository visibility or rewrite history.

## Validation and remaining work

Run `npm run check`, `npm run check:python`, and `npm test` after installation.
The migration preserves the current workflow rather than claiming to fix all
the gaps in the main handoff. In particular, evidence enforcement, ambiguous
email matching, broad exclusion, and approval-policy drift still need the
documented follow-up work.
