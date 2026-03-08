import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getWorkspaceIdForOwner } from "@/server/storage-allocation";

type AssignStorageBody = {
  memberUserId?: string;
  storageLimitMb?: number | string;
};

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

  const body = (req.body || {}) as AssignStorageBody;
  const memberUserId =
    typeof body.memberUserId === "string" ? body.memberUserId.trim() : null;
  if (!memberUserId) {
    return res.status(400).json({ error: "memberUserId is required" });
  }

  const workspaceId = await getWorkspaceIdForOwner(supabaseAdmin, caller.id);
  if (!workspaceId) {
    return res.status(403).json({ error: "Only workspace owners can assign storage" });
  }

  if (req.method === "POST") {
    const storageLimitMb =
      typeof body.storageLimitMb === "number"
        ? body.storageLimitMb
        : parseInt(String(body.storageLimitMb ?? "0"), 10);

    if (!Number.isInteger(storageLimitMb) || storageLimitMb <= 0) {
      return res.status(400).json({ error: "storageLimitMb must be a positive integer" });
    }

    const { data, error } = await supabaseAdmin.rpc("assign_storage_to_member", {
      _workspace_id: workspaceId,
      _member_user_id: memberUserId,
      _storage_limit_mb: storageLimitMb,
      _caller_user_id: caller.id,
    });

    if (error) {
      console.error("[storage/assign] assign_storage_to_member error:", error);
      return res.status(400).json({ error: error.message || "Failed to assign storage" });
    }

    const ok = (data as { ok?: boolean } | null)?.ok;
    const errorMessage = (data as { error?: string } | null)?.error;
    if (!ok) {
      return res.status(400).json({ error: errorMessage ?? "Failed to assign storage" });
    }

    return res.status(200).json({ success: true, storageLimitMb });
  }

  const storageLimitMb =
    typeof body.storageLimitMb === "number"
      ? body.storageLimitMb
      : parseInt(String(body.storageLimitMb ?? "0"), 10);

  if (!Number.isInteger(storageLimitMb) || storageLimitMb < 0) {
    return res.status(400).json({ error: "storageLimitMb must be zero or a positive integer" });
  }

  const { data, error } = await supabaseAdmin.rpc("update_assigned_storage_limit", {
    _workspace_id: workspaceId,
    _member_user_id: memberUserId,
    _new_limit_mb: storageLimitMb,
    _caller_user_id: caller.id,
  });

  if (error) {
    console.error("[storage/assign] update_assigned_storage_limit error:", error);
    return res.status(400).json({ error: error.message || "Failed to update storage" });
  }

  const ok = (data as { ok?: boolean } | null)?.ok;
  const errorMessage = (data as { error?: string } | null)?.error;
  if (!ok) {
    return res.status(400).json({ error: errorMessage ?? "Failed to update storage" });
  }

  return res.status(200).json({ success: true, storageLimitMb });
}
