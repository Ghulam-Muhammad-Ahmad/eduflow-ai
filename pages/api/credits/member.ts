import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";

/** GET ?memberUserId=... — returns { creditsLimit, creditsUsed } for that member in caller's workspace. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { user: caller, error: authError } = await getAuthUser(req, res);
  if (authError || !caller) {
    return res.status(401).json({ error: authError?.message ?? "Unauthorized" });
  }

  if (!supabaseAdmin) {
    return res.status(503).json({ error: "Server configuration error" });
  }

  const memberUserId = typeof req.query.memberUserId === "string" ? req.query.memberUserId.trim() : null;
  if (!memberUserId) {
    return res.status(400).json({ error: "memberUserId is required" });
  }

  const { data: ownerWs } = await supabaseAdmin
    .from("workspaces")
    .select("id")
    .eq("owner_id", caller.id)
    .limit(1)
    .maybeSingle();
  const { data: memberRow } = await supabaseAdmin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", caller.id)
    .limit(1)
    .maybeSingle();

  const workspaceId = ownerWs?.id ?? memberRow?.workspace_id ?? null;
  if (!workspaceId) {
    return res.status(403).json({ error: "No workspace found" });
  }

  const periodStart = new Date();
  periodStart.setUTCDate(1);
  periodStart.setUTCHours(0, 0, 0, 0);
  const periodStr = periodStart.toISOString().slice(0, 10);

  const { data: alloc, error } = await supabaseAdmin
    .from("user_credit_allocations")
    .select("credits_limit, credits_used")
    .eq("user_id", memberUserId)
    .eq("period", periodStr)
    .eq("source_type", "workspace")
    .eq("source_id", workspaceId)
    .maybeSingle();

  if (error) {
    console.error("[credits/member] select error:", error);
    return res.status(500).json({ error: "Failed to load member credits" });
  }

  return res.status(200).json({
    creditsLimit: alloc?.credits_limit ?? 0,
    creditsUsed: alloc?.credits_used ?? 0,
    remaining: Math.max(0, (alloc?.credits_limit ?? 0) - (alloc?.credits_used ?? 0)),
  });
}
