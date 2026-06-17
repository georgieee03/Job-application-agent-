import { fetchJson } from "../http.js";
import type { CompanyBoardProvider, CompanyBoardRequest, JobListing } from "../types.js";
import { compactHtmlSections, joinTextParts } from "./provider-utils.js";

interface RecruiteeResponse {
  offers?: RecruiteeOffer[];
}

interface RecruiteeOffer {
  id?: number | string;
  guid?: string;
  title?: string;
  company_name?: string;
  department?: string;
  location?: string;
  locations?: Array<{
    name?: string;
    city?: string;
    state?: string;
    country?: string;
  }>;
  employment_type_code?: string;
  remote?: boolean;
  hybrid?: boolean;
  on_site?: boolean;
  careers_url?: string;
  careers_apply_url?: string;
  published_at?: string;
  created_at?: string;
  description?: string;
  requirements?: string;
  salary?: {
    min?: number | null;
    max?: number | null;
    currency?: string | null;
    period?: string | null;
  };
  tags?: string[];
}

export class RecruiteeProvider implements CompanyBoardProvider {
  readonly id = "recruitee";
  readonly kind = "company-board";

  async fetchBoard(request: CompanyBoardRequest): Promise<JobListing[]> {
    const source = normalizeSource(request.source);
    const response = await fetchJson<RecruiteeResponse>(
      `https://${source}.recruitee.com/api/offers/`
    );

    return (response.offers ?? [])
      .filter((offer) => (offer.id ?? offer.guid) && offer.title && offer.careers_url)
      .map((offer) => normalizeRecruiteeOffer(source, offer, request.includeDescription));
  }
}

function normalizeRecruiteeOffer(
  source: string,
  offer: RecruiteeOffer,
  includeDescription?: boolean
): JobListing {
  const location = offer.location ?? joinTextParts(
    (offer.locations ?? []).map((locationValue) => joinTextParts([
      locationValue.city ?? locationValue.name,
      locationValue.state,
      locationValue.country
    ])),
    "; "
  );

  return {
    provider: "recruitee",
    providerKind: "company-board",
    source,
    externalId: String(offer.id ?? offer.guid),
    title: offer.title ?? "Untitled role",
    company: offer.company_name ?? source,
    location,
    department: offer.department ?? null,
    employmentType: offer.employment_type_code ?? null,
    workplaceType: offer.remote ? "Remote" : offer.hybrid ? "Hybrid" : offer.on_site ? "On-site" : null,
    remote: offer.remote ?? (location?.toLowerCase().includes("remote") ?? null),
    listingUrl: offer.careers_url ?? "",
    applyUrl: offer.careers_apply_url ?? offer.careers_url ?? null,
    postedAt: normalizeDate(offer.published_at ?? offer.created_at),
    compensation: formatSalary(offer.salary),
    description: includeDescription ? compactHtmlSections([offer.description, offer.requirements]) : null,
    metadata: {
      guid: offer.guid ?? null,
      tags: offer.tags ?? []
    }
  };
}

function normalizeSource(value: string): string {
  try {
    const url = new URL(value);
    return url.hostname.split(".")[0];
  } catch {
    return value.trim().replace(/\.recruitee\.com$/i, "");
  }
}

function normalizeDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.replace(" UTC", "Z");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatSalary(salary: RecruiteeOffer["salary"]): string | null {
  if (!salary || (salary.min == null && salary.max == null)) {
    return null;
  }

  const currency = salary.currency ? `${salary.currency} ` : "";
  const range = [salary.min, salary.max].filter((value): value is number => value != null).join(" - ");
  return `${currency}${range}${salary.period ? ` / ${salary.period}` : ""}`;
}
