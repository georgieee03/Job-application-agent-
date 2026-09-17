# Job application workbench: current workflow and handoff reference

**Analysis date:** September 16, 2026, America/Phoenix (September 17 UTC).

**Workspace:** `D:\job-application-agent-kit`

**Current publication repository:** `georgieee03/Job-application-agent-`

**Owner:** @georgieee03

**Source repository at analysis time:** `georgieee03/job-application-agent-kit`

> Public export note: this is a historical analysis of the private local workspace.
> Live tracker records, candidate answers, resumes, and evidence are intentionally
> omitted from this public checkout. Restore those locally using
> [the setup guide](public-repository-setup.md). The format/job-target sections
> remain available; local-only artifact links do not imply published files.

**Reference task:** [Analyze job application workflow](codex://threads/019fd96c-83ce-7f62-9dcc-e3bd6e6cb62f)

## 1. Purpose, scope, and authority

This document records how the local job-application workflow currently works,
what the earlier reference task changed, what the tracker currently contains,
and where the implementation still falls short of the written rules. It is a
handoff/reference document, not a new application ledger or authorization to
start applying, change candidate facts, or repair the implementation.

The analysis covered all five turns exposed by the reference task, active
workflow instructions, application/server/UI code, relevant helper scripts,
source configuration, the tracker, and the organization and references of
historical artifacts. It did not individually render every historical PDF,
revalidate every historical hash, read private browser profiles or secrets,
or independently reverify every application with an employer. No applications
were submitted and no tracker records were changed during this analysis.

**Publication boundary:** this document describes the local working tree,
including existing uncommitted changes and untracked helper files. Publishing
this document alone does not publish those implementation changes, candidate
files, packages, or the current tracker. A fresh GitHub checkout may therefore
contain older code or lack files referenced here. References below are
repository-relative so they work locally and on GitHub when their targets are
present. The local base commit before this documentation change was `4e905f6`.

Follow current user instructions and applicable project instructions when
operating the workflow. Treat this document as a dated description, not as a
replacement for live state or permission. Where sources disagree, the conflict
is called out rather than silently resolved into a new policy.

## 2. Architecture and responsibility

The system is an **agent-operated application workflow with a local search and
tracking application**. It is not a self-contained background service that
independently discovers, tailors, submits, and verifies applications.

| Layer | Responsibility | Important boundary |
| --- | --- | --- |
| Agent and project instructions | Interpret requests, coordinate skills, make grounded decisions, record transitions | Many gates depend on the agent following instructions |
| Workflow skills | Discovery, eligibility, tailoring, approval, live submission, verification, handoff | Skills are instructions, not a universally enforced runtime state machine |
| TypeScript discovery pipeline | Fetch, normalize, deduplicate, filter, rank, and report provider coverage | Listing deduplication does not replace checking application history |
| Workbench server and UI | Search controls, persistence, visits, applied flag, statuses, notes, export | Clicking Apply or selecting a status does not prove employer acceptance |
| Python and JavaScript helpers | Package building, PDF checks, manifests, provider-specific actions, tracker maintenance | Some helpers are specific to historical runs and must be inspected before reuse |
| Browser and mailbox access | Operate live forms and obtain external evidence | Availability, login state, and provider behavior must be checked each run |
| Local artifacts | Resumes, letters, previews, validation, hashes, screenshots, responses | The tracker must reference their location and meaning |

The main agent owns authoritative tracker updates and final external submission
actions. For multi-role runs, project instructions allow independent research,
analysis, and package work to be delegated. Subagents must not submit, access
OTPs, solve CAPTCHAs, or alter the authoritative tracker. Model names in the
delegation instructions are dated and must be checked against actual runtime
availability rather than assumed callable.

## 3. File and component map

| File or directory | Role |
| --- | --- |
| [AGENTS.md](../AGENTS.md) | Project-level workflow, browser friction, authorization, delegation, and cleanup rules |
| [Master workflow skill](../.agents/skills/run-job-application-workbench/SKILL.md) | End-to-end orchestration and single-command application runs |
| [State machine](../.agents/skills/run-job-application-workbench/references/orchestration-state-machine.md) | Status transitions and required transition evidence |
| [Eligibility reference](../.agents/skills/run-job-application-workbench/references/role-selection-and-eligibility.md) | Role fit, source coverage, hard skips, and reapplication |
| [Resume skill](../.agents/skills/tailor-job-resume/SKILL.md) | Truthful tailoring, styling, validation, preview, and approval |
| [Cover-letter skill](../.agents/skills/tailor-job-cover-letter/SKILL.md) | Role-specific letters and supporting statements |
| [Submission skill](../.agents/skills/submit-job-application/SKILL.md) | Live form operation and immediate/secondary confirmation |
| [Tracker-verification skill](../.agents/skills/verify-job-application-state/SKILL.md) | Persistence, reconciliation, and completion audit |
| [Tracker schema reference](../.agents/skills/verify-job-application-state/references/ledger-schema.md) | Core and workflow extension fields; some naming drift remains |
| `data/application-tracker.json` (restore locally) | Single durable application state and duplicate-prevention record |
| `data/candidate-application-answers.md` | Canonical reusable candidate facts and preferences; local file |
| `application-profile.json` | Legacy compatibility mirror, particularly for Handshake |
| `job-sources.json` | Local searches, boards, filters, ranking, alerts, schedule |
| [src/jobs](../src/jobs) | Discovery providers and listing pipeline |
| [src/workbench-server.ts](../src/workbench-server.ts) | Local API, tracker persistence, status updates, search scheduling, export |
| [ui/app.js](../ui/app.js) | Dashboard, tracker, filters, tailoring prompt workspace, browser synchronization |
| [src/index.ts](../src/index.ts) | CLI entry points for auth, Handshake apply, and discovery |
| [src/handshake.ts](../src/handshake.ts) and [src/state.ts](../src/state.ts) | Older Handshake automation and separate helper run state |
| `data/application-packages/` | Current package artifacts, manifests, validation, evidence |
| `Incomplete Application/` | Archived incomplete package artifacts; tracker retains corresponding roles |
| `data/application-reports/` and older dated directories | Historical artifacts and evidence sources; not new-run tracking authorities |

Do not create a new dated batch ledger, Markdown tracker mirror, or per-role
report as the authoritative state for a new run. Separate evidence artifacts
are allowed; record their paths on the tracker entry. This reference file is
documentation, not a competing tracker.

## 4. Decisions preserved from the reference task

The reference task first analyzed the older batch-ledger workflow and then
implemented local hardening. Its final reported snapshot was 178 tracked
roles, 59 with verified statuses, three rejections, and 119 excluded roles.
Those are historical figures, not today's tracker totals.

The user's subsequent decisions established these durable preferences:

1. Search **all available mailbox history**, rather than only a recent window,
   when reconciling application outcomes.
2. Keep rejected roles visible in the UI with status `rejected`.
3. `workflowExcluded=true` means skip during ordinary discovery. It is not a
   permanent prohibition on reapplying.
4. Reconsider old excluded roles only when normal sourcing **naturally
   rediscovers** a strong current match. Do not proactively grind through old
   rejected or unfinished roles.
5. Perform only a quick reapplication check; move on when restrictions or
   ambiguity would consume disproportionate time.
6. Consult and search the canonical candidate-answer document before asking
   repeated personal/application questions.
7. The canonical document records the user's confirmed gender and veteran
   answers. Use those recorded answers according to each form's wording,
   rather than older decline-to-answer defaults.

Implemented local changes include preserving workflow fields on revisits,
normalizing legacy statuses, tracker maintenance helpers, email outcome sync,
historical evidence migration, stronger PDF checks, and incomplete-package
archiving. The earlier task reported moving 33 package directories and
migrating evidence from 69 legacy reports. The current inventory still finds
33 package directories under the incomplete archive.

## 5. End-to-end operation for an application request

For a request such as “apply to 15 robotics positions relevant to my resume,”
the intended result is **15 unique, authoritatively confirmed applications**,
not 15 attempts, opened tabs, prepared packages, or success-page clicks.

### 5.1 Establish the request and resume context

- Extract the requested target and scope from the current user instruction.
- Read the canonical answers and tracker before opening new roles.
- Distinguish a new target from continuing an existing run. Do not satisfy a
  new application request by counting unrelated historical verified entries.
- Preserve existing approvals and exact continuation steps where applicable.
- Record standing authorization and run context on affected tracker entries.
- Do not ask the user to choose a provider, name a batch, start a server, or
  restate already-confirmed profile information.

### 5.2 Audit state and reconcile outcomes

The operating instructions call for `audit_application_tracker.py --fix`
before discovery. This is a mutating operation: it normalizes aliases and
marks pending/incomplete/rejected states excluded. Its broad treatment of
active states is a known issue described later in this document.

When authorized mailbox access is available, search all available history for
application confirmations, rejections, interviews, and follow-ups. Read
shortlisted messages sufficient to establish a clear role match. Store only
bounded metadata and short evidence snippets, not raw mailbox exports.

### 5.3 Discover and screen roles

- Search US roles, prioritizing robotics software, autonomy, perception,
  navigation, controls, automation, integration, simulation, robot systems,
  and manufacturing test. Use general software as a fallback.
- Check provider coverage rather than filling the run from the easiest ATS.
- Record configured/completed sources, fetched listings, zero results, and
  errors in the relevant tracker context.
- Resolve aggregator leads to official employer/ATS listings before tailoring.
- Verify the role remains open and check exact sponsorship, citizenship,
  clearance, location, seniority, and other eligibility language.
- Check the tracker for duplicates and excluded roles before selecting one.
- Use recorded current authorization and future sponsorship answers precisely;
  do not collapse them into a misleading blanket “no sponsorship” response.
- Do not infer absent legal, immigration, or candidate facts.

#### 5.3.1 What kinds of jobs this kit targets

This is a **robotics-first US job search for George Jobi Perangattu**, grounded
in his verified robotics projects, computer-science background, and software
experience. It is not an unrestricted application campaign to every engineering
job that contains a matching keyword. The categories and example titles below
describe sourcing targets, not current open vacancies or a claim that George
qualifies for every role with that title.

| Priority / job family | Example search titles | Relevant evidence to check |
| --- | --- | --- |
| Primary: robotics software and robot systems | Robotics Software Engineer, Robot Software Engineer, Robotics Systems Engineer | Verified Python/C++ work, ROS/ROS 2, Linux, simulation, software interfaces, debugging |
| Primary: autonomy, navigation, and motion planning | Autonomy Engineer, Navigation Engineer, Motion Planning Engineer | RRT planning, ROS/Gazebo integration, trajectory evaluation, localization and navigation projects |
| Primary: perception and sensor fusion | Robotics Perception Engineer, Computer Vision Engineer for robotics, Sensor Fusion Engineer | Camera-LiDAR fusion, Efficient TransFuser, PyTorch, CARLA, BEV perception, evaluation and diagnostics |
| Primary: controls and autonomous systems | Robotics Controls Engineer, Control Systems Engineer, Autonomous Systems Engineer | MiniDrone PID control, state estimation, physical-hardware testing, current verified aerial-manipulation work |
| Primary: robotics integration and deployment | Robotics Integration Engineer, Robotics Application Engineer, Robot Deployment Engineer | System integration, interfaces, debugging, simulation-to-hardware comparison, testing and documentation |
| Primary: simulation, verification, and test | Robotics Simulation Engineer, Robotics Software Test Engineer, Robotics Validation Engineer | Gazebo/CARLA and other confirmed simulation work, repeatable experiments, metrics, regression and validation |
| Related: automation and manufacturing test | Automation Engineer, Manufacturing Test Engineer, Robotics Test Engineer | Transferable software/control/test evidence; explicitly check industrial experience and hardware requirements |
| Related: embedded robotics and hardware/software integration | Embedded Robotics Software Engineer, Hardware-in-the-Loop Test Engineer | Confirmed platform/protocol knowledge and software interfacing; distinguish fundamentals from production embedded experience |
| Conditional: industrial controls / PLC | Entry-Level Controls Engineer, PLC/Automation Engineer | Only when verified depth meets the posting; do not manufacture PLC, commissioning, or industrial ownership experience |
| Fallback: general software | Software Engineer, Backend Engineer, Full Stack Engineer | Verified software internships, backend systems, data pipelines, testing, and supported performance improvements |

General software is a fallback when the robotics pipeline does not provide
enough compatible, currently open positions. Prefer robotics-adjacent software
when it offers strong factual alignment. Do not replace this priority order
with whichever provider is easiest to automate.

#### 5.3.2 Career level, geography, and work arrangement

- Prioritize **new-graduate and early-career** roles that match the verified
  evidence. Internships are also within the search scope when the posting's
  enrollment, graduation-window, duration, and availability requirements are
  actually satisfied.
- Evaluate requirements rather than title alone. An Engineer II role may or
  may not fit; hard seniority, management, specialist-depth, or years-of-
  experience requirements must not be ignored to reach an application target.
- Search **within the United States**. Recorded preferences allow relocation
  anywhere in the US and compatible on-site work; this is not a remote-only
  search. Check each role's location, commute, relocation, and work-mode terms.
- Use the canonical answer document for current authorization, future
  sponsorship, start availability, and mobility. The recorded contract
  distinguishes current OPT/STEM OPT-related authorization from a future
  sponsorship requirement; it does not authorize claims of unrestricted
  permanent work eligibility.
- Skip roles with incompatible explicit citizenship, permanent-residency,
  clearance, sponsorship, credential, or location requirements. Ambiguous
  legal or immigration wording requires careful review rather than inference.
- Do not assume willingness to relocate establishes willingness to meet every
  travel percentage, shift pattern, field-service schedule, or unusual on-site
  commitment. Search recorded answers and ask only for genuinely absent facts.
- Reconfirm time-sensitive education status before using it to establish
  internship eligibility. The historical expected graduation date alone is
  insufficient to establish present enrollment or degree completion.

#### 5.3.3 How to choose among eligible roles

The written ranking order is: **hard eligibility first**, then robotics/domain
relevance, strength of existing project/work evidence, attainable truthful ATS
alignment, career-level fit, and application friction/closing risk. A role
should remain a strong match without invented experience. A keyword score
cannot override an eligibility blocker or unsupported specialist requirement.

Search titles should vary across companies and providers, while the candidate
facts remain consistent. Aggregators are lead sources; official listings
establish requirements. Existing applications and excluded roles are checked
against the tracker before tailoring. The reapplication exception in section
7 applies even when a rediscovered role is an excellent technical match.

### 5.4 Create and validate the package

Use the resume skill to extract required/preferred qualifications, build a
keyword-gap analysis, and classify requirements as verified, weakly expressed,
adjacent/qualified, or unsupported. Rephrase and reorder truthful evidence;
do not invent skills, years, credentials, metrics, or production experience.

Preserve verified education, projects, employment, dates, and substantive
content, as well as the approved layout. The resume is one to two pages,
with extractable text, readable hierarchy, required bold anchors, and no
orphan headings, overlapping text, or image-only pages.

The local style/content reference PDFs are:

- `F:\Resume tracker\George_Jobi_Resume_generalrobotics.pdf`
- `F:\Resume tracker\George_Jobi_Resume_Kforce.pdf`

Both existed during this inspection. They are local dependencies, not files
published by this handoff.

Use exact upload names `George_Jobi_Resume.pdf` and
`George_Jobi_CoverLetter.pdf`. Do not append company, date, or version suffixes.
Generate a role-specific letter according to the applicable user preference;
there is a recorded conflict between the canonical answer document and
generic optional-letter guidance, detailed in section 11.

Run structural/keyword validation, render and inspect every page, compare
styling visually, and create a manifest binding the exact PDFs and included
response files to SHA-256 hashes. Preserve the job description, keyword list,
gap analysis, previews, validation reports, and manifest in the package.

#### 5.4.1 Which resume is the source of truth?

The workflow uses the candidate's existing robotics resume and an approved
optimized version of that resume. It does not start from a generic visual
template, a Europass document, or a newly invented resume layout.

| Reference | Purpose in tailoring |
| --- | --- |
| `F:\Resume tracker\George_Jobi_Resume_generalrobotics.pdf` | Original robotics resume: baseline verified content and original layout |
| `F:\Resume tracker\George_Jobi_Resume_Kforce.pdf` | Approved optimized styling and bold hierarchy; the current package builder and validation command point to this reference |
| `data/candidate-application-answers.md` | Confirmed application facts and later user updates; consult before reusing time-sensitive resume/profile statements |
| Role-specific `George_Jobi_Resume.pdf` | Final tailored output for one employer/role, not a new universal factual authority |

Preserve the verified record represented by both reference resumes. Do not
assume every historical tailored variant is an equally authoritative source
of new candidate facts. The Kforce filename identifies the approved styling
reference; it does not mean every future application is for Kforce or should
copy Kforce-specific wording.

The PDFs remain local at the paths above. This Markdown file contains a
portable format specification and structural outline, **not the original
PDFs or a pixel-identical editable template**. They were not uploaded as part
of this documentation update. A new machine needs those source PDFs, or a
separately reviewed replacement reference, to perform the prescribed visual
comparison. Merely cloning the repository does not supply the `F:` drive.

#### 5.4.2 Resume type, structure, and visual treatment

The format is a compact, single-column, text-based technical resume with
skills and robotics projects emphasized before employment history. Its
existing content order is preserved; it is not automatically reordered into
a generic reverse-chronological employment-first template.

| Element | Required format |
| --- | --- |
| Output | Text-extractable PDF named exactly `George_Jobi_Resume.pdf` |
| Page size | US Letter, 8.5 x 11 inches, 612 x 792 points |
| Length | One or two full pages; prefer two when needed to preserve the established content |
| Column structure | One continuous column with a straightforward reading order |
| Header | Candidate name and contact information centered at the top of the first page; part of document body, not a repeating page header |
| Body alignment | Left aligned |
| Font family | Carlito regular, bold, and italic when available |
| Color | Black text on white; existing rules use near-black `#111111` |
| Section headings | Uppercase and bold, followed by a thin horizontal rule |
| Degree lines | Both degree names bold |
| Project entries | Every project title bold; institution/course context italic where the approved reference uses it |
| Work entries | Job title and company bold together; location/context italic where appropriate |
| Skill entries | Category label before the colon bold, followed by ordinary text |
| Bullets | Compact text bullets with hanging indentation and readable line spacing |
| Prohibited additions | Columns, layout tables, icons, decorative graphics, text boxes, repeating headers/footers, PDF widgets, annotations, or image-only pages |

The ordered skeleton used by the current package builder is:

```text
                    CANDIDATE NAME
            Contact information and professional link

PROFESSIONAL SUMMARY
------------------------------------------------------------
Truthful role-specific summary and relevant engineering focus.

EDUCATION
------------------------------------------------------------
Bold degree name and date
Italic institution and location

TECHNICAL SKILLS
------------------------------------------------------------
Bold category label: verified relevant technologies and skills

PROJECT EXPERIENCE
------------------------------------------------------------
Bold project title and date
Italic institution/course context
  - Verified implementation, result, or responsibility

[Page break between complete project entries when needed]

PROJECT EXPERIENCE (CONTINUED)
------------------------------------------------------------
Remaining complete project entries

WORK EXPERIENCE
------------------------------------------------------------
Bold job title - company and dates
Italic location
  - Verified contribution and result
```

#### 5.4.3 Concrete settings in the current renderer

The values below come from the inspected local
`scripts/build_current_goal_packages.py`, particularly `styles()`,
`section()`, and `build_resume()`. They describe this renderer's current
defaults, **not measurements of the reference PDF and not immutable rules
for every future package**. The final page appearance still needs review.
All font sizes and leading values are in points; leading is line spacing.

| Setting/style | Font size | Leading | Additional detail |
| --- | ---: | ---: | --- |
| Name | 13.2 | 14.2 | Bold, centered |
| Contact | 8.2 | 9.2 | Regular, centered |
| Section heading | 8.9 | 9.6 | Bold, uppercase |
| Summary/body | 8.0 | 9.2 | Regular, left aligned |
| Compact entry text | 7.8 | 8.8 | Used for first-page entry details |
| First-page bullets | 7.75 | 8.9 | Left indent 8 pt; first-line indent -6 pt |
| Second-page entry text | 8.8 | 10.5 | `compact2` style |
| Second-page bullets | 8.55 | 10.6 | Left indent 8 pt; first-line indent -6 pt |
| Italic style | 7.8 | 8.8 | Inline italic markup also inherits its paragraph's size |

- Margins: left/right **0.42 inches**, top **0.28 inches**, bottom
  **0.30 inches**.
- Section rule: full available width, **0.65 pt** thickness, near-black.
- The current builder explicitly breaks after the MiniDrone entry and begins
  page two with `PROJECT EXPERIENCE (CONTINUED)` before the remaining projects
  and work experience. This is a current implementation choice, not proof that
  every differently tailored package will fit without adjustment.
- Carlito font files are loaded from `C:\Windows\Fonts`. The implementation
  falls back to Helvetica/Helvetica-Bold/Helvetica-Oblique when the required
  Carlito files are unavailable. A fallback can change wrapping and appearance;
  do not silently describe it as an exact match to the approved typography.
- The older `scripts/render_original_style_resume.py` has different numerical
  defaults, such as 0.32/0.34-inch top/bottom margins and a 13.5-point name.
  Its presence does not establish conformance to every newer bold/rule/layout
  requirement. Prefer the approved reference and current validation contract
  over assuming all generators produce identical output.

#### 5.4.4 What tailoring changes and what stays intact

Tailoring changes the professional summary, truthful skill emphasis, and
wording/order of project or experience evidence to match the specific role.
It must not discard established items merely to fit keywords or inflate
fundamentals/coursework into professional production experience.

The formatting contract names these preserved content anchors:

- Efficient TransFuser
- Parrot MiniDrone
- 3D Motion Planning
- Spider CAD Robot
- Complementarity-Free Dexterous Manipulation with TacDrones
- Backend Developer Intern - DigiClips Media
- Full Stack Developer Intern - Odoo
- Full Stack Developer Intern - TicketDex

Preserve confirmed degrees, dates, organizations, and supported metrics from
the verified sources. Reconcile time-sensitive facts with current confirmed
answers before rendering; the current builder itself contains dated student
and graduation wording, so rerunning it unchanged is not a factual refresh.

Pagination must keep headings and their associated content together. A
two-page resume is permitted; an orphaned heading, detached degree line, or
split entry that loses its context is not. Use deliberate breaks between
complete entries and adjust spacing/wording while preserving content. The
validator's orphan-heading detection is not a guarantee that every semantic
content block stays together: inspect both pages manually, including the last
entry on page one and first entry on page two.

Before upload, inspect every rendered page at a readable size; check compact
text readability, wrapping, margins, density, bold/italic hierarchy, rules,
and page breaks against the Kforce styling reference. Confirm extractable
reading order and all preserved content, then validate and bind the exact
PDF and responses to the approval manifest. A high keyword score cannot
compensate for unsupported claims or unreadable layout.

Detailed source rules are in the
[candidate and formatting contract](../.agents/skills/tailor-job-resume/references/candidate-and-formatting.md)
and [tailoring and approval reference](../.agents/skills/tailor-job-resume/references/tailoring-and-approval.md).

### 5.5 Apply the approval gate

The master skill permits standing authorization in single-command mode for
packages that pass deterministic gates. Interactive tailoring instructions
require showing every page and checklist and waiting for explicit package
approval. These rules have not been fully reconciled across all skill files.

For any actual run, determine applicable authorization from the user's
instructions and governing rules, record its scope, and bind it to exact
artifacts. A package manifest establishes hashes; its existence alone does
not prove user approval. Changes to approved files or responses invalidate
the old binding. Verify hashes again immediately before upload.

### 5.6 Operate the form

- Inspect the live form, not only old selector mappings.
- Confirm employer, role, route, signed-in actor, and current form step.
- Search canonical answers by exact wording and semantic equivalent before
  asking the user for a missing answer.
- Inventory required fields, grouped controls, custom questions, attachments,
  acknowledgements, and validation errors.
- Verify selected values and upload persistence after interactions.
- Record all non-secret submitted answers and required acknowledgements.
- Submit once and wait for the result rather than repeating clicks.
- If validation fails, capture the exact error and make at most one targeted
  retry for that step after resolving known fields. Persist a blocker or
  review-needed state if the same failure remains.

### 5.7 Handle browser friction and user input

CAPTCHA, Turnstile, Cloudflare, login interstitials, consent overlays, blocked
modals, and unstable loading must route through the applicable
`ui-latency-normalization` skill. Do not trust evidence while the route,
account, or role is uncertain. Human verification requires the operator; do
not invent a bypass.

Before requesting missing input, record the exact question, blocker, browser
handoff, and continuation step. Retain a necessary unfinished tab. After
friction clears, re-baseline employer, role, URL, account, and form state.
One-time codes must not be persisted in the tracker or retained after use.

### 5.8 Confirm, persist, and continue

Capture immediate provider confirmation text/URL/number, timestamp, screenshot,
or equivalent response. A success page alone stays pending. Require a second
signal tied to the same role: matching email, employer/ATS portal record, or
provider/API acceptance evidence.

Update the tracker immediately after each material transition. If a role is
closed, incompatible, blocked, duplicate, or unconfirmed, retain the record
and proceed to other suitable roles. Never retransmit an uncertain application
just to increase the count without checking acceptance and duplicate risk.

Before completion, reconcile evidence and answers, count unique confirmed
applications in the current request scope, and audit the tracker. Report
pending, blocked, skipped, and input-needed roles separately.

## 6. State and evidence contract

Typical progression:

```text
discovered -> screened -> tailoring -> awaiting-approval -> approved
  -> form-in-progress -> submitted - pending email verification
  -> submitted - email verified OR submitted - portal verified

awaiting-user is an optional interruption, not a mandatory step.
```

| State or outcome | Meaning and expected evidence |
| --- | --- |
| `discovered` / `screened` | Official URL, description, fit, eligibility, duplicate check |
| `tailoring` / `awaiting-approval` | Package work or validated package awaiting applicable approval |
| `approved` | Exact package and response binding plus approval evidence |
| `form-in-progress` | Live form continuation state and verified attachments/answers |
| `awaiting-user` | Exact missing fact or human-action requirement and continuation |
| `submitted - pending email verification` | Immediate evidence exists; required secondary acceptance evidence not yet recorded |
| `submitted - email verified` | Immediate evidence and matching email acceptance evidence |
| `submitted - portal verified` | Immediate evidence and matching portal/provider acceptance evidence |
| `submitted` | Legacy status; does not satisfy the current final verification rule |
| `needs-review` | Outcome ambiguous or submission cannot be safely confirmed |
| `blocked` / `manual submit needed` | External impediment or required operator action |
| `not submitted` / `not completed` / `skipped` | Unsuccessful or intentionally bypassed attempt, with reason and next action |
| `rejected` / `interview` / `accepted` | Subsequent employer outcome; preserve earlier application evidence |

Each touched entry should retain identity, official URL, status/time, fit and
eligibility notes, duplicate result, package and manifest references, approval
binding, non-secret submitted answers, immediate and secondary evidence,
blocker/question, next action, and browser/resource ownership when relevant.

The `applied` boolean, workflow status, and `workflowExcluded` boolean are
separate fields. They can currently disagree. None alone proves a verified
application. Later outcome changes should preserve the historical fact of
submission even though current completion counting only recognizes the two
verified status strings.

## 7. Reapplication and incomplete archives

Excluded roles remain visible and useful for history and duplicate prevention.
An excluded role can be reconsidered only when ordinary sourcing naturally
rediscovers a strong current match and a quick live check establishes:

- The authoritative listing is open.
- Eligibility still passes and the old blocker is no longer active.
- No employer or ATS duplicate, cooldown, account-history, or other restriction
  prevents another application.
- The tracker records `reapplyAllowed`, `reapplyCheckedAt`, and
  `reapplyRationale` before further tailoring/submission.

If unclear or restricted, record `reapplyAllowed=false` and the restriction,
keep it excluded, and move on. Do not proactively revisit all old records.

When cleanup is requested, incomplete package artifacts can move under
`Incomplete Application/`; tracker paths must be rewritten to their actual
locations. Moving files does not erase application history or authorize a
reapplication. Distinguish resuming an already-started application from
starting a new application to the same role.

## 8. Email reconciliation implementation

The intended flow is documented in [email-outcome-sync.md](email-outcome-sync.md):

1. The agent uses authorized read-only mailbox access to collect relevant
   outcome findings across all available history.
2. It normalizes selected metadata into
   `data/email-application-outcomes.json`.
3. [sync_email_application_outcomes.py](../scripts/sync_email_application_outcomes.py)
   matches those findings to tracker entries and applies outcomes.
4. The agent reviews ambiguous matches and runs the tracker audit.

The helper does **not** connect to Gmail or continuously poll the mailbox.
Its input is prepared findings. Rejections become visible `rejected` records
with exclusion enabled. Interviews become `interview`. Confirmation findings
promote entries only when their current status is exactly
`submitted - pending email verification`; other statuses receive evidence
without that promotion.

Important implementation limitations:

- Matching is a weighted company/title/URL/subject/sender heuristic.
- Company-only evidence can meet the threshold. Tied matches select the first
  candidate instead of refusing an ambiguous match.
- Outcomes are applied in input order without enforcing message-date
  precedence. Historical findings therefore need careful reconciliation.
- Email evidence is deduplicated by metadata, but that does not establish the
  correct application attempt when a company has multiple roles/reapplications.

Do not infer that every mailbox message was reconciled merely because a sync
report exists. The analysis did not perform a fresh mailbox scan.

## 9. Workbench UI, API, and automation boundaries

Start the workbench with `npm run ui`, then open
`http://localhost:4321/tracker`. The dashboard supports discovery and the
tracker supports search/status filters, applied flags, role links, notes,
resume drafts, and an Excel-compatible applied-job export.

Dashboard Open listing/Apply actions automatically persist visits. The server
now preserves richer existing workflow fields on revisits. UI mutations are
serialized inside the server and tracker writes use the atomic-file helper.
Python helpers also write the tracker directly; they do not participate in
that server mutation queue. Avoid concurrent writers to the real tracker.

The tracker UI's headline applied/pending totals use the `applied` checkbox.
They are not verified-submission totals. Selecting a verified status does not
currently validate evidence. The UI also lacks a dedicated complete evidence
panel for manifests, submitted answers, approvals, blockers, and next actions.

The resume workspace generates a prompt and stores notes/drafts. It is not
the full PDF tailoring and submission orchestrator. Resume source text entered
there stays in browser local storage.

`npm run apply` invokes the older Handshake flow with its own profile/state
handling. It must not be mistaken for the master multi-provider application
workflow described here. Workday discovery similarly does not implement a
complete Workday application submission engine.

The workbench's schedule runs listing searches while its server is running.
It does not independently schedule mailbox reconciliation or end-to-end
applications. Current configured scheduling is disabled.

## 10. Current local snapshot

The following values were read from local files during the September 16
analysis. The tracker file's modification timestamp was August 12, 2026.
These are recorded states, not newly confirmed employer outcomes.

| Status | Entries |
| --- | ---: |
| `submitted - email verified` | 39 |
| `submitted - portal verified` | 26 |
| `submitted - pending email verification` | 32 |
| `submitted` | 1 |
| `approved` | 35 |
| `skipped` | 36 |
| `rejected` | 3 |
| `awaiting-user` | 2 |
| `needs-review` | 1 |
| `not completed` | 2 |
| `not submitted` | 6 |
| Blank status | 33 |
| **Total** | **216** |

Additional overlapping counts:

- 65 entries have a verified status label.
- 120 entries have `applied=true`.
- 157 entries have `workflowExcluded=true`.
- All 35 approved entries and both awaiting-user entries are excluded.
- Six email-verified entries remain excluded.
- Seven entries contain `emailEvidence`; other historical confirmation
  evidence also exists under different fields. Seven is not the total number
  of email-confirmed applications.
- There are 33 archived package directories under
  `Incomplete Application/data/application-packages/`.
- Every populated `packageDir` and `resumePath` reference checked exists
  (167 of each), as do all populated `approvalManifest` and `validationReport`
  references checked (99 of each). Existence does not establish content or
  hash validity.

Configured source coverage is 13 Jooble searches, four Adzuna searches, four
Greenhouse boards, and four Ashby boards. The repository implements additional
provider adapters, but supported is not the same as configured or successfully
queried. Current scheduler settings are disabled, with a stored 180-minute
interval and America/Phoenix quiet hours of 22:00-08:00.

## 11. Known implementation and policy gaps

### 11.1 Verification audit is a presence check, not full verification

[audit_application_tracker.py](../scripts/audit_application_tracker.py) checks
that verified entries have some confirmation evidence, submitted answers,
and a package path or exemption. It does not require two distinct signals,
verify evidence paths or contents, check current hashes, or establish employer
acceptance. Its reported verified count is based on status strings, even when
issues exist; callers must not use that number independently of evidence.

An in-memory probe using a fictional email-verified entry with only a
success-page evidence object, a sample answer, and a nonexistent package path
returned zero issues. No real tracker data was changed by the probe.

The status-update API likewise accepts known status strings without checking
transition evidence. Thus “audit clean” and “65 verified” describe the current
checks and labels, not independent proof of 65 two-signal submissions.

### 11.2 Email matching can update the wrong role

An in-memory probe with two fictional roles at the same company and a
company-only finding selected the first role. Matching needs a unique
role/attempt identity, ambiguity handling, and chronological outcome rules.

### 11.3 Exclusion is too broad for active-run resumption

Audit `--fix` marks pending states excluded, including discovered, screened,
tailoring, approved, and awaiting-user. It does not distinguish a stale
abandoned application from an active application that should resume. Separate
active-run continuation from ordinary new-role selection before relying on
automatic exclusion as a routing decision.

### 11.4 Approval instructions conflict

The master skill and project routing describe standing authorization for
single-command runs. The resume skill and some transition instructions still
require explicit package approval and user approval timestamps. Harmonize the
documents around the actual user-authorized modes and record the applicable
mode on each entry. This handoff does not change those rules.

### 11.5 Canonical-answer instructions have drift

The canonical answer document requests a truthful cover letter wherever a
suitable optional or required field exists. Generic skills say to include an
optional letter only when materially useful. The answer document also retains
older success-page-only completion language, while the main workflow requires
two signals. Reconcile these statements rather than letting sessions choose
different interpretations.

Its education section still says currently pursuing a degree with expected
graduation July 2026. That date has passed as of this analysis; obtain factual
confirmation before asserting completion or continuing to state it is pending.
Do not infer the degree was awarded from the calendar alone.

### 11.6 Schema and completion semantics are inconsistent

The schema reference recommends several snake_case extension names; scripts
and real entries predominantly use camelCase. Some readers accept aliases,
others use particular spellings. There is no uniform strict schema across all
writers. Current status-only completion counting also loses sight of prior
verified submissions when an entry later becomes rejected/interview/accepted,
and must be scoped to the requested run rather than all historical entries.

### 11.7 PDF checks have limits

The validator checks extractable content, sections, anchors, bold hierarchy,
page dimensions/fill, image blocks, widgets, annotations, overlap, and orphan
headings. The ATS estimate is phrase coverage capped at 95. The reference-file
handling records reference existence and page metadata; it does not prove
visual equivalence. Manual rendered-page comparison remains required. No local
validator establishes compatibility with every employer's resume parser.

### 11.8 Runtime references and helpers need maintenance

The resume skill references `scripts/build_preserved_resume_packages.py` and
`scripts/build_next_ten_resume_packages.py`, which are missing locally. Existing
alternatives include `render_original_style_resume.py` and
`build_current_goal_packages.py`. Browser instructions refer to older browser
skill names; resolve the available browser tools and documentation each run.
Some provider submission helpers contain historical configuration/package
paths. Inspect and adapt them rather than running them as universal commands.

### 11.9 Persistence is not one end-to-end transaction

An external submission and local tracker update are separate actions. A crash
can leave an accepted application without a fully updated tracker. Recovery
must reconcile saved provider evidence, email, and portal state before retrying.
Direct helper writes can also race with UI writes despite server-side mutation
serialization. Centralizing validated tracker mutations would reduce this risk.

## 12. Validation actually performed

| Check | Result and limit |
| --- | --- |
| Read all five reference-task turns | Completed; historical claims were distinguished from current observations |
| Read-only tracker audit via `audit(entries, fix=False)` in memory | 216 entries, 65 verified labels, zero issues under existing checks; no tracker/report rewrite |
| Tracker path existence inventory | Populated package/resume/manifest/validation references checked all exist |
| `npm run check` | Passed TypeScript checking |
| `node --import tsx --test tests/workbench-server.test.ts tests/repository-gates.test.ts` | 32 tests passed |
| Synthetic audit and email-matching probes | Reproduced weak evidence acceptance and ambiguous company-only matching; no real state mutated |
| Fresh browser, mailbox, or employer-portal verification | Not performed in this analysis |

The earlier reference task tested Chrome against the local tracker, read 178
cards, and obtained HTTP 200 from the tracker API. It encountered an unsupported
`networkidle` wait and used supported loading/DOM checks instead. This is
historical evidence of that session, not proof that today's browser connection
or a particular ATS form works. No new blanket compatibility claim is made.

## 13. Commands and their effects

Run commands from the repository root. The shell's Python command may be
`python` or `python3`; package scripts currently use `python3` for helpers.

| Command | Effect |
| --- | --- |
| `npm run ui` | Starts local server/UI; startup may refresh derived workbook state |
| `npm run search` | Fetches configured listings and writes search output; may contact external services |
| `npm run apply` | Runs legacy Handshake apply helper, not the master workflow |
| `npm run tracker:audit` | Reads tracker and writes an audit report; does not fix tracker |
| `npm run tracker:audit:fix` | Normalizes/excludes tracker entries and writes audit output |
| `npm run tracker:sync-email` | Reads normalized findings and updates tracker plus sync report; does not fetch Gmail |
| `python scripts/sync_email_application_outcomes.py --dry-run` | Simulates tracker changes and writes a report without saving the tracker |
| `npm run tracker:archive-incomplete` | Moves incomplete artifacts and rewrites tracker paths |
| `npm run tracker:migrate-report-evidence` | Imports legacy report evidence into tracker |
| `npm run check` | TypeScript check |
| `npm run check:python` | Python/helper smoke checks |
| `npm test` | Repository tests |
| `npm run ci` | Combined local validation gate |

Do not run mutating maintenance or live submission commands merely to read
this handoff. Migration and archive commands are maintenance operations, not
necessary for every analysis or resume.

## 14. Handoff checklist for the next session

1. Read current user instructions, `AGENTS.md`, applicable skills, canonical
   answers, and the actual tracker. Recompute counts; do not reuse this snapshot.
2. Establish whether the request is analysis, a new application target,
   continuation, or implementation repair. This document alone authorizes none
   of those external actions.
3. Check which local files and uncommitted changes exist. A GitHub checkout
   containing only this handoff may lack the described current implementation.
4. For an application run, identify active continuation records separately
   from stale excluded candidates and record the target scope.
5. Check browser/mailbox availability and existing resource ownership before
   starting new resources. Do not stop or close pre-existing user resources.
6. Reconcile email outcomes carefully, avoiding ambiguous company-only matches
   and out-of-order historical outcomes.
7. Resolve materially stale candidate facts and applicable approval/letter
   policy from user instructions without repeatedly asking already-answered
   personal questions.
8. Verify live roles and exact package hashes; inspect every final page.
9. Persist answers and both confirmation signals promptly, including blockers
   and exact continuation instructions for unfinished work.
10. Count only unique, evidenced submissions in the current request scope.
11. Clean up owned helper processes, research/completed tabs, and temporary
    non-evidence files. Retain necessary recorded human-action handoffs.
12. Preserve tracker, approved packages, manifests, validation, and evidence.
    Never store passwords, cookies, raw auth state, or one-time codes there.

## 15. Suggested implementation priorities

These are recommendations, not changes made by this documentation task.

1. Enforce evidence-based verification transitions through a shared tracker
   service/schema, requiring both immediate and secondary acceptance evidence.
2. Make email matching refuse ambiguity, associate outcomes with a specific
   application attempt, and respect event chronology.
3. Separate active-run continuation, discovery exclusion, submission history,
   and later employer outcome so one status/flag does not erase another fact.
4. Consolidate approval, optional-letter, and verification instructions across
   project rules, skills, and candidate-answer policy sections.
5. Standardize extension-field naming and centralize atomic, serialized writes
   for both UI and script callers.
6. Add a tracker evidence/details view and distinguish applied, pending
   verification, verified, and later outcomes in UI summary counts.
7. Refresh stale generator/browser references and parameterize historical
   provider helpers before reuse.
8. Add focused regression coverage for two-signal verification, ambiguous email
   matches, chronological outcomes, active-run resumption, and run-scoped counts.

The existing workflow provides a clear operational structure. Its primary
remaining engineering task is to make the strongest written requirements
enforced and observable across every code path, rather than dependent on the
agent remembering to apply them.
