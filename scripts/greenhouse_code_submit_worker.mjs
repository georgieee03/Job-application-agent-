if (process.env.JOB_APPLICATION_REVIEWED_LOCAL_HELPERS !== "true") {
  throw new Error("Public example helper: configure local facts, paths, role configuration, and authorization first; see docs/public-repository-setup.md.");
}

import { createRequire } from "module";
import fs from "fs";
import path from "path";

const require = createRequire("D:/job-application-agent-kit/package.json");
const { chromium } = require("playwright");

const ROOT = "D:/job-application-agent-kit";
const slug = process.argv[2];
if (!slug) {
  throw new Error("Usage: node scripts/greenhouse_code_submit_worker.mjs <slug>");
}

const configPath = process.env.GOAL_CONFIG || path.join(ROOT, "config/goal-20260812-robotics-replacements-greenhouse.json");
const indexPath = process.env.PACKAGE_INDEX || path.join(ROOT, "data/application-packages/goal-20260812-robotics-replacements-greenhouse/package-index.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
const role = config.roles.find((item) => item.slug === slug);
const pkg = index.records.find((item) => item.slug === slug);
if (!role || !pkg) {
  throw new Error(`Unknown slug ${slug}`);
}

const workDir = path.join(ROOT, "tmp", "greenhouse-worker", slug);
fs.mkdirSync(workDir, { recursive: true });
const statePath = path.join(workDir, "state.json");
const codePath = path.join(workDir, "code.txt");
const resultPath = path.join(workDir, "result.json");
const approveSubmitPath = path.join(workDir, "approve-submit.txt");
const screenshotDir = path.join(path.dirname(pkg.resume), "evidence-worker");
fs.mkdirSync(screenshotDir, { recursive: true });
for (const file of [codePath, resultPath]) {
  if (fs.existsSync(file)) fs.unlinkSync(file);
}
if (fs.existsSync(approveSubmitPath)) fs.unlinkSync(approveSubmitPath);
const idSelector = (id) => `#${String(id).replace(/([ #;?%&,.+*~':"!^$[\]()=>|/@])/g, "\\$1")}`;

function writeState(state) {
  fs.writeFileSync(statePath, JSON.stringify({ slug, ...state, updatedAt: new Date().toISOString() }, null, 2));
}

async function fill(selectorOrLocator, value) {
  const loc = typeof selectorOrLocator === "string" ? page.locator(selectorOrLocator).first() : selectorOrLocator.first();
  if (await loc.count()) {
    await loc.fill(value, { timeout: 3000 }).catch(async () => {
      await loc.click({ timeout: 3000 });
      await loc.pressSequentially(value, { delay: 5 });
    });
    return true;
  }
  return false;
}

async function choose(labelText, value) {
  const field = page.getByLabel(new RegExp(labelText, "i")).first();
  if (!(await field.count())) return false;
  await field.click({ timeout: 3000 }).catch(() => {});
  await field.press(process.platform === "darwin" ? "Meta+A" : "Control+A").catch(() => {});
  await field.fill(value, { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);
  const option = page.getByRole("option", { name: new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }).first();
  if (await option.count()) {
    await option.click({ timeout: 3000 }).catch(() => {});
  } else {
    await page.keyboard.press("ArrowDown").catch(() => {});
    await page.keyboard.press("Enter").catch(() => {});
  }
  return true;
}

async function chooseById(id, value) {
  const field = page.locator(idSelector(id)).first();
  if (!(await field.count())) return false;
  await field.click({ timeout: 3000 }).catch(() => {});
  await field.press(process.platform === "darwin" ? "Meta+A" : "Control+A").catch(() => {});
  await field.fill(value, { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);
  const exact = page.getByRole("option", { name: new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }).first();
  const fuzzy = page.getByRole("option", { name: new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }).first();
  if (await exact.count()) await exact.click({ timeout: 3000 }).catch(() => {});
  else if (await fuzzy.count()) await fuzzy.click({ timeout: 3000 }).catch(() => {});
  else {
    await page.keyboard.press("ArrowDown").catch(() => {});
    await page.keyboard.press("Enter").catch(() => {});
  }
  return true;
}

async function fillById(id, value) {
  return fill(page.locator(idSelector(id)), value);
}

async function fillQuestionByLabel(pattern, value) {
  const fields = await page.locator('input:not([type="file"]):not([type="checkbox"]):not([type="radio"]), textarea').all();
  for (const field of fields) {
    const visible = await field.isVisible().catch(() => false);
    if (!visible) continue;
    const label = await field.evaluate((el) => {
      const id = el.getAttribute("id");
      if (id) {
        const labelEl = document.querySelector(`label[for="${CSS.escape(id)}"]`);
        if (labelEl) return labelEl.textContent || "";
      }
      return el.closest("div,fieldset")?.innerText || "";
    }).catch(() => "");
    if (pattern.test(label)) {
      await field.fill(value, { timeout: 5000 }).catch(() => {});
      return true;
    }
  }
  return false;
}

async function chooseQuestionByLabel(pattern, value) {
  const fields = await page.locator('input[role="combobox"]').all();
  for (const field of fields) {
    const visible = await field.isVisible().catch(() => false);
    if (!visible) continue;
    const label = await field.evaluate((el) => {
      const id = el.getAttribute("id");
      if (id) {
        const labelEl = document.querySelector(`label[for="${CSS.escape(id)}"]`);
        if (labelEl) return labelEl.textContent || "";
      }
      return el.closest("div,fieldset")?.innerText || "";
    }).catch(() => "");
    if (pattern.test(label)) {
      await field.click({ timeout: 3000 }).catch(() => {});
      await field.press(process.platform === "darwin" ? "Meta+A" : "Control+A").catch(() => {});
      await field.fill(value, { timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(500);
      const option = page.getByRole("option", { name: new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }).first();
      if (await option.count()) await option.click({ timeout: 3000 }).catch(() => {});
      else {
        await page.keyboard.press("ArrowDown").catch(() => {});
        await page.keyboard.press("Enter").catch(() => {});
      }
      return true;
    }
  }
  return false;
}

async function checkLabel(labelText) {
  const box = page.getByLabel(new RegExp(labelText, "i")).first();
  if (!(await box.count())) return false;
  await box.check({ force: true }).catch(async () => box.click({ force: true }).catch(() => {}));
  return true;
}

async function chooseFirstCombobox(labelText, preferred = []) {
  const field = page.getByLabel(new RegExp(labelText, "i")).first();
  if (!(await field.count())) return false;
  await field.click({ timeout: 3000 }).catch(() => {});
  for (const value of preferred) {
    await field.fill(value, { timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(250);
    await page.keyboard.press("ArrowDown").catch(() => {});
    await page.keyboard.press("Enter").catch(() => {});
    return true;
  }
  await page.keyboard.press("ArrowDown").catch(() => {});
  await page.keyboard.press("Enter").catch(() => {});
  return true;
}

async function answerRadio(question, answer) {
  const q = page.locator("label,legend,div,span,p").filter({ hasText: new RegExp(question, "i") }).first();
  if (!(await q.count())) return false;
  const container = q.locator("xpath=ancestor::*[self::fieldset or self::div][1]").first();
  const radio = container.getByLabel(new RegExp(`^${answer}$`, "i")).first();
  if (await radio.count()) {
    await radio.check({ force: true }).catch(async () => radio.click({ force: true }));
    return true;
  }
  return false;
}

async function fillRequiredTextareas() {
  const responses = JSON.parse(fs.readFileSync(path.join(path.dirname(pkg.resume), "application-responses.json"), "utf8"));
  const common = responses.common || responses;
  const cover = common.personal_statement || common.additional_information || "I am finishing my M.S. in Robotics and Autonomous Systems at Arizona State University, with hands-on work across perception, planning, controls, simulation, and physical robot testing.";
  const textareas = await page.locator("textarea").all();
  for (const textarea of textareas) {
    const visible = await textarea.isVisible().catch(() => false);
    if (!visible) continue;
    const name = await textarea.getAttribute("name").catch(() => "");
    const id = await textarea.getAttribute("id").catch(() => "");
    if (/captcha|recaptcha/i.test(`${name} ${id}`)) continue;
    const value = await textarea.inputValue().catch(() => "");
    if (value.trim()) continue;
    const label = await textarea.evaluate((el) => {
      const id = el.getAttribute("id");
      if (id) {
        const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
        if (label) return label.textContent || "";
      }
      return el.closest("div")?.innerText || "";
    }).catch(() => "");
    let answer = cover;
    if (/salary|compensation/i.test(label)) answer = "95000";
    if (/start/i.test(label)) answer = "Available to start two weeks after offer acceptance.";
    if (/why|interest|motiv/i.test(label)) answer = common.why_company || common.whyCompany || cover;
    await textarea.fill(answer.slice(0, 1900), { timeout: 5000 }).catch(() => {});
  }
}

async function fillForm() {
  await fill(page.locator('input[name="first_name"], input#first_name'), "George");
  await fill(page.locator('input[name="last_name"], input#last_name'), "Jobi Perangattu");
  await fill(page.locator('input[name="email"], input#email'), "candidate@example.com");
  await fill(page.locator('input[name="phone"], input#phone'), "+1 555-010-0200");
  await fill(page.getByLabel(/LinkedIn/i), "https://www.linkedin.com/in/candidate-profile/");
  await fill(page.getByLabel(/current company/i), "Arizona State University");
  await fill(page.getByLabel(/current location/i), "Tempe, AZ");
  await fill(page.getByLabel(/location/i), "Tempe, AZ");
  await chooseById("country", "United States");
  await chooseById("candidate-location", "Tempe");

  await choose("School", "Arizona State University");
  await chooseById("degree--0", "Master's Degree");
  await choose("Discipline", "Robotics");
  await chooseFirstCombobox("How did you hear|Source", ["LinkedIn", "Google", "Company website"]);

  const resumeInput = page.locator('input[type="file"][name*="resume"], input[type="file"]').first();
  await resumeInput.setInputFiles(pkg.resume);
  const uploads = await page.locator('input[type="file"]').all();
  if (uploads[1]) await uploads[1].setInputFiles(pkg.coverLetter).catch(() => {});

  await answerRadio("authorized|eligible|legally", "Yes");
  await answerRadio("sponsorship|visa", "Yes");
  await answerRadio("relocat", "Yes");
  await answerRadio("onsite|on-site", "Yes");
  await answerRadio("background", "Yes");
  await answerRadio("18 years", "Yes");
  await chooseQuestionByLabel(/local to|near|relocat|located/i, "No");
  await fillQuestionByLabel(/how did you.*hear|first hear|source/i, "Company careers page");
  await fillQuestionByLabel(/availability|desired start|start date/i, "Available two weeks after offer acceptance");
  await fillQuestionByLabel(/salary|compensation/i, "95000");
  await chooseQuestionByLabel(/authorized|legally.*work/i, "Yes");
  await chooseQuestionByLabel(/sponsorship|visa/i, "Yes");
  await checkLabel("^None/Not applicable$");
  await checkLabel("Citizen or Legal Permanent Resident of a different country");
  await fillQuestionByLabel(/applicable country|country or countries/i, "India");
  await chooseQuestionByLabel(/agreement.*current or former employer|restrict/i, "No");
  await chooseQuestionByLabel(/relatives|family members/i, "No");
  await fillQuestionByLabel(/linkedin/i, "https://www.linkedin.com/in/candidate-profile/");
  await chooseById("gender", "Male");
  await chooseById("hispanic_ethnicity", "No");
  await chooseById("veteran_status", "I am not a protected veteran");
  await chooseById("disability_status", "No, I do not have a disability and have not had one in the past");

  await fillRequiredTextareas();

  const sf = page.getByLabel(/San Francisco|San Mateo|Pittsburgh|Austin|Fort Worth|Ann Arbor|Boston|Somerville|Southaven|Las Vegas|North East|Milpitas/i);
  const count = await sf.count().catch(() => 0);
  for (let i = 0; i < count; i += 1) {
    await sf.nth(i).check({ force: true }).catch(() => {});
  }
}

async function submitUntilCodeOrDone() {
  const submit = page.getByRole("button", { name: /submit|apply/i }).last();
  await submit.click({ timeout: 10000 });
  await page.waitForTimeout(3500);
  await fillRequiredTextareas();
  const stillSubmit = page.getByRole("button", { name: /submit|apply/i }).last();
  if (await stillSubmit.count()) {
    await stillSubmit.click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(5000);
  }
  const body = await page.locator("body").innerText({ timeout: 10000 }).catch(() => "");
  if (/security code|verification code|enter.*code/i.test(body)) return "awaiting-code";
  if (/thank you|received|success|submitted/i.test(body)) return "submitted";
  if (/captcha|hcaptcha|verify you are human/i.test(body)) return "captcha";
  return "validation";
}

async function waitForApprovalFile() {
  if (process.env.REQUIRE_PRE_SUBMIT_APPROVAL !== "1") return true;
  const deadline = Date.now() + 20 * 60 * 1000;
  while (Date.now() < deadline && !fs.existsSync(approveSubmitPath)) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return fs.existsSync(approveSubmitPath);
}

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();
try {
  writeState({ state: "opening", company: role.company, role: role.role, url: role.applyUrl });
  await page.goto(role.applyUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await fillForm();
  const preSubmitPath = path.join(screenshotDir, "pre-submit-filled.png");
  await page.screenshot({ path: preSubmitPath, fullPage: true });
  const audit = await page.evaluate(() => {
    function labelFor(el) {
      const id = el.getAttribute("id");
      if (id) {
        const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
        if (label) return label.textContent || "";
      }
      return el.closest("div,fieldset")?.innerText || "";
    }
    return [...document.querySelectorAll("input, textarea")].filter((el) => {
      const box = el.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && !["file", "hidden", "checkbox", "radio"].includes((el.getAttribute("type") || "").toLowerCase());
    }).map((el) => ({
      id: el.getAttribute("id") || "",
      type: el.getAttribute("type") || el.tagName.toLowerCase(),
      label: labelFor(el).trim().replace(/\s+/g, " ").slice(0, 220),
      value: el.value || "",
    }));
  });
  fs.writeFileSync(path.join(workDir, "pre-submit-audit.json"), JSON.stringify({ slug, company: role.company, role: role.role, screenshot: preSubmitPath, fields: audit }, null, 2));
  writeState({ state: "pre-submit-review", company: role.company, role: role.role, screenshot: preSubmitPath, auditPath: path.join(workDir, "pre-submit-audit.json") });
  const approved = await waitForApprovalFile();
  if (!approved) throw new Error("Timed out waiting for pre-submit approval file");
  const state = await submitUntilCodeOrDone();
  const beforePath = path.join(screenshotDir, `${state}.png`);
  await page.screenshot({ path: beforePath, fullPage: true });
  writeState({ state, company: role.company, role: role.role, screenshot: beforePath, resultPath });
  if (state === "awaiting-code") {
    const deadline = Date.now() + 10 * 60 * 1000;
    while (Date.now() < deadline && !fs.existsSync(codePath)) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (!fs.existsSync(codePath)) throw new Error("Timed out waiting for code file");
    const code = fs.readFileSync(codePath, "utf8").trim();
    const inputs = await page.locator("input").all();
    const candidates = [];
    for (const input of inputs) {
      const visible = await input.isVisible().catch(() => false);
      const disabled = await input.isDisabled().catch(() => true);
      const type = await input.getAttribute("type").catch(() => "");
      const box = await input.boundingBox().catch(() => null);
      if (!visible || disabled || !box || /file|checkbox|radio|hidden/i.test(type || "")) continue;
      const value = await input.inputValue().catch(() => "");
      if (!value && box.width <= 80 && box.height <= 80) candidates.push({ input, y: box.y, x: box.x });
    }
    candidates.sort((a, b) => a.y - b.y || a.x - b.x);
    const codeInputs = candidates.slice(-8).map((item) => item.input);
    if (codeInputs.length >= 8 && code.length >= 8) {
      await codeInputs[0].click({ timeout: 5000 });
      await page.keyboard.type(code, { delay: 35 });
      await page.waitForTimeout(1000);
      const values = [];
      for (const input of codeInputs) values.push(await input.inputValue().catch(() => ""));
      if (values.join("").replace(/\s/g, "").length < 8) {
        for (let i = 0; i < 8; i += 1) await codeInputs[i].fill(code[i]);
      }
    } else {
      await fill(page.locator('input[type="text"], input[inputmode="text"], input[inputmode="numeric"]').last(), code);
    }
    const submitAgain = page.getByRole("button", { name: /submit|verify|continue/i }).last();
    await submitAgain.waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await submitAgain.click({ timeout: 15000 });
    await page.waitForTimeout(7000);
    const afterBody = await page.locator("body").innerText({ timeout: 10000 }).catch(() => "");
    const postPath = path.join(screenshotDir, "post-submit.png");
    await page.screenshot({ path: postPath, fullPage: true });
    const result = {
      slug,
      state: /thank you|received|success|submitted/i.test(afterBody) ? "submitted" : "unknown",
      company: role.company,
      role: role.role,
      screenshot: postPath,
      excerpt: afterBody.slice(0, 1200),
      finishedAt: new Date().toISOString(),
    };
    fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
    writeState({ state: result.state, company: role.company, role: role.role, screenshot: postPath, resultPath });
  } else {
    const result = {
      slug,
      state,
      company: role.company,
      role: role.role,
      screenshot: beforePath,
      excerpt: (await page.locator("body").innerText().catch(() => "")).slice(0, 1200),
      finishedAt: new Date().toISOString(),
    };
    fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
  }
} catch (error) {
  const errorPath = path.join(screenshotDir, "error.png");
  await page.screenshot({ path: errorPath, fullPage: true }).catch(() => {});
  fs.writeFileSync(resultPath, JSON.stringify({ slug, state: "error", error: String(error), screenshot: errorPath, finishedAt: new Date().toISOString() }, null, 2));
  writeState({ state: "error", error: String(error), screenshot: errorPath, resultPath });
  process.exitCode = 1;
} finally {
  await browser.close();
}
