import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

/**
 * Fallback list for runtimes without `Intl.supportedValuesOf` (older Safari).
 * Deliberately small — it only needs to keep the picker usable, not exhaustive.
 */
const FALLBACK_ZONES = [
  "UTC",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Istanbul",
  "Africa/Lagos",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Australia/Sydney",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "America/Toronto",
];

export const DEFAULT_TIMEZONE = "UTC";

/** Every IANA zone this runtime knows about, for the timezone pickers. */
export const TIMEZONES: string[] = (() => {
  const supported = (
    Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
  ).supportedValuesOf;
  try {
    const zones = supported?.("timeZone");
    if (zones?.length) return zones;
  } catch {
    // fall through
  }
  return FALLBACK_ZONES;
})();

/** True if the runtime recognises `tz` as an IANA timezone. */
export function isValidTimezone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The viewer's own timezone, for defaulting a picker when nothing else is set. */
export function resolveBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

/**
 * Convert a `<input type="datetime-local">` value ("YYYY-MM-DDTHH:mm") read as
 * wall-clock time in `tz` into the UTC instant to persist.
 */
export function wallClockToUtcIso(value: string, tz: string): string {
  return fromZonedTime(value, isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE).toISOString();
}

/**
 * Inverse of `wallClockToUtcIso` — render a stored UTC instant as the wall-clock
 * string a `datetime-local` input expects, in `tz`.
 */
export function utcIsoToWallClock(iso: string, tz: string): string {
  return formatInTimeZone(
    new Date(iso),
    isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE,
    "yyyy-MM-dd'T'HH:mm"
  );
}

/** Format a stored UTC instant for display in `tz`. */
export function formatInZone(iso: string, tz: string | null | undefined, pattern: string): string {
  const zone = isValidTimezone(tz) ? tz : resolveBrowserTimezone();
  return formatInTimeZone(new Date(iso), zone, pattern);
}
