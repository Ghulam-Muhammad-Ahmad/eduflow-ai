import { describe, expect, it } from "vitest";

import { resolveHiddenNavKeys } from "@/lib/studentNav";

describe("resolveHiddenNavKeys", () => {
  it("hides nothing when neither a default nor an override is set", () => {
    expect(resolveHiddenNavKeys(undefined, null)).toEqual(new Set());
  });

  it("falls back to the workspace default when no override is set", () => {
    expect(resolveHiddenNavKeys(["billing", "study"], null)).toEqual(new Set(["billing", "study"]));
    expect(resolveHiddenNavKeys(["billing"], undefined)).toEqual(new Set(["billing"]));
  });

  it("an explicit empty override means show everything, and does not fall back to the default", () => {
    expect(resolveHiddenNavKeys(["billing", "study"], [])).toEqual(new Set());
  });

  it("a non-empty override wins over a conflicting workspace default", () => {
    expect(resolveHiddenNavKeys(["billing", "study"], ["quizzes"])).toEqual(new Set(["quizzes"]));
  });
});
