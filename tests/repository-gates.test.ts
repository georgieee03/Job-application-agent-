import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("package and GitHub Actions CI contracts run the full local gate", async () => {
  const packageJson = JSON.parse(await readFile(join(repoRoot, "package.json"), "utf8"));
  const workflow = await readFile(join(repoRoot, ".github", "workflows", "ci.yml"), "utf8");

  assert.equal(packageJson.scripts.check, "tsc --noEmit");
  assert.equal(packageJson.scripts["check:python"], "python3 scripts/check_python_helpers.py");
  assert.equal(packageJson.scripts["check:remote-ci"], "node scripts/check_remote_ci.mjs");
  assert.equal(packageJson.scripts["publish:ci-workflow"], "node scripts/publish_ci_workflow.mjs");
  assert.equal(packageJson.scripts.test, "node --import tsx --test tests/*.test.ts");
  assert.equal(packageJson.scripts.ci, "npm run check && npm run check:python && npm test");

  assert.match(workflow, /^\s*push:\s*$/m);
  assert.match(workflow, /^\s*-\s*main\s*$/m);
  assert.match(workflow, /^\s*-\s*geo-track\s*$/m);
  assert.match(workflow, /^\s*pull_request:\s*$/m);
  assert.match(workflow, /run:\s*npm run ci/);

  const remoteVerifier = await readFile(join(repoRoot, "scripts", "check_remote_ci.mjs"), "utf8");
  assert.match(remoteVerifier, /github\.com/);
  assert.match(remoteVerifier, /\.github\/workflows\/ci\.yml/);
  assert.match(remoteVerifier, /workflow\.path === workflowPath/);
  assert.match(remoteVerifier, /exactWorkflow\?\.state === "active"/);
  assert.match(remoteVerifier, /missing npm run ci gate/);
  assert.match(remoteVerifier, /workflow scope/);

  const workflowPublisher = await readFile(join(repoRoot, "scripts", "publish_ci_workflow.mjs"), "utf8");
  assert.match(workflowPublisher, /github\.com/);
  assert.match(workflowPublisher, /missing workflow scope/);
  assert.match(workflowPublisher, /Add GitHub Actions CI workflow/);
  assert.match(workflowPublisher, /missing npm run ci gate/);
});

test("repository docs avoid specific coding-agent branding and tag Georgie consistently", async () => {
  const documentationFiles = [
    join(repoRoot, "README.md"),
    join(repoRoot, "ui", "README.md"),
    ...(await listMarkdownFiles(join(repoRoot, "docs"))),
    ...(await listMarkdownFiles(join(repoRoot, "scripts"))),
    ...(await listMarkdownFiles(join(repoRoot, "tests")))
  ];
  const forbiddenBranding = new RegExp(
    [
      "\\[codex\\]",
      "Cod" + "ex",
      "Cur" + "sor",
      "coding" + " agent",
      "Gate" + "ch"
    ].join("|"),
    "i"
  );

  for (const path of documentationFiles) {
    const content = await readFile(path, "utf8");
    assert.doesNotMatch(content, forbiddenBranding, `${path} should not include specific coding-agent branding`);
    if (/Georgie/i.test(content)) {
      assert.match(content, /@georgieee/, `${path} should tag Georgie as @georgieee`);
    }
  }
});

async function listMarkdownFiles(root: string): Promise<string[]> {
  const entries = await readdir(root);
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(root, entry);
    const metadata = await stat(path);
    if (metadata.isDirectory()) {
      files.push(...(await listMarkdownFiles(path)));
    } else if (entry.endsWith(".md")) {
      files.push(path);
    }
  }

  return files;
}
