# Skill: Workday Live Flow Capture

Use this skill when a Workday application flow is not yet mapped or behaves differently from an existing helper.

## Workflow

1. Reuse a logged-in browser session on the target Workday flow.
2. Start from a clean draft when possible.
3. Capture the sequence around:
   - application creation
   - source
   - previous worker
   - name
   - address
   - phone
   - attachment upload
   - resume attach
   - questionnaire
   - disclosures
   - package validate
   - finalize
4. Save request and response artifacts locally.
5. Normalize the flow into a deterministic sequence.
6. Patch or build an API helper only after the exact request shapes are known.

## Common Hidden Blockers

- fields that look filled in the UI but still require explicit saves
- required validation before finalize
- two-step attachment flows
- role-specific questionnaire IDs
- tenant-specific disclosure steps

## Output Expectations

- exact endpoint sequence
- which fields were actually required
- what changed from prior assumptions
- where the logs were saved
- whether the flow is now ready for API apply
