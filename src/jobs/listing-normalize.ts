import type { CompanyBoardRequest, JobListing } from "./types.js";

const BLOCKED_JOB_ACTION_HOSTS = [
  "jobleads.com",
  "jooble.org"
];

const TRACKING_QUERY_PARAMS = new Set([
  "fbclid",
  "gclid",
  "gh_jid",
  "gh_src",
  "lever-source",
  "ref",
  "source",
  "src",
  "utm_campaign",
  "utm_content",
  "utm_medium",
  "utm_source",
  "utm_term"
]);

export function normalizeListingUrl(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    parsed.hash = "";
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");

    for (const key of [...parsed.searchParams.keys()]) {
      if (TRACKING_QUERY_PARAMS.has(key.toLowerCase())) {
        parsed.searchParams.delete(key);
      }
    }

    if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }

    const normalized = parsed.toString();
    return normalized.endsWith("?") ? normalized.slice(0, -1) : normalized;
  } catch {
    return trimmed.toLowerCase();
  }
}

export function listingUrlKey(listing: Pick<JobListing, "applyUrl" | "listingUrl">): string | null {
  return normalizeListingUrl(listing.applyUrl ?? listing.listingUrl);
}

export function listingMetaKey(
  listing: Pick<JobListing, "company" | "title" | "location">
): string {
  return [
    "meta",
    normalizeMetaText(listing.company),
    normalizeMetaText(listing.title),
    normalizeMetaText(listing.location ?? "")
  ].join("::");
}

export function listingDedupeKey(
  listing: Pick<JobListing, "applyUrl" | "listingUrl" | "company" | "title" | "location">
): string {
  return listingUrlKey(listing) ?? listingMetaKey(listing);
}

export function sanitizeListingActionUrls<T extends { provider?: string; applyUrl: string | null }>(
  listing: T
): T {
  if (!listing.applyUrl) {
    return listing;
  }

  if (listing.provider === "jooble" || isBlockedJobActionUrl(listing.applyUrl)) {
    return {
      ...listing,
      applyUrl: null
    };
  }

  return listing;
}

export function isBlockedJobActionUrl(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  try {
    const hostname = new URL(value).hostname.toLowerCase().replace(/^www\./, "");
    return BLOCKED_JOB_ACTION_HOSTS.some((blockedHost) =>
      hostname === blockedHost || hostname.endsWith(`.${blockedHost}`)
    );
  } catch {
    return BLOCKED_JOB_ACTION_HOSTS.some((blockedHost) =>
      value.toLowerCase().includes(blockedHost)
    );
  }
}

export function canonicalityScore(listing: JobListing): number {
  return [
    listing.providerKind === "company-board" ? 2 : 0,
    listing.description ? 1 : 0,
    listing.applyUrl ? 1 : 0
  ].reduce((total, value) => total + value, 0);
}

export function dedupeListings(listings: JobListing[]): JobListing[] {
  const results: JobListing[] = [];
  const urlIndex = new Map<string, number>();
  const metaIndex = new Map<string, number>();

  for (const listing of listings) {
    const urlKey = listingUrlKey(listing);
    const metaKey = listingMetaKey(listing);
    const existingIndex = resolveExistingListingIndex(
      listing,
      urlKey,
      metaKey,
      results,
      urlIndex,
      metaIndex
    );

    if (existingIndex === undefined) {
      const index = results.length;
      results.push(listing);
      registerListingIndexes(index, urlKey, metaKey, urlIndex, metaIndex);
      continue;
    }

    const existing = results[existingIndex];
    if (canonicalityScore(listing) > canonicalityScore(existing)) {
      unregisterListingIndexes(existing, urlKey, metaKey, urlIndex, metaIndex);
      results[existingIndex] = listing;
      registerListingIndexes(existingIndex, urlKey, metaKey, urlIndex, metaIndex);
    }
  }

  return results;
}

export function applyBoardDisplayName(
  listing: JobListing,
  request: CompanyBoardRequest
): JobListing {
  const companyName = request.companyName?.trim();
  if (!companyName) {
    return listing;
  }

  if (companyName === listing.company) {
    return listing;
  }

  return {
    ...listing,
    company: companyName
  };
}

export function resolveBoardCompanyName(
  providerCompany: string,
  configuredCompanyName: string,
  source: string
): string {
  const trimmedProviderCompany = providerCompany.trim();
  if (!trimmedProviderCompany) {
    return configuredCompanyName;
  }

  return configuredCompanyName.trim() || trimmedProviderCompany;
}

function resolveExistingListingIndex(
  listing: JobListing,
  urlKey: string | null,
  metaKey: string,
  results: JobListing[],
  urlIndex: Map<string, number>,
  metaIndex: Map<string, number>
): number | undefined {
  if (urlKey !== null) {
    const byUrl = urlIndex.get(urlKey);
    if (byUrl !== undefined) {
      return byUrl;
    }
  }

  const byMeta = metaIndex.get(metaKey);
  if (byMeta === undefined) {
    return undefined;
  }

  const existing = results[byMeta];
  return existing && canMergeByMeta(listing, existing) ? byMeta : undefined;
}

function registerListingIndexes(
  index: number,
  urlKey: string | null,
  metaKey: string,
  urlIndex: Map<string, number>,
  metaIndex: Map<string, number>
): void {
  if (urlKey !== null) {
    urlIndex.set(urlKey, index);
  }

  metaIndex.set(metaKey, index);
}

function unregisterListingIndexes(
  existing: JobListing,
  replacementUrlKey: string | null,
  replacementMetaKey: string,
  urlIndex: Map<string, number>,
  metaIndex: Map<string, number>
): void {
  const existingUrlKey = listingUrlKey(existing);
  if (existingUrlKey !== null && existingUrlKey !== replacementUrlKey) {
    urlIndex.delete(existingUrlKey);
  }

  const existingMetaKey = listingMetaKey(existing);
  if (existingMetaKey !== replacementMetaKey) {
    metaIndex.delete(existingMetaKey);
  }
}

function normalizeMetaText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function canMergeByMeta(candidate: JobListing, existing: JobListing): boolean {
  if (candidate.providerKind === "aggregator" || existing.providerKind === "aggregator") {
    return true;
  }

  return !listingUrlKey(candidate) || !listingUrlKey(existing);
}
