# Skill: Workday API Apply

Use this skill when a Workday tenant's authenticated application flow is already known and the goal is to submit through API calls instead of browser clicking.

## Workflow

1. Reuse an existing tenant helper if available.
2. Keep the helper tenant-specific until multiple roles succeed.
3. Validate after identity writes and after attachments.
4. Treat finalize errors as real failures.
5. Log request and response pairs for safe patching.

## Practical Rules

- Always write name, address, and phone explicitly.
- Always validate before finalize.
- Keep questionnaire IDs and disclosure payloads tenant-specific.
- Reuse only current live-session cookies and CSRF data.
- Do not claim success until finalize succeeds and the application appears in candidate history.

## Output Expectations

- submitted role
- helper used or patched
- whether resume attachment was included
- where logs were written
- whether the tenant flow is now reusable
