import { fetchJson } from "../http.js";
import type { CompanyBoardProvider, CompanyBoardRequest, JobListing } from "../types.js";
import { asAbsoluteUrl, isRemoteText, joinTextParts, mapInBatches } from "./provider-utils.js";

const DEFAULT_LIMIT = 50;
const DEFAULT_MAX_PAGES = 5;
const DETAIL_BATCH_SIZE = 4;
const MAX_DETAIL_JOBS = 25;

interface WorkdayListResponse {
  total?: number;
  jobPostings?: WorkdayListJob[];
}

interface WorkdayListJob {
  title?: string;
  externalPath?: string;
  locationsText?: string;
  postedOn?: string;
  remoteType?: string;
  bulletFields?: string[];
}

interface WorkdayDetailResponse {
  jobPostingInfo?: {
    id?: string;
    title?: string;
    jobDescription?: string;
    location?: string;
    postedOn?: string;
    startDate?: string;
    timeType?: string;
    jobReqId?: string;
    jobPostingId?: string;
    remoteType?: string;
    externalUrl?: string;
  };
  hiringOrganization?: {
    name?: string;
  };
}

interface ParsedWorkdaySource {
  host: string;
  tenant: string;
  board: string;
  locale?: string;
}

export class WorkdayProvider implements CompanyBoardProvider {
  readonly id = "workday";
  readonly kind = "company-board";

  async fetchBoard(request: CompanyBoardRequest): Promise<JobListing[]> {
    if (request.provider !== "workday") {
      return [];
    }

    const source = parseWorkdaySource(request.source);
    const limit = clampPositiveInteger(request.limit ?? DEFAULT_LIMIT, 1, 100);
    const maxPages = clampPositiveInteger(request.maxPages ?? DEFAULT_MAX_PAGES, 1, 20);
    const jobs: WorkdayListJob[] = [];

    for (let page = 0; page < maxPages; page += 1) {
      const offset = page * limit;
      const response = await fetchJson<WorkdayListResponse>(
        `https://${source.host}/wday/cxs/${source.tenant}/${source.board}/jobs`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            appliedFacets: {},
            limit,
            offset,
            searchText: request.searchText ?? ""
          })
        }
      );

      const pageJobs = response.jobPostings ?? [];
      jobs.push(...pageJobs);

      if (pageJobs.length < limit || (typeof response.total === "number" && jobs.length >= response.total)) {
        break;
      }
    }

    const detailMap = new Map<string, WorkdayDetailResponse>();
    if (request.includeDescription) {
      await mapInBatches(jobs.slice(0, MAX_DETAIL_JOBS), DETAIL_BATCH_SIZE, async (job) => {
        if (!job.externalPath) {
          return;
        }

        try {
          detailMap.set(job.externalPath, await fetchWorkdayDetail(source, job.externalPath));
        } catch {
          // Keep the listing usable when a public detail page is blocked or removed.
        }
      });
    }

    return jobs
      .filter((job) => job.title && job.externalPath)
      .map((job) => normalizeWorkdayJob(source, request.source, job, detailMap.get(job.externalPath ?? "")));
  }
}

export function parseWorkdaySource(value: string): ParsedWorkdaySource {
  const trimmed = value.trim();
  const maybeEndpoint = tryParseUrl(trimmed);

  if (maybeEndpoint) {
    const cxsParts = maybeEndpoint.pathname.match(/\/wday\/cxs\/([^/]+)\/([^/]+)(?:\/jobs|\/job\/.*)?/);
    if (cxsParts) {
      return {
        host: maybeEndpoint.hostname,
        tenant: decodeURIComponent(cxsParts[1]),
        board: decodeURIComponent(cxsParts[2])
      };
    }

    const pathParts = maybeEndpoint.pathname.split("/").filter(Boolean);
    const slashSource = parseSlashDelimitedWorkdaySource(maybeEndpoint.hostname, pathParts);
    if (slashSource) {
      return slashSource;
    }

    const sourceFromCareersPath = extractWorkdayBoardFromPath(pathParts);
    if (sourceFromCareersPath.board) {
      return {
        host: maybeEndpoint.hostname,
        tenant: maybeEndpoint.hostname.split(".")[0],
        board: sourceFromCareersPath.board,
        locale: sourceFromCareersPath.locale
      };
    }
  }

  const compact = parseSlashDelimitedWorkdaySourceFromString(trimmed.replace(/^https?:\/\//i, ""));
  if (compact) {
    return compact;
  }

  throw new Error(
    "Invalid Workday source. Use a myworkdayjobs URL, a /wday/cxs/{tenant}/{board}/jobs endpoint, or host/tenant/board."
  );
}

function parseSlashDelimitedWorkdaySource(host: string, pathParts: string[]): ParsedWorkdaySource | null {
  if (
    pathParts.length === 2 &&
    !/^[a-z]{2}-[A-Z]{2}$/.test(pathParts[0]) &&
    !["job", "jobs"].includes(pathParts[1])
  ) {
    return {
      host,
      tenant: decodeURIComponent(pathParts[0]),
      board: decodeURIComponent(pathParts[1])
    };
  }

  return null;
}

function parseSlashDelimitedWorkdaySourceFromString(value: string): ParsedWorkdaySource | null {
  const parts = value.split("/").filter(Boolean);
  if (parts.length < 3) {
    return null;
  }

  return {
    host: parts[0],
    tenant: decodeURIComponent(parts[1]),
    board: decodeURIComponent(parts[2])
  };
}

function extractWorkdayBoardFromPath(pathParts: string[]): { board: string | null; locale?: string } {
  const localeIndex = pathParts.findIndex((part) => /^[a-z]{2}-[A-Z]{2}$/.test(part));
  if (localeIndex >= 0 && pathParts[localeIndex + 1]) {
    return {
      board: pathParts[localeIndex + 1],
      locale: pathParts[localeIndex]
    };
  }

  return { board: pathParts[0] ?? null };
}

async function fetchWorkdayDetail(
  source: ParsedWorkdaySource,
  externalPath: string
): Promise<WorkdayDetailResponse> {
  return await fetchJson<WorkdayDetailResponse>(
    `https://${source.host}/wday/cxs/${source.tenant}/${source.board}${externalPath}`
  );
}

function normalizeWorkdayJob(
  source: ParsedWorkdaySource,
  originalSource: string,
  job: WorkdayListJob,
  detail?: WorkdayDetailResponse
): JobListing {
  const info = detail?.jobPostingInfo;
  const listingUrl = `https://${source.host}/${source.locale ?? "en-US"}/${source.board}${job.externalPath}`;
  const applyUrl = asAbsoluteUrl(info?.externalUrl, `https://${source.host}`) ?? listingUrl;
  const reqId = info?.jobReqId ?? job.bulletFields?.find(Boolean) ?? job.externalPath;
  const location = info?.location ?? job.locationsText ?? null;
  const remoteText = joinTextParts([info?.remoteType, job.remoteType, location]);

  return {
    provider: "workday",
    providerKind: "company-board",
    source: originalSource,
    externalId: String(info?.id ?? info?.jobPostingId ?? reqId),
    title: info?.title ?? job.title ?? "Untitled role",
    company: detail?.hiringOrganization?.name ?? source.tenant,
    location,
    department: null,
    employmentType: info?.timeType ?? null,
    workplaceType: info?.remoteType ?? job.remoteType ?? null,
    remote: isRemoteText(remoteText),
    listingUrl,
    applyUrl,
    postedAt: normalizeWorkdayDate(info?.startDate ?? info?.postedOn ?? job.postedOn),
    compensation: null,
    description: info?.jobDescription ?? null,
    metadata: {
      tenant: source.tenant,
      board: source.board,
      externalPath: job.externalPath,
      postedOn: job.postedOn ?? null,
      bulletFields: job.bulletFields ?? []
    }
  };
}

function normalizeWorkdayDate(value: string | null | undefined): string | null {
  if (!value || /^Posted/i.test(value)) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function tryParseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function clampPositiveInteger(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(value)));
}
