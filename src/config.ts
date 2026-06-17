import { resolve } from "node:path";
import { existsSync } from "node:fs";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const optionalNonEmptyString = () =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return value;
      }

      const trimmed = value.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    },
    z.string().min(1).optional()
  );

const envSchema = z.object({
  HANDSHAKE_BASE_URL: z.string().url().default("https://app.joinhandshake.com"),
  HANDSHAKE_SEARCH_URL: z.string().url().default("https://app.joinhandshake.com/stu/postings"),
  HANDSHAKE_STORAGE_STATE: z.string().default("./data/handshake-auth.json"),
  HANDSHAKE_STATE_FILE: z.string().default("./data/run-state.json"),
  HANDSHAKE_APPLICATION_PROFILE: z.string().default("./application-profile.json"),
  HANDSHAKE_RESUME_PATH: optionalNonEmptyString(),
  HANDSHAKE_MAX_APPLICATIONS: z.coerce.number().int().positive().default(10),
  HANDSHAKE_MAX_SEARCH_PAGES: z.coerce.number().int().positive().default(5),
  HANDSHAKE_HEADLESS: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  HANDSHAKE_ALLOW_SUBMIT: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  HANDSHAKE_SLOW_MO: z.coerce.number().int().min(0).default(150),
  JOB_SOURCE_CONFIG: z.string().default("./job-sources.json"),
  JOB_OUTPUT_PATH: z.string().default("./data/job-listings.json"),
  ADZUNA_APP_ID: optionalNonEmptyString(),
  ADZUNA_APP_KEY: optionalNonEmptyString(),
  ADZUNA_COUNTRY: z.string().min(2).default("us"),
  JOOBLE_API_KEY: optionalNonEmptyString()
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration.");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  handshake: {
    baseUrl: parsed.data.HANDSHAKE_BASE_URL,
    searchUrl: normalizeSearchUrl(parsed.data.HANDSHAKE_SEARCH_URL),
    storageStatePath: resolve(parsed.data.HANDSHAKE_STORAGE_STATE),
    stateFilePath: resolve(parsed.data.HANDSHAKE_STATE_FILE),
    profilePath: resolve(parsed.data.HANDSHAKE_APPLICATION_PROFILE),
    resumePath: parsed.data.HANDSHAKE_RESUME_PATH
      ? resolve(parsed.data.HANDSHAKE_RESUME_PATH)
      : undefined,
    maxApplications: parsed.data.HANDSHAKE_MAX_APPLICATIONS,
    maxSearchPages: parsed.data.HANDSHAKE_MAX_SEARCH_PAGES,
    headless: parsed.data.HANDSHAKE_HEADLESS,
    allowSubmit: parsed.data.HANDSHAKE_ALLOW_SUBMIT,
    slowMo: parsed.data.HANDSHAKE_SLOW_MO
  },
  listings: {
    sourceConfigPath: resolve(parsed.data.JOB_SOURCE_CONFIG),
    outputPath: resolve(parsed.data.JOB_OUTPUT_PATH),
    adzunaAppId: parsed.data.ADZUNA_APP_ID,
    adzunaAppKey: parsed.data.ADZUNA_APP_KEY,
    adzunaCountry: parsed.data.ADZUNA_COUNTRY.toLowerCase(),
    joobleApiKey: parsed.data.JOOBLE_API_KEY
  }
};

function normalizeSearchUrl(rawUrl: string): string {
  const url = new URL(rawUrl);

  if (url.pathname.startsWith("/job-search/")) {
    url.pathname = "/job-search";
  }

  return url.toString();
}

export function assertHandshakeRequiredFiles(): void {
  if (!config.handshake.resumePath) {
    console.error("HANDSHAKE_RESUME_PATH is required to run the apply flow.");
    process.exit(1);
  }

  const missingPaths = [
    config.handshake.profilePath,
    config.handshake.resumePath
  ].filter((path) => !existsSync(path));

  if (missingPaths.length > 0) {
    console.error("Required files are missing:");
    for (const path of missingPaths) {
      console.error(`- ${path}`);
    }
    process.exit(1);
  }
}
