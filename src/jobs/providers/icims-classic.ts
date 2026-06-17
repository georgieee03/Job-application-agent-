import { fetchText } from "../http.js";
import type { CompanyBoardProvider, CompanyBoardRequest, JobListing } from "../types.js";
import { decodeHtml, isRemoteText, slugify, stripHtml } from "./provider-utils.js";

interface IcimsClassicJobSeed {
  id: string;
  title: string;
  href: string;
}

interface JsonLdJobPosting {
  "@type"?: string | string[];
  title?: string;
  hiringOrganization?: string | {
    name?: string;
  };
  jobLocation?: unknown;
  employmentType?: string | string[];
  datePosted?: string;
  description?: string;
  directApply?: boolean;
  url?: string;
}

export class IcimsClassicProvider implements CompanyBoardProvider {
  readonly id = "icims-classic";
  readonly kind = "company-board";

  async fetchBoard(request: CompanyBoardRequest): Promise<JobListing[]> {
    if (request.provider !== "icims-classic") {
      return [];
    }

    const source = normalizeHost(request.source);
    const searchUrl = new URL(`https://${source}/jobs/search`);
    searchUrl.searchParams.set("in_iframe", "1");
    if (request.keyword) {
      searchUrl.searchParams.set("searchKeyword", request.keyword);
    }

    const html = await fetchText(searchUrl.toString());
    const seeds = parseSearchHtml(source, html);

    if (!request.includeDescription) {
      return seeds.map((seed) => normalizeSeed(source, seed));
    }

    const listings: JobListing[] = [];
    for (const seed of seeds.slice(0, 25)) {
      try {
        const detailHtml = await fetchText(seed.href);
        listings.push(normalizeDetail(source, seed, detailHtml));
      } catch {
        listings.push(normalizeSeed(source, seed));
      }
    }

    return listings;
  }
}

function parseSearchHtml(source: string, html: string): IcimsClassicJobSeed[] {
  const seeds = new Map<string, IcimsClassicJobSeed>();
  const linkRegex = /<a\b[^>]*href=["']([^"']*\/jobs\/(\d+)\/[^"']*\/job[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = new URL(decodeHtml(match[1]), `https://${source}`).toString();
    const id = match[2];
    const title = stripHtml(match[3]) ?? `Job ${id}`;
    seeds.set(id, { id, title, href });
  }

  return [...seeds.values()];
}

function normalizeSeed(source: string, seed: IcimsClassicJobSeed): JobListing {
  return {
    provider: "icims-classic",
    providerKind: "company-board",
    source,
    externalId: seed.id,
    title: seed.title,
    company: source,
    location: null,
    department: null,
    employmentType: null,
    workplaceType: null,
    remote: null,
    listingUrl: seed.href,
    applyUrl: seed.href,
    postedAt: null,
    compensation: null,
    description: null,
    metadata: {}
  };
}

function normalizeDetail(source: string, seed: IcimsClassicJobSeed, html: string): JobListing {
  const jsonLd = extractJobPostingJsonLd(html);
  const title = jsonLd?.title ?? seed.title;
  const location = formatJobLocation(jsonLd?.jobLocation);
  const employmentType = Array.isArray(jsonLd?.employmentType)
    ? jsonLd.employmentType.join(", ")
    : jsonLd?.employmentType ?? null;

  return {
    ...normalizeSeed(source, seed),
    title,
    company: typeof jsonLd?.hiringOrganization === "string"
      ? jsonLd.hiringOrganization
      : jsonLd?.hiringOrganization?.name ?? source,
    location,
    employmentType,
    remote: isRemoteText(location),
    listingUrl: jsonLd?.url ?? seed.href,
    applyUrl: jsonLd?.url ?? seed.href,
    postedAt: normalizeDate(jsonLd?.datePosted),
    description: jsonLd?.description ?? stripHtml(html),
    metadata: {
      slug: slugify(title)
    }
  };
}

function extractJobPostingJsonLd(html: string): JsonLdJobPosting | null {
  const scriptRegex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(scriptRegex)) {
    try {
      const parsed = JSON.parse(decodeHtml(match[1].trim()));
      const candidates = Array.isArray(parsed) ? parsed : [parsed, ...(parsed["@graph"] ?? [])];
      const job = candidates.find((candidate) => {
        const type = candidate?.["@type"];
        return type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"));
      });
      if (job) {
        return job;
      }
    } catch {
      // Skip malformed JSON-LD blocks and fall back to HTML text.
    }
  }

  return null;
}

function formatJobLocation(location: unknown): string | null {
  const first = Array.isArray(location) ? location[0] : location;
  if (!first || typeof first !== "object") {
    return typeof first === "string" ? first : null;
  }

  const address = "address" in first && first.address && typeof first.address === "object"
    ? first.address as Record<string, unknown>
    : first as Record<string, unknown>;
  return [address.addressLocality, address.addressRegion, address.addressCountry]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join(", ") || null;
}

function normalizeHost(value: string): string {
  try {
    return new URL(value).hostname;
  } catch {
    return value.trim().replace(/^https?:\/\//i, "").split("/")[0];
  }
}

function normalizeDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
