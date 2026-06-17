#!/usr/bin/env node

const owner = process.env.GITHUB_OWNER ?? "bmendonca3";
const repo = process.env.GITHUB_REPO ?? "job-application-agent-kit";
const branch = process.env.GITHUB_BRANCH ?? "geo-track";
const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? "";
const headers = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  ...(token ? { Authorization: `Bearer ${token}` } : {})
};

const workflowPath = ".github/workflows/ci.yml";
const baseUrl = `https://api.github.com/repos/${owner}/${repo}`;

const workflowFile = await request(`/contents/${workflowPath}?ref=${encodeURIComponent(branch)}`);
const workflows = await request(`/actions/workflows?ref=${encodeURIComponent(branch)}`);
const scopes = workflowFile.scopes || workflows.scopes || "";
const workflowEntries = Array.isArray(workflows.body?.workflows) ? workflows.body.workflows : [];
const exactWorkflow = workflowEntries.find((workflow) => workflow.path === workflowPath);
const hasWorkflowFile = workflowFile.status === 200;
const hasActionsWorkflow = Boolean(exactWorkflow);
const hasActiveActionsWorkflow = exactWorkflow?.state === "active";
const hasWorkflowScope = scopes.split(",").map((scope) => scope.trim()).includes("workflow");
const workflowContent = hasWorkflowFile ? decodeWorkflowContent(workflowFile.body) : "";
const workflowContractErrors = workflowContent ? validateWorkflowContract(workflowContent) : [];

if (!hasWorkflowFile || !hasActionsWorkflow || !hasActiveActionsWorkflow || workflowContractErrors.length) {
  console.error(`Remote CI is not ready for ${owner}/${repo}@${branch}.`);
  console.error(`Expected ${workflowPath} to exist on github.com, be active in Actions, and run npm run ci.`);
  console.error(`Workflow file status: ${workflowFile.status}${workflowFile.body?.message ? ` (${workflowFile.body.message})` : ""}`);
  console.error(`Actions workflow count: ${workflows.body?.total_count ?? "unknown"}`);
  console.error(`Exact workflow state: ${exactWorkflow?.state ?? "missing"}`);
  for (const error of workflowContractErrors) {
    console.error(`Workflow contract error: ${error}`);
  }
  if (scopes && !hasWorkflowScope) {
    console.error(`Current token scopes are missing workflow: ${scopes}`);
  }
  console.error("Publish the workflow with a credential that includes workflow scope, then rerun npm run check:remote-ci.");
  process.exitCode = 1;
} else {
  console.log(`Remote CI is ready for ${owner}/${repo}@${branch}.`);
  console.log(`${workflowPath} exists, is active, and runs npm run ci.`);
}

async function request(path) {
  const response = await fetch(`${baseUrl}${path}`, { headers });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  return {
    status: response.status,
    scopes: response.headers.get("x-oauth-scopes") ?? "",
    body
  };
}

function decodeWorkflowContent(body) {
  if (typeof body?.content !== "string") {
    return "";
  }

  return Buffer.from(body.content, body.encoding === "base64" ? "base64" : "utf8").toString("utf8");
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
