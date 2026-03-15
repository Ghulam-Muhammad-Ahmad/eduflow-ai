import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";

const PADDLE_API_BASE =
  process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT === "production"
    ? "https://api.paddle.com"
    : "https://sandbox-api.paddle.com";

type PaddleUser = { id: string; email?: string | null; user_metadata?: Record<string, unknown> };

/**
 * Resolves a Paddle customer_id for the caller so checkout can prefill email/name.
 * Uses existing paddle_customer_id from workspace_subscriptions if available, otherwise
 * lists Paddle customers by email or creates one.
 */
async function getOrCreatePaddleCustomerId(
  apiKey: string,
  caller: PaddleUser,
  workspaceId: string | null,
  customerName: string | null
): Promise<string | null> {
  if (!supabaseAdmin) return null;

  // Reuse existing Paddle customer for this workspace if we have one (e.g. from a previous subscription)
  if (workspaceId) {
    const { data: subs } = await supabaseAdmin
      .from("workspace_subscriptions")
      .select("paddle_customer_id")
      .eq("workspace_id", workspaceId)
      .not("paddle_customer_id", "is", null)
      .limit(1);
    const existingId = Array.isArray(subs) && subs[0]?.paddle_customer_id ? subs[0].paddle_customer_id : null;
    if (existingId) return existingId;
  }

  const email = caller.email?.trim();
  if (!email) return null;

  const listRes = await fetch(
    `${PADDLE_API_BASE}/customers?email=${encodeURIComponent(email)}&per_page=1`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
    }
  );
  if (listRes.ok) {
    const listJson = (await listRes.json()) as { data?: Array<{ id: string }> };
    if (Array.isArray(listJson.data) && listJson.data.length > 0) {
      return listJson.data[0].id;
    }
  }

  const createRes = await fetch(`${PADDLE_API_BASE}/customers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      email,
      name: customerName || null,
    }),
  });
  if (!createRes.ok) {
    console.warn("[checkout-url] Paddle create customer failed:", createRes.status, await createRes.text());
    return null;
  }
  const createJson = (await createRes.json()) as { data?: { id: string } };
  return createJson.data?.id ?? null;
}

/**
 * Creates a Paddle transaction and returns the checkout URL.
 * Only workspace owners can start checkout; workspaceId in customData must be owned by the caller.
 * Prefills checkout email/name by linking the transaction to a Paddle customer when possible.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { user: caller, error: authError } = await getAuthUser(req, res);
  if (authError || !caller) {
    return res.status(401).json({ error: authError?.message ?? "Unauthorized" });
  }

  if (!supabaseAdmin) {
    return res.status(503).json({ error: "Server configuration error" });
  }

  const { data: roleRow } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", caller.id)
    .maybeSingle();
  const role = roleRow?.role;
  if (role !== "admin") {
    return res.status(403).json({ error: "Only workspace owners can start checkout" });
  }

  const apiKey = process.env.PADDLE_API_KEY?.trim();
  if (!apiKey) {
    console.error("[checkout-url] PADDLE_API_KEY not set");
    return res.status(500).json({ error: "Checkout not configured" });
  }

  const body = req.body as {
    priceId?: string;
    successUrl?: string;
    customData?: Record<string, string>;
  };
  const priceId = body?.priceId?.trim();
  if (!priceId) {
    return res.status(400).json({ error: "priceId is required" });
  }

  const customData = body.customData ?? {};
  const workspaceId = customData.workspaceId ?? customData.workspace_id ?? null;
  if (workspaceId) {
    const { data: workspace } = await supabaseAdmin
      .from("workspaces")
      .select("id")
      .eq("id", workspaceId)
      .eq("owner_id", caller.id)
      .maybeSingle();
    if (!workspace) {
      return res.status(403).json({ error: "Workspace not found or you are not the owner" });
    }
  }

  // Resolve customer name for prefill (profile display_name or auth user_metadata)
  let customerName: string | null = null;
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("display_name")
    .eq("user_id", caller.id)
    .maybeSingle();
  if (profile?.display_name?.trim()) {
    customerName = profile.display_name.trim();
  } else {
    const meta = caller.user_metadata as Record<string, unknown> | undefined;
    const full = (meta?.full_name as string) ?? (meta?.name as string);
    if (typeof full === "string" && full.trim()) customerName = full.trim();
  }

  const customerId = await getOrCreatePaddleCustomerId(
    apiKey,
    caller,
    workspaceId,
    customerName
  );

  const payload: {
    items: Array<{ price_id: string; quantity: number }>;
    custom_data: Record<string, string>;
    collection_mode: "automatic";
    checkout: { url: null };
    customer_id?: string;
  } = {
    items: [{ price_id: priceId, quantity: 1 }],
    custom_data: customData,
    collection_mode: "automatic",
    checkout: {
      url: null,
    },
  };
  if (customerId) payload.customer_id = customerId;

  const response = await fetch(`${PADDLE_API_BASE}/transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("[checkout-url] Paddle API error:", response.status, errText);
    return res.status(response.status).json({
      error: "Failed to create checkout",
      details: response.status === 401 ? "Invalid PADDLE_API_KEY" : undefined,
    });
  }

  const data = (await response.json()) as {
    data?: {
      id?: string;
      checkout?: { url?: string };
    };
  };
  const url = data?.data?.checkout?.url ?? null;
  if (!url) {
    return res.status(500).json({ error: "No checkout URL in response" });
  }

  const successUrl = body.successUrl?.trim();
  const finalUrl = successUrl ? `${url}${url.includes("?") ? "&" : "?"}success_url=${encodeURIComponent(successUrl)}` : url;

  return res.status(200).json({ url: finalUrl, transactionId: data?.data?.id });
}
