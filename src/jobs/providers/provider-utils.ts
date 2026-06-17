export function joinTextParts(parts: Array<string | null | undefined>, separator = ", "): string | null {
  const value = parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(separator);

  return value || null;
}

export function asAbsoluteUrl(value: string | null | undefined, baseUrl: string): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

export function isRemoteText(value: string | null | undefined): boolean | null {
  if (!value) {
    return null;
  }

  return /\bremote\b/i.test(value);
}

export function compactHtmlSections(sections: Array<string | null | undefined>): string | null {
  return joinTextParts(sections, "\n\n");
}

export function stripHtml(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return decodeHtml(value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim() || null;
}

export function decodeHtml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#039;/g, "'")
    .replace(/&nbsp;/g, " ");
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function mapInBatches<T, U>(
  items: T[],
  batchSize: number,
  mapper: (item: T) => Promise<U>
): Promise<U[]> {
  const results: U[] = [];

  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    results.push(...await Promise.all(batch.map(mapper)));
  }

  return results;
}
