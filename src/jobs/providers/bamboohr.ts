import { fetchJson } from "../http.js";
import type { CompanyBoardProvider, CompanyBoardRequest, JobListing } from "../types.js";
import { asAbsoluteUrl, isRemoteText, joinTextParts } from "./provider-utils.js";

interface BambooHrResponse {
  meta?: {
    totalCount?: number;
  };
  result?: BambooHrJob[];
}

interface BambooHrJob {
  id?: number | string;
  title?: string;
  jobOpeningName?: string;
  department?: string | {
    label?: string;
  };
  employmentStatus?: string | {
    label?: string;
  };
  location?: string | {
    city?: string;
    state?: string;
    country?: string;
  };
  datePosted?: string;
  postedDate?: string;
  description?: string;
  jobOpeningUrl?: string;
  applicationUrl?: string;
  url?: string;
}

export class BambooHrProvider implements CompanyBoardProvider {
  readonly id = "bamboohr";
  readonly kind = "company-board";

  async fetchBoard(request: CompanyBoardRequest): Promise<JobListing[]> {
    const source = normalizeSource(request.source);
    const baseUrl = `https://${source}.bamboohr.com`;
    const response = await fetchJson<BambooHrResponse>(`${baseUrl}/careers/list`);

    return (response.result ?? [])
      .filter((job) => job.id && (job.title ?? job.jobOpeningName))
      .map((job) => normalizeBambooHrJob(source, baseUrl, job, request.includeDescription));
  }
}

function normalizeBambooHrJob(
  source: string,
  baseUrl: string,
  job: BambooHrJob,
  includeDescription?: boolean
): JobListing {
  const title = job.title ?? job.jobOpeningName ?? "Untitled role";
  const location = formatLocation(job.location);
  const listingUrl = asAbsoluteUrl(job.jobOpeningUrl ?? job.url, baseUrl)
    ?? `${baseUrl}/careers/${encodeURIComponent(String(job.id))}`;

  return {
    provider: "bamboohr",
    providerKind: "company-board",
    source,
    externalId: String(job.id),
    title,
    company: source,
    location,
    department: typeof job.department === "string" ? job.department : job.department?.label ?? null,
    employmentType: typeof job.employmentStatus === "string" ? job.employmentStatus : job.employmentStatus?.label ?? null,
    workplaceType: null,
    remote: isRemoteText(location),
    listingUrl,
    applyUrl: asAbsoluteUrl(job.applicationUrl, baseUrl) ?? listingUrl,
    postedAt: normalizeDate(job.datePosted ?? job.postedDate),
    compensation: null,
    description: includeDescription ? job.description ?? null : null,
    metadata: {}
  };
}

function normalizeSource(value: string): string {
  try {
    const url = new URL(value);
    return url.hostname.split(".")[0];
  } catch {
    return value.trim().replace(/\.bamboohr\.com$/i, "");
  }
}

function formatLocation(location: BambooHrJob["location"]): string | null {
  if (!location) {
    return null;
  }

  if (typeof location === "string") {
    return location;
  }

  return joinTextParts([location.city, location.state, location.country]);
}

function normalizeDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
