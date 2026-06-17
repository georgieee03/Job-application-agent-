import { fetchJson } from "../http.js";
import type { CompanyBoardProvider, CompanyBoardRequest, JobListing } from "../types.js";
import { asAbsoluteUrl, compactHtmlSections, isRemoteText, joinTextParts } from "./provider-utils.js";

interface OracleCeSource {
  host: string;
  site: string;
}

interface OracleSiteResponse {
  items?: Array<{
    SiteNumber?: string | number;
    siteNumber?: string | number;
    SiteURLName?: string;
  }>;
}

interface OracleSearchResponse {
  items?: Array<{
    requisitionList?: OracleRequisition[];
  }> | OracleRequisition[];
}

interface OracleRequisition {
  Id?: string | number;
  RequisitionId?: string | number;
  Title?: string;
  ExternalTitle?: string;
  Department?: string;
  Organization?: string;
  BusinessUnit?: string;
  JobSchedule?: string;
  JobType?: string;
  WorkerType?: string;
  WorkLocation?: string;
  PrimaryLocation?: string;
  Location?: string;
  PostedDate?: string;
}

interface OracleDetailResponse {
  items?: OracleRequisitionDetail[];
}

interface OracleRequisitionDetail extends OracleRequisition {
  ExternalDescriptionStr?: string;
  ExternalResponsibilitiesStr?: string;
  ExternalQualificationsStr?: string;
  ShortDescriptionStr?: string;
  ApplyUrl?: string;
}

export class OracleCeProvider implements CompanyBoardProvider {
  readonly id = "oracle-ce";
  readonly kind = "company-board";

  async fetchBoard(request: CompanyBoardRequest): Promise<JobListing[]> {
    if (request.provider !== "oracle-ce") {
      return [];
    }

    const source = parseOracleCeSource(request.source);
    const siteNumber = await fetchSiteNumber(source);
    const requisitions = await fetchRequisitions(source, siteNumber, request.keyword, request.limit ?? 25);
    const details = new Map<string, OracleRequisitionDetail>();

    if (request.includeDescription) {
      for (const requisition of requisitions.slice(0, 25)) {
        const id = String(requisition.Id ?? requisition.RequisitionId ?? "");
        if (!id) {
          continue;
        }

        try {
          const detail = await fetchDetail(source, siteNumber, id);
          if (detail) {
            details.set(id, detail);
          }
        } catch {
          // The list payload is still useful if a tenant blocks detail calls.
        }
      }
    }

    return requisitions
      .filter((requisition) => (requisition.Id ?? requisition.RequisitionId) && (requisition.Title ?? requisition.ExternalTitle))
      .map((requisition) => {
        const id = String(requisition.Id ?? requisition.RequisitionId);
        return normalizeOracleRequisition(source, siteNumber, requisition, details.get(id), request.includeDescription);
      });
  }
}

function parseOracleCeSource(value: string): OracleCeSource {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    const siteIndex = parts.findIndex((part) => part === "sites");
    return {
      host: url.hostname,
      site: siteIndex >= 0 && parts[siteIndex + 1] ? parts[siteIndex + 1] : parts[0] ?? "jobsearch"
    };
  } catch {
    const [host, site = "jobsearch"] = trimmed.replace(/^https?:\/\//i, "").split("/").filter(Boolean);
    return { host, site };
  }
}

async function fetchSiteNumber(source: OracleCeSource): Promise<string> {
  const url = new URL(`https://${source.host}/hcmRestApi/resources/latest/recruitingCESites`);
  url.searchParams.set("onlyData", "true");
  url.searchParams.set("q", `SiteURLName="${source.site}"`);
  const response = await fetchJson<OracleSiteResponse>(url.toString());
  const siteNumber = response.items?.[0]?.SiteNumber ?? response.items?.[0]?.siteNumber;

  if (siteNumber == null) {
    throw new Error(`Oracle CE site not found for ${source.site}.`);
  }

  return String(siteNumber);
}

async function fetchRequisitions(
  source: OracleCeSource,
  siteNumber: string,
  keyword: string | undefined,
  limit: number
): Promise<OracleRequisition[]> {
  const url = new URL(`https://${source.host}/hcmRestApi/resources/latest/recruitingCEJobRequisitions`);
  url.searchParams.set("onlyData", "true");
  url.searchParams.set("finder", `findReqs;siteNumber=${siteNumber}`);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", "0");
  if (keyword) {
    url.searchParams.set("Keyword", keyword);
  }

  const response = await fetchJson<OracleSearchResponse>(url.toString());
  const first = response.items?.[0];
  if (first && "requisitionList" in first) {
    return first.requisitionList ?? [];
  }

  return Array.isArray(response.items) ? response.items as OracleRequisition[] : [];
}

async function fetchDetail(
  source: OracleCeSource,
  siteNumber: string,
  id: string
): Promise<OracleRequisitionDetail | null> {
  const url = new URL(`https://${source.host}/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails`);
  url.searchParams.set("expand", "all");
  url.searchParams.set("onlyData", "true");
  url.searchParams.set("finder", `ById;Id="${id}",siteNumber=${siteNumber}`);
  const response = await fetchJson<OracleDetailResponse>(url.toString());
  return response.items?.[0] ?? null;
}

function normalizeOracleRequisition(
  source: OracleCeSource,
  siteNumber: string,
  requisition: OracleRequisition,
  detail: OracleRequisitionDetail | undefined,
  includeDescription?: boolean
): JobListing {
  const merged = { ...requisition, ...detail };
  const id = String(merged.Id ?? merged.RequisitionId);
  const title = merged.Title ?? merged.ExternalTitle ?? "Untitled role";
  const location = merged.WorkLocation ?? merged.PrimaryLocation ?? merged.Location ?? null;
  const listingUrl = `https://${source.host}/hcmUI/CandidateExperience/en/sites/${source.site}/job/${id}`;

  return {
    provider: "oracle-ce",
    providerKind: "company-board",
    source: `${source.host}/${source.site}`,
    externalId: id,
    title,
    company: merged.BusinessUnit ?? source.host,
    location,
    department: merged.Department ?? merged.Organization ?? null,
    employmentType: joinTextParts([merged.JobSchedule, merged.JobType, merged.WorkerType], " / "),
    workplaceType: null,
    remote: isRemoteText(location),
    listingUrl,
    applyUrl: asAbsoluteUrl(detail?.ApplyUrl, `https://${source.host}`) ?? listingUrl,
    postedAt: normalizeDate(merged.PostedDate),
    compensation: null,
    description: includeDescription
      ? compactHtmlSections([
        detail?.ExternalDescriptionStr,
        detail?.ExternalResponsibilitiesStr,
        detail?.ExternalQualificationsStr,
        detail?.ShortDescriptionStr
      ])
      : null,
    metadata: {
      siteNumber
    }
  };
}

function normalizeDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
