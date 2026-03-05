import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";

const PADDLE_API_BASE =
  process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT === "production"
    ? "https://api.paddle.com"
    : "https://sandbox-api.paddle.com";

/**
 * Creates a Paddle transaction and returns the checkout URL.
 * Only workspace owners can start checkout; workspaceId in customData must be owned by the caller.
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

  const payload = {
    items: [{ price_id: priceId, quantity: 1 }],
    custom_data: customData,
    collection_mode: "automatic" as const,
    checkout: {
      url: null,
    },
  };

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
