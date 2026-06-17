import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page, type ViewportSize } from "playwright";
import { test } from "node:test";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tsxCli = join(repoRoot, "node_modules", "tsx", "dist", "cli.mjs");
const serverEntry = join(repoRoot, "src", "workbench-server.ts");
const uiDir = join(repoRoot, "ui");
const SERVER_START_TIMEOUT_MS = 30_000;

interface TestServer {
  baseUrl: string;
  cwd: string;
}

test("static app shell has stable id and accessibility references", async () => {
  const html = await readFile(join(uiDir, "index.html"), "utf8");
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  const idSet = new Set(ids);

  const missingReferences = [
    ...referencedIds(html, "aria-labelledby"),
    ...referencedIds(html, "aria-controls"),
    ...referencedIds(html, "for")
  ].filter((id) => !idSet.has(id));

  assert.deepEqual(duplicateIds, [], "app shell duplicate ids");
  assert.deepEqual(missingReferences, [], "app shell missing referenced ids");
});

test("rendered workbench surfaces are stable on desktop and mobile", async () => {
  await withServer(async ({ baseUrl }) => {
    await clearTracker(baseUrl);

    const browser = await chromium.launch({ headless: true });
    try {
      await assertSurface({
        browser,
        baseUrl,
        name: "desktop dashboard",
        viewport: { width: 1440, height: 950 },
        tabName: "Dashboard",
        expectedViewId: "dashboardView",
        expectedText: "Job Listings"
      });
      await assertSurface({
        browser,
        baseUrl,
        name: "mobile dashboard",
        viewport: { width: 390, height: 844 },
        tabName: "Dashboard",
        expectedViewId: "dashboardView",
        expectedText: "Job Listings"
      });
      await assertSurface({
        browser,
        baseUrl,
        name: "desktop settings",
        viewport: { width: 1440, height: 950 },
        tabName: "Settings",
        expectedViewId: "settingsView",
        expectedText: "Quick Setup"
      });
      await assertSurface({
        browser,
        baseUrl,
        name: "mobile settings",
        viewport: { width: 390, height: 844 },
        tabName: "Settings",
        expectedViewId: "settingsView",
        expectedText: "Quick Setup"
      });

      await clearTracker(baseUrl);
      await assertSurface({
        browser,
        baseUrl,
        name: "desktop empty tracker",
        viewport: { width: 1440, height: 950 },
        tabName: "Tracker",
        expectedViewId: "trackerView",
        expectedText: "No tracked jobs yet",
        expectedTrackerClass: "tracker-list empty-state"
      });
      await assertSurface({
        browser,
        baseUrl,
        name: "mobile empty tracker",
        viewport: { width: 390, height: 844 },
        tabName: "Tracker",
        expectedViewId: "trackerView",
        expectedText: "No tracked jobs yet",
        expectedTrackerClass: "tracker-list empty-state"
      });

      await addTrackedJob(baseUrl);
      await assertSurface({
        browser,
        baseUrl,
        name: "mobile populated tracker",
        viewport: { width: 390, height: 844 },
        tabName: "Tracker",
        expectedViewId: "trackerView",
        expectedText: "Senior Platform Engineer",
        expectedTrackerClass: "tracker-list"
      });
      await assertSurface({
        browser,
        baseUrl,
        name: "desktop populated tracker",
        viewport: { width: 1440, height: 950 },
        tabName: "Tracker",
        expectedViewId: "trackerView",
        expectedText: "Senior Platform Engineer",
        expectedTrackerClass: "tracker-list"
      });
      await assertTrackerFiltering(browser, baseUrl);
    } finally {
      await browser.close();
    }
  });
});

test("settings steps stay stable on desktop and mobile with dense config", async () => {
  await withServer(async ({ baseUrl }) => {
    await seedDenseSettingsConfig(baseUrl);

    const browser = await chromium.launch({ headless: true });
    try {
      for (const viewport of [
        { name: "desktop", size: { width: 1440, height: 950 } },
        { name: "mobile", size: { width: 390, height: 844 } }
      ] as const) {
        const page = await browser.newPage({ viewport: viewport.size });
        const consoleMessages: string[] = [];
        page.on("console", (message) => {
          if (["error", "warning"].includes(message.type())) {
            consoleMessages.push(`${message.type()}: ${message.text()}`);
          }
        });
        page.on("pageerror", (error) => {
          consoleMessages.push(`pageerror: ${error.message}`);
        });

        try {
          await page.goto(baseUrl, { waitUntil: "networkidle" });
          await closeOnboarding(page);
          await page.locator("#viewTabs").getByRole("tab", { name: "Settings" }).click();
          await page.waitForFunction(() => document.querySelector("#settingsView")?.classList.contains("active"));

          for (let stepIndex = 0; stepIndex < 7; stepIndex += 1) {
            await page.locator(`[data-step-index="${stepIndex}"]`).click();
            await page.waitForFunction(
              (expectedStep) => document.querySelector("#stepEyebrow")?.textContent?.trim() === expectedStep,
              `Step ${stepIndex + 1}`
            );

            const label = `${viewport.name} settings step ${stepIndex + 1}`;
            await assertNoHorizontalOverflow(page, label);
            for (const selector of [
              ".wizard-layout",
              ".wizard-rail",
              "#stepRail",
              ".wizard-main",
              ".wizard-header",
              "#stepContent",
              ".wizard-footer"
            ]) {
              await assertElementNoHorizontalOverflow(page, selector, `${label} ${selector}`);
            }
            await assertVisibleElementsNoHorizontalOverflow(
              page,
              "#stepContent .helper-card, #stepContent .summary-card, #stepContent .source-card, #stepContent .alert-card, #stepContent .review-card, #stepContent .card-grid",
              label
            );
            await assertVisibleControlsWithinViewport(page, "#stepContent input, #stepContent select, #stepContent textarea", label);
            await assertVisibleInteractiveControlsAreNamed(page, label);
            await assertVisibleSvgsAreHiddenOrNamed(page, label);
            if (viewport.name === "mobile") {
              await assertTouchTargets(page, label);
            }
          }

          assert.deepEqual(consoleMessages, [], `${viewport.name} settings steps: console/page errors`);
        } finally {
          await page.close();
        }
      }
    } finally {
      await browser.close();
    }
  });
});

test("onboarding dialog keeps focus contained and closes predictably", async () => {
  await withServer(async ({ baseUrl }) => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      assert.equal(await page.locator("#onboardingOverlay.visible").count(), 1);
      assert.equal(await page.locator('#mainApp[aria-hidden="true"]').count(), 1);
      assert.equal(await page.locator("#mainApp[inert]").count(), 1);
      assert.equal(await page.locator('#onboardingDots [aria-current="step"]').count(), 1);
      assert.equal(
        await page.locator('#onboardingDots [aria-current="step"]').getAttribute("aria-label"),
        "Step 1"
      );
      assert.equal(await page.locator("#onboardingOverlay").getAttribute("aria-labelledby"), "onboardingTitle0");
      assert.equal(
        await page.locator("#mainApp").evaluate((element) => (element as HTMLElement).inert),
        true
      );

      await page.locator("#obNext").click();
      await page.waitForFunction(() => document.querySelector("#onboardingOverlay")?.getAttribute("aria-labelledby") === "onboardingTitle1");
      await page.waitForFunction(() => {
        const title = document.querySelector("#onboardingTitle1");
        return title && getComputedStyle(title.closest(".onboarding-step") as Element).display !== "none";
      });
      assert.equal(await page.locator("#onboardingTitle1").isVisible(), true);

      await page.keyboard.press("Tab");
      assert.equal(
        await page.evaluate(() => document.activeElement?.closest("#onboardingOverlay") !== null),
        true
      );

      await page.keyboard.press("Escape");
      await page.waitForTimeout(650);
      assert.equal(await page.locator('#onboardingOverlay[aria-hidden="true"]').count(), 1);
      assert.equal(await page.locator("#onboardingOverlay[hidden]").count(), 1);
      assert.equal(await page.locator("#onboardingOverlay[inert]").count(), 1);
      assert.equal(
        await page.locator("#onboardingOverlay").evaluate((element) => (element as HTMLElement).inert),
        true
      );
      assert.equal(await page.locator("#mainApp[aria-hidden]").count(), 0);
      assert.equal(await page.locator("#mainApp[inert]").count(), 0);
      assert.equal(
        await page.locator("#mainApp").evaluate((element) => (element as HTMLElement).inert),
        false
      );

      for (let index = 0; index < 8; index += 1) {
        await page.keyboard.press("Tab");
        assert.equal(
          await page.evaluate(() => document.activeElement?.closest("#onboardingOverlay") !== null),
          false,
          `hidden onboarding overlay received focus after ${index + 1} Tab press(es)`
        );
      }
    } finally {
      await browser.close();
    }
  });
});

test("onboarding final save failures stay recoverable in app", async () => {
  await withServer(async ({ baseUrl }) => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await page.route("**/api/config", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }

      await page.waitForTimeout(350);
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Onboarding setup could not be saved."
        })
      });
    });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      assert.equal(await page.locator("#onboardingOverlay.visible").count(), 1);

      await advanceOnboardingToFinal(page);
      await page.locator("#obNext").click();
      await page.waitForFunction(() => document.querySelector("#obNext")?.getAttribute("aria-busy") === "true");
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("#onboardingOverlay.visible").count(), 1);

      const alert = page.locator("#appStatus");
      await expectStatusText(alert, /Save failed: Onboarding setup could not be saved\./);
      assert.equal(await alert.getAttribute("role"), "alert");
      const onboardingAlert = page.locator("#obStatus");
      await expectOnboardingStatusText(page, /Setup could not be saved: Onboarding setup could not be saved\./);
      assert.equal(await onboardingAlert.getAttribute("role"), "alert");
      assert.equal(await onboardingAlert.getAttribute("aria-live"), "assertive");
      assert.equal(await onboardingAlert.isVisible(), true);
      assert.equal(await page.locator("#onboardingOverlay.visible").count(), 1);
      assert.equal(await page.locator("#obNext").getAttribute("aria-busy"), "false");
      assert.equal(await page.locator("#obNext").isDisabled(), false);
      assert.equal(await page.locator("#obNext").innerText(), "Launch Workbench");
      await assertNoHorizontalOverflow(page, "onboarding final save failure alert");
      await page.locator("#obSkip").click();
      await page.waitForFunction(() => document.querySelector("#onboardingOverlay")?.getAttribute("aria-hidden") === "true");
      assert.equal(await onboardingAlert.getAttribute("role"), null);
      assert.equal(await onboardingAlert.getAttribute("aria-live"), null);
      assert.equal(await onboardingAlert.textContent(), "");
      assert.equal(await page.locator("#onboardingOverlay[hidden]").count(), 1);
      assert.equal(await page.locator("#mainApp[aria-hidden]").count(), 0);
      await page.locator("#reopenOnboarding").click();
      await advanceOnboardingToFinal(page);
      await page.locator("#obNext").click();
      await expectOnboardingStatusText(page, /Setup could not be saved: Onboarding setup could not be saved\./);
      await page.locator("#obBack").click();
      await page.waitForFunction(() => document.querySelector("#obStatus")?.hidden === true);
      assert.equal(await onboardingAlert.getAttribute("role"), null);
      assert.equal(await onboardingAlert.getAttribute("aria-live"), null);
      assert.equal(await onboardingAlert.textContent(), "");
      await assertNoHorizontalOverflow(page, "onboarding cleared save failure alert");
      assert.deepEqual(pageErrors, [], "onboarding final save failure: page errors");
    } finally {
      await browser.close();
    }
  });
});

test("onboarding launch exposes busy state and blocks duplicate saves", async () => {
  await withServer(async ({ baseUrl }) => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const pageErrors: string[] = [];
    let configSaves = 0;
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await page.route("**/api/config", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }

      configSaves += 1;
      await page.waitForTimeout(350);
      await route.continue();
    });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      assert.equal(await page.locator("#onboardingOverlay.visible").count(), 1);

      await advanceOnboardingToFinal(page);

      const launchButton = page.locator("#obNext");
      await page.waitForFunction(() => document.querySelector("#obNext")?.textContent?.includes("Launch Workbench"));
      assert.equal(await launchButton.isVisible(), true);

      await launchButton.dblclick();
      await page.waitForFunction(() => document.querySelector("#obNext")?.getAttribute("aria-busy") === "true");
      assert.equal(await launchButton.isDisabled(), true);
      assert.match(await launchButton.innerText(), /Saving Setup/);

      await page.waitForFunction(() => document.querySelector("#onboardingOverlay")?.getAttribute("aria-hidden") === "true");
      assert.equal(configSaves, 1);
      assert.equal(await page.locator("#mainApp[aria-hidden]").count(), 0);
      assert.deepEqual(pageErrors, [], "onboarding launch duplicate save: page errors");
    } finally {
      await browser.close();
    }
  });
});

test("startup failures render an in-app alert without browser dialogs", async () => {
  await withServer(async ({ baseUrl }) => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const dialogs: string[] = [];
    const pageErrors: string[] = [];
    page.on("dialog", async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.dismiss();
    });
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    let configPostAttempts = 0;
    await page.route("**/api/config", async (route) => {
      if (route.request().method() === "POST") {
        configPostAttempts += 1;
      }

      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Initial configuration could not be loaded."
        })
      });
    });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });

      const alert = page.locator("#appStatus");
      await expectStatusText(alert, /Workbench failed to load: Initial configuration could not be loaded\./);
      assert.equal(await alert.getAttribute("role"), "alert");
      assert.equal(await alert.getAttribute("aria-live"), "assertive");
      await page.locator("#viewTabs").getByRole("tab", { name: "Tracker" }).click();
      await page.waitForFunction(() => document.querySelector("#trackerView")?.classList.contains("active"));
      assert.equal(await page.locator("#trackerView").isVisible(), true);
      assert.equal(await page.locator("#dashboardView").isHidden(), true);
      await page.locator("#viewTabs").getByRole("tab", { name: "Settings" }).click();
      await page.waitForFunction(() => document.querySelector("#settingsView")?.classList.contains("active"));
      assert.equal(await page.locator("#settingsView").isVisible(), true);
      assert.equal(await page.locator("#trackerView").isHidden(), true);
      await page.locator("#saveButton").click();
      await expectStatusText(alert, /Save unavailable until configuration loads/);
      await page.locator("#runButton").click();
      await expectStatusText(alert, /Save unavailable until configuration loads/);
      assert.equal(configPostAttempts, 0);
      await page.locator("#reopenOnboarding").click();
      await expectStatusText(alert, /Setup wizard unavailable until configuration loads/);
      assert.equal(await page.locator("#onboardingOverlay.visible").count(), 0);
      assert.equal(await page.locator("#onboardingOverlay[hidden]").count(), 1);
      assert.equal(await page.locator("#onboardingOverlay[inert]").count(), 1);
      assert.deepEqual(dialogs, [], "startup failure should not open browser dialogs");
      assert.deepEqual(pageErrors, [], "startup failure: page errors");
      await assertNoHorizontalOverflow(page, "startup failure alert");
    } finally {
      await browser.close();
    }
  });
});

test("background refresh failures show a recoverable status alert", async () => {
  await withServer(async ({ baseUrl }) => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await closeOnboarding(page);
      await page.route("**/api/status", async (route) => {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: "Status endpoint is temporarily unavailable."
          })
        });
      });

      await page.evaluate("window.pollStatus()");

      const alert = page.locator("#appStatus");
      await expectStatusText(alert, /Refresh failed: Status endpoint is temporarily unavailable\./);
      assert.equal(await alert.getAttribute("role"), "alert");
      assert.equal(await alert.getAttribute("aria-live"), "assertive");
      await assertNoHorizontalOverflow(page, "background refresh failure alert");
      assert.deepEqual(pageErrors, [], "background refresh failure: page errors");
    } finally {
      await browser.close();
    }
  });
});

test("unsupported browser alerts use in-app status instead of browser dialogs", async () => {
  await withServer(async ({ baseUrl }) => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const dialogs: string[] = [];
    const pageErrors: string[] = [];
    page.on("dialog", async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.dismiss();
    });
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await closeOnboarding(page);
      await page.evaluate(`Object.defineProperty(window, "Notification", {
        configurable: true,
        value: undefined
      })`);
      await page.locator("#notifyPermissionButton").click();

      const alert = page.locator("#appStatus");
      await expectStatusText(alert, /Browser alerts are not supported in this browser\./);
      assert.equal(await alert.getAttribute("role"), "alert");
      assert.equal(await alert.getAttribute("aria-live"), "assertive");
      assert.deepEqual(dialogs, [], "unsupported notifications should not open browser dialogs");
      assert.deepEqual(pageErrors, [], "unsupported notifications: page errors");
      await assertNoHorizontalOverflow(page, "unsupported notifications alert");
    } finally {
      await browser.close();
    }
  });
});

test("browser alert permission changes keep header button icon and label", async () => {
  await withServer(async ({ baseUrl }) => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await closeOnboarding(page);
      await page.evaluate(`(() => {
        function FakeNotification() {}
        FakeNotification.permission = "default";
        FakeNotification.requestPermission = async () => {
          FakeNotification.permission = "granted";
          return "granted";
        };
        Object.defineProperty(window, "Notification", {
          configurable: true,
          value: FakeNotification
        });
      })()`);

      await page.locator("#notifyPermissionButton").click();

      const button = page.locator("#notifyPermissionButton");
      await expectStatusText(page.locator("#appStatus"), /Browser alerts enabled\./);
      assert.match(await button.innerText(), /Browser Alerts Enabled/);
      assert.equal(await button.locator("svg[aria-hidden='true']").count(), 1);
      await assertNoHorizontalOverflow(page, "browser alert permission button");
      assert.deepEqual(pageErrors, [], "browser alert permission button: page errors");
    } finally {
      await browser.close();
    }
  });
});

test("dashboard load more reveals additional ranked listings", async () => {
  await withServer(async ({ baseUrl, cwd }) => {
    await seedLargeLatestOutput(cwd);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await closeOnboarding(page);
      assert.match(await page.locator("#resultsList").innerText(), /40 shown of 45/);
      assert.equal(await page.locator(".listing-card").count(), 40);
      assert.equal(await page.locator("[data-listing-load-more]").count(), 1);

      await page.locator("[data-listing-load-more]").click();
      assert.match(await page.locator("#resultsList").innerText(), /45 shown/);
      assert.equal(await page.locator(".listing-card").count(), 45);
      assert.equal(await page.locator("[data-listing-load-more]").count(), 0);
      await assertNoHorizontalOverflow(page, "dashboard load more");
    } finally {
      await browser.close();
    }
  });
});

test("dashboard scrolling remains stable across source filters and deep paging", async () => {
  await withServer(async ({ baseUrl, cwd }) => {
    await seedLargeLatestOutput(cwd, 125);

    const browser = await chromium.launch({ headless: true });
    try {
      for (const viewport of [
        { width: 390, height: 844, label: "mobile" },
        { width: 900, height: 900, label: "intermediate" },
        { width: 1440, height: 1000, label: "desktop" }
      ]) {
        const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
        try {
          await page.goto(baseUrl, { waitUntil: "networkidle" });
          await closeOnboarding(page);
          await assertNoHorizontalOverflow(page, `scroll stability initial ${viewport.label}`);

          const greenhouseFilterValue = await page.locator("[data-listing-source-filter]").evaluate((select) => {
            if (!(select instanceof HTMLSelectElement)) {
              return "";
            }

            return [...select.options].find((option) => option.textContent?.includes("Greenhouse"))?.value ?? "";
          });
          assert.ok(greenhouseFilterValue, `greenhouse source filter option ${viewport.label}`);
          await page.locator("[data-listing-source-filter]").selectOption(greenhouseFilterValue);
          await assertNoHorizontalOverflow(page, `source filter active ${viewport.label}`);
          await assertElementNoHorizontalOverflow(page, "#resultsList", `source filtered results ${viewport.label}`);

          await page.locator("[data-clear-listing-filters]").click();
          for (let step = 1; step <= 2; step += 1) {
            const loadMore = page.locator("[data-listing-load-more]");
            await loadMore.scrollIntoViewIfNeeded();
            await assertVisibleControlsWithinViewport(page, "[data-listing-load-more]", `load more before click ${viewport.label} ${step}`);
            await loadMore.click();
            await assertNoHorizontalOverflow(page, `load more step ${viewport.label} ${step}`);
            await assertVisibleElementsNoHorizontalOverflow(page, ".reason-chip", `reason chips ${viewport.label} ${step}`);
          }

          await page.locator(".listing-card").last().scrollIntoViewIfNeeded();
          assert.equal(await page.locator(".listing-card").last().isVisible(), true);
          await assertNoHorizontalOverflow(page, `last listing scrolled ${viewport.label}`);
        } finally {
          await page.close();
        }
      }
    } finally {
      await browser.close();
    }
  });
});

test("dashboard aggregation summary shows provider totals and errors", async () => {
  await withServer(async ({ baseUrl, cwd }) => {
    await seedAggregationLatestOutput(cwd);

    const browser = await chromium.launch({ headless: true });
    try {
      for (const viewport of [
        { width: 390, height: 844, label: "mobile" },
        { width: 1440, height: 1000, label: "desktop" }
      ]) {
        const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
        try {
          await page.goto(baseUrl, { waitUntil: "networkidle" });
          await closeOnboarding(page);
          const summary = page.locator(".aggregation-summary");
          await summary.waitFor();
          assert.match(await summary.innerText(), /Aggregation breakdown/);
          assert.match(await summary.innerText(), /ashby/);
          assert.match(await summary.innerText(), /128/);
          assert.match(await summary.innerText(), /greenhouse/);
          await summary.locator(".aggregation-provider-card summary").evaluateAll((summaries) => {
            for (const summaryElement of summaries) {
              if (summaryElement instanceof HTMLElement) {
                summaryElement.click();
              }
            }
          });
          assert.match(await summary.innerText(), /openai/);
          await assertVisibleElementsNoHorizontalOverflow(page, ".aggregation-source-list code", `aggregation source codes ${viewport.label}`);
          assert.match(await summary.innerText(), /Provider errors/);
          assert.match(await summary.innerText(), /404 Not Found/);
          await assertNoHorizontalOverflow(page, `dashboard aggregation summary ${viewport.label}`);
        } finally {
          await page.close();
        }
      }
    } finally {
      await browser.close();
    }
  });
});

test("dashboard alert empty state wraps active alert criteria", async () => {
  await withServer(async ({ baseUrl, cwd }) => {
    await seedAggregationLatestOutput(cwd);
    await writeFile(
      join(cwd, "job-sources.json"),
      JSON.stringify(
        {
          searches: [],
          boards: [],
          alerts: [
            {
              id: "long-alert",
              name: "Long direct-employer software alert",
              enabled: true,
              minScore: 75,
              newOnly: true,
              keywords: [
                "principal platform infrastructure engineer",
                "distributed systems typescript automation",
                "remote-first public ats direct employer"
              ],
              providers: ["greenhouse", "ashby", "smartrecruiters"]
            }
          ]
        },
        null,
        2
      )
    );

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

    try {
      await page.route("**/api/status", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            runtime: {
              lastRunAt: "2026-05-18T23:15:30.000Z",
              nextRunAt: null,
              running: false,
              lastError: null
            },
            schedule: {
              enabled: false,
              intervalMinutes: 60,
              timezone: "America/Phoenix"
            },
            providerReadiness: {}
          })
        });
      });
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await closeOnboarding(page);
      assert.match(await page.locator("#alertMatches").innerText(), /Long direct-employer software alert/);
      await assertVisibleElementsNoHorizontalOverflow(page, ".alert-rule-summary li", "alert rule summary mobile");
      await assertNoHorizontalOverflow(page, "alert empty state active criteria");
    } finally {
      await browser.close();
    }
  });
});

test("settings careers url importer previews and adds detected boards", async () => {
  await withServer(async ({ baseUrl }) => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await closeOnboarding(page);
      await page.locator("#viewTabs").getByRole("tab", { name: "Settings" }).click();
      await page.locator("[data-step-index='2']").click();
      await page.locator("[data-careers-url-input]").fill(
        "https://jobs.ashbyhq.com/openai\nhttps://jobs.lever.co/vercel\nhttps://example.com/unknown"
      );
      await page.locator("[data-careers-preview]").click();
      await page.waitForSelector(".careers-import-preview");
      assert.match(await page.locator(".careers-import-preview").innerText(), /Ready to add/);
      assert.match(await page.locator(".careers-import-preview").innerText(), /Unsupported URLs/);
      await page.locator("[data-careers-add]").click();
      await page.waitForFunction(() =>
        document.querySelectorAll("[data-board-provider]").length >= 2
      );
      assert.match(await page.locator("#appStatus").innerText(), /Added 2 company boards/);
      await assertNoHorizontalOverflow(page, "settings careers url importer");
    } finally {
      await browser.close();
    }
  });
});

test("dashboard listing filters keep sorted results actionable", async () => {
  await withServer(async ({ baseUrl, cwd }) => {
    await seedLatestOutput(cwd);
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const consoleMessages: string[] = [];
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) {
        consoleMessages.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => {
      consoleMessages.push(`pageerror: ${error.message}`);
    });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await closeOnboarding(page);
      await page.locator("[data-listing-filter-query]").click();
      await page.keyboard.type("Platform");
      assert.equal(await page.locator("[data-listing-filter-query]").inputValue(), "Platform");
      await assertNoHorizontalOverflow(page, "dashboard query match");
      assert.match(await page.locator("#resultsList").innerText(), /Senior Platform Engineer/);
      assert.doesNotMatch(await page.locator("#resultsList").innerText(), /Product Analyst/);

      await page.locator("[data-listing-filter-query]").fill("NoMatch");
      assert.match(await page.locator("#resultsList").innerText(), /No listings match/);
      await page.locator("[data-clear-listing-filters]").click();
      assert.equal(await page.locator("[data-listing-filter-query]").inputValue(), "");
      assert.equal(await page.locator("[data-listing-sort]").inputValue(), "score");
      assert.equal(await page.locator("[data-listing-source-filter]").inputValue(), "all");
      assert.equal(await page.locator("[data-listing-new-only]").isChecked(), false);
      assert.match(await page.locator("#resultsList").innerText(), /Senior Platform Engineer/);
      assert.match(await page.locator("#resultsList").innerText(), /Product Analyst/);

      const greenhouseFilterValue = await page.locator("[data-listing-source-filter]").evaluate((select) => {
        if (!(select instanceof HTMLSelectElement)) {
          return "";
        }

        return [...select.options].find((option) => option.textContent?.includes("Greenhouse (1)"))?.value ?? "";
      });
      assert.ok(greenhouseFilterValue, "greenhouse source filter option");
      await page.locator("[data-listing-source-filter]").selectOption(greenhouseFilterValue);
      assert.match(await page.locator("#resultsList").innerText(), /Senior Platform Engineer/);
      assert.doesNotMatch(await page.locator("#resultsList").innerText(), /Product Analyst/);
      await page.locator("[data-clear-listing-filters]").click();
      assert.equal(await page.locator("[data-listing-source-filter]").inputValue(), "all");

      await page.locator("[data-listing-sort]").selectOption("company");
      const firstCompanySortedTitle = await page.locator(".listing-card h3").first().innerText();
      assert.equal(firstCompanySortedTitle, "Product Analyst");

      await page.locator("[data-listing-new-only]").check();
      await assertNoHorizontalOverflow(page, "dashboard new-only filter");
      assert.match(await page.locator("#resultsList").innerText(), /Senior Platform Engineer/);
      assert.doesNotMatch(await page.locator("#resultsList").innerText(), /Product Analyst/);
      assert.equal(await page.locator('[data-track-listing="0"]').count(), 2);
      assert.deepEqual(consoleMessages, [], "dashboard listing filters: console/page errors");
    } finally {
      await browser.close();
    }
  });
});

test("dashboard cards expose score reasons and tracker state", async () => {
  await withServer(async ({ baseUrl, cwd }) => {
    await seedLatestOutput(cwd);
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const consoleMessages: string[] = [];
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) {
        consoleMessages.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => {
      consoleMessages.push(`pageerror: ${error.message}`);
    });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await closeOnboarding(page);
      await page.locator(".listing-score-details summary").first().click();
      assert.match(await page.locator(".score-breakdown").first().innerText(), /keyword: TypeScript/);
      await assertNoHorizontalOverflow(page, "score breakdown open");

      await page.evaluate(async () => {
        const listing = {
          provider: "greenhouse",
          title: "Senior Platform Engineer",
          company: "Zenith Systems",
          location: "Remote",
          employmentType: "Full-time",
          listingUrl: "https://example.com/jobs/platform",
          applyUrl: "https://example.com/apply/platform",
          description: "Build platform automation with Node and TypeScript.",
          score: 94,
          sourceRunAt: "2026-05-18T23:15:30.000Z"
        };
        await fetch("/api/tracker/visit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "open-listing", listing })
        });
        const tracker = await fetch("/api/tracker").then((response) => response.json());
        await fetch("/api/tracker/applied", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: tracker[0].id, applied: true })
        });
      });
      await page.reload({ waitUntil: "networkidle" });
      await closeOnboarding(page);

      const firstCard = page.locator(".listing-card").first();
      assert.match(await firstCard.innerText(), /Applied/);
      await assertNoHorizontalOverflow(page, "tracked listing dashboard badge");
      assert.deepEqual(consoleMessages, [], "dashboard score and tracker state: console/page errors");
    } finally {
      await browser.close();
    }
  });
});

test("dashboard settings shortcuts move focus into the visible view", async () => {
  await withServer(async ({ baseUrl }) => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const consoleMessages: string[] = [];
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) {
        consoleMessages.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => {
      consoleMessages.push(`pageerror: ${error.message}`);
    });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await closeOnboarding(page);
      await page.locator("[data-view-shortcut='settings']").first().click();
      await page.waitForFunction(() => document.querySelector("#settingsView")?.classList.contains("active"));
      assert.equal(await page.locator("#settingsView").isVisible(), true);
      assert.equal(await page.locator("#dashboardView").isHidden(), true);
      assert.equal(await page.evaluate(() => document.activeElement?.id), "settingsTab");
      await assertNoHorizontalOverflow(page, "dashboard settings shortcut");
      assert.deepEqual(consoleMessages, [], "dashboard settings shortcut: console/page errors");
    } finally {
      await browser.close();
    }
  });
});

test("tracked listing refresh failures do not mislabel saved visits", async () => {
  await withServer(async ({ baseUrl, cwd }) => {
    await seedLatestOutput(cwd);
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const pageErrors: string[] = [];
    let trackerReads = 0;
    let visitRequests = 0;
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await page.route("**/api/tracker", async (route) => {
      trackerReads += 1;
      if (trackerReads === 1) {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Tracker list could not be refreshed."
        })
      });
    });
    await page.route("**/api/tracker/visit", async (route) => {
      visitRequests += 1;
      await route.continue();
    });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await closeOnboarding(page);
      await page.evaluate(`(() => {
        document.querySelector('[data-track-listing="0"][data-track-action="open-listing"]')
          ?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      })()`);

      const alert = page.locator("#appStatus");
      await expectStatusText(alert, /Tracker saved, but refresh failed: Tracker list could not be refreshed\./);
      assert.doesNotMatch(await alert.innerText(), /Tracker save failed/);
      assert.equal(visitRequests, 1);
      await assertNoHorizontalOverflow(page, "tracked listing refresh failure alert");
      assert.deepEqual(pageErrors, [], "tracked listing refresh failure: page errors");
    } finally {
      await browser.close();
    }
  });
});

test("dashboard listing actions block duplicate in-flight tracker visits", async () => {
  await withServer(async ({ baseUrl, cwd }) => {
    await seedLatestOutput(cwd);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const consoleMessages: string[] = [];
    let visitRequests = 0;
    let releaseVisit: (() => void) | null = null;
    let resolveVisitStarted: (() => void) | null = null;
    const visitStarted = new Promise<void>((resolveVisit) => {
      resolveVisitStarted = resolveVisit;
    });
    await page.route("**/api/tracker/visit", async (route) => {
      visitRequests += 1;
      resolveVisitStarted?.();
      await new Promise<void>((resolveRelease) => {
        releaseVisit = resolveRelease;
      });
      await route.continue();
    });
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) {
        consoleMessages.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => {
      consoleMessages.push(`pageerror: ${error.message}`);
    });

    await page.addInitScript(() => {
      Object.defineProperty(window, "__openedUrls", {
        value: [],
        configurable: true
      });
      window.open = (url) => {
        (window as unknown as { __openedUrls: string[] }).__openedUrls.push(String(url));
        return null;
      };
    });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await closeOnboarding(page);
      const action = page.locator('[data-track-listing="0"][data-track-action="open-listing"]');

      await action.click();
      await Promise.race([
        visitStarted,
        page.waitForTimeout(2_000).then(() => {
          throw new Error("Timed out waiting for first listing visit request.");
        })
      ]);
      await page.waitForFunction(
        () => document.querySelector('[data-track-listing="0"][data-track-action="open-listing"]')?.getAttribute("aria-disabled") === "true"
      );
      await page.evaluate(() => {
        document
          .querySelector('[data-track-listing="0"][data-track-action="open-listing"]')
          ?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });
      await page.waitForTimeout(150);
      assert.equal(visitRequests, 1, "in-flight listing action should not queue duplicate visits");

      releaseVisit?.();
      await page.waitForFunction(() => (window as unknown as { __openedUrls: string[] }).__openedUrls.length === 1);
      assert.deepEqual(
        await page.evaluate(() => (window as unknown as { __openedUrls: string[] }).__openedUrls),
        ["https://example.com/jobs/platform"]
      );
      assert.equal(await action.getAttribute("aria-disabled"), null);
      await assertNoHorizontalOverflow(page, "duplicate listing action guard");
      assert.deepEqual(consoleMessages, [], "duplicate listing action guard: console/page errors");
    } finally {
      releaseVisit?.();
      await browser.close();
    }
  });
});

test("dashboard and tracker stay usable in separate tabs with shared tracker updates", async () => {
  await withServer(async ({ baseUrl, cwd }) => {
    await seedLatestOutput(cwd);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const dashboardPage = await context.newPage();
    const trackerPage = await context.newPage();
    const consoleMessages: string[] = [];
    for (const page of [dashboardPage, trackerPage]) {
      page.on("console", (message) => {
        if (["error", "warning"].includes(message.type())) {
          consoleMessages.push(`${message.type()}: ${message.text()}`);
        }
      });
      page.on("pageerror", (error) => {
        consoleMessages.push(`pageerror: ${error.message}`);
      });
      await page.addInitScript(() => {
        Object.defineProperty(window, "__openedUrls", {
          value: [],
          configurable: true
        });
        window.open = (url) => {
          (window as unknown as { __openedUrls: string[] }).__openedUrls.push(String(url));
          return null;
        };
      });
    }

    try {
      await Promise.all([
        dashboardPage.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle" }),
        trackerPage.goto(`${baseUrl}/tracker`, { waitUntil: "networkidle" })
      ]);
      await closeOnboarding(dashboardPage);
      await closeOnboarding(trackerPage);

      await assertActiveView(dashboardPage, "dashboard");
      await assertActiveView(trackerPage, "tracker");

      await dashboardPage.locator('[data-track-listing="0"][data-track-action="open-listing"]').click();
      await trackerPage.waitForFunction(() =>
        document.querySelector("#trackerList")?.textContent?.includes("Senior Platform Engineer")
      );
      await assertActiveView(dashboardPage, "dashboard");
      await assertActiveView(trackerPage, "tracker");

      await trackerPage.locator("[data-tracker-applied]").check();
      await dashboardPage.waitForFunction(() =>
        document.querySelector("#resultsList")?.textContent?.includes("Applied")
      );

      assert.match(await trackerPage.locator("#trackerList").innerText(), /Senior Platform Engineer/);
      assert.match(await dashboardPage.locator("#resultsList").innerText(), /Applied/);
      assert.deepEqual(
        await dashboardPage.evaluate(() => (window as unknown as { __openedUrls: string[] }).__openedUrls),
        ["https://example.com/jobs/platform"]
      );
      await assertNoHorizontalOverflow(dashboardPage, "dashboard separate tab sync");
      await assertNoHorizontalOverflow(trackerPage, "tracker separate tab sync");
      assert.deepEqual(consoleMessages, [], "separate tab tracker sync: console/page errors");
    } finally {
      await context.close();
      await browser.close();
    }
  });
});

test("dashboard listing actions do not open external pages when tracker saves fail", async () => {
  await withServer(async ({ baseUrl, cwd }) => {
    await seedLatestOutput(cwd);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const pageErrors: string[] = [];
    let visitRequests = 0;
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });
    await page.addInitScript(() => {
      Object.defineProperty(window, "__openedUrls", {
        value: [],
        configurable: true
      });
      window.open = (url) => {
        (window as unknown as { __openedUrls: string[] }).__openedUrls.push(String(url));
        return null;
      };
    });
    await page.route("**/api/tracker/visit", async (route) => {
      visitRequests += 1;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Tracker storage is temporarily unavailable."
        })
      });
    });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await closeOnboarding(page);
      await page.locator('[data-track-listing="0"][data-track-action="open-listing"]').click();

      await expectStatusText(page.locator("#appStatus"), /Tracker save failed: Tracker storage is temporarily unavailable\./);
      assert.equal(visitRequests, 1);
      assert.deepEqual(await page.evaluate(() => (window as unknown as { __openedUrls: string[] }).__openedUrls), []);
      assert.equal(
        await page.locator('[data-track-listing="0"][data-track-action="open-listing"]').getAttribute("aria-disabled"),
        null
      );
      await assertNoHorizontalOverflow(page, "listing action save failure");
      assert.deepEqual(pageErrors, [], "listing action save failure: page errors");
    } finally {
      await browser.close();
    }
  });
});

test("dashboard listing action busy state stays scoped when results refresh", async () => {
  await withServer(async ({ baseUrl, cwd }) => {
    await seedLatestOutput(cwd);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const consoleMessages: string[] = [];
    let visitRequests = 0;
    let releaseVisit: (() => void) | null = null;
    let resolveVisitStarted: (() => void) | null = null;
    const visitStarted = new Promise<void>((resolveVisit) => {
      resolveVisitStarted = resolveVisit;
    });
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) {
        consoleMessages.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => {
      consoleMessages.push(`pageerror: ${error.message}`);
    });
    await page.addInitScript(() => {
      Object.defineProperty(window, "__openedUrls", {
        value: [],
        configurable: true
      });
      window.open = (url) => {
        (window as unknown as { __openedUrls: string[] }).__openedUrls.push(String(url));
        return null;
      };
    });
    await page.route("**/api/tracker/visit", async (route) => {
      visitRequests += 1;
      resolveVisitStarted?.();
      await new Promise<void>((resolveRelease) => {
        releaseVisit = resolveRelease;
      });
      await route.continue();
    });
    await page.route("**/api/run-search", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          generatedAt: "2026-05-19T13:15:30.000Z",
          summary: {
            totalFetched: 1,
            uniqueListings: 1,
            alertMatches: 0,
            newListings: 1
          },
          listings: [
            {
              provider: "lever",
              title: "Replacement Engineer",
              company: "Refresh Labs",
              location: "Remote",
              employmentType: "Full-time",
              listingUrl: "https://example.com/jobs/replacement",
              applyUrl: "https://example.com/apply/replacement",
              description: "Replacement listing from a refreshed run.",
              score: 86,
              reasons: ["fresh run"],
              postedAt: "2026-05-19T12:00:00.000Z",
              isNew: true
            }
          ],
          alerts: []
        })
      });
    });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await closeOnboarding(page);
      await page.locator('[data-track-listing="0"][data-track-action="open-listing"]').click();
      await Promise.race([
        visitStarted,
        page.waitForTimeout(2_000).then(() => {
          throw new Error("Timed out waiting for pending listing visit request.");
        })
      ]);
      await page.waitForFunction(
        () => document.querySelector('[data-track-listing="0"][data-track-action="open-listing"]')?.getAttribute("aria-disabled") === "true"
      );

      await page.locator("#runButton").click();
      await page.waitForFunction(() => document.querySelector("#resultsList")?.textContent?.includes("Replacement Engineer"));
      const replacementAction = page.locator('[data-track-listing="0"][data-track-action="open-listing"]');
      assert.match(await replacementAction.innerText(), /Open listing/);
      assert.equal(await replacementAction.getAttribute("aria-disabled"), null);
      assert.equal(visitRequests, 1, "results refresh should not duplicate pending visit saves");

      releaseVisit?.();
      await page.waitForFunction(() => (window as unknown as { __openedUrls: string[] }).__openedUrls.length === 1);
      assert.deepEqual(
        await page.evaluate(() => (window as unknown as { __openedUrls: string[] }).__openedUrls),
        ["https://example.com/jobs/platform"]
      );
      await assertNoHorizontalOverflow(page, "listing action busy state after refresh");
      assert.deepEqual(consoleMessages, [], "listing action busy state after refresh: console/page errors");
    } finally {
      releaseVisit?.();
      await browser.close();
    }
  });
});

test("dashboard tracking saves filtered listings outside the initial visible slice", async () => {
  await withServer(async ({ baseUrl, cwd }) => {
    await seedLargeLatestOutput(cwd);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const consoleMessages: string[] = [];
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) {
        consoleMessages.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => {
      consoleMessages.push(`pageerror: ${error.message}`);
    });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await closeOnboarding(page);
      await page.locator("[data-listing-filter-query]").fill("Needle");
      await assertNoHorizontalOverflow(page, "dashboard off-slice filtered result");
      assert.equal(await page.locator('[data-track-listing="44"][data-track-action="open-listing"]').count(), 1);

      const responsePromise = page.waitForResponse(
        (response) => response.url().endsWith("/api/tracker/visit") && response.request().method() === "POST"
      );
      const popupPromise = page.waitForEvent("popup").catch(() => null);
      await page.locator('[data-track-listing="44"][data-track-action="open-listing"]').click();
      const popup = await popupPromise;
      await popup?.close();
      assert.equal((await responsePromise).status(), 200);

      await page.locator("#viewTabs").getByRole("tab", { name: "Tracker" }).click();
      await page.waitForFunction(() => document.querySelector("#trackerList")?.textContent?.includes("Needle Engineer"));
      assert.match(await page.locator("#trackerList").innerText(), /Needle Engineer/);
      assert.deepEqual(consoleMessages, [], "dashboard off-slice tracking: console/page errors");
    } finally {
      await browser.close();
    }
  });
});

test("long listing content does not overflow dashboard or tracker cards on mobile", async () => {
  await withServer(async ({ baseUrl, cwd }) => {
    await seedLongContentLatestOutput(cwd);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const consoleMessages: string[] = [];
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) {
        consoleMessages.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => {
      consoleMessages.push(`pageerror: ${error.message}`);
    });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await closeOnboarding(page);
      await assertNoHorizontalOverflow(page, "long listing dashboard");
      await assertVisibleElementsNoHorizontalOverflow(
        page,
        "#resultsList .listing-card, #resultsList .listing-meta, #resultsList .reason-chip, #resultsList h3, #resultsList p",
        "long listing dashboard"
      );

      await page.evaluate(`(() => {
        document.querySelector('[data-track-listing="0"][data-track-action="open-listing"]')
          ?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      })()`);
      await page.locator("#viewTabs").getByRole("tab", { name: "Tracker" }).click();
      await page.waitForFunction(() => document.querySelector("#trackerList")?.textContent?.includes("LongContent"));

      await assertNoHorizontalOverflow(page, "long listing tracker");
      await assertVisibleElementsNoHorizontalOverflow(
        page,
        "#trackerList .tracker-card, #trackerList .listing-meta, #trackerList .small-pill, #trackerList h3, #trackerList p",
        "long listing tracker"
      );
      assert.deepEqual(consoleMessages, [], "long listing content: console/page errors");
    } finally {
      await browser.close();
    }
  });
});

test("unsafe external listing urls do not render clickable job actions", async () => {
  await withServer(async ({ baseUrl, cwd }) => {
    await seedUnsafeLatestOutput(cwd);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const consoleMessages: string[] = [];
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) {
        consoleMessages.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => {
      consoleMessages.push(`pageerror: ${error.message}`);
    });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await closeOnboarding(page);
      assert.match(await page.locator("#resultsList").innerText(), /Unsafe Link Engineer/);
      assert.match(await page.locator("#resultsList").innerText(), /Jooble Redirect Engineer/);
      assert.match(await page.locator("#resultsList").innerText(), /Paid Lead Engineer/);
      assert.equal(await page.locator("#resultsList").getByRole("link", { name: "Open listing" }).count(), 0);
      assert.equal(await page.locator("#resultsList").getByRole("link", { name: "Apply" }).count(), 0);
      assert.equal(await page.getByRole("button", { name: "Add to tracker" }).count(), 1);
      assert.equal(await page.locator("[data-track-action='open-listing'], [data-track-action='apply']").count(), 0);
      assert.equal(await page.locator('a[href^="javascript:"], a[href^="data:"], a[href*="jooble.org"], a[href*="jobleads.com"]').count(), 0);
      await assertNoHorizontalOverflow(page, "unsafe external listing urls");
      assert.deepEqual(consoleMessages, [], "unsafe external listing urls: console/page errors");
    } finally {
      await browser.close();
    }
  });
});

test("jooble listings offer safe direct source discovery actions", async () => {
  await withServer(async ({ baseUrl, cwd }) => {
    await seedJoobleDirectSourceLatestOutput(cwd);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const consoleMessages: string[] = [];
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) {
        consoleMessages.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => {
      consoleMessages.push(`pageerror: ${error.message}`);
    });
    await page.addInitScript(() => {
      Object.defineProperty(window, "__openedUrls", {
        value: [],
        configurable: true
      });
      window.open = (url) => {
        (window as unknown as { __openedUrls: string[] }).__openedUrls.push(String(url));
        return null;
      };
    });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await closeOnboarding(page);

      const findDirectSource = page.getByRole("link", { name: "Find direct source" });
      assert.equal(await findDirectSource.count(), 1);
      const findHref = await findDirectSource.getAttribute("href");
      assert.match(findHref ?? "", /^https:\/\/www\.google\.com\/search\?/);
      assert.doesNotMatch(findHref ?? "", /jooble|jobleads/i);

      const addToTrackerButtons = page.getByRole("button", { name: "Add to tracker" });
      assert.equal(await addToTrackerButtons.count(), 2);
      const trackOnlyResponse = page.waitForResponse(
        (response) => response.url().endsWith("/api/tracker/visit") && response.request().method() === "POST"
      );
      await addToTrackerButtons.nth(1).click();
      assert.equal((await trackOnlyResponse).status(), 200);
      assert.deepEqual(await page.evaluate(() => (window as unknown as { __openedUrls: string[] }).__openedUrls), []);
      assert.equal(await page.getByRole("button", { name: "In tracker" }).count(), 1);

      const directMatch = page.getByRole("link", { name: "Apply direct match" });
      assert.equal(await directMatch.count(), 1);
      assert.equal(await directMatch.getAttribute("href"), "https://jobs.example-robotics.com/apply/robotics-software");

      const responsePromise = page.waitForResponse(
        (response) => response.url().endsWith("/api/tracker/visit") && response.request().method() === "POST"
      );
      await directMatch.click();
      assert.equal((await responsePromise).status(), 200);
      assert.deepEqual(
        await page.evaluate(() => (window as unknown as { __openedUrls: string[] }).__openedUrls),
        ["https://jobs.example-robotics.com/apply/robotics-software"]
      );

      await page.locator("#viewTabs").getByRole("tab", { name: "Tracker" }).click();
      await page.waitForFunction(() => document.querySelector("#trackerList")?.textContent?.includes("Robotics Software Engineer"));
      assert.match(await page.locator("#trackerList").innerText(), /Example Robotics/);
      assert.match(await page.locator("#trackerList").innerText(), /Controls Engineer/);
      await assertNoHorizontalOverflow(page, "jooble direct source discovery");
      assert.deepEqual(consoleMessages, [], "jooble direct source discovery: console/page errors");
    } finally {
      await browser.close();
    }
  });
});

test("malformed listing dates render stable fallback text", async () => {
  await withServer(async ({ baseUrl, cwd }) => {
    await seedMalformedLatestOutput(cwd);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const consoleMessages: string[] = [];
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) {
        consoleMessages.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => {
      consoleMessages.push(`pageerror: ${error.message}`);
    });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await closeOnboarding(page);
      const resultsText = await page.locator("#resultsList").innerText();
      assert.match(resultsText, /Date unknown/);
      assert.doesNotMatch(resultsText, /Invalid Date/);
      await page.locator("[data-listing-sort]").selectOption("newest");
      assert.equal(await page.locator(".listing-card h3").first().innerText(), "Fresh Date Engineer");
      await assertNoHorizontalOverflow(page, "malformed listing date fallback");
      assert.deepEqual(consoleMessages, [], "malformed listing date fallback: console/page errors");
    } finally {
      await browser.close();
    }
  });
});

test("external job links isolate opened tabs", async () => {
  await withServer(async ({ baseUrl, cwd }) => {
    await seedLatestOutput(cwd);
    await addTrackedJob(baseUrl);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const consoleMessages: string[] = [];
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) {
        consoleMessages.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => {
      consoleMessages.push(`pageerror: ${error.message}`);
    });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await closeOnboarding(page);

      const dashboardLinks = page.locator("#resultsList a[target='_blank']");
      assert.equal(await dashboardLinks.count(), 4);
      await assertBlankTargetLinksAreIsolated(page, "#resultsList", "dashboard external job links");

      await page.locator("#viewTabs").getByRole("tab", { name: "Tracker" }).click();
      await page.waitForFunction(() => document.querySelector("#trackerList")?.textContent?.includes("Senior Platform Engineer"));
      const trackerLinks = page.locator("#trackerList a[target='_blank']");
      assert.equal(await trackerLinks.count(), 2);
      await assertBlankTargetLinksAreIsolated(page, "#trackerList", "tracker external job links");
      await assertNoHorizontalOverflow(page, "external job link isolation");
      assert.deepEqual(consoleMessages, [], "external job link isolation: console/page errors");
    } finally {
      await browser.close();
    }
  });
});

test("visible interactive controls have accessible names", async () => {
  await withServer(async ({ baseUrl, cwd }) => {
    await seedLatestOutput(cwd);
    await addTrackedJob(baseUrl);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await assertVisibleInteractiveControlsAreNamed(page, "onboarding");
      await assertVisibleSvgsAreHiddenOrNamed(page, "onboarding");
      await closeOnboarding(page);

      for (const tabName of ["Dashboard", "Tracker", "Settings"] as const) {
        await page.locator("#viewTabs").getByRole("tab", { name: tabName }).click();
        await page.waitForTimeout(150);
        if (tabName === "Tracker") {
          await page.locator("details.resume-tailor summary").first().click();
        }
        await assertVisibleInteractiveControlsAreNamed(page, tabName.toLowerCase());
        await assertVisibleSvgsAreHiddenOrNamed(page, tabName.toLowerCase());
      }
    } finally {
      await browser.close();
    }
  });
});

test("mobile interactive controls keep usable touch targets", async () => {
  await withServer(async ({ baseUrl, cwd }) => {
    await seedLatestOutput(cwd);
    await addTrackedJob(baseUrl);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await assertTouchTargets(page, "onboarding");
      await assertNoHorizontalOverflow(page, "onboarding mobile viewport");
      await assertElementNoHorizontalOverflow(page, ".onboarding-container", "onboarding container");
      await assertOnboardingToggleFocusVisible(page);
      await closeOnboarding(page);

      for (const tabName of ["Dashboard", "Tracker", "Settings"] as const) {
        await page.locator("#viewTabs").getByRole("tab", { name: tabName }).click();
        await page.waitForTimeout(150);
        await assertTouchTargets(page, tabName.toLowerCase());
      }
    } finally {
      await browser.close();
    }
  });
});

test("run search button exposes busy state and blocks duplicate clicks", async () => {
  await withServer(async ({ baseUrl }) => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    let runRequests = 0;

    await page.route("**/api/run-search", async (route) => {
      runRequests += 1;
      await page.waitForTimeout(350);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          generatedAt: "2026-05-18T23:15:30.000Z",
          summary: {
            totalFetched: 0,
            uniqueListings: 0,
            alertMatches: 0,
            newListings: 0
          },
          listings: [],
          alerts: []
        })
      });
    });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await closeOnboarding(page);
      const runButton = page.locator("#runButton");
      const box = await runButton.boundingBox();
      assert.ok(box, "run button should be visible");

      await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForFunction(() => document.querySelector("#runButton")?.textContent?.includes("Running"));
      assert.equal(await runButton.isDisabled(), true);
      assert.match(await runButton.innerText(), /Running/);

      await page.waitForFunction(() => document.querySelector("#runButton")?.getAttribute("aria-busy") === "false");
      assert.equal(await runButton.isDisabled(), false);
      assert.match(await runButton.innerText(), /Run Search/);
      assert.equal(runRequests, 1);
    } finally {
      await browser.close();
    }
  });
});

test("run search failures show a recoverable status alert", async () => {
  await withServer(async ({ baseUrl }) => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await page.route("**/api/run-search", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Provider credentials are missing."
        })
      });
    });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await closeOnboarding(page);
      await page.locator("#runButton").click();

      const alert = page.locator("#appStatus");
      await expectStatusText(alert, /Search failed: Provider credentials are missing\./);
      assert.equal(await alert.getAttribute("role"), "alert");
      assert.equal(await alert.getAttribute("aria-live"), "assertive");
      assert.equal(await page.locator("#runButton").isDisabled(), false);
      assert.equal(await page.locator("#runButton").getAttribute("aria-busy"), "false");
      await assertNoHorizontalOverflow(page, "run-search failure alert");
      assert.deepEqual(pageErrors, [], "run-search failure: page errors");
    } finally {
      await browser.close();
    }
  });
});

test("run search preserves save failures and does not start search", async () => {
  await withServer(async ({ baseUrl }) => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const pageErrors: string[] = [];
    let runRequests = 0;
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await page.route("**/api/config", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Configuration could not be saved before searching."
        })
      });
    });
    await page.route("**/api/run-search", async (route) => {
      runRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          generatedAt: "2026-05-18T23:15:30.000Z",
          summary: {
            totalFetched: 0,
            uniqueListings: 0,
            alertMatches: 0,
            newListings: 0
          },
          listings: [],
          alerts: []
        })
      });
    });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await closeOnboarding(page);
      await page.locator("#runButton").click();

      const alert = page.locator("#appStatus");
      await expectStatusText(alert, /Save failed: Configuration could not be saved before searching\./);
      assert.doesNotMatch(await alert.innerText(), /Search failed/);
      assert.equal(await page.locator("#runButton").isDisabled(), false);
      assert.equal(await page.locator("#runButton").getAttribute("aria-busy"), "false");
      assert.equal(runRequests, 0);
      await assertNoHorizontalOverflow(page, "run-search save failure alert");
      assert.deepEqual(pageErrors, [], "run-search save failure: page errors");
    } finally {
      await browser.close();
    }
  });
});

test("post-search status refresh failures keep successful results visible", async () => {
  await withServer(async ({ baseUrl }) => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const pageErrors: string[] = [];
    let statusRequests = 0;
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await page.route("**/api/run-search", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          generatedAt: "2026-05-18T23:15:30.000Z",
          summary: {
            totalFetched: 1,
            uniqueListings: 1,
            alertMatches: 0,
            newListings: 1
          },
          listings: [
            {
              provider: "greenhouse",
              title: "Senior Platform Engineer",
              company: "Zenith Systems",
              location: "Remote",
              employmentType: "Full-time",
              listingUrl: "https://example.com/jobs/platform",
              applyUrl: "https://example.com/apply/platform",
              description: "Build platform automation with Node and TypeScript.",
              score: 94,
              reasons: ["keyword: TypeScript"],
              postedAt: "2026-05-18T12:00:00.000Z",
              isNew: true
            }
          ],
          alerts: []
        })
      });
    });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await closeOnboarding(page);
      await page.route("**/api/status", async (route) => {
        statusRequests += 1;
        if (statusRequests === 1) {
          await route.continue();
          return;
        }

        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: "Status could not be refreshed after search."
          })
        });
      });
      await page.locator("#runButton").click();

      const alert = page.locator("#appStatus");
      await expectStatusText(alert, /Search completed, but status refresh failed: Status could not be refreshed after search\./);
      assert.doesNotMatch(await alert.innerText(), /Search failed/);
      assert.match(await page.locator("#resultsList").innerText(), /Senior Platform Engineer/);
      assert.equal(await page.locator("#runButton").isDisabled(), false);
      await assertNoHorizontalOverflow(page, "post-search status refresh failure alert");
      assert.deepEqual(pageErrors, [], "post-search status refresh failure: page errors");
    } finally {
      await browser.close();
    }
  });
});

test("browser notification dispatch failures do not fail successful searches", async () => {
  await withServer(async ({ baseUrl }) => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await page.route("**/api/run-search", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          generatedAt: "2026-05-18T23:15:30.000Z",
          summary: {
            totalFetched: 1,
            uniqueListings: 1,
            alertMatches: 1,
            newListings: 1
          },
          listings: [
            {
              provider: "greenhouse",
              title: "Senior Platform Engineer",
              company: "Zenith Systems",
              location: "Remote",
              employmentType: "Full-time",
              listingUrl: "https://example.com/jobs/platform",
              applyUrl: "https://example.com/apply/platform",
              description: "Build platform automation with Node and TypeScript.",
              score: 94,
              reasons: ["keyword: TypeScript"],
              postedAt: "2026-05-18T12:00:00.000Z",
              isNew: true
            }
          ],
          alerts: [
            {
              id: "platform",
              name: "Platform roles",
              count: 1,
              browser: true,
              listings: [
                {
                  title: "Senior Platform Engineer",
                  company: "Zenith Systems",
                  score: 94
                }
              ]
            }
          ]
        })
      });
    });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await closeOnboarding(page);
      await page.evaluate(`(() => {
        function BlockedNotification() {
          throw new Error("Notification dispatch blocked.");
        }

        Object.defineProperty(BlockedNotification, "permission", {
          configurable: true,
          value: "granted"
        });
        Object.defineProperty(window, "Notification", {
          configurable: true,
          value: BlockedNotification
        });
      })()`);
      await page.locator("#runButton").click();

      const alert = page.locator("#appStatus");
      await expectStatusText(alert, /Browser alert failed: Notification dispatch blocked\./);
      assert.doesNotMatch(await alert.innerText(), /Search failed/);
      assert.match(await page.locator("#resultsList").innerText(), /Senior Platform Engineer/);
      assert.equal(await page.locator("#runButton").isDisabled(), false);
      await assertNoHorizontalOverflow(page, "notification dispatch failure alert");
      assert.deepEqual(pageErrors, [], "notification dispatch failure: page errors");
    } finally {
      await browser.close();
    }
  });
});

test("save failures show a recoverable status alert", async () => {
  await withServer(async ({ baseUrl }) => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await page.route("**/api/config", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Configuration could not be saved."
        })
      });
    });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await closeOnboarding(page);
      await page.locator("#viewTabs").getByRole("tab", { name: "Settings" }).click();
      await page.locator("#saveButton").click();

      const alert = page.locator("#appStatus");
      await expectStatusText(alert, /Save failed: Configuration could not be saved\./);
      assert.equal(await alert.getAttribute("role"), "alert");
      assert.equal(await alert.getAttribute("aria-live"), "assertive");
      assert.equal(await page.locator("#saveButton").isDisabled(), false);
      assert.equal(await page.locator("#saveButton").getAttribute("aria-busy"), "false");
      assert.match(await page.locator("#saveButton").innerText(), /Save/);
      await page.getByRole("button", { name: "Dismiss status message" }).click();
      assert.equal(await alert.isHidden(), true);
      assert.equal(await alert.innerText(), "");
      assert.equal(await alert.getAttribute("role"), "status");
      assert.equal(await alert.getAttribute("aria-live"), "polite");
      assert.equal(await alert.getAttribute("aria-atomic"), "true");
      await assertNoHorizontalOverflow(page, "save failure alert");
      assert.deepEqual(pageErrors, [], "save failure: page errors");
    } finally {
      await browser.close();
    }
  });
});

test("settings numeric zero values save instead of reverting to prior values", async () => {
  await withServer(async ({ baseUrl }) => {
    const seedResponse = await fetch(`${baseUrl}/api/config`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
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
        alerts: [
          {
            id: "zero-score",
            name: "Zero score alert",
            enabled: true,
            minScore: 75,
            newOnly: false,
            keywords: [],
            providers: [],
            companies: [],
            browser: false
          }
        ],
        schedule: {
          enabled: false,
          intervalMinutes: 60,
          timezone: "America/Phoenix"
        }
      })
    });
    assert.equal(seedResponse.status, 200);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await closeOnboarding(page);
      await page.locator("#viewTabs").getByRole("tab", { name: "Settings" }).click();
      await page.locator('[data-step-index="4"]').click();
      await page.locator("[data-ranking-remote-boost]").fill("0");
      await page.locator("[data-ranking-freshness-boost]").fill("0");
      await page.locator("[data-ranking-compensation-boost]").fill("0");
      await page.locator("[data-ranking-keyword-boost]").fill("0");

      await page.locator('[data-step-index="5"]').click();
      await page.locator('[data-alert-min-score="0"]').fill("0");
      await page.locator("#saveButton").click();
      await page.waitForFunction(() => document.querySelector("#saveButton")?.getAttribute("aria-busy") === "false");

      const savedConfig = await (await fetch(`${baseUrl}/api/config`)).json();
      assert.equal(savedConfig.ranking.remoteBoost, 0);
      assert.equal(savedConfig.ranking.freshnessBoost, 0);
      assert.equal(savedConfig.ranking.compensationBoost, 0);
      assert.equal(savedConfig.ranking.keywordBoost, 0);
      assert.equal(savedConfig.alerts[0].minScore, 0);
      await assertNoHorizontalOverflow(page, "settings zero numeric values");
      assert.deepEqual(pageErrors, [], "settings zero numeric values: page errors");
    } finally {
      await browser.close();
    }
  });
});

test("settings bounded numeric values clamp before save", async () => {
  await withServer(async ({ baseUrl }) => {
    const seedResponse = await fetch(`${baseUrl}/api/config`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        searches: [
          {
            provider: "adzuna",
            query: "software engineer",
            page: 1,
            limit: 25
          }
        ],
        boards: [
          {
            provider: "lever",
            source: "openai",
            includeDescription: false,
            limit: 50
          }
        ],
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
        alerts: [
          {
            id: "bounded-score",
            name: "Bounded score alert",
            enabled: true,
            minScore: 75,
            newOnly: false,
            keywords: [],
            providers: [],
            companies: [],
            browser: false
          }
        ],
        schedule: {
          enabled: true,
          intervalMinutes: 60,
          timezone: "America/Phoenix"
        }
      })
    });
    assert.equal(seedResponse.status, 200);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await closeOnboarding(page);
      await page.locator("#viewTabs").getByRole("tab", { name: "Settings" }).click();
      await page.locator('[data-step-index="1"]').click();
      await page.locator('[data-search-page="0"]').fill("1.6");
      await page.locator('[data-search-limit="0"]').fill("150");

      await page.locator('[data-step-index="2"]').click();
      await page.locator('[data-board-limit="0"]').fill("0");

      await page.locator('[data-step-index="4"]').click();
      await page.locator("[data-ranking-remote-boost]").fill("99");
      await page.locator("[data-ranking-freshness-boost]").fill("-2");
      await page.locator("[data-ranking-compensation-boost]").fill("12.6");
      await page.locator("[data-ranking-keyword-boost]").fill("30");

      await page.locator('[data-step-index="5"]').click();
      await page.locator('[data-alert-min-score="0"]').fill("150");
      await page.locator("[data-schedule-interval]").fill("1");
      await page.locator("#saveButton").click();
      await page.waitForFunction(() => document.querySelector("#saveButton")?.getAttribute("aria-busy") === "false");

      const savedConfig = await (await fetch(`${baseUrl}/api/config`)).json();
      assert.equal(savedConfig.searches[0].page, 2);
      assert.equal(savedConfig.searches[0].limit, 100);
      assert.equal(savedConfig.boards[0].limit, 1);
      assert.equal(savedConfig.ranking.remoteBoost, 30);
      assert.equal(savedConfig.ranking.freshnessBoost, 0);
      assert.equal(savedConfig.ranking.compensationBoost, 13);
      assert.equal(savedConfig.ranking.keywordBoost, 30);
      assert.equal(savedConfig.alerts[0].minScore, 100);
      assert.equal(savedConfig.schedule.intervalMinutes, 5);
      await assertNoHorizontalOverflow(page, "settings bounded numeric values");
      assert.deepEqual(pageErrors, [], "settings bounded numeric values: page errors");
    } finally {
      await browser.close();
    }
  });
});

test("settings quiet hours use time inputs and omit invalid values before save", async () => {
  await withServer(async ({ baseUrl }) => {
    const seedResponse = await fetch(`${baseUrl}/api/config`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
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
          intervalMinutes: 60,
          timezone: "America/Phoenix",
          quietHoursStart: "23:00",
          quietHoursEnd: "07:00"
        }
      })
    });
    assert.equal(seedResponse.status, 200);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await closeOnboarding(page);
      await page.locator("#viewTabs").getByRole("tab", { name: "Settings" }).click();
      await page.locator('[data-step-index="5"]').click();
      assert.equal(await page.locator("[data-schedule-quiet-start]").getAttribute("type"), "time");
      assert.equal(await page.locator("[data-schedule-quiet-end]").getAttribute("type"), "time");
      assert.match(await page.locator("#stepContent").innerText(), /Invalid entries are ignored on save/);

      await page.evaluate(() => {
        const start = document.querySelector("[data-schedule-quiet-start]");
        const end = document.querySelector("[data-schedule-quiet-end]");
        start?.setAttribute("type", "text");
        end?.setAttribute("type", "text");
        if (start instanceof HTMLInputElement) {
          start.value = "25:99";
        }
        if (end instanceof HTMLInputElement) {
          end.value = "07:30";
        }
      });
      await page.locator("#saveButton").click();
      await page.waitForFunction(() => document.querySelector("#saveButton")?.getAttribute("aria-busy") === "false");

      const savedConfig = await (await fetch(`${baseUrl}/api/config`)).json();
      assert.equal(savedConfig.schedule.quietHoursStart, undefined);
      assert.equal(savedConfig.schedule.quietHoursEnd, "07:30");
      await assertNoHorizontalOverflow(page, "settings quiet hour normalization");
      assert.deepEqual(pageErrors, [], "settings quiet hour normalization: page errors");
    } finally {
      await browser.close();
    }
  });
});

test("settings timezone input falls back before save when invalid", async () => {
  await withServer(async ({ baseUrl }) => {
    const seedResponse = await fetch(`${baseUrl}/api/config`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
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
          intervalMinutes: 60,
          timezone: "America/Phoenix",
          quietHoursStart: "23:00",
          quietHoursEnd: "07:00"
        }
      })
    });
    assert.equal(seedResponse.status, 200);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await closeOnboarding(page);
      await page.locator("#viewTabs").getByRole("tab", { name: "Settings" }).click();
      await page.locator('[data-step-index="5"]').click();
      assert.match(await page.locator("#stepContent").innerText(), /Invalid timezone names fall back/);
      await page.locator("[data-schedule-timezone]").fill("Mars/Phobos");
      await page.locator("#saveButton").click();
      await page.waitForFunction(() => document.querySelector("#saveButton")?.getAttribute("aria-busy") === "false");

      const savedConfig = await (await fetch(`${baseUrl}/api/config`)).json();
      assert.equal(savedConfig.schedule.timezone, "America/Phoenix");

      await page.locator('[data-step-index="5"]').click();
      assert.equal(await page.locator("[data-schedule-timezone]").inputValue(), "America/Phoenix");
      await assertNoHorizontalOverflow(page, "settings timezone normalization");
      assert.deepEqual(pageErrors, [], "settings timezone normalization: page errors");
    } finally {
      await browser.close();
    }
  });
});

test("settings webhook fields use url inputs and omit unsupported urls before save", async () => {
  await withServer(async ({ baseUrl }) => {
    const seedResponse = await fetch(`${baseUrl}/api/config`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
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
        alerts: [
          {
            id: "bad-webhook",
            name: "Bad webhook",
            enabled: true,
            minScore: 75,
            newOnly: false,
            keywords: [],
            providers: [],
            companies: [],
            browser: false
          },
          {
            id: "private-webhook",
            name: "Private webhook",
            enabled: true,
            minScore: 75,
            newOnly: false,
            keywords: [],
            providers: [],
            companies: [],
            browser: false
          },
          {
            id: "good-webhook",
            name: "Good webhook",
            enabled: true,
            minScore: 75,
            newOnly: false,
            keywords: [],
            providers: [],
            companies: [],
            browser: false
          }
        ],
        schedule: {
          enabled: false,
          intervalMinutes: 60,
          timezone: "America/Phoenix"
        }
      })
    });
    assert.equal(seedResponse.status, 200);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await closeOnboarding(page);
      await page.locator("#viewTabs").getByRole("tab", { name: "Settings" }).click();
      await page.locator('[data-step-index="5"]').click();
      assert.equal(await page.locator('[data-alert-webhook="0"]').getAttribute("type"), "url");
      assert.match(await page.locator("#stepContent").innerText(), /private\/local hosts are ignored on save/);

      await page.evaluate(() => {
        const bad = document.querySelector('[data-alert-webhook="0"]');
        const privateHost = document.querySelector('[data-alert-webhook="1"]');
        const good = document.querySelector('[data-alert-webhook="2"]');
        bad?.setAttribute("type", "text");
        privateHost?.setAttribute("type", "text");
        if (bad instanceof HTMLInputElement) {
          bad.value = "ftp://example.com/hook";
        }
        if (privateHost instanceof HTMLInputElement) {
          privateHost.value = "http://127.0.0.1:3000/hook";
        }
        if (good instanceof HTMLInputElement) {
          good.value = "HTTPS://Example.com/hook";
        }
      });
      await page.locator("#saveButton").click();
      await page.waitForFunction(() => document.querySelector("#saveButton")?.getAttribute("aria-busy") === "false");

      const savedConfig = await (await fetch(`${baseUrl}/api/config`)).json();
      assert.equal(savedConfig.alerts[0].webhookUrl, undefined);
      assert.equal(savedConfig.alerts[1].webhookUrl, undefined);
      assert.equal(savedConfig.alerts[2].webhookUrl, "https://example.com/hook");
      await assertNoHorizontalOverflow(page, "settings webhook normalization");
      assert.deepEqual(pageErrors, [], "settings webhook normalization: page errors");
    } finally {
      await browser.close();
    }
  });
});

test("settings provider allow-lists drop unknown tokens before save", async () => {
  await withServer(async ({ baseUrl }) => {
    const seedResponse = await fetch(`${baseUrl}/api/config`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
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
        alerts: [
          {
            id: "provider-alert",
            name: "Provider alert",
            enabled: true,
            minScore: 75,
            newOnly: false,
            keywords: [],
            providers: [],
            companies: [],
            browser: false
          }
        ],
        schedule: {
          enabled: false,
          intervalMinutes: 60,
          timezone: "America/Phoenix"
        }
      })
    });
    assert.equal(seedResponse.status, 200);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await closeOnboarding(page);
      await page.locator("#viewTabs").getByRole("tab", { name: "Settings" }).click();
      await page.locator('[data-step-index="3"]').click();
      assert.match(await page.locator("#stepContent").innerText(), /Allowed providers: Adzuna, Jooble, Greenhouse, Lever, Ashby, Workable, Workday, SmartRecruiters, Recruitee, Personio, BambooHR, iCIMS Jibe, iCIMS Classic, Oracle CE, Taleo/);
      await page
        .locator("[data-filter-preferred-providers]")
        .fill("greenhousee, lever, ASHBY, jooble, lever");

      await page.locator('[data-step-index="5"]').click();
      assert.match(await page.locator("#stepContent").innerText(), /Unknown entries are ignored on save/);
      await page
        .locator('[data-alert-providers="0"]')
        .fill("fake, greenhouse, workable, greenhouse");
      await page.locator("#saveButton").click();
      await page.waitForFunction(() => document.querySelector("#saveButton")?.getAttribute("aria-busy") === "false");

      const savedConfig = await (await fetch(`${baseUrl}/api/config`)).json();
      assert.deepEqual(savedConfig.filters.preferredProviders, ["lever", "ashby", "jooble"]);
      assert.deepEqual(savedConfig.alerts[0].providers, ["greenhouse", "workable"]);

      await page.locator('[data-step-index="3"]').click();
      assert.equal(await page.locator("[data-filter-preferred-providers]").inputValue(), "lever, ashby, jooble");
      await page.locator('[data-step-index="5"]').click();
      assert.equal(await page.locator('[data-alert-providers="0"]').inputValue(), "greenhouse, workable");
      await assertNoHorizontalOverflow(page, "settings provider allow-list normalization");
      assert.deepEqual(pageErrors, [], "settings provider allow-list normalization: page errors");
    } finally {
      await browser.close();
    }
  });
});

test("settings source removals use inline confirmation without browser dialogs", async () => {
  await withServer(async ({ baseUrl }) => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const dialogs: string[] = [];
    const pageErrors: string[] = [];
    page.on("dialog", async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.dismiss();
    });
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await closeOnboarding(page);
      await page.locator("#viewTabs").getByRole("tab", { name: "Settings" }).click();
      await page.locator('[data-step-index="1"]').click();
      await page.locator("#addSearchButtonInline").click();

      await page.locator('[data-settings-remove="search"]').click();
      assert.deepEqual(dialogs, [], "settings source remove should not open a native confirmation dialog");
      assert.equal(await page.locator('[data-settings-confirm-remove="search"]').count(), 1);
      assert.equal(await page.locator('[data-settings-cancel-remove="search"]').count(), 1);
      assert.equal(
        await page.evaluate(() => document.activeElement?.getAttribute("data-settings-confirm-remove")),
        "search"
      );
      await assertNoHorizontalOverflow(page, "settings source remove inline confirmation");

      await page.locator('[data-search-provider="0"]').selectOption("jooble");
      assert.equal(await page.locator('[data-settings-confirm-remove="search"]').count(), 0);
      assert.equal(await page.locator('[data-settings-remove="search"]').count(), 1);

      await page.locator('[data-settings-remove="search"]').click();
      await page.locator('[data-settings-cancel-remove="search"]').click();
      assert.equal(await page.locator('[data-settings-confirm-remove="search"]').count(), 0);
      assert.equal(await page.locator('[data-settings-remove="search"]').count(), 1);

      await page.locator('[data-settings-remove="search"]').click();
      await page.locator('[data-step-index="2"]').click();
      await page.locator('[data-step-index="1"]').click();
      assert.equal(await page.locator('[data-settings-confirm-remove="search"]').count(), 0);
      assert.equal(await page.locator('[data-settings-remove="search"]').count(), 1);

      await page.locator('[data-settings-remove="search"]').click();
      await page.locator('[data-settings-confirm-remove="search"]').click();
      assert.match(await page.locator("#stepContent").innerText(), /No search API sources configured yet/);
      assert.deepEqual(pageErrors, [], "settings source remove inline confirmation: page errors");
    } finally {
      await browser.close();
    }
  });
});

test("tracker mutation failures show an alert and restore rendered state", async () => {
  await withServer(async ({ baseUrl }) => {
    await addVisitedJob(baseUrl);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await page.route("**/api/tracker/applied", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Tracker storage is unavailable."
        })
      });
    });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await closeOnboarding(page);
      await page.locator("#viewTabs").getByRole("tab", { name: "Tracker" }).click();
      const applied = page.locator("[data-tracker-applied]").first();
      assert.equal(await applied.isChecked(), false);

      await applied.click();

      const alert = page.locator("#appStatus");
      await expectStatusText(alert, /Tracker update failed: Tracker storage is unavailable\./);
      assert.equal(await alert.getAttribute("role"), "alert");
      assert.equal(await applied.isChecked(), false);
      await assertNoHorizontalOverflow(page, "tracker mutation failure alert");
      assert.deepEqual(pageErrors, [], "tracker mutation failure: page errors");
    } finally {
      await browser.close();
    }
  });
});

test("tracker applied and status controls block duplicate in-flight mutations", async () => {
  await withServer(async ({ baseUrl }) => {
    await addVisitedJob(baseUrl);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const pageErrors: string[] = [];
    let appliedRequests = 0;
    let statusRequests = 0;
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await page.route("**/api/tracker/applied", async (route) => {
      appliedRequests += 1;
      await page.waitForTimeout(350);
      await route.continue();
    });
    await page.route("**/api/tracker/status", async (route) => {
      statusRequests += 1;
      await page.waitForTimeout(350);
      await route.continue();
    });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await closeOnboarding(page);
      await page.locator("#viewTabs").getByRole("tab", { name: "Tracker" }).click();

      await page.locator("[data-tracker-applied]").click();
      await page.waitForFunction(() => document.querySelector("[data-tracker-applied]")?.getAttribute("aria-busy") === "true");
      assert.equal(await page.locator("[data-tracker-applied]").isDisabled(), true);
      await page.evaluate(() => {
        document
          .querySelector("[data-tracker-applied]")
          ?.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await page.waitForFunction(() => !document.querySelector("[data-tracker-applied]")?.hasAttribute("disabled"));
      assert.equal(appliedRequests, 1);
      assert.equal(await page.locator("[data-tracker-applied]").isChecked(), true);

      await page.locator("[data-tracker-status]").selectOption("interview");
      await page.waitForFunction(() => document.querySelector("[data-tracker-status]")?.getAttribute("aria-busy") === "true");
      assert.equal(await page.locator("[data-tracker-status]").isDisabled(), true);
      await page.evaluate(() => {
        const status = document.querySelector("[data-tracker-status]");
        if (status instanceof HTMLSelectElement) {
          status.value = "accepted";
          status.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
      await page.waitForFunction(() => !document.querySelector("[data-tracker-status]")?.hasAttribute("disabled"));
      assert.equal(statusRequests, 1);
      assert.equal(await page.locator("[data-tracker-status]").inputValue(), "interview");
      await assertNoHorizontalOverflow(page, "tracker duplicate mutation busy states");
      assert.deepEqual(pageErrors, [], "tracker duplicate mutation busy states: page errors");
    } finally {
      await browser.close();
    }
  });
});

test("tracker remove confirmation blocks duplicate in-flight removals", async () => {
  await withServer(async ({ baseUrl }) => {
    await addTrackedJob(baseUrl);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const pageErrors: string[] = [];
    let removeRequests = 0;
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await page.route("**/api/tracker/remove", async (route) => {
      removeRequests += 1;
      await page.waitForTimeout(350);
      await route.continue();
    });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await closeOnboarding(page);
      await page.locator("#viewTabs").getByRole("tab", { name: "Tracker" }).click();

      await page.locator("[data-tracker-remove]").click();
      await page.locator("[data-tracker-confirm-remove]").click();
      await page.waitForFunction(() => document.querySelector("[data-tracker-confirm-remove]")?.getAttribute("aria-busy") === "true");
      assert.equal(await page.locator("[data-tracker-confirm-remove]").isDisabled(), true);
      assert.match(await page.locator("[data-tracker-confirm-remove]").innerText(), /Removing/);

      await page.evaluate(() => {
        document
          .querySelector("[data-tracker-confirm-remove]")
          ?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });

      await page.waitForFunction(() => document.querySelector("#trackerList")?.textContent?.includes("No tracked jobs yet"));
      assert.equal(removeRequests, 1);
      assert.match(await page.locator("#trackerList").innerText(), /No tracked jobs yet/);
      await assertNoHorizontalOverflow(page, "tracker duplicate remove busy state");
      assert.deepEqual(pageErrors, [], "tracker duplicate remove busy state: page errors");
    } finally {
      await browser.close();
    }
  });
});

test("tracker removals use inline confirmation without browser dialogs", async () => {
  await withServer(async ({ baseUrl }) => {
    await addTrackedJob(baseUrl);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const dialogs: string[] = [];
    const pageErrors: string[] = [];
    page.on("dialog", async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.dismiss();
    });
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await closeOnboarding(page);
      await page.locator("#viewTabs").getByRole("tab", { name: "Tracker" }).click();

      await page.locator("[data-tracker-remove]").click();
      assert.deepEqual(dialogs, [], "remove should not open a native confirmation dialog");
      assert.equal(await page.locator("[data-tracker-confirm-remove]").count(), 1);
      assert.equal(await page.locator("[data-tracker-cancel-remove]").count(), 1);
      assert.equal(
        await page.evaluate(() => document.activeElement?.hasAttribute("data-tracker-confirm-remove")),
        true
      );
      await assertNoHorizontalOverflow(page, "tracker remove inline confirmation");

      await page.locator("[data-tracker-filter-query]").fill("Platform");
      assert.equal(await page.locator("[data-tracker-confirm-remove]").count(), 0);
      assert.equal(await page.locator("[data-tracker-remove]").count(), 1);

      await page.locator("[data-tracker-remove]").click();
      await page.locator("[data-tracker-filter-status]").selectOption("applied");
      assert.equal(await page.locator("[data-tracker-confirm-remove]").count(), 0);
      await page.locator("[data-tracker-filter-status]").selectOption("all");

      await page.locator("[data-tracker-filter-query]").fill("Platform");
      await page.locator("[data-tracker-remove]").click();
      await page.locator("[data-clear-tracker-filters]").click();
      assert.equal(await page.locator("[data-tracker-confirm-remove]").count(), 0);
      assert.equal(await page.locator("[data-tracker-filter-query]").inputValue(), "");

      await page.locator("[data-tracker-remove]").click();
      await page.locator("[data-tracker-cancel-remove]").click();
      assert.equal(await page.locator("[data-tracker-confirm-remove]").count(), 0);
      assert.match(await page.locator("#trackerList").innerText(), /Senior Platform Engineer/);

      await page.locator("[data-tracker-remove]").click();
      await page.locator("[data-tracker-confirm-remove]").click();
      await page.waitForFunction(() => document.querySelector("#trackerList")?.textContent?.includes("No tracked jobs yet"));
      assert.match(await page.locator("#trackerList").innerText(), /No tracked jobs yet/);
      assert.deepEqual(pageErrors, [], "tracker remove inline confirmation: page errors");
    } finally {
      await browser.close();
    }
  });
});

test("tracker removal cancels pending resume autosave for that job", async () => {
  await withServer(async ({ baseUrl }) => {
    await addVisitedJob(baseUrl);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const pageErrors: string[] = [];
    const resumeSaveRequests: string[] = [];
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await page.route("**/api/tracker/resume", async (route) => {
      resumeSaveRequests.push(route.request().postData() ?? "");
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Removed job should not save resume fields."
        })
      });
    });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await closeOnboarding(page);
      await page.locator("#viewTabs").getByRole("tab", { name: "Tracker" }).click();
      await page.locator(".resume-tailor summary").click();
      await page.locator("[data-tracker-resume-notes]").fill("Emphasize automation projects.");

      await page.locator("[data-tracker-remove]").click();
      await page.locator("[data-tracker-confirm-remove]").click();
      await page.waitForFunction(() => document.querySelector("#trackerList")?.textContent?.includes("No tracked jobs yet"));
      await page.waitForTimeout(750);

      assert.deepEqual(resumeSaveRequests, []);
      assert.equal(await page.locator("#appStatus").isHidden(), true);
      await assertNoHorizontalOverflow(page, "tracker remove cancels pending resume autosave");
      assert.deepEqual(pageErrors, [], "tracker remove cancels pending resume autosave: page errors");
    } finally {
      await browser.close();
    }
  });
});

test("resume text inputs clamp before local storage and autosave", async () => {
  await withServer(async ({ baseUrl }) => {
    await addVisitedJob(baseUrl);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const pageErrors: string[] = [];
    let resumePayload: {
      resumeNotes?: string;
      resumeDraft?: string;
      jobDescriptionOverride?: string;
    } | null = null;
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await page.route("**/api/tracker/resume", async (route) => {
      resumePayload = JSON.parse(route.request().postData() ?? "{}");
      await route.continue();
    });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await closeOnboarding(page);
      await page.locator("#viewTabs").getByRole("tab", { name: "Tracker" }).click();
      await page.locator(".resume-tailor summary").click();

      for (const selector of [
        "[data-resume-source]",
        "[data-tracker-job-description]",
        "[data-tracker-resume-notes]",
        "[data-tracker-resume-draft]"
      ]) {
        assert.equal(await page.locator(selector).getAttribute("maxlength"), "50000");
      }

      const oversizedText = "a".repeat(50_250);
      await page.locator("[data-resume-source]").evaluate((element, value) => {
        const textarea = element as HTMLTextAreaElement;
        textarea.value = value;
        textarea.dispatchEvent(new InputEvent("input", { bubbles: true, data: "a" }));
      }, oversizedText);
      assert.equal((await page.locator("[data-resume-source]").inputValue()).length, 50_000);

      await page.locator("[data-tracker-resume-notes]").evaluate((element, value) => {
        const textarea = element as HTMLTextAreaElement;
        textarea.value = value;
        textarea.dispatchEvent(new InputEvent("input", { bubbles: true, data: "a" }));
      }, oversizedText);

      await page.waitForFunction(() => {
        const status = document.querySelector("[data-resume-save-status]");
        return status?.textContent?.includes("saved") && status.classList.contains("ok");
      });

      assert.equal((await page.locator("[data-tracker-resume-notes]").inputValue()).length, 50_000);
      assert.equal(resumePayload?.resumeNotes?.length, 50_000);
      assert.equal(resumePayload?.resumeDraft?.length, 0);
      assert.equal(resumePayload?.jobDescriptionOverride?.length, 0);
      await assertNoHorizontalOverflow(page, "resume text clamp");
      assert.deepEqual(pageErrors, [], "resume text clamp: page errors");
    } finally {
      await browser.close();
    }
  });
});

test("resume autosave serializes overlapping edits for the same job", async () => {
  await withServer(async ({ baseUrl }) => {
    await addVisitedJob(baseUrl);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const pageErrors: string[] = [];
    const resumePayloads: string[] = [];
    let releaseFirstSave: (() => void) | null = null;
    let markFirstSaveStarted: (() => void) | null = null;
    const firstSaveStarted = new Promise<void>((resolve) => {
      markFirstSaveStarted = resolve;
    });
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await page.route("**/api/tracker/resume", async (route) => {
      resumePayloads.push(route.request().postData() ?? "");
      if (resumePayloads.length === 1) {
        markFirstSaveStarted?.();
        await new Promise<void>((resolve) => {
          releaseFirstSave = resolve;
        });
      }

      await route.continue();
    });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await closeOnboarding(page);
      await page.locator("#viewTabs").getByRole("tab", { name: "Tracker" }).click();
      await page.locator(".resume-tailor summary").click();

      await page.locator("[data-tracker-resume-notes]").fill("First draft");
      await Promise.race([
        firstSaveStarted,
        page.waitForTimeout(2_000).then(() => {
          throw new Error("Timed out waiting for first resume save request.");
        })
      ]);
      await page.waitForFunction(
        () => document.querySelector("[data-resume-save-status]")?.textContent?.includes("Saving"),
        undefined,
        { timeout: 2_000 }
      );
      assert.equal(resumePayloads.length, 1);

      await page.locator("[data-tracker-resume-notes]").fill("Second draft");
      await page.waitForTimeout(750);
      assert.equal(resumePayloads.length, 1, "newer edit should wait for in-flight resume save");

      releaseFirstSave?.();
      await waitForTestCondition(() => resumePayloads.length === 2, "second resume save request");
      await page.waitForFunction(() => {
        const status = document.querySelector("[data-resume-save-status]");
        return status?.textContent?.includes("saved") && status.classList.contains("ok");
      });

      assert.equal(resumePayloads.length, 2);
      assert.equal(JSON.parse(resumePayloads[0]).resumeNotes, "First draft");
      assert.equal(JSON.parse(resumePayloads[1]).resumeNotes, "Second draft");
      await assertNoHorizontalOverflow(page, "resume autosave overlapping edits");
      assert.deepEqual(pageErrors, [], "resume autosave overlapping edits: page errors");
    } finally {
      releaseFirstSave?.();
      await browser.close();
    }
  });
});

test("resume auto-save failures expose inline and global recovery state", async () => {
  await withServer(async ({ baseUrl }) => {
    await addVisitedJob(baseUrl);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await page.route("**/api/tracker/resume", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Resume state could not be saved."
        })
      });
    });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await closeOnboarding(page);
      await page.locator("#viewTabs").getByRole("tab", { name: "Tracker" }).click();
      await page.locator(".resume-tailor summary").click();
      await page.locator("[data-tracker-resume-notes]").fill("Emphasize automation projects.");

      const alert = page.locator("#appStatus");
      await expectStatusText(alert, /Tracker resume save failed: Resume state could not be saved\./);
      await page.waitForFunction(() => {
        const status = document.querySelector("[data-resume-save-status]");
        return status?.textContent?.includes("were not saved") && status.classList.contains("error");
      });
      await assertNoHorizontalOverflow(page, "resume autosave failure alert");
      assert.deepEqual(pageErrors, [], "resume autosave failure: page errors");
    } finally {
      await browser.close();
    }
  });
});

test("resume source local storage failures show a recoverable alert", async () => {
  await withServer(async ({ baseUrl }) => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await closeOnboarding(page);
      await page.locator("#viewTabs").getByRole("tab", { name: "Tracker" }).click();
      await page.evaluate(`(() => {
        const originalSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function(key, value) {
          if (key === "jobWorkbenchResumeSource") {
            throw new Error("Local storage unavailable.");
          }
          return originalSetItem.call(this, key, value);
        };
      })()`);

      await page.locator("[data-resume-source]").fill("Current resume text");
      const alert = page.locator("#appStatus");
      await expectStatusText(alert, /Resume source was not saved in this browser\./);
      assert.equal(await alert.getAttribute("role"), "alert");
      await assertNoHorizontalOverflow(page, "resume source storage failure alert");
      assert.deepEqual(pageErrors, [], "resume source storage failure: page errors");
    } finally {
      await browser.close();
    }
  });
});

test("copy prompt failures show a recoverable status alert", async () => {
  await withServer(async ({ baseUrl }) => {
    await addVisitedJob(baseUrl);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await closeOnboarding(page);
      await page.locator("#viewTabs").getByRole("tab", { name: "Tracker" }).click();
      await page.locator(".resume-tailor summary").click();
      await page.evaluate(`(() => {
        const blockedClipboard = {
          writeText: () => Promise.reject(new Error("Clipboard permission denied."))
        };

        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: blockedClipboard
        });
      })()`);
      await page.locator("[data-copy-resume-prompt]").click();

      const alert = page.locator("#appStatus");
      await expectStatusText(alert, /Copy prompt failed: Clipboard permission denied\./);
      assert.equal(await alert.getAttribute("role"), "alert");
      assert.equal(await page.locator("[data-copy-resume-prompt]").innerText(), "Copy AI Prompt");
      await assertNoHorizontalOverflow(page, "copy prompt failure alert");
      assert.deepEqual(pageErrors, [], "copy prompt failure: page errors");
    } finally {
      await browser.close();
    }
  });
});

test("tracker export link starts a workbook download from the rendered UI", async () => {
  await withServer(async ({ baseUrl }) => {
    await addTrackedJob(baseUrl);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const consoleMessages: string[] = [];
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) {
        consoleMessages.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => {
      consoleMessages.push(`pageerror: ${error.message}`);
    });

    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await closeOnboarding(page);
      await page.locator("#viewTabs").getByRole("tab", { name: "Tracker" }).click();
      await assertNoHorizontalOverflow(page, "tracker export before download");

      const downloadPromise = page.waitForEvent("download");
      await page.locator('a[download="applied-jobs.xls"]').click();
      const download = await downloadPromise;

      assert.equal(download.suggestedFilename(), "applied-jobs.xls");
      assert.deepEqual(consoleMessages, [], "tracker export download: console/page errors");
    } finally {
      await browser.close();
    }
  });
});

test("view tabs expose selected panel state and keyboard navigation", async () => {
  await withServer(async ({ baseUrl }) => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await closeOnboarding(page);
      await page.locator("#dashboardTab").focus();
      await assertTabState(page, "dashboard");

      await page.locator("#dashboardTab").focus();
      await page.keyboard.press("ArrowRight");
      await assertTabState(page, "tracker");

      await page.keyboard.press("ArrowRight");
      await assertTabState(page, "settings");

      await page.keyboard.press("Home");
      await assertTabState(page, "dashboard");

      await page.keyboard.press("End");
      await assertTabState(page, "settings");
      assert.equal(await page.locator('#stepRail [aria-current="step"]').count(), 1);
      assert.match(await page.locator('#stepRail [aria-current="step"]').innerText(), /Quick Setup/);
      await assertNoHorizontalOverflow(page, "tab keyboard navigation");
    } finally {
      await browser.close();
    }
  });
});

test("reduced motion preference suppresses visible UI animations", async () => {
  await withServer(async ({ baseUrl }) => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    try {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await assertReducedMotionStyles(page, "onboarding");
      await closeOnboarding(page);
      await assertReducedMotionStyles(page, "dashboard");
      await page.locator("#viewTabs").getByRole("tab", { name: "Settings" }).click();
      await assertReducedMotionStyles(page, "settings");
    } finally {
      await browser.close();
    }
  });
});

async function assertSurface({
  browser,
  baseUrl,
  name,
  viewport,
  tabName,
  expectedViewId,
  expectedText,
  expectedTrackerClass
}: {
  browser: Awaited<ReturnType<typeof chromium.launch>>;
  baseUrl: string;
  name: string;
  viewport: ViewportSize;
  tabName: "Dashboard" | "Settings" | "Tracker";
  expectedViewId: string;
  expectedText: string;
  expectedTrackerClass?: string;
}): Promise<void> {
  const page = await browser.newPage({ viewport });
  const consoleMessages: string[] = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleMessages.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    consoleMessages.push(`pageerror: ${error.message}`);
  });

  try {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await closeOnboarding(page);
    await page.locator("#viewTabs").getByRole("tab", { name: tabName }).click();
    await page.waitForTimeout(150);

    const bodyText = await page.locator("body").innerText();
    const metrics = await page.evaluate(() => ({
      innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      activeViewId: document.querySelector(".app-view.active")?.id,
      trackerClass: document.querySelector("#trackerList")?.className ?? ""
    }));

    assert.equal(await page.title(), "Job Search Workbench", `${name}: page title`);
    assert.match(bodyText, /Job Search Workbench/, `${name}: app identity text`);
    assert.match(bodyText, new RegExp(escapeRegExp(expectedText)), `${name}: expected view text`);
    assert.equal(metrics.activeViewId, expectedViewId, `${name}: active tab`);
    assert.equal(metrics.documentWidth, metrics.innerWidth, `${name}: document overflow`);
    assert.equal(metrics.bodyWidth, metrics.innerWidth, `${name}: body overflow`);
    await assertElementNoHorizontalOverflow(page, `#${expectedViewId}`, `${name}: active view`);
    if (expectedTrackerClass) {
      assert.equal(metrics.trackerClass, expectedTrackerClass, `${name}: tracker state class`);
      await assertElementNoHorizontalOverflow(page, "#trackerList", `${name}: tracker list`);
    }
    assert.deepEqual(consoleMessages, [], `${name}: console/page errors`);
  } finally {
    await page.close();
  }
}

async function closeOnboarding(page: Page): Promise<void> {
  if ((await page.locator("#onboardingOverlay.visible").count()) > 0) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(650);
  }
}

async function advanceOnboardingToFinal(page: Page): Promise<void> {
  for (let step = 2; step <= 6; step += 1) {
    await page.locator("#obNext").click();
    await page.waitForFunction(
      (label) =>
        document
          .querySelector('#onboardingDots [aria-current="step"]')
          ?.getAttribute("aria-label") === label,
      `Step ${step}`
    );
  }
}

async function assertTrackerFiltering(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  baseUrl: string
): Promise<void> {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const consoleMessages: string[] = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleMessages.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    consoleMessages.push(`pageerror: ${error.message}`);
  });

  try {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await closeOnboarding(page);
    await page.locator("#viewTabs").getByRole("tab", { name: "Tracker" }).click();
    await page.locator("[data-tracker-filter-query]").click();
    await page.keyboard.type("Platform");
    assert.equal(await page.locator("[data-tracker-filter-query]").inputValue(), "Platform");
    await assertNoHorizontalOverflow(page, "tracker query match");
    assert.match(await page.locator("#trackerList").innerText(), /Senior Platform Engineer/);

    await page.locator("[data-tracker-filter-query]").fill("NoMatch");
    await assertNoHorizontalOverflow(page, "tracker query empty");
    assert.match(await page.locator("#trackerList").innerText(), /No tracked jobs match/);
    await page.locator("[data-clear-tracker-filters]").click();
    assert.equal(await page.locator("[data-tracker-filter-query]").inputValue(), "");
    assert.equal(await page.locator("[data-tracker-filter-status]").inputValue(), "all");
    await assertNoHorizontalOverflow(page, "tracker cleared filters");
    assert.match(await page.locator("#trackerList").innerText(), /Senior Platform Engineer/);

    await page.locator("[data-tracker-filter-status]").selectOption("applied");
    await assertNoHorizontalOverflow(page, "tracker applied filter");
    assert.match(await page.locator("#trackerList").innerText(), /Senior Platform Engineer/);
    assert.equal(await page.locator('a[download="applied-jobs.xls"]').count(), 1);
    assert.deepEqual(consoleMessages, [], "tracker filtering: console/page errors");
  } finally {
    await page.close();
  }
}

async function assertNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  const metrics = await page.evaluate(() => ({
    innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth
  }));

  assert.equal(metrics.documentWidth, metrics.innerWidth, `${label}: document overflow`);
  assert.equal(metrics.bodyWidth, metrics.innerWidth, `${label}: body overflow`);
}

async function assertElementNoHorizontalOverflow(page: Page, selector: string, label: string): Promise<void> {
  const metrics = await page.locator(selector).evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth
  }));

  assert.ok(metrics.scrollWidth <= metrics.clientWidth + 1, `${label}: element overflow`);
}

async function assertVisibleElementsNoHorizontalOverflow(
  page: Page,
  selector: string,
  label: string
): Promise<void> {
  const overflowing = await page.locator(selector).evaluateAll((elements) =>
    elements
      .filter((element) => {
        const style = window.getComputedStyle(element);
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          element.getClientRects().length > 0
        );
      })
      .map((element, index) => ({
        index,
        selector: [
          element.tagName.toLowerCase(),
          element.id ? "#" + element.id : "",
          typeof element.className === "string" && element.className
            ? "." + element.className.trim().split(/\s+/).join(".")
            : ""
        ].join(""),
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth
      }))
      .filter((entry) => entry.scrollWidth > entry.clientWidth + 1)
  );

  assert.deepEqual(overflowing, [], `${label}: visible element overflow`);
}

async function assertVisibleControlsWithinViewport(
  page: Page,
  selector: string,
  label: string
): Promise<void> {
  const overflowing = await page.locator(selector).evaluateAll((elements) =>
    elements
      .filter((element) => {
        const style = window.getComputedStyle(element);
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          element.getClientRects().length > 0
        );
      })
      .map((element, index) => {
        const rect = element.getBoundingClientRect();
        return {
          index,
          selector: [
            element.tagName.toLowerCase(),
            element.id ? "#" + element.id : "",
            typeof element.className === "string" && element.className
              ? "." + element.className.trim().split(/\s+/).join(".")
              : ""
          ].join(""),
          left: Math.floor(rect.left),
          right: Math.ceil(rect.right),
          viewportWidth: window.innerWidth
        };
      })
      .filter((entry) => entry.left < -1 || entry.right > entry.viewportWidth + 1)
  );

  assert.deepEqual(overflowing, [], `${label}: visible control bounds`);
}

async function assertBlankTargetLinksAreIsolated(
  page: Page,
  scope: string,
  label: string
): Promise<void> {
  const links = await page.locator(`${scope} a[target='_blank']`).evaluateAll((anchors) =>
    anchors.map((anchor) => ({
      text: anchor.textContent?.trim() ?? "",
      rel: anchor.getAttribute("rel") ?? ""
    }))
  );

  assert.ok(links.length > 0, `${label}: expected external links`);
  for (const link of links) {
    const relTokens = link.rel.split(/\s+/).filter(Boolean);
    assert.ok(relTokens.includes("noopener"), `${label}: ${link.text} missing noopener`);
    assert.ok(relTokens.includes("noreferrer"), `${label}: ${link.text} missing noreferrer`);
  }
}

async function expectStatusText(locator: ReturnType<Page["locator"]>, pattern: RegExp): Promise<void> {
  await locator.page().waitForFunction(
    ({ selector, source, flags }) => {
      const text = document.querySelector(selector)?.textContent ?? "";
      return new RegExp(source, flags).test(text);
    },
    {
      selector: "#appStatus",
      source: pattern.source,
      flags: pattern.flags
    }
  );
  const text = await locator.innerText();
  assert.match(text, pattern);
}

async function expectOnboardingStatusText(page: Page, pattern: RegExp): Promise<void> {
  await page.waitForFunction(
    ({ source, flags }) => {
      const text = document.querySelector("#obStatus")?.textContent ?? "";
      return new RegExp(source, flags).test(text);
    },
    {
      source: pattern.source,
      flags: pattern.flags
    }
  );
  const text = await page.locator("#obStatus").innerText();
  assert.match(text, pattern);
}

async function assertTabState(page: Page, activeView: "dashboard" | "tracker" | "settings"): Promise<void> {
  const states = await page.evaluate(() => {
    const names = ["dashboard", "tracker", "settings"];
    return names.map((name) => {
      const tab = document.querySelector(`[data-view="${name}"]`);
      const panel = document.querySelector(`#${name}View`);
      return {
        name,
        selected: tab?.getAttribute("aria-selected"),
        tabIndex: tab instanceof HTMLElement ? tab.tabIndex : null,
        controls: tab?.getAttribute("aria-controls"),
        panelLabel: panel?.getAttribute("aria-labelledby"),
        activePanel: panel?.classList.contains("active"),
        hidden: panel?.hasAttribute("hidden"),
        activeElementId: document.activeElement?.id
      };
    });
  });

  for (const state of states) {
    const active = state.name === activeView;
    assert.equal(state.selected, String(active), `${state.name}: aria-selected`);
    assert.equal(state.tabIndex, active ? 0 : -1, `${state.name}: tabIndex`);
    assert.equal(state.controls, `${state.name}View`, `${state.name}: aria-controls`);
    assert.equal(state.panelLabel, `${state.name}Tab`, `${state.name}: aria-labelledby`);
    assert.equal(state.activePanel, active, `${state.name}: active class`);
    assert.equal(state.hidden, !active, `${state.name}: hidden panel state`);
  }

  assert.equal(await page.locator(".app-view.active").count(), 1, `${activeView}: one active panel`);
  assert.equal(await page.locator("[role='tab'][aria-selected='true']").count(), 1, `${activeView}: one selected tab`);
  assert.equal(
    await page.evaluate(() => document.activeElement?.id),
    `${activeView}Tab`,
    `${activeView}: focused tab`
  );
}

async function assertActiveView(page: Page, activeView: "dashboard" | "tracker" | "settings"): Promise<void> {
  await page.waitForFunction(
    (view) => document.querySelector(`#${view}View`)?.classList.contains("active"),
    activeView
  );
  assert.equal(await page.locator(`#${activeView}View`).isVisible(), true);
  assert.equal(await page.locator(`#${activeView}Tab`).getAttribute("aria-selected"), "true");
}

async function assertReducedMotionStyles(page: Page, label: string): Promise<void> {
  const movingElements = await page.evaluate(`(() => {
    function visible(element) {
      const style = window.getComputedStyle(element);
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        element.getClientRects().length > 0
      );
    }

    function maxDurationSeconds(value) {
      return Math.max(
        0,
        ...value.split(",").map((part) => {
          const duration = part.trim();
          if (!duration) return 0;
          if (duration.endsWith("ms")) return Number.parseFloat(duration) / 1000;
          if (duration.endsWith("s")) return Number.parseFloat(duration);
          return 0;
        })
      );
    }

    return [...document.querySelectorAll("*")]
      .filter((element) => visible(element))
      .map((element) => {
        const style = window.getComputedStyle(element);
        return {
          tag: element.tagName.toLowerCase(),
          id: element.id,
          className: typeof element.className === "string" ? element.className : "",
          transition: maxDurationSeconds(style.transitionDuration),
          animation: maxDurationSeconds(style.animationDuration),
          animationIterationCount: style.animationIterationCount
        };
      })
      .filter((entry) => entry.transition > 0.001 || entry.animation > 0.001 || entry.animationIterationCount === "infinite")
      .map((entry) => ({
        selector: [entry.tag, entry.id ? "#" + entry.id : "", entry.className ? "." + entry.className.trim().split(/\\s+/).join(".") : ""].join(""),
        transition: entry.transition,
        animation: entry.animation,
        animationIterationCount: entry.animationIterationCount
      }));
  })()`);

  assert.deepEqual(movingElements, [], `${label}: reduced-motion styles`);
}

async function assertVisibleInteractiveControlsAreNamed(page: Page, label: string): Promise<void> {
  const unnamedControls = await page.evaluate(`(() => {
    function visible(element) {
      const style = window.getComputedStyle(element);
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        element.getClientRects().length > 0
      );
    }

    function textFromIds(value) {
      return (value ?? "")
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
        .filter(Boolean)
        .join(" ");
    }

    function labelFor(element) {
      const id = element.getAttribute("id");
      const explicitLabel = id
        ? document.querySelector('label[for="' + CSS.escape(id) + '"]')?.textContent?.trim() ?? ""
        : "";
      const wrappingLabel = element.closest("label")?.textContent?.trim() ?? "";
      return explicitLabel || wrappingLabel;
    }

    function controlName(element) {
      const explicitName =
        element.getAttribute("aria-label")?.trim() ||
        textFromIds(element.getAttribute("aria-labelledby")) ||
        labelFor(element) ||
        element.getAttribute("title")?.trim() ||
        "";

      if (explicitName) {
        return explicitName;
      }

      if (
        element instanceof HTMLInputElement &&
        ["button", "submit", "reset"].includes(element.type)
      ) {
        return element.value.trim();
      }

      if (
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement
      ) {
        return "";
      }

      return element.textContent?.trim() || "";
    }

    return [
      ...document.querySelectorAll(
        'button, a[href], input:not([type="hidden"]), select, textarea, summary, [role="button"], [tabindex]:not([tabindex="-1"])'
      )
    ]
      .filter((element) => visible(element))
      .filter((element) => !controlName(element))
      .map((element) => element.outerHTML.slice(0, 180));
  })()`);

  assert.deepEqual(unnamedControls, [], `${label}: unnamed interactive controls`);
}

async function assertTouchTargets(page: Page, label: string): Promise<void> {
  const smallTargets = await page.evaluate(`(() => {
    function visible(element) {
      const style = window.getComputedStyle(element);
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        element.getClientRects().length > 0
      );
    }

    function labelFor(element) {
      const id = element.getAttribute("id");
      return id ? document.querySelector('label[for="' + CSS.escape(id) + '"]') : null;
    }

    function touchElement(element) {
      if (element instanceof HTMLInputElement && ["checkbox", "radio"].includes(element.type)) {
        return element.closest("label") || labelFor(element) || element;
      }

      return element;
    }

    function accessibleName(element) {
      return (
        element.getAttribute("aria-label")?.trim() ||
        element.textContent?.trim() ||
        element.getAttribute("title")?.trim() ||
        element.getAttribute("id") ||
        element.getAttribute("class") ||
        element.tagName.toLowerCase()
      );
    }

    return [
      ...document.querySelectorAll(
        'button, a[href], input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="tab"], [tabindex]:not([tabindex="-1"])'
      )
    ]
      .filter((element) => visible(element))
      .map((element) => {
        const target = touchElement(element);
        const rect = target.getBoundingClientRect();
        return {
          name: accessibleName(element).replace(/\\s+/g, " ").slice(0, 80),
          selector: [element.tagName.toLowerCase(), element.id ? "#" + element.id : "", typeof element.className === "string" && element.className ? "." + element.className.trim().split(/\\s+/).join(".") : ""].join(""),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        };
      })
      .filter((entry) => entry.width < 40 || entry.height < 40);
  })()`);

  assert.deepEqual(smallTargets, [], `${label}: small touch targets`);
}

async function assertOnboardingToggleFocusVisible(page: Page): Promise<void> {
  await page.locator("#obNext").click();
  await page.waitForFunction(() => {
    const title = document.querySelector("#onboardingTitle1");
    return title && getComputedStyle(title.closest(".onboarding-step") as Element).display !== "none";
  });
  await page.locator("#obNext").click();
  await page.waitForFunction(() => {
    const input = document.querySelector("#obRemoteOnly");
    return input && getComputedStyle(input.closest(".onboarding-step") as Element).display !== "none";
  });
  await page.locator("#obRemoteOnly").focus();

  const focusStyle = await page.locator(".onboarding-toggle-track").first().evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth)
    };
  });

  assert.notEqual(focusStyle.outlineStyle, "none", "onboarding toggle focus outline style");
  assert.ok(focusStyle.outlineWidth >= 2, "onboarding toggle focus outline width");
}

async function assertVisibleSvgsAreHiddenOrNamed(page: Page, label: string): Promise<void> {
  const exposedSvgs = await page.evaluate(`(() => {
    function visible(element) {
      const style = window.getComputedStyle(element);
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        element.getClientRects().length > 0
      );
    }

    function textFromIds(value) {
      return (value ?? "")
        .split(/\\s+/)
        .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
        .filter(Boolean)
        .join(" ");
    }

    function svgName(element) {
      return (
        element.getAttribute("aria-label")?.trim() ||
        textFromIds(element.getAttribute("aria-labelledby")) ||
        element.querySelector("title")?.textContent?.trim() ||
        ""
      );
    }

    return [...document.querySelectorAll("svg")]
      .filter((element) => visible(element))
      .filter((element) => element.getAttribute("aria-hidden") !== "true")
      .filter((element) => !(element.getAttribute("role") === "img" && svgName(element)))
      .map((element) => element.outerHTML.slice(0, 180));
  })()`);

  assert.deepEqual(exposedSvgs, [], `${label}: decorative svg accessibility`);
}

async function withServer(run: (server: TestServer) => Promise<void>): Promise<void> {
  const cwd = await mkdtemp(join(tmpdir(), "job-workbench-ui-test-"));
  const port = await getFreePort();
  const sourceConfigPath = join(cwd, "job-sources.json");
  const outputPath = join(cwd, "data", "job-listings.json");
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(sourceConfigPath, JSON.stringify({ searches: [], boards: [] }, null, 2));
  await symlink(uiDir, join(cwd, "ui"), "dir");

  const child = spawn(process.execPath, [tsxCli, serverEntry], {
    cwd,
    env: {
      ...process.env,
      WORKBENCH_PORT: String(port),
      JOB_SOURCE_CONFIG: sourceConfigPath,
      JOB_OUTPUT_PATH: outputPath
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  try {
    await waitForServer(child, port);
    await run({
      baseUrl: `http://127.0.0.1:${port}`,
      cwd
    });
  } finally {
    await closeServer(child);
    await removeWorkdir(cwd);
  }
}

async function waitForTestCondition(predicate: () => boolean, label: string, timeoutMs = 3_000): Promise<void> {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`Timed out waiting for ${label}.`);
    }

    await new Promise((resolveWait) => setTimeout(resolveWait, 25));
  }
}

function waitForServer(child: ChildProcessWithoutNullStreams, port: number): Promise<void> {
  return new Promise((resolveWait, rejectWait) => {
    let output = "";
    const timeout = setTimeout(() => {
      rejectWait(new Error(`Timed out waiting for server on port ${port}. Output:\n${output}`));
    }, SERVER_START_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
      if (output.includes(`:${port}`)) {
        clearTimeout(timeout);
        resolveWait();
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

async function clearTracker(baseUrl: string): Promise<void> {
  const tracker = await (await fetch(`${baseUrl}/api/tracker`)).json();
  for (const job of tracker) {
    await fetch(`${baseUrl}/api/tracker/remove`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ id: job.id })
    });
  }
}

async function seedDenseSettingsConfig(baseUrl: string): Promise<void> {
  const response = await fetch(`${baseUrl}/api/config`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      searches: [
        {
          provider: "adzuna",
          query: "senior platform automation engineer typescript workflow orchestration",
          location: "Remote United States",
          page: 2,
          limit: 100
        },
        {
          provider: "jooble",
          query: "full stack product infrastructure engineer node distributed systems",
          location: "Phoenix AZ",
          page: 1,
          limit: 75
        }
      ],
      boards: [
        {
          provider: "greenhouse",
          source: "stripe",
          includeDescription: true
        },
        {
          provider: "lever",
          source: "openai",
          includeDescription: true,
          location: "Remote",
          team: "Engineering, Product Infrastructure, Applied Automation",
          limit: 100
        },
        {
          provider: "ashby",
          source: "anthropic",
          includeDescription: true
        },
        {
          provider: "workable",
          source: "canonical",
          includeDescription: false
        }
      ],
      filters: {
        includeKeywords: [
          "typescript",
          "node",
          "workflow automation",
          "distributed systems",
          "platform reliability"
        ],
        excludeKeywords: ["clearance required", "unpaid internship", "onsite five days"],
        includeCompanies: ["OpenAI", "Anthropic", "Stripe", "Vercel", "Linear"],
        excludeCompanies: ["Example Staffing"],
        includeLocations: ["Remote", "United States", "Phoenix"],
        excludeLocations: ["Antarctica"],
        remoteOnly: true,
        workplaceTypes: ["remote", "hybrid"],
        employmentTypes: ["full-time"],
        minSalary: 120000,
        maxSalary: 260000,
        maxAgeDays: 21,
        onlyWithApplyUrl: true,
        preferredProviders: ["greenhouse", "lever", "ashby", "workable"]
      },
      ranking: {
        preferCompanyBoards: true,
        remoteBoost: 14,
        freshnessBoost: 16,
        compensationBoost: 12,
        keywordBoost: 20,
        titleBoosts: ["platform engineer", "automation engineer", "product infrastructure"],
        companyBoosts: ["OpenAI", "Anthropic", "Stripe"],
        locationBoosts: ["Remote", "Phoenix"],
        skillKeywords: ["TypeScript", "Playwright", "APIs", "workflow orchestration"]
      },
      alerts: [
        {
          id: "dense-platform-alert",
          name: "Platform automation roles with unusually long but realistic alert name",
          enabled: true,
          minScore: 70,
          newOnly: true,
          keywords: ["platform", "typescript", "automation"],
          providers: ["greenhouse", "lever"],
          companies: ["OpenAI", "Anthropic", "Stripe"],
          browser: true,
          webhookUrl: "https://hooks.example.com/job-alerts/platform-automation"
        },
        {
          id: "dense-remote-alert",
          name: "Remote systems roles",
          enabled: true,
          minScore: 82,
          newOnly: false,
          keywords: ["distributed systems", "remote"],
          providers: ["ashby", "workable"],
          companies: ["Vercel", "Linear"],
          browser: false
        }
      ],
      schedule: {
        enabled: true,
        intervalMinutes: 180,
        timezone: "America/Phoenix",
        quietHoursStart: "22:30",
        quietHoursEnd: "06:15"
      }
    })
  });

  assert.equal(response.status, 200);
}

async function addTrackedJob(baseUrl: string): Promise<void> {
  const response = await fetch(`${baseUrl}/api/tracker/visit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "apply",
      listing: {
        provider: "test",
        title: "Senior Platform Engineer",
        company: "Example Co",
        location: "Remote",
        employmentType: "Full-time",
        listingUrl: "https://example.com/jobs/platform",
        applyUrl: "https://example.com/apply/platform",
        description: "Platform engineering role with Node and TypeScript.",
        score: 88,
        sourceRunAt: new Date().toISOString()
      }
    })
  });
  const job = await response.json();
  await fetch(`${baseUrl}/api/tracker/applied`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      id: job.id,
      applied: true
    })
  });
}

async function addVisitedJob(baseUrl: string): Promise<void> {
  await fetch(`${baseUrl}/api/tracker/visit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "open-listing",
      listing: {
        provider: "test",
        title: "Senior Platform Engineer",
        company: "Example Co",
        location: "Remote",
        employmentType: "Full-time",
        listingUrl: "https://example.com/jobs/platform",
        applyUrl: "https://example.com/apply/platform",
        description: "Platform engineering role with Node and TypeScript.",
        score: 88,
        sourceRunAt: new Date().toISOString()
      }
    })
  });
}

async function seedLatestOutput(cwd: string): Promise<void> {
  await mkdir(join(cwd, "data"), { recursive: true });
  await writeFile(
    join(cwd, "data", "job-listings.json"),
    JSON.stringify(
      {
        generatedAt: "2026-05-18T23:15:30.000Z",
        summary: {
          totalFetched: 2,
          uniqueListings: 2,
          alertMatches: 1,
          newListings: 1
        },
        listings: [
          {
            provider: "greenhouse",
            source: "zenith",
            title: "Senior Platform Engineer",
            company: "Zenith Systems",
            location: "Remote",
            employmentType: "Full-time",
            listingUrl: "https://example.com/jobs/platform",
            applyUrl: "https://example.com/apply/platform",
            description: "Build platform automation with Node and TypeScript.",
            score: 94,
            reasons: ["keyword: TypeScript", "remote"],
            postedAt: "2026-05-18T12:00:00.000Z",
            isNew: true
          },
          {
            provider: "lever",
            source: "atlas",
            title: "Product Analyst",
            company: "Atlas Labs",
            location: "Atlanta, GA",
            employmentType: "Full-time",
            listingUrl: "https://example.com/jobs/analyst",
            applyUrl: "https://example.com/apply/analyst",
            description: "Analyze product data and reporting workflows.",
            score: 71,
            reasons: ["company board"],
            postedAt: "2026-05-10T12:00:00.000Z",
            isNew: false
          }
        ],
        alerts: [
          {
            id: "platform",
            name: "Platform roles",
            count: 1,
            webhookUrl: null,
            listings: [
              {
                title: "Senior Platform Engineer",
                company: "Zenith Systems"
              }
            ]
          }
        ]
      },
      null,
      2
    )
  );
}

async function seedAggregationLatestOutput(cwd: string): Promise<void> {
  await mkdir(join(cwd, "data"), { recursive: true });
  await writeFile(
    join(cwd, "data", "job-listings.json"),
    JSON.stringify(
      {
        generatedAt: "2026-05-18T23:15:30.000Z",
        summary: {
          fetchedListings: 132,
          filteredListings: 120,
          uniqueListings: 2,
          alertMatches: 0
        },
        providers: [
          { provider: "ashby", mode: "board", source: "openai", count: 120 },
          {
            provider: "ashby",
            mode: "board",
            source: "extremely-long-custom-board-domain-name-with-subdomain-example-careers-source",
            count: 8
          },
          { provider: "greenhouse", mode: "board", source: "ramp", count: 12 }
        ],
        errors: [
          {
            provider: "lever",
            mode: "board",
            source: "missing-co",
            message: "404 Not Found"
          }
        ],
        listings: [
          {
            provider: "ashby",
            title: "Senior Platform Engineer",
            company: "Zenith Systems",
            location: "Remote",
            employmentType: "Full-time",
            listingUrl: "https://example.com/jobs/platform",
            applyUrl: "https://example.com/apply/platform",
            description: "Build platform automation.",
            score: 94,
            reasons: ["keyword: TypeScript"],
            postedAt: "2026-05-18T12:00:00.000Z",
            isNew: true
          },
          {
            provider: "greenhouse",
            title: "Product Analyst",
            company: "Atlas Labs",
            location: "Atlanta, GA",
            employmentType: "Full-time",
            listingUrl: "https://example.com/jobs/analyst",
            applyUrl: "https://example.com/apply/analyst",
            description: "Analyze product data.",
            score: 71,
            reasons: ["company board"],
            postedAt: "2026-05-10T12:00:00.000Z",
            isNew: false
          }
        ],
        alerts: []
      },
      null,
      2
    )
  );
}

async function seedLargeLatestOutput(cwd: string, count = 45): Promise<void> {
  await mkdir(join(cwd, "data"), { recursive: true });
  const listings = Array.from({ length: count }, (_, index) => ({
    provider: index % 2 === 0 ? "greenhouse" : "lever",
    source: index % 2 === 0 ? "greenhouse-board" : "lever-board",
    title: index === count - 1 ? "Needle Engineer" : `General Engineer ${index + 1}`,
    company: index === count - 1 ? "Needle Labs" : `Example Company ${index + 1}`,
    location: index === count - 1 ? "Remote" : "Atlanta, GA",
    employmentType: "Full-time",
    listingUrl: `https://example.com/jobs/${index + 1}`,
    applyUrl: `https://example.com/apply/${index + 1}`,
    description: index === count - 1 ? "Needle role outside the initial dashboard slice." : "General engineering role.",
    score: 100 - index,
    reasons: index === count - 1 ? ["needle match"] : ["company board", "scroll paging"],
    postedAt: "2026-05-18T12:00:00.000Z",
    isNew: index === count - 1
  }));

  await writeFile(
    join(cwd, "data", "job-listings.json"),
    JSON.stringify(
      {
        generatedAt: "2026-05-18T23:15:30.000Z",
        summary: {
          totalFetched: listings.length,
          uniqueListings: listings.length,
          alertMatches: 0,
          newListings: 1
        },
        listings,
        alerts: []
      },
      null,
      2
    )
  );
}

async function seedUnsafeLatestOutput(cwd: string): Promise<void> {
  await mkdir(join(cwd, "data"), { recursive: true });
  await writeFile(
    join(cwd, "data", "job-listings.json"),
    JSON.stringify(
      {
        generatedAt: "2026-05-18T23:15:30.000Z",
        summary: {
          totalFetched: 2,
          uniqueListings: 2,
          alertMatches: 0,
          newListings: 1
        },
        listings: [
          {
            provider: "greenhouse",
            title: "Unsafe Link Engineer",
            company: "Example Security",
            location: "Remote",
            employmentType: "Full-time",
            listingUrl: "javascript:alert(1)",
            applyUrl: "data:text/html,unsafe",
            description: "This result has unsafe external destinations.",
            score: 92,
            reasons: ["security regression"],
            postedAt: "2026-05-18T12:00:00.000Z",
            isNew: true
          },
          {
            provider: "jooble",
            source: "jooble-search",
            title: "Jooble Redirect Engineer",
            company: "Example Robotics",
            location: "Remote",
            employmentType: "Full-time",
            listingUrl: "https://jooble.org/jdp/123",
            applyUrl: "https://jooble.org/jdp/123",
            description: "This Jooble listing may redirect to a paid lead site.",
            score: 88,
            reasons: ["aggregator redirect"],
            postedAt: "2026-05-18T12:00:00.000Z",
            isNew: true
          },
          {
            provider: "greenhouse",
            title: "Paid Lead Engineer",
            company: "Example Leads",
            location: "Remote",
            employmentType: "Full-time",
            listingUrl: "https://www.jobleads.com/jobs/paid-lead",
            applyUrl: "https://www.jobleads.com/apply/paid-lead",
            description: "This result points to a paid lead destination.",
            score: 84,
            reasons: ["paid lead"],
            postedAt: "2026-05-18T12:00:00.000Z",
            isNew: true
          }
        ],
        alerts: []
      },
      null,
      2
    )
  );
}

async function seedJoobleDirectSourceLatestOutput(cwd: string): Promise<void> {
  await mkdir(join(cwd, "data"), { recursive: true });
  await writeFile(
    join(cwd, "data", "job-listings.json"),
    JSON.stringify(
      {
        generatedAt: "2026-05-18T23:15:30.000Z",
        summary: {
          totalFetched: 3,
          uniqueListings: 3,
          alertMatches: 0,
          newListings: 3
        },
        listings: [
          {
            provider: "jooble",
            source: "jooble-search",
            title: "Robotics Software Engineer",
            company: "Example Robotics",
            location: "Remote",
            employmentType: "Full-time",
            listingUrl: "https://jooble.org/jdp/robotics-software",
            applyUrl: null,
            description: "Aggregator result for a robotics software role.",
            score: 91,
            reasons: ["aggregator"],
            postedAt: "2026-05-18T12:00:00.000Z",
            isNew: true
          },
          {
            provider: "greenhouse",
            providerKind: "company-board",
            source: "greenhouse-board",
            title: "Robotics Software Engineer",
            company: "Example Robotics",
            location: "Remote",
            employmentType: "Full-time",
            listingUrl: "https://jobs.example-robotics.com/robotics-software",
            applyUrl: "https://jobs.example-robotics.com/apply/robotics-software",
            description: "Direct company board result.",
            score: 89,
            reasons: ["company board"],
            postedAt: "2026-05-18T12:00:00.000Z",
            isNew: true
          },
          {
            provider: "jooble",
            source: "jooble-search",
            title: "Controls Engineer",
            company: "Factory Automation Inc",
            location: "Phoenix, AZ",
            employmentType: "Full-time",
            listingUrl: "https://jooble.org/jdp/controls",
            applyUrl: null,
            description: "Aggregator result without a direct match in this run.",
            score: 84,
            reasons: ["aggregator"],
            postedAt: "2026-05-18T12:00:00.000Z",
            isNew: true
          }
        ],
        alerts: []
      },
      null,
      2
    )
  );
}

async function seedLongContentLatestOutput(cwd: string): Promise<void> {
  await mkdir(join(cwd, "data"), { recursive: true });
  const longToken = "LongContent".repeat(18);
  await writeFile(
    join(cwd, "data", "job-listings.json"),
    JSON.stringify(
      {
        generatedAt: "2026-05-18T23:15:30.000Z",
        summary: {
          totalFetched: 1,
          uniqueListings: 1,
          alertMatches: 1,
          newListings: 1
        },
        listings: [
          {
            provider: `greenhouse-${longToken}`,
            title: `Principal ${longToken} Platform Engineer`,
            company: `Example ${longToken} Systems`,
            location: `Remote-${longToken}`,
            employmentType: `Full-time-${longToken}`,
            listingUrl: "https://example.com/jobs/long-content",
            applyUrl: "https://example.com/apply/long-content",
            description: `Build ${longToken} workflow automation with Node, TypeScript, and reliability ownership.`,
            score: 98,
            reasons: [`keyword-${longToken}`, `team-${longToken}`],
            postedAt: "2026-05-18T12:00:00.000Z",
            isNew: true
          }
        ],
        alerts: [
          {
            id: "long-content",
            name: `Long ${longToken} roles`,
            count: 1,
            webhookUrl: null,
            listings: [
              {
                title: `Principal ${longToken} Platform Engineer`,
                company: `Example ${longToken} Systems`
              }
            ]
          }
        ]
      },
      null,
      2
    )
  );
}

async function seedMalformedLatestOutput(cwd: string): Promise<void> {
  await mkdir(join(cwd, "data"), { recursive: true });
  await writeFile(
    join(cwd, "data", "job-listings.json"),
    JSON.stringify(
      {
        generatedAt: "2026-05-18T23:15:30.000Z",
        summary: {
          totalFetched: 1,
          uniqueListings: 1,
          alertMatches: 0,
          newListings: 1
        },
        listings: [
          {
            provider: "greenhouse",
            title: "Malformed Date Engineer",
            company: "Example Data",
            location: "Remote",
            employmentType: "Full-time",
            listingUrl: "https://example.com/jobs/malformed-date",
            applyUrl: "https://example.com/apply/malformed-date",
            description: "Role with a malformed provider timestamp.",
            score: 84,
            reasons: ["provider timestamp fallback"],
            postedAt: "not-a-real-date",
            isNew: true
          },
          {
            provider: "lever",
            title: "Fresh Date Engineer",
            company: "Example Fresh",
            location: "Remote",
            employmentType: "Full-time",
            listingUrl: "https://example.com/jobs/fresh-date",
            applyUrl: "https://example.com/apply/fresh-date",
            description: "Role with a valid provider timestamp.",
            score: 82,
            reasons: ["valid provider timestamp"],
            postedAt: "2026-05-18T12:00:00.000Z",
            isNew: false
          }
        ],
        alerts: []
      },
      null,
      2
    )
  );
}

function referencedIds(html: string, attribute: string): string[] {
  const pattern = new RegExp(`\\b${attribute}="([^"]+)"`, "g");
  return [...html.matchAll(pattern)].flatMap((match) =>
    match[1].split(/\s+/).filter(Boolean)
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
