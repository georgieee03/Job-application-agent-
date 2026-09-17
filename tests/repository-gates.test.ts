import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("package scripts run the local validation gate", async () => {
  const packageJson = JSON.parse(await readFile(join(repoRoot, "package.json"), "utf8"));

  assert.equal(packageJson.scripts.check, "tsc --noEmit");
  assert.equal(packageJson.scripts["check:python"], "python3 scripts/check_python_helpers.py");
  assert.equal(packageJson.scripts["tracker:audit"], "python3 scripts/audit_application_tracker.py");
  assert.equal(packageJson.scripts["tracker:audit:fix"], "python3 scripts/audit_application_tracker.py --fix");
  assert.equal(packageJson.scripts["tracker:archive-incomplete"], "python3 scripts/archive_incomplete_applications.py --apply");
  assert.equal(packageJson.scripts["tracker:migrate-report-evidence"], "python3 scripts/migrate_application_report_evidence.py --apply");
  assert.equal(packageJson.scripts["tracker:sync-email"], "python3 scripts/sync_email_application_outcomes.py");
  assert.equal(packageJson.scripts.test, "node --import tsx --test tests/*.test.ts");
  assert.equal(packageJson.scripts.ci, "npm run check && npm run check:python && npm test");
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
    assert.doesNotMatch(content.replace(/codex:\/\/threads\/[a-f0-9-]+/gi, ""), forbiddenBranding, `${path} should not include specific coding-agent branding`);
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
