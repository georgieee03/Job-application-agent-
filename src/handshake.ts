import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { chromium, type Locator, type Page } from "playwright";
import { prompt } from "./console.js";
import { config } from "./config.js";
import type { ApplicationProfile } from "./profile.js";
import { loadState, saveState } from "./state.js";

const SEARCH_RESULT_CYCLES = 4;
const SEARCH_RESULT_SCROLL_DELAY_MS = 1500;
const DEBUG_DIR_NAME = "debug";

export async function bootstrapAuth(): Promise<void> {
  const browser = await chromium.launch({
    headless: false,
    slowMo: config.handshake.slowMo
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${config.handshake.baseUrl}/login`, {
    waitUntil: "domcontentloaded"
  });

  console.log("Complete your Handshake login in the browser.");
  console.log("When you reach your account home page, return here and press Enter.");

  await prompt("");
  await mkdir(dirname(config.handshake.storageStatePath), { recursive: true });
  await context.storageState({ path: config.handshake.storageStatePath });

  await browser.close();
  console.log(`Saved auth state to ${config.handshake.storageStatePath}`);
}

export async function runApplyFlow(profile: ApplicationProfile): Promise<void> {
  if (!existsSync(config.handshake.storageStatePath)) {
    throw new Error(
      `Missing auth state at ${config.handshake.storageStatePath}. Run "npm run auth" first.`
    );
  }

  const state = await loadState(config.handshake.stateFilePath);
  const browser = await chromium.launch({
    headless: config.handshake.headless,
    slowMo: config.handshake.slowMo
  });
  const context = await browser.newContext({
    storageState: config.handshake.storageStatePath
  });
  const page = await context.newPage();

  const jobUrls = await collectJobUrls(page);
  let applicationsCompleted = 0;

  console.log(
    `Collected ${jobUrls.length} job URLs from up to ${config.handshake.maxSearchPages} search pages`
  );

  for (const jobUrl of jobUrls) {
    if (applicationsCompleted >= config.handshake.maxApplications) {
      break;
    }

    if (state.appliedJobs[jobUrl] || state.skippedJobs[jobUrl]) {
      continue;
    }

    state.seenJobs[jobUrl] = new Date().toISOString();
    await saveState(config.handshake.stateFilePath, state);

    const result = await processJob(page, jobUrl, profile);
    const now = new Date().toISOString();

    if (result === "applied") {
      applicationsCompleted += 1;
      state.appliedJobs[jobUrl] = now;
      delete state.pendingReviewJobs[jobUrl];
      console.log(`Applied: ${jobUrl}`);
    } else if (result === "manual-review-required") {
      state.pendingReviewJobs[jobUrl] = now;
      console.log(`Needs manual review: ${jobUrl}`);
    } else {
      state.skippedJobs[jobUrl] = now;
      console.log(`Skipped (${result}): ${jobUrl}`);
    }

    await saveState(config.handshake.stateFilePath, state);
  }

  await browser.close();
}

async function collectJobUrls(page: Page): Promise<string[]> {
  const urls = new Set<string>();
  let consecutivePagesWithoutNewUrls = 0;

  for (
    let searchPageNumber = 1;
    searchPageNumber <= config.handshake.maxSearchPages;
    searchPageNumber += 1
  ) {
    const searchPageUrl = buildSearchPageUrl(searchPageNumber);
    await gotoHandshakePage(page, searchPageUrl);
    console.log(`Scanning search page ${searchPageNumber}: ${searchPageUrl}`);

    const countBeforePage = urls.size;

    for (let cycle = 0; cycle < SEARCH_RESULT_CYCLES; cycle += 1) {
      const hrefs = await page
        .locator("a[href*=\"/jobs/\"], a[href*=\"/postings/\"]")
        .evaluateAll((elements) =>
          elements
            .map((element) => (element as HTMLAnchorElement).href)
            .filter((href) => typeof href === "string" && href.length > 0)
        );

      for (const href of hrefs) {
        if (href.includes("/jobs/") || href.includes("/postings/")) {
          urls.add(href);
        }
      }

      await page.mouse.wheel(0, 3000);
      await page.waitForTimeout(SEARCH_RESULT_SCROLL_DELAY_MS);
    }

    const newUrlsThisPage = urls.size - countBeforePage;
    if (newUrlsThisPage === 0) {
      consecutivePagesWithoutNewUrls += 1;
    } else {
      consecutivePagesWithoutNewUrls = 0;
    }

    if (consecutivePagesWithoutNewUrls >= 2) {
      break;
    }
  }

  return [...urls];
}

async function processJob(
  page: Page,
  jobUrl: string,
  profile: ApplicationProfile
): Promise<string> {
  await gotoHandshakePage(page, jobUrl);
  console.log(`Opened job: ${await page.title()}`);

  if (
    await page
      .getByText(/application submitted|already applied/i)
      .first()
      .isVisible()
      .catch(() => false)
  ) {
    return "already-applied";
  }

  if (
    await page
      .getByText(/applied on\s+[a-z]+\s+\d{1,2},\s+\d{4}/i)
      .first()
      .isVisible()
      .catch(() => false)
  ) {
    return "already-applied";
  }

  if (
    await page
      .getByRole("button", { name: /withdraw application/i })
      .first()
      .isVisible()
      .catch(() => false)
  ) {
    return "already-applied";
  }

  const externalApplyControl = await findExternalApplyControl(page);
  if (externalApplyControl) {
    return "external-application";
  }

  const applyButton = await findApplyButton(page);

  if (!applyButton) {
    await captureDebugSnapshot(page, "no-apply-button");
    return "no-apply-button";
  }

  console.log(`Clicking apply control: ${await applyButton.innerText().catch(() => "Apply")}`);
  await applyButton.click();
  await page.waitForTimeout(1000);

  const outcome = await completeApplicationWizard(page, profile);
  return outcome;
}

async function completeApplicationWizard(
  page: Page,
  profile: ApplicationProfile
): Promise<string> {
  for (let step = 0; step < 8; step += 1) {
    console.log(`Application step ${step + 1}`);
    await uploadResumeIfRequested(page);
    await fillContactFields(page, profile);
    await fillMappedAnswers(page, profile);

    const submitButton = await getVisibleActionButton(page, /submit application|submit|send application/i);
    if (submitButton) {
      if (!config.handshake.allowSubmit) {
        console.log("Final submit button reached. Review the browser and submit manually if everything is accurate.");
        const manualOutcome = await prompt(
          'Type "applied" after you manually submit this application, or press Enter to skip it: '
        );
        if (manualOutcome.toLowerCase() === "applied") {
          return "applied";
        }

        return "manual-review-required";
      }

      console.log("Submitting application automatically.");
      await submitButton.click();
      await page.waitForLoadState("domcontentloaded").catch(() => undefined);
      await page.waitForTimeout(1500);
      return "applied";
    }

    const nextButton = await getVisibleActionButton(page, /next|continue|review|preview application/i);
    if (!nextButton) {
      await captureDebugSnapshot(page, "stalled-application");
      return "stalled";
    }

    console.log(`Clicking next control: ${await nextButton.innerText().catch(() => "Next")}`);
    await nextButton.click();
    await page.waitForTimeout(1200);
  }

  await captureDebugSnapshot(page, "step-limit-reached");
  return "step-limit-reached";
}

async function uploadResumeIfRequested(page: Page): Promise<void> {
  const fileInput = page.locator("input[type=\"file\"]").first();

  if (await fileInput.isVisible().catch(() => false)) {
    if (!config.handshake.resumePath) {
      throw new Error("HANDSHAKE_RESUME_PATH is required before uploading resumes.");
    }

    console.log(`Uploading resume from ${config.handshake.resumePath}`);
    await fileInput.setInputFiles(config.handshake.resumePath);
    await page.waitForTimeout(1000);
  }
}

async function fillContactFields(
  page: Page,
  profile: ApplicationProfile
): Promise<void> {
  const contactFields: Array<[string | undefined, RegExp]> = [
    [profile.contact.email, /email/i],
    [profile.contact.phone, /phone/i],
    [profile.contact.linkedin, /linkedin/i],
    [profile.contact.github, /github/i],
    [profile.contact.website, /website|portfolio|personal site/i]
  ];

  for (const [value, label] of contactFields) {
    if (!value) {
      continue;
    }

    const input = page.getByLabel(label).first();
    if (!(await input.isVisible().catch(() => false))) {
      continue;
    }

    const currentValue = await input.inputValue().catch(() => "");
    if (!currentValue) {
      await input.fill(value);
    }
  }
}

async function fillMappedAnswers(
  page: Page,
  profile: ApplicationProfile
): Promise<void> {
  for (const [question, answer] of Object.entries(profile.textAnswers)) {
    const field = page.getByLabel(new RegExp(escapeRegex(question), "i")).first();
    if (!(await field.isVisible().catch(() => false))) {
      continue;
    }

    const currentValue = await field.inputValue().catch(() => "");
    if (!currentValue) {
      await field.fill(answer);
    }
  }

  for (const [question, answer] of Object.entries(profile.selectAnswers)) {
    const field = page.getByLabel(new RegExp(escapeRegex(question), "i")).first();
    if (!(await field.isVisible().catch(() => false))) {
      continue;
    }

    await field.selectOption({ label: answer }).catch(async () => {
      await field.selectOption({ value: answer }).catch(() => undefined);
    });
  }
}

async function findApplyButton(page: Page): Promise<Locator | null> {
  const candidates = [
    page.getByRole("button", { name: /^apply$/i }).first(),
    page.getByRole("button", { name: /apply to this job/i }).first(),
    page.getByRole("button", { name: /apply now|quick apply|easy apply/i }).first(),
    page.getByRole("button", { name: /start application|submit application/i }).first(),
    page.getByRole("link", { name: /^apply$/i }).first(),
    page.getByRole("link", { name: /apply now|quick apply|easy apply/i }).first(),
    page.locator("[aria-label=\"Apply\"]").first()
  ];

  for (const candidate of candidates) {
    if (await isReadyToClick(candidate)) {
      return candidate;
    }
  }

  await logVisibleActions(page, "No enabled apply control found");
  return null;
}

async function findExternalApplyControl(page: Page): Promise<Locator | null> {
  const candidates = [
    page.getByRole("button", { name: /apply externally|apply external/i }).first(),
    page.getByRole("link", { name: /apply externally|apply external/i }).first(),
    page
      .getByRole("button", {
        name: /apply on company website|continue on company website|continue to application/i
      })
      .first(),
    page
      .getByRole("link", {
        name: /apply on company website|continue on company website|continue to application/i
      })
      .first()
  ];

  for (const candidate of candidates) {
    if (await candidate.isVisible().catch(() => false)) {
      return candidate;
    }
  }

  return null;
}

async function getVisibleActionButton(
  page: Page,
  name: RegExp
): Promise<Locator | null> {
  const candidates = [
    page.getByRole("button", { name }).first(),
    page.getByRole("link", { name }).first(),
    page.locator("[role=\"button\"]").filter({ hasText: name }).first()
  ];

  for (const candidate of candidates) {
    if (await isReadyToClick(candidate)) {
      return candidate;
    }
  }

  await logVisibleActions(page, `No enabled action control found for ${name.toString()}`);
  return null;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildSearchPageUrl(pageNumber: number): string {
  const url = new URL(config.handshake.searchUrl);
  url.searchParams.set("page", String(pageNumber));
  return url.toString();
}

async function gotoHandshakePage(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => undefined);
}

async function isReadyToClick(locator: Locator): Promise<boolean> {
  const isVisible = await locator.isVisible().catch(() => false);
  if (!isVisible) {
    return false;
  }

  return locator.isEnabled().catch(() => false);
}

async function captureDebugSnapshot(page: Page, label: string): Promise<void> {
  const debugDir = join(dirname(config.handshake.stateFilePath), DEBUG_DIR_NAME);
  await mkdir(debugDir, { recursive: true });

  const safeLabel = label.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
  const filePath = join(debugDir, `${Date.now()}-${safeLabel}.png`);
  await page.screenshot({ path: filePath, fullPage: true }).catch(() => undefined);
  console.log(`Saved debug screenshot: ${filePath}`);
}

async function logVisibleActions(page: Page, prefix: string): Promise<void> {
  const actions = await page
    .locator("button, a, [role=\"button\"]")
    .evaluateAll((elements) =>
      elements
        .map((element) => {
          const text = (element.textContent ?? "").replace(/\s+/g, " ").trim();
          const ariaLabel = element.getAttribute("aria-label") ?? "";
          const href = element.getAttribute("href") ?? "";
          const disabled =
            element.hasAttribute("disabled") ||
            element.getAttribute("aria-disabled") === "true";

          return {
            text,
            ariaLabel,
            href,
            disabled
          };
        })
        .filter((item) => item.text || item.ariaLabel)
        .slice(0, 20)
    );

  console.log(prefix);
  for (const action of actions) {
    const label = action.text || action.ariaLabel;
    console.log(
      `- ${label} | disabled=${action.disabled} | href=${action.href || "n/a"}`
    );
  }
}
