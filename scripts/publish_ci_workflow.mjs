#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const owner = process.env.GITHUB_OWNER ?? "bmendonca3";
const repo = process.env.GITHUB_REPO ?? "job-application-agent-kit";
const branch = process.env.GITHUB_BRANCH ?? "geo-track";
const workflowPath = ".github/workflows/ci.yml";
const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? "";
const baseUrl = `https://api.github.com/repos/${owner}/${repo}`;
const author = {
  name: "bmendonca3",
  email: "bmendonca3@users.noreply.github.com"
};

if (!token) {
  console.error("Missing GITHUB_TOKEN or GH_TOKEN. Provide a github.com token with workflow scope.");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28"
};

const branchRef = await request(`/git/ref/heads/${encodeURIComponent(branch)}`);
const scopes = branchRef.scopes;
const tokenScopes = scopes.split(",").map((scope) => scope.trim()).filter(Boolean);
if (tokenScopes.length && !tokenScopes.includes("workflow")) {
  console.error(`Refusing to publish ${workflowPath}: current token is missing workflow scope.`);
  console.error(`Current token scopes: ${scopes}`);
  process.exit(1);
}

const existingWorkflow = await request(`/contents/${workflowPath}?ref=${encodeURIComponent(branch)}`, {
  allowNotFound: true
});
const workflowContent = await readFile(workflowPath, "utf8");
const workflowContractErrors = validateWorkflowContract(workflowContent);
if (workflowContractErrors.length) {
  console.error(`Local ${workflowPath} does not satisfy the CI contract:`);
  for (const error of workflowContractErrors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

const body = {
  branch,
  message: "Add GitHub Actions CI workflow",
  content: Buffer.from(workflowContent, "utf8").toString("base64"),
  author,
  committer: author,
  ...(existingWorkflow.status === 200 && existingWorkflow.body?.sha ? { sha: existingWorkflow.body.sha } : {})
};

const published = await request(`/contents/${workflowPath}`, {
  method: "PUT",
  body: JSON.stringify(body)
});

console.log(`Published ${workflowPath} to ${owner}/${repo}@${branch}.`);
console.log(`Commit: ${published.body?.commit?.sha ?? "unknown"}`);

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  if (!response.ok && !(options.allowNotFound && response.status === 404)) {
    throw new Error(`${options.method ?? "GET"} ${path} failed ${response.status}: ${text}`);
  }

  return {
    status: response.status,
    scopes: response.headers.get("x-oauth-scopes") ?? "",
    body
  };
}

function validateWorkflowContract(content) {
  const checks = [
    [/^\s*push:\s*$/m, "missing push trigger"],
    [/^\s*-\s*main\s*$/m, "missing main branch trigger"],
    [/^\s*-\s*geo-track\s*$/m, "missing geo-track branch trigger"],
    [/^\s*pull_request:\s*$/m, "missing pull_request trigger"],
    [/run:\s*npm run ci/, "missing npm run ci gate"]
  ];

  return checks
    .filter(([pattern]) => !pattern.test(content))
    .map(([, message]) => message);
}
