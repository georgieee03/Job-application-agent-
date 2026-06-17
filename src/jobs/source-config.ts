import { readFile } from "node:fs/promises";
import { z } from "zod";
import { writeJsonFileAtomically } from "../atomic-file.js";
import type { CompanyBoardRequest, ListingSearchRequest, ProviderId } from "./types.js";

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
const providerIdSchema = z.enum([
  "adzuna",
  "jooble",
  "greenhouse",
  "lever",
  "ashby",
  "workable",
  "workday",
  "smartrecruiters",
  "recruitee",
  "personio",
  "bamboohr",
  "icims-jibe",
  "icims-classic",
  "oracle-ce",
  "taleo"
]);
const textListSchema = z.array(z.string()).default([]).transform((values) =>
  uniqueValues(values.map((value) => value.trim()).filter(Boolean))
);
const providerListSchema = z.array(providerIdSchema).default([]).transform(uniqueValues);
const httpUrlSchema = z.string().url().refine((value) => {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}, "URL must use http or https.");
const webhookUrlSchema = httpUrlSchema.refine(
  isPublicWebhookUrl,
  "Webhook URL must use a public HTTP(S) host."
);
const timezoneSchema = z.string().min(1).refine((value) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}, "Timezone must be a valid IANA timezone.");

const searchSchema = z.object({
  provider: z.enum(["adzuna", "jooble"]),
  query: z.string().min(1),
  location: z.string().min(1).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional()
});

const boardDisplayNameSchema = {
  companyName: z.string().min(1).optional()
};

const boardSchema = z.discriminatedUnion("provider", [
  z.object({
    provider: z.literal("greenhouse"),
    source: z.string().min(1),
    includeDescription: z.boolean().optional(),
    ...boardDisplayNameSchema
  }),
  z.object({
    provider: z.literal("lever"),
    source: z.string().min(1),
    includeDescription: z.boolean().optional(),
    location: z.string().min(1).optional(),
    team: z.string().min(1).optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    ...boardDisplayNameSchema
  }),
  z.object({
    provider: z.literal("ashby"),
    source: z.string().min(1),
    includeDescription: z.boolean().optional(),
    ...boardDisplayNameSchema
  }),
  z.object({
    provider: z.literal("workable"),
    source: z.string().min(1),
    includeDescription: z.boolean().optional(),
    ...boardDisplayNameSchema
  }),
  z.object({
    provider: z.literal("workday"),
    source: z.string().min(1),
    includeDescription: z.boolean().optional(),
    searchText: z.string().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    maxPages: z.coerce.number().int().positive().max(20).optional(),
    ...boardDisplayNameSchema
  }),
  z.object({
    provider: z.literal("smartrecruiters"),
    source: z.string().min(1),
    includeDescription: z.boolean().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    maxPages: z.coerce.number().int().positive().max(20).optional(),
    ...boardDisplayNameSchema
  }),
  z.object({
    provider: z.literal("recruitee"),
    source: z.string().min(1),
    includeDescription: z.boolean().optional(),
    ...boardDisplayNameSchema
  }),
  z.object({
    provider: z.literal("personio"),
    source: z.string().min(1),
    includeDescription: z.boolean().optional(),
    language: z.string().min(2).max(8).optional(),
    ...boardDisplayNameSchema
  }),
  z.object({
    provider: z.literal("bamboohr"),
    source: z.string().min(1),
    includeDescription: z.boolean().optional(),
    ...boardDisplayNameSchema
  }),
  z.object({
    provider: z.literal("icims-jibe"),
    source: z.string().min(1),
    includeDescription: z.boolean().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    ...boardDisplayNameSchema
  }),
  z.object({
    provider: z.literal("icims-classic"),
    source: z.string().min(1),
    includeDescription: z.boolean().optional(),
    keyword: z.string().optional(),
    ...boardDisplayNameSchema
  }),
  z.object({
    provider: z.literal("oracle-ce"),
    source: z.string().min(1),
    includeDescription: z.boolean().optional(),
    keyword: z.string().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    ...boardDisplayNameSchema
  }),
  z.object({
    provider: z.literal("taleo"),
    source: z.string().min(1),
    includeDescription: z.boolean().optional(),
    keyword: z.string().optional(),
    lang: z.string().min(2).max(8).optional(),
    ...boardDisplayNameSchema
  })
]);

const filterSchema = z.object({
  includeKeywords: textListSchema,
  excludeKeywords: textListSchema,
  includeCompanies: textListSchema,
  excludeCompanies: textListSchema,
  includeLocations: textListSchema,
  excludeLocations: textListSchema,
  remoteOnly: z.boolean().default(false),
  workplaceTypes: textListSchema,
  employmentTypes: textListSchema,
  minSalary: z.coerce.number().nonnegative().optional(),
  maxSalary: z.coerce.number().positive().optional(),
  maxAgeDays: z.coerce.number().int().positive().optional(),
  onlyWithApplyUrl: z.boolean().default(false),
  preferredProviders: providerListSchema
});

const rankingSchema = z.object({
  preferCompanyBoards: z.boolean().default(true),
  remoteBoost: z.coerce.number().int().min(0).max(30).default(10),
  freshnessBoost: z.coerce.number().int().min(0).max(30).default(12),
  compensationBoost: z.coerce.number().int().min(0).max(30).default(8),
  keywordBoost: z.coerce.number().int().min(0).max(30).default(14),
  titleBoosts: textListSchema,
  companyBoosts: textListSchema,
  locationBoosts: textListSchema,
  skillKeywords: textListSchema
});

const alertSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  enabled: z.boolean().default(true),
  minScore: z.coerce.number().int().min(0).max(100).default(70),
  newOnly: z.boolean().default(true),
  keywords: textListSchema,
  providers: providerListSchema,
  companies: textListSchema,
  browser: z.boolean().default(true),
  webhookUrl: webhookUrlSchema.optional()
});

const scheduleSchema = z.object({
  enabled: z.boolean().default(false),
  intervalMinutes: z.coerce.number().int().min(5).max(7 * 24 * 60).default(60),
  timezone: timezoneSchema.default("America/Phoenix"),
  quietHoursStart: z.string().regex(timePattern).optional(),
  quietHoursEnd: z.string().regex(timePattern).optional()
});

const defaultFilters = filterSchema.parse({});
const defaultRanking = rankingSchema.parse({});
const defaultSchedule = scheduleSchema.parse({});

const jobSourceConfigSchema = z.object({
  searches: z.array(searchSchema).default([]),
  boards: z.array(boardSchema).default([]),
  filters: filterSchema.default(defaultFilters),
  ranking: rankingSchema.default(defaultRanking),
  alerts: z.array(alertSchema).default([]),
  schedule: scheduleSchema.default(defaultSchedule)
});

export interface JobSourceConfig {
  searches: ListingSearchRequest[];
  boards: CompanyBoardRequest[];
  filters: z.infer<typeof filterSchema>;
  ranking: z.infer<typeof rankingSchema>;
  alerts: z.infer<typeof alertSchema>[];
  schedule: z.infer<typeof scheduleSchema>;
}

export function getDefaultJobSourceConfig(): JobSourceConfig {
  return jobSourceConfigSchema.parse({});
}

export function parseJobSourceConfig(input: unknown): JobSourceConfig {
  const parsed = jobSourceConfigSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error(`Invalid job source configuration: ${parsed.error.message}`);
  }

  return parsed.data;
}

export async function loadJobSourceConfig(path: string): Promise<JobSourceConfig> {
  const raw = await readFile(path, "utf8");
  return parseJobSourceConfig(JSON.parse(raw));
}

export async function loadJobSourceConfigOrDefault(path: string): Promise<JobSourceConfig> {
  try {
    return await loadJobSourceConfig(path);
  } catch (error) {
    if (!isMissingFileError(error)) {
      throw error;
    }

    return getDefaultJobSourceConfig();
  }
}

export async function saveJobSourceConfig(path: string, configData: JobSourceConfig): Promise<void> {
  await writeJsonFileAtomically(path, configData);
}

function uniqueValues<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function isPublicWebhookUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return !isLocalOrPrivateHost(url.hostname);
  } catch {
    return false;
  }
}

function isLocalOrPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");

  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    return true;
  }

  const ipv4 = parseIpv4Address(host);
  if (ipv4) {
    return isPrivateIpv4Address(ipv4);
  }

  return isPrivateIpv6Address(host);
}

function parseIpv4Address(host: string): [number, number, number, number] | null {
  const parts = host.split(".");
  if (parts.length !== 4) {
    return null;
  }

  const octets = parts.map((part) => Number(part));
  if (octets.some((octet, index) => !Number.isInteger(octet) || octet < 0 || octet > 255 || String(octet) !== parts[index])) {
    return null;
  }

  return octets as [number, number, number, number];
}

function isPrivateIpv4Address([first, second]: [number, number, number, number]): boolean {
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    first >= 224 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19))
  );
}

function isPrivateIpv6Address(host: string): boolean {
  if (!host.includes(":")) {
    return false;
  }

  return (
    host === "::" ||
    host === "::1" ||
    host.startsWith("::ffff:127.") ||
    host.startsWith("::ffff:10.") ||
    host.startsWith("::ffff:192.168.") ||
    /^::ffff:172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host.startsWith("fc") ||
    host.startsWith("fd") ||
    host.startsWith("fe80:")
  );
}


function isMissingFileError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}
