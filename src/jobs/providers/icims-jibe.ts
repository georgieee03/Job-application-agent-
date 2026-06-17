import { fetchJson } from "../http.js";
import type { CompanyBoardProvider, CompanyBoardRequest, JobListing } from "../types.js";
import { asAbsoluteUrl, isRemoteText, joinTextParts, slugify } from "./provider-utils.js";

interface IcimsJibeJob {
  id?: string | number;
  job_id?: string | number;
  req_id?: string | number;
  title?: string;
  name?: string;
  canonical_url?: string;
  url?: string;
  apply_url?: string;
  company?: string;
  location?: string | {
    city?: string;
    state?: string;
    country?: string;
    name?: string;
  };
  locations?: Array<string | {
    city?: string;
    state?: string;
    country?: string;
    name?: string;
  }>;
  department?: string;
  category?: string;
  employment_type?: string;
  posted_at?: string;
  posted_date?: string;
  description?: string;
}

type IcimsJibeResponse = IcimsJibeJob[] | {
  jobs?: IcimsJibeJob[];
  results?: IcimsJibeJob[];
  data?: IcimsJibeJob[];
};

export class IcimsJibeProvider implements CompanyBoardProvider {
  readonly id = "icims-jibe";
  readonly kind = "company-board";

  async fetchBoard(request: CompanyBoardRequest): Promise<JobListing[]> {
    if (request.provider !== "icims-jibe") {
      return [];
    }

    const source = normalizeHost(request.source);
    const url = new URL(`https://${source}/api/jobs`);
    url.searchParams.set("limit", String(request.limit ?? 50));

    const response = await fetchJson<IcimsJibeResponse>(url.toString());
    const jobs = Array.isArray(response)
      ? response
      : response.jobs ?? response.results ?? response.data ?? [];

    return jobs
      .filter((job) => (job.id ?? job.job_id ?? job.req_id) && (job.title ?? job.name))
      .map((job) => normalizeIcimsJibeJob(source, job, request.includeDescription));
  }
}

function normalizeIcimsJibeJob(
  source: string,
  job: IcimsJibeJob,
  includeDescription?: boolean
): JobListing {
  const id = String(job.id ?? job.job_id ?? job.req_id);
  const title = job.title ?? job.name ?? "Untitled role";
  const location = formatLocations(job.location, job.locations);
  const listingUrl = asAbsoluteUrl(job.canonical_url ?? job.url, `https://${source}`)
    ?? `https://${source}/jobs/${id}/${slugify(title)}/job`;

  return {
    provider: "icims-jibe",
    providerKind: "company-board",
    source,
    externalId: id,
    title,
    company: job.company ?? source,
    location,
    department: job.department ?? job.category ?? null,
    employmentType: job.employment_type ?? null,
    workplaceType: null,
    remote: isRemoteText(location),
    listingUrl,
    applyUrl: asAbsoluteUrl(job.apply_url, `https://${source}`) ?? listingUrl,
    postedAt: normalizeDate(job.posted_at ?? job.posted_date),
    compensation: null,
    description: includeDescription ? job.description ?? null : null,
    metadata: {}
  };
}

function normalizeHost(value: string): string {
  try {
    return new URL(value).hostname;
  } catch {
    return value.trim().replace(/^https?:\/\//i, "").split("/")[0];
  }
}

function formatLocations(
  location: IcimsJibeJob["location"],
  locations: IcimsJibeJob["locations"]
): string | null {
  if (locations?.length) {
    return joinTextParts(locations.map(formatLocation), "; ");
  }

  return formatLocation(location);
}

function formatLocation(location: IcimsJibeJob["location"] | NonNullable<IcimsJibeJob["locations"]>[number]): string | null {
  if (!location) {
    return null;
  }

  if (typeof location === "string") {
    return location;
  }

  return joinTextParts([location.name, location.city, location.state, location.country]);
}

function normalizeDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
