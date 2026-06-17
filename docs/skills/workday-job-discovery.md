# Skill: Workday Job Discovery

Use this skill to search and filter jobs on a Workday board through the public board API instead of manual page scraping.

## Workflow

1. Identify the Workday tenant and board path from the careers URL.
2. Query:
   - `POST https://<host>/wday/cxs/<tenant>/<board>/jobs`
3. Start with a small body:

```json
{"appliedFacets":{},"limit":20,"offset":0,"searchText":""}
```

4. Page until results stop.
5. Filter by title, location, seniority, and stack keywords.
6. Open job-detail endpoints only for shortlisted roles.

## Practical Notes

- Many Workday boards expose the jobs endpoint publicly.
- Prefer live API results over search-engine snippets.
- Record job ID, title, location, and exact URL once shortlisted.

## Output Expectations

- best-fit roles
- why they fit
- hard blockers
- verified live URLs
- whether the next step should be browser or API apply
