import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { user, error: authError } = await getAuthUser(req, res);
  if (authError || !user) return res.status(401).json({ error: "Unauthorized" });

  if (!supabaseAdmin) return res.status(500).json({ error: "Server configuration error" });

  const { profile_id } = req.query as { profile_id?: string };
  if (!profile_id) return res.status(400).json({ error: "profile_id required" });

  const { data: workspace } = await supabaseAdmin
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!workspace) return res.status(403).json({ error: "Not a workspace owner" });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;

  const { data: profile, error } = await db
    .from("teacher_ai_profiles")
    .select("*")
    .eq("id", profile_id)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  return res.status(200).json({ profile });
}
