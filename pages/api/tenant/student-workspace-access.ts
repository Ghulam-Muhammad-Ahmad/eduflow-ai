import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";

/**
 * GET: Returns whether the current user (student) has access via a workspace (tenant model).
 * Used so tenant-created students get subscription access without their own plan.
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
    return res.status(200).json({ hasAccess: false });
  }

  const { data: wsStudents, error: wsErr } = await supabaseAdmin
    .from("workspace_students")
    .select("workspace_id")
    .eq("student_id", user.id);

  if (wsErr || !wsStudents?.length) {
    return res.status(200).json({ hasAccess: false });
  }

  const workspaceIds = [...new Set(wsStudents.map((w) => w.workspace_id))];
  const { data: subs, error: subErr } = await supabaseAdmin
    .from("workspace_subscriptions")
    .select("id")
    .in("workspace_id", workspaceIds)
    .in("status", ["active", "trialing"])
    .limit(1);

  const hasAccess = !subErr && subs && subs.length > 0;
  return res.status(200).json({ hasAccess: !!hasAccess });
}
