import { config } from "../../config.js";
import { fetchJson } from "../http.js";
import type { JobListing, ListingSearchRequest, SearchProvider } from "../types.js";

interface JoobleSearchResponse {
  jobs?: Array<{
    id?: string | number;
    title?: string;
    company?: string;
    location?: string;
    link?: string;
    updated?: string;
    snippet?: string;
    type?: string;
    salary?: string;
    source?: string;
  }>;
}

const BLOCKED_JOOBLE_SOURCES = [
  "jobleads",
  "jobleads.com"
];

export class JoobleProvider implements SearchProvider {
  readonly id = "jooble";
  readonly kind = "aggregator";

  async search(request: ListingSearchRequest): Promise<JobListing[]> {
    if (!config.listings.joobleApiKey) {
      throw new Error("Jooble requires JOOBLE_API_KEY.");
    }

    const response = await fetchJson<JoobleSearchResponse>(
      `https://jooble.org/api/${config.listings.joobleApiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          keywords: request.query,
          location: request.location,
          page: request.page ?? 1
        })
      }
    );

    return (response.jobs ?? [])
      .filter((job) => job.id && job.title && job.company && job.link)
      .filter((job) => !isBlockedJoobleSource(job))
      .slice(0, request.limit ?? 20)
      .map((job) => ({
        provider: this.id,
        providerKind: this.kind,
        source: "jooble-search",
        externalId: String(job.id),
        title: job.title ?? "Untitled role",
        company: job.company ?? "Unknown company",
        location: job.location ?? null,
        department: null,
        employmentType: job.type ?? null,
        workplaceType: null,
        remote: request.location?.toLowerCase().includes("remote") ?? null,
        listingUrl: job.link ?? "",
        applyUrl: null,
        postedAt: job.updated ?? null,
        compensation: job.salary ?? null,
        description: job.snippet ?? null,
        metadata: {
          source: job.source ?? null
        }
      }));
  }
}

function isBlockedJoobleSource(job: { company?: string; link?: string; source?: string }): boolean {
  const searchableSource = [job.source, job.company, job.link]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return BLOCKED_JOOBLE_SOURCES.some((source) => searchableSource.includes(source));
}
