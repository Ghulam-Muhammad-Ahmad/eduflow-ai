import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import {
  getStorageAssignmentCapacityBytes,
  getStorageAssignmentError,
  getUserStorageUsageBytes,
  getWorkspaceIdForOwner,
  isUserManagedByWorkspace,
} from "@/server/storage-allocation";
import { mbToBytes } from "@/lib/storage-quota";

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

  const memberUserId =
    typeof req.query.memberUserId === "string" ? req.query.memberUserId.trim() : null;
  if (!memberUserId) {
    return res.status(400).json({ error: "memberUserId is required" });
  }

  const workspaceId = await getWorkspaceIdForOwner(supabaseAdmin, caller.id);
  if (!workspaceId) {
    return res.status(403).json({ error: "Only workspace owners can view member storage" });
  }

  const isManagedUser = await isUserManagedByWorkspace(supabaseAdmin, workspaceId, memberUserId);
  if (!isManagedUser) {
    return res.status(404).json({ error: "Member not found in your workspace" });
  }

  try {
    const [{ data: allocation }, usedBytes, maxAssignableBytes] = await Promise.all([
      supabaseAdmin
        .from("user_storage_allocations")
        .select("storage_limit_mb")
        .eq("workspace_id", workspaceId)
        .eq("user_id", memberUserId)
        .maybeSingle(),
      getUserStorageUsageBytes(supabaseAdmin, memberUserId),
      getStorageAssignmentCapacityBytes(supabaseAdmin, workspaceId, memberUserId),
    ]);

    const storageLimitBytes = mbToBytes(allocation?.storage_limit_mb ?? 0);
    return res.status(200).json({
      storageLimitBytes,
      storageUsedBytes: usedBytes,
      remainingBytes: Math.max(0, storageLimitBytes - usedBytes),
      maxAssignableBytes,
      validationError: getStorageAssignmentError(usedBytes, storageLimitBytes),
    });
  } catch (error) {
    console.error("[storage/member] failed:", error);
    return res.status(500).json({ error: "Failed to load member storage" });
  }
}
