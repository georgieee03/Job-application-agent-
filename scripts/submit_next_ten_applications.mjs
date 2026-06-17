import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const ROOT = path.resolve(".");
const SUMMARY_PATH = path.join(ROOT, "data", "next-ten-applications", "package-summary.json");
const RESULTS_PATH = path.join(ROOT, "data", "next-ten-applications", "submission-results.json");

const CANDIDATE = {
  fullName: "George Jobi Perangattu",
  firstName: "George",
  lastName: "Jobi Perangattu",
  email: "gjobiper@asu.edu",
  phone: "4807429855",
  formattedPhone: "(480) 742-9855",
  location: "Tempe, AZ",
  country: "United States",
  state: "Arizona",
  linkedin: "https://www.linkedin.com/in/george-j-1829112a2/",
  company: "Arizona State University",
  title: "M.S. Robotics and Autonomous Systems Student",
  startDate: "2 weeks",
  source: "LinkedIn",
  salaryExpectation: "As listed in the job description",
  rosAnswer:
    "My ROS/ROS2 experience is primarily academic and project-based. I developed a 3D RRT motion-planning project integrated with Gazebo and ROS-style robotics workflows for simulation validation, and I have built physical robot control and sensor-fusion pipelines for the Parrot MiniDrone project. I have also worked on camera-LiDAR fusion, localization/perception outputs, state estimation concepts, and Python/C++ robotics software patterns that map directly to ROS-based autonomy stacks.",
  exceptionalWork:
    "One example of exceptional work is my Efficient TransFuser project, where I redesigned a camera-LiDAR sensor-fusion perception pipeline for autonomous driving research. I replaced the TransFuser backbone with EfficientNetV2-S, reducing parameters from about 168M to 50M while improving held-out loss, and built multi-task training/evaluation workflows for depth estimation, mapping, perception, and navigation. I also diagnosed an FP16 instability in CenterNet focal loss and documented the root cause and fix through validation experiments.",
  agTechMotivation:
    "I am interested in ag-tech because it puts robotics into a real physical environment where perception, localization, reliability, and operator usefulness all matter. My robotics work has focused on sensor fusion, perception, navigation, and real hardware validation, and Orchard's work is compelling because better field data can directly improve farm decision-making and productivity.",
  favoriteFruit: "orange",
  orchardDecode: "INTELLIGENTFRUIT",
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cssEscape(value) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function maybeClickByText(page, text, exact = true) {
  const locator = page.getByText(text, { exact });
  if ((await locator.count()) > 0) {
    await locator.first().click({ timeout: 3000 }).catch(() => {});
  }
}

async function fillByName(page, name, value) {
  const locator = page.locator(`[name="${cssEscape(name)}"]`);
  if ((await locator.count()) > 0) {
    await locator.first().fill(value, { timeout: 5000 });
    return true;
  }
  return false;
}

async function fillById(page, id, value) {
  const locator = page.locator(`[id="${cssEscape(id)}"]`);
  if ((await locator.count()) > 0) {
    await locator.first().fill(value, { timeout: 5000 });
    return true;
  }
  return false;
}

async function fillByLabel(page, label, value) {
  const locator = page.getByLabel(label, { exact: true });
  if ((await locator.count()) > 0) {
    await locator.first().fill(value, { timeout: 5000 });
    return true;
  }
  return false;
}

async function setFiles(page, selector, filePath) {
  const locator = page.locator(selector);
  if ((await locator.count()) > 0) {
    await locator.first().setInputFiles(filePath);
    await page.waitForTimeout(1500);
    return true;
  }
  return false;
}

async function clickChoice(page, { name, label, type = "checkbox" }) {
  const didClick = await page.evaluate(
    ({ name, label, type }) => {
      function labelText(el) {
        const direct = el.closest("label")?.innerText?.trim();
        if (direct) return direct.replace(/\s+/g, " ");
        if (el.id) {
          const lab = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
          if (lab?.innerText) return lab.innerText.trim().replace(/\s+/g, " ");
        }
        const parent = el.parentElement?.innerText?.trim();
        return (parent || "").replace(/\s+/g, " ");
      }
      const inputs = [...document.querySelectorAll(`input[type="${type}"]`)];
      const exact = inputs.find((el) => el.name === name && labelText(el) === label);
      const fuzzy = inputs.find((el) => el.name === name && labelText(el).includes(label));
      const target = exact || fuzzy;
      if (!target) return false;
      target.scrollIntoView({ block: "center" });
      target.click();
      target.dispatchEvent(new Event("input", { bubbles: true }));
      target.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    },
    { name, label, type },
  );
  if (!didClick) {
    throw new Error(`Could not click ${type} choice ${name}=${label}`);
  }
}

async function clickRadioId(page, id) {
  const locator = page.locator(`[id="${cssEscape(id)}"]`);
  if ((await locator.count()) > 0) {
    await locator.first().check({ force: true, timeout: 5000 });
    return true;
  }
  return false;
}

async function clickLabelIncludes(page, text) {
  const ok = await page.evaluate((text) => {
    const labels = [...document.querySelectorAll("label")];
    const label = labels.find((el) => el.innerText?.replace(/\s+/g, " ").includes(text));
    if (!label) return false;
    label.scrollIntoView({ block: "center" });
    label.click();
    return true;
  }, text);
  if (!ok) throw new Error(`Could not click label containing ${text}`);
}

async function selectGreenhouseAutocomplete(page, inputId, value) {
  const input = page.locator(`[id="${cssEscape(inputId)}"]`);
  await input.fill(value, { timeout: 5000 });
  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);
}

async function selectGreenhouseDropdownNear(page, id, optionText) {
  const input = page.locator(`[id="${cssEscape(id)}"]`);
  await input.click({ timeout: 5000 });
  await page.waitForTimeout(300);
  await page.keyboard.type(optionText);
  await page.waitForTimeout(300);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
}

async function fillGreenhouseValue(page, id, optionText) {
  const input = page.locator(`[id="${cssEscape(id)}"]`);
  await input.scrollIntoViewIfNeeded().catch(() => {});
  await input.click({ timeout: 5000 });
  await page.waitForTimeout(300);
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.keyboard.type(optionText);
  await page.waitForTimeout(300);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  const current = await input.inputValue().catch(() => "");
  if (!current || current.toLowerCase().includes("select")) {
    await input.fill(optionText).catch(() => {});
  }
}

async function submitAndVerify(page, folder, expectedTexts) {
  const beforeUrl = page.url();
  const submitButton = page.getByRole("button", { name: "Submit Application" });
  if ((await submitButton.count()) > 0) {
    await submitButton.first().click({ timeout: 10000 });
  } else if ((await page.locator("#btn-submit").count()) > 0) {
    await page.locator("#btn-submit").click({ timeout: 10000 });
  } else if ((await page.getByText("Submit application", { exact: true }).count()) > 0) {
    await page.getByText("Submit application", { exact: true }).click({ timeout: 10000 });
  } else {
    throw new Error("Submit button not found");
  }

  await page.waitForTimeout(7000);
  const body = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
  const success = expectedTexts.some((text) => body.toLowerCase().includes(text.toLowerCase()));
  const screenshot = path.join(folder, success ? "submission-confirmation.png" : "submission-after-submit.png");
  await page.screenshot({ path: screenshot, fullPage: true }).catch(() => {});
  return {
    success,
    beforeUrl,
    afterUrl: page.url(),
    screenshot,
    bodySnippet: body.slice(0, 1400),
  };
}

export async function fillLever(page, role) {
  const folderName = path.basename(path.dirname(role.resume));
  await maybeClickByText(page, "accept", false);
  await setFiles(page, 'input[name="resume"]', role.resume);
  await fillByName(page, "name", CANDIDATE.fullName);
  await fillByName(page, "email", CANDIDATE.email);
  await fillByName(page, "phone", CANDIDATE.formattedPhone);
  await fillByName(page, "location", CANDIDATE.location);
  await fillByName(page, "org", CANDIDATE.company);
  await fillByName(page, "urls[LinkedIn]", CANDIDATE.linkedin);

  if (folderName === "fieldai-ros-developer") {
    await clickChoice(page, { name: "cards[631785a2-31a3-4f63-b226-13d3d23f85e0][field0]", label: "LinkedIn" });
    await clickChoice(page, { name: "cards[59debaa2-5176-4710-939f-293b52c27284][field0]", label: "I can start in two to three weeks." });
    await clickChoice(page, { name: "cards[1a118c0e-edbb-485f-a0e2-8481dde47964][field0]", label: "Yes" });
    await clickChoice(page, { name: "cards[1a118c0e-edbb-485f-a0e2-8481dde47964][field1]", label: "Yes" });
    await clickChoice(page, { name: "cards[1a118c0e-edbb-485f-a0e2-8481dde47964][field2]", label: "Yes" });
    await clickChoice(page, { name: "cards[1a118c0e-edbb-485f-a0e2-8481dde47964][field3]", label: "Yes" });
    await clickChoice(page, { name: "cards[c30e2b1f-69a9-40c9-a568-bf60c9af8fe7][field0]", label: "Advanced" });
    await clickChoice(page, { name: "cards[d673df62-8fd1-45bb-be45-6f59939e90aa][field0]", label: "Intermediate" });
  }

  if (folderName === "fieldai-robot-integrations") {
    await clickChoice(page, { name: "cards[1a118c0e-edbb-485f-a0e2-8481dde47964][field0]", label: "Yes" });
    await clickChoice(page, { name: "cards[1a118c0e-edbb-485f-a0e2-8481dde47964][field1]", label: "Yes" });
    await clickChoice(page, { name: "cards[1a118c0e-edbb-485f-a0e2-8481dde47964][field2]", label: "Yes" });
    await clickChoice(page, { name: "cards[1a118c0e-edbb-485f-a0e2-8481dde47964][field3]", label: "Yes" });
    await clickChoice(page, { name: "cards[a3958a48-cdc5-473b-b74c-273b8f748504][field0]", label: "Yes", type: "radio" });
    await clickChoice(page, { name: "cards[59debaa2-5176-4710-939f-293b52c27284][field0]", label: "I can start in two to three weeks." });
  }

  if (folderName === "simbe-robotics-software-engineer") {
    await clickChoice(page, { name: "cards[9d4dd49d-6d4f-40dc-b992-86ec55398d9d][field0]", label: "Yes", type: "radio" });
    await clickChoice(page, { name: "cards[9d4dd49d-6d4f-40dc-b992-86ec55398d9d][field1]", label: "Yes", type: "radio" });
    await fillByName(page, "cards[9d4dd49d-6d4f-40dc-b992-86ec55398d9d][field2]", "Yes, I am willing to relocate to the Bay Area for this opportunity.");
    await fillByName(page, "cards[9d4dd49d-6d4f-40dc-b992-86ec55398d9d][field3]", CANDIDATE.rosAnswer);
    await fillByName(page, "cards[9d4dd49d-6d4f-40dc-b992-86ec55398d9d][field4]", CANDIDATE.salaryExpectation);
  }

  if (folderName === "chef-robotics-staff-autonomy") {
    await clickChoice(page, { name: "cards[3304cc1f-dbbd-4c55-9030-cd512b4d04ae][field0]", label: "Yes", type: "radio" });
    await fillByName(page, "cards[3304cc1f-dbbd-4c55-9030-cd512b4d04ae][field1]", "2 weeks");
    await clickChoice(page, { name: "cards[3304cc1f-dbbd-4c55-9030-cd512b4d04ae][field2]", label: "Yes", type: "radio" });
    await fillByName(page, "cards[3304cc1f-dbbd-4c55-9030-cd512b4d04ae][field3]", "LinkedIn");
    await page.locator('select[name="eeo[gender]"]').selectOption({ label: "Decline to self-identify" }).catch(() => {});
    await page.locator('select[name="eeo[race]"]').selectOption({ label: "Decline to self-identify" }).catch(() => {});
    await page.locator('select[name="eeo[veteran]"]').selectOption({ label: "Decline to self-identify" }).catch(() => {});
  }
}

export async function fillBreezy(page, role) {
  await setFiles(page, 'input[name="cResume"]', role.resume);
  await fillByName(page, "cName", CANDIDATE.fullName);
  await fillByName(page, "cEmail", CANDIDATE.email);
  await fillByName(page, "cPhoneNumber", CANDIDATE.formattedPhone);
  await page.locator('input[name="smsConsent"]').uncheck({ force: true }).catch(() => {});
  await clickRadioId(page, "race_white_no");
  await clickRadioId(page, "gender_no");
}

export async function fillAshby(page, role) {
  const folderName = path.basename(path.dirname(role.resume));
  await setFiles(page, "#_systemfield_resume", role.resume);
  await fillById(page, "_systemfield_name", CANDIDATE.fullName);
  await fillById(page, "_systemfield_email", CANDIDATE.email);

  if (folderName === "orchard-perception-localization") {
    await fillByLabel(page, "Current Location", CANDIDATE.location).catch(() => {});
    await fillById(page, "63bed4d4-5cdb-4333-9797-cdeaa052c451", CANDIDATE.formattedPhone);
    await fillById(page, "71ea31b8-442c-4c59-9ce2-3eb81667b517", CANDIDATE.linkedin);
    await fillById(page, "8cc83d65-ab08-4cd7-bf23-4ec7260befb7", CANDIDATE.exceptionalWork);
    await fillById(page, "74436627-2895-4f78-b556-cf784d17a0c4", CANDIDATE.agTechMotivation);
    await clickRadioId(page, "51fd0e35-dd59-406b-a7f9-2ca7a899b5b9_94b361c9-12be-4ab5-8bad-0fa93d0edee5-labeled-radio-1");
    await fillById(page, "e22fab38-d1d0-4a2c-b5ed-574978da545b", CANDIDATE.company);
    await fillById(page, "9cb990c7-9ebe-4d22-9d79-afc6ccd341bd", CANDIDATE.title);
    await clickLabelIncludes(page, "few days of travel each month");
    await fillById(page, "15309409-cef5-412f-abc8-baf97d1f25a0", CANDIDATE.favoriteFruit);
    await clickRadioId(page, "51fd0e35-dd59-406b-a7f9-2ca7a899b5b9_56d3f46b-114b-4bec-bc66-97cee02f3061-labeled-radio-1");
    await clickRadioId(page, "51fd0e35-dd59-406b-a7f9-2ca7a899b5b9_fdde19f0-2291-4351-9139-dc38a5ab385d-labeled-radio-0");
    await fillById(page, "7bae9167-c6fd-4ab9-927b-a053caeeaf2b", CANDIDATE.orchardDecode);
  }

  if (folderName === "skydio-autonomy-software-engineer") {
    await fillById(page, "phone", CANDIDATE.formattedPhone);
    await fillById(page, "question_28197609003", CANDIDATE.linkedin);
    await fillById(page, "question_28197611003", "LinkedIn");
    await page.locator('input[id$="__systemfield_eeoc_gender-labeled-radio-2"]').check({ force: true }).catch(() => {});
    await page.locator('input[id$="__systemfield_eeoc_race-labeled-radio-7"]').check({ force: true }).catch(() => {});
    await page.locator('input[id$="__systemfield_eeoc_veteran_status-labeled-radio-2"]').check({ force: true }).catch(() => {});
    await page.locator('input[id$="__systemfield_eeoc_disability_status-labeled-radio-2"]').check({ force: true }).catch(() => {});
  }

  if (folderName === "gecko-field-software-engineer-manufacturing") {
    await fillById(page, "187cd0e9-cd4f-4be4-9879-ddfdbc3f0856", "George");
    await clickLabelIncludes(page, "Are you legally authorized to work in the United States");
    await clickLabelIncludes(page, "Will you now or will you in the future require employment visa sponsorship");
    await clickRadioId(page, "00e0875d-a280-42ab-a5b4-c91426ccea47_8b6daa4e-adb5-42c2-93d3-25ca054ffbd6-labeled-radio-0").catch(async () => {
      await clickRadioId(page, "e8c191a8-454e-4ad4-b15d-e7dc157a86f9_8b6daa4e-adb5-42c2-93d3-25ca054ffbd6-labeled-radio-0");
    });
    await fillByLabel(page, "How did you hear about Gecko?", "LinkedIn").catch(async () => {
      const emptyText = page.locator('input[type="text"]').filter({ hasText: "" });
      await emptyText.last().fill("LinkedIn").catch(() => {});
    });
    await page.locator('input[id$="__systemfield_eeoc_gender-labeled-radio-2"]').check({ force: true }).catch(() => {});
    await page.locator('input[id$="__systemfield_eeoc_race-labeled-radio-7"]').check({ force: true }).catch(() => {});
    await page.locator('input[id$="__systemfield_eeoc_veteran_status-labeled-radio-2"]').check({ force: true }).catch(() => {});
    await page.locator('input[id$="__systemfield_eeoc_disability_status-labeled-radio-2"]').check({ force: true }).catch(() => {});
  }
}

export async function fillGreenhouse(page, role) {
  await fillById(page, "first_name", CANDIDATE.firstName);
  await fillById(page, "last_name", CANDIDATE.lastName);
  await fillById(page, "email", CANDIDATE.email);
  await fillById(page, "country", CANDIDATE.country);
  await fillById(page, "phone", CANDIDATE.phone);
  await setFiles(page, "#resume", role.resume);
  await fillById(page, "question_12094796007", CANDIDATE.linkedin);
  await fillGreenhouseValue(page, "question_12094797007", "Yes");
  await fillGreenhouseValue(page, "question_12094798007", "Yes");
  await fillGreenhouseValue(page, "question_12094799007", "None");
  await fillGreenhouseValue(page, "question_12094800007", "Arizona");
  await fillGreenhouseValue(page, "question_12094801007", "10");
  await fillGreenhouseValue(page, "question_12094802007", "5");
  await fillGreenhouseValue(page, "question_12094803007", "7");
  await fillGreenhouseValue(page, "question_12094804007", "10");
  await fillGreenhouseValue(page, "question_12094805007", "6");
}

export function applyUrlFor(role) {
  const folderName = path.basename(path.dirname(role.resume));
  if (folderName === "bear-robotics-autonomy") {
    return "https://bear-robotics.breezy.hr/p/f1b7a8aa0763-robotics-software-engineer-ii-autonomy/apply";
  }
  return role.applicationUrl;
}

async function run() {
  const roles = JSON.parse(await fs.readFile(SUMMARY_PATH, "utf8"));
  const profileDir = path.join(ROOT, ".chrome-apply-profile");
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: process.env.HEADLESS === "1",
    channel: "chrome",
    viewport: { width: 1365, height: 900 },
    acceptDownloads: true,
  }).catch(async () => chromium.launchPersistentContext(profileDir, {
    headless: process.env.HEADLESS === "1",
    viewport: { width: 1365, height: 900 },
    acceptDownloads: true,
  }));

  const results = [];
  for (const role of roles) {
    const page = await context.newPage();
    const folder = path.dirname(role.resume);
    const folderName = path.basename(folder);
    const result = {
      company: role.company,
      role: role.role,
      folder: folderName,
      applicationUrl: applyUrlFor(role),
      resume: role.resume,
      atsScore: role.ats?.atsScore,
      status: "not-started",
      notes: "",
    };
    try {
      await page.goto(result.applicationUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(2500);
      if (result.applicationUrl.includes("lever.co")) {
        await fillLever(page, role);
        Object.assign(result, await submitAndVerify(page, folder, ["application submitted", "thank you", "thanks for applying", "we received"]));
      } else if (result.applicationUrl.includes("breezy.hr")) {
        await fillBreezy(page, role);
        Object.assign(result, await submitAndVerify(page, folder, ["application submitted", "successfully submitted", "thank you"]));
      } else if (result.applicationUrl.includes("ashbyhq.com")) {
        await fillAshby(page, role);
        Object.assign(result, await submitAndVerify(page, folder, ["application was successfully submitted", "successfully submitted", "thanks"]));
      } else if (result.applicationUrl.includes("greenhouse.io")) {
        await fillGreenhouse(page, role);
        Object.assign(result, await submitAndVerify(page, folder, ["thank you for applying", "application has been submitted", "we have received"]));
      } else {
        throw new Error("Unknown application platform");
      }
      result.status = result.success ? "submitted" : "needs-review";
      if (!result.success) {
        result.notes = "No success message detected after submit; screenshot saved for review.";
      }
    } catch (error) {
      result.status = "blocked";
      result.notes = error?.message || String(error);
      result.screenshot = path.join(folder, "submission-blocked.png");
      await page.screenshot({ path: result.screenshot, fullPage: true }).catch(() => {});
    } finally {
      results.push(result);
      await fs.writeFile(RESULTS_PATH, JSON.stringify(results, null, 2));
      await page.close().catch(() => {});
      await delay(1000);
    }
  }
  await context.close();
  console.log(JSON.stringify(results, null, 2));
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
