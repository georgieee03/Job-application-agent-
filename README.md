# Job Application Agent Kit

A private-ready repository for running a careful job-application workflow with:

- a Playwright-based Handshake apply assistant
- a job discovery workbench for public boards and aggregators
- a browser-backed application tracker with applied-job status export
- a resume-tailoring workspace for job-specific prompt generation
- reusable LLM prompts for application agents
- portable skill docs for tracker management and Workday workflows
- safe templates for profile answers and application tracking
- helper scripts for Ashby, public board discovery, and text-to-PDF resume generation

This private handoff is set up to preserve the workbench tracker and historical
application artifacts while keeping high-risk local auth state out of git.
Runtime browser profiles, mailbox credentials, tokens, and `.env` values should
be restored locally from `LOCAL_SECRETS_MANIFEST.md`, not committed.

## Collaboration Notes

- The active polish branch is `geo-track`.
- When referencing Georgie's work in GitHub or docs, tag the GitHub handle as `@georgieee`.
- Repository authorship and commits should still use `bmendonca3`.

## What Is Included

### Automation

- `src/handshake.ts`: authenticate once, revisit a saved Handshake session, iterate postings, fill common fields, and stop before final submit by default
- `src/jobs/*`: pull, normalize, filter, rank, and alert on roles from:
  - `Adzuna`
  - `Jooble`
  - `Greenhouse`
  - `Lever`
  - `Ashby`
  - `Workable`
  - `Workday` public CXS careers feeds
  - `SmartRecruiters`
  - `Recruitee`
  - `Personio` public XML feeds
  - `BambooHR` public careers lists
  - `iCIMS` Jibe and classic public career pages
  - `Oracle Candidate Experience`
  - `Taleo`
- `ui/`: lightweight local workbench for configuring sources, filters, ranking, alerts, schedule settings, dashboard review, and tracker follow-up
- `src/workbench-server.ts`: local API server for search results, tracker persistence, applied-job status updates, client-safe error responses, and Excel-compatible applied-job export
- [`ui/README.md`](ui/README.md): workbench behavior, validation, and security notes
- [`scripts/README.md`](scripts/README.md): helper-script usage and smoke-test coverage
- [`tests/README.md`](tests/README.md): local gate, rendered UI coverage, and remote CI verification notes
- Jooble results are treated as discovery listings because Jooble returns aggregator redirect URLs. Paid lead sources such as JobLeads are filtered out, and direct `Apply` links are reserved for sources that expose a real application URL.

### Tracker And Resume Tailoring

- The workbench now includes a `Tracker` tab for jobs opened from search results.
- The `Dashboard` tab supports live listing search, source-health breakdowns, stable paged result browsing, score/newest/company/title sorting, and a new-only filter before you open or track a role.
- Clicking `Open listing` or `Apply` records the role in `data/application-tracker.json`.
- The tracker supports live search and status filters across saved jobs so follow-up work can be narrowed quickly.
- Each tracked job supports applied/not-applied state, status values for rejected/interview/accepted outcomes, visit counts, and removal.
- Applied jobs are exported to `data/applied-jobs.xls` and can be downloaded from `/api/tracker/export` with date applied, company, title, status, and job URL columns.
- The tracker includes a local resume source field and per-job tailoring notes, job description overrides, AI prompt previews, copy-to-clipboard support, and a saved tailored draft area.

### Prompts

- [`docs/prompts/job-automation-agent-prompt.md`](docs/prompts/job-automation-agent-prompt.md): full operating prompt for an LLM agent
- [`docs/prompts/job-application-agent-handoff.md`](docs/prompts/job-application-agent-handoff.md): condensed workflow and guardrails document

### Skills

- [`docs/skills/job-application-tracker.md`](docs/skills/job-application-tracker.md)
- [`docs/skills/workday-application-orchestrator.md`](docs/skills/workday-application-orchestrator.md)
- [`docs/skills/workday-job-discovery.md`](docs/skills/workday-job-discovery.md)
- [`docs/skills/workday-api-apply.md`](docs/skills/workday-api-apply.md)
- [`docs/skills/workday-live-flow-capture.md`](docs/skills/workday-live-flow-capture.md)
- [`docs/skills/ui-latency-normalization.md`](docs/skills/ui-latency-normalization.md)

### Claude Code Handoff

- [`CLAUDE.md`](CLAUDE.md): Claude Code operating instructions, including
  autonomous goal-mode behavior and subagent model routing.
- [`.claude/agents/`](.claude/agents/): Claude Code subagent definitions for
  Haiku, Sonnet, and Opus task delegation by intensity.
- [`MACOS_CLAUDE_CODE_SETUP.md`](MACOS_CLAUDE_CODE_SETUP.md): Mac setup guide
  for cloning this private repo, installing dependencies, restoring local-only
  secrets, and running the workbench.
- [`LOCAL_SECRETS_MANIFEST.md`](LOCAL_SECRETS_MANIFEST.md): checklist of files
  and credentials that should be restored locally rather than committed.

### Templates

- [`application-profile.example.json`](application-profile.example.json): default truthful answers for repeated forms
- [`job-sources.example.json`](job-sources.example.json): public board and aggregator search config
- [`templates/application_tracker.template.md`](templates/application_tracker.template.md): duplicate-safe tracker template

### Helper Scripts

- [`scripts/ashby_api_apply.py`](scripts/ashby_api_apply.py): public Ashby form inspection and submission helper
- [`scripts/job_board_fetch.sh`](scripts/job_board_fetch.sh): quick public board fetcher for Greenhouse, Lever, and Ashby
- [`scripts/text_resume_to_pdf.py`](scripts/text_resume_to_pdf.py): simple text-to-PDF resume renderer

The Python helpers use the packages listed in [`requirements.txt`](requirements.txt).

## Direct Employer Job Sources

The workbench favors public, read-only company career feeds. It does not create candidates, submit applications, use private candidate/admin APIs, or require credentials for company-board sources.

| Provider | Example source | Public endpoint shape | Notes |
| --- | --- | --- | --- |
| Greenhouse | `ramp` | `GET https://boards-api.greenhouse.io/v1/boards/{board}/jobs?content=true` | Existing provider; board token comes from the careers URL. |
| Lever | `vercel` | `GET https://api.lever.co/v0/postings/{site}?mode=json` | Existing provider; optional team/location filters. |
| Ashby | `openai` | `GET https://api.ashbyhq.com/posting-api/job-board/{board}?includeCompensation=true` | Existing provider; public board name comes from `jobs.ashbyhq.com/{board}`. |
| Workable | `company` | public account/widget job endpoints | Existing provider; tries public account endpoints before failing. |
| Workday | `intel.wd1.myworkdayjobs.com/intel/External` | `POST https://{host}/wday/cxs/{tenant}/{board}/jobs` | Use a full `myworkdayjobs.com` URL or `host/tenant/board`. Detail calls use `/wday/cxs/{tenant}/{board}/job/{job-path}` only when descriptions are requested. |
| SmartRecruiters | `smartrecruiters` | `GET https://api.smartrecruiters.com/v1/companies/{company}/postings` | Uses bounded pagination and posting detail calls for canonical apply URLs. |
| Recruitee | `bunq` | `GET https://{company}.recruitee.com/api/offers/` | Public offers feed usually includes listing and apply URLs plus optional descriptions. |
| Personio | `personio.jobs.personio.de` | `GET https://{account}.jobs.personio.com/xml?language=en` | Parses the public XML feed; `.de` hosts are supported too. |
| BambooHR | `zapier` | `GET https://{company}.bamboohr.com/careers/list` | Public JSON list; some tenants are empty, Cloudflare-protected, or custom-domain only. |
| iCIMS Jibe | `careers.example.icims.com` | `GET https://{host}/api/jobs` | Modern public JSON layer when a tenant exposes Jibe-style careers search. |
| iCIMS Classic | `careers-example.icims.com` | `GET https://{host}/jobs/search?...&in_iframe=1` | Parses public HTML job cards; detail pages prefer `JobPosting` JSON-LD, then HTML fallback. The official `api.icims.com/customers/...` API is auth-gated and is not used. |
| Oracle CE | `eeho.fa.us2.oraclecloud.com/jobsearch` | site lookup, requisition search, finder detail | Uses public Candidate Experience endpoints. Detail defaults to `recruitingCEJobRequisitionDetails?...finder=ById;Id="...",siteNumber=...`. |
| Taleo | `unifirst.taleo.net/unf_external` | `POST /careersection/rest/jobboard/searchjobs?lang=en&portal={section}` | Builds stable detail URLs as `/careersection/{section}/jobdetail.ftl?lang=en&job={contestNo}`. |

Example board entries:

```json
[
  { "provider": "greenhouse", "source": "ramp", "includeDescription": false },
  { "provider": "lever", "source": "vercel", "includeDescription": false },
  { "provider": "ashby", "source": "openai", "companyName": "OpenAI", "includeDescription": false },
  { "provider": "workable", "source": "company", "includeDescription": false },
  {
    "provider": "workday",
    "source": "intel.wd1.myworkdayjobs.com/intel/External",
    "companyName": "Intel",
    "searchText": "software",
    "limit": 20,
    "maxPages": 1,
    "includeDescription": false
  },
  {
    "provider": "smartrecruiters",
    "source": "smartrecruiters",
    "limit": 20,
    "maxPages": 1,
    "includeDescription": false
  },
  { "provider": "recruitee", "source": "bunq", "includeDescription": false },
  { "provider": "personio", "source": "personio.jobs.personio.de", "language": "en", "includeDescription": false },
  { "provider": "bamboohr", "source": "zapier", "includeDescription": false },
  { "provider": "icims-jibe", "source": "careers.example.icims.com", "limit": 25, "includeDescription": false },
  { "provider": "icims-classic", "source": "careers-example.icims.com", "keyword": "software", "includeDescription": false },
  { "provider": "oracle-ce", "source": "eeho.fa.us2.oraclecloud.com/jobsearch", "keyword": "software", "limit": 25, "includeDescription": false },
  { "provider": "taleo", "source": "unifirst.taleo.net/unf_external", "keyword": "software", "lang": "en", "includeDescription": false }
]
```

Quick Setup can detect common public source URLs such as `jobs.ashbyhq.com/openai`, `jobs.lever.co/vercel`, `job-boards.greenhouse.io/ramp`, `careers.smartrecruiters.com/SmartRecruiters`, `*.myworkdayjobs.com`, `*.recruitee.com`, `*.jobs.personio.*`, `*.bamboohr.com`, `*.icims.com`, Oracle Candidate Experience URLs, and `*.taleo.net/careersection/...`.

Company-board entries can include an optional `companyName` display label. Use it when a public board returns only a slug, host, or tenant name.

There is no known public Workday directory endpoint that enumerates every tenant. For broad Workday coverage, collect public `myworkdayjobs.com` careers or CXS URLs from company career pages, search results, or curated lists, then normalize and validate them:

```bash
cat workday-urls.txt | node scripts/workday_source_probe.mjs --validate
```

Known-valid Workday source examples include `intel.wd1.myworkdayjobs.com/intel/External`, `avav.wd1.myworkdayjobs.com/avav/AVAV`, `ngc.wd1.myworkdayjobs.com/ngc/Northrop_Grumman_External_Site`, `blueorigin.wd5.myworkdayjobs.com/blueorigin/BlueOrigin`, `kla.wd1.myworkdayjobs.com/kla/Search`, and `uhaul.wd1.myworkdayjobs.com/uhaul/UhaulJobs`.

Researched but not implemented yet: Jobvite, Teamtailor, Comeet, Breezy HR, JazzHR, Pinpoint, Dayforce/Ceridian, UKG/UltiPro, SAP SuccessFactors, Paycom/Paylocity, Zoho Recruit, Rippling, HiringThing, CareerPlug, Freshteam, Gem, Dover, Kula, Homerun, and Join.com. The blocker is that their public surfaces are more tenant-specific, widget-specific, credentialed, or inconsistent enough to need source-specific adapters and more fixtures before they can be reliable defaults.

## Setup

```bash
npm install
npx playwright install chromium
python3 -m pip install -r requirements.txt
cp .env.example .env
cp application-profile.example.json application-profile.json
cp job-sources.example.json job-sources.json
cp templates/application_tracker.template.md application_tracker.md
```

Then edit:

- `.env`
- `application-profile.json`
- `job-sources.json`
- `application_tracker.md`

## Commands

Authenticate and save a reusable Handshake session:

```bash
npm run auth
```

Run the Handshake apply helper:

```bash
npm run apply
```

Run the listings pipeline:

```bash
npm run search
```

Launch the local workbench UI:

```bash
npm run ui
```

The workbench serves the UI at `http://localhost:4321` by default. Use the `Dashboard` tab to search, sort, and review search results. Use the `Tracker` tab for visited jobs, application status, filtered follow-up, applied-job export, and resume-tailoring prompts.

Type-check the project:

```bash
npm run check
```

Run the focused workbench tests:

```bash
npm test
```

Run the full local CI gate:

```bash
npm run ci
```

The local CI gate currently runs TypeScript checks, Python helper smoke checks, and rendered workbench tests. The intended GitHub Actions workflow is in `.github/workflows/ci.yml`; it should run the same gate on `main`, `geo-track`, and pull requests once workflow-file publishing is available.

After publishing the workflow, verify the remote Actions gate:

```bash
npm run check:remote-ci
```

When authenticated with a credential that includes `workflow` scope, publish the workflow with:

```bash
npm run publish:ci-workflow
```

Use [`docs/validation-checklist.md`](docs/validation-checklist.md) before treating UI or tracker changes as ready for daily use.
Use [`docs/ci-workflow-publishing.md`](docs/ci-workflow-publishing.md) when publishing or verifying the GitHub Actions workflow.

## Recommended Workflow

1. Start with public-board discovery using `job-sources.json`, `npm run search`, and the UI.
2. Use `application_tracker.md` before touching any role.
3. Pick the best existing resume before tailoring anything.
4. Use the prompt docs when delegating work to another automation tool or collaborator.
5. Keep final submission conservative. The Handshake flow pauses for review unless you explicitly enable auto-submit.

## Privacy And Safety

The repo ignores live local state by default:

- `.env`
- `application-profile.json`
- `job-sources.json`
- `application_tracker.md`
- `data/`

That keeps credentials, auth state, tracker history, and application answers out of version control while still preserving the reusable code and templates.

## Notes

- The Handshake flow is intentionally conservative and may need selector tuning over time.
- External application redirects are skipped in the first-pass Handshake automation.
- Ashby submission can still require browser-backed final submit on stricter boards.
- Workday job discovery uses public CXS careers feeds only; application submission remains outside this listing pipeline.
- UI challenge handling is documented explicitly so cookie walls, CAPTCHA flows, and consent overlays can be normalized without corrupting the live application state.
- The default example search config is designed to work immediately against a public Greenhouse board without requiring paid aggregator API keys.
