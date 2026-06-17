import { readFile } from "node:fs/promises";
import { writeJsonFileAtomically } from "./atomic-file.js";

export interface RunState {
  seenJobs: Record<string, string>;
  appliedJobs: Record<string, string>;
  skippedJobs: Record<string, string>;
  pendingReviewJobs: Record<string, string>;
}

const emptyState = (): RunState => ({
  seenJobs: {},
  appliedJobs: {},
  skippedJobs: {},
  pendingReviewJobs: {}
});

export async function loadState(stateFilePath: string): Promise<RunState> {
  try {
    const raw = await readFile(stateFilePath, "utf8");
    return { ...emptyState(), ...JSON.parse(raw) } as RunState;
  } catch (error) {
    if (isMissingFileError(error)) {
      return emptyState();
    }

    throw error;
  }
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

export async function saveState(
  stateFilePath: string,
  state: RunState
): Promise<void> {
  await writeJsonFileAtomically(stateFilePath, state);
}
