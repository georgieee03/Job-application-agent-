if (process.env.JOB_APPLICATION_REVIEWED_LOCAL_HELPERS !== "true") {
  throw new Error("Public example helper: configure local facts, paths, role configuration, and authorization first; see docs/public-repository-setup.md.");
}

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";

const ROOT = "D:/job-application-agent-kit";
const CONFIG_PATH = process.env.GOAL_CONFIG || "config/goal-20260812-robotics-20-roles.json";
const INDEX_PATH = process.env.PACKAGE_INDEX || "data/application-packages/goal-20260812-robotics-20/package-index.json";
const require = createRequire(`${ROOT}/package.json`);
const { chromium } = require("playwright");

function byId(id) {
  return `[id="${id.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"]`;
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function loadRole(slug) {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, CONFIG_PATH), "utf8"));
  const idx = JSON.parse(fs.readFileSync(path.join(ROOT, INDEX_PATH), "utf8"));
  const role = cfg.roles.find((entry) => entry.slug === slug);
  const record = idx.records.find((entry) => entry.slug === slug);
  if (!role || !record) throw new Error(`Unknown Greenhouse slug: ${slug}`);
  const manifest = JSON.parse(fs.readFileSync(record.manifest, "utf8"));
  for (const item of [manifest.files.resume, manifest.files.coverLetter, ...(manifest.files.responses || [])]) {
    if (sha256(item.path) !== item.sha256) throw new Error(`Manifest hash mismatch for ${item.path}`);
  }
  return { role, record };
}

async function fillText(page, selector, value) {
  const locator = page.locator(selector);
  if ((await locator.count()) > 0 && (await locator.first().isVisible().catch(() => false))) {
    await locator.first().fill(value);
  }
}

async function fillAutocomplete(page, selector, value) {
  const locator = page.locator(selector);
  if ((await locator.count()) === 0 || !(await locator.first().isVisible().catch(() => false))) return;
  const field = locator.first();
  await field.click();
  await field.fill(value);
  await page.waitForTimeout(400);
  await field.press("ArrowDown").catch(() => {});
  await field.press("Enter").catch(() => {});
  await page.waitForTimeout(250);
}

async function fillQuestions(page, role) {
  for (const field of await page.locator('input[id^="question_"]').elementHandles()) {
    const label = await field.evaluate((element) => element.labels?.[0]?.innerText || "");
    const id = await field.evaluate((element) => element.id);
    if (/linkedin/i.test(label)) await page.locator(byId(id)).fill("https://www.linkedin.com/in/candidate-profile/");
    else if (/current location/i.test(label)) await page.locator(byId(id)).fill("Tempe, Arizona");
    else if (/current company/i.test(label)) await page.locator(byId(id)).fill("Arizona State University / graduate student");
    else if (/how did you hear/i.test(label)) await fillAutocomplete(page, byId(id), "Company website");
    else if (/employment are you seeking/i.test(label)) await fillAutocomplete(page, byId(id), "Full-time");
    else if (/visa sponsorship/i.test(label)) await fillAutocomplete(page, byId(id), "Yes");
  }
  for (const field of await page.locator("textarea").elementHandles()) {
    const label = await field.evaluate((element) => element.labels?.[0]?.innerText || "");
    const id = await field.evaluate((element) => element.id);
    if (/why do you want/i.test(label)) {
      await page.locator(byId(id)).fill(
        `Skild AI's work on general-purpose robot intelligence matches the robotics systems I have been building in graduate school: perception, simulation, controls, and reliable validation on physical systems. For this ${role.role} role, I am especially interested in helping turn robot learning into measurable behavior through strong testing, debugging, sensor data workflows, and disciplined engineering across simulation and hardware.`,
      );
    } else if (/two to three projects|projects or accomplishments/i.test(label)) {
      await page.locator(byId(id)).fill(
        "Two projects I am proud of are Efficient TransFuser and my Parrot MiniDrone control work. In Efficient TransFuser, I built a camera-LiDAR perception and localization pipeline, reduced model parameters from 168M to 50M with EfficientNetV2-S, improved held-out loss by 8.7%, and improved BEV segmentation by 25.4% while debugging a mixed-precision training instability. On the MiniDrone, I implemented PID control, localization, inertial/visual sensor fusion, logging, automated tests, and safety checks on physical hardware.",
      );
    }
  }
}

async function checkLocation(page, pattern) {
  const label = page.locator("label").filter({ hasText: pattern }).first();
  if ((await label.count()) === 0) return;
  const forId = await label.getAttribute("for");
  if (forId) await page.locator(byId(forId)).check({ force: true });
}

export async function openGreenhouseAtCode(slug) {
  const { role, record } = loadRole(slug);
  const evidenceDir = path.resolve(ROOT, path.dirname(record.resume), "evidence-repl");
  fs.mkdirSync(evidenceDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1800 } });
  await page.goto(role.applyUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500);
  const body = await page.locator("body").innerText().catch(() => "");
  if (/verify you are human|captcha|cloudflare|checking your browser/i.test(body)) {
    await page.screenshot({ path: path.join(evidenceDir, "friction.png"), fullPage: true });
    return { slug, role, record, browser, page, evidenceDir, state: "blocked", blocker: "UI verification friction before form fill." };
  }

  await fillText(page, "#first_name", "George");
  await fillText(page, "#last_name", "Perangattu");
  await fillText(page, "#preferred_name", "George");
  await fillText(page, "#email", "candidate@example.com");
  await fillText(page, "#phone", "+1 555-010-0200");
  await fillAutocomplete(page, "#country", "United States");
  await page.locator('input[type="file"]#resume').first().setInputFiles(record.resume);
  if ((await page.locator('input[type="file"]#cover_letter').count()) > 0) {
    await page.locator('input[type="file"]#cover_letter').first().setInputFiles(record.coverLetter);
  }
  const supportingFile = page.locator('input[type="file"][id^="question_"]').first();
  if ((await supportingFile.count()) > 0 && (await supportingFile.isVisible().catch(() => false))) {
    await supportingFile.setInputFiles(record.coverLetter);
  }
  await fillAutocomplete(page, "#school--0", "Arizona State University");
  await fillAutocomplete(page, "#degree--0", "Master's Degree");
  await fillAutocomplete(page, "#discipline--0", "Robotics and Autonomous Systems");
  await fillQuestions(page, role);
  await checkLocation(page, /San Francisco, CA/i);
  await checkLocation(page, /Pittsburgh, PA/i);

  await page.screenshot({ path: path.join(evidenceDir, "pre-submit.png"), fullPage: true });
  await page.getByRole("button", { name: /submit application/i }).last().click({ timeout: 30000 });
  await page.waitForTimeout(8000);
  const text = await page.locator("body").innerText().catch(() => "");
  await page.screenshot({ path: path.join(evidenceDir, "awaiting-code.png"), fullPage: true });
  fs.writeFileSync(path.join(ROOT, "tmp", `${slug}-greenhouse-state.json`), JSON.stringify({
    slug,
    state: /security code/i.test(text) ? "awaiting-code" : "unexpected",
    text: text.slice(-1200),
    evidenceDir,
  }, null, 2));
  return { slug, role, record, browser, page, evidenceDir, state: /security code/i.test(text) ? "awaiting-code" : "unexpected" };
}

export async function submitGreenhouseCode(session, code) {
  const { page, browser, evidenceDir, slug } = session;
  const inputs = page.locator("input");
  const count = await inputs.count();
  for (let index = 0; index < code.length; index += 1) {
    await inputs.nth(count - code.length + index).fill(code[index]);
  }
  await page.getByRole("button", { name: /submit application/i }).last().click({ timeout: 30000 });
  await page.waitForTimeout(12000);
  const text = await page.locator("body").innerText().catch(() => "");
  await page.screenshot({ path: path.join(evidenceDir, "post-submit.png"), fullPage: true });
  const result = {
    slug,
    finalUrl: page.url(),
    status: /thank you|application submitted|we received|successfully submitted|thanks for applying/i.test(text)
      ? "submitted-pending-verification"
      : /incorrect security code|security code/i.test(text)
        ? "blocked"
        : "unknown",
    text: text.slice(0, 2000),
    evidenceDir,
  };
  fs.writeFileSync(path.join(ROOT, "tmp", `${slug}-greenhouse-submit-result.json`), JSON.stringify(result, null, 2));
  await browser.close().catch(() => {});
  return result;
}
