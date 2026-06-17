# Email / Portal Verification Audit

Date: 2026-06-17

This audit applies the stricter verification rule requested after the original
batch completed: a provider success page alone is not enough to mark an
application fully verified. A fully verified submission now requires both:

1. Immediate submission evidence, such as a provider success page or accepted
   submit response.
2. A second confirmation signal, such as a confirmation email, employer/ATS
   portal record, or provider/API acceptance record.

## Result

- Site-confirmed applications from the batch: 10
- Confirmation emails recorded in this repository: 0
- Employer/ATS portal confirmations recorded in this repository: 0
- Fully email/portal verified applications under the new rule: 0
- Incomplete or not-submitted applications now tracked for manual follow-up: 5

## Site-Confirmed But Email/Portal Verification Pending

These roles had success-page or equivalent site evidence in the workbench, but
no confirmation email or employer/ATS portal evidence has been recorded yet:

1. Corvus Robotics - Product Implementation Engineer I, II
2. Arxlight - Newgrad Engineering Role (Various)
3. Nuro - Software Engineer, AI Platform - New Grad
4. Nuro - Software Engineer, Performance - New Grad
5. Skild AI - Robotics Software Engineer
6. Verne Robotics - Robotics Software Engineer
7. Standard Subsea - SWE, Robotics
8. Molg - Robotics Engineer (Path Planning)
9. CircuitHub - Full-Stack Robotics Engineer
10. Applied Intuition - Software Engineer - C++

## Not Submitted / Not Completed

These roles are recorded in both `application_tracker.md` and
`DYI applications.md` for manual follow-up:

1. FieldAI - Robotics Software Engineer, Mapping
2. FieldAI - Robotics QA / QC Engineer
3. Humble Robotics - Software Engineer, Autonomous Systems
4. MVP Robotics - Robotics Software Engineer
5. Lila Sciences - Software Engineer I, Instrument Software

## Next Verification Step

Check the candidate email inbox and/or employer ATS portals for each
site-confirmed role. After a second signal is found, update
`application_tracker.md` from `submitted - pending email verification` to
`submitted - email verified` or `submitted - portal verified`.
