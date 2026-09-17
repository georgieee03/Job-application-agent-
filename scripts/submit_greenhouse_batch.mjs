if (process.env.JOB_APPLICATION_REVIEWED_LOCAL_HELPERS !== "true") {
  throw new Error("Public example helper: configure local facts, paths, role configuration, and authorization first; see docs/public-repository-setup.md.");
}

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const cfgPath = "config/goal-20260812-robotics-20-roles.json";
const indexPath = "data/application-packages/goal-20260812-robotics-20/package-index.json";
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
const idx = JSON.parse(fs.readFileSync(indexPath, "utf8"));
const records = new Map(idx.records.map((record) => [record.slug, record]));
const outPath = "tmp/greenhouse-submit-results.json";
const onlySlugs = new Set((process.env.ONLY_SLUGS || "").split(",").map((slug) => slug.trim()).filter(Boolean));
const codes = JSON.parse(process.env.GREENHOUSE_CODES || "{}");
const waitForCode = process.env.WAIT_FOR_GREENHOUSE_CODE === "1";
const codeRequestDir = path.resolve("tmp/greenhouse-code-requests");
const roles = cfg.roles.filter((role) => role.provider === "greenhouse" && (onlySlugs.size === 0 || onlySlugs.has(role.slug)));

function byId(id) {
  return `[id="${id.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"]`;
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function verifyManifest(record) {
  const manifest = JSON.parse(fs.readFileSync(record.manifest, "utf8"));
  for (const item of [manifest.files.resume, manifest.files.coverLetter, ...(manifest.files.responses || [])]) {
    if (sha256(item.path) !== item.sha256) throw new Error(`Manifest hash mismatch for ${item.path}`);
  }
}

async function fillText(page, selector, value) {
  const locator = page.locator(selector);
  if ((await locator.count()) > 0 && (await locator.first().isVisible().catch(() => false))) {
    await locator.first().fill(value);
    return true;
  }
  return false;
}

async function fillAutocomplete(page, selector, value) {
  const locator = page.locator(selector);
  if ((await locator.count()) === 0 || !(await locator.first().isVisible().catch(() => false))) return false;
  const field = locator.first();
  await field.click();
  await field.fill(value);
  await page.waitForTimeout(500);
  await field.press("ArrowDown").catch(() => {});
  await field.press("Enter").catch(() => {});
  await page.waitForTimeout(300);
  return true;
}

async function checkLabel(page, labelPattern) {
  const label = page.locator("label").filter({ hasText: labelPattern }).first();
  if ((await label.count()) === 0) return false;
  const forId = await label.getAttribute("for");
  if (forId) {
    await page.locator(byId(forId)).check({ force: true });
    return true;
  }
  await label.click({ force: true });
  return true;
}

async function waitForCodeFile(role) {
  fs.mkdirSync(codeRequestDir, { recursive: true });
  const requestPath = path.join(codeRequestDir, `${role.slug}.json`);
  const codePath = path.join(codeRequestDir, `${role.slug}.txt`);
  fs.writeFileSync(requestPath, JSON.stringify({
    slug: role.slug,
    company: role.company,
    role: role.role,
    requestedAt: new Date().toISOString(),
    codePath,
  }, null, 2));
  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    if (fs.existsSync(codePath)) {
      const code = fs.readFileSync(codePath, "utf8").trim();
      fs.rmSync(codePath, { force: true });
      fs.rmSync(requestPath, { force: true });
      if (code) return code;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for Greenhouse security code file: ${codePath}`);
}

function skildWhy(role) {
  return `Skild AI's work on general-purpose robot intelligence matches the robotics systems I have been building in graduate school: perception, simulation, controls, and reliable validation on physical systems. For this ${role.role} role, I am especially interested in helping turn robot learning into measurable behavior through strong testing, debugging, sensor data workflows, and disciplined engineering across simulation and hardware.`;
}

function proudProjects() {
  return "Two projects I am proud of are Efficient TransFuser and my Parrot MiniDrone control work. In Efficient TransFuser, I built a camera-LiDAR perception and localization pipeline, reduced model parameters from 168M to 50M with EfficientNetV2-S, improved held-out loss by 8.7%, and improved BEV segmentation by 25.4% while debugging a mixed-precision training instability. On the MiniDrone, I implemented PID control, localization, inertial/visual sensor fusion, logging, automated tests, and safety checks on physical hardware.";
}

async function submitRole(browser, role) {
  const record = records.get(role.slug);
  verifyManifest(record);
  const roleDir = path.dirname(record.resume);
  const evidenceDir = path.resolve(roleDir, "evidence");
  fs.mkdirSync(evidenceDir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1800 } });
  const result = {
    slug: role.slug,
    company: role.company,
    role: role.role,
    provider: role.provider,
    url: role.applyUrl,
    status: "unknown",
    evidenceDir,
    submittedAnswers: [],
    manifestVerifiedAt: new Date().toISOString(),
  };

  try {
    await page.goto(role.applyUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(2500);
    const body = await page.locator("body").innerText().catch(() => "");
    if (/verify you are human|captcha|cloudflare|checking your browser/i.test(body)) {
      result.status = "blocked";
      result.blocker = "Human verification or anti-bot interstitial active before form fill.";
      return result;
    }

    const requiredLocationLabels = await page.locator('input[type="checkbox"][required]').evaluateAll((inputs) =>
      inputs.map((input) => input.closest("label")?.innerText || input.labels?.[0]?.innerText || ""),
    ).catch(() => []);
    if (
      requiredLocationLabels.length > 0
      && requiredLocationLabels.every((label) => /bengaluru|india/i.test(label))
      && !requiredLocationLabels.some((label) => /san francisco|pittsburgh|united states|usa|u\.s\./i.test(label))
    ) {
      result.status = "skipped";
      result.blocker = "Required location checkbox only offered Bengaluru, India, which is outside the U.S. relocation scope.";
      await page.screenshot({ path: path.join(evidenceDir, "location-blocker.png"), fullPage: true });
      result.evidencePath = path.join(evidenceDir, "location-blocker.png");
      return result;
    }

    await fillText(page, "#first_name", "George");
    await fillText(page, "#last_name", "Perangattu");
    await fillText(page, "#preferred_name", "George");
    await fillText(page, "#email", "candidate@example.com");
    await fillText(page, "#phone", "+1 555-010-0200");
    await fillAutocomplete(page, "#country", "United States");
    await page.locator('input[type="file"]#resume').first().setInputFiles(record.resume);
    result.submittedAnswers.push("Resume/CV: George_Jobi_Resume.pdf");
    if ((await page.locator('input[type="file"]#cover_letter').count()) > 0) {
      await page.locator('input[type="file"]#cover_letter').first().setInputFiles(record.coverLetter);
      result.submittedAnswers.push("Cover letter: George_Jobi_CoverLetter.pdf");
    }
    const supportingFile = page.locator('input[type="file"][id^="question_"]').first();
    if ((await supportingFile.count()) > 0 && (await supportingFile.isVisible().catch(() => false))) {
      await supportingFile.setInputFiles(record.coverLetter);
      result.submittedAnswers.push("Supporting file: George_Jobi_CoverLetter.pdf");
    }

    await fillAutocomplete(page, "#school--0", "Arizona State University");
    await fillAutocomplete(page, "#degree--0", "Master's Degree");
    await fillAutocomplete(page, "#discipline--0", "Robotics and Autonomous Systems");
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
        await page.locator(byId(id)).fill(skildWhy(role));
        result.submittedAnswers.push(`${label}: role-specific Skild AI motivation`);
      } else if (/two to three projects|projects or accomplishments/i.test(label)) {
        await page.locator(byId(id)).fill(proudProjects());
        result.submittedAnswers.push(`${label}: Efficient TransFuser and MiniDrone projects`);
      }
    }
    await checkLabel(page, /San Francisco, CA/i);
    await checkLabel(page, /Pittsburgh, PA/i);

    await page.screenshot({ path: path.join(evidenceDir, "pre-submit.png"), fullPage: true });
    await page.getByRole("button", { name: /submit application/i }).last().click({ timeout: 30000 });
    await page.waitForTimeout(10000);
    let finalText = await page.locator("body").innerText().catch(() => "");
    if (/security code/i.test(finalText) && (codes[role.slug] || waitForCode)) {
      const code = codes[role.slug] ? String(codes[role.slug]).trim() : await waitForCodeFile(role);
      const codeInputs = page.locator("input").filter({ hasText: "" });
      const inputCount = await codeInputs.count();
      if (inputCount >= code.length) {
        for (let index = 0; index < code.length; index += 1) {
          await codeInputs.nth(inputCount - code.length + index).fill(code[index]);
        }
      } else {
        await page.keyboard.type(code);
      }
      await page.getByRole("button", { name: /submit application/i }).last().click({ timeout: 30000 });
      await page.waitForTimeout(10000);
      finalText = await page.locator("body").innerText().catch(() => "");
    }
    result.finalUrl = page.url();
    result.finalTextSnippet = finalText.slice(0, 2000);
    await page.screenshot({ path: path.join(evidenceDir, "post-submit.png"), fullPage: true });
    if (/thank you|application submitted|we received|successfully submitted|thanks for applying/i.test(finalText)) {
      result.status = "submitted-pending-verification";
      result.evidencePath = path.join(evidenceDir, "post-submit.png");
      result.evidenceText = "Greenhouse application submission acknowledgement visible after final submit.";
    } else if (/captcha|verify you are human|please verify/i.test(finalText)) {
      result.status = "blocked";
      result.blocker = "Human verification challenge appeared after final submit.";
    } else if (/required|please complete|invalid|error|select an option/i.test(finalText)) {
      result.status = "blocked";
      result.blocker = "Greenhouse form reported validation errors after submit.";
    } else {
      result.status = "unknown";
      result.blocker = "No recognizable success or blocker message after submit; needs manual review.";
    }
    return result;
  } catch (error) {
    result.status = "error";
    result.blocker = error.message;
    try {
      await page.screenshot({ path: path.join(evidenceDir, "error.png"), fullPage: true });
    } catch {
      // Keep original error.
    }
    return result;
  } finally {
    await page.close().catch(() => {});
  }
}

const browser = await chromium.launch({ headless: true });
const results = [];
for (const role of roles) {
  const result = await submitRole(browser, role);
  results.push(result);
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ slug: result.slug, status: result.status, blocker: result.blocker || null }, null, 2));
}
await browser.close();
