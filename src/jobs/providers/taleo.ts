import { fetchJson } from "../http.js";
import type { CompanyBoardProvider, CompanyBoardRequest, JobListing } from "../types.js";
import { compactHtmlSections, isRemoteText, joinTextParts } from "./provider-utils.js";

interface TaleoSource {
  host: string;
  section: string;
}

interface TaleoSearchResponse {
  requisitionList?: TaleoJob[];
  jobs?: TaleoJob[];
  jobList?: TaleoJob[];
}

interface TaleoJob {
  contestNo?: string | number;
  jobId?: string | number;
  id?: string | number;
  title?: string;
  jobTitle?: string;
  location?: string;
  primaryLocation?: string;
  organization?: string;
  department?: string;
  jobSchedule?: string;
  jobType?: string;
  postedDate?: string;
  description?: string;
  qualifications?: string;
}

export class TaleoProvider implements CompanyBoardProvider {
  readonly id = "taleo";
  readonly kind = "company-board";

  async fetchBoard(request: CompanyBoardRequest): Promise<JobListing[]> {
    if (request.provider !== "taleo") {
      return [];
    }

    const source = parseTaleoSource(request.source);
    const lang = request.lang ?? "en";
    const url = new URL(`https://${source.host}/careersection/rest/jobboard/searchjobs`);
    url.searchParams.set("lang", lang);
    url.searchParams.set("portal", source.section);

    const response = await fetchJson<TaleoSearchResponse>(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        fieldData: {
          fields: {
            KEYWORD: request.keyword ?? ""
          }
        },
        pageNo: 1
      })
    });
    const jobs = response.requisitionList ?? response.jobs ?? response.jobList ?? [];

    return jobs
      .filter((job) => (job.contestNo ?? job.jobId ?? job.id) && (job.title ?? job.jobTitle))
      .map((job) => normalizeTaleoJob(source, lang, job, request.includeDescription));
  }
}

function parseTaleoSource(value: string): TaleoSource {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    const sectionIndex = parts.findIndex((part) => part === "careersection");
    return {
      host: url.hostname,
      section: sectionIndex >= 0 && parts[sectionIndex + 1] ? parts[sectionIndex + 1] : parts[0] ?? "external"
    };
  } catch {
    const [host, section = "external"] = trimmed.replace(/^https?:\/\//i, "").split("/").filter(Boolean);
    return { host, section };
  }
}

function normalizeTaleoJob(
  source: TaleoSource,
  lang: string,
  job: TaleoJob,
  includeDescription?: boolean
): JobListing {
  const id = String(job.contestNo ?? job.jobId ?? job.id);
  const title = job.title ?? job.jobTitle ?? "Untitled role";
  const location = job.location ?? job.primaryLocation ?? null;
  const listingUrl = `https://${source.host}/careersection/${source.section}/jobdetail.ftl?lang=${encodeURIComponent(lang)}&job=${encodeURIComponent(id)}`;

  return {
    provider: "taleo",
    providerKind: "company-board",
    source: `${source.host}/${source.section}`,
    externalId: id,
    title,
    company: source.host,
    location,
    department: job.department ?? job.organization ?? null,
    employmentType: joinTextParts([job.jobSchedule, job.jobType], " / "),
    workplaceType: null,
    remote: isRemoteText(location),
    listingUrl,
    applyUrl: listingUrl,
    postedAt: normalizeDate(job.postedDate),
    compensation: null,
    description: includeDescription ? compactHtmlSections([job.description, job.qualifications]) : null,
    metadata: {}
  };
}

function normalizeDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
