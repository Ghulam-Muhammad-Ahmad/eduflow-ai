/**
 * Parse a page range string (e.g. "1-3, 8, 10-12") into a sorted array of 1-based page numbers.
 * Returns null if the string is invalid.
 */
export function parsePageRange(input: string): number[] | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const seen = new Set<number>();
  const parts = trimmed.split(/[\s,]+/);

  for (const part of parts) {
    const dash = part.indexOf("-");
    if (dash === -1) {
      const n = parseInt(part, 10);
      if (!Number.isInteger(n) || n < 1) return null;
      seen.add(n);
    } else {
      const a = parseInt(part.slice(0, dash), 10);
      const b = parseInt(part.slice(dash + 1), 10);
      if (!Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b < 1 || a > b) return null;
      for (let i = a; i <= b; i++) seen.add(i);
    }
  }

  if (seen.size === 0) return null;
  return Array.from(seen).sort((x, y) => x - y);
}

/** Max pages allowed in a single split to avoid timeouts. */
export const MAX_PAGES_PER_SPLIT = 500;

/**
 * Validate parsed page numbers against document page count.
 * Returns { ok: true, pages } or { ok: false, error }.
 */
export function validatePageNumbers(
  pages: number[],
  numPages: number,
  maxPages: number = MAX_PAGES_PER_SPLIT
): { ok: true; pages: number[] } | { ok: false; error: string } {
  if (pages.length === 0) return { ok: false, error: "Select at least one page." };
  if (pages.length > maxPages) return { ok: false, error: `Maximum ${maxPages} pages per split.` };
  const outOfRange = pages.find((p) => p < 1 || p > numPages);
  if (outOfRange != null)
    return { ok: false, error: `Page ${outOfRange} is out of range (1–${numPages}).` };
  return { ok: true, pages };
}
