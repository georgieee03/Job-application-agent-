# Workbench UI

The workbench UI is the local browser surface for configuring job sources, running searches, reviewing ranked listings, tracking follow-up, and tailoring resumes.

## Main Views

- `Dashboard`: review source-health totals and ranked search results, browse large result sets in stable pages, filter by text, sort by score/newest/company/title, show new-only listings, and track listing or apply clicks.
- `Tracker`: review saved jobs, filter follow-up by text or status, export applied jobs, and manage per-job resume tailoring prompts.
- `Settings`: configure search APIs, import careers URLs into company boards, set optional board display names, filters, ranking, alert rules, and scheduling.

## Validation Expectations

Run the full local gate before treating UI changes as ready:

```bash
npm run ci
```

The rendered smoke tests cover desktop and mobile dashboard, settings, empty tracker, and populated tracker states. They also check mobile overflow, console/page errors, accessible names, touch targets, tab behavior, recoverable alerts, inline remove confirmations, and resume-tailoring failure states.

## Security And Privacy Notes

- External job links are rendered only for safe HTTP(S) URLs and use `noopener noreferrer`.
- Mutating local API requests are protected by same-origin checks on the server.
- Webhook fields accept only public HTTP(S) destinations; unsupported schemes and private/local hosts are omitted before save and rejected by the API.
- Responses include non-cacheable security headers and a restrictive Content Security Policy.
- Resume source text is stored only in browser local storage.

## Collaboration

Keep workbench state local in `data/application-tracker.json` and run
`npm run ci` before treating UI changes as ready.
