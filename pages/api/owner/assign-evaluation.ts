import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

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

  const { teacher_id, subject, grades, curriculum, experience_years, language } = req.body as {
    teacher_id?: string;
    subject?: string;
    grades?: string[];
    curriculum?: string[];
    experience_years?: number;
    language?: string;
  };

  if (!teacher_id || !subject || !grades?.length || !curriculum?.length) {
    return res.status(400).json({ error: "teacher_id, subject, grades, and curriculum required" });
  }

  // Verify teacher is a member of this workspace
  const { data: member } = await supabaseAdmin
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspace.id)
    .eq("user_id", teacher_id)
    .maybeSingle();

  if (!member) return res.status(400).json({ error: "Teacher not in workspace" });

  const { data: test, error: insertError } = await db
    .from("teacher_evaluation_tests")
    .insert({
      workspace_id: workspace.id,
      teacher_id,
      subject,
      grades,
      curriculum,
      experience_years: experience_years ?? 0,
      language: language ?? "English",
      assigned_by: user.id,
      assigned_at: new Date().toISOString(),
      status: "pending",
    })
    .select()
    .single();

  if (insertError) return res.status(500).json({ error: insertError.message });

  return res.status(201).json({ test });
}
