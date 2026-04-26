import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { user, error: authError } = await getAuthUser(req, res);
  if (authError || !user) return res.status(401).json({ error: "Unauthorized" });

  if (!supabaseAdmin) return res.status(500).json({ error: "Server configuration error" });

  const { data: workspace } = await supabaseAdmin
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!workspace) return res.status(403).json({ error: "Not a workspace owner" });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;

  if (req.method === "GET") {
    const { teacher_id } = req.query as { teacher_id?: string };
    if (!teacher_id) return res.status(400).json({ error: "teacher_id required" });

    const { data: profile, error } = await db
      .from("teacher_ai_profiles")
      .select("*")
      .eq("teacher_id", teacher_id)
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ profile: profile ?? null });
  }

  if (req.method === "PATCH") {
    const { profile_id, recommendation, owner_notes } = req.body as {
      profile_id?: string;
      recommendation?: string;
      owner_notes?: string;
    };

    if (!profile_id) return res.status(400).json({ error: "profile_id required" });

    const validRecs = ["approved", "needs_review", "rejected"];
    if (recommendation && !validRecs.includes(recommendation)) {
      return res.status(400).json({ error: "Invalid recommendation value" });
    }

    const { error: updateError } = await db
      .from("teacher_ai_profiles")
      .update({
        ...(recommendation && { recommendation }),
        ...(owner_notes !== undefined && { owner_notes }),
        owner_reviewed: true,
        owner_reviewed_at: new Date().toISOString(),
        owner_reviewed_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile_id)
      .eq("workspace_id", workspace.id);

    if (updateError) return res.status(500).json({ error: updateError.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
