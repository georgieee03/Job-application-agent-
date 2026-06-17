import { fetchJson } from "../http.js";
import type { CompanyBoardProvider, CompanyBoardRequest, JobListing } from "../types.js";

interface WorkableJob {
  id?: string | number;
  shortcode?: string;
  title?: string;
  code?: string;
  department?: string;
  employment_type?: string;
  location?:
    | {
        city?: string;
        region?: string;
        country?: string;
        workplace_type?: string;
      }
    | string;
  shortlink?: string;
  url?: string;
  application_url?: string;
  published?: string;
  published_on?: string;
  description?: string;
  description_html?: string;
  salary?: string;
}

interface WorkableResponse {
  jobs?: WorkableJob[];
  results?: WorkableJob[];
}

export class WorkableProvider implements CompanyBoardProvider {
  readonly id = "workable";
  readonly kind = "company-board";

  async fetchBoard(request: CompanyBoardRequest): Promise<JobListing[]> {
    const candidateUrls = [
      `https://www.workable.com/api/accounts/${request.source}/jobs`,
      `https://apply.workable.com/api/v1/widget/accounts/${request.source}/jobs`
    ];

    let response: WorkableResponse | WorkableJob[] | null = null;
    let lastError: Error | null = null;

    for (const url of candidateUrls) {
      try {
        response = await fetchJson<WorkableResponse | WorkableJob[]>(url);
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    if (!response) {
      throw lastError ?? new Error(`Unable to load Workable jobs for ${request.source}.`);
    }

    const jobs = Array.isArray(response)
      ? response
      : response.jobs ?? response.results ?? [];

    return jobs
      .filter((job) => (job.id ?? job.shortcode) && job.title && (job.shortlink ?? job.url))
      .map((job) => ({
        provider: this.id,
        providerKind: this.kind,
        source: request.source,
        externalId: String(job.id ?? job.shortcode),
        title: job.title ?? "Untitled role",
        company: request.source,
        location: formatWorkableLocation(job.location),
        department: job.department ?? null,
        employmentType: job.employment_type ?? null,
        workplaceType:
          typeof job.location === "object" && job.location
            ? job.location.workplace_type ?? null
            : null,
        remote:
          typeof job.location === "object" && job.location
            ? job.location.workplace_type?.toLowerCase().includes("remote") ?? null
            : null,
        listingUrl: job.shortlink ?? job.url ?? "",
        applyUrl: job.application_url ?? job.shortlink ?? job.url ?? null,
        postedAt: job.published ?? job.published_on ?? null,
        compensation: job.salary ?? null,
        description: request.includeDescription
          ? job.description_html ?? job.description ?? null
          : null,
        metadata: {
          code: job.code ?? null
        }
      }));
  }
}

function formatWorkableLocation(location: WorkableJob["location"]): string | null {
  if (!location) {
    return null;
  }

  if (typeof location === "string") {
    return location;
  }

  return [location.city, location.region, location.country].filter(Boolean).join(", ") || null;
}
