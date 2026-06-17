import { detectCompanyBoardSource } from "./source-discovery.js";
import type { CompanyBoardRequest } from "./types.js";

export interface DiscoverBoardsInput {
  urls: string[];
  boards?: Array<{ provider: string; source: string }>;
}

export interface DiscoveredBoardEntry {
  line: string;
  url: string;
  provider: string;
  source: string;
}

export interface DiscoverBoardsResult {
  detected: DiscoveredBoardEntry[];
  duplicate: DiscoveredBoardEntry[];
  unknown: Array<{ line: string; url?: string }>;
}

export function discoverBoardsFromInput(input: DiscoverBoardsInput): DiscoverBoardsResult {
  const existingKeys = new Set(
    (input.boards ?? []).map((board) => boardKey(board.provider, board.source))
  );
  const seenKeys = new Set(existingKeys);
  const detected: DiscoveredBoardEntry[] = [];
  const duplicate: DiscoveredBoardEntry[] = [];
  const unknown: Array<{ line: string; url?: string }> = [];

  for (const line of input.urls) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const board = detectCompanyBoardSource(trimmed);
    if (!board) {
      unknown.push({
        line: trimmed,
        url: looksLikeHttpUrl(trimmed) ? trimmed : undefined
      });
      continue;
    }

    const entry = toDiscoveredEntry(trimmed, board);
    const key = boardKey(entry.provider, entry.source);
    if (existingKeys.has(key) || seenKeys.has(key)) {
      duplicate.push(entry);
      continue;
    }

    detected.push(entry);
    seenKeys.add(key);
  }

  return { detected, duplicate, unknown };
}

function toDiscoveredEntry(line: string, board: CompanyBoardRequest): DiscoveredBoardEntry {
  return {
    line,
    url: line,
    provider: board.provider,
    source: board.source
  };
}

function boardKey(provider: string, source: string): string {
  return `${provider}:${source}`;
}

function looksLikeHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}
