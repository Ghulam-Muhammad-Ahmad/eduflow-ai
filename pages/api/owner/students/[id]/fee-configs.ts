import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getWorkspaceIdForOwner } from "@/server/storage-allocation";

/**
 * GET /api/owner/students/[id]/fee-configs - list fee configs for student.
 * POST /api/owner/students/[id]/fee-configs - create/update fee config or add manual fine.
 *   body: { fee_type?, amount?, currency?, description?, active? } for config, or
 *   { manual_fine: true, amount, currency, description } for one-off fine.
 * PATCH /api/owner/students/[id]/fee-configs - body { id, active? } to toggle config.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const studentId = typeof req.query.id === "string" ? req.query.id : null;
  if (!studentId) return res.status(400).json({ error: "Student id required" });

  const { user, error: authError } = await getAuthUser(req, res);
  if (authError || !user) return res.status(401).json({ error: authError?.message ?? "Unauthorized" });
  if (!supabaseAdmin) return res.status(503).json({ error: "Server configuration error" });

  const workspaceId = await getWorkspaceIdForOwner(supabaseAdmin, user.id);
  if (!workspaceId) return res.status(403).json({ error: "Only workspace owners can manage fee configs" });

  if (req.method === "GET") {
    const { data, error } = await supabaseAdmin
      .from("student_fee_configs")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("student_id", studentId)
      .order("fee_type");
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ configs: data ?? [] });
  }

  if (req.method === "POST") {
    const { data: ws } = await supabaseAdmin.from("workspaces").select("settings").eq("id", workspaceId).single();
    const settings = (ws?.settings ?? {}) as { default_currency?: string };
    const defaultCurrency = (typeof settings.default_currency === "string" && settings.default_currency.trim()
      ? settings.default_currency.trim()
      : "GBP");

    const body = (req.body || {}) as {
      manual_fine?: boolean;
      fee_type?: string;
      amount?: number;
      currency?: string;
      description?: string;
      active?: boolean;
    };

    if (body.manual_fine) {
      const amount = Number(body.amount);
      const currency = (body.currency || defaultCurrency).trim();
      const description = typeof body.description === "string" ? body.description.trim() : "Manual fine";
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ error: "amount must be a positive number" });
      }
      const dueDate = new Date().toISOString().slice(0, 10);
      const { data: row, error } = await supabaseAdmin
        .from("student_invoice_rows")
        .insert({
          workspace_id: workspaceId,
          student_id: studentId,
          fee_config_id: null,
          session_id: null,
          invoice_type: "manual_fine",
          description,
          amount,
          currency,
          due_date: dueDate,
          status: "unpaid",
        })
        .select("*")
        .single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ invoice: row });
    }

    const feeType =
      body.fee_type === "monthly_fixed" || body.fee_type === "per_session" || body.fee_type === "per_hour"
        ? body.fee_type
        : null;
    if (!feeType) return res.status(400).json({ error: "fee_type must be monthly_fixed, per_session, or per_hour" });
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < 0) return res.status(400).json({ error: "amount required" });
    const currency = (body.currency || defaultCurrency).trim();
    const description = typeof body.description === "string" ? body.description.trim() || null : null;
    const active = body.active !== false;

    const { data: existing } = await supabaseAdmin
      .from("student_fee_configs")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("student_id", studentId)
      .eq("fee_type", feeType)
      .maybeSingle();

    if (existing) {
      const { data: updated, error } = await supabaseAdmin
        .from("student_fee_configs")
        .update({ amount, currency, description, active, updated_at: new Date().toISOString() })
        .eq("id", (existing as { id: string }).id)
        .select("*")
        .single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ config: updated });
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("student_fee_configs")
      .insert({
        workspace_id: workspaceId,
        student_id: studentId,
        fee_type: feeType,
        amount,
        currency,
        description,
        active,
      })
      .select("*")
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ config: inserted });
  }

  if (req.method === "PATCH") {
    const body = (req.body || {}) as { id?: string; active?: boolean };
    const configId = typeof body.id === "string" ? body.id : null;
    if (!configId) return res.status(400).json({ error: "id required" });
    const { data: cfg } = await supabaseAdmin
      .from("student_fee_configs")
      .select("id")
      .eq("id", configId)
      .eq("workspace_id", workspaceId)
      .eq("student_id", studentId)
      .single();
    if (!cfg) return res.status(404).json({ error: "Config not found" });
    const updates: { active?: boolean; updated_at: string } = { updated_at: new Date().toISOString() };
    if (typeof body.active === "boolean") updates.active = body.active;
    const { error } = await supabaseAdmin.from("student_fee_configs").update(updates).eq("id", configId);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "GET, POST, PATCH");
  return res.status(405).json({ error: "Method not allowed" });
}
