import { describe, expect, it } from "vitest";

import {
  formatInZone,
  isValidTimezone,
  utcIsoToWallClock,
  wallClockToUtcIso,
} from "@/lib/timezone";
import { buildRecurringOccurrences } from "@/server/lecture-sessions";

describe("timezone helpers", () => {
  it("reads a datetime-local value as wall-clock time in the given zone", () => {
    // 09:00 in London on 15 Jan is GMT (UTC+0).
    expect(wallClockToUtcIso("2026-01-15T09:00", "Europe/London")).toBe("2026-01-15T09:00:00.000Z");
    // The same wall clock in July is BST (UTC+1).
    expect(wallClockToUtcIso("2026-07-15T09:00", "Europe/London")).toBe("2026-07-15T08:00:00.000Z");
    // Karachi is a fixed UTC+5 with no DST.
    expect(wallClockToUtcIso("2026-07-15T09:00", "Asia/Karachi")).toBe("2026-07-15T04:00:00.000Z");
  });

  it("round-trips a wall-clock value through UTC and back", () => {
    for (const [wallClock, tz] of [
      ["2026-01-15T09:00", "Europe/London"],
      ["2026-07-15T09:00", "Europe/London"],
      ["2026-03-10T14:30", "America/New_York"],
      ["2026-11-02T23:45", "Asia/Tokyo"],
    ] as const) {
      expect(utcIsoToWallClock(wallClockToUtcIso(wallClock, tz), tz)).toBe(wallClock);
    }
  });

  it("falls back to UTC for an unrecognised zone rather than throwing", () => {
    expect(isValidTimezone("Not/AZone")).toBe(false);
    expect(wallClockToUtcIso("2026-01-15T09:00", "Not/AZone")).toBe("2026-01-15T09:00:00.000Z");
  });

  it("formats an instant in the session's own zone", () => {
    const iso = "2026-07-15T08:00:00.000Z";
    expect(formatInZone(iso, "Europe/London", "yyyy-MM-dd HH:mm")).toBe("2026-07-15 09:00");
    expect(formatInZone(iso, "Asia/Karachi", "yyyy-MM-dd HH:mm")).toBe("2026-07-15 13:00");
  });
});

describe("buildRecurringOccurrences", () => {
  it("keeps the local wall-clock time across a DST boundary", () => {
    // 09:00 London on 22 Mar 2026 is GMT; BST starts on 29 Mar, so occurrence 2 must
    // still be 09:00 local even though the UTC instant shifts by an hour.
    const startsAt = wallClockToUtcIso("2026-03-22T09:00", "Europe/London");
    const endsAt = wallClockToUtcIso("2026-03-22T10:00", "Europe/London");

    const occurrences = buildRecurringOccurrences({
      startsAt,
      endsAt,
      frequency: "weekly",
      interval: 1,
      occurrencesCount: 3,
      timezone: "Europe/London",
    });

    expect(
      occurrences.map((o) => formatInZone(o.startsAt, "Europe/London", "yyyy-MM-dd HH:mm"))
    ).toEqual(["2026-03-22 09:00", "2026-03-29 09:00", "2026-04-05 09:00"]);

    // The instants themselves differ by 168h then 167h — that is the DST correction.
    expect(occurrences[1].startsAt).toBe("2026-03-29T08:00:00.000Z");
  });

  it("preserves the session duration on every occurrence", () => {
    const startsAt = wallClockToUtcIso("2026-03-22T09:00", "Europe/London");
    const endsAt = wallClockToUtcIso("2026-03-22T10:30", "Europe/London");

    const occurrences = buildRecurringOccurrences({
      startsAt,
      endsAt,
      frequency: "daily",
      interval: 1,
      occurrencesCount: 3,
      timezone: "Europe/London",
    });

    for (const occurrence of occurrences) {
      const durationMs =
        new Date(occurrence.endsAt).getTime() - new Date(occurrence.startsAt).getTime();
      expect(durationMs).toBe(90 * 60 * 1000);
    }
  });

  it("defaults to UTC when no timezone is given", () => {
    const occurrences = buildRecurringOccurrences({
      startsAt: "2026-03-22T09:00:00.000Z",
      endsAt: "2026-03-22T10:00:00.000Z",
      frequency: "weekly",
      interval: 1,
      occurrencesCount: 2,
    });

    expect(occurrences[1].startsAt).toBe("2026-03-29T09:00:00.000Z");
  });
});
