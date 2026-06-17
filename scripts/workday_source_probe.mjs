#!/usr/bin/env node
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const validate = args.includes("--validate");
const help = args.includes("--help") || args.includes("-h");
const rawInputs = args.filter((arg) => !arg.startsWith("--"));

if (help) {
  console.log(`Usage:
  node scripts/workday_source_probe.mjs [--validate] [URL_OR_SOURCE ...]
  cat urls.txt | node scripts/workday_source_probe.mjs [--validate]

Outputs JSON board config entries for public Workday CXS sources.
Inputs can be:
  - https://company.wd1.myworkdayjobs.com/wday/cxs/tenant/Board/jobs
  - https://company.wd1.myworkdayjobs.com/en-US/Board/job/...
  - company.wd1.myworkdayjobs.com/tenant/Board

--validate sends one conservative public CXS request per unique source:
  POST https://{host}/wday/cxs/{tenant}/{board}/jobs
  {"appliedFacets":{},"limit":1,"offset":0,"searchText":""}`);
  process.exit(0);
}

const stdin = process.stdin.isTTY ? "" : readFileSync(0, "utf8");
const inputs = [...rawInputs, ...extractCandidates(stdin)];
const seen = new Set();
const entries = [];

for (const input of inputs) {
  const source = parseWorkdaySource(input);
  if (!source) {
    continue;
  }

  const key = `${source.host}/${source.tenant}/${source.board}`;
  if (seen.has(key)) {
    continue;
  }

  seen.add(key);
  entries.push({
    provider: "workday",
    source: key,
    includeDescription: false,
    limit: 20,
    maxPages: 1
  });
}

if (validate) {
  for (const entry of entries) {
    entry.validation = await validateSource(entry.source);
  }
}

console.log(JSON.stringify(entries, null, 2));

function extractCandidates(value) {
  const urlMatches = value.match(/https?:\/\/[^\s"'<>]+myworkdayjobs\.com[^\s"'<>]*/gi) ?? [];
  const compactMatches = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^https?:\/\//i.test(line) && !line.includes("/wday/cxs/"))
    .flatMap((line) => line.match(/[a-z0-9-]+\.wd\d+\.myworkdayjobs\.com\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+/gi) ?? []);
  return [...urlMatches, ...compactMatches];
}

function parseWorkdaySource(value) {
  const trimmed = value.trim().replace(/[),.;]+$/g, "");
  const url = tryParseUrl(trimmed);

  if (url) {
    const cxsParts = url.pathname.match(/\/wday\/cxs\/([^/]+)\/([^/]+)(?:\/jobs|\/job\/.*)?/);
    if (cxsParts) {
      return {
        host: url.hostname,
        tenant: decodeURIComponent(cxsParts[1]),
        board: decodeURIComponent(cxsParts[2])
      };
    }

    const pathParts = url.pathname.split("/").filter(Boolean);
    if (
      pathParts.length === 2 &&
      !/^[a-z]{2}-[A-Z]{2}$/.test(pathParts[0]) &&
      !["job", "jobs"].includes(pathParts[1])
    ) {
      return {
        host: url.hostname,
        tenant: decodeURIComponent(pathParts[0]),
        board: decodeURIComponent(pathParts[1])
      };
    }

    const localeIndex = pathParts.findIndex((part) => /^[a-z]{2}-[A-Z]{2}$/.test(part));
    const board = localeIndex >= 0 ? pathParts[localeIndex + 1] : pathParts[0];
    return board
      ? {
        host: url.hostname,
        tenant: url.hostname.split(".")[0],
        board: decodeURIComponent(board)
      }
      : null;
  }

  const parts = trimmed.replace(/^https?:\/\//i, "").split("/").filter(Boolean);
  return parts.length >= 3
    ? {
      host: parts[0],
      tenant: decodeURIComponent(parts[1]),
      board: decodeURIComponent(parts[2])
    }
    : null;
}

async function validateSource(source) {
  const [host, tenant, board] = source.split("/");

  try {
    const response = await fetch(`https://${host}/wday/cxs/${tenant}/${board}/jobs`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        appliedFacets: {},
        limit: 1,
        offset: 0,
        searchText: ""
      })
    });
    const text = await response.text();

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: text.slice(0, 200)
      };
    }

    const json = JSON.parse(text);
    return {
      ok: true,
      status: response.status,
      total: typeof json.total === "number" ? json.total : null,
      sampleTitle: json.jobPostings?.[0]?.title ?? null
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function tryParseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}
