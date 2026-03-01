import type { NextApiRequest, NextApiResponse } from "next";
import { Readable } from "stream";
import { verifyPaddleSignature } from "@/lib/paddle-webhook";
import { supabaseAdmin } from "@/integrations/supabase/admin";

export const config = {
  api: { bodyParser: false },
};

async function getRawBody(readable: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

type PaddleSubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "inactive";

function mapPaddleStatus(s: string): PaddleSubscriptionStatus {
  const lower = (s || "").toLowerCase();
  if (["active", "trialing", "past_due", "canceled", "inactive"].includes(lower))
    return lower as PaddleSubscriptionStatus;
  return "inactive";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET" || req.method === "HEAD") {
    return res.status(200).json({ ok: true, message: "Paddle webhook endpoint" });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, HEAD, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = process.env.PADDLE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.error("[paddle-webhook] PADDLE_WEBHOOK_SECRET not set");
    return res.status(500).json({ error: "Webhook not configured" });
  }

  const rawBody = await getRawBody(req as unknown as Readable);
  const signature =
    (req.headers["paddle-signature"] as string | undefined) ??
    (req.headers["Paddle-Signature"] as string | undefined);

  if (!verifyPaddleSignature(rawBody, signature, secret)) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[paddle-webhook] Signature verification failed:",
        "headerPresent:",
        !!signature,
        "bodyLength:",
        rawBody.length,
        "bodyStartsWith:",
        rawBody.slice(0, 50).toString("utf8")
      );
    }
    return res.status(401).json({ error: "Invalid signature" });
  }

  let payload: {
    event_type?: string;
    event_id?: string;
    data?: {
      id?: string;
      status?: string;
      custom_data?: Record<string, string>;
      customer_id?: string;
      next_billed_at?: string;
      current_billing_period?: { ends_at?: string };
      items?: Array<{ price?: { id?: string } }>;
    };
  };

  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  const eventType = payload?.event_type ?? (payload as { event_id?: string }).event_id;
  if (!eventType) {
    return res.status(200).json({ success: true });
  }

  const data = payload.data;
  let customData = (data?.custom_data || {}) as Record<string, string>;
  let workspaceId = customData.workspaceId || customData.workspace_id;
  let userId = customData.userId || customData.user_id;

  const subscriptionEvents = [
    "subscription.created",
    "subscription.updated",
    "subscription.activated",
    "subscription.trialing",
    "subscription.canceled",
    "subscription.past_due",
  ];
  const isSubEvent = subscriptionEvents.some((e) => eventType.startsWith(e));
  const transactionId = (data as { transaction_id?: string })?.transaction_id;

  if (isSubEvent && (!workspaceId || !userId) && transactionId && process.env.PADDLE_API_KEY) {
    try {
      const paddleBase =
        process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT === "production"
          ? "https://api.paddle.com"
          : "https://sandbox-api.paddle.com";
      const txRes = await fetch(
        `${paddleBase}/transactions/${encodeURIComponent(transactionId)}`,
        {
          headers: { Authorization: `Bearer ${process.env.PADDLE_API_KEY}` },
        }
      );
      if (txRes.ok) {
        const txJson = (await txRes.json()) as { data?: { custom_data?: Record<string, string> } };
        const txCustom = txJson?.data?.custom_data;
        if (txCustom && typeof txCustom === "object") {
          customData = txCustom as Record<string, string>;
          workspaceId = workspaceId || customData.workspaceId || customData.workspace_id;
          userId = userId || customData.userId || customData.user_id;
        }
      }
    } catch (e) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[paddle-webhook] Failed to fetch transaction for custom_data:", e);
      }
    }
  }

  if (process.env.NODE_ENV === "development") {
    console.info("[paddle-webhook]", eventType, "workspaceId:", workspaceId ?? "(none)", "userId:", userId ?? "(none)");
  }

  const admin = supabaseAdmin;
  if (!admin) {
    console.error("[paddle-webhook] Supabase admin client not available (SUPABASE_SERVICE_ROLE_KEY)");
    return res.status(500).json({ error: "Server error" });
  }

  const subscriptionId = data?.id ?? null;
  const customerId = data?.customer_id ?? null;
  const priceId = data?.items?.[0]?.price?.id ?? null;
  const status = mapPaddleStatus(data?.status ?? "inactive");
  const periodEndsAt =
    (data?.current_billing_period as { ends_at?: string } | undefined)?.ends_at ??
    (data as { next_billed_at?: string })?.next_billed_at ??
    null;
  const trialEndsAt = (data as { trial_dates?: { ends_at?: string } })?.trial_dates?.ends_at ?? null;

  if (isSubEvent) {
    if (workspaceId) {
      const { error } = await admin
        .from("workspace_subscriptions")
        .upsert(
          {
            workspace_id: workspaceId,
            paddle_subscription_id: subscriptionId,
            paddle_customer_id: customerId,
            price_id: priceId,
            status,
            current_period_ends_at: periodEndsAt,
            trial_ends_at: trialEndsAt,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "workspace_id" }
        );
      if (error) {
        console.error("[paddle-webhook] workspace_subscriptions upsert error:", error);
        return res.status(500).json({ error: "Database error" });
      }
    }
    if (userId) {
      const { error } = await admin
        .from("user_subscriptions")
        .upsert(
          {
            user_id: userId,
            paddle_subscription_id: subscriptionId,
            paddle_customer_id: customerId,
            price_id: priceId,
            status,
            current_period_ends_at: periodEndsAt,
            trial_ends_at: trialEndsAt,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
      if (error) {
        console.error("[paddle-webhook] user_subscriptions upsert error:", error);
        return res.status(500).json({ error: "Database error" });
      }
    }
  }

  return res.status(200).json({ success: true });
}
