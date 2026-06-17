import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = path.resolve(".");
const PACKAGE_ROOT = path.join(ROOT, "data", "june-2026-ten-applications");
const SUMMARY_PATH = path.join(PACKAGE_ROOT, "package-summary.json");
const RESULTS_PATH = path.join(PACKAGE_ROOT, "submission-results.json");
const PROFILE_DIR = path.join(ROOT, ".chrome-june-2026-applications");

const CANDIDATE = {
  fullName: "George Jobi Perangattu",
  firstName: "George",
  lastName: "Jobi Perangattu",
  email: "gjobiper@asu.edu",
  phone: "(480) 742-9855",
  city: "Tempe",
  location: "Tempe, Arizona",
  country: "United States",
  linkedin: "https://www.linkedin.com/in/george-j-1829112a2/",
};

const SUCCESS_PHRASES = [
  "application submitted",
  "application was successfully submitted",
  "thank you for applying",
  "thank you for your application",
  "thanks for applying",
  "we received your application",
  "we have received your application",
];

function parseArgs() {
  const onlyArg = process.argv.find((arg) => arg.startsWith("--only="));
  const securityCodeArg = process.argv.find((arg) => arg.startsWith("--security-code="));
  const securityCodeFileArg = process.argv.find((arg) => arg.startsWith("--security-code-file="));
  return {
    only: onlyArg
      ? new Set(onlyArg.slice("--only=".length).split(",").map((value) => value.trim()).filter(Boolean))
      : null,
    securityCode: securityCodeArg
      ? securityCodeArg.slice("--security-code=".length).trim()
      : null,
    securityCodeFile: securityCodeFileArg
      ? path.resolve(securityCodeFileArg.slice("--security-code-file=".length).trim())
      : null,
  };
}

async function waitForSecurityCode(codeFile, timeoutMs = 20 * 60 * 1000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const code = (await fs.readFile(codeFile, "utf8")).trim();
      if (/^[A-Za-z0-9]{8}$/.test(code)) return code;
    } catch {
      // The user-facing process creates the file after the emailed code arrives.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Timed out waiting for the Greenhouse security code file.");
}

async function sha256(filePath) {
  const bytes = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

async function verifyApprovedFiles(role) {
  const manifestPath = role.approvalManifest;
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const files = [
    manifest.files.resume,
    manifest.files.coverLetter,
    ...(manifest.files.attachments ?? []),
  ].filter(Boolean);

  for (const file of files) {
    const actual = await sha256(file.path);
    if (actual !== String(file.sha256).toLowerCase()) {
      throw new Error(`Approval hash mismatch for ${file.filename}`);
    }
  }
  return manifest;
}

async function captchaState(page) {
  return page.evaluate(() => {
    const text = document.body?.innerText?.toLowerCase() ?? "";
    const matchedText = [
      "captcha",
      "verify you are human",
      "verification challenge",
      "security verification",
    ].filter((needle) => text.includes(needle));
    const visibleFrames = [...document.querySelectorAll("iframe")].filter((frame) => {
      const src = (frame.getAttribute("src") ?? "").toLowerCase();
      const title = (frame.getAttribute("title") ?? "").toLowerCase();
      if (!/recaptcha|hcaptcha|turnstile|captcha|challenge/.test(`${src} ${title}`)) return false;
      if (src.includes("size=invisible") && src.includes("/anchor")) return false;
      const style = getComputedStyle(frame);
      const rect = frame.getBoundingClientRect();
      return style.display !== "none"
        && style.visibility !== "hidden"
        && Number(style.opacity || "1") > 0
        && rect.width >= 40
        && rect.height >= 40;
    });
    return {
      present: matchedText.length > 0 || visibleFrames.length > 0,
      matchedText,
      visibleFrames: visibleFrames.map((frame) => ({
        src: frame.getAttribute("src"),
        title: frame.getAttribute("title"),
        width: frame.getBoundingClientRect().width,
        height: frame.getBoundingClientRect().height,
      })),
    };
  });
}

async function setInputFile(page, selector, filePath) {
  const input = page.locator(selector);
  if (await input.count() !== 1) {
    throw new Error(`Expected one file input for ${selector}`);
  }
  await input.setInputFiles(filePath);
  await page.waitForTimeout(1200);
  const expectedName = path.basename(filePath);
  const currentInput = page.locator(selector);
  let fileState = null;
  if (await currentInput.count() === 1) {
    fileState = await currentInput.evaluate((element) => ({
      value: element.value,
      files: [...(element.files ?? [])].map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type,
      })),
    }));
  }
  const visibleText = await page.locator("body").innerText().catch(() => "");
  const retainedInInput = fileState?.files?.length === 1
    && fileState.files[0].name === expectedName;
  const retainedInUi = visibleText.toLowerCase().includes(expectedName.toLowerCase());
  if (!retainedInInput && !retainedInUi) {
    throw new Error(
      `Resume upload did not persist for ${selector}: ${JSON.stringify(fileState)}`,
    );
  }
  return fileState;
}

async function fillRequired(page, selector, value) {
  const input = page.locator(selector);
  if (await input.count() !== 1) {
    throw new Error(`Expected one field for ${selector}`);
  }
  await input.fill(value);
}

async function fillIfPresent(page, selector, value) {
  const input = page.locator(selector);
  const count = await input.count();
  if (count === 1) {
    await input.fill(value);
    return true;
  }
  return false;
}

async function selectComboboxValue(page, selector, value) {
  const input = page.locator(selector);
  if (await input.count() !== 1) {
    throw new Error(`Expected one combobox input for ${selector}`);
  }
  await input.click();
  await input.fill(value);
  await page.waitForTimeout(350);
  await input.press("ArrowDown");
  await input.press("Enter");
  await page.waitForTimeout(250);
}

async function clickUnique(page, locator, description) {
  const count = await locator.count();
  if (count !== 1) {
    throw new Error(`Expected one ${description}; found ${count}`);
  }
  await locator.click();
}

async function findSubmitControl(page) {
  const submitCandidates = [
    page.getByRole("button", { name: "Submit Application", exact: true }),
    page.getByRole("button", { name: "Submit application", exact: true }),
    page.locator("#btn-submit"),
    page.locator('button[type="submit"]'),
    page.locator('input[type="submit"]'),
  ];

  for (const candidate of submitCandidates) {
    const count = await candidate.count();
    if (count === 1 && await candidate.isVisible()) return candidate;
  }
  return null;
}

async function enterGreenhouseSecurityCode(page, code) {
  const candidates = [
    'input[maxlength="1"]',
    'input[autocomplete="one-time-code"]',
    'input[aria-label^="Digit"]',
    'input[aria-label^="Character"]',
  ];
  let inputs = null;
  for (const selector of candidates) {
    const locator = page.locator(selector);
    if (await locator.count() === code.length) {
      inputs = locator;
      break;
    }
  }
  if (!inputs) {
    const details = await page.evaluate(() => [...document.querySelectorAll("input")].map((input) => ({
      id: input.id,
      type: input.type,
      maxLength: input.maxLength,
      aria: input.getAttribute("aria-label"),
      autocomplete: input.getAttribute("autocomplete"),
    })));
    throw new Error(`Could not identify ${code.length} security-code inputs: ${JSON.stringify(details)}`);
  }

  for (let index = 0; index < code.length; index += 1) {
    await inputs.nth(index).fill(code[index]);
  }
}

async function submitAndCapture(page, role, folder, securityCode, securityCodeFile) {
  const beforeCaptcha = await captchaState(page);
  if (beforeCaptcha.present) {
    const screenshot = path.join(folder, "submission-captcha-before-submit.png");
    await page.screenshot({ path: screenshot, fullPage: true });
    return {
      status: "captcha-skipped",
      success: false,
      screenshot,
      captchaState: beforeCaptcha,
      notes: "Visible human-verification challenge detected before submission; skipped per user instruction.",
    };
  }

  let submit = await findSubmitControl(page);
  if (!submit) throw new Error("Unique visible submit control not found");

  await submit.click();
  await page.waitForTimeout(5000);

  let body = (await page.locator("body").innerText().catch(() => "")).toLowerCase();
  if (body.includes("verification code was sent")) {
    let currentSecurityCode = securityCode;
    if (!currentSecurityCode && securityCodeFile) {
      const screenshot = path.join(folder, "submission-awaiting-security-code.png");
      await page.screenshot({ path: screenshot, fullPage: true });
      currentSecurityCode = await waitForSecurityCode(securityCodeFile);
    }
    if (!currentSecurityCode) {
      const screenshot = path.join(folder, "submission-awaiting-security-code.png");
      await page.screenshot({ path: screenshot, fullPage: true });
      return {
        status: "awaiting-security-code",
        success: false,
        screenshot,
        notes: "Greenhouse emailed a security code; user input required.",
      };
    }
    await enterGreenhouseSecurityCode(page, currentSecurityCode);
    submit = await findSubmitControl(page);
    if (!submit) throw new Error("Submit control not found after entering security code");
    await submit.click();
    await page.waitForTimeout(5000);
    body = (await page.locator("body").innerText().catch(() => "")).toLowerCase();
  }
  const afterCaptcha = await captchaState(page);
  if (afterCaptcha.present) {
    const screenshot = path.join(folder, "submission-captcha.png");
    await page.screenshot({ path: screenshot, fullPage: true });
    return {
      status: "captcha-skipped",
      success: false,
      screenshot,
      captchaState: afterCaptcha,
      notes: "Human-verification challenge detected after submit click; not bypassed.",
    };
  }

  const success = SUCCESS_PHRASES.some((phrase) => body.includes(phrase));
  const screenshot = path.join(
    folder,
    success ? "submission-confirmation.png" : "submission-needs-review.png",
  );
  let screenshotError = null;
  try {
    await page.screenshot({ path: screenshot, fullPage: true, timeout: 15000 });
  } catch (error) {
    screenshotError = error instanceof Error ? error.message : String(error);
  }
  return {
    status: success ? "submitted" : "needs-review",
    success,
    screenshot,
    afterUrl: page.url(),
    confirmationText: SUCCESS_PHRASES.find((phrase) => body.includes(phrase)) ?? null,
    bodySnippet: body.slice(0, 2400),
    notes: success
      ? (screenshotError ? `Confirmation text and URL captured; screenshot failed: ${screenshotError}` : "")
      : `No authoritative success phrase detected after submission.${screenshotError ? ` Screenshot failed: ${screenshotError}` : ""}`,
  };
}

async function fillAshbyBase(page, role) {
  await setInputFile(page, "#_systemfield_resume", role.resume);
  await fillRequired(page, "#_systemfield_name", CANDIDATE.fullName);
  await fillRequired(page, "#_systemfield_email", CANDIDATE.email);
}

async function applyTrener(page, role) {
  await fillAshbyBase(page, role);
}

async function applyMetamorphic(page, role) {
  const responsePath = path.join(path.dirname(role.resume), "application-responses.json");
  const responses = JSON.parse(await fs.readFile(responsePath, "utf8"));
  await fillAshbyBase(page, role);
  await fillIfPresent(page, "#a487897b-2f71-479e-9897-b2c943583c62", CANDIDATE.linkedin);
  await fillRequired(
    page,
    "#c55d6254-bbf0-4fa9-9738-28a64b1ea6aa",
    responses.whyMetamorphic,
  );
  await fillRequired(
    page,
    "#ce917e7f-75c8-489a-b176-b645c62e9e30",
    responses.exceptionalEffortAndPerseverance,
  );
  const yes = page.getByText("Yes", { exact: true });
  if (await yes.count() !== 1) throw new Error("Metamorphic sponsorship Yes option not unique");
  await yes.click();
  const date = page.getByPlaceholder("Pick date...", { exact: true });
  if (await date.count() !== 1) throw new Error("Metamorphic start-date field not found");
  await date.fill("06/22/2026");
  await fillIfPresent(
    page,
    '[id="9f341d8c-028f-4536-a183-3df091405269"]',
    "Company careers page via Google Search",
  );
}

async function applyCosmic(page, role) {
  await fillAshbyBase(page, role);
  const yes = page.locator('input[type="checkbox"][name="Yes"]');
  if (await yes.count() !== 1) throw new Error("Cosmic HQ Yes checkbox not found");
  await yes.check({ force: true });
}

async function applyMultiply(page, role) {
  await setInputFile(page, 'input[name="resume"]', role.resume);
  await fillRequired(page, 'input[name="name"]', CANDIDATE.fullName);
  await fillRequired(page, 'input[name="email"]', CANDIDATE.email);
  await fillIfPresent(page, 'input[name="phone"]', CANDIDATE.phone);
  await fillIfPresent(page, 'input[name="urls[LinkedIn]"]', CANDIDATE.linkedin);
}

async function applyBrightMachines(page, role) {
  await applyMultiply(page, role);
}

async function fillGreenhouseBase(page, role) {
  await fillRequired(page, "#first_name", CANDIDATE.firstName);
  await fillRequired(page, "#last_name", CANDIDATE.lastName);
  await fillRequired(page, "#email", CANDIDATE.email);
  await selectComboboxValue(page, "#country", CANDIDATE.country);
  await fillRequired(page, "#phone", CANDIDATE.phone);
  await setInputFile(page, "#resume", role.resume);
}

async function fillGreenhouseBaseFlexible(page, role) {
  await fillRequired(page, "#first_name", CANDIDATE.firstName);
  await fillRequired(page, "#last_name", CANDIDATE.lastName);
  await fillIfPresent(page, "#preferred_name", CANDIDATE.firstName);
  await fillRequired(page, "#email", CANDIDATE.email);
  await fillIfPresent(page, "#phone", CANDIDATE.phone);
  if (await page.locator("#country").count() === 1) {
    await selectComboboxValue(page, "#country", CANDIDATE.country);
  }
  await setInputFile(page, "#resume", role.resume);
}

async function selectIfPresent(page, selector, value) {
  if (await page.locator(selector).count() === 1) {
    await selectComboboxValue(page, selector, value);
    return true;
  }
  return false;
}

async function applyElevateRobotics(page, role) {
  await fillGreenhouseBaseFlexible(page, role);
  await fillIfPresent(page, "#question_5772586009", CANDIDATE.linkedin);
}

async function applyCerebras(page, role) {
  await fillGreenhouseBaseFlexible(page, role);
  await fillIfPresent(page, "#question_30711169003", CANDIDATE.linkedin);
  throw new Error(
    "User answer required for the legally specific Cerebras export-control citizenship/permanent-residency question.",
  );
}

async function applyAppLovin(page, role) {
  await fillGreenhouseBaseFlexible(page, role);
  await fillRequired(page, "#question_6186827006", CANDIDATE.linkedin);
  await selectIfPresent(page, "#question_6186829006", "No");
  await selectIfPresent(page, "#question_6186830006", "Yes");
  await selectIfPresent(page, "#question_6186831006", "Yes");
  // Salary is optional. Leave it blank rather than inventing an exact figure.
}

async function applyQuince(page, role) {
  await fillGreenhouseBaseFlexible(page, role);
  await fillRequired(page, "#question_16080795008", CANDIDATE.linkedin);
  await selectComboboxValue(page, "#question_16080796008", "Yes");
  await selectComboboxValue(page, "#question_16080797008", "Yes");
  await selectComboboxValue(
    page,
    '[id="question_16080798008[]"]',
    "H-1B Specialty Occupations",
  );
  await selectComboboxValue(
    page,
    '[id="question_16080798008[]"]',
    "F-1 OPT / STEM Optional Practical Training",
  );
  const universityOther = page.getByLabel("Other", { exact: true });
  if (await universityOther.count() !== 1) {
    throw new Error("Quince university 'Other' checkbox not found");
  }
  await universityOther.check();
}

async function applyRoboForce(page, role) {
  await fillGreenhouseBase(page, role);
  await fillIfPresent(page, "#question_15625303008", CANDIDATE.linkedin);
}

async function applyPathRobotics(page, role) {
  await fillGreenhouseBase(page, role);
  await selectComboboxValue(page, "#candidate-location", "Tempe, Arizona");
  await fillIfPresent(page, "#question_36075311002", CANDIDATE.linkedin);
  await selectComboboxValue(page, "#question_36075313002", "Yes");
  await selectComboboxValue(page, "#question_36075314002", "Yes");
  const raceSelector = '[id="4001401002"]';
  if (await page.locator(raceSelector).count() === 1) {
    await selectComboboxValue(page, raceSelector, "Asian");
  }
}

async function applyFigureEmbedded(page, role) {
  await fillGreenhouseBaseFlexible(page, role);
  await fillRequired(page, "#question_5801270006", CANDIDATE.linkedin);
}

async function applyKodiakPerception(page, role) {
  await fillGreenhouseBase(page, role);
  await fillIfPresent(page, "#question_5535220009", CANDIDATE.linkedin);
  await selectComboboxValue(page, "#question_5535222009", "Yes");
}

async function applyScoutRobotics(page, role) {
  await fillGreenhouseBase(page, role);
  await selectComboboxValue(page, "#question_15190324008", "Yes");
  await fillRequired(page, "#question_15190325008", CANDIDATE.linkedin);
}

async function applyRoboForceResident(page, role) {
  await fillGreenhouseBase(page, role);
  await fillIfPresent(page, "#question_15776950008", CANDIDATE.linkedin);
  await selectComboboxValue(page, "#question_15776952008", "Yes");
}

const HANDLERS = {
  "trener-software-integration-engineer": applyTrener,
  "metamorphic-robotics-engineer": applyMetamorphic,
  "cosmic-robotics-software-engineer": applyCosmic,
  "multiply-labs-robotics-software-engineer-ii": applyMultiply,
  "bright-machines-robot-perception-engineer": applyBrightMachines,
  "roboforce-robotics-software-engineer": applyRoboForce,
  "path-robotics-software-engineer-systems": applyPathRobotics,
  "elevate-robotics-software-engineer-intern": applyElevateRobotics,
  "cerebras-software-engineer-new-grad-2026": applyCerebras,
  "applovin-backend-engineer-new-grad": applyAppLovin,
  "quince-software-development-engineer-new-grad": applyQuince,
  "figure-embedded-software-intern-fall-2026": applyFigureEmbedded,
  "kodiak-fall-2026-perception-intern": applyKodiakPerception,
  "scout-ai-robotics-software-engineer": applyScoutRobotics,
  "roboforce-ai-resident": applyRoboForceResident,
};

async function loadPreviousResults() {
  try {
    return JSON.parse(await fs.readFile(RESULTS_PATH, "utf8"));
  } catch {
    return [];
  }
}

async function saveResult(results, next) {
  const index = results.findIndex((item) => item.folder === next.folder);
  if (index >= 0) results[index] = next;
  else results.push(next);
  await fs.writeFile(RESULTS_PATH, `${JSON.stringify(results, null, 2)}\n`);
}

async function loadRoles() {
  const rolesByFolder = new Map();
  try {
    const indexed = JSON.parse(await fs.readFile(SUMMARY_PATH, "utf8"));
    for (const role of indexed) {
      rolesByFolder.set(path.basename(path.dirname(role.resume)), role);
    }
  } catch {
    // The manifest discovery below is authoritative for approved files.
  }

  const entries = await fs.readdir(PACKAGE_ROOT, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(PACKAGE_ROOT, entry.name, "approval-manifest.json");
    try {
      const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
      const existing = rolesByFolder.get(entry.name) ?? {};
      const jobUrl = manifest.jobUrl;
      const applicationUrl = existing.applicationUrl
        ?? (jobUrl.includes("jobs.ashbyhq.com") && !jobUrl.endsWith("/application")
          ? `${jobUrl}/application`
          : jobUrl);
      rolesByFolder.set(entry.name, {
        ...existing,
        company: manifest.company,
        role: manifest.role,
        applicationUrl,
        listingUrl: jobUrl,
        resume: manifest.files.resume.path,
        approvalManifest: manifestPath,
      });
    } catch {
      // Ignore incomplete folders that are not approved application packages.
    }
  }
  return [...rolesByFolder.values()];
}

async function run() {
  const { only, securityCode, securityCodeFile } = parseArgs();
  const roles = await loadRoles();
  const results = await loadPreviousResults();
  const selected = roles.filter((role) => {
    const folder = path.basename(path.dirname(role.resume));
    return (!only || only.has(folder)) && HANDLERS[folder];
  });
  if (!selected.length) throw new Error("No implemented application handlers matched --only");

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: process.env.HEADLESS === "1",
    channel: "chrome",
    viewport: { width: 1365, height: 900 },
  });

  for (const role of selected) {
    const folder = path.dirname(role.resume);
    const folderName = path.basename(folder);
    const result = {
      company: role.company,
      role: role.role,
      folder: folderName,
      applicationUrl: role.applicationUrl,
      attemptedAt: new Date().toISOString(),
      status: "blocked",
      success: false,
      notes: "",
    };
    const page = await context.newPage();
    try {
      await verifyApprovedFiles(role);
      await page.goto(role.applicationUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(1800);
      await HANDLERS[folderName](page, role);
      Object.assign(
        result,
        await submitAndCapture(page, role, folder, securityCode, securityCodeFile),
      );
    } catch (error) {
      result.notes = error instanceof Error ? error.message : String(error);
      result.screenshot = path.join(folder, "submission-blocked.png");
      await page.screenshot({ path: result.screenshot, fullPage: true }).catch(() => {});
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
