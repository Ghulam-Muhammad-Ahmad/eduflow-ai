import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";

const PADDLE_API_BASE =
  process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT === "production"
    ? "https://api.paddle.com"
    : "https://sandbox-api.paddle.com";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.PADDLE_API_KEY?.trim();
  if (!apiKey) {
    console.error("[portal-session] PADDLE_API_KEY not set");
    return res.status(500).json({ error: "Portal not configured" });
  }

  const { user, error: authError } = await getAuthUser(req, res);
  if (authError || !user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const admin = supabaseAdmin;
  if (!admin) {
    return res.status(500).json({ error: "Server error" });
  }

  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : null;

  let paddleCustomerId: string | null = null;
  let paddleSubscriptionId: string | null = null;

  if (workspaceId) {
    const [memberResult, workspaceResult] = await Promise.all([
      admin
        .from("workspace_members")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("user_id", user.id)
        .maybeSingle(),
      admin
        .from("workspaces")
        .select("owner_id")
        .eq("id", workspaceId)
        .maybeSingle(),
    ]);
    const isMember = !!memberResult.data;
    const isOwner = workspaceResult.data?.owner_id === user.id;
    if (!isMember && !isOwner) {
      return res.status(403).json({ error: "Not a member of this workspace" });
    }
    const { data: sub, error: subError } = await admin
      .from("workspace_subscriptions")
      .select("paddle_customer_id, paddle_subscription_id")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (subError || !sub) {
      return res.status(404).json({ error: "No subscription found for this workspace" });
    }
    paddleCustomerId = sub.paddle_customer_id;
    paddleSubscriptionId = sub.paddle_subscription_id;
  } else {
    const { data: sub, error: subError } = await admin
      .from("user_subscriptions")
      .select("paddle_customer_id, paddle_subscription_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (subError || !sub) {
      return res.status(404).json({ error: "No subscription found for your account" });
    }
    paddleCustomerId = sub.paddle_customer_id;
    paddleSubscriptionId = sub.paddle_subscription_id;
  }

  if (!paddleCustomerId) {
    return res.status(404).json({ error: "Subscription has no customer ID" });
  }

  const body: { subscription_ids?: string[] } = {};
  if (paddleSubscriptionId) {
    body.subscription_ids = [paddleSubscriptionId];
  }

  const response = await fetch(
    `${PADDLE_API_BASE}/customers/${encodeURIComponent(paddleCustomerId)}/portal-sessions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error("[portal-session] Paddle API error:", response.status, errText);
    return res.status(response.status).json({
      error: "Failed to create portal session",
      details: response.status === 401 ? "Invalid PADDLE_API_KEY" : undefined,
    });
  }

  const data = (await response.json()) as {
    data?: {
      urls?: { general?: { overview?: string } };
    };
  };
  const url = data?.data?.urls?.general?.overview ?? null;
  if (!url) {
    return res.status(500).json({ error: "Invalid portal session response" });
  }

  return res.status(200).json({ url });
}
