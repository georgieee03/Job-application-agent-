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
const roles = cfg.roles.filter((role) => role.provider === "lever");
const outPath = "tmp/lever-submit-results.json";

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function verifyManifest(record) {
  const manifest = JSON.parse(fs.readFileSync(record.manifest, "utf8"));
  const items = [manifest.files.resume, manifest.files.coverLetter, ...(manifest.files.responses || [])];
  for (const item of items) {
    const actual = sha256(item.path);
    if (actual !== item.sha256) {
      throw new Error(`Manifest hash mismatch for ${item.path}`);
    }
  }
}

function option(options, preferred) {
  for (const want of preferred) {
    const found = (options || []).find((candidate) => candidate.trim().toLowerCase() === want.trim().toLowerCase());
    if (found) return found;
  }
  return null;
}

function answerForQuestion(question, options) {
  const text = question.toLowerCase();
  if (text.includes("legally authorized") || text.includes("authorized to work")) return option(options, ["Yes"]);
  if (text.includes("sponsorship") || text.includes("immigration sponsorship")) {
    return option(options, ["Yes, sponsorship or visa transfer required in the future", "Yes"]);
  }
  if (text.includes("18 years")) return option(options, ["Yes"]);
  if (text.includes("certify")) return option(options, ["I certify and agree"]);
  if (text.includes("optional practical training") || text.includes("(opt)")) return option(options, ["Yes"]);
  if (text.includes("stem")) return option(options, ["Yes"]);
  if (text.includes("onsite") || text.includes("commuting") || text.includes("work from our charlestown")) {
    return option(options, ["Yes"]);
  }
  if (text.includes("begin a new opportunity")) return option(options, ["I can start in two to three weeks."]);
  return null;
}

function textAnswer(question, role) {
  const text = question.toLowerCase();
  if (text === "first name") return "George";
  if (text === "middle name") return "Jobi";
  if (text === "last name") return "Perangattu";
  if (text.includes("address line 1")) return "123 Example Street";
  if (text.includes("address line 2")) return "";
  if (text === "city") return "Tempe";
  if (text === "state") return "AZ";
  if (text.includes("zip")) return "85281";
  if (text.includes("compensation")) {
    return role.role.toLowerCase().includes("backend")
      ? "Market competitive; targeting approximately $120,000 base depending on role scope and total compensation."
      : "Market competitive; targeting approximately $125,000 base depending on role scope and total compensation.";
  }
  if (text.includes("earliest available start")) return "Two weeks";
  if (text.includes("charlestown")) {
    return "Yes. I am willing to relocate and work from the Charlestown, MA worksite at least three times per week.";
  }
  if (text.includes("something you built")) {
    return "I built an Efficient TransFuser camera-LiDAR pipeline for autonomous navigation, replacing the backbone with EfficientNetV2-S to reduce parameters from 168M to 50M while improving held-out loss and BEV segmentation. I also debugged a mixed-precision training instability and kept the evaluation workflow reproducible.";
  }
  return null;
}

async function fillIfExists(page, selector, value) {
  const locator = page.locator(selector);
  if ((await locator.count()) > 0 && (await locator.first().isVisible().catch(() => false))) {
    await locator.first().fill(value);
  }
}

async function visibleButton(page, name) {
  const button = page.getByRole("button", { name }).first();
  return (await button.isVisible().catch(() => false)) ? button : null;
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
    const cookieButton = (await visibleButton(page, /^accept$/i)) || (await visibleButton(page, /^deny$/i));
    if (cookieButton) {
      await cookieButton.click().catch(() => {});
      await page.waitForTimeout(500);
    }

    const bodyBefore = await page.locator("body").innerText().catch(() => "");
    if (/verify you are human|cloudflare|checking your browser/i.test(bodyBefore)) {
      result.status = "blocked";
      result.blocker = "Human verification or anti-bot interstitial active before form fill.";
      return result;
    }

    await page.locator('input[type=file][name="resume"], input#resume-upload-input').first().setInputFiles(record.resume);
    await page.waitForTimeout(2000);
    await fillIfExists(page, 'input[name="name"]', "George Jobi Perangattu");
    await fillIfExists(page, 'input[name="email"]', "candidate@example.com");
    await fillIfExists(page, 'input[name="phone"]', "+1 555-010-0200");
    await fillIfExists(page, 'input[name="location"]', "Tempe, Arizona, United States");
    await fillIfExists(page, 'input[name="org"]', "Arizona State University / graduate student");
    await fillIfExists(page, 'input[name="urls[LinkedIn]"]', "https://www.linkedin.com/in/candidate-profile/");

    const cards = await page.locator('input[type=hidden][name$="[baseTemplate]"]').evaluateAll((elements) =>
      elements.map((element) => ({ name: element.getAttribute("name"), value: element.getAttribute("value") })),
    );
    for (const card of cards) {
      let parsed;
      try {
        parsed = JSON.parse(card.value);
      } catch {
        continue;
      }
      const match = card.name.match(/^cards\[([^\]]+)\]/);
      if (!match) continue;
      const cardId = match[1];
      for (let index = 0; index < (parsed.fields || []).length; index += 1) {
        const field = parsed.fields[index];
        const question = field.text || "";
        const name = `cards[${cardId}][field${index}]`;
        const selector = `[name="${name}"]`;
        if (field.type === "text" || field.type === "textarea") {
          const answer = textAnswer(question, role);
          if (answer !== null) {
            await page.locator(selector).first().fill(answer);
            if (answer) result.submittedAnswers.push(`${question}: ${answer}`);
          } else if (field.required) {
            result.status = "blocked";
            result.blocker = `Unknown required text question: ${question}`;
            return result;
          }
        } else if (field.type === "multiple-choice" || field.type === "multiple-select") {
          const answer = answerForQuestion(question, (field.options || []).map((entry) => entry.text));
          if (answer) {
            const input = page.locator(`${selector}[value="${answer.replaceAll('"', '\\"')}"]`).first();
            if ((await input.count()) > 0) {
              const type = await input.getAttribute("type");
              if (type === "checkbox") await input.check({ force: true });
              else await input.click({ force: true });
              result.submittedAnswers.push(`${question}: ${answer}`);
            } else if (field.required) {
              result.status = "blocked";
              result.blocker = `Required option not found for ${question}: ${answer}`;
              return result;
            }
          } else if (field.required) {
            result.status = "blocked";
            result.blocker = `Unknown required choice question: ${question}`;
            return result;
          }
        }
      }
    }

    await page.screenshot({ path: path.join(evidenceDir, "pre-submit.png"), fullPage: true });
    const submit = page.locator('#btn-submit, button[type=submit], button:has-text("SUBMIT APPLICATION"), button:has-text("Submit Application")').last();
    if ((await submit.count()) === 0) {
      result.status = "blocked";
      result.blocker = "Submit button not found after form fill.";
      return result;
    }

    await submit.click({ timeout: 30000 });
    await page.waitForTimeout(9000);
    const afterText = await page.locator("body").innerText().catch(() => "");
    result.finalUrl = page.url();
    result.finalTextSnippet = afterText.slice(0, 2000);
    await page.screenshot({ path: path.join(evidenceDir, "post-submit.png"), fullPage: true });

    if (/application submitted|thank you for applying|thanks for applying|received your application|successfully submitted/i.test(afterText)) {
      result.status = "submitted-pending-verification";
      result.evidencePath = path.join(evidenceDir, "post-submit.png");
      result.evidenceText = "Lever application submission acknowledgement visible after final submit.";
    } else if (/captcha|hcaptcha|verify you are human|please verify/i.test(afterText)) {
      result.status = "blocked";
      result.blocker = "Human verification challenge appeared after final submit.";
    } else if (/required|error|invalid|please enter|please select/i.test(afterText)) {
      result.status = "blocked";
      result.blocker = "Form reported validation errors after submit.";
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
      // Keep the original error.
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
