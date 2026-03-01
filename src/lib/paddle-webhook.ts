import { createHmac, timingSafeEqual } from "crypto";

const PADDLE_SIGNATURE_TS = "ts";
const PADDLE_SIGNATURE_H1 = "h1";

/**
 * Parse Paddle-Signature header: "ts=1671552777;h1=eb4d0dc8..."
 */
function parseSignature(header: string): { ts: number; h1: string } | null {
  const parts = header.split(";");
  let ts: number | null = null;
  let h1: string | null = null;
  for (const part of parts) {
    const [key, value] = part.trim().split("=");
    if (key === PADDLE_SIGNATURE_TS) ts = parseInt(value, 10);
    if (key === PADDLE_SIGNATURE_H1) h1 = value;
  }
  if (ts == null || !h1) return null;
  return { ts, h1 };
}

/**
 * Verify Paddle webhook signature. Payload = "ts:rawBody".
 * Reject if timestamp is older than toleranceSeconds (default 300 = 5 min).
 */
export function verifyPaddleSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  secret: string,
  toleranceSeconds = 300
): boolean {
  const trimmedSecret = secret?.trim();
  if (!signatureHeader || !trimmedSecret) return false;
  const parsed = parseSignature(signatureHeader);
  if (!parsed) return false;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parsed.ts) > toleranceSeconds) return false;

  const payload = `${parsed.ts}:${rawBody.toString("utf8")}`;
  const expected = createHmac("sha256", trimmedSecret).update(payload).digest("hex");

  try {
    const a = Buffer.from(parsed.h1, "hex");
    const b = Buffer.from(expected, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
