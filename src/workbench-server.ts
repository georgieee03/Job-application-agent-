import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";
import { config } from "./config.js";
import { writeJsonFileAtomically, writeTextFileAtomically } from "./atomic-file.js";
import {
  loadJobSourceConfigOrDefault,
  parseJobSourceConfig,
  saveJobSourceConfig,
  type JobSourceConfig
} from "./jobs/source-config.js";
import { discoverBoardsFromInput } from "./jobs/discover-boards.js";
import { sanitizeListingActionUrls } from "./jobs/listing-normalize.js";
import { runListingsSearch, type SearchOutput } from "./jobs/search.js";

const PORT = Number(process.env.WORKBENCH_PORT ?? 4321);
const HOST = process.env.WORKBENCH_HOST ?? "127.0.0.1";
const UI_DIR = resolve(process.cwd(), "ui");
const TRACKER_PATH = resolve(process.cwd(), "data", "application-tracker.json");
const APPLIED_WORKBOOK_PATH = resolve(process.cwd(), "data", "applied-jobs.xls");
const TRACKER_STATUSES = new Set([
  "",
  "discovered",
  "screened",
  "tailoring",
  "awaiting-approval",
  "approved",
  "form-in-progress",
  "awaiting-user",
  "submitted - email verified",
  "submitted - portal verified",
  "submitted - pending email verification",
  "submitted",
  "not submitted",
  "not completed",
  "manual submit needed",
  "needs-review",
  "blocked",
  "skipped",
  "rejected",
  "interview",
  "accepted"
]);
const LEGACY_TRACKER_STATUS_ALIASES = new Map<string, string>([
  ["ready-to-submit", "approved"],
  ["submitted-pending-verification", "submitted - pending email verification"],
  ["submitted - pending email/portal verification", "submitted - pending email verification"],
  ["blocked - replaced", "skipped"]
]);
const MAX_JSON_BODY_BYTES = 1_000_000;
const MAX_TRACKER_TEXT_LENGTH = 50_000;
const MAX_TRACKER_FIELD_LENGTH = 1_000;
const ALERT_WEBHOOK_TIMEOUT_MS = readPositiveIntegerEnv("ALERT_WEBHOOK_TIMEOUT_MS", 5_000);
const API_ROUTE_METHODS = new Map<string, string[]>([
  ["/api/config", ["GET", "POST"]],
  ["/api/results", ["GET"]],
  ["/api/tracker", ["GET"]],
  ["/api/tracker/export", ["GET"]],
  ["/api/tracker/visit", ["POST"]],
  ["/api/tracker/applied", ["POST"]],
  ["/api/tracker/status", ["POST"]],
  ["/api/tracker/resume", ["POST"]],
  ["/api/tracker/remove", ["POST"]],
  ["/api/run-search", ["POST"]],
  ["/api/discover-boards", ["POST"]],
  ["/api/status", ["GET"]]
]);

class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
  }
}

interface TrackedJobInput {
  provider?: string;
  title?: string;
  company?: string;
  location?: string | null;
  employmentType?: string | null;
  listingUrl?: string;
  applyUrl?: string | null;
  description?: string | null;
  score?: number;
  sourceRunAt?: string | null;
}

interface TrackedJob extends Required<Omit<TrackedJobInput, "applyUrl" | "description" | "location" | "employmentType" | "sourceRunAt">> {
  id: string;
  applyUrl: string | null;
  description: string | null;
  location: string | null;
  employmentType: string | null;
  sourceRunAt: string | null;
  firstVisitedAt: string;
  lastVisitedAt: string;
  visitCount: number;
  openCount: number;
  applyClickCount: number;
  lastAction: "open-listing" | "apply";
  applied: boolean;
  appliedAt: string | null;
  status:
    | ""
    | "discovered"
    | "screened"
    | "tailoring"
    | "awaiting-approval"
    | "approved"
    | "form-in-progress"
    | "awaiting-user"
    | "submitted - email verified"
    | "submitted - portal verified"
    | "submitted - pending email verification"
    | "submitted"
    | "not submitted"
    | "not completed"
    | "manual submit needed"
    | "needs-review"
    | "blocked"
    | "skipped"
    | "rejected"
    | "interview"
    | "accepted";
  statusUpdatedAt: string | null;
  resumeNotes: string;
  resumeDraft: string;
  jobDescriptionOverride: string;
  resumeUpdatedAt: string | null;
}

type NormalizedTrackedJobInput = Required<
  Omit<TrackedJobInput, "applyUrl" | "description" | "location" | "employmentType" | "sourceRunAt">
> & {
  applyUrl: string | null;
  description: string | null;
  location: string | null;
  employmentType: string | null;
  sourceRunAt: string | null;
};

const runtimeState: {
  lastRunAt: string | null;
  nextRunAt: string | null;
  running: boolean;
  lastError: string | null;
  lastOutput: SearchOutput | null;
  timer: NodeJS.Timeout | null;
} = {
  lastRunAt: null,
  nextRunAt: null,
  running: false,
  lastError: null,
  lastOutput: null,
  timer: null
};
let trackerMutationQueue: Promise<void> = Promise.resolve();

async function main(): Promise<void> {
  await initializeRuntimeState();

  const server = createServer(async (request, response) => {
    try {
      await handleRequest(request, response);
    } catch (error) {
      console.error(error);
      if (error instanceof HttpError) {
        sendJson(response, error.statusCode, { error: error.message });
        return;
      }

      sendJson(response, 500, {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  server.listen(PORT, HOST, () => {
    console.log(`Job workbench available at http://${HOST}:${PORT}`);
  });
}

async function initializeRuntimeState(): Promise<void> {
  try {
    await refreshSchedule();
  } catch (error) {
    runtimeState.lastError = error instanceof Error ? error.message : String(error);
    runtimeState.nextRunAt = null;
    console.error(`Startup schedule refresh failed: ${runtimeState.lastError}`);
  }

  try {
    await syncAppliedJobsWorkbook(await loadTracker());
  } catch (error) {
    runtimeState.lastError = error instanceof Error ? error.message : String(error);
    console.error(`Startup tracker workbook refresh failed: ${runtimeState.lastError}`);
  }
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const url = new URL(request.url ?? "/", `http://localhost:${PORT}`);
  enforceSameOriginApiMutation(request, url);

  if (request.method === "GET" && url.pathname === "/api/config") {
    const configData = await loadJobSourceConfigOrDefault(config.listings.sourceConfigPath);
    sendJson(response, 200, configData);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/config") {
    const body = await readJsonBody(request);
    const configData = parseWorkbenchConfig(body);
    await saveJobSourceConfig(config.listings.sourceConfigPath, configData);
    await refreshSchedule(configData);
    sendJson(response, 200, configData);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/results") {
    sendJson(response, 200, await loadLatestOutput());
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/tracker") {
    sendJson(response, 200, await loadTracker());
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/tracker/export") {
    await sendAppliedJobsWorkbook(response);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/tracker/visit") {
    const body = await readJsonBody(request);
    sendJson(response, 200, await recordTrackerVisit(body));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/tracker/applied") {
    const body = await readJsonBody(request);
    sendJson(response, 200, await updateTrackerApplied(body));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/tracker/status") {
    const body = await readJsonBody(request);
    sendJson(response, 200, await updateTrackerStatus(body));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/tracker/resume") {
    const body = await readJsonBody(request);
    sendJson(response, 200, await updateTrackerResume(body));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/tracker/remove") {
    const body = await readJsonBody(request);
    sendJson(response, 200, await removeTrackedJob(body));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/run-search") {
    const output = await executeSearch("manual");
    sendJson(response, 200, output);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/discover-boards") {
    const body = await readJsonBody(request);
    sendJson(response, 200, discoverBoardsFromRequest(body));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/status") {
    const configData = await loadJobSourceConfigOrDefault(config.listings.sourceConfigPath);
    sendJson(response, 200, {
      configPath: config.listings.sourceConfigPath,
      outputPath: config.listings.outputPath,
      trackerPath: TRACKER_PATH,
      appliedWorkbookPath: APPLIED_WORKBOOK_PATH,
      runtime: {
        lastRunAt: runtimeState.lastRunAt,
        nextRunAt: runtimeState.nextRunAt,
        running: runtimeState.running,
        lastError: runtimeState.lastError
      },
      schedule: configData.schedule,
      providerReadiness: {
        adzuna: {
          configured: Boolean(config.listings.adzunaAppId && config.listings.adzunaAppKey),
          needs: ["ADZUNA_APP_ID", "ADZUNA_APP_KEY"]
        },
        jooble: {
          configured: Boolean(config.listings.joobleApiKey),
          needs: ["JOOBLE_API_KEY"]
        },
        greenhouse: {
          configured: true,
          needs: ["board token"]
        },
        lever: {
          configured: true,
          needs: ["site slug"]
        },
        ashby: {
          configured: true,
          needs: ["job board name"]
        },
        workable: {
          configured: true,
          needs: ["account subdomain"]
        },
        workday: {
          configured: true,
          needs: ["myworkdayjobs URL or host/tenant/board"]
        },
        smartrecruiters: {
          configured: true,
          needs: ["company identifier"]
        },
        recruitee: {
          configured: true,
          needs: ["company subdomain"]
        },
        personio: {
          configured: true,
          needs: ["jobs.personio host or account slug"]
        },
        bamboohr: {
          configured: true,
          needs: ["company subdomain"]
        },
        "icims-jibe": {
          configured: true,
          needs: ["Jibe careers host"]
        },
        "icims-classic": {
          configured: true,
          needs: ["iCIMS classic careers host"]
        },
        "oracle-ce": {
          configured: true,
          needs: ["Oracle CE host/site"]
        },
        taleo: {
          configured: true,
          needs: ["Taleo host/career section"]
        }
      }
    });
    return;
  }

  const allowedMethods = API_ROUTE_METHODS.get(url.pathname);
  if (allowedMethods) {
    response.setHeader("Allow", allowedMethods.join(", "));
    sendJson(response, 405, {
      error: `${request.method ?? "UNKNOWN"} is not allowed for ${url.pathname}. Use ${allowedMethods.join(" or ")}.`
    });
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    sendJson(response, 404, { error: `API route not found: ${url.pathname}` });
    return;
  }

  await serveStaticAsset(url.pathname, response);
}

function enforceSameOriginApiMutation(request: IncomingMessage, url: URL): void {
  if (!url.pathname.startsWith("/api/") || !isMutatingMethod(request.method)) {
    return;
  }

  const origin = request.headers.origin;
  if (!origin) {
    return;
  }

  const host = request.headers.host;
  if (!host) {
    throw new HttpError(403, "Cross-origin API requests are not allowed.");
  }

  let expectedOrigin: string;
  try {
    expectedOrigin = new URL(`http://${host}`).origin;
  } catch {
    throw new HttpError(403, "Cross-origin API requests are not allowed.");
  }

  if (origin !== expectedOrigin) {
    throw new HttpError(403, "Cross-origin API requests are not allowed.");
  }
}

function isMutatingMethod(method: string | undefined): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes((method ?? "GET").toUpperCase());
}

async function executeSearch(trigger: "manual" | "scheduled"): Promise<SearchOutput> {
  if (runtimeState.running) {
    throw new HttpError(409, "A search run is already in progress.");
  }

  runtimeState.running = true;
  runtimeState.lastError = null;

  try {
    const output = await runListingsSearch();
    runtimeState.lastRunAt = output.generatedAt;
    runtimeState.lastOutput = output;
    await sendAlertWebhooks(output, trigger);
    return output;
  } catch (error) {
    runtimeState.lastError = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    runtimeState.running = false;
    await refreshSchedule();
  }
}

async function refreshSchedule(providedConfig?: JobSourceConfig): Promise<void> {
  if (runtimeState.timer) {
    clearTimeout(runtimeState.timer);
    runtimeState.timer = null;
  }

  const configData = providedConfig ?? (await loadJobSourceConfigOrDefault(config.listings.sourceConfigPath));
  if (!configData.schedule.enabled) {
    runtimeState.nextRunAt = null;
    return;
  }

  const nextRun = computeNextRunAt(configData.schedule, runtimeState.lastRunAt);
  runtimeState.nextRunAt = nextRun.toISOString();

  runtimeState.timer = setTimeout(async () => {
    try {
      await executeSearch("scheduled");
    } catch (error) {
      runtimeState.lastError = error instanceof Error ? error.message : String(error);
      await refreshSchedule();
    }
  }, Math.max(1000, nextRun.getTime() - Date.now()));
}

function computeNextRunAt(
  schedule: JobSourceConfig["schedule"],
  lastRunAt: string | null
): Date {
  const intervalMs = schedule.intervalMinutes * 60 * 1000;
  let nextRun = new Date((lastRunAt ? Date.parse(lastRunAt) : Date.now()) + intervalMs);

  if (!schedule.quietHoursStart || !schedule.quietHoursEnd) {
    return nextRun;
  }

  for (let attempts = 0; attempts < 288; attempts += 1) {
    if (!isQuietHours(nextRun, schedule)) {
      return nextRun;
    }

    nextRun = new Date(nextRun.getTime() + 5 * 60 * 1000);
  }

  return nextRun;
}

function isQuietHours(date: Date, schedule: JobSourceConfig["schedule"]): boolean {
  if (!schedule.quietHoursStart || !schedule.quietHoursEnd) {
    return false;
  }

  const currentMinutes = getMinutesInTimezone(date, schedule.timezone);
  const startMinutes = parseClock(schedule.quietHoursStart);
  const endMinutes = parseClock(schedule.quietHoursEnd);

  if (startMinutes === endMinutes) {
    return false;
  }

  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

function getMinutesInTimezone(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function parseClock(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

async function sendAlertWebhooks(
  output: SearchOutput,
  trigger: "manual" | "scheduled"
): Promise<void> {
  await Promise.all(
    output.alerts
      .filter((alert) => alert.webhookUrl)
      .map((alert) =>
        deliverAlertWebhook(alert.webhookUrl as string, alert.name, {
          trigger,
          generatedAt: output.generatedAt,
          alert: {
            id: alert.id,
            name: alert.name,
            count: alert.count
          },
          listings: alert.listings
        })
      )
  );
}

async function deliverAlertWebhook(
  webhookUrl: string,
  alertName: string,
  payload: unknown
): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ALERT_WEBHOOK_TIMEOUT_MS);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) {
      console.error(
        `Webhook delivery failed for ${alertName}: ${response.status} ${response.statusText}`
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Webhook delivery failed for ${alertName}: ${message}`);
  } finally {
    clearTimeout(timeout);
  }
}

async function loadLatestOutput(): Promise<SearchOutput | null> {
  if (runtimeState.lastOutput) {
    return sanitizeSearchOutput(runtimeState.lastOutput);
  }

  try {
    const raw = await readFile(config.listings.outputPath, "utf8");
    return sanitizeSearchOutput(JSON.parse(raw) as SearchOutput);
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }

    throw error;
  }
}

function sanitizeSearchOutput(output: SearchOutput): SearchOutput {
  return {
    ...output,
    listings: (output.listings ?? []).map(sanitizeListingActionUrls),
    alerts: (output.alerts ?? []).map((alert) => ({
      ...alert,
      listings: (alert.listings ?? []).map(sanitizeListingActionUrls)
    }))
  };
}

async function loadTracker(): Promise<TrackedJob[]> {
  try {
    const raw = await readFile(TRACKER_PATH, "utf8");
    const parsed = JSON.parse(raw) as TrackedJob[];
    return sortTracker(parsed.map(normalizeTrackedJob));
  } catch (error) {
    if (!isMissingFileError(error)) {
      throw error;
    }

    return [];
  }
}

async function saveTracker(jobs: TrackedJob[]): Promise<void> {
  await writeJsonFileAtomically(TRACKER_PATH, sortTracker(jobs));
}

async function runTrackerMutation<T>(mutation: () => Promise<T>): Promise<T> {
  const run = trackerMutationQueue.then(mutation, mutation);
  trackerMutationQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function recordTrackerVisit(body: unknown): Promise<TrackedJob> {
  return runTrackerMutation(async () => {
  const payload = body as { listing?: TrackedJobInput; action?: "open-listing" | "apply" };
  const listing = normalizeTrackedJobInput(payload.listing);
  const action = payload.action === "apply" ? "apply" : "open-listing";

  if (!listing) {
    throw new HttpError(400, "Tracker visit requires a listing with title, company, and HTTP(S) listingUrl.");
  }

  const now = new Date().toISOString();
  const jobs = await loadTracker();
  const id = buildTrackerId(listing);
  const existingIndex = jobs.findIndex((job) => job.id === id);
  const existing = existingIndex >= 0 ? jobs[existingIndex] : undefined;
  const next: TrackedJob = {
    ...(existing ?? {}),
    id,
    provider: listing.provider ?? existing?.provider ?? "unknown",
    title: listing.title,
    company: listing.company,
    location: listing.location ?? existing?.location ?? null,
    employmentType: listing.employmentType ?? existing?.employmentType ?? null,
    listingUrl: listing.listingUrl,
    applyUrl: listing.applyUrl ?? existing?.applyUrl ?? null,
    description: listing.description ?? existing?.description ?? null,
    score: listing.score ?? existing?.score ?? 0,
    sourceRunAt: listing.sourceRunAt ?? existing?.sourceRunAt ?? null,
    firstVisitedAt: existing?.firstVisitedAt ?? now,
    lastVisitedAt: now,
    visitCount: (existing?.visitCount ?? 0) + 1,
    openCount: (existing?.openCount ?? 0) + (action === "open-listing" ? 1 : 0),
    applyClickCount: (existing?.applyClickCount ?? 0) + (action === "apply" ? 1 : 0),
    lastAction: action,
    applied: existing?.applied ?? false,
    appliedAt: existing?.appliedAt ?? null,
    status: normalizeTrackerStatus(existing?.status),
    statusUpdatedAt: existing?.statusUpdatedAt ?? null,
    resumeNotes: existing?.resumeNotes ?? "",
    resumeDraft: existing?.resumeDraft ?? "",
    jobDescriptionOverride: existing?.jobDescriptionOverride ?? "",
    resumeUpdatedAt: existing?.resumeUpdatedAt ?? null
  };

  if (existingIndex >= 0) {
    jobs[existingIndex] = next;
  } else {
    jobs.push(next);
  }

  await saveTracker(jobs);
  return next;
  });
}

async function updateTrackerApplied(body: unknown): Promise<TrackedJob[]> {
  return runTrackerMutation(async () => {
  const payload = body as { id?: string; applied?: boolean };
  if (!payload.id) {
    throw new HttpError(400, "Tracker applied update requires an id.");
  }

  if (typeof payload.applied !== "boolean") {
    throw new HttpError(400, "Tracker applied update requires a boolean applied value.");
  }

  const jobs = await loadTracker();
  const job = jobs.find((entry) => entry.id === payload.id);
  if (!job) {
    throw new HttpError(404, `Tracked job not found: ${payload.id}`);
  }

  const applied = Boolean(payload.applied);
  job.applied = applied;
  job.appliedAt = applied ? job.appliedAt ?? new Date().toISOString() : null;
  await syncAppliedJobsWorkbook(jobs);
  await saveTracker(jobs);
  return sortTracker(jobs);
  });
}

async function updateTrackerStatus(body: unknown): Promise<TrackedJob[]> {
  return runTrackerMutation(async () => {
  const payload = body as { id?: string; status?: string };
  if (!payload.id) {
    throw new HttpError(400, "Tracker status update requires an id.");
  }

  if (!isTrackerStatus(payload.status)) {
    throw new HttpError(400, "Tracker status update requires a known status.");
  }

  const status = normalizeTrackerStatus(payload.status);
  const jobs = await loadTracker();
  const job = jobs.find((entry) => entry.id === payload.id);
  if (!job) {
    throw new HttpError(404, `Tracked job not found: ${payload.id}`);
  }

  job.status = status;
  job.statusUpdatedAt = new Date().toISOString();
  await syncAppliedJobsWorkbook(jobs);
  await saveTracker(jobs);
  return sortTracker(jobs);
  });
}

async function updateTrackerResume(body: unknown): Promise<TrackedJob[]> {
  return runTrackerMutation(async () => {
  const payload = body as {
    id?: string;
    resumeNotes?: string;
    resumeDraft?: string;
    jobDescriptionOverride?: string;
  };
  if (!payload.id) {
    throw new HttpError(400, "Tracker resume update requires an id.");
  }

  const jobs = await loadTracker();
  const job = jobs.find((entry) => entry.id === payload.id);
  if (!job) {
    throw new HttpError(404, `Tracked job not found: ${payload.id}`);
  }

  if (!hasResumeUpdateField(payload)) {
    throw new HttpError(400, "Tracker resume update requires at least one resume text field.");
  }

  assertOptionalTrackerText(payload.resumeNotes, "resumeNotes");
  assertOptionalTrackerText(payload.resumeDraft, "resumeDraft");
  assertOptionalTrackerText(payload.jobDescriptionOverride, "jobDescriptionOverride");

  if (typeof payload.resumeNotes === "string") {
    job.resumeNotes = clampText(payload.resumeNotes, MAX_TRACKER_TEXT_LENGTH);
  }

  if (typeof payload.resumeDraft === "string") {
    job.resumeDraft = clampText(payload.resumeDraft, MAX_TRACKER_TEXT_LENGTH);
  }

  if (typeof payload.jobDescriptionOverride === "string") {
    job.jobDescriptionOverride = clampText(payload.jobDescriptionOverride, MAX_TRACKER_TEXT_LENGTH);
  }

  job.resumeUpdatedAt = new Date().toISOString();
  await saveTracker(jobs);
  return sortTracker(jobs);
  });
}

function hasResumeUpdateField(payload: {
  resumeNotes?: string;
  resumeDraft?: string;
  jobDescriptionOverride?: string;
}): boolean {
  return ["resumeNotes", "resumeDraft", "jobDescriptionOverride"].some((field) =>
    Object.prototype.hasOwnProperty.call(payload, field)
  );
}

function assertOptionalTrackerText(value: unknown, field: string): void {
  if (value !== undefined && typeof value !== "string") {
    throw new HttpError(400, `Tracker resume update field ${field} must be a string.`);
  }
}

async function removeTrackedJob(body: unknown): Promise<TrackedJob[]> {
  return runTrackerMutation(async () => {
  const payload = body as { id?: string };
  if (!payload.id) {
    throw new HttpError(400, "Tracker remove requires an id.");
  }

  const jobs = await loadTracker();
  if (!jobs.some((entry) => entry.id === payload.id)) {
    throw new HttpError(404, `Tracked job not found: ${payload.id}`);
  }

  const remainingJobs = jobs.filter((entry) => entry.id !== payload.id);
  await syncAppliedJobsWorkbook(remainingJobs);
  await saveTracker(remainingJobs);
  return sortTracker(remainingJobs);
  });
}

function buildTrackerId(listing: Pick<TrackedJobInput, "applyUrl" | "listingUrl" | "company" | "title">): string {
  const key = (listing.applyUrl || listing.listingUrl || `${listing.company}:${listing.title}`).toLowerCase();
  return Buffer.from(key).toString("base64url");
}

function sortTracker(jobs: TrackedJob[]): TrackedJob[] {
  return [...jobs].sort((left, right) => trackerTimestamp(right.lastVisitedAt) - trackerTimestamp(left.lastVisitedAt));
}

function normalizeTrackedJob(job: Partial<TrackedJob>): TrackedJob {
  const provider = clampText(job.provider ?? "unknown", MAX_TRACKER_FIELD_LENGTH);
  const title = clampText(job.title ?? "Untitled role", MAX_TRACKER_FIELD_LENGTH);
  const company = clampText(job.company ?? "Unknown company", MAX_TRACKER_FIELD_LENGTH);
  const listingUrl = normalizeHttpUrl(job.listingUrl) ?? "";
  const applyUrl = sanitizeTrackedApplyUrl(provider, normalizeHttpUrl(job.applyUrl));
  const firstVisitedAt = normalizeIsoDate(job.firstVisitedAt) ?? normalizeIsoDate(job.sourceRunAt) ?? "";
  const lastVisitedAt = normalizeIsoDate(job.lastVisitedAt) ?? firstVisitedAt;
  const status = normalizeTrackerStatus(job.status);
  const applied = Boolean(job.applied);

  return {
    ...job,
    id: clampText(
      job.id || buildTrackerId({ applyUrl, listingUrl, company, title }),
      MAX_TRACKER_FIELD_LENGTH
    ),
    provider,
    title,
    company,
    location: nullableClampText(job.location, MAX_TRACKER_FIELD_LENGTH),
    employmentType: nullableClampText(job.employmentType, MAX_TRACKER_FIELD_LENGTH),
    listingUrl,
    applyUrl,
    description: nullableClampText(job.description, MAX_TRACKER_TEXT_LENGTH),
    score: typeof job.score === "number" && Number.isFinite(job.score) ? job.score : 0,
    sourceRunAt: nullableClampText(job.sourceRunAt, MAX_TRACKER_FIELD_LENGTH),
    firstVisitedAt,
    lastVisitedAt,
    visitCount: normalizeCount(job.visitCount),
    openCount: normalizeCount(job.openCount),
    applyClickCount: normalizeCount(job.applyClickCount),
    lastAction: job.lastAction === "apply" ? "apply" : "open-listing",
    applied,
    appliedAt: applied ? normalizeIsoDate(job.appliedAt) : null,
    status,
    statusUpdatedAt: status ? normalizeIsoDate(job.statusUpdatedAt) : null,
    resumeNotes: clampText(job.resumeNotes ?? "", MAX_TRACKER_TEXT_LENGTH),
    resumeDraft: clampText(job.resumeDraft ?? "", MAX_TRACKER_TEXT_LENGTH),
    jobDescriptionOverride: clampText(job.jobDescriptionOverride ?? "", MAX_TRACKER_TEXT_LENGTH),
    resumeUpdatedAt: normalizeIsoDate(job.resumeUpdatedAt)
  };
}

function normalizeTrackedJobInput(input: TrackedJobInput | undefined): NormalizedTrackedJobInput | null {
  if (!input?.title || !input.company || !input.listingUrl) {
    return null;
  }

  const listingUrl = normalizeHttpUrl(input.listingUrl);
  if (!listingUrl) {
    return null;
  }

  return {
    provider: clampText(input.provider ?? "unknown", MAX_TRACKER_FIELD_LENGTH),
    title: clampText(input.title, MAX_TRACKER_FIELD_LENGTH),
    company: clampText(input.company, MAX_TRACKER_FIELD_LENGTH),
    location: nullableClampText(input.location, MAX_TRACKER_FIELD_LENGTH),
    employmentType: nullableClampText(input.employmentType, MAX_TRACKER_FIELD_LENGTH),
    listingUrl,
    applyUrl: sanitizeTrackedApplyUrl(input.provider, normalizeHttpUrl(input.applyUrl)),
    description: nullableClampText(input.description, MAX_TRACKER_TEXT_LENGTH),
    score: typeof input.score === "number" && Number.isFinite(input.score) ? input.score : 0,
    sourceRunAt: nullableClampText(input.sourceRunAt, MAX_TRACKER_FIELD_LENGTH)
  };
}

function normalizeTrackerStatus(status: unknown): TrackedJob["status"] {
  const value = typeof status === "string" ? status.trim().toLowerCase() : "";
  const normalized = LEGACY_TRACKER_STATUS_ALIASES.get(value) ?? value;
  return TRACKER_STATUSES.has(normalized) ? (normalized as TrackedJob["status"]) : "";
}

function isTrackerStatus(status: unknown): boolean {
  if (typeof status !== "string") {
    return false;
  }

  const value = status.trim().toLowerCase();
  if (LEGACY_TRACKER_STATUS_ALIASES.has(value)) {
    return true;
  }

  return TRACKER_STATUSES.has(value);
}

function sanitizeTrackedApplyUrl(provider: string | undefined, applyUrl: string | null): string | null {
  return sanitizeListingActionUrls({
    provider: provider ?? "unknown",
    applyUrl
  }).applyUrl;
}

function normalizeCount(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : 0;
}

function normalizeIsoDate(value: unknown): string | null {
  if (typeof value !== "string" || !value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function trackerTimestamp(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function discoverBoardsFromRequest(body: unknown) {
  if (!body || typeof body !== "object") {
    throw new HttpError(400, "Discover boards request must be a JSON object.");
  }

  const payload = body as {
    urls?: unknown;
    boards?: unknown;
  };

  if (!Array.isArray(payload.urls)) {
    throw new HttpError(400, "Discover boards request requires a urls array.");
  }

  if (payload.urls.length > 200) {
    throw new HttpError(400, "Discover boards request accepts at most 200 URLs.");
  }

  const urls = payload.urls.map((entry) => String(entry ?? ""));
  const boards = Array.isArray(payload.boards)
    ? payload.boards
        .map((entry) => {
          if (!entry || typeof entry !== "object") {
            return null;
          }

          const board = entry as { provider?: unknown; source?: unknown };
          const provider = typeof board.provider === "string" ? board.provider.trim() : "";
          const source = typeof board.source === "string" ? board.source.trim() : "";
          return provider && source ? { provider, source } : null;
        })
        .filter((entry): entry is { provider: string; source: string } => Boolean(entry))
    : [];

  return discoverBoardsFromInput({ urls, boards });
}

function parseWorkbenchConfig(body: unknown): JobSourceConfig {
  try {
    return parseJobSourceConfig(body);
  } catch (error) {
    throw new HttpError(400, error instanceof Error ? error.message : "Invalid job source configuration.");
  }
}

async function syncAppliedJobsWorkbook(jobs: TrackedJob[]): Promise<void> {
  const appliedJobs = sortTracker(jobs).filter((job) => job.applied);
  const rows = [
    ["Date Applied", "Company Name", "Job Title", "Status", "Job URL"],
    ...appliedJobs.map((job) => [
      formatDateForWorkbook(job.appliedAt),
      sanitizeSpreadsheetText(job.company),
      sanitizeSpreadsheetText(job.title),
      sanitizeSpreadsheetText(job.status),
      sanitizeSpreadsheetText(job.listingUrl)
    ])
  ];

  await writeTextFileAtomically(APPLIED_WORKBOOK_PATH, buildExcelXml(rows), "utf8");
}

async function sendAppliedJobsWorkbook(response: ServerResponse): Promise<void> {
  await syncAppliedJobsWorkbook(await loadTracker());
  const workbook = await readFile(APPLIED_WORKBOOK_PATH);
  response.writeHead(200, {
    ...securityHeaders(),
    "Content-Type": "application/vnd.ms-excel; charset=utf-8",
    "Content-Disposition": 'attachment; filename="applied-jobs.xls"'
  });
  response.end(workbook);
}

function buildExcelXml(rows: string[][]): string {
  const columnWidths = [110, 170, 260, 120, 420];
  return `<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n xmlns:o="urn:schemas-microsoft-com:office:office"\n xmlns:x="urn:schemas-microsoft-com:office:excel"\n xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n <Styles>\n  <Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#15303B" ss:Pattern="Solid"/></Style>\n  <Style ss:ID="Text"><Alignment ss:Vertical="Top" ss:WrapText="1"/></Style>\n </Styles>\n <Worksheet ss:Name="Applied Jobs">\n  <Table>\n${columnWidths.map((width) => `   <Column ss:Width="${width}"/>`).join("\n")}\n${rows.map((row, rowIndex) => `   <Row>\n${row.map((value) => `    <Cell ss:StyleID="${rowIndex === 0 ? "Header" : "Text"}"><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`).join("\n")}\n   </Row>`).join("\n")}\n  </Table>\n  <AutoFilter x:Range="R1C1:R${Math.max(rows.length, 1)}C${rows[0]?.length ?? 5}" xmlns="urn:schemas-microsoft-com:office:excel"/>\n </Worksheet>\n</Workbook>\n`;
}

function escapeXml(value: string): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function formatDateForWorkbook(value: string | null): string {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
}

async function serveStaticAsset(pathname: string, response: ServerResponse): Promise<void> {
  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  const assetPath = resolve(UI_DIR, relativePath);
  const hasStaticExtension = Boolean(extname(relativePath));

  try {
    if (!isPathInside(UI_DIR, assetPath)) {
      throw new HttpError(404, "Asset not found.");
    }

    const content = await readFile(assetPath);
    response.writeHead(200, {
      ...securityHeaders(),
      "Content-Type": getContentType(assetPath)
    });
    response.end(content);
  } catch (error) {
    if (hasStaticExtension || error instanceof HttpError) {
      sendText(response, 404, "Asset not found.\n");
      return;
    }

    const fallback = await readFile(resolve(UI_DIR, "index.html"));
    response.writeHead(200, {
      ...securityHeaders(),
      "Content-Type": "text/html; charset=utf-8"
    });
    response.end(fallback);
  }
}

function getContentType(path: string): string {
  const extension = extname(path);

  switch (extension) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    default:
      return "text/html; charset=utf-8";
  }
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > MAX_JSON_BODY_BYTES) {
      throw new HttpError(413, "JSON request body is too large.");
    }
    chunks.push(buffer);
  }

  if (size === 0) {
    throw new HttpError(400, "Request body must not be empty.");
  }

  if (!hasJsonContentType(request)) {
    throw new HttpError(415, "Request body must use application/json.");
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
}

function hasJsonContentType(request: IncomingMessage): boolean {
  const contentType = request.headers["content-type"];
  if (!contentType) {
    return false;
  }

  return contentType
    .split(";")[0]
    .trim()
    .toLowerCase()
    .endsWith("json");
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, {
    ...securityHeaders(),
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function sendText(response: ServerResponse, statusCode: number, text: string): void {
  response.writeHead(statusCode, {
    ...securityHeaders(),
    "Content-Type": "text/plain; charset=utf-8"
  });
  response.end(text);
}

function securityHeaders(): Record<string, string> {
  return {
    "Cache-Control": "no-store",
    "Content-Security-Policy": [
      "default-src 'self'",
      "base-uri 'none'",
      "connect-src 'self'",
      "font-src https://fonts.gstatic.com",
      "form-action 'none'",
      "frame-ancestors 'none'",
      "img-src 'self' data:",
      "object-src 'none'",
      "script-src 'self'",
      "style-src 'self' https://fonts.googleapis.com 'unsafe-inline'"
    ].join("; "),
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY"
  };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

function normalizeHttpUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function readPositiveIntegerEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function clampText(value: unknown, maxLength: number): string {
  return String(value ?? "").slice(0, maxLength);
}

function nullableClampText(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const text = clampText(value, maxLength).trim();
  return text.length > 0 ? text : null;
}

function sanitizeSpreadsheetText(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

function isPathInside(parent: string, child: string): boolean {
  const relationship = relative(parent, child);
  return relationship === "" || (!relationship.startsWith("..") && !relationship.includes(`..${sep}`));
}
