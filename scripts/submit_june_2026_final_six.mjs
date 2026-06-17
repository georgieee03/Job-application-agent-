import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = path.resolve(".");
const RUN_ROOT = path.join(ROOT, "data", "june-2026-next-5");
const SUMMARY_PATH = path.join(RUN_ROOT, "final-six-package-summary.json");
const RESULTS_PATH = path.join(RUN_ROOT, "final-six-submission-results.json");
const PROFILE_DIR = path.join(ROOT, ".chrome-june-2026-final-six");

const CANDIDATE = {
  fullName: "George Jobi Perangattu",
  firstName: "George",
  lastName: "Jobi Perangattu",
  email: "gjobiper@asu.edu",
  phone: "(480) 742-9855",
  country: "United States",
  city: "Tempe, Arizona",
  linkedin: "https://www.linkedin.com/in/george-j-1829112a2/",
};

const CORVUS = {
  folder: "corvus-product-implementation-engineer",
  company: "Corvus Robotics",
  role: "Product Implementation Engineer I, II",
  listingUrl:
    "https://jobs.ashbyhq.com/corvus-robotics/e180a9e8-6611-485b-b76a-bbf995b69e7f",
  applicationUrl:
    "https://jobs.ashbyhq.com/corvus-robotics/e180a9e8-6611-485b-b76a-bbf995b69e7f/application",
  resume: path.join(
    RUN_ROOT,
    "corvus-product-implementation-engineer",
    "George_Jobi_Resume.pdf",
  ),
  approvalManifest: path.join(
    RUN_ROOT,
    "corvus-product-implementation-engineer",
    "approval-manifest.json",
  ),
};

const SUCCESS_PHRASES = [
  "application submitted",
  "application was successfully submitted",
  "thank you for applying",
  "thank you for your application",
  "thanks for applying",
  "we received your application",
  "we have received your application",
  "successfully submitted",
];

function parseArgs() {
  const onlyArg = process.argv.find((arg) => arg.startsWith("--only="));
  const securityCodeArg = process.argv.find((arg) =>
    arg.startsWith("--security-code="),
  );
  return {
    only: onlyArg
      ? new Set(
          onlyArg
            .slice("--only=".length)
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        )
      : null,
    securityCode: securityCodeArg
      ? securityCodeArg.slice("--security-code=".length).trim()
      : null,
  };
}

async function sha256(filePath) {
  const bytes = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

async function verifyApprovedFiles(role, ledgerApplication) {
  if (!ledgerApplication) throw new Error("Role missing from authoritative ledger");
  if (ledgerApplication.approval_status !== "approved") {
    throw new Error("Role is not approval-bound in the authoritative ledger");
  }
  const manifest = JSON.parse(await fs.readFile(role.approvalManifest, "utf8"));
  if (
    (await sha256(role.approvalManifest))
    !== ledgerApplication.approval_manifest_sha256
  ) {
    throw new Error("Approval manifest hash mismatch");
  }
  const files = [
    manifest.files.resume,
    manifest.files.coverLetter,
    ...(manifest.files.attachments ?? []),
    ...(manifest.files.responses ?? []),
  ].filter(Boolean);
  for (const file of files) {
    if ((await sha256(file.path)) !== String(file.sha256).toLowerCase()) {
      throw new Error(`Approval hash mismatch for ${file.filename}`);
    }
  }
  return manifest;
}

async function loadResults() {
  try {
    return JSON.parse(await fs.readFile(RESULTS_PATH, "utf8"));
  } catch {
    return [];
  }
}

async function saveResult(results, result) {
  const index = results.findIndex((item) => item.folder === result.folder);
  if (index >= 0) results[index] = result;
  else results.push(result);
  await fs.writeFile(RESULTS_PATH, `${JSON.stringify(results, null, 2)}\n`);
}

async function fillIfPresent(page, selector, value) {
  const field = page.locator(selector);
  if ((await field.count()) === 1) {
    await field.fill(value);
    return true;
  }
  return false;
}

async function setInputFile(page, selector, filePath) {
  const input = page.locator(selector);
  if ((await input.count()) !== 1) {
    throw new Error(`Expected one file input for ${selector}`);
  }
  await input.setInputFiles(filePath);
  await page.waitForTimeout(900);
  const expected = path.basename(filePath);
  const files = await input
    .evaluate((element) => [...(element.files ?? [])].map((file) => file.name))
    .catch(() => []);
  const body = await page.locator("body").innerText().catch(() => "");
  if (
    !files.includes(expected)
    && !body.toLowerCase().includes(expected.toLowerCase())
  ) {
    throw new Error(`Upload did not persist for ${expected}`);
  }
}

async function selectCombobox(page, selector, value) {
  const input = page.locator(selector);
  if ((await input.count()) !== 1) {
    throw new Error(`Expected one combobox for ${selector}`);
  }
  const tag = await input.evaluate((element) => element.tagName.toLowerCase());
  if (tag === "select") {
    await input.selectOption({ label: value });
    return;
  }
  await input.click();
  if (await input.isEditable().catch(() => false)) {
    await input.fill(value).catch(() => {});
  }
  await page.waitForTimeout(250);
  await input.press("ArrowDown");
  await input.press("Enter");
  await page.waitForTimeout(250);
}

async function fieldFromLabel(page, labelText) {
  const label = page.locator("label").filter({ hasText: labelText }).first();
  if ((await label.count()) !== 1) {
    throw new Error(`Required label not found: ${labelText}`);
  }
  const forId = await label.getAttribute("for");
  if (forId) return page.locator(`[id=${JSON.stringify(forId)}]`);
  const container = label.locator("xpath=..");
  const field = container.locator("input, textarea, select").first();
  if ((await field.count()) !== 1) {
    throw new Error(`Field not found for label: ${labelText}`);
  }
  return field;
}

async function selectQuestion(page, labelText, value) {
  const field = await fieldFromLabel(page, labelText);
  const id = await field.getAttribute("id");
  if (!id) throw new Error(`Question field has no id: ${labelText}`);
  await selectCombobox(page, `[id=${JSON.stringify(id)}]`, value);
}

async function fillQuestion(page, labelText, value) {
  const field = await fieldFromLabel(page, labelText);
  await field.fill(value);
}

async function fillGreenhouseBase(page, role) {
  await page.locator("#first_name").fill(CANDIDATE.firstName);
  await page.locator("#last_name").fill(CANDIDATE.lastName);
  await fillIfPresent(page, "#preferred_name", CANDIDATE.firstName);
  await page.locator("#email").fill(CANDIDATE.email);
  if ((await page.locator("#country").count()) === 1) {
    await selectCombobox(page, "#country", CANDIDATE.country);
  }
  await fillIfPresent(page, "#phone", CANDIDATE.phone);
  await setInputFile(page, "#resume", role.resume);
}

async function fillAshbyBase(page, role) {
  await setInputFile(page, "#_systemfield_resume", role.resume);
  await page.locator("#_systemfield_name").fill(CANDIDATE.fullName);
  await page.locator("#_systemfield_email").fill(CANDIDATE.email);
  await fillIfPresent(page, 'input[type="tel"]', CANDIDATE.phone);
  await fillIfPresent(page, "#_systemfield_phone", CANDIDATE.phone);
  await fillIfPresent(page, "#_systemfield_linkedin", CANDIDATE.linkedin);

  const location = page.getByRole("combobox", {
    name: "Start typing...",
    exact: true,
  });
  if ((await location.count()) === 1) {
    await location.fill("Tempe");
    await page.waitForTimeout(900);
    const option = page.getByText("Tempe, Arizona, United States", { exact: true });
    if ((await option.count()) >= 1 && (await option.first().isVisible())) {
      await option.first().click();
    } else {
      await location.press("ArrowDown");
      await location.press("Enter");
    }
  }
}

async function loadResponses(manifest) {
  const responseFile = (manifest.files.responses ?? []).find(
    (item) => item.filename === "application-responses.json",
  );
  return responseFile
    ? JSON.parse(await fs.readFile(responseFile.path, "utf8"))
    : {};
}

async function fillTextboxByName(page, name, value) {
  const field = page.getByRole("textbox", { name, exact: false });
  if ((await field.count()) !== 1) {
    throw new Error(`Required textbox not found: ${name}`);
  }
  await field.fill(String(value));
}

async function clickQuestionButton(page, questionText, answer) {
  const title = page
    .locator("label.ashby-application-form-question-title")
    .filter({ hasText: questionText })
    .first();
  if ((await title.count()) !== 1) {
    throw new Error(`Question title not found: ${questionText}`);
  }
  const container = title.locator("xpath=ancestor::*[@data-field-path][1]");
  const button = container.getByRole("button", { name: answer, exact: true });
  if ((await button.count()) === 1 && (await button.isVisible())) {
    await button.click();
    return;
  }
  const radio = container.getByRole("radio", { name: answer, exact: true });
  if ((await radio.count()) === 1 && (await radio.isVisible())) {
    await radio.check();
    return;
  }
  throw new Error(`Could not answer '${questionText}' with '${answer}'`);
}

async function applyMvp(page, role) {
  await fillGreenhouseBase(page, role);
  await fillIfPresent(page, "#question_5862451009", CANDIDATE.linkedin);
  await selectCombobox(page, "#question_5862453009", "Yes");
  await selectCombobox(page, "#question_5862454009", "Yes");
  await selectCombobox(page, "#question_5862455009", "Yes");
}

async function applyLila(page, role, manifest) {
  await fillGreenhouseBase(page, role);
  await selectQuestion(page, "Will you now or in the future require sponsorship", "Yes");
  await selectQuestion(page, "Do you currently reside within", "Yes");
  await selectQuestion(page, "Are you able to work in the specified", "Yes");
  const responseFile = manifest.files.responses.find(
    (item) => item.filename === "application-responses.json",
  );
  if (!responseFile) throw new Error("Lila approval-bound response is missing");
  const responses = JSON.parse(await fs.readFile(responseFile.path, "utf8"));
  await fillQuestion(
    page,
    "Why Lila, why this role, and why at this moment",
    responses.why_lila_why_role_why_now,
  );
  await selectCombobox(
    page,
    "#question_6113329009",
    "I have read and acknowledge the privacy notice below",
  );
}

async function applyCorvus(page, role) {
  await fillAshbyBase(page, role);
  await clickQuestionButton(page, "valid US driver's license", "Yes");
}

async function applyVerne(page, role, manifest) {
  await fillAshbyBase(page, role);
  const responses = await loadResponses(manifest);
  await clickQuestionButton(page, "willing and able to relocate", "Yes");
  await fillTextboxByName(
    page,
    "Why do you want to work at Verne?",
    responses.why_verne,
  );
  await fillTextboxByName(
    page,
    "LinkedIn profile",
    responses.linkedin_profile,
  );
  await clickQuestionButton(
    page,
    "legally authorized to work in the United States without sponsorship",
    "No",
  );
  await clickQuestionButton(page, "willing to undergo a background check", "Yes");
}

async function applyStandardSubsea(page, role, manifest) {
  await fillAshbyBase(page, role);
  const responses = await loadResponses(manifest);
  await fillTextboxByName(page, "LinkedIn URL", responses.linkedin_url);
  await clickQuestionButton(page, "able to work on-site in El Segundo", "Yes");
  const workVisa = page.getByRole("radio", {
    name: responses.current_us_work_authorization_status,
    exact: true,
  });
  if ((await workVisa.count()) !== 1) {
    throw new Error("Standard Subsea work-authorization option not found");
  }
  await workVisa.check();
  await fillTextboxByName(
    page,
    /something.*built.*most proud of/i,
    responses.proud_project,
  );
}

async function applyMolg(page, role, manifest) {
  await fillAshbyBase(page, role);
  const responses = await loadResponses(manifest);
  await fillTextboxByName(page, "LinkedIn", responses.linkedin);
  await clickQuestionButton(page, "require visa sponsorship", "No");
  await page.waitForTimeout(500);
  await clickQuestionButton(page, "require visa sponsorship", "Yes");
  await clickQuestionButton(page, "happy to work from our Virginia HQ", "Yes");
  const salary = page.getByRole("spinbutton", {
    name: "What are your salary expectations?",
    exact: false,
  });
  if ((await salary.count()) !== 1) {
    throw new Error("Molg salary field not found");
  }
  await salary.fill(String(responses.salary_expectations));
  await fillTextboxByName(
    page,
    "What is your notice period?",
    responses.notice_period,
  );
  await fillTextboxByName(page, "How did you hear about us?", responses.source);
}

const HANDLERS = {
  "corvus-product-implementation-engineer": applyCorvus,
  "mvp-robotics-software-engineer": applyMvp,
  "verne-robotics-software-engineer": applyVerne,
  "lila-software-engineer-i-instrument-software": applyLila,
  "standard-subsea-swe-robotics": applyStandardSubsea,
  "molg-robotics-engineer-path-planning": applyMolg,
};

async function captchaState(page) {
  return page.evaluate(() => {
    const text = document.body?.innerText?.toLowerCase() ?? "";
    const phrases = [
      "verify you are human",
      "verification challenge",
      "security verification",
      "complete the captcha",
    ].filter((needle) => text.includes(needle));
    const frames = [...document.querySelectorAll("iframe")].filter((frame) => {
      const src = (frame.getAttribute("src") ?? "").toLowerCase();
      const title = (frame.getAttribute("title") ?? "").toLowerCase();
      if (!/recaptcha|hcaptcha|turnstile|captcha|challenge/.test(`${src} ${title}`)) {
        return false;
      }
      if (src.includes("size=invisible") && src.includes("/anchor")) return false;
      const rect = frame.getBoundingClientRect();
      const style = getComputedStyle(frame);
      return (
        rect.width >= 40
        && rect.height >= 40
        && style.display !== "none"
        && style.visibility !== "hidden"
      );
    });
    return { present: phrases.length > 0 || frames.length > 0, phrases };
  });
}

async function findSubmit(page) {
  const controls = [
    page.getByRole("button", { name: "Submit application", exact: true }),
    page.getByRole("button", { name: "Submit Application", exact: true }),
    page.locator("#btn-submit"),
    page.locator('button[type="submit"]'),
    page.locator('input[type="submit"]'),
  ];
  for (const control of controls) {
    if ((await control.count()) === 1 && (await control.isVisible())) return control;
  }
  return null;
}

async function enterSecurityCode(page, code) {
  for (const selector of [
    'input[maxlength="1"]',
    'input[autocomplete="one-time-code"]',
    'input[aria-label^="Digit"]',
    'input[aria-label^="Character"]',
  ]) {
    const inputs = page.locator(selector);
    if ((await inputs.count()) !== code.length) continue;
    for (let index = 0; index < code.length; index += 1) {
      await inputs.nth(index).fill(code[index]);
    }
    return;
  }
  throw new Error("Could not identify security-code inputs");
}

async function submitAndCapture(page, role, securityCode) {
  const folder = path.dirname(role.resume);
  const initialCaptcha = await captchaState(page);
  if (initialCaptcha.present) {
    const screenshot = path.join(folder, "submission-awaiting-captcha.png");
    await page.screenshot({ path: screenshot, fullPage: true });
    return {
      status: "awaiting-captcha",
      success: false,
      screenshot,
      notes: "Visible human-verification challenge detected before submission.",
    };
  }

  let submit = await findSubmit(page);
  if (!submit) throw new Error("Unique visible submit control not found");
  await submit.click();
  await page.waitForTimeout(6000);

  let body = (await page.locator("body").innerText().catch(() => "")).toLowerCase();
  if (body.includes("verification code was sent")) {
    const screenshot = path.join(folder, "submission-awaiting-security-code.png");
    await page.screenshot({ path: screenshot, fullPage: true });
    if (!securityCode) {
      return {
        status: "awaiting-security-code",
        success: false,
        screenshot,
        notes: "Greenhouse emailed a one-time security code.",
      };
    }
    await enterSecurityCode(page, securityCode);
    submit = await findSubmit(page);
    if (!submit) throw new Error("Submit control missing after security code");
    await submit.click();
    await page.waitForTimeout(6000);
    body = (await page.locator("body").innerText().catch(() => "")).toLowerCase();
  }

  const finalCaptcha = await captchaState(page);
  if (finalCaptcha.present) {
    const screenshot = path.join(folder, "submission-awaiting-captcha.png");
    await page.screenshot({ path: screenshot, fullPage: true });
    return {
      status: "awaiting-captcha",
      success: false,
      screenshot,
      notes: "Human-verification challenge appeared during submission.",
    };
  }

  const confirmationText =
    SUCCESS_PHRASES.find((phrase) => body.includes(phrase)) ?? null;
  const success = Boolean(confirmationText);
  const screenshot = path.join(
    folder,
    success ? "submission-confirmation.png" : "submission-needs-review.png",
  );
  await page.screenshot({ path: screenshot, fullPage: true }).catch(() => {});
  return {
    status: success ? "submitted" : "needs-review",
    success,
    screenshot,
    afterUrl: page.url(),
    confirmationText,
    bodySnippet: body.slice(0, 3500),
    notes: success ? "" : "No authoritative success signal detected.",
  };
}

async function run() {
  const { only, securityCode } = parseArgs();
  const freshRoles = JSON.parse(await fs.readFile(SUMMARY_PATH, "utf8"));
  const allRoles = [CORVUS, ...freshRoles].filter(
    (role) => !only || only.has(role.folder),
  );
  if (!allRoles.length) throw new Error("No roles matched --only");

  const ledger = JSON.parse(
    await fs.readFile(path.join(RUN_ROOT, "application-workbench.json"), "utf8"),
  );
  const applications = new Map(
    ledger.applications.map((application) => [application.role_id, application]),
  );
  const results = await loadResults();

  await fs.mkdir(PROFILE_DIR, { recursive: true });
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: process.env.HEADLESS === "1",
    channel: "chrome",
    viewport: { width: 1365, height: 900 },
  });

  for (const role of allRoles) {
    const result = {
      company: role.company,
      role: role.role,
      folder: role.folder,
      applicationUrl: role.applicationUrl,
      attemptedAt: new Date().toISOString(),
      status: "blocked",
      success: false,
      notes: "",
    };
    const page = await context.newPage();
    const providerResponses = [];
    page.on("response", async (response) => {
      const url = response.url();
      if (!url.includes("non-user-graphql") && !url.includes("/applications")) return;
      providerResponses.push({
        url,
        status: response.status(),
        method: response.request().method(),
        body: await response.text().catch(() => ""),
      });
    });
    try {
      const manifest = await verifyApprovedFiles(role, applications.get(role.folder));
      await page
        .goto(role.applicationUrl, {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        })
        .catch(async (error) => {
          if ((await page.locator("body").innerText().catch(() => "")).length < 500) {
            throw error;
          }
        });
      await page.waitForTimeout(1800);
      const body = (await page.locator("body").innerText()).toLowerCase();
      if (
        body.includes("job is no longer available")
        || body.includes("no longer accepting applications")
      ) {
        throw new Error("Authoritative listing is closed");
      }
      const handler = HANDLERS[role.folder];
      if (!handler) throw new Error(`No handler for ${role.folder}`);
      await handler(page, role, manifest);
      await page.waitForTimeout(1800);
      Object.assign(result, await submitAndCapture(page, role, securityCode));
      result.providerResponses = providerResponses;
    } catch (error) {
      result.notes = error instanceof Error ? error.message : String(error);
      result.providerResponses = providerResponses;
      result.screenshot = path.join(
        path.dirname(role.resume),
        "submission-blocked.png",
      );
      result.bodySnippet = (
        await page.locator("body").innerText().catch(() => "")
      ).slice(0, 5000);
      await page
        .screenshot({ path: result.screenshot, fullPage: true })
        .catch(() => {});
    } finally {
      await saveResult(results, result);
      await page.close().catch(() => {});
    }
  }

  await context.close();
  console.log(JSON.stringify(results, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
