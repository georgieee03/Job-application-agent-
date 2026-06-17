import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { loadState, saveState, type RunState } from "../src/state.js";

const emptyState: RunState = {
  seenJobs: {},
  appliedJobs: {},
  skippedJobs: {},
  pendingReviewJobs: {}
};

test("run state treats missing files as empty and surfaces corrupt files", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "run-state-test-"));
  try {
    const statePath = join(cwd, "data", "run-state.json");
    assert.deepEqual(await loadState(statePath), emptyState);

    await mkdir(join(cwd, "data"), { recursive: true });
    await writeFile(statePath, "{ not valid json", "utf8");
    await assert.rejects(() => loadState(statePath), /Unexpected token|JSON/);
    assert.equal(await readFile(statePath, "utf8"), "{ not valid json");
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("run state saves atomically without leaving temp files", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "run-state-test-"));
  try {
    const statePath = join(cwd, "data", "run-state.json");
    const state: RunState = {
      seenJobs: { "job-1": "2026-05-19T12:00:00.000Z" },
      appliedJobs: {},
      skippedJobs: {},
      pendingReviewJobs: { "job-2": "https://example.com/jobs/job-2" }
    };

    await saveState(statePath, state);

    assert.deepEqual(await loadState(statePath), state);
    const dataDirEntries = await readdir(join(cwd, "data"));
    assert.deepEqual(
      dataDirEntries.filter((entry) => entry.endsWith(".tmp")),
      [],
      "run state writer should not leave temp files behind"
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
