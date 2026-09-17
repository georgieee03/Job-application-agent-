# Validation Checklist

Use this checklist before treating the workbench as ready for daily use.

## Automated Gates

- Run `npm run check`.
- Run `npm run check:python`.
- Run `npm test`.
- Run `npm run ci`.
- Confirm the static app shell has unique IDs and valid label/ARIA references.
- Launch `npm run ui` and verify the local URL prints successfully.

## UI Normalization

- Header, tabs, cards, forms, onboarding, dashboard, tracker, and settings use the same radius, spacing, color tokens, and button styling.
- Buttons use text plus accessible SVG icons where an icon helps recognition.
- Decorative backgrounds, emoji-only signals, and one-off visual treatments do not carry workflow meaning.
- Empty, loading, configured, applied, rejected, interview, and accepted states are visually distinct without relying only on color.

## Responsive Visual QA

- Desktop viewport: `1440 x 950`.
- Mobile viewport: `390 x 844`.
- Confirm there is no horizontal page overflow.
- Confirm hostile long provider, title, company, location, employment type, and reason text wraps inside dashboard and tracker cards on mobile.
- Confirm the rendered smoke test covers dashboard, settings, empty tracker, and populated tracker states on both desktop and mobile.
- Confirm dashboard listing search, sort, new-only filtering, and empty filtered states stay usable on mobile.
- Confirm dashboard and tracker filter controls can be cleared from filtered empty states without mobile overflow.
- Confirm malformed provider dates render fallback copy instead of `Invalid Date` and do not break newest sorting.
- Confirm Run Search exposes a busy state and does not queue duplicate runs on rapid clicks.
- Confirm overlapping manual Run Search requests return a client-safe conflict instead of a server failure.
- Confirm failed Run Search requests show an in-app alert and restore the button to a usable state.
- Confirm post-search status refresh failures keep successful search results visible.
- Confirm failed Save requests show an in-app alert and restore the button to a usable state.
- Confirm Settings numeric fields that allow zero persist zero instead of reverting to prior values.
- Confirm Settings bounded numeric fields clamp to the supported schema range before save.
- Confirm Settings invalid timezone names fall back before save and are rejected by the config API.
- Confirm Settings quiet hours use time inputs and invalid quiet-hour values are omitted before save.
- Confirm Settings webhook fields use URL inputs and unsupported URL schemes are omitted before save.
- Confirm Settings webhook fields omit localhost, link-local, private, and reserved IP hosts before save.
- Confirm Settings source, board, and alert removals use inline confirmation instead of immediate destructive removal.
- Confirm Settings step changes and tracker filter clears cancel pending destructive confirmations.
- Confirm Run Search preserves save failures and does not start the search when config saving fails.
- Confirm Settings provider allow-lists drop unknown provider tokens before save.
- Confirm config list settings are trimmed and deduplicated by the API before save.
- Confirm failed startup API requests show an in-app alert instead of a blocking browser dialog.
- Confirm startup API failures leave shell navigation usable so the alert state is recoverable.
- Confirm startup API failures do not let Save or Run Search send malformed config mutations before config loads.
- Confirm startup API failures do not open the setup wizard before configuration has loaded.
- Confirm failed background refresh requests show an in-app alert without page errors or layout overflow.
- Confirm recoverable in-app status alerts can be dismissed without layout overflow.
- Confirm dismissed in-app status alerts clear stale live-region role and `aria-live` attributes.
- Confirm onboarding final save failures show a dialog-local alert without closing the dialog or causing page errors.
- Confirm cleared onboarding dialog alerts remove stale live-region role and `aria-live` attributes.
- Confirm closing onboarding after a dialog-local alert clears stale live-region role and `aria-live` attributes.
- Confirm Escape and skip actions cannot close onboarding while the final save is in progress.
- Confirm onboarding final launch exposes a busy state and does not queue duplicate saves on rapid clicks.
- Confirm unsupported browser notifications show an in-app alert instead of a blocking browser dialog.
- Confirm browser notification permission states preserve the header button icon and label treatment.
- Confirm browser notification dispatch failures do not turn successful searches into failed searches.
- Confirm alert webhook delivery failures do not turn successful searches into failed searches.
- Confirm multiple alert webhooks are delivered concurrently so one slow endpoint does not delay the rest.
- Confirm failed tracker updates show an in-app alert and restore rendered tracker state.
- Confirm tracker applied, status, and remove controls expose busy state and do not queue duplicate in-flight mutations.
- Confirm tracker removal uses inline confirmation instead of a blocking browser dialog.
- Confirm tracker filter changes clear any pending remove confirmation before the row can be hidden or narrowed.
- Confirm removing a tracker job cancels any pending resume autosave for that job.
- Confirm failed resume source local-storage writes show an in-app alert.
- Confirm failed resume auto-save requests show both an inline save status and an in-app alert.
- Confirm resume source, notes, draft, and job-description text inputs clamp before browser storage or autosave.
- Confirm overlapping resume edits for the same tracked job save in order without stale autosave payloads overtaking newer edits.
- Confirm failed resume prompt copy attempts show an in-app alert and restore the copy button label.
- Confirm Dashboard, Tracker, and Settings tabs expose selected state, hide inactive panels, and support arrow/Home/End keyboard navigation.
- Confirm Dashboard empty-state shortcuts move focus into the newly visible view instead of leaving focus in a hidden panel.
- Confirm inline remove confirmations receive focus after replacing a Remove button.
- Confirm onboarding dots and Settings step navigation expose the current step with `aria-current="step"`.
- Confirm onboarding custom toggles expose a visible focus ring and a 40px touch target.
- Confirm visible mobile interactive controls expose at least a 40px touch target.
- Confirm the Tracker empty state stacks cleanly on mobile.
- Confirm populated tracker cards, resume tailoring fields, and status controls do not clip or overlap.
- Confirm Settings step navigation is usable on mobile and desktop.
- Confirm every Settings step renders dense saved configuration without desktop or mobile overflow.
- Confirm every visible Settings step control has an accessible name and keeps a usable mobile touch target.
- Keep rendered smoke checks asserting active view and tracker-list bounds, not only document-level overflow.

## Accessibility

- Onboarding opens with focus inside the dialog, traps tab focus, closes with Escape, and returns focus to the opener.
- Onboarding makes the background app inert and hidden from assistive tech while the dialog is open.
- Closed onboarding is hidden and inert so invisible dialog controls cannot receive keyboard focus.
- All interactive controls are keyboard reachable and have visible focus.
- Rendered onboarding, dashboard, tracker, and settings controls must have accessible names.
- Read-only textareas and generated prompt previews must have programmatic labels, not only visible sibling text.
- Decorative SVGs must be hidden from assistive tech unless intentionally exposed as named images.
- Rendered UI motion is reduced when `prefers-reduced-motion: reduce` is active.
- Text contrast remains readable for muted labels, helper text, buttons, links, and status pills.
- Keep the automated style contrast gate covering core text, buttons, links, and status colors.
- Links that open external job pages only use safe HTTP(S) destinations.
- Links that open external job pages in a new tab include `noopener noreferrer`.
- Unsafe external listing or apply URLs do not render clickable job actions.

## Tracker And Export

- Opening or applying to a listing creates exactly one tracker entry for that listing.
- Concurrent tracker visits do not overwrite each other.
- Opening a filtered dashboard listing still tracks the correct source result, including matches outside the initial visible slice.
- Dashboard listing actions block duplicate in-flight tracker visits and only open the external page after the visit save succeeds.
- Dashboard listing action busy state stays scoped to the original listing if results refresh before the visit save completes.
- Failed tracker refreshes after opening or applying do not mislabel the saved visit as a save failure.
- Repeated visits increment visit counts without losing applied status or resume notes.
- Legacy tracker records with missing or malformed fields render with stable defaults.
- Search and status filters narrow tracked jobs without hiding the export control or creating mobile overflow.
- Applied state writes `data/applied-jobs.xls`.
- Applied workbook writes use durable atomic replacement and do not leave temp files behind.
- `/api/tracker/export` refreshes and downloads the same formula-safe applied-jobs workbook.
- The rendered Tracker export link starts an `applied-jobs.xls` workbook download without console errors or mobile overflow.
- Workbook downloads include non-cacheable `nosniff` response headers.
- Workbook cells escape XML and protect values beginning with `=`, `+`, `-`, or `@`.
- Invalid JSON, invalid content types, invalid config, and non-HTTP listing URLs return client errors without crashing the server.
- Empty JSON POST bodies are rejected without resetting saved config or tracker data.
- Corrupt tracker and config files surface errors instead of silently becoming empty/default state.
- Corrupt tracker and config files at startup do not prevent the workbench server from launching or overwrite the corrupt files.
- Corrupt previous search output surfaces an error instead of treating every listing as new or overwriting the file.
- Corrupt latest search output surfaces an API error instead of rendering as an empty dashboard state.
- Search output writes use atomic temp-file replacement and do not leave temp files behind after successful runs.
- Tracker mutations reject invalid applied/status/resume payloads instead of coercing them into state changes.
- Tracker resume text updates are clamped before persistence to avoid oversized local state files.
- Tracker and config writes use serialized, atomic writes to reduce lost updates and partial-file risk.
- JSON state, config, search output, and tracker writes fsync temp files, atomically replace targets, and clean temp files after failed replacement attempts.
- Handshake run-state files treat only missing files as empty and use atomic writes without leaving temp files behind.
- Unsupported webhook URL schemes are rejected by the config API.
- Webhook URLs pointing to localhost, link-local, private, or reserved IP hosts are rejected by the config API.
- Provider failure messages and server logs redact credential query parameters such as API keys and tokens.
- Unknown `/api/*` routes return non-cacheable JSON 404 responses instead of the HTML shell.
- Known API routes reject unsupported HTTP methods with non-cacheable JSON 405 responses and `Allow` headers.
- Cross-origin mutating `/api/*` requests are rejected while same-origin workbench requests still succeed.
- Missing static assets return non-cacheable 404 responses while extensionless app routes keep the HTML fallback.
- Successful static assets and HTML app-shell fallbacks include non-cacheable `nosniff` headers.
- API, static asset, workbook, and app-shell responses include a restrictive Content Security Policy.
- The local workbench binds to `127.0.0.1` by default unless `WORKBENCH_HOST` is explicitly set.
