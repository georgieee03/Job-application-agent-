import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import {
  pathToFileURL
} from "node:url";

const ROOT = path.resolve(".");
const SUMMARY_PATH = path.join(ROOT, "data", "next-ten-applications", "package-summary.json");
const STATE_PATH = path.join(ROOT, "data", "next-ten-applications", "manual-verification-state.json");
const MODULE_PATH = pathToFileURL(path.join(ROOT, "scripts", "submit_next_ten_applications.mjs")).href;

const order = [
  "fieldai-ros-developer",
  "fieldai-robot-integrations",
  "simbe-robotics-software-engineer",
  "orchard-perception-localization",
  "gritt-robotics-software-engineer",
  "skydio-autonomy-software-engineer",
  "bear-robotics-autonomy",
  "chef-robotics-staff-autonomy",
  "gecko-field-software-engineer-manufacturing",
  "locus-manufacturing-test-engineer",
];

function folderOf(role) {
  return path.basename(path.dirname(role.resume));
}

async function main() {
  const targetFolder = process.argv[2] || order[0];
  const roles = JSON.parse(await fs.readFile(SUMMARY_PATH, "utf8"));
  const role = roles.find((item) => folderOf(item) === targetFolder);
  if (!role) throw new Error(`Unknown role folder: ${targetFolder}`);
  const helpers = await import(MODULE_PATH);
  const profileDir = path.join(ROOT, ".chrome-apply-profile");
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    channel: "chrome",
    viewport: { width: 1365, height: 900 },
    acceptDownloads: true,
  }).catch(() => chromium.launchPersistentContext(profileDir, {
    headless: false,
    viewport: { width: 1365, height: 900 },
    acceptDownloads: true,
  }));
  const page = await context.newPage();
  const url = helpers.applyUrlFor(role);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500);
  if (url.includes("lever.co")) {
    await helpers.fillLever(page, role);
  } else if (url.includes("breezy.hr")) {
    await helpers.fillBreezy(page, role);
  } else if (url.includes("ashbyhq.com")) {
    await helpers.fillAshby(page, role);
  } else if (url.includes("greenhouse.io")) {
    await helpers.fillGreenhouse(page, role);
  }
  await fs.writeFile(STATE_PATH, JSON.stringify({
    targetFolder,
    company: role.company,
    role: role.role,
    applicationUrl: url,
    resume: role.resume,
    stagedAt: new Date().toISOString(),
    note: "Browser left open for user verification/final submit.",
  }, null, 2));
  console.log(`Staged ${role.company} - ${role.role}`);
  console.log("Please complete any verification and click submit in the opened browser.");
  console.log("This process will keep the browser open. Press Ctrl+C after the user is done.");
  await new Promise(() => {});
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
