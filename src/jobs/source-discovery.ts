import type { CompanyBoardRequest } from "./types.js";
import { parseWorkdaySource } from "./providers/workday.js";

export function detectCompanyBoardSource(input: string): CompanyBoardRequest | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const url = parseHttpUrl(trimmed);
  if (!url) {
    return null;
  }

  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);

  if (host.includes("greenhouse.io")) {
    const source = parts[0];
    return source ? { provider: "greenhouse", source } : null;
  }

  if (host === "jobs.lever.co" || host.endsWith(".lever.co")) {
    const source = parts[0];
    return source ? { provider: "lever", source } : null;
  }

  if (host.includes("ashbyhq.com")) {
    const source = parts[0];
    return source ? { provider: "ashby", source } : null;
  }

  if (host === "apply.workable.com") {
    const source = parts[0];
    return source ? { provider: "workable", source } : null;
  }

  if (host.endsWith(".workable.com")) {
    const source = host.split(".")[0];
    return source ? { provider: "workable", source } : null;
  }

  if (host.endsWith(".myworkdayjobs.com")) {
    try {
      const workday = parseWorkdaySource(url.toString());
      return {
        provider: "workday",
        source: `${workday.host}/${workday.tenant}/${workday.board}`
      };
    } catch {
      return null;
    }
  }

  if (host === "careers.smartrecruiters.com") {
    const source = parts[0];
    return source ? { provider: "smartrecruiters", source } : null;
  }

  if (host.endsWith(".recruitee.com")) {
    const source = host.split(".")[0];
    return source ? { provider: "recruitee", source } : null;
  }

  if (/\.jobs\.personio\.[a-z.]+$/i.test(host)) {
    return { provider: "personio", source: host };
  }

  if (host.endsWith(".bamboohr.com")) {
    const source = host.split(".")[0];
    return source ? { provider: "bamboohr", source } : null;
  }

  if (host.includes("icims.com")) {
    if (url.pathname.includes("/jobs/search") || /\/jobs\/\d+\//.test(url.pathname)) {
      return { provider: "icims-classic", source: host };
    }

    return { provider: "icims-jibe", source: host };
  }

  if (url.pathname.includes("/hcmUI/CandidateExperience/") || host.includes("oraclecloud.com")) {
    const siteIndex = parts.findIndex((part) => part === "sites");
    const site = siteIndex >= 0 && parts[siteIndex + 1] ? parts[siteIndex + 1] : parts[0] ?? "jobsearch";
    return { provider: "oracle-ce", source: `${host}/${site}` };
  }

  if (host.endsWith(".taleo.net") || url.pathname.includes("/careersection/")) {
    const sectionIndex = parts.findIndex((part) => part === "careersection");
    const section = sectionIndex >= 0 && parts[sectionIndex + 1] ? parts[sectionIndex + 1] : parts[0];
    return section ? { provider: "taleo", source: `${host}/${section}` } : null;
  }

  return null;
}

function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
}
