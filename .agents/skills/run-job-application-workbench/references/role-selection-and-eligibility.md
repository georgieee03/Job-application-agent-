# Role Selection And Eligibility

## Candidate Search Contract

- Search within the United States.
- Prefer robotics software, autonomy, perception, navigation, controls,
  automation, robotics integration, manufacturing test, embedded robotics,
  simulation, and robot systems.
- Use general software roles only as fallback.
- Current authorization: eligible for US work through OPT/STEM OPT.
- Current sponsorship required: no.
- Future H-1B or other sponsorship required: yes.
- Willing to relocate anywhere in the US.
- Earliest start: two weeks.

## Provider Coverage

- Before selecting roles, run the configured source mix: search aggregators
  such as Jooble and Adzuna, direct employer boards such as Greenhouse, Lever,
  Workday, SmartRecruiters, Workable, iCIMS, Oracle, Taleo, and Ashby, and any
  visible Lensa-style email or aggregator leads the user asked to include.
- Record the provider-coverage summary in the workbench tracker: configured
  sources, completed sources, fetched listings, zero-result sources, and
  errors.
- Treat aggregator results as discovery leads. Resolve each promising lead to
  the authoritative employer listing or ATS page before tailoring, uploading,
  or submitting.
- Build a mixed shortlist when compatible roles exist across providers. Do not
  allow one provider, especially Ashby because it is easier to automate, to
  fill the whole run unless the tracker records why the other checked sources
  were unavailable, duplicate, incompatible, stale, blocked, or lower ranked.
- Do not skip a compatible Greenhouse role merely because it may require the
  normal emailed security-code step. Use the Greenhouse OTP flow from the
  submission playbook when the role otherwise passes the gates.

## Hard Skip Signals

Skip or ask before proceeding when a role:

- requires US citizenship, permanent residency, or a clearance the candidate
  does not have;
- explicitly refuses current OPT or all future sponsorship;
- requires an unsupported license, degree, domain credential, or seniority;
- is outside the US or no longer open;
- duplicates a role already submitted;
- is marked `workflowExcluded=true` in `data/application-tracker.json`, unless
  the role was rediscovered naturally as a strong current match and a fast
  live reapply check records `reapplyAllowed=true` and proves there is no
  employer, ATS, duplicate, cooldown, account, or application-history
  restriction;
- requires a factual or legal answer absent from
  `data/candidate-application-answers.md`.

## Reapply Eligibility

Rejected, incomplete, pending, blocked, skipped, or archived roles stay visible
in the tracker but are excluded from ordinary discovery to avoid wasted time.
Do not proactively recheck them. They can be considered again only when normal
sourcing rediscovered the role naturally as a strong current match and the
workflow can quickly prove all of the following:

- the authoritative current listing is open;
- the employer/ATS does not show "already applied," duplicate-submission,
  cooldown, account-history, or withdrawal-only restrictions;
- the previous blocker was stale or fixable and is not still present;
- George still passes the current eligibility and sponsorship wording;
- the tracker records `reapplyAllowed=true`, `reapplyCheckedAt`, and a concise
  `reapplyRationale` before tailoring or submitting.

If any check is ambiguous, requires a long login/account reset, lands in a
CAPTCHA-only loop, or reveals a restriction, set `reapplyAllowed=false`, record
`reapplyRestriction`, keep `workflowExcluded=true`, and move to a fresh role.

Do not infer export-control nationality, citizenship, disability, veteran
publications, advisor, salary number, travel commitment, or other unrecorded
answers. Gender and veteran status are recorded in
`data/candidate-application-answers.md` and may be reused according to the
employer's exact wording.

## Ranking

Rank shortlisted roles by:

1. hard eligibility;
2. robotics/domain relevance;
3. evidence strength in current projects and experience;
4. attainable truthful ATS alignment;
5. new-grad/intern/early-career seniority fit;
6. application friction and closing risk.
