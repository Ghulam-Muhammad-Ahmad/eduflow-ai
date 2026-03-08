import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";

/** GET ?memberUserId=... — returns daily consumption for current period: { points: { date: string, credits: number }[] } */
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

  const memberUserId = typeof req.query.memberUserId === "string" ? req.query.memberUserId.trim() : null;
  if (!memberUserId) {
    return res.status(400).json({ error: "memberUserId is required" });
  }

  const { data: ownerWs } = await supabaseAdmin
    .from("workspaces")
    .select("id")
    .eq("owner_id", caller.id)
    .limit(1)
    .maybeSingle();

  const workspaceId = ownerWs?.id ?? null;
  if (!workspaceId) {
    return res.status(403).json({ error: "Only workspace owners can view member usage" });
  }

  // Verify member is in workspace (same as member.ts)
  const { data: wsMember } = await supabaseAdmin
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", memberUserId)
    .maybeSingle();
  if (!wsMember) {
    const { data: enrollments } = await supabaseAdmin
      .from("enrollments")
      .select("classroom_id")
      .eq("student_id", memberUserId)
      .eq("status", "active");
    const classroomIds = (enrollments ?? []).map((e) => e.classroom_id);
    if (classroomIds.length === 0) {
      return res.status(404).json({ error: "Member not found in your workspace" });
    }
    const { data: classroomsInWorkspace } = await supabaseAdmin
      .from("classrooms")
      .select("id")
      .eq("workspace_id", workspaceId)
      .in("id", classroomIds)
      .limit(1);
    if (!classroomsInWorkspace?.length) {
      return res.status(404).json({ error: "Member not found in your workspace" });
    }
  }

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const { data: rows, error } = await supabaseAdmin
    .from("ai_interactions")
    .select("created_at, credits_deducted")
    .eq("user_id", memberUserId)
    .gte("created_at", periodStart.toISOString())
    .lte("created_at", periodEnd.toISOString())
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[credits/member/usage-history] select error:", error);
    return res.status(500).json({ error: "Failed to load usage history" });
  }

  // Group by date (YYYY-MM-DD) and sum credits_deducted
  const byDate = new Map<string, number>();
  for (const row of rows ?? []) {
    const dateStr = (row.created_at as string).slice(0, 10);
    const credits = typeof row.credits_deducted === "number" ? row.credits_deducted : 0;
    byDate.set(dateStr, (byDate.get(dateStr) ?? 0) + credits);
  }

  // Build sorted points; fill missing days with 0 so the line chart has a continuous shape
  const points: { date: string; credits: number; cumulative: number }[] = [];
  let cumulative = 0;
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    const dayCredits = byDate.get(dateStr) ?? 0;
    cumulative += dayCredits;
    points.push({ date: dateStr, credits: dayCredits, cumulative });
  }

  return res.status(200).json({ points });
}
