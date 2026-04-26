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
    const { data, error } = await db
      .from("student_requirements")
      .select("*")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ requirements: data ?? [] });
  }

  if (req.method === "POST") {
    const body = req.body as {
      student_name?: string;
      subject?: string;
      grade?: string;
      curriculum?: string;
      student_id?: string;
      classroom_id?: string;
      requirement_type?: string;
      student_level?: string;
      student_nature?: string[];
      goal?: string;
      preferred_teaching_style?: string;
      language?: string;
      budget_hourly?: number;
      availability?: string[];
    };

    if (!body.student_name || !body.subject || !body.grade || !body.curriculum) {
      return res.status(400).json({ error: "student_name, subject, grade, and curriculum required" });
    }

    const { data, error } = await db
      .from("student_requirements")
      .insert({
        workspace_id: workspace.id,
        student_id: body.student_id ?? null,
        classroom_id: body.classroom_id ?? null,
        requirement_type: body.requirement_type ?? "student",
        student_name: body.student_name,
        subject: body.subject,
        grade: body.grade,
        curriculum: body.curriculum,
        student_level: body.student_level ?? null,
        student_nature: body.student_nature ?? [],
        goal: body.goal ?? null,
        preferred_teaching_style: body.preferred_teaching_style ?? null,
        language: body.language ?? "English",
        budget_hourly: body.budget_hourly ?? null,
        availability: body.availability ?? [],
        created_by: user.id,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ requirement: data });
  }

  if (req.method === "PATCH") {
    const { id, ...updates } = req.body as Record<string, unknown>;
    if (!id) return res.status(400).json({ error: "id required" });

    const { error } = await db
      .from("student_requirements")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id as string)
      .eq("workspace_id", workspace.id);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  if (req.method === "DELETE") {
    const { id } = req.query as { id?: string };
    if (!id) return res.status(400).json({ error: "id required" });

    const { error } = await db
      .from("student_requirements")
      .delete()
      .eq("id", id)
      .eq("workspace_id", workspace.id);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
