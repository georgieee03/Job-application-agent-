import assert from "node:assert/strict";
import { test } from "node:test";
import { discoverBoardsFromInput } from "../src/jobs/discover-boards.js";

test("discoverBoardsFromInput groups detected, duplicate, and unknown urls", () => {
  const result = discoverBoardsFromInput({
    urls: [
      "https://jobs.ashbyhq.com/openai",
      "https://jobs.lever.co/vercel",
      "https://jobs.ashbyhq.com/openai",
      "not-a-supported-host.example",
      ""
    ],
    boards: [{ provider: "lever", source: "vercel" }]
  });

  assert.equal(result.detected.length, 1);
  assert.equal(result.detected[0]?.provider, "ashby");
  assert.equal(result.detected[0]?.source, "openai");
  assert.equal(result.duplicate.length, 2);
  assert.equal(result.unknown.length, 1);
  assert.equal(result.unknown[0]?.line, "not-a-supported-host.example");
});
