import { fetchJson } from "../http.js";
import type { CompanyBoardProvider, CompanyBoardRequest, JobListing } from "../types.js";

interface GreenhouseResponse {
  jobs?: Array<{
    id?: string | number;
    title?: string;
    absolute_url?: string;
    company_name?: string;
    updated_at?: string;
    first_published?: string;
    content?: string;
    location?: {
      name?: string;
    };
    departments?: Array<{
      name?: string;
    }>;
    metadata?: unknown;
  }>;
}

export class GreenhouseProvider implements CompanyBoardProvider {
  readonly id = "greenhouse";
  readonly kind = "company-board";

  async fetchBoard(request: CompanyBoardRequest): Promise<JobListing[]> {
    const url = new URL(`https://boards-api.greenhouse.io/v1/boards/${request.source}/jobs`);
    url.searchParams.set("content", String(Boolean(request.includeDescription)));

    const response = await fetchJson<GreenhouseResponse>(url.toString());

    return (response.jobs ?? [])
      .filter((job) => job.id && job.title && job.absolute_url)
      .map((job) => ({
        provider: this.id,
        providerKind: this.kind,
        source: request.source,
        externalId: String(job.id),
        title: job.title ?? "Untitled role",
        company: job.company_name ?? request.source,
        location: job.location?.name ?? null,
        department:
          job.departments?.map((department) => department.name).filter(Boolean).join(", ") || null,
        employmentType: null,
        workplaceType: null,
        remote: job.location?.name?.toLowerCase().includes("remote") ?? null,
        listingUrl: job.absolute_url ?? "",
        applyUrl: job.absolute_url ?? null,
        postedAt: job.first_published ?? job.updated_at ?? null,
        compensation: null,
        description: job.content ?? null,
        metadata: {
          updatedAt: job.updated_at ?? null,
          metadata: job.metadata ?? null
        }
      }));
  }
}
