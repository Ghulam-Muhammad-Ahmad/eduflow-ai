import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getWorkspaceIdForOwner } from "@/server/storage-allocation";

/**
 * GET /api/owner/earning-rows?tutorId=...&status=...
 * PATCH /api/owner/earning-rows - body { id: string, status: "pending" | "approved" }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { user, error: authError } = await getAuthUser(req, res);
  if (authError || !user) {
    return res.status(401).json({ error: authError?.message ?? "Unauthorized" });
  }
  if (!supabaseAdmin) {
    return res.status(503).json({ error: "Server configuration error" });
  }

  const workspaceId = await getWorkspaceIdForOwner(supabaseAdmin, user.id);
  if (!workspaceId) {
    return res.status(403).json({ error: "Only workspace owners can manage earning rows" });
  }

  if (req.method === "PATCH") {
    const body = (req.body || {}) as { id?: string; status?: string };
    const id = typeof body.id === "string" ? body.id : null;
    const status = body.status === "pending" || body.status === "approved" ? body.status : null;
    if (!id || !status) {
      return res.status(400).json({ error: "id and status (pending|approved) required" });
    }
    const { data: row, error: fetchErr } = await supabaseAdmin
      .from("tutor_earning_rows")
      .select("id")
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .single();
    if (fetchErr || !row) {
      return res.status(404).json({ error: "Earning row not found" });
    }
    const { error: updateErr } = await supabaseAdmin
      .from("tutor_earning_rows")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (updateErr) return res.status(500).json({ error: updateErr.message });
    return res.status(200).json({ ok: true });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, PATCH");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const tutorId = typeof req.query.tutorId === "string" ? req.query.tutorId : undefined;
  const status =
    req.query.status === "pending" ||
    req.query.status === "approved" ||
    req.query.status === "paid"
      ? req.query.status
      : undefined;

  let query = supabaseAdmin
    .from("tutor_earning_rows")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("period_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (tutorId) query = query.eq("tutor_id", tutorId);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    return res.status(500).json({ error: error.message });
  }
  return res.status(200).json({ rows: data ?? [] });
}
