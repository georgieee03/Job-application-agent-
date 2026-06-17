# Skill: UI Latency Normalization

Use this skill when job-application progress is blocked by UI-layer friction such as:

- Cloudflare
- Turnstile
- reCAPTCHA
- hCaptcha
- cookie banners
- consent overlays
- "Verify you are human" interstitials
- challenge-driven rerenders that make refs stale

The goal is to restore a clean, trustworthy browser baseline before resuming the real application flow.

## Trigger Conditions

Use this skill when:

- the page is gated by a verification or challenge step
- a consent or cookie wall blocks the controls you need
- clicks or typing land on a challenge widget instead of the form
- refs become stale because the page keeps rerendering around a challenge

Do not use this as a substitute for real blockers like an actual authorization denial or an MFA step you do not own.

## Fast Principles

- Keep the same actor tab and same browser session whenever possible.
- Preserve the current live challenge instance instead of rebuilding the page.
- Solve inside the challenge that is already on screen.
- Reuse the same tab after the blocker clears so cookies and route state remain trustworthy.
- Treat normalization as complete only after route, actor, and blocked control are re-verified.

## Workflow

1. Confirm this is UI friction, not a genuine app-side denial.
2. Identify the obstacle type:
   - challenge page
   - checkbox challenge
   - image grid
   - cookie banner
   - consent modal
3. Interact directly with the blocker in the current live session.
4. Avoid random click churn or full-page restarts.
5. After success, refresh refs and re-baseline immediately.
6. Resume the original application flow only after the baseline is stable.

## hCaptcha Fast Path

When hCaptcha is the blocker:

1. Stay on the same live tab.
2. Prefer the inner checkbox control when available.
3. If an image board appears, capture it before clicking tiles.
4. Read the exact prompt and click only matching tiles.
5. If the board advances, keep solving in place.
6. Re-check route, actor, and blocked control after success.

## Output Expectations

- outcome
- confidence
- blocker if unresolved
- next action
- whether the baseline was restored
- whether evidence or submission work is now safe to continue
