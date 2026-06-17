import { fetchJson } from "../http.js";
import type { CompanyBoardProvider, CompanyBoardRequest, JobListing } from "../types.js";

interface AshbyResponse {
  jobs?: Array<{
    id?: string;
    title?: string;
    department?: string;
    team?: string;
    employmentType?: string;
    location?: string;
    isRemote?: boolean;
    workplaceType?: string;
    publishedAt?: string;
    jobUrl?: string;
    applyUrl?: string;
    descriptionPlain?: string;
    descriptionHtml?: string;
  }>;
}

export class AshbyProvider implements CompanyBoardProvider {
  readonly id = "ashby";
  readonly kind = "company-board";

  async fetchBoard(request: CompanyBoardRequest): Promise<JobListing[]> {
    const url = new URL(`https://api.ashbyhq.com/posting-api/job-board/${request.source}`);
    url.searchParams.set("includeCompensation", "true");

    const response = await fetchJson<AshbyResponse>(url.toString());

    return (response.jobs ?? [])
      .filter((job) => job.id && job.title && job.jobUrl)
      .map((job) => ({
        provider: this.id,
        providerKind: this.kind,
        source: request.source,
        externalId: job.id ?? "",
        title: job.title ?? "Untitled role",
        company: request.source,
        location: job.location ?? null,
        department: [job.department, job.team].filter(Boolean).join(" / ") || null,
        employmentType: job.employmentType ?? null,
        workplaceType: job.workplaceType ?? null,
        remote: job.isRemote ?? null,
        listingUrl: job.jobUrl ?? "",
        applyUrl: job.applyUrl ?? job.jobUrl ?? null,
        postedAt: job.publishedAt ?? null,
        compensation: null,
        description: request.includeDescription
          ? job.descriptionPlain ?? job.descriptionHtml ?? null
          : null,
        metadata: {}
      }));
  }
}
