/**
 * Format and parse numeric amounts with thousand separators (e.g. 1,234.56).
 * Use for amount/price inputs and display.
 */

/**
 * Format a number for display with thousand separators.
 * e.g. 1234.5 -> "1,234.5", 1000000 -> "1,000,000"
 */
export function formatAmountForDisplay(value: number | string): string {
  if (value === "" || value === undefined || value === null) return "";
  const n = typeof value === "string" ? parseFloat(value.replace(/,/g, "")) : value;
  if (Number.isNaN(n)) return "";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/**
 * Format a raw input string (digits and one dot) for display with thousand separators.
 * Preserves trailing dot so user can type "1000." without it being lost.
 */
export function formatAmountInput(raw: string): string {
  const cleaned = raw.replace(/,/g, "").trim();
  if (cleaned === "" || cleaned === ".") return cleaned;
  const num = parseFloat(cleaned);
  if (Number.isNaN(num) && !cleaned.endsWith(".")) return raw;
  if (cleaned.endsWith(".")) return formatAmountForDisplay(num) + ".";
  return formatAmountForDisplay(num);
}

/**
 * Parse a display string (possibly with commas) to a number.
 * Returns 0 for empty or invalid input.
 */
export function parseAmountFromDisplay(value: string): number {
  if (!value || typeof value !== "string") return 0;
  const cleaned = value.replace(/,/g, "").trim();
  if (cleaned === "" || cleaned === ".") return 0;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Restrict input to at most one decimal point and digits only.
 * Use in onChange to clean before setting state.
 */
export function cleanAmountInput(input: string): string {
  const noCommas = input.replace(/,/g, "");
  const parts = noCommas.split(".");
  if (parts.length > 2) return parts[0] + "." + parts.slice(1).join("");
  const digitsAndDot = noCommas.replace(/[^0-9.]/g, "");
  if (digitsAndDot.indexOf(".") !== digitsAndDot.lastIndexOf(".")) {
    const firstDot = digitsAndDot.indexOf(".");
    return digitsAndDot.slice(0, firstDot + 1) + digitsAndDot.slice(firstDot + 1).replace(/\./g, "");
  }
  return digitsAndDot;
}
