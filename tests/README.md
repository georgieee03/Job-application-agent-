# Test Gates

These tests are the readiness contract for the workbench and automation code.

## Local Gate

Run the same gate before pushing:

```bash
npm run ci
```

That command runs:

- `npm run check` for TypeScript validation
- `npm run check:python` for Python helper syntax checks
- `npm test` for Node, server, repository, style, and rendered UI tests

## Rendered UI Coverage

`tests/workbench-ui.test.ts` launches the local workbench in Chromium and checks:

- desktop and mobile dashboard, settings, empty tracker, and populated tracker views
- every Settings step with dense saved configuration
- every visible Settings step control for accessible names and mobile touch-target sizing
- mobile listing filters, tracker filters, and clear-filter states
- duplicate dashboard listing action clicks so each in-flight visit save opens at most one external page
- dashboard listing action busy states staying attached to the original role when results refresh mid-save
- hostile long listing content so provider, title, company, location, employment type, and reason text cannot create horizontal overflow
- Tracker export link behavior so the rendered UI starts an `applied-jobs.xls` workbook download
- onboarding focus behavior, in-app error recovery, live-region cleanup, busy states, accessible names, touch targets, tab keyboard navigation, and reduced-motion behavior

Keep new UI polish covered by rendered tests whenever the behavior depends on layout, focus, browser APIs, or visible state.

## Repository Gates

`tests/repository-gates.test.ts` checks the package scripts, local GitHub Actions workflow contract, remote workflow helper scripts, documentation branding rules, and Georgie handle convention.

When docs mention Georgie, tag the handle as `@georgieee`.

## Remote CI Check

Run this after pushing:

```bash
npm run check:remote-ci
```

It verifies the regular `github.com` repo has an active `.github/workflows/ci.yml` on `geo-track` and that the workflow runs `npm run ci`. Publishing that workflow requires a GitHub token with the `workflow` scope.
