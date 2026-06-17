import { config } from "../../config.js";
import { fetchJson } from "../http.js";
import type { JobListing, ListingSearchRequest, SearchProvider } from "../types.js";

interface AdzunaSearchResponse {
  results?: Array<{
    id?: string | number;
    title?: string;
    redirect_url?: string;
    created?: string;
    description?: string;
    contract_time?: string;
    contract_type?: string;
    salary_min?: number;
    salary_max?: number;
    company?: {
      display_name?: string;
    };
    location?: {
      display_name?: string;
    };
    category?: {
      label?: string;
    };
  }>;
}

export class AdzunaProvider implements SearchProvider {
  readonly id = "adzuna";
  readonly kind = "aggregator";

  async search(request: ListingSearchRequest): Promise<JobListing[]> {
    if (!config.listings.adzunaAppId || !config.listings.adzunaAppKey) {
      throw new Error("Adzuna requires ADZUNA_APP_ID and ADZUNA_APP_KEY.");
    }

    const url = new URL(
      `https://api.adzuna.com/v1/api/jobs/${config.listings.adzunaCountry}/search/${request.page ?? 1}`
    );
    url.searchParams.set("app_id", config.listings.adzunaAppId);
    url.searchParams.set("app_key", config.listings.adzunaAppKey);
    url.searchParams.set("what", request.query);
    url.searchParams.set("results_per_page", String(request.limit ?? 20));

    if (request.location) {
      url.searchParams.set("where", request.location);
    }

    const response = await fetchJson<AdzunaSearchResponse>(url.toString());

    return (response.results ?? [])
      .filter((job) => job.id && job.title && job.redirect_url && job.company?.display_name)
      .map((job) => ({
        provider: this.id,
        providerKind: this.kind,
        source: "adzuna-search",
        externalId: String(job.id),
        title: job.title ?? "Untitled role",
        company: job.company?.display_name ?? "Unknown company",
        location: job.location?.display_name ?? null,
        department: job.category?.label ?? null,
        employmentType: [job.contract_type, job.contract_time].filter(Boolean).join(" / ") || null,
        workplaceType: null,
        remote: request.location?.toLowerCase().includes("remote") ?? null,
        listingUrl: job.redirect_url ?? "",
        applyUrl: job.redirect_url ?? null,
        postedAt: job.created ?? null,
        compensation:
          typeof job.salary_min === "number" || typeof job.salary_max === "number"
            ? `${job.salary_min ?? "?"}-${job.salary_max ?? "?"}`
            : null,
        description: job.description ?? null,
        metadata: {
          category: job.category?.label ?? null
        }
      }));
  }
}
