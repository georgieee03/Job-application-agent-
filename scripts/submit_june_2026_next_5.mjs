import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = path.resolve(".");
const PACKAGE_ROOT = path.join(ROOT, "data", "june-2026-next-5");
const SUMMARY_PATH = path.join(PACKAGE_ROOT, "package-summary.json");
const RESULTS_PATH = path.join(PACKAGE_ROOT, "submission-results.json");
const PROFILE_DIR = path.join(ROOT, ".chrome-june-2026-next-5");

const CANDIDATE = {
  fullName: "George Jobi Perangattu",
  email: "gjobiper@asu.edu",
  phone: "(480) 742-9855",
  location: "Tempe, Arizona",
  organization: "Arizona State University",
  linkedin: "https://www.linkedin.com/in/george-j-1829112a2/",
  gpa: "3.5",
  startDate: "06/23/2026",
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
  };
}

async function sha256(filePath) {
  const bytes = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

async function verifyApprovedFiles(role) {
  const manifest = JSON.parse(await fs.readFile(role.approvalManifest, "utf8"));
  const actualManifestHash = await sha256(role.approvalManifest);
  if (actualManifestHash !== role.approvalManifestSha256) {
    throw new Error("Approval manifest hash mismatch");
  }
  const resume = manifest.files.resume;
  if ((await sha256(resume.path)) !== String(resume.sha256).toLowerCase()) {
    throw new Error("Approved resume hash mismatch");
  }
  return manifest;
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
      const style = getComputedStyle(frame);
      const rect = frame.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity || "1") > 0 &&
        rect.width >= 40 &&
        rect.height >= 40
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

async function setInputFile(page, selector, filePath) {
  const input = page.locator(selector);
  if ((await input.count()) !== 1) {
    throw new Error(`Expected one file input for ${selector}`);
  }
  await input.setInputFiles(filePath);
  await page.waitForTimeout(1000);
  const expectedName = path.basename(filePath);
  const state = await input.evaluate((element) => ({
    value: element.value,
    files: [...(element.files ?? [])].map((file) => file.name),
  }));
  const visibleText = await page.locator("body").innerText().catch(() => "");
  const retainedInUi = visibleText
    .toLowerCase()
    .includes(expectedName.toLowerCase());
  if (!state.files.includes(expectedName) && !retainedInUi) {
    throw new Error(`Upload did not persist: ${JSON.stringify(state)}`);
  }
}

async function fillIfPresent(page, selector, value) {
  const input = page.locator(selector);
  if ((await input.count()) === 1) {
    await input.fill(value);
    return true;
  }
  return false;
}

async function clickQuestionButton(page, questionText, answer) {
  const question = page
    .locator("div")
    .filter({ hasText: questionText })
    .filter({ has: page.getByRole("button", { name: answer, exact: true }) });
  const candidates = await question.count();
  if (candidates === 0) {
    throw new Error(`Question not found: ${questionText}`);
  }
  for (let index = 0; index < candidates; index += 1) {
    const container = question.nth(index);
    const button = container.getByRole("button", { name: answer, exact: true });
    if ((await button.count()) === 1 && (await button.isVisible())) {
      await button.click();
      return;
    }
  }
  throw new Error(`Unique answer button not found for: ${questionText}`);
}

async function clickRadioByQuestion(page, questionText, answer) {
  const item = page.locator("li.application-question").filter({ hasText: questionText });
  if ((await item.count()) !== 1) {
    throw new Error(`Expected one Lever question: ${questionText}`);
  }
  const radio = item.getByRole("radio", { name: answer, exact: true });
  if ((await radio.count()) !== 1) {
    throw new Error(`Expected one '${answer}' radio for: ${questionText}`);
  }
  await radio.check();
}

async function fillLeverBase(page, role) {
  await setInputFile(page, 'input[data-qa="input-resume"]', role.resume);
  await page.locator('input[data-qa="name-input"]').fill(CANDIDATE.fullName);
  await page.locator('input[data-qa="email-input"]').fill(CANDIDATE.email);
  await fillIfPresent(page, 'input[data-qa="phone-input"]', CANDIDATE.phone);
  await fillIfPresent(page, 'input[data-qa="location-input"]', CANDIDATE.location);
  await fillIfPresent(page, 'input[data-qa="org-input"]', CANDIDATE.organization);
  await fillIfPresent(page, 'input[name="urls[LinkedIn]"]', CANDIDATE.linkedin);
}

async function applyFieldAI(page, role) {
  await fillLeverBase(page, role);
  await clickRadioByQuestion(
    page,
    "Are you legally authorized to work in the country where this position is located?",
    "Yes",
  );
  await clickRadioByQuestion(
    page,
    "Will you now or in the future require employer sponsorship",
    "Yes",
  );
  await clickRadioByQuestion(
    page,
    "Are you at least 18 years of age and legally eligible",
    "Yes",
  );
  const certification = page.getByRole("checkbox", {
    name: "I certify and agree",
    exact: true,
  });
  if ((await certification.count()) !== 1) {
    throw new Error("FieldAI certification checkbox not found");
  }
  await certification.check();
}

async function fillAshbyBase(page, role) {
  await setInputFile(page, "#_systemfield_resume", role.resume);
  await page.locator("#_systemfield_name").fill(CANDIDATE.fullName);
  await page.locator("#_systemfield_email").fill(CANDIDATE.email);
}

async function applyCorvus(page, role) {
  await fillAshbyBase(page, role);
  await clickQuestionButton(
    page,
    "Do you have a valid US driver's license",
    "Yes",
  );
  const location = page.getByRole("combobox", { name: "Start typing...", exact: true });
  if ((await location.count()) !== 1) {
    throw new Error("Corvus location field not found");
  }
  await location.fill("Tempe, Arizona");
  await page.waitForTimeout(600);
  await location.press("ArrowDown");
  await location.press("Enter");
}

async function applyArxlight(page, role) {
  await fillAshbyBase(page, role);
  await fillIfPresent(page, 'input[type="tel"]', CANDIDATE.phone);
  await clickQuestionButton(
    page,
    "Are you authorized to work in the United States?",
    "Yes",
  );
  const studentVisa = page.getByRole("radio", {
    name: "Student Visa (F-1/N-1)",
    exact: true,
  });
  if ((await studentVisa.count()) !== 1) {
    throw new Error("Arxlight F-1 export-control option not found");
  }
  await studentVisa.check();
  await clickQuestionButton(
    page,
    "comfortable with working onsite",
    "Yes",
  );
  await clickQuestionButton(
    page,
    "enjoys tackling challenging problems",
    "Yes",
  );
  const date = page.getByRole("textbox", { name: "Pick date...", exact: true });
  if ((await date.count()) !== 1) {
    throw new Error("Arxlight start-date field not found");
  }
  await date.fill(CANDIDATE.startDate);
  const gpa = page.getByRole("spinbutton", { name: "What's your GPA?*", exact: true });
  if ((await gpa.count()) !== 1) {
    throw new Error("Arxlight GPA field not found");
  }
  await gpa.fill(CANDIDATE.gpa);
}

const HANDLERS = {
  "corvus-product-implementation-engineer": applyCorvus,
  "arxlight-newgrad-engineering": applyArxlight,
  "fieldai-robotics-software-mapping": applyFieldAI,
  "fieldai-robotics-qa-qc-engineer": applyFieldAI,
  "humble-software-engineer-autonomous-systems": fillLeverBase,
};

async function findSubmitControl(page) {
  const candidates = [
    page.getByRole("button", { name: "Submit Application", exact: true }),
    page.getByRole("button", { name: "Submit application", exact: true }),
    page.locator("#btn-submit"),
    page.locator('button[type="submit"]'),
    page.locator('input[type="submit"]'),
  ];
  for (const candidate of candidates) {
    if ((await candidate.count()) === 1 && (await candidate.isVisible())) {
      return candidate;
    }
  }
  return null;
}

async function dismissHarmlessOverlays(page) {
  for (const name of ["Deny", "Reject", "Decline", "Accept"]) {
    const button = page.getByRole("button", { name, exact: true });
    if ((await button.count()) === 1 && (await button.isVisible())) {
      await button.click();
      await page.waitForTimeout(300);
      return;
    }
  }
}

async function submitAndCapture(page, folder) {
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

  const submit = await findSubmitControl(page);
  if (!submit) throw new Error("Unique visible submit control not found");
  await submit.click();
  await page.waitForTimeout(5500);

  const afterCaptcha = await captchaState(page);
  if (afterCaptcha.present) {
    const screenshot = path.join(folder, "submission-awaiting-captcha.png");
    await page.screenshot({ path: screenshot, fullPage: true });
    return {
      status: "awaiting-captcha",
      success: false,
      screenshot,
      captchaState: afterCaptcha,
      afterUrl: page.url(),
      notes: "Human-verification challenge appeared after the submit click.",
    };
  }

  const body = (await page.locator("body").innerText().catch(() => "")).toLowerCase();
  const confirmationText =
    SUCCESS_PHRASES.find((phrase) => body.includes(phrase)) ?? null;
  const success = Boolean(confirmationText);
  const screenshot = path.join(
    folder,
    success ? "submission-confirmation.png" : "submission-needs-review.png",
  );
  await page.screenshot({ path: screenshot, fullPage: true });
  return {
    status: success ? "submitted" : "needs-review",
    success,
    screenshot,
    afterUrl: page.url(),
    confirmationText,
    bodySnippet: body.slice(0, 2400),
    notes: success ? "" : "No authoritative success phrase detected after submission.",
  };
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

async function run() {
  const { only } = parseArgs();
  const indexed = JSON.parse(await fs.readFile(SUMMARY_PATH, "utf8"));
  const ledger = JSON.parse(
    await fs.readFile(path.join(PACKAGE_ROOT, "application-workbench.json"), "utf8"),
  );
  const applications = new Map(
    ledger.applications.map((application) => [application.role_id, application]),
  );
  const roles = indexed
    .filter((role) => !only || only.has(role.folder))
    .map((role) => ({
      ...role,
      approvalManifest: role.approvalManifest,
      approvalManifestSha256:
        applications.get(role.folder)?.approval_manifest_sha256 ?? "",
    }));
  if (!roles.length) throw new Error("No roles matched --only");

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
      if (!url.includes("non-user-graphql") && !url.includes("/applications")) {
        return;
      }
      let body = "";
      try {
        body = (await response.text()).slice(0, 12000);
      } catch {
        body = "";
      }
      providerResponses.push({
        url,
        status: response.status(),
        method: response.request().method(),
        body,
      });
    });
    try {
      await verifyApprovedFiles(role);
      await page.goto(role.applicationUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await page.waitForTimeout(1500);
      await dismissHarmlessOverlays(page);
      const handler = HANDLERS[role.folder];
      if (!handler) throw new Error(`No handler for ${role.folder}`);
      await handler(page, role);
      Object.assign(result, await submitAndCapture(page, folder));
      result.providerResponses = providerResponses;
    } catch (error) {
      result.notes = error instanceof Error ? error.message : String(error);
      result.providerResponses = providerResponses;
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
