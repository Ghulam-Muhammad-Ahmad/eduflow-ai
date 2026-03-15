import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getWorkspaceIdForOwner } from "@/server/storage-allocation";
import { uploadPaymentProof } from "@/server/billing/proof-storage";

/**
 * GET /api/owner/payouts - list payouts for owner's workspace.
 * POST /api/owner/payouts - create payout: body { earning_row_ids: string[], tutor_id: string, payment_note?: string, proof_base64?: string, proof_mime?: string }
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
    return res.status(403).json({ error: "Only workspace owners can manage payouts" });
  }

  if (req.method === "GET") {
    const { data, error } = await supabaseAdmin
      .from("tutor_payouts")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ payouts: data ?? [] });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = (req.body || {}) as {
    earning_row_ids?: string[];
    tutor_id?: string;
    payment_note?: string;
    proof_base64?: string;
    proof_mime?: string;
  };

  const earningRowIds = Array.isArray(body.earning_row_ids) ? body.earning_row_ids : [];
  const tutorId = typeof body.tutor_id === "string" ? body.tutor_id.trim() : null;
  if (!tutorId || earningRowIds.length === 0) {
    return res.status(400).json({ error: "earning_row_ids and tutor_id are required" });
  }

  const { data: rows, error: rowsError } = await supabaseAdmin
    .from("tutor_earning_rows")
    .select("id, workspace_id, tutor_id, net_amount, currency, status")
    .in("id", earningRowIds)
    .eq("workspace_id", workspaceId)
    .eq("tutor_id", tutorId)
    .in("status", ["pending", "approved"]);

  if (rowsError) return res.status(500).json({ error: rowsError.message });
  const list = (rows ?? []) as Array<{ id: string; workspace_id: string; tutor_id: string; net_amount: number; currency: string; status: string }>;
  if (list.length !== earningRowIds.length) {
    return res.status(400).json({ error: "Some earning rows not found or not eligible for payout" });
  }

  const totalNet = list.reduce((sum, r) => sum + Number(r.net_amount), 0);
  const currency = list[0]?.currency ?? "GBP";
  const paymentNote = typeof body.payment_note === "string" ? body.payment_note.trim() : null;

  const { data: payout, error: insertError } = await supabaseAdmin
    .from("tutor_payouts")
    .insert({
      workspace_id: workspaceId,
      tutor_id: tutorId,
      total_net_amount: totalNet,
      currency,
      payment_note: paymentNote,
      proof_storage_path: null,
      status: "paid",
      paid_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (insertError) return res.status(500).json({ error: insertError.message });
  const payoutId = (payout as { id: string }).id;

  if (body.proof_base64 && body.proof_mime) {
    const mime = String(body.proof_mime).toLowerCase();
    if (!["image/png", "image/jpeg", "image/jpg", "application/pdf"].includes(mime)) {
      return res.status(400).json({ error: "proof_mime must be image/png, image/jpeg, or application/pdf" });
    }
    const buf = Buffer.from(body.proof_base64, "base64");
    if (buf.length > 10 * 1024 * 1024) return res.status(400).json({ error: "Proof file too large" });
    try {
      const proofPath = await uploadPaymentProof({
        workspaceId,
        entityType: "payouts",
        entityId: payoutId,
        file: buf,
        mimeType: mime,
      });
      await supabaseAdmin.from("tutor_payouts").update({ proof_storage_path: proofPath }).eq("id", payoutId);
    } catch (e) {
      console.error("Proof upload failed:", e);
    }
  }

  const { error: updateRowsError } = await supabaseAdmin
    .from("tutor_earning_rows")
    .update({ status: "paid", payout_id: payoutId, updated_at: new Date().toISOString() })
    .in("id", earningRowIds);

  if (updateRowsError) {
    await supabaseAdmin.from("tutor_payouts").delete().eq("id", payoutId);
    return res.status(500).json({ error: "Failed to mark earning rows as paid" });
  }

  return res.status(200).json({ payout });
}
