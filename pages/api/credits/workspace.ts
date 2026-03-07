import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";

/**
 * GET — returns workspace credit summary for the caller's owned workspace.
 * Only workspace owners can see this. Credits come from Paddle; owner assigns to tutors/students;
 * all usage (owner, tutors, students) deducts from the same workspace pool.
 */
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

  const { data: workspace } = await supabaseAdmin
    .from("workspaces")
    .select("id")
    .eq("owner_id", caller.id)
    .limit(1)
    .maybeSingle();

  const workspaceId = workspace?.id ?? null;
  if (!workspaceId) {
    return res.status(403).json({ error: "No workspace found" });
  }

  const periodStart = new Date();
  periodStart.setUTCDate(1);
  periodStart.setUTCHours(0, 0, 0, 0);
  const periodStr = periodStart.toISOString().slice(0, 10);

  const { data: pool, error: poolError } = await supabaseAdmin
    .from("workspace_credit_pools")
    .select("credits_allocated, credits_assigned_out, credits_used_direct")
    .eq("workspace_id", workspaceId)
    .eq("period", periodStr)
    .maybeSingle();

  if (poolError) {
    console.error("[credits/workspace] pool select error:", poolError);
    return res.status(500).json({ error: "Failed to load workspace credits" });
  }

  const creditsAllocated = pool?.credits_allocated ?? 0;
  const creditsAssignedOut = pool?.credits_assigned_out ?? 0;
  const creditsUsedDirect = pool?.credits_used_direct ?? 0;

  const { data: memberUsageRows, error: memberError } = await supabaseAdmin
    .from("user_credit_allocations")
    .select("credits_used")
    .eq("period", periodStr)
    .eq("source_type", "workspace")
    .eq("source_id", workspaceId);

  if (memberError) {
    console.error("[credits/workspace] member usage select error:", memberError);
    return res.status(500).json({ error: "Failed to load member usage" });
  }

  const creditsUsedByMembers =
    (memberUsageRows ?? []).reduce((sum, row) => sum + (row.credits_used ?? 0), 0);

  const totalUsed = creditsUsedDirect + creditsUsedByMembers;
  const remaining = Math.max(0, creditsAllocated - totalUsed);

  return res.status(200).json({
    creditsAllocated,
    creditsAssignedOut,
    creditsUsedDirect,
    creditsUsedByMembers,
    totalUsed,
    remaining,
    period: periodStr,
  });
}
