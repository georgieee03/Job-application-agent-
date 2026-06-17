import { fetchJson } from "../http.js";
import type { CompanyBoardProvider, CompanyBoardRequest, JobListing } from "../types.js";

interface LeverPosting {
  id?: string;
  text?: string;
  hostedUrl?: string;
  applyUrl?: string;
  createdAt?: number;
  descriptionPlain?: string;
  description?: string;
  categories?: {
    location?: string;
    team?: string;
    commitment?: string;
    workplaceType?: string;
  };
}

export class LeverProvider implements CompanyBoardProvider {
  readonly id = "lever";
  readonly kind = "company-board";

  async fetchBoard(request: CompanyBoardRequest): Promise<JobListing[]> {
    const url = new URL(`https://api.lever.co/v0/postings/${request.source}`);
    url.searchParams.set("mode", "json");

    if (request.provider === "lever") {
      if (request.team) {
        url.searchParams.set("team", request.team);
      }

      if (request.location) {
        url.searchParams.set("location", request.location);
      }

      if (request.limit) {
        url.searchParams.set("limit", String(request.limit));
      }
    }

    const response = await fetchJson<LeverPosting[]>(url.toString());

    return response
      .filter((job) => job.id && job.text && job.hostedUrl)
      .map((job) => ({
        provider: this.id,
        providerKind: this.kind,
        source: request.source,
        externalId: job.id ?? "",
        title: job.text ?? "Untitled role",
        company: request.source,
        location: job.categories?.location ?? null,
        department: job.categories?.team ?? null,
        employmentType: job.categories?.commitment ?? null,
        workplaceType: job.categories?.workplaceType ?? null,
        remote: job.categories?.location?.toLowerCase().includes("remote") ?? null,
        listingUrl: job.hostedUrl ?? "",
        applyUrl: job.applyUrl ?? job.hostedUrl ?? null,
        postedAt: job.createdAt ? new Date(job.createdAt).toISOString() : null,
        compensation: null,
        description:
          request.includeDescription ? job.descriptionPlain ?? job.description ?? null : null,
        metadata: {}
      }));
  }
}
