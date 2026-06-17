import { fetchJson } from "../http.js";
import type { CompanyBoardProvider, CompanyBoardRequest, JobListing } from "../types.js";
import { compactHtmlSections, isRemoteText, joinTextParts, mapInBatches } from "./provider-utils.js";

const DEFAULT_LIMIT = 100;
const DEFAULT_MAX_PAGES = 3;
const DETAIL_BATCH_SIZE = 5;
const MAX_DETAIL_JOBS = 50;

interface SmartRecruitersListResponse {
  offset?: number;
  limit?: number;
  totalFound?: number;
  content?: SmartRecruitersPosting[];
}

interface SmartRecruitersPosting {
  id?: string;
  uuid?: string;
  name?: string;
  refNumber?: string;
  ref?: string;
  releasedDate?: string;
  company?: {
    identifier?: string;
    name?: string;
  };
  location?: {
    city?: string;
    region?: string;
    country?: string;
    fullLocation?: string;
    remote?: boolean;
    hybrid?: boolean;
  };
  department?: {
    label?: string;
  };
  typeOfEmployment?: {
    label?: string;
  };
  function?: {
    label?: string;
  };
}

interface SmartRecruitersDetail extends SmartRecruitersPosting {
  postingUrl?: string;
  applyUrl?: string;
  jobAd?: {
    sections?: Record<string, {
      title?: string;
      text?: string;
    }>;
  };
}

export class SmartRecruitersProvider implements CompanyBoardProvider {
  readonly id = "smartrecruiters";
  readonly kind = "company-board";

  async fetchBoard(request: CompanyBoardRequest): Promise<JobListing[]> {
    if (request.provider !== "smartrecruiters") {
      return [];
    }

    const source = normalizeSource(request.source);
    const limit = clampPositiveInteger(request.limit ?? DEFAULT_LIMIT, 1, 100);
    const maxPages = clampPositiveInteger(request.maxPages ?? DEFAULT_MAX_PAGES, 1, 20);
    const postings: SmartRecruitersPosting[] = [];

    for (let page = 0; page < maxPages; page += 1) {
      const offset = page * limit;
      const url = new URL(`https://api.smartrecruiters.com/v1/companies/${source}/postings`);
      url.searchParams.set("limit", String(limit));
      url.searchParams.set("offset", String(offset));

      const response = await fetchJson<SmartRecruitersListResponse>(url.toString());
      const pagePostings = response.content ?? [];
      postings.push(...pagePostings);

      if (pagePostings.length < limit || (typeof response.totalFound === "number" && postings.length >= response.totalFound)) {
        break;
      }
    }

    const details = new Map<string, SmartRecruitersDetail>();
    if (request.includeDescription) {
      await mapInBatches(postings.slice(0, MAX_DETAIL_JOBS), DETAIL_BATCH_SIZE, async (posting) => {
        if (!posting.id) {
          return;
        }

        try {
          details.set(posting.id, await fetchJson<SmartRecruitersDetail>(
            `https://api.smartrecruiters.com/v1/companies/${source}/postings/${posting.id}`
          ));
        } catch {
          // List data is still useful when a posting detail URL is unavailable.
        }
      });
    }

    return postings
      .filter((posting) => posting.id && posting.name)
      .map((posting) => normalizeSmartRecruitersPosting(source, posting, details.get(posting.id ?? ""), request.includeDescription));
  }
}

function normalizeSmartRecruitersPosting(
  source: string,
  posting: SmartRecruitersPosting,
  detail: SmartRecruitersDetail | undefined,
  includeDescription?: boolean
): JobListing {
  const merged = {
    ...posting,
    ...detail,
    company: detail?.company ?? posting.company,
    location: detail?.location ?? posting.location,
    department: detail?.department ?? posting.department,
    function: detail?.function ?? posting.function,
    typeOfEmployment: detail?.typeOfEmployment ?? posting.typeOfEmployment
  };
  const location = merged.location?.fullLocation ?? joinTextParts([
    merged.location?.city,
    merged.location?.region,
    merged.location?.country
  ]);
  const workplaceType = merged.location?.remote
    ? "Remote"
    : merged.location?.hybrid
      ? "Hybrid"
      : null;
  const publicPostingUrl = `https://jobs.smartrecruiters.com/${source}/${merged.id}`;

  return {
    provider: "smartrecruiters",
    providerKind: "company-board",
    source,
    externalId: String(merged.id ?? merged.uuid),
    title: merged.name ?? "Untitled role",
    company: merged.company?.name ?? source,
    location,
    department: merged.department?.label ?? merged.function?.label ?? null,
    employmentType: merged.typeOfEmployment?.label ?? null,
    workplaceType,
    remote: merged.location?.remote ?? isRemoteText(location),
    listingUrl: detail?.postingUrl ?? publicPostingUrl,
    applyUrl: detail?.applyUrl ?? detail?.postingUrl ?? `${publicPostingUrl}/apply`,
    postedAt: normalizeDate(merged.releasedDate),
    compensation: null,
    description: includeDescription ? buildDescription(detail) : null,
    metadata: {
      refNumber: merged.refNumber ?? null,
      uuid: merged.uuid ?? null
    }
  };
}

function buildDescription(detail: SmartRecruitersDetail | undefined): string | null {
  const sections = detail?.jobAd?.sections;
  if (!sections) {
    return null;
  }

  return compactHtmlSections(
    Object.values(sections).map((section) => joinTextParts([section.title, section.text], "\n"))
  );
}

function normalizeSource(value: string): string {
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts[0] || url.hostname.split(".")[0];
  } catch {
    return value.trim();
  }
}

function normalizeDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function clampPositiveInteger(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(value)));
}
