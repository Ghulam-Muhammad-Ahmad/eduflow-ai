import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";

type WorkspaceSettings = { default_currency?: string };

/**
 * GET /api/workspace/currency
 * Returns the default currency for the current user's workspace.
 * Owner: from their workspace. Teacher: from workspace_members -> workspace. Student: from workspace_students -> workspace.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { user, error: authError } = await getAuthUser(req, res);
  if (authError || !user) {
    return res.status(401).json({ error: authError?.message ?? "Unauthorized" });
  }
  if (!supabaseAdmin) {
    return res.status(503).json({ error: "Server configuration error" });
  }

  let workspaceId: string | null = null;

  const { data: ownerWs } = await supabaseAdmin
    .from("workspaces")
    .select("id, settings")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();

  if (ownerWs?.id) {
    workspaceId = ownerWs.id;
    const settings = (ownerWs.settings ?? {}) as WorkspaceSettings;
    const currency = typeof settings.default_currency === "string" && settings.default_currency.trim()
      ? settings.default_currency.trim()
      : "GBP";
    return res.status(200).json({ currency });
  }

  const { data: member } = await supabaseAdmin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (member?.workspace_id) {
    workspaceId = member.workspace_id;
  } else {
    const { data: wsStudent } = await supabaseAdmin
      .from("workspace_students")
      .select("workspace_id")
      .eq("student_id", user.id)
      .limit(1)
      .maybeSingle();
    if (wsStudent?.workspace_id) workspaceId = wsStudent.workspace_id;
  }

  if (!workspaceId) {
    return res.status(200).json({ currency: "GBP" });
  }

  const { data: ws } = await supabaseAdmin
    .from("workspaces")
    .select("settings")
    .eq("id", workspaceId)
    .single();

  const settings = (ws?.settings ?? {}) as WorkspaceSettings;
  const currency = typeof settings.default_currency === "string" && settings.default_currency.trim()
    ? settings.default_currency.trim()
    : "GBP";
  return res.status(200).json({ currency });
}
