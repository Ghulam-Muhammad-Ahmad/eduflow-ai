import type { NextApiRequest } from "next";
import { afterEach, describe, expect, it } from "vitest";

import { getConfiguredRedirectUri } from "@/server/google-calendar";

/** Minimal stand-in for the only part of the request the helper reads. */
function reqWith(headers: Record<string, string | string[]>) {
  return { headers } as unknown as NextApiRequest;
}

const ORIGINAL_ENV = process.env.GOOGLE_OAUTH_REDIRECT_URI;

afterEach(() => {
  if (ORIGINAL_ENV === undefined) delete process.env.GOOGLE_OAUTH_REDIRECT_URI;
  else process.env.GOOGLE_OAUTH_REDIRECT_URI = ORIGINAL_ENV;
});

describe("getConfiguredRedirectUri", () => {
  it("returns to the production domain the flow started on", () => {
    expect(
      getConfiguredRedirectUri(
        reqWith({ host: "app.edulabloom.com", "x-forwarded-proto": "https" })
      )
    ).toBe("https://app.edulabloom.com/api/google/callback");
  });

  it("ignores a stale localhost value in GOOGLE_OAUTH_REDIRECT_URI", () => {
    // The original bug: this env var was deployed to production, so Google sent
    // every user back to localhost:3000.
    process.env.GOOGLE_OAUTH_REDIRECT_URI = "http://localhost:3000/api/google/callback/";

    expect(
      getConfiguredRedirectUri(
        reqWith({ host: "app.edulabloom.com", "x-forwarded-proto": "https" })
      )
    ).toBe("https://app.edulabloom.com/api/google/callback");
  });

  it("prefers x-forwarded-host and takes the first value of a list", () => {
    expect(
      getConfiguredRedirectUri(
        reqWith({
          host: "internal-abc.vercel.app",
          "x-forwarded-host": "app.edulabloom.com, internal-abc.vercel.app",
          "x-forwarded-proto": "https,http",
        })
      )
    ).toBe("https://app.edulabloom.com/api/google/callback");
  });

  it("follows a Vercel preview deployment host", () => {
    expect(
      getConfiguredRedirectUri(
        reqWith({ host: "eduflow-ai-git-feature-acme.vercel.app", "x-forwarded-proto": "https" })
      )
    ).toBe("https://eduflow-ai-git-feature-acme.vercel.app/api/google/callback");
  });

  it("uses http for local development hosts when no proto header is present", () => {
    expect(getConfiguredRedirectUri(reqWith({ host: "localhost:3000" }))).toBe(
      "http://localhost:3000/api/google/callback"
    );
    expect(getConfiguredRedirectUri(reqWith({ host: "127.0.0.1:3000" }))).toBe(
      "http://127.0.0.1:3000/api/google/callback"
    );
  });

  it("defaults to https for a non-local host with no proto header", () => {
    expect(getConfiguredRedirectUri(reqWith({ host: "app.edulabloom.com" }))).toBe(
      "https://app.edulabloom.com/api/google/callback"
    );
  });

  it("falls back to the env var, trimmed of trailing slashes, when no host is present", () => {
    process.env.GOOGLE_OAUTH_REDIRECT_URI = "https://app.edulabloom.com/api/google/callback/";
    expect(getConfiguredRedirectUri(reqWith({}))).toBe(
      "https://app.edulabloom.com/api/google/callback"
    );
  });

  it("throws when neither a host nor the env var is available", () => {
    delete process.env.GOOGLE_OAUTH_REDIRECT_URI;
    expect(() => getConfiguredRedirectUri(reqWith({}))).toThrow(
      /Unable to determine Google OAuth redirect URI/
    );
  });
});
