# CI Workflow Publishing

The local workflow file lives at `.github/workflows/ci.yml` and is expected to run the same gate as local development:

```bash
npm run ci
```

That command runs TypeScript checks, Python helper smoke checks, and the rendered workbench test suite.

## Publishing Requirement

GitHub requires a credential with `workflow` scope to create or update files under `.github/workflows`. If a push is rejected with a workflow-scope error, re-authenticate with a credential that includes `workflow`, then retry publishing the workflow file to `geo-track`.

The packaged publisher refuses to mutate the remote when the current token is missing `workflow` scope:

```bash
npm run publish:ci-workflow
```

Use regular GitHub:

```bash
git remote -v
```

The remote should point at `github.com/bmendonca3/job-application-agent-kit`, not an enterprise host.

## Verification

After publishing, verify the workflow exists on the branch:

```bash
gh api repos/bmendonca3/job-application-agent-kit/contents/.github/workflows/ci.yml --field ref=geo-track
```

Then verify Actions sees the workflow:

```bash
gh api repos/bmendonca3/job-application-agent-kit/actions/workflows --field ref=geo-track
```

Or run the packaged remote verifier:

```bash
npm run check:remote-ci
```

The workflow should run on pushes to `main` and `geo-track`, and on pull requests. Treat the goal as incomplete until the remote workflow is present and the Actions workflow list includes it.
