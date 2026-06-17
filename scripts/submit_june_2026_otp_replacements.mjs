import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = path.resolve(".");
const RUN_ROOT = path.join(ROOT, "data", "june-2026-next-5");
const SUMMARY_PATH = path.join(RUN_ROOT, "otp-replacement-package-summary.json");
const LEDGER_PATH = path.join(RUN_ROOT, "application-workbench.json");
const RESULTS_PATH = path.join(RUN_ROOT, "otp-replacement-submission-results.json");
const PROFILE_DIR = path.join(ROOT, ".chrome-june-2026-otp-replacements");

const CANDIDATE = {
  fullName: "George Jobi Perangattu",
  email: "gjobiper@asu.edu",
  phone: "(480) 742-9855",
  linkedin: "https://www.linkedin.com/in/george-j-1829112a2/",
  currentCompany: "Arizona State University",
};

const SUCCESS_PHRASES = [
  "application was successfully submitted",
  "application submitted",
  "thank you for applying",
  "thank you for your application",
  "we received your application",
  "successfully submitted",
];

function parseArgs() {
  const onlyArg = process.argv.find((arg) => arg.startsWith("--only="));
  return onlyArg
    ? new Set(
        onlyArg
          .slice("--only=".length)
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      )
    : null;
}

async function sha256(filePath) {
  return crypto
    .createHash("sha256")
    .update(await fs.readFile(filePath))
    .digest("hex");
}

async function verifyApprovedFiles(role, ledgerApplication) {
  if (!ledgerApplication) throw new Error("Role is missing from the ledger");
  if (ledgerApplication.approval_status !== "approved") {
    throw new Error("Role is not approved in the authoritative ledger");
  }
  const manifest = JSON.parse(await fs.readFile(role.approvalManifest, "utf8"));
  if ((await sha256(role.approvalManifest)) !== ledgerApplication.approval_manifest_sha256) {
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

async function uploadResume(page, filePath) {
  const input = page.locator("#_systemfield_resume");
  if ((await input.count()) !== 1) throw new Error("Resume input not found");
  await input.setInputFiles(filePath);
  await page.waitForTimeout(1000);
  const uploadedNames = await input.evaluate((element) =>
    [...(element.files ?? [])].map((file) => file.name),
  );
  if (!uploadedNames.includes("George_Jobi_Resume.pdf")) {
    throw new Error("Approved resume upload did not persist");
  }
}

async function fillIfUnique(page, selector, value) {
  const input = page.locator(selector);
  if ((await input.count()) === 1) {
    await input.fill(value);
    return true;
  }
  return false;
}

async function fillBase(page, role) {
  await uploadResume(page, role.resume);
  await page.locator("#_systemfield_name").fill(CANDIDATE.fullName);
  await page.locator("#_systemfield_email").fill(CANDIDATE.email);
  await fillIfUnique(page, "#_systemfield_phone", CANDIDATE.phone);
  await fillIfUnique(page, 'input[type="tel"]', CANDIDATE.phone);

  const location = page.getByRole("combobox", {
    name: "Start typing...",
    exact: true,
  });
  if ((await location.count()) === 1) {
    await location.fill("Tempe");
    await page.waitForTimeout(900);
    const option = page.getByText("Tempe, Arizona, United States", {
      exact: true,
    });
    if ((await option.count()) >= 1 && (await option.first().isVisible())) {
      await option.first().click();
    } else {
      await location.press("ArrowDown");
      await location.press("Enter");
    }
  }
}

function fieldContainer(page, fieldPath) {
  return page.locator(`[data-field-path=${JSON.stringify(fieldPath)}]`);
}

async function fillFieldPath(page, fieldPath, value) {
  const container = fieldContainer(page, fieldPath);
  const input = container.locator("textarea, input").first();
  if ((await input.count()) !== 1) {
    throw new Error(`Text field not found for ${fieldPath}`);
  }
  await input.fill(value);
}

async function chooseButton(page, fieldPath, answer) {
  const container = fieldContainer(page, fieldPath);
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
  throw new Error(`Could not select ${answer} for ${fieldPath}`);
}

async function chooseSearchable(page, fieldPath, answer) {
  const container = fieldContainer(page, fieldPath);
  const input = container.locator('input[role="combobox"], input').first();
  if ((await input.count()) !== 1) {
    throw new Error(`Searchable field not found for ${fieldPath}`);
  }
  await input.click();
  await input.fill(answer).catch(() => {});
  await page.waitForTimeout(350);
  const option = page.getByRole("option", { name: answer, exact: true });
  if ((await option.count()) >= 1 && (await option.first().isVisible())) {
    await option.first().click();
    return;
  }
  const exactText = page.getByText(answer, { exact: true });
  if ((await exactText.count()) >= 1 && (await exactText.last().isVisible())) {
    await exactText.last().click();
    return;
  }
  await input.press("ArrowDown");
  await input.press("Enter");
}

async function loadResponses(manifest) {
  const responseFile = (manifest.files.responses ?? []).find(
    (item) => item.filename === "application-responses.json",
  );
  if (!responseFile) throw new Error("Approved response file is missing");
  return JSON.parse(await fs.readFile(responseFile.path, "utf8"));
}

async function fillCurrentEducation(page) {
  const container = fieldContainer(page, "_systemfield_education_history");
  const school = container.getByRole("combobox").first();
  if ((await school.count()) !== 1) throw new Error("Education school field missing");
  await school.fill("Arizona State University");
  await page.waitForTimeout(600);
  const option = page.getByRole("option", {
    name: "Arizona State University",
    exact: true,
  });
  if ((await option.count()) >= 1 && (await option.first().isVisible())) {
    await option.first().click();
  } else {
    await school.press("ArrowDown");
    await school.press("Enter");
  }
  await container
    .locator("#_systemfield_education_history-degree")
    .fill("Master of Science");
  await container
    .locator("#_systemfield_education_history-major")
    .fill("Robotics and Autonomous Systems");
  const startDate = container.locator("#_systemfield_education_history-startDate");
  await startDate.locator("select").nth(0).selectOption("8");
  await startDate.locator("select").nth(1).selectOption("2025");
  await container.locator("#_systemfield_education_history-isCurrent").check();
}

async function applyCircuitHub(page, role) {
  await fillBase(page, role);
}

async function applyAppliedIntuition(page, role, manifest) {
  await fillBase(page, role);
  const responses = await loadResponses(manifest);

  await fillCurrentEducation(page);
  await fillFieldPath(page, "c8f4f658-60c9-47cb-b077-22bdff8db283", CANDIDATE.phone);
  await fillFieldPath(page, "75bbd6ef-ddaf-49f8-858f-e31c1e57561a", CANDIDATE.linkedin);
  await fillFieldPath(
    page,
    "0032ec71-21f4-42b0-a346-6dfc697b8106",
    CANDIDATE.currentCompany,
  );
  await fillFieldPath(
    page,
    "dd8122f4-052b-42ba-aa89-8a72f0161220",
    responses.why_applied_intuition,
  );
  await chooseButton(page, "ec37e8d3-8b32-4b2c-aeeb-0e3feb9c00ca", "Yes");
  await chooseSearchable(
    page,
    "8a569271-786b-4ad3-b0c8-10b9d1644c5e",
    responses.source,
  );
  await fillFieldPath(
    page,
    "82b9e26d-782f-4529-981a-acb7d9ecf87c",
    responses.source_detail,
  );
  await chooseSearchable(
    page,
    "927ab999-02c1-4909-9e79-8d0058445344",
    responses.interview_language,
  );
  await chooseButton(
    page,
    "c2075c45-6166-4ae6-8d37-f43fcae48649",
    responses.future_sponsorship,
  );

  const asian = page.getByText("Asian", { exact: true });
  if ((await asian.count()) === 1 && (await asian.isVisible())) {
    const container = asian.locator("xpath=ancestor::*[@data-field-path][1]");
    const checkbox = container.getByRole("checkbox", { name: "Asian", exact: true });
    if ((await checkbox.count()) === 1) await checkbox.check();
  }
}

const HANDLERS = {
  "circuithub-full-stack-robotics-engineer": applyCircuitHub,
  "applied-intuition-software-engineer-cpp": applyAppliedIntuition,
};

async function findSubmit(page) {
  for (const control of [
    page.getByRole("button", { name: "Submit application", exact: true }),
    page.getByRole("button", { name: "Submit Application", exact: true }),
    page.locator('button[type="submit"]'),
  ]) {
    if ((await control.count()) === 1 && (await control.isVisible())) return control;
  }
  return null;
}

async function detectFriction(page) {
  const body = (await page.locator("body").innerText().catch(() => "")).toLowerCase();
  return [
    "verify you are human",
    "possible spam",
    "captcha",
    "cloudflare",
    "turnstile",
  ].find((phrase) => body.includes(phrase));
}

async function submitAndCapture(page, role) {
  const beforeFriction = await detectFriction(page);
  if (beforeFriction) throw new Error(`UI friction before submission: ${beforeFriction}`);

  const submit = await findSubmit(page);
  if (!submit) throw new Error("Unique submit control not found");
  await submit.click();
  await page.waitForTimeout(7000);

  const body = (await page.locator("body").innerText().catch(() => "")).toLowerCase();
  const friction = await detectFriction(page);
  if (friction) throw new Error(`UI friction after submission: ${friction}`);
  const confirmationText =
    SUCCESS_PHRASES.find((phrase) => body.includes(phrase)) ?? null;
  const success = Boolean(confirmationText);
  const screenshot = path.join(
    path.dirname(role.resume),
    success ? "submission-confirmation.png" : "submission-needs-review.png",
  );
  await page.screenshot({ path: screenshot, fullPage: true });
  return {
    status: success ? "submitted" : "needs-review",
    success,
    screenshot,
    afterUrl: page.url(),
    confirmationText,
    bodySnippet: body.slice(0, 4000),
    notes: success ? "" : "No authoritative success signal detected",
  };
}

async function run() {
  const only = parseArgs();
  const roles = JSON.parse(await fs.readFile(SUMMARY_PATH, "utf8")).filter(
    (role) => !only || only.has(role.folder),
  );
  if (!roles.length) throw new Error("No roles matched --only");
  const ledger = JSON.parse(await fs.readFile(LEDGER_PATH, "utf8"));
  const applications = new Map(
    ledger.applications.map((application) => [application.role_id, application]),
  );
  const results = await loadResults();

  await fs.mkdir(PROFILE_DIR, { recursive: true });
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    channel: "chrome",
    viewport: { width: 1365, height: 900 },
  });

  for (const role of roles) {
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
      if (!response.url().includes("ApiSubmitSingleApplicationFormAction")) return;
      providerResponses.push({
        url: response.url(),
        status: response.status(),
        method: response.request().method(),
        body: await response.text().catch(() => ""),
      });
    });
    try {
      const manifest = await verifyApprovedFiles(
        role,
        applications.get(role.folder),
      );
      await page.goto(role.applicationUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await page.waitForTimeout(2200);
      const initialBody = (await page.locator("body").innerText()).toLowerCase();
      if (
        initialBody.includes("job is no longer available") ||
        initialBody.includes("no longer accepting applications")
      ) {
        throw new Error("Authoritative listing is closed");
      }
      const handler = HANDLERS[role.folder];
      if (!handler) throw new Error(`No handler for ${role.folder}`);
      await handler(page, role, manifest);
      await page.waitForTimeout(1800);
      Object.assign(result, await submitAndCapture(page, role));
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
