import { fetchText } from "../http.js";
import type { CompanyBoardProvider, CompanyBoardRequest, JobListing } from "../types.js";
import { compactHtmlSections, isRemoteText, joinTextParts } from "./provider-utils.js";

interface PersonioSource {
  host: string;
  language: string;
  urls: string[];
}

export class PersonioProvider implements CompanyBoardProvider {
  readonly id = "personio";
  readonly kind = "company-board";

  async fetchBoard(request: CompanyBoardRequest): Promise<JobListing[]> {
    if (request.provider !== "personio") {
      return [];
    }

    const source = parsePersonioSource(request.source, request.language ?? "en");
    const xml = await fetchFirstPersonioFeed(source.urls);

    return splitPositionBlocks(xml)
      .map((block) => normalizePersonioPosition(source, request.source, block, request.includeDescription))
      .filter((listing): listing is JobListing => Boolean(listing));
  }
}

function normalizePersonioPosition(
  source: PersonioSource,
  originalSource: string,
  block: string,
  includeDescription?: boolean
): JobListing | null {
  const id = extractTag(block, "id");
  const title = extractTag(block, "name");

  if (!id || !title) {
    return null;
  }

  const office = extractTag(block, "office");
  const additionalOffices = extractRepeatedTags(extractTagBlock(block, "additionalOffices"), "office");
  const location = joinTextParts([office, ...additionalOffices], "; ");
  const listingUrl = `https://${source.host}/job/${encodeURIComponent(id)}?display=${encodeURIComponent(source.language)}`;

  return {
    provider: "personio",
    providerKind: "company-board",
    source: originalSource,
    externalId: id,
    title,
    company: extractTag(block, "subcompany") || source.host.split(".")[0],
    location,
    department: extractTag(block, "department") || extractTag(block, "recruitingCategory") || null,
    employmentType: joinTextParts([extractTag(block, "employmentType"), extractTag(block, "schedule")], " / "),
    workplaceType: null,
    remote: isRemoteText(location),
    listingUrl,
    applyUrl: listingUrl,
    postedAt: normalizeDate(extractTag(block, "createdAt")),
    compensation: null,
    description: includeDescription ? compactHtmlSections(extractPersonioDescriptions(block)) : null,
    metadata: {
      recruitingCategory: extractTag(block, "recruitingCategory") || null,
      seniority: extractTag(block, "seniority") || null,
      occupation: extractTag(block, "occupation") || null,
      occupationCategory: extractTag(block, "occupationCategory") || null
    }
  };
}

function parsePersonioSource(value: string, language: string): PersonioSource {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    const feedUrl = new URL(url.toString());
    feedUrl.pathname = "/xml";
    feedUrl.search = "";
    feedUrl.searchParams.set("language", language);
    return {
      host: url.hostname,
      language,
      urls: [feedUrl.toString()]
    };
  } catch {
    const host = trimmed.includes(".") ? trimmed.replace(/^https?:\/\//i, "").split("/")[0] : `${trimmed}.jobs.personio.com`;
    const urls = [`https://${host}/xml?language=${encodeURIComponent(language)}`];
    if (!host.endsWith(".de")) {
      urls.push(`https://${trimmed}.jobs.personio.de/xml?language=${encodeURIComponent(language)}`);
    }

    return { host, language, urls };
  }
}

async function fetchFirstPersonioFeed(urls: string[]): Promise<string> {
  let lastError: Error | null = null;

  for (const url of urls) {
    try {
      return await fetchText(url, {
        headers: {
          Accept: "application/xml,text/xml;q=0.9,*/*;q=0.8"
        }
      });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error("Unable to load Personio XML feed.");
}

function splitPositionBlocks(xml: string): string[] {
  return [...xml.matchAll(/<position>([\s\S]*?)<\/position>/g)].map((match) => match[1]);
}

function extractPersonioDescriptions(block: string): string[] {
  return [...block.matchAll(/<jobDescription>([\s\S]*?)<\/jobDescription>/g)]
    .map((match) => extractTag(match[1], "value"))
    .filter(Boolean);
}

function extractRepeatedTags(block: string, tag: string): string[] {
  if (!block) {
    return [];
  }

  const escapedTag = escapeRegExp(tag);
  return [...block.matchAll(new RegExp(`<${escapedTag}>\\s*(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))\\s*</${escapedTag}>`, "g"))]
    .map((match) => decodeXml((match[1] ?? match[2] ?? "").trim()))
    .filter(Boolean);
}

function extractTagBlock(block: string, tag: string): string {
  const escapedTag = escapeRegExp(tag);
  return block.match(new RegExp(`<${escapedTag}>([\\s\\S]*?)</${escapedTag}>`))?.[1] ?? "";
}

function extractTag(block: string, tag: string): string {
  const escapedTag = escapeRegExp(tag);
  const match = block.match(new RegExp(`<${escapedTag}>\\s*(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))\\s*</${escapedTag}>`));
  const raw = match?.[1] ?? match?.[2] ?? "";
  return decodeXml(raw.trim());
}

function decodeXml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#039;/g, "'");
}

function normalizeDate(value: string): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
