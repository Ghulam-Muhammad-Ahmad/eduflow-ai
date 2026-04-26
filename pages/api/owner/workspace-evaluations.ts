import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { user, error: authError } = await getAuthUser(req, res);
  if (authError || !user) return res.status(401).json({ error: "Unauthorized" });

  if (!supabaseAdmin) return res.status(500).json({ error: "Server configuration error" });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;

  const { data: workspace } = await supabaseAdmin
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!workspace) return res.status(403).json({ error: "Not a workspace owner" });

  // All tutors in workspace
  const { data: members } = await supabaseAdmin
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspace.id)
    .eq("role", "tutor");

  const tutorIds = (members ?? []).map((m: { user_id: string }) => m.user_id);

  if (tutorIds.length === 0) {
    return res.status(200).json({ evaluations: [], approved_count: 0 });
  }

  // Profiles for tutors
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("user_id, display_name, email, avatar_url")
    .in("user_id", tutorIds);

  const profileMap = new Map(
    (profiles ?? []).map((p: { user_id: string; display_name: string | null; email: string | null; avatar_url: string | null }) => [p.user_id, p])
  );

  // Latest evaluation test per tutor
  const { data: tests } = await db
    .from("teacher_evaluation_tests")
    .select("id, teacher_id, status, subject, grades, curriculum, created_at, assigned_at")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  // Keep only latest test per teacher
  const latestTestMap = new Map<string, Record<string, unknown>>();
  for (const test of tests ?? []) {
    const tid = test.teacher_id as string;
    if (!latestTestMap.has(tid)) latestTestMap.set(tid, test as Record<string, unknown>);
  }

  // AI profiles per tutor (latest)
  const { data: aiProfiles } = await db
    .from("teacher_ai_profiles")
    .select("id, teacher_id, overall_score, recommendation, owner_reviewed, teacher_nature, best_for, summary, created_at")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  const latestAiProfileMap = new Map<string, Record<string, unknown>>();
  for (const p of aiProfiles ?? []) {
    const tid = p.teacher_id as string;
    if (!latestAiProfileMap.has(tid)) latestAiProfileMap.set(tid, p as Record<string, unknown>);
  }

  const evaluations = tutorIds.map((tid: string) => ({
    teacher_id: tid,
    profile: profileMap.get(tid) ?? { user_id: tid, display_name: null, email: null, avatar_url: null },
    latest_test: latestTestMap.get(tid) ?? null,
    ai_profile: latestAiProfileMap.get(tid) ?? null,
  }));

  const approved_count = [...latestAiProfileMap.values()].filter(
    (p) => p.recommendation === "approved"
  ).length;

  return res.status(200).json({ evaluations, approved_count });
}
