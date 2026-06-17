import assert from "node:assert/strict";
import { lstat, mkdir, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { writeJsonFileAtomically, writeTextFileAtomically } from "../src/atomic-file.js";

test("atomic file writer creates nested paths and writes JSON with a trailing newline", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "atomic-file-test-"));
  try {
    const target = join(cwd, "nested", "state.json");

    await writeJsonFileAtomically(target, { ok: true });

    assert.equal(await readFile(target, "utf8"), '{\n  "ok": true\n}\n');
    assert.deepEqual(
      (await readdir(join(cwd, "nested"))).filter((entry) => entry.endsWith(".tmp")),
      []
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("atomic file writer cleans temp files when replacement fails", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "atomic-file-test-"));
  try {
    const target = join(cwd, "target.json");
    await mkdir(target);

    await assert.rejects(() => writeTextFileAtomically(target, "replacement"));

    assert.equal((await lstat(target)).isDirectory(), true);
    assert.deepEqual(await readdir(cwd), ["target.json"]);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
