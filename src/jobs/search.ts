import { readFile } from "node:fs/promises";
import { config } from "../config.js";
import { writeJsonFileAtomically } from "../atomic-file.js";
import {
  applyBoardDisplayName,
  dedupeListings,
  listingDedupeKey,
  sanitizeListingActionUrls
} from "./listing-normalize.js";
import { createBoardProviders, createSearchProviders } from "./providers/index.js";
import { loadJobSourceConfig, type JobSourceConfig } from "./source-config.js";
import type {
  CompanyBoardProvider,
  CompanyBoardRequest,
  JobListing,
  ListingSearchRequest,
  SearchProvider
} from "./types.js";

interface SearchRunSummary {
  provider: string;
  mode: "search" | "board";
  source: string;
  count: number;
}

interface SearchRunError {
  provider: string;
  mode: "search" | "board";
  source: string;
  message: string;
}

const DEFAULT_SEARCH_CONCURRENCY = 2;
const DEFAULT_BOARD_CONCURRENCY = 5;
const DEFAULT_BOARD_JITTER_MS = 120;

export interface RankedJobListing extends JobListing {
  score: number;
  reasons: string[];
  isNew: boolean;
}

export interface AlertMatch {
  id: string;
  name: string;
  count: number;
  browser: boolean;
  webhookUrl?: string;
  listings: RankedJobListing[];
}

export interface SearchOutput {
  generatedAt: string;
  sourceConfigPath: string;
  outputPath: string;
  summary: {
    searches: number;
    boards: number;
    fetchedListings: number;
    filteredListings: number;
    uniqueListings: number;
    alertMatches: number;
  };
  providers: SearchRunSummary[];
  errors: SearchRunError[];
  filters: JobSourceConfig["filters"];
  ranking: JobSourceConfig["ranking"];
  schedule: JobSourceConfig["schedule"];
  alerts: AlertMatch[];
  listings: RankedJobListing[];
}

export async function runListingsSearch(): Promise<SearchOutput> {
  const jobSourceConfig = await loadJobSourceConfig(config.listings.sourceConfigPath);
  const searchProviders = indexProviders(createSearchProviders());
  const boardProviders = indexProviders(createBoardProviders());

  const searchResults = await runSettledPool(
    jobSourceConfig.searches,
    readPositiveIntegerEnv("LISTING_SEARCH_CONCURRENCY", DEFAULT_SEARCH_CONCURRENCY),
    (request) => runSearchRequest(searchProviders, request)
  );
  const boardResults = await runSettledPool(
    jobSourceConfig.boards,
    readPositiveIntegerEnv("LISTING_BOARD_CONCURRENCY", DEFAULT_BOARD_CONCURRENCY),
    async (request, index) => {
      await jitterBeforeBoardRequest(index);
      return runBoardRequest(boardProviders, request);
    }
  );

  const summaries: SearchRunSummary[] = [];
  const errors: SearchRunError[] = [];
  const fetchedListings: JobListing[] = [];

  for (const result of [...searchResults, ...boardResults]) {
    if (result.status === "fulfilled") {
      summaries.push(result.value.summary);
      fetchedListings.push(...result.value.listings.map(sanitizeListingActionUrls));
      continue;
    }

    errors.push(result.reason as SearchRunError);
  }

  const previousListingKeys = await loadPreviousListingKeys(config.listings.outputPath);
  const dedupedListings = dedupeListings(fetchedListings);
  const filteredListings = dedupedListings.filter((listing) =>
    passesFilters(listing, jobSourceConfig)
  );
  const rankedListings = sortRankedListings(
    filteredListings.map((listing) =>
      rankListing(listing, jobSourceConfig, previousListingKeys.has(listingDedupeKey(listing)))
    )
  );
  const alertMatches = evaluateAlerts(rankedListings, jobSourceConfig);

  const payload: SearchOutput = {
    generatedAt: new Date().toISOString(),
    sourceConfigPath: config.listings.sourceConfigPath,
    outputPath: config.listings.outputPath,
    summary: {
      searches: jobSourceConfig.searches.length,
      boards: jobSourceConfig.boards.length,
      fetchedListings: fetchedListings.length,
      filteredListings: filteredListings.length,
      uniqueListings: rankedListings.length,
      alertMatches: alertMatches.reduce((total, alert) => total + alert.count, 0)
    },
    providers: summaries,
    errors,
    filters: jobSourceConfig.filters,
    ranking: jobSourceConfig.ranking,
    schedule: jobSourceConfig.schedule,
    alerts: alertMatches,
    listings: rankedListings
  };

  await writeJsonFileAtomically(config.listings.outputPath, payload);

  console.log(`Wrote ${rankedListings.length} unique listings to ${config.listings.outputPath}`);

  if (errors.length > 0) {
    console.log("Some providers failed:");
    for (const error of errors) {
      console.log(`- ${error.provider} (${error.source}): ${error.message}`);
    }
  }

  return payload;
}

async function runSearchRequest(
  providers: Map<string, SearchProvider>,
  request: ListingSearchRequest
): Promise<{ summary: SearchRunSummary; listings: JobListing[] }> {
  const provider = providers.get(request.provider);

  if (!provider) {
    throw buildRunError(request.provider, "search", request.query, "Provider not registered.");
  }

  try {
    const listings = await provider.search(request);
    return {
      summary: {
        provider: request.provider,
        mode: "search",
        source: request.query,
        count: listings.length
      },
      listings
    };
  } catch (error) {
    throw buildRunError(
      request.provider,
      "search",
      request.query,
      error instanceof Error ? error.message : String(error)
    );
  }
}

async function runBoardRequest(
  providers: Map<string, CompanyBoardProvider>,
  request: CompanyBoardRequest
): Promise<{ summary: SearchRunSummary; listings: JobListing[] }> {
  const provider = providers.get(request.provider);

  if (!provider) {
    throw buildRunError(request.provider, "board", request.source, "Provider not registered.");
  }

  try {
    const listings = (await provider.fetchBoard(request)).map((listing) =>
      applyBoardDisplayName(listing, request)
    );
    return {
      summary: {
        provider: request.provider,
        mode: "board",
        source: request.source,
        count: listings.length
      },
      listings
    };
  } catch (error) {
    throw buildRunError(
      request.provider,
      "board",
      request.source,
      error instanceof Error ? error.message : String(error)
    );
  }
}

function buildRunError(
  provider: string,
  mode: "search" | "board",
  source: string,
  message: string
): SearchRunError {
  return { provider, mode, source, message };
}

function indexProviders<T extends { id: string }>(providers: T[]): Map<string, T> {
  return new Map(providers.map((provider) => [provider.id, provider]));
}

async function runSettledPool<T, R>(
  items: T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;

        try {
          results[index] = { status: "fulfilled", value: await task(items[index], index) };
        } catch (reason) {
          results[index] = { status: "rejected", reason };
        }
      }
    })
  );

  return results;
}

async function jitterBeforeBoardRequest(index: number): Promise<void> {
  if (index === 0) {
    return;
  }

  const maxDelayMs = readNonNegativeIntegerEnv("LISTING_BOARD_JITTER_MS", DEFAULT_BOARD_JITTER_MS);
  if (maxDelayMs <= 0) {
    return;
  }

  const delayMs = Math.floor(Math.random() * maxDelayMs);
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

function readPositiveIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readNonNegativeIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

async function loadPreviousListingKeys(path: string): Promise<Set<string>> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as Partial<SearchOutput>;
    const listings = parsed.listings ?? [];
    return new Set(listings.map((listing) => listingDedupeKey(listing)));
  } catch (error) {
    if (isMissingFileError(error)) {
      return new Set();
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read previous listings output at ${path}: ${message}`);
  }
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
  );
}

function passesFilters(listing: JobListing, configData: JobSourceConfig): boolean {
  const { filters } = configData;
  const searchableText = buildSearchableText(listing);

  if (filters.includeKeywords.length > 0 && !matchesAny(searchableText, filters.includeKeywords)) {
    return false;
  }

  if (matchesAny(searchableText, filters.excludeKeywords)) {
    return false;
  }

  if (filters.includeCompanies.length > 0 && !matchesAny(listing.company, filters.includeCompanies)) {
    return false;
  }

  if (matchesAny(listing.company, filters.excludeCompanies)) {
    return false;
  }

  if (
    filters.includeLocations.length > 0 &&
    !matchesAny(listing.location ?? listing.workplaceType ?? "", filters.includeLocations)
  ) {
    return false;
  }

  if (matchesAny(listing.location ?? "", filters.excludeLocations)) {
    return false;
  }

  if (filters.remoteOnly && !isRemoteListing(listing)) {
    return false;
  }

  if (
    filters.workplaceTypes.length > 0 &&
    !matchesAny(listing.workplaceType ?? listing.location ?? "", filters.workplaceTypes)
  ) {
    return false;
  }

  if (
    filters.employmentTypes.length > 0 &&
    !matchesAny(listing.employmentType ?? "", filters.employmentTypes)
  ) {
    return false;
  }

  if (filters.onlyWithApplyUrl && !listing.applyUrl) {
    return false;
  }

  if (filters.preferredProviders.length > 0 && !filters.preferredProviders.includes(listing.provider)) {
    return false;
  }

  const compensationRange = parseCompensationRange(listing.compensation);
  if (typeof filters.minSalary === "number" && compensationRange.max !== null && compensationRange.max < filters.minSalary) {
    return false;
  }

  if (typeof filters.maxSalary === "number" && compensationRange.min !== null && compensationRange.min > filters.maxSalary) {
    return false;
  }

  if (typeof filters.maxAgeDays === "number" && listing.postedAt) {
    const listingAgeDays = (Date.now() - Date.parse(listing.postedAt)) / (1000 * 60 * 60 * 24);
    if (Number.isFinite(listingAgeDays) && listingAgeDays > filters.maxAgeDays) {
      return false;
    }
  }

  return true;
}

function rankListing(
  listing: JobListing,
  configData: JobSourceConfig,
  alreadySeen: boolean
): RankedJobListing {
  const { ranking } = configData;
  const searchableText = buildSearchableText(listing);
  let score = 35;
  const reasons: string[] = [];

  if (ranking.preferCompanyBoards && listing.providerKind === "company-board") {
    score += 12;
    reasons.push("Canonical company board");
  }

  if (listing.applyUrl) {
    score += 5;
    reasons.push("Direct apply link");
  }

  if (isRemoteListing(listing)) {
    score += ranking.remoteBoost;
    reasons.push("Remote-friendly");
  }

  if (listing.postedAt) {
    const ageDays = (Date.now() - Date.parse(listing.postedAt)) / (1000 * 60 * 60 * 24);
    if (Number.isFinite(ageDays)) {
      const freshnessScore = Math.max(0, ranking.freshnessBoost - Math.floor(ageDays));
      if (freshnessScore > 0) {
        score += freshnessScore;
        reasons.push("Fresh posting");
      }
    }
  }

  const compensationRange = parseCompensationRange(listing.compensation);
  if (compensationRange.max !== null || compensationRange.min !== null) {
    score += ranking.compensationBoost;
    reasons.push("Compensation present");
  }

  const keywordHits = countMatches(searchableText, [
    ...configData.filters.includeKeywords,
    ...ranking.skillKeywords
  ]);
  if (keywordHits > 0) {
    score += Math.min(ranking.keywordBoost, keywordHits * 4);
    reasons.push("Keyword overlap");
  }

  if (matchesAny(listing.title, ranking.titleBoosts)) {
    score += 10;
    reasons.push("Preferred title");
  }

  if (matchesAny(listing.company, ranking.companyBoosts)) {
    score += 10;
    reasons.push("Preferred company");
  }

  if (matchesAny(listing.location ?? "", ranking.locationBoosts)) {
    score += 8;
    reasons.push("Preferred location");
  }

  if (!alreadySeen) {
    score += 4;
    reasons.push("New this run");
  }

  return {
    ...listing,
    score: Math.max(0, Math.min(100, score)),
    reasons: uniqueValues(reasons),
    isNew: !alreadySeen
  };
}

function evaluateAlerts(
  listings: RankedJobListing[],
  configData: JobSourceConfig
): AlertMatch[] {
  return configData.alerts
    .filter((alert) => alert.enabled)
    .map((alert) => {
      const matches = listings.filter((listing) => {
        if (listing.score < alert.minScore) {
          return false;
        }

        if (alert.newOnly && !listing.isNew) {
          return false;
        }

        if (alert.providers.length > 0 && !alert.providers.includes(listing.provider)) {
          return false;
        }

        if (alert.companies.length > 0 && !matchesAny(listing.company, alert.companies)) {
          return false;
        }

        if (alert.keywords.length > 0 && !matchesAny(buildSearchableText(listing), alert.keywords)) {
          return false;
        }

        return true;
      });

      return {
        id: alert.id,
        name: alert.name,
        count: matches.length,
        browser: alert.browser,
        webhookUrl: alert.webhookUrl,
        listings: matches.slice(0, 10)
      };
    })
    .filter((alert) => alert.count > 0);
}

function sortRankedListings(listings: RankedJobListing[]): RankedJobListing[] {
  return [...listings].sort((left, right) => {
    return (
      right.score - left.score ||
      (right.postedAt ? Date.parse(right.postedAt) : 0) -
        (left.postedAt ? Date.parse(left.postedAt) : 0) ||
      left.company.localeCompare(right.company) ||
      left.title.localeCompare(right.title)
    );
  });
}

function buildSearchableText(listing: JobListing): string {
  return [
    listing.title,
    listing.company,
    listing.location,
    listing.department,
    listing.employmentType,
    listing.workplaceType,
    listing.description
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesAny(value: string, terms: string[]): boolean {
  const normalizedValue = value.toLowerCase();
  return terms.some((term) => normalizedValue.includes(term.toLowerCase()));
}

function countMatches(value: string, terms: string[]): number {
  const uniqueTerms = uniqueValues(terms.map((term) => term.toLowerCase()));
  return uniqueTerms.filter((term) => value.includes(term)).length;
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values)];
}

function isRemoteListing(listing: JobListing): boolean {
  return (
    listing.remote === true ||
    matchesAny(listing.location ?? "", ["remote", "anywhere"]) ||
    matchesAny(listing.workplaceType ?? "", ["remote"])
  );
}

function parseCompensationRange(compensation: string | null): { min: number | null; max: number | null } {
  if (!compensation) {
    return { min: null, max: null };
  }

  const numbers = Array.from(
    compensation.matchAll(/(\d+(?:,\d{3})*(?:\.\d+)?|\d*\.\d+)\s*([km])?/gi)
  )
    .map((match) => {
      const value = Number(match[1].replace(/,/g, ""));
      const suffix = match[2]?.toLowerCase();
      if (!Number.isFinite(value)) {
        return null;
      }

      if (suffix === "m") {
        return value * 1_000_000;
      }

      if (suffix === "k") {
        return value * 1_000;
      }

      return value;
    })
    .filter((value): value is number => value !== null);

  if (numbers.length === 0) {
    return { min: null, max: null };
  }

  return {
    min: Math.min(...numbers),
    max: Math.max(...numbers)
  };
}
