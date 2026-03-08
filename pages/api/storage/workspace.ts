import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getWorkspaceIdForOwner, getWorkspaceStorageSummary } from "@/server/storage-allocation";

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

  const workspaceId = await getWorkspaceIdForOwner(supabaseAdmin, caller.id);
  if (!workspaceId) {
    return res.status(403).json({ error: "No workspace found" });
  }

  try {
    const summary = await getWorkspaceStorageSummary(supabaseAdmin, workspaceId);
    return res.status(200).json(summary);
  } catch (error) {
    console.error("[storage/workspace] failed:", error);
    return res.status(500).json({ error: "Failed to load workspace storage" });
  }
}
