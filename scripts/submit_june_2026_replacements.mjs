import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = path.resolve(".");
const PACKAGE_ROOT = path.join(ROOT, "data", "june-2026-next-5");
const SUMMARY_PATH = path.join(PACKAGE_ROOT, "replacement-package-summary.json");
const RESULTS_PATH = path.join(PACKAGE_ROOT, "replacement-submission-results.json");
const PROFILE_DIR = path.join(ROOT, ".chrome-june-2026-replacements");

const CANDIDATE = {
  firstName: "George",
  lastName: "Jobi Perangattu",
  email: "gjobiper@asu.edu",
  phone: "(480) 742-9855",
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
  const securityCodeFileArg = process.argv.find((arg) =>
    arg.startsWith("--security-code-file="),
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
      // The handoff file is created only after the user provides the emailed code.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Timed out waiting for the Greenhouse security code file.");
}

async function sha256(filePath) {
  const bytes = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

async function verifyApprovedFiles(role, ledgerApplication) {
  const manifest = JSON.parse(await fs.readFile(role.approvalManifest, "utf8"));
  const manifestHash = await sha256(role.approvalManifest);
  if (manifestHash !== ledgerApplication.approval_manifest_sha256) {
    throw new Error("Approval manifest hash mismatch");
  }
  if (ledgerApplication.approval_status !== "approved") {
    throw new Error("Package is not approved in the authoritative ledger");
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

async function fillRequired(page, selector, value) {
  const input = page.locator(selector);
  if ((await input.count()) !== 1) {
    throw new Error(`Expected one field for ${selector}`);
  }
  await input.fill(value);
}

async function fillIfPresent(page, selector, value) {
  const input = page.locator(selector);
  if ((await input.count()) === 1) {
    await input.fill(value);
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
  await page.waitForTimeout(1000);
  const expectedName = path.basename(filePath);
  const currentInput = page.locator(selector);
  let state = { files: [] };
  if ((await currentInput.count()) === 1) {
    state = await currentInput
      .evaluate((element) => ({
        files: [...(element.files ?? [])].map((file) => file.name),
      }))
      .catch(() => ({ files: [] }));
  }
  const visibleText = await page.locator("body").innerText().catch(() => "");
  if (
    !state.files.includes(expectedName)
    && !visibleText.toLowerCase().includes(expectedName.toLowerCase())
  ) {
    throw new Error(`Upload did not persist: ${JSON.stringify(state)}`);
  }
}

async function selectComboboxValue(page, selector, value) {
  const input = page.locator(selector);
  if ((await input.count()) !== 1) {
    throw new Error(`Expected one combobox for ${selector}`);
  }
  await input.click();
  await input.fill(value);
  await page.waitForTimeout(350);
  await input.press("ArrowDown");
  await input.press("Enter");
  await page.waitForTimeout(300);
}

async function fillGreenhouseBase(page, role) {
  await fillRequired(page, "#first_name", CANDIDATE.firstName);
  await fillRequired(page, "#last_name", CANDIDATE.lastName);
  await fillIfPresent(page, "#preferred_name", CANDIDATE.firstName);
  await fillRequired(page, "#email", CANDIDATE.email);
  if ((await page.locator("#country").count()) === 1) {
    await selectComboboxValue(page, "#country", CANDIDATE.country);
  }
  await fillIfPresent(page, "#phone", CANDIDATE.phone);
  await setInputFile(page, "#resume", role.resume);
}

async function applySkild(page, role, manifest) {
  await fillGreenhouseBase(page, role);
  const degree = page.locator("#degree--0");
  if ((await degree.count()) !== 1) throw new Error("Skild degree field missing");
  await degree.scrollIntoViewIfNeeded();
  await degree.click();
  await degree.press("ArrowDown");
  const masters = page.locator("#react-select-degree--0-option-8");
  await masters.waitFor({ state: "visible", timeout: 5000 });
  await masters.click();
  await fillIfPresent(page, "#question_5096761008", CANDIDATE.linkedin);

  for (const selector of [
    "#question_8789861008\\[\\]_10222228008",
    "#question_8789861008\\[\\]_36596788008",
  ]) {
    const checkbox = page.locator(selector);
    if ((await checkbox.count()) !== 1) {
      throw new Error(`Skild office checkbox missing: ${selector}`);
    }
    await checkbox.check({ force: true });
  }

  const responses = new Map(
    manifest.files.responses.map((response) => [response.filename, response.path]),
  );
  const why = await fs.readFile(responses.get("why-skild-ai.txt"), "utf8");
  const projects = await fs.readFile(
    responses.get("projects-and-accomplishments.txt"),
    "utf8",
  );
  await fillRequired(page, "#question_10505736008", why.trim());
  await fillRequired(page, "#question_10505737008", projects.trim());
}

async function applyNuro(page, role) {
  await fillGreenhouseBase(page, role);
  const isAiPlatform = role.folder === "nuro-software-engineer-ai-platform-new-grad";
  const ids = isAiPlatform
    ? {
        linkedin: "#question_61047256",
        authorized: "#question_61047258",
        sponsorship: "#question_61047259",
        hybrid: "#question_65616779",
      }
    : {
        linkedin: "#question_67373807",
        authorized: "#question_67373809",
        sponsorship: "#question_67373810",
        hybrid: "#question_67373811",
      };
  await fillIfPresent(page, ids.linkedin, CANDIDATE.linkedin);
  await selectComboboxValue(page, ids.authorized, "Yes");
  await selectComboboxValue(page, ids.sponsorship, "Yes");
  await selectComboboxValue(page, ids.hybrid, "Yes");
}

async function openApplication(page, role) {
  await page.goto(role.listingUrl, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(1600);
  if (role.company === "Nuro") {
    const frame = page.locator("iframe");
    if ((await frame.count()) !== 1) {
      throw new Error("Nuro Greenhouse application iframe not found");
    }
    const src = await frame.getAttribute("src");
    if (!src) throw new Error("Nuro Greenhouse iframe URL missing");
    await page.goto(src, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForTimeout(1000);
  }
  const heading = await page.locator("h1").innerText().catch(() => "");
  if (!heading.toLowerCase().includes(role.role.toLowerCase())) {
    throw new Error(`Live role mismatch or closed listing: ${heading}`);
  }
}

async function captchaState(page) {
  return page.evaluate(() => {
    const text = document.body?.innerText?.toLowerCase() ?? "";
    const matchedText = [
      "verify you are human",
      "verification challenge",
      "security verification",
      "complete the captcha",
    ].filter((needle) => text.includes(needle));
    const visibleFrames = [...document.querySelectorAll("iframe")].filter((frame) => {
      const src = (frame.getAttribute("src") ?? "").toLowerCase();
      const title = (frame.getAttribute("title") ?? "").toLowerCase();
      if (!/recaptcha|hcaptcha|turnstile|captcha|challenge/.test(`${src} ${title}`)) {
        return false;
      }
      if (src.includes("size=invisible") && src.includes("/anchor")) return false;
      const style = getComputedStyle(frame);
      const rect = frame.getBoundingClientRect();
      return (
        style.display !== "none"
        && style.visibility !== "hidden"
        && Number(style.opacity || "1") > 0
        && rect.width >= 40
        && rect.height >= 40
      );
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

async function findSubmitControl(page) {
  const candidates = [
    page.getByRole("button", { name: "Submit application", exact: true }),
    page.getByRole("button", { name: "Submit Application", exact: true }),
    page.locator("#btn-submit"),
    page.locator('button[type="submit"]'),
  ];
  for (const candidate of candidates) {
    if ((await candidate.count()) === 1 && (await candidate.isVisible())) {
      return candidate;
    }
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
  for (const selector of candidates) {
    const inputs = page.locator(selector);
    if ((await inputs.count()) !== code.length) continue;
    for (let index = 0; index < code.length; index += 1) {
      await inputs.nth(index).fill(code[index]);
    }
    return;
  }
  throw new Error("Could not identify Greenhouse security-code inputs");
}

async function submitAndCapture(page, role, folder, securityCode, securityCodeFile) {
  const beforeCaptcha = await captchaState(page);
  if (beforeCaptcha.present) {
    const screenshot = path.join(folder, "submission-awaiting-captcha.png");
    await page.screenshot({ path: screenshot, fullPage: true });
    return {
      status: "awaiting-captcha",
      success: false,
      screenshot,
      captchaState: beforeCaptcha,
      notes: "Visible human-verification challenge detected before submission.",
    };
  }

  let submit = await findSubmitControl(page);
  if (!submit) throw new Error("Unique visible submit control not found");
  await submit.click();
  await page.waitForTimeout(5500);

  let body = (await page.locator("body").innerText().catch(() => "")).toLowerCase();
  if (body.includes("verification code was sent")) {
    const screenshot = path.join(folder, "submission-awaiting-security-code.png");
    await page.screenshot({ path: screenshot, fullPage: true });
    let currentSecurityCode = securityCode;
    if (!currentSecurityCode && securityCodeFile) {
      currentSecurityCode = await waitForSecurityCode(securityCodeFile);
    }
    if (!currentSecurityCode) {
      return {
        status: "awaiting-security-code",
        success: false,
        screenshot,
        notes: "Greenhouse emailed a security code; user input required.",
      };
    }
    await enterGreenhouseSecurityCode(page, currentSecurityCode);
    submit = await findSubmitControl(page);
    if (!submit) throw new Error("Submit control not found after security code");
    await submit.click();
    await page.waitForTimeout(5500);
    body = (await page.locator("body").innerText().catch(() => "")).toLowerCase();
  }

  const afterCaptcha = await captchaState(page);
  if (afterCaptcha.present) {
    const screenshot = path.join(folder, "submission-awaiting-captcha.png");
    await page.screenshot({ path: screenshot, fullPage: true });
    return {
      status: "awaiting-captcha",
      success: false,
      screenshot,
      captchaState: afterCaptcha,
      notes: "Human-verification challenge appeared after submission.",
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
    bodySnippet: body.slice(0, 3000),
    notes: success ? "" : "No authoritative success phrase detected after submission.",
  };
}

async function run() {
  const { only, securityCode, securityCodeFile } = parseArgs();
  const summary = JSON.parse(await fs.readFile(SUMMARY_PATH, "utf8"));
  const ledger = JSON.parse(
    await fs.readFile(path.join(PACKAGE_ROOT, "application-workbench.json"), "utf8"),
  );
  const applications = new Map(
    ledger.applications.map((application) => [application.role_id, application]),
  );
  const roles = summary
    .filter((role) => !only || only.has(role.folder))
    .map((role) => ({
      ...role,
      approvalManifest: role.approvalManifest,
    }));
  if (!roles.length) throw new Error("No replacement roles matched --only");

  await fs.mkdir(PROFILE_DIR, { recursive: true });
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: process.env.HEADLESS === "1",
    channel: "chrome",
    viewport: { width: 1365, height: 900 },
  });
  const results = await loadPreviousResults();

  for (const role of roles) {
    const folder = path.dirname(role.resume);
    const result = {
      company: role.company,
      role: role.role,
      folder: role.folder,
      applicationUrl: role.listingUrl,
      attemptedAt: new Date().toISOString(),
      status: "blocked",
      success: false,
      notes: "",
    };
    const page = await context.newPage();
    try {
      const ledgerApplication = applications.get(role.folder);
      if (!ledgerApplication) throw new Error("Role missing from authoritative ledger");
      const manifest = await verifyApprovedFiles(role, ledgerApplication);
      await openApplication(page, role);
      if (role.company === "Skild AI") {
        await applySkild(page, role, manifest);
      } else if (role.company === "Nuro") {
        await applyNuro(page, role);
      } else {
        throw new Error(`No handler for ${role.company}`);
      }
      Object.assign(
        result,
        await submitAndCapture(
          page,
          role,
          folder,
          securityCode,
          securityCodeFile,
        ),
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
