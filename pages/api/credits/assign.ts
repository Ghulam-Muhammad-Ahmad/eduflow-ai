import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";

/**
 * POST: assign credits to a member (body: { memberUserId, credits }).
 * PATCH: update assigned credit limit (body: { memberUserId, creditsLimit }).
 * Caller must be owner or tutor of the workspace.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "PATCH") {
    res.setHeader("Allow", "POST, PATCH");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { user: caller, error: authError } = await getAuthUser(req, res);
  if (authError || !caller) {
    return res.status(401).json({ error: authError?.message ?? "Unauthorized" });
  }

  if (!supabaseAdmin) {
    return res.status(503).json({ error: "Server configuration error" });
  }

  const body = (req.body || {}) as { memberUserId?: string; credits?: number; creditsLimit?: number };
  const memberUserId = typeof body.memberUserId === "string" ? body.memberUserId.trim() : null;
  if (!memberUserId) {
    return res.status(400).json({ error: "memberUserId is required" });
  }

  // Resolve caller's workspace (owner or tutor)
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

  if (req.method === "POST") {
    const credits = typeof body.credits === "number" ? body.credits : parseInt(String(body.credits ?? "0"), 10);
    if (!Number.isInteger(credits) || credits <= 0) {
      return res.status(400).json({ error: "credits must be a positive integer" });
    }
    const { data, error } = await supabaseAdmin.rpc("assign_credits_to_member", {
      _workspace_id: workspaceId,
      _member_user_id: memberUserId,
      _credits: credits,
      _caller_user_id: caller.id,
    });
    if (error) {
      console.error("[credits/assign] assign_credits_to_member error:", error);
      return res.status(400).json({ error: error.message || "Failed to assign credits" });
    }
    const ok = (data as { ok?: boolean })?.ok;
    const errMsg = (data as { error?: string })?.error;
    if (!ok && errMsg) {
      return res.status(400).json({ error: errMsg });
    }
    return res.status(200).json({ success: true, assigned: credits });
  }

  // PATCH: update_assigned_credits
  const creditsLimit = typeof body.creditsLimit === "number" ? body.creditsLimit : parseInt(String(body.creditsLimit ?? "0"), 10);
  if (!Number.isInteger(creditsLimit) || creditsLimit < 0) {
    return res.status(400).json({ error: "creditsLimit must be a non-negative integer" });
  }
  const { data, error } = await supabaseAdmin.rpc("update_assigned_credits", {
    _workspace_id: workspaceId,
    _member_user_id: memberUserId,
    _new_limit: creditsLimit,
    _caller_user_id: caller.id,
  });
  if (error) {
    console.error("[credits/assign] update_assigned_credits error:", error);
    return res.status(400).json({ error: error.message || "Failed to update credits" });
  }
  const ok = (data as { ok?: boolean })?.ok;
  const errMsg = (data as { error?: string })?.error;
  if (!ok && errMsg) {
    return res.status(400).json({ error: errMsg });
  }
  return res.status(200).json({ success: true, creditsLimit });
}
