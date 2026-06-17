import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createServer } from "node:net";
import { test } from "node:test";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tsxCli = join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");
const serverEntry = join(repoRoot, "src", "workbench-server.ts");
const uiDir = join(repoRoot, "ui");
const SERVER_START_TIMEOUT_MS = 30_000;

interface TestServer {
  baseUrl: string;
  cwd: string;
  startupOutput: string;
  close: () => Promise<void>;
}

interface ServerOptions {
  env?: Record<string, string>;
  preloadScript?: string;
  setupCwd?: (cwd: string) => Promise<void>;
}

test("tracker persists visits, resume state, status, and formula-safe workbook exports", async () => {
  await withServer(async ({ baseUrl, cwd }) => {
    const visit = await postJson(baseUrl, "/api/tracker/visit", {
      action: "apply",
      listing: {
        provider: "test",
        title: "+Platform <Engineer>",
        company: "=Example & Co",
        location: "Remote",
        employmentType: "Full-time",
        listingUrl: "https://example.com/jobs/platform",
        applyUrl: "https://example.com/apply/platform",
        description: "Build reliable TypeScript automations.",
        score: 93,
        sourceRunAt: "2026-05-18T23:15:30.000Z"
      }
    });

    assert.equal(visit.status, 200);
    const trackedId = visit.body.id;

    const applied = await postJson(baseUrl, "/api/tracker/applied", {
      id: trackedId,
      applied: true
    });
    assert.equal(applied.status, 200);

    const status = await postJson(baseUrl, "/api/tracker/status", {
      id: trackedId,
      status: "interview"
    });
    assert.equal(status.status, 200);

    const resume = await postJson(baseUrl, "/api/tracker/resume", {
      id: trackedId,
      resumeNotes: "Emphasize TypeScript and workflow automation.",
      resumeDraft: "Draft bullets",
      jobDescriptionOverride: "Platform role with TypeScript and APIs."
    });
    assert.equal(resume.status, 200);

    const tracker = await getJson(baseUrl, "/api/tracker");
    assert.equal(tracker.body.length, 1);
    assert.equal(tracker.body[0].status, "interview");
    assert.equal(tracker.body[0].resumeNotes, "Emphasize TypeScript and workflow automation.");

    const workbook = await readFile(join(cwd, "data", "applied-jobs.xls"), "utf8");
    assert.match(workbook, /&apos;=Example &amp; Co/);
    assert.match(workbook, /&apos;\+Platform &lt;Engineer&gt;/);

    const exportedWorkbook = await fetch(`${baseUrl}/api/tracker/export`);
    assert.equal(exportedWorkbook.status, 200);
    assert.equal(exportedWorkbook.headers.get("content-type"), "application/vnd.ms-excel; charset=utf-8");
    assert.match(exportedWorkbook.headers.get("content-disposition") ?? "", /applied-jobs\.xls/);
    assert.equal(exportedWorkbook.headers.get("cache-control"), "no-store");
    assert.equal(exportedWorkbook.headers.get("x-content-type-options"), "nosniff");
    assertSecurityHeaders(exportedWorkbook);
    assert.match(await exportedWorkbook.text(), /&apos;=Example &amp; Co/);
    assert.deepEqual(
      (await readdir(join(cwd, "data"))).filter((entry) => entry.endsWith(".tmp")),
      [],
      "applied workbook writer should not leave temp files behind"
    );
  });
});

test("tracker rejects non-http listing URLs without poisoning persisted state", async () => {
  await withServer(async ({ baseUrl }) => {
    const rejected = await postJson(baseUrl, "/api/tracker/visit", {
      listing: {
        title: "Unsafe role",
        company: "Example",
        listingUrl: "javascript:alert(1)"
      }
    });

    assert.equal(rejected.status, 400);

    const tracker = await getJson(baseUrl, "/api/tracker");
    assert.deepEqual(tracker.body, []);
  });
});

test("tracker strips Jooble apply links from new and legacy records", async () => {
  await withServer(
    async ({ baseUrl }) => {
      const visit = await postJson(baseUrl, "/api/tracker/visit", {
        action: "apply",
        listing: {
          provider: "jooble",
          title: "Robotics Engineer",
          company: "Example Robotics",
          listingUrl: "https://jooble.org/jdp/123",
          applyUrl: "https://jooble.org/jdp/123"
        }
      });

      assert.equal(visit.status, 200);
      assert.equal(visit.body.applyUrl, null);

      const tracker = await getJson(baseUrl, "/api/tracker");
      assert.equal(tracker.status, 200);
      assert.equal(tracker.body.length, 2);
      assert.equal(
        tracker.body.find((job: { title: string }) => job.title === "Legacy Jooble Role")?.applyUrl,
        null
      );
      assert.equal(
        tracker.body.find((job: { title: string }) => job.title === "Robotics Engineer")?.applyUrl,
        null
      );
    },
    {
      setupCwd: async (cwd) => {
        await mkdir(join(cwd, "data"), { recursive: true });
        await writeFile(
          join(cwd, "data", "application-tracker.json"),
          JSON.stringify([
            {
              provider: "jooble",
              title: "Legacy Jooble Role",
              company: "Example Robotics",
              listingUrl: "https://jooble.org/jdp/legacy",
              applyUrl: "https://jooble.org/jdp/legacy",
              firstVisitedAt: "2026-05-18T12:00:00.000Z",
              lastVisitedAt: "2026-05-18T12:00:00.000Z"
            }
          ])
        );
      }
    }
  );
});

test("tracker serializes concurrent visits without losing jobs", async () => {
  await withServer(async ({ baseUrl }) => {
    const [first, second] = await Promise.all([
      postJson(baseUrl, "/api/tracker/visit", {
        listing: {
          provider: "test",
          title: "Platform Engineer",
          company: "Example One",
          listingUrl: "https://example.com/jobs/platform"
        }
      }),
      postJson(baseUrl, "/api/tracker/visit", {
        listing: {
          provider: "test",
          title: "Automation Engineer",
          company: "Example Two",
          listingUrl: "https://example.com/jobs/automation"
        }
      })
    ]);

    assert.equal(first.status, 200);
    assert.equal(second.status, 200);

    const tracker = await getJson(baseUrl, "/api/tracker");
    assert.equal(tracker.status, 200);
    assert.deepEqual(
      tracker.body.map((job: { title: string }) => job.title).sort(),
      ["Automation Engineer", "Platform Engineer"]
    );
  });
});

test("latest results strip stale Jooble and JobLeads apply URLs before returning to the UI", async () => {
  await withServer(
    async ({ baseUrl }) => {
      const results = await getJson(baseUrl, "/api/results");

      assert.equal(results.status, 200);
      assert.equal(results.body.listings[0].applyUrl, null);
      assert.equal(results.body.listings[1].applyUrl, null);
      assert.equal(results.body.alerts[0].listings[0].applyUrl, null);
    },
    {
      setupCwd: async (cwd) => {
        await mkdir(join(cwd, "data"), { recursive: true });
        await writeFile(
          join(cwd, "data", "job-listings.json"),
          JSON.stringify({
            generatedAt: "2026-05-18T23:15:30.000Z",
            sourceConfigPath: "job-sources.json",
            outputPath: "data/job-listings.json",
            summary: {
              searches: 1,
              boards: 0,
              fetchedListings: 2,
              filteredListings: 2,
              uniqueListings: 2,
              alertMatches: 1
            },
            providers: [],
            errors: [],
            filters: {},
            ranking: {},
            schedule: {},
            listings: [
              {
                provider: "jooble",
                title: "Jooble Redirect Role",
                company: "Example Robotics",
                listingUrl: "https://jooble.org/jdp/123",
                applyUrl: "https://jooble.org/jdp/123"
              },
              {
                provider: "greenhouse",
                title: "Paid Lead Role",
                company: "Example Robotics",
                listingUrl: "https://example.com/jobs/paid-lead",
                applyUrl: "https://www.jobleads.com/apply/paid-lead"
              }
            ],
            alerts: [
              {
                id: "lead-alert",
                name: "Lead alert",
                count: 1,
                browser: true,
                listings: [
                  {
                    provider: "jooble",
                    title: "Jooble Redirect Role",
                    company: "Example Robotics",
                    listingUrl: "https://jooble.org/jdp/123",
                    applyUrl: "https://jooble.org/jdp/123"
                  }
                ]
              }
            ]
          })
        );
      }
    }
  );
});

test("tracker normalizes legacy persisted records with stable defaults", async () => {
  await withServer(async ({ baseUrl, cwd }) => {
    await mkdir(join(cwd, "data"), { recursive: true });
    await writeFile(
      join(cwd, "data", "application-tracker.json"),
      JSON.stringify(
        [
          {
            title: "Legacy Engineer",
            company: "Example Co",
            listingUrl: "https://example.com/jobs/legacy",
            lastVisitedAt: "not-a-date",
            visitCount: -1,
            openCount: 2.5,
            applyClickCount: "3",
            lastAction: "other",
            applied: true,
            appliedAt: "also-not-a-date",
            status: "paused",
            resumeUpdatedAt: "2026-05-18T12:00:00.000Z"
          }
        ],
        null,
        2
      ),
      "utf8"
    );

    const tracker = await getJson(baseUrl, "/api/tracker");
    assert.equal(tracker.status, 200);
    assert.equal(tracker.body.length, 1);
    assert.equal(typeof tracker.body[0].id, "string");
    assert.equal(tracker.body[0].provider, "unknown");
    assert.equal(tracker.body[0].title, "Legacy Engineer");
    assert.equal(tracker.body[0].listingUrl, "https://example.com/jobs/legacy");
    assert.equal(tracker.body[0].lastVisitedAt, "");
    assert.equal(tracker.body[0].visitCount, 0);
    assert.equal(tracker.body[0].openCount, 0);
    assert.equal(tracker.body[0].applyClickCount, 0);
    assert.equal(tracker.body[0].lastAction, "open-listing");
    assert.equal(tracker.body[0].applied, true);
    assert.equal(tracker.body[0].appliedAt, null);
    assert.equal(tracker.body[0].status, "");
    assert.equal(tracker.body[0].statusUpdatedAt, null);
    assert.equal(tracker.body[0].resumeUpdatedAt, "2026-05-18T12:00:00.000Z");
  });
});

test("tracker update endpoints return client errors for missing or unknown ids", async () => {
  await withServer(async ({ baseUrl }) => {
    const missingAppliedId = await postJson(baseUrl, "/api/tracker/applied", {
      applied: true
    });
    assert.equal(missingAppliedId.status, 400);
    assert.match(missingAppliedId.body.error, /requires an id/);

    const unknownStatusId = await postJson(baseUrl, "/api/tracker/status", {
      id: "missing-job",
      status: "interview"
    });
    assert.equal(unknownStatusId.status, 404);
    assert.match(unknownStatusId.body.error, /Tracked job not found/);

    const unknownResumeId = await postJson(baseUrl, "/api/tracker/resume", {
      id: "missing-job",
      resumeNotes: "notes"
    });
    assert.equal(unknownResumeId.status, 404);

    const unknownRemoveId = await postJson(baseUrl, "/api/tracker/remove", {
      id: "missing-job"
    });
    assert.equal(unknownRemoveId.status, 404);

    const stillAlive = await getJson(baseUrl, "/api/tracker");
    assert.equal(stillAlive.status, 200);
    assert.deepEqual(stillAlive.body, []);
  });
});

test("tracker rejects invalid mutation payloads without coercing state", async () => {
  await withServer(async ({ baseUrl }) => {
    const visit = await postJson(baseUrl, "/api/tracker/visit", {
      listing: {
        provider: "test",
        title: "Platform Engineer",
        company: "Example",
        listingUrl: "https://example.com/jobs/platform"
      }
    });
    assert.equal(visit.status, 200);

    const applied = await postJson(baseUrl, "/api/tracker/applied", {
      id: visit.body.id,
      applied: "false"
    });
    assert.equal(applied.status, 400);
    assert.match(applied.body.error, /boolean applied value/);

    const validStatus = await postJson(baseUrl, "/api/tracker/status", {
      id: visit.body.id,
      status: "interview"
    });
    assert.equal(validStatus.status, 200);

    const invalidStatus = await postJson(baseUrl, "/api/tracker/status", {
      id: visit.body.id,
      status: "offer"
    });
    assert.equal(invalidStatus.status, 400);
    assert.match(invalidStatus.body.error, /known status/);

    const missingResumeFields = await postJson(baseUrl, "/api/tracker/resume", {
      id: visit.body.id
    });
    assert.equal(missingResumeFields.status, 400);
    assert.match(missingResumeFields.body.error, /at least one resume text field/);

    const invalidResume = await postJson(baseUrl, "/api/tracker/resume", {
      id: visit.body.id,
      resumeNotes: false
    });
    assert.equal(invalidResume.status, 400);
    assert.match(invalidResume.body.error, /resumeNotes must be a string/);

    const tracker = await getJson(baseUrl, "/api/tracker");
    assert.equal(tracker.body[0].applied, false);
    assert.equal(tracker.body[0].status, "interview");
    assert.equal(tracker.body[0].resumeNotes, "");
    assert.equal(tracker.body[0].resumeUpdatedAt, null);
  });
});

test("tracker resume updates clamp oversized text before persisting", async () => {
  await withServer(async ({ baseUrl, cwd }) => {
    const visit = await postJson(baseUrl, "/api/tracker/visit", {
      listing: {
        provider: "test",
        title: "Platform Engineer",
        company: "Example",
        listingUrl: "https://example.com/jobs/platform"
      }
    });
    assert.equal(visit.status, 200);

    const oversizedText = "a".repeat(50_250);
    const saved = await postJson(baseUrl, "/api/tracker/resume", {
      id: visit.body.id,
      resumeNotes: oversizedText,
      resumeDraft: oversizedText,
      jobDescriptionOverride: oversizedText
    });

    assert.equal(saved.status, 200);
    assert.equal(saved.body[0].resumeNotes.length, 50_000);
    assert.equal(saved.body[0].resumeDraft.length, 50_000);
    assert.equal(saved.body[0].jobDescriptionOverride.length, 50_000);

    const persisted = JSON.parse(await readFile(join(cwd, "data", "application-tracker.json"), "utf8"));
    assert.equal(persisted[0].resumeNotes.length, 50_000);
    assert.equal(persisted[0].resumeDraft.length, 50_000);
    assert.equal(persisted[0].jobDescriptionOverride.length, 50_000);
  });
});

test("config save, schedule status, and empty run-search flow stay functional", async () => {
  await withServer(async ({ baseUrl, cwd }) => {
    const config = {
      searches: [],
      boards: [],
      filters: {
        includeKeywords: [],
        excludeKeywords: [],
        includeCompanies: [],
        excludeCompanies: [],
        includeLocations: [],
        excludeLocations: [],
        remoteOnly: false,
        workplaceTypes: [],
        employmentTypes: [],
        onlyWithApplyUrl: false,
        preferredProviders: []
      },
      ranking: {
        preferCompanyBoards: true,
        remoteBoost: 8,
        freshnessBoost: 12,
        compensationBoost: 8,
        keywordBoost: 14,
        titleBoosts: [],
        companyBoosts: [],
        locationBoosts: [],
        skillKeywords: []
      },
      alerts: [],
      schedule: {
        enabled: true,
        intervalMinutes: 5,
        timezone: "America/Phoenix",
        quietHoursStart: "23:00",
        quietHoursEnd: "06:00"
      }
    };

    const saved = await postJson(baseUrl, "/api/config", config);
    assert.equal(saved.status, 200);
    assert.equal(saved.body.schedule.enabled, true);

    const status = await getJson(baseUrl, "/api/status");
    assert.equal(status.status, 200);
    assert.equal(typeof status.body.runtime.nextRunAt, "string");

    const run = await postJson(baseUrl, "/api/run-search", {});
    assert.equal(run.status, 200);
    assert.equal(run.body.summary.uniqueListings, 0);
    assert.equal(run.body.summary.alertMatches, 0);

    const output = JSON.parse(await readFile(join(cwd, "data", "job-listings.json"), "utf8"));
    assert.equal(output.summary.uniqueListings, 0);
    const outputDirEntries = await readdir(join(cwd, "data"));
    assert.deepEqual(
      outputDirEntries.filter((entry) => entry.endsWith(".tmp")),
      [],
      "search output writer should not leave temp files behind"
    );
  });
});

test("corrupt previous search output blocks new runs without overwriting data", async () => {
  await withServer(async ({ baseUrl, cwd }) => {
    const outputPath = join(cwd, "data", "job-listings.json");
    await writeFile(outputPath, "{ not valid json", "utf8");

    const run = await postJson(baseUrl, "/api/run-search", {});
    assert.equal(run.status, 500);
    assert.match(run.body.error, /previous listings output|Unexpected token|JSON/);
    assert.equal(await readFile(outputPath, "utf8"), "{ not valid json");

    const status = await getJson(baseUrl, "/api/status");
    assert.equal(status.status, 200);
    assert.equal(status.body.runtime.running, false);
    assert.match(status.body.runtime.lastError, /previous listings output|Unexpected token|JSON/);
  });
});

test("corrupt latest search output surfaces errors instead of empty results", async () => {
  await withServer(async ({ baseUrl, cwd }) => {
    const missingResults = await getJson(baseUrl, "/api/results");
    assert.equal(missingResults.status, 200);
    assert.equal(missingResults.body, null);

    const outputPath = join(cwd, "data", "job-listings.json");
    await writeFile(outputPath, "{ not valid json", "utf8");

    const results = await fetch(`${baseUrl}/api/results`);
    assert.equal(results.status, 500);
    assert.equal(results.headers.get("content-type"), "application/json; charset=utf-8");
    assertSecurityHeaders(results);
    assert.match((await results.json()).error, /Unexpected token|JSON/);
    assert.equal(await readFile(outputPath, "utf8"), "{ not valid json");

    const status = await getJson(baseUrl, "/api/status");
    assert.equal(status.status, 200);
    assert.equal(status.body.runtime.running, false);
  });
});

test("salary filters understand shorthand compensation ranges", async () => {
  await withServer(
    async ({ baseUrl }) => {
      const saved = await postJson(baseUrl, "/api/config", {
        searches: [
          {
            provider: "jooble",
            query: "platform engineer",
            location: "Remote"
          }
        ],
        filters: {
          minSalary: 100000
        }
      });
      assert.equal(saved.status, 200);

      const run = await postJson(baseUrl, "/api/run-search", {});
      assert.equal(run.status, 200);
      assert.equal(run.body.summary.uniqueListings, 1);
      assert.equal(run.body.listings[0].title, "Platform Engineer");
      assert.equal(run.body.listings[0].compensation, "$120k - $180k");
    },
    {
      env: {
        JOOBLE_API_KEY: "test-key"
      },
      preloadScript: `
        const originalFetch = globalThis.fetch;
        globalThis.fetch = async (input, init) => {
          const url = String(input instanceof Request ? input.url : input);
          if (url === "https://jooble.org/api/test-key") {
            return new Response(JSON.stringify({
              jobs: [
                {
                  id: "jooble-platform",
                  title: "Platform Engineer",
                  company: "Example",
                  location: "Remote",
                  link: "https://example.com/jobs/platform",
                  updated: "2026-05-18T12:00:00.000Z",
                  snippet: "Build job application automations.",
                  type: "Full-time",
                  salary: "$120k - $180k"
                }
              ]
            }), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          }
          return originalFetch(input, init);
        };
      `
    }
  );
});

test("concurrent manual searches return a conflict instead of a server error", async () => {
  await withServer(
    async ({ baseUrl }) => {
      const saved = await postJson(baseUrl, "/api/config", {
        boards: [
          {
            provider: "greenhouse",
            source: "slow-board",
            includeDescription: true
          }
        ]
      });
      assert.equal(saved.status, 200);

      const firstRun = postJson(baseUrl, "/api/run-search", {});
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 50));

      const conflict = await fetch(`${baseUrl}/api/run-search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: "{}"
      });
      assert.equal(conflict.status, 409);
      assert.equal(conflict.headers.get("content-type"), "application/json; charset=utf-8");
      assertSecurityHeaders(conflict);
      assert.match((await conflict.json()).error, /already in progress/);

      const first = await firstRun;
      assert.equal(first.status, 200);
      assert.equal(first.body.summary.uniqueListings, 1);

      const status = await getJson(baseUrl, "/api/status");
      assert.equal(status.status, 200);
      assert.equal(status.body.runtime.running, false);
      assert.equal(status.body.runtime.lastError, null);
    },
    {
      preloadScript: `
        import { setTimeout as delay } from "node:timers/promises";

        const originalFetch = globalThis.fetch;
        globalThis.fetch = async (input, init) => {
          const url = String(input instanceof Request ? input.url : input);
          if (url.startsWith("https://boards-api.greenhouse.io/v1/boards/slow-board/jobs")) {
            await delay(250);
            return new Response(JSON.stringify({
              jobs: [
                {
                  id: 123,
                  title: "Platform Engineer",
                  absolute_url: "https://example.com/jobs/platform",
                  company_name: "Slow Board",
                  first_published: "2026-05-18T12:00:00.000Z",
                  content: "Build platform automation.",
                  location: { name: "Remote" },
                  departments: [{ name: "Engineering" }]
                }
              ]
            }), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          }
          return originalFetch(input, init);
        };
      `
    }
  );
});

test("provider failures redact credentials from output and logs", async () => {
  await withServer(
    async ({ baseUrl, cwd }) => {
      const saved = await postJson(baseUrl, "/api/config", {
        searches: [
          {
            provider: "adzuna",
            query: "platform engineer"
          }
        ]
      });
      assert.equal(saved.status, 200);

      const run = await postJson(baseUrl, "/api/run-search", {});
      assert.equal(run.status, 200);
      assert.equal(run.body.errors.length, 1);
      assert.match(run.body.errors[0].message, /app_key=%5BREDACTED%5D/);
      assert.match(run.body.errors[0].message, /app_id=%5BREDACTED%5D/);
      assert.doesNotMatch(run.body.errors[0].message, /super-secret-key/);
      assert.doesNotMatch(run.body.errors[0].message, /test-app-id/);
      assert.doesNotMatch(run.body.errors[0].message, /app_key=super-secret-key/);

      const output = JSON.parse(await readFile(join(cwd, "data", "job-listings.json"), "utf8"));
      assert.doesNotMatch(JSON.stringify(output), /super-secret-key|test-app-id/);

      const log = await readFile(join(cwd, "search-log.txt"), "utf8");
      assert.doesNotMatch(log, /super-secret-key|test-app-id/);
      assert.doesNotMatch(log, /app_key=super-secret-key/);
      assert.match(log, /app_key=%5BREDACTED%5D/);
    },
    {
      env: {
        ADZUNA_APP_ID: "test-app-id",
        ADZUNA_APP_KEY: "super-secret-key"
      },
      preloadScript: `
        import { appendFileSync } from "node:fs";
        import { join } from "node:path";

        const logPath = join(process.cwd(), "search-log.txt");
        const originalFetch = globalThis.fetch;
        const originalLog = console.log;

        console.log = (...args) => {
          appendFileSync(logPath, args.map(String).join(" ") + "\\n");
          originalLog(...args);
        };

        globalThis.fetch = async (input, init) => {
          const url = String(input instanceof Request ? input.url : input);
          if (url.startsWith("https://api.adzuna.com/v1/api/jobs/us/search/")) {
            return new Response("upstream failure", {
              status: 500,
              statusText: "Internal Server Error"
            });
          }
          return originalFetch(input, init);
        };
      `
    }
  );
});

test("workbench defaults to loopback host and honors explicit host override", async () => {
  await withServer(async ({ startupOutput }) => {
    assert.match(startupOutput, /http:\/\/127\.0\.0\.1:\d+/);
  });

  await withServer(
    async ({ startupOutput }) => {
      assert.match(startupOutput, /http:\/\/0\.0\.0\.0:\d+/);
    },
    {
      env: {
        WORKBENCH_HOST: "0.0.0.0"
      }
    }
  );
});

test("config save trims and deduplicates list settings", async () => {
  await withServer(async ({ baseUrl }) => {
    const saved = await postJson(baseUrl, "/api/config", {
      filters: {
        includeKeywords: [" platform ", "", "platform", "robotics"],
        preferredProviders: ["greenhouse", "greenhouse", "lever"],
        workplaceTypes: [" remote ", "remote", ""]
      },
      ranking: {
        titleBoosts: [" backend ", "backend", ""],
        skillKeywords: [" TypeScript ", "TypeScript", "ROS2"]
      },
      alerts: [
        {
          id: "list-cleanup",
          name: "List cleanup",
          keywords: [" infra ", "", "infra"],
          providers: ["lever", "lever"],
          companies: [" Example ", "Example"],
          webhookUrl: "https://hooks.example/cleanup"
        }
      ]
    });

    assert.equal(saved.status, 200);
    assert.deepEqual(saved.body.filters.includeKeywords, ["platform", "robotics"]);
    assert.deepEqual(saved.body.filters.preferredProviders, ["greenhouse", "lever"]);
    assert.deepEqual(saved.body.filters.workplaceTypes, ["remote"]);
    assert.deepEqual(saved.body.ranking.titleBoosts, ["backend"]);
    assert.deepEqual(saved.body.ranking.skillKeywords, ["TypeScript", "ROS2"]);
    assert.deepEqual(saved.body.alerts[0].keywords, ["infra"]);
    assert.deepEqual(saved.body.alerts[0].providers, ["lever"]);
    assert.deepEqual(saved.body.alerts[0].companies, ["Example"]);
  });
});

test("empty config POST is rejected without resetting persisted config", async () => {
  await withServer(async ({ baseUrl, cwd }) => {
    const saved = await postJson(baseUrl, "/api/config", {
      searches: [
        {
          provider: "adzuna",
          query: "platform engineer"
        }
      ]
    });
    assert.equal(saved.status, 200);

    const emptyPost = await fetch(`${baseUrl}/api/config`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    });
    assert.equal(emptyPost.status, 400);
    assert.match((await emptyPost.json()).error, /must not be empty/);

    const persisted = JSON.parse(await readFile(join(cwd, "job-sources.json"), "utf8"));
    assert.deepEqual(persisted.searches, [{ provider: "adzuna", query: "platform engineer" }]);
  });
});

test("webhook delivery failures do not fail successful searches", async () => {
  await withServer(
    async ({ baseUrl }) => {
      const saved = await postJson(baseUrl, "/api/config", {
        boards: [
          {
            provider: "greenhouse",
            source: "mock-board",
            includeDescription: true
          }
        ],
        alerts: [
          {
            id: "webhook-platform",
            name: "Webhook platform roles",
            minScore: 1,
            newOnly: false,
            webhookUrl: "https://hooks.example/fail"
          }
        ]
      });
      assert.equal(saved.status, 200);

      const run = await postJson(baseUrl, "/api/run-search", {});
      assert.equal(run.status, 200);
      assert.equal(run.body.summary.uniqueListings, 1);
      assert.equal(run.body.summary.alertMatches, 1);

      const status = await getJson(baseUrl, "/api/status");
      assert.equal(status.status, 200);
      assert.equal(status.body.runtime.lastError, null);
      assert.equal(status.body.runtime.running, false);
    },
    {
      preloadScript: `
        const originalFetch = globalThis.fetch;
        globalThis.fetch = async (input, init) => {
          const url = String(input instanceof Request ? input.url : input);
          if (url.startsWith("https://boards-api.greenhouse.io/v1/boards/mock-board/jobs")) {
            return new Response(JSON.stringify({
              jobs: [
                {
                  id: 123,
                  title: "Platform Engineer",
                  absolute_url: "https://example.com/jobs/platform",
                  company_name: "Mock Board",
                  first_published: "2026-05-18T12:00:00.000Z",
                  content: "Build platform automation.",
                  location: { name: "Remote" },
                  departments: [{ name: "Engineering" }]
                }
              ]
            }), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          }
          if (url === "https://hooks.example/fail") {
            return new Response("service unavailable", {
              status: 503,
              statusText: "Service Unavailable"
            });
          }
          return originalFetch(input, init);
        };
      `
    }
  );
});

test("jooble search excludes paid lead sources and does not expose aggregator links as apply links", async () => {
  await withServer(
    async ({ baseUrl }) => {
      const saved = await postJson(baseUrl, "/api/config", {
        searches: [
          {
            provider: "jooble",
            query: "Robotics Software Engineer",
            location: "United States",
            page: 1,
            limit: 10
          }
        ],
        filters: {
          includeKeywords: ["robotics"],
          onlyWithApplyUrl: false
        }
      });
      assert.equal(saved.status, 200);

      const run = await postJson(baseUrl, "/api/run-search", {});

      assert.equal(run.status, 200);
      assert.equal(run.body.summary.uniqueListings, 1);
      assert.equal(run.body.listings[0].company, "Mujin");
      assert.equal(run.body.listings[0].provider, "jooble");
      assert.equal(run.body.listings[0].listingUrl, "https://jooble.org/away/123");
      assert.equal(run.body.listings[0].applyUrl, null);
      assert.equal(run.body.listings[0].metadata.source, "ziprecruiter.com");
    },
    {
      env: {
        JOOBLE_API_KEY: "test-key"
      },
      preloadScript: `
        const originalFetch = globalThis.fetch;
        globalThis.fetch = async (input, init) => {
          const url = String(input instanceof Request ? input.url : input);
          if (url === "https://jooble.org/api/test-key") {
            return new Response(JSON.stringify({
              jobs: [
                {
                  id: 123,
                  title: "Robotics Software Engineer I",
                  company: "Mujin",
                  location: "Suwanee, GA",
                  source: "ziprecruiter.com",
                  link: "https://jooble.org/away/123",
                  updated: "2026-05-18T00:00:00.0000000",
                  snippet: "Robotics integration role."
                },
                {
                  id: 456,
                  title: "Robotics Software Engineer",
                  company: "JobLeads",
                  location: "Remote",
                  source: "jobleads.com",
                  link: "https://jooble.org/away/456",
                  updated: "2026-05-18T00:00:00.0000000",
                  snippet: "Robotics role from a paid lead source."
                },
                {
                  id: 789,
                  title: "Robotics Software Engineer",
                  company: "Example Leads",
                  location: "Remote",
                  source: "partner",
                  link: "https://jooble.org/away?redirect=https%3A%2F%2Fwww.jobleads.com%2Fjobs%2F789",
                  updated: "2026-05-18T00:00:00.0000000",
                  snippet: "Robotics role with an encoded paid lead redirect."
                }
              ]
            }), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          }
          return originalFetch(input, init);
        };
      `
    }
  );
});

test("multiple alert webhooks are delivered concurrently", async () => {
  await withServer(
    async ({ baseUrl, cwd }) => {
      const saved = await postJson(baseUrl, "/api/config", {
        boards: [
          {
            provider: "greenhouse",
            source: "mock-board",
            includeDescription: true
          }
        ],
        alerts: [
          {
            id: "webhook-one",
            name: "Webhook one",
            minScore: 1,
            newOnly: false,
            webhookUrl: "https://hooks.example/one"
          },
          {
            id: "webhook-two",
            name: "Webhook two",
            minScore: 1,
            newOnly: false,
            webhookUrl: "https://hooks.example/two"
          }
        ]
      });
      assert.equal(saved.status, 200);

      const run = await postJson(baseUrl, "/api/run-search", {});
      assert.equal(run.status, 200);
      assert.equal(run.body.summary.alertMatches, 2);

      const log = JSON.parse(await readFile(join(cwd, "webhook-log.json"), "utf8")) as Array<{
        event: string;
        url: string;
        inFlight: number;
      }>;
      const webhookStarts = log.filter((entry) => entry.event === "start");
      assert.equal(webhookStarts.length, 2);
      assert.equal(
        webhookStarts.some((entry) => entry.inFlight > 1),
        true,
        `expected overlapping webhook starts, got ${JSON.stringify(log)}`
      );
    },
    {
      preloadScript: `
        import { writeFile } from "node:fs/promises";
        import { join } from "node:path";
        import { setTimeout as delay } from "node:timers/promises";

        const originalFetch = globalThis.fetch;
        const logPath = join(process.cwd(), "webhook-log.json");
        let inFlight = 0;
        const log = [];
        let writeChain = Promise.resolve();

        async function appendLog(entry) {
          log.push(entry);
          writeChain = writeChain.then(() => writeFile(logPath, JSON.stringify(log, null, 2)));
          await writeChain;
        }

        globalThis.fetch = async (input, init) => {
          const url = String(input instanceof Request ? input.url : input);
          if (url.startsWith("https://boards-api.greenhouse.io/v1/boards/mock-board/jobs")) {
            return new Response(JSON.stringify({
              jobs: [
                {
                  id: 123,
                  title: "Platform Engineer",
                  absolute_url: "https://example.com/jobs/platform",
                  company_name: "Mock Board",
                  first_published: "2026-05-18T12:00:00.000Z",
                  content: "Build platform automation.",
                  location: { name: "Remote" },
                  departments: [{ name: "Engineering" }]
                }
              ]
            }), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          }
          if (url.startsWith("https://hooks.example/")) {
            inFlight += 1;
            await appendLog({ event: "start", url, inFlight });
            await delay(120);
            await appendLog({ event: "end", url, inFlight });
            inFlight -= 1;
            return new Response("ok", { status: 200 });
          }
          return originalFetch(input, init);
        };
      `
    }
  );
});

test("invalid config and malformed JSON return client errors while server remains alive", async () => {
  await withServer(async ({ baseUrl }) => {
    const invalidConfig = await postJson(baseUrl, "/api/config", {
      schedule: {
        enabled: true,
        intervalMinutes: 1,
        timezone: ""
      }
    });
    assert.equal(invalidConfig.status, 400);

    const invalidTimezone = await postJson(baseUrl, "/api/config", {
      schedule: {
        enabled: true,
        intervalMinutes: 5,
        timezone: "Mars/Phobos",
        quietHoursStart: "23:00",
        quietHoursEnd: "06:00"
      }
    });
    assert.equal(invalidTimezone.status, 400);
    assert.match(invalidTimezone.body.error, /Timezone must be a valid IANA timezone/);

    const invalidWebhookScheme = await postJson(baseUrl, "/api/config", {
      alerts: [
        {
          id: "unsupported-webhook",
          name: "Unsupported webhook",
          webhookUrl: "ftp://example.com/hook"
        }
      ]
    });
    assert.equal(invalidWebhookScheme.status, 400);
    assert.match(invalidWebhookScheme.body.error, /URL must use http or https/);

    for (const webhookUrl of [
      "http://localhost:3000/hook",
      "http://127.0.0.1:3000/hook",
      "http://10.0.0.5/hook",
      "http://172.16.0.5/hook",
      "http://192.168.1.5/hook",
      "http://169.254.169.254/latest/meta-data",
      "http://[::1]/hook"
    ]) {
      const privateWebhook = await postJson(baseUrl, "/api/config", {
        alerts: [
          {
            id: "private-webhook",
            name: "Private webhook",
            webhookUrl
          }
        ]
      });
      assert.equal(privateWebhook.status, 400, webhookUrl);
      assert.match(privateWebhook.body.error, /public HTTP\(S\) host/, webhookUrl);
    }

    const malformed = await fetch(`${baseUrl}/api/tracker/visit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: "{"
    });
    assert.equal(malformed.status, 400);

    const empty = await fetch(`${baseUrl}/api/tracker/visit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    });
    assert.equal(empty.status, 400);
    assert.match((await empty.json()).error, /must not be empty/);

    const wrongContentType = await fetch(`${baseUrl}/api/tracker/visit`, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain"
      },
      body: JSON.stringify({
        listing: {
          title: "Plain text payload",
          company: "Example",
          listingUrl: "https://example.com/jobs/plain"
        }
      })
    });
    assert.equal(wrongContentType.status, 415);
    assert.equal(wrongContentType.headers.get("content-type"), "application/json; charset=utf-8");
    assert.equal(wrongContentType.headers.get("cache-control"), "no-store");
    assert.equal(wrongContentType.headers.get("x-content-type-options"), "nosniff");
    assert.match((await wrongContentType.json()).error, /application\/json/);

    const stillAlive = await getJson(baseUrl, "/api/status");
    assert.equal(stillAlive.status, 200);
  });
});

test("corrupt tracker and config files surface errors without overwriting data", async () => {
  await withServer(async ({ baseUrl, cwd }) => {
    const visit = await postJson(baseUrl, "/api/tracker/visit", {
      listing: {
        provider: "test",
        title: "Platform Engineer",
        company: "Example",
        listingUrl: "https://example.com/jobs/platform"
      }
    });
    assert.equal(visit.status, 200);

    const trackerPath = join(cwd, "data", "application-tracker.json");
    await writeFile(trackerPath, "{ not valid json", "utf8");

    const failedMutation = await postJson(baseUrl, "/api/tracker/status", {
      id: visit.body.id,
      status: "interview"
    });
    assert.equal(failedMutation.status, 500);
    assert.equal(await readFile(trackerPath, "utf8"), "{ not valid json");

    await writeFile(join(cwd, "job-sources.json"), "{ also not valid json", "utf8");
    const config = await fetch(`${baseUrl}/api/config`);
    assert.equal(config.status, 500);
  });
});

test("startup corruption stays recoverable without overwriting data", async () => {
  await withServer(
    async ({ baseUrl, cwd, startupOutput }) => {
      assert.match(startupOutput, /Job workbench available/);
      assert.match(startupOutput, /Startup schedule refresh failed/);
      assert.match(startupOutput, /Startup tracker workbook refresh failed/);

      const results = await getJson(baseUrl, "/api/results");
      assert.equal(results.status, 200);
      assert.equal(results.body, null);

      const tracker = await fetch(`${baseUrl}/api/tracker`);
      assert.equal(tracker.status, 500);
      assert.match((await tracker.json()).error, /Unexpected token|JSON/);
      assert.equal(await readFile(join(cwd, "data", "application-tracker.json"), "utf8"), "{ not valid json");

      const config = await fetch(`${baseUrl}/api/config`);
      assert.equal(config.status, 500);
      assert.match((await config.json()).error, /Unexpected token|JSON/);
      assert.equal(await readFile(join(cwd, "job-sources.json"), "utf8"), "{ also not valid json");
    },
    {
      setupCwd: async (cwd) => {
        await mkdir(join(cwd, "data"), { recursive: true });
        await writeFile(join(cwd, "data", "application-tracker.json"), "{ not valid json", "utf8");
        await writeFile(join(cwd, "job-sources.json"), "{ also not valid json", "utf8");
      }
    }
  );
});

test("unknown api routes return non-cacheable JSON errors", async () => {
  await withServer(async ({ baseUrl }) => {
    const missing = await fetch(`${baseUrl}/api/not-a-route`);

    assert.equal(missing.status, 404);
    assert.equal(missing.headers.get("content-type"), "application/json; charset=utf-8");
    assert.equal(missing.headers.get("cache-control"), "no-store");
    assert.equal(missing.headers.get("x-content-type-options"), "nosniff");
    assertSecurityHeaders(missing);
    assert.match((await missing.json()).error, /API route not found/);

    const stillAlive = await getJson(baseUrl, "/api/status");
    assert.equal(stillAlive.status, 200);
  });
});

test("discover boards detects supported careers urls and skips duplicates", async () => {
  await withServer(async ({ baseUrl }) => {
    const discovered = await postJson(baseUrl, "/api/discover-boards", {
      urls: [
        "https://jobs.ashbyhq.com/openai",
        "https://jobs.lever.co/vercel",
        "https://jobs.ashbyhq.com/openai",
        "https://example.com/careers",
        ""
      ],
      boards: [{ provider: "lever", source: "vercel" }]
    });

    assert.equal(discovered.status, 200);
    assert.equal(discovered.body.detected.length, 1);
    assert.equal(discovered.body.detected[0].provider, "ashby");
    assert.equal(discovered.body.detected[0].source, "openai");
    assert.equal(discovered.body.duplicate.length, 2);
    assert.equal(discovered.body.unknown.length, 1);
    assert.equal(discovered.body.unknown[0].line, "https://example.com/careers");

    const invalid = await postJson(baseUrl, "/api/discover-boards", {
      urls: "not-an-array"
    });
    assert.equal(invalid.status, 400);

    const rejected = await fetch(`${baseUrl}/api/discover-boards`, {
      method: "POST",
      headers: {
        Origin: "https://example.invalid",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ urls: ["https://jobs.lever.co/acme"] })
    });
    assert.equal(rejected.status, 403);
  });
});

test("known api routes reject unsupported methods with allow headers", async () => {
  await withServer(async ({ baseUrl }) => {
    const runSearchGet = await fetch(`${baseUrl}/api/run-search`);

    assert.equal(runSearchGet.status, 405);
    assert.equal(runSearchGet.headers.get("allow"), "POST");
    assert.equal(runSearchGet.headers.get("content-type"), "application/json; charset=utf-8");
    assert.equal(runSearchGet.headers.get("cache-control"), "no-store");
    assert.equal(runSearchGet.headers.get("x-content-type-options"), "nosniff");
    assertSecurityHeaders(runSearchGet);
    assert.match((await runSearchGet.json()).error, /GET is not allowed for \/api\/run-search/);

    const statusPost = await postJson(baseUrl, "/api/status", {});
    assert.equal(statusPost.status, 405);
    assert.match(statusPost.body.error, /POST is not allowed for \/api\/status/);

    const configDelete = await fetch(`${baseUrl}/api/config`, { method: "DELETE" });
    assert.equal(configDelete.status, 405);
    assert.equal(configDelete.headers.get("allow"), "GET, POST");

    const stillAlive = await getJson(baseUrl, "/api/status");
    assert.equal(stillAlive.status, 200);
  });
});

test("mutating api routes reject cross-origin browser requests", async () => {
  await withServer(async ({ baseUrl }) => {
    const rejectedRun = await fetch(`${baseUrl}/api/run-search`, {
      method: "POST",
      headers: {
        Origin: "https://example.invalid"
      }
    });

    assert.equal(rejectedRun.status, 403);
    assert.equal(rejectedRun.headers.get("content-type"), "application/json; charset=utf-8");
    assertSecurityHeaders(rejectedRun);
    assert.match((await rejectedRun.json()).error, /Cross-origin API requests/);

    const status = await getJson(baseUrl, "/api/status");
    assert.equal(status.status, 200);
    assert.equal(status.body.runtime.lastRunAt, null);

    const sameOriginVisit = await fetch(`${baseUrl}/api/tracker/visit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: baseUrl
      },
      body: JSON.stringify({
        listing: {
          title: "Same-origin role",
          company: "Example",
          listingUrl: "https://example.com/jobs/same-origin"
        }
      })
    });
    assert.equal(sameOriginVisit.status, 200);

    const crossOriginRead = await fetch(`${baseUrl}/api/status`, {
      headers: {
        Origin: "https://example.invalid"
      }
    });
    assert.equal(crossOriginRead.status, 200);
  });
});

test("missing static assets return real 404s while app routes fallback to html", async () => {
  await withServer(async ({ baseUrl }) => {
    const stylesheet = await fetch(`${baseUrl}/styles.css`);
    assert.equal(stylesheet.status, 200);
    assert.equal(stylesheet.headers.get("content-type"), "text/css; charset=utf-8");
    assert.equal(stylesheet.headers.get("cache-control"), "no-store");
    assert.equal(stylesheet.headers.get("x-content-type-options"), "nosniff");
    assertSecurityHeaders(stylesheet);
    assert.match(await stylesheet.text(), /:root/);

    const missingCss = await fetch(`${baseUrl}/missing.css`);

    assert.equal(missingCss.status, 404);
    assert.equal(missingCss.headers.get("content-type"), "text/plain; charset=utf-8");
    assert.equal(missingCss.headers.get("cache-control"), "no-store");
    assert.equal(missingCss.headers.get("x-content-type-options"), "nosniff");
    assertSecurityHeaders(missingCss);
    assert.equal(await missingCss.text(), "Asset not found.\n");

    const appRoute = await fetch(`${baseUrl}/tracker`);
    assert.equal(appRoute.status, 200);
    assert.equal(appRoute.headers.get("content-type"), "text/html; charset=utf-8");
    assert.equal(appRoute.headers.get("cache-control"), "no-store");
    assert.equal(appRoute.headers.get("x-content-type-options"), "nosniff");
    assertSecurityHeaders(appRoute);
    assert.match(await appRoute.text(), /Job Search Workbench/);
  });
});

function assertSecurityHeaders(response: Response): void {
  const csp = response.headers.get("content-security-policy") ?? "";
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /connect-src 'self'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("permissions-policy"), "geolocation=(), microphone=(), camera=()");
}

async function withServer(
  run: (server: TestServer) => Promise<void>,
  options: ServerOptions = {}
): Promise<void> {
  const cwd = await mkdtemp(join(tmpdir(), "job-workbench-test-"));
  const port = await getFreePort();
  const sourceConfigPath = join(cwd, "job-sources.json");
  const outputPath = join(cwd, "data", "job-listings.json");
  const preloadPath = join(cwd, "preload.mjs");
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(sourceConfigPath, JSON.stringify({ searches: [], boards: [] }, null, 2));
  if (options.setupCwd) {
    await options.setupCwd(cwd);
  }
  if (options.preloadScript) {
    await writeFile(preloadPath, options.preloadScript, "utf8");
  }
  await symlink(uiDir, join(cwd, "ui"), "dir");

  const nodeOptions = [
    process.env.NODE_OPTIONS,
    options.preloadScript ? `--import=${pathToFileURL(preloadPath).href}` : ""
  ].filter(Boolean).join(" ");

  const child = spawn(process.execPath, [tsxCli, serverEntry], {
    cwd,
    env: {
      ...process.env,
      ...options.env,
      ...(nodeOptions ? { NODE_OPTIONS: nodeOptions } : {}),
      WORKBENCH_PORT: String(port),
      JOB_SOURCE_CONFIG: sourceConfigPath,
      JOB_OUTPUT_PATH: outputPath
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  try {
    const startupOutput = await waitForServer(child, port);
    await run({
      baseUrl: `http://127.0.0.1:${port}`,
      cwd,
      startupOutput,
      close: () => closeServer(child)
    });
  } finally {
    await closeServer(child);
    await removeWorkdir(cwd);
  }
}

function waitForServer(child: ChildProcessWithoutNullStreams, port: number): Promise<string> {
  return new Promise((resolveWait, rejectWait) => {
    let output = "";
    const timeout = setTimeout(() => {
      rejectWait(new Error(`Timed out waiting for server on port ${port}. Output:\n${output}`));
    }, SERVER_START_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
      if (output.includes(`:${port}`)) {
        clearTimeout(timeout);
        resolveWait(output);
      }
    });

    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });

    child.on("exit", (code) => {
      clearTimeout(timeout);
      rejectWait(new Error(`Server exited early with code ${code}. Output:\n${output}`));
    });
  });
}

async function closeServer(child: ChildProcessWithoutNullStreams): Promise<void> {
  if (child.exitCode !== null) {
    return;
  }

  await new Promise<void>((resolveClose) => {
    let resolved = false;
    const resolveOnce = () => {
      if (!resolved) {
        resolved = true;
        resolveClose();
      }
    };

    child.once("exit", resolveOnce);
    child.kill("SIGTERM");
    setTimeout(() => {
      if (child.exitCode === null) {
        child.kill("SIGKILL");
      }
    }, 1_000).unref();
    setTimeout(resolveOnce, 3_000).unref();
  });
}

async function removeWorkdir(path: string): Promise<void> {
  await rm(path, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 100
  });
}

async function getFreePort(): Promise<number> {
  return new Promise((resolvePort, rejectPort) => {
    const server = createServer();
    server.listen(0, () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === "object") {
          resolvePort(address.port);
        } else {
          rejectPort(new Error("Unable to allocate test port."));
        }
      });
    });
  });
}

async function getJson(baseUrl: string, path: string): Promise<{ status: number; body: any }> {
  const response = await fetch(`${baseUrl}${path}`);
  return {
    status: response.status,
    body: await response.json()
  };
}

async function postJson(
  baseUrl: string,
  path: string,
  payload: unknown
): Promise<{ status: number; body: any }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return {
    status: response.status,
    body: await response.json()
  };
}
