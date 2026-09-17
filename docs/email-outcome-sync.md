# Email Outcome Sync

Use this when reconciling Gmail with `data/application-tracker.json`.

## Read-Only Mailbox Pass

Search Gmail for all available application outcomes before role discovery and after
submissions. Use message summaries first, then read only shortlisted messages
whose sender, company, subject, or body clearly relates to a tracked
application.

Useful Gmail queries:

```text
(unfortunately OR "not moving forward" OR "not selected" OR "other candidates" OR "no longer under consideration")
("thank you for applying" OR "application received" OR "we received your application" OR "thanks for applying")
(interview OR "phone screen" OR "schedule a call" OR "next step")
```

Do not store raw mailbox exports, passwords, cookies, one-time codes, or full
private message bodies in the tracker. Store only bounded metadata and short
snippets needed to prove the outcome.

## Sync File

Normalize shortlisted Gmail findings into `data/email-application-outcomes.json`:

```json
[
  {
    "company": "Example Robotics",
    "title": "Robotics Engineer",
    "outcome": "rejected",
    "subject": "Update on your application",
    "from": "recruiting@example.com",
    "date": "2026-08-06T18:00:00Z",
    "snippet": "Unfortunately, we will not be moving forward...",
    "message_id": "gmail-message-id",
    "thread_id": "gmail-thread-id"
  }
]
```

Then run:

```bash
npm run tracker:sync-email
npm run tracker:audit:fix
```

Rejected roles are marked `rejected`, kept visible in the workbench tracker,
set to `workflowExcluded=true`, and retained for duplicate prevention and
manual review. `workflowExcluded=true` means "skip during ordinary discovery,"
not "never apply again." Do not proactively recheck old rejected roles. Reapply
only when normal sourcing rediscovers the role naturally as a strong current
match and a fast live check proves the listing is open and no employer, ATS,
duplicate, cooldown, account, or application-history restriction blocks another
submission. If the check is ambiguous or time-consuming, keep the role excluded
and move on.
Confirmation emails can move
`submitted - pending email verification` roles to
`submitted - email verified` only when the tracker match is clear.
