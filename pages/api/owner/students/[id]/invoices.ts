import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getWorkspaceIdForOwner } from "@/server/storage-allocation";
import { uploadPaymentProof } from "@/server/billing/proof-storage";

/**
 * GET /api/owner/students/[id]/invoices - list invoice rows for student (owner's workspace).
 * PATCH /api/owner/students/[id]/invoices - body { invoice_id, action: "mark_paid"|"waive"|"confirm_paid"|"reject", proof_base64?, proof_mime?, waived_reason? }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const studentId = typeof req.query.id === "string" ? req.query.id : null;
  if (!studentId) return res.status(400).json({ error: "Student id required" });

  const { user, error: authError } = await getAuthUser(req, res);
  if (authError || !user) return res.status(401).json({ error: authError?.message ?? "Unauthorized" });
  if (!supabaseAdmin) return res.status(503).json({ error: "Server configuration error" });

  const workspaceId = await getWorkspaceIdForOwner(supabaseAdmin, user.id);
  if (!workspaceId) return res.status(403).json({ error: "Only workspace owners can manage student invoices" });

  if (req.method === "GET") {
    const { data, error } = await supabaseAdmin
      .from("student_invoice_rows")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("student_id", studentId)
      .order("due_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ invoices: data ?? [] });
  }

  if (req.method !== "PATCH") {
    res.setHeader("Allow", "GET, PATCH");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = (req.body || {}) as {
    invoice_id?: string;
    action?: string;
    proof_base64?: string;
    proof_mime?: string;
    waived_reason?: string;
  };
  const invoiceId = typeof body.invoice_id === "string" ? body.invoice_id : null;
  const action = body.action;
  if (!invoiceId || !action) {
    return res.status(400).json({ error: "invoice_id and action required" });
  }

  const { data: inv, error: fetchErr } = await supabaseAdmin
    .from("student_invoice_rows")
    .select("*")
    .eq("id", invoiceId)
    .eq("workspace_id", workspaceId)
    .eq("student_id", studentId)
    .single();

  if (fetchErr || !inv) return res.status(404).json({ error: "Invoice not found" });
  const invoice = inv as { id: string; status: string; proof_storage_path: string | null };

  const now = new Date().toISOString();

  if (action === "mark_paid") {
    let proofPath = invoice.proof_storage_path;
    if (body.proof_base64 && body.proof_mime) {
      const mime = String(body.proof_mime).toLowerCase();
      if (!["image/png", "image/jpeg", "image/jpg", "application/pdf"].includes(mime)) {
        return res.status(400).json({ error: "Invalid proof_mime" });
      }
      const buf = Buffer.from(body.proof_base64, "base64");
      if (buf.length > 10 * 1024 * 1024) return res.status(400).json({ error: "Proof too large" });
      proofPath = await uploadPaymentProof({
        workspaceId,
        entityType: "invoices",
        entityId: invoice.id,
        file: buf,
        mimeType: mime,
      });
    }
    const { error: uErr } = await supabaseAdmin
      .from("student_invoice_rows")
      .update({
        status: "paid",
        paid_at: now,
        proof_storage_path: proofPath ?? undefined,
        proof_submitted_at: invoice.status === "proof_submitted" ? undefined : undefined,
        updated_at: now,
      })
      .eq("id", invoiceId);
    if (uErr) return res.status(500).json({ error: uErr.message });
    return res.status(200).json({ ok: true });
  }

  if (action === "waive") {
    const reason = typeof body.waived_reason === "string" ? body.waived_reason.trim() : "";
    const { error: uErr } = await supabaseAdmin
      .from("student_invoice_rows")
      .update({ status: "waived", waived_reason: reason || null, updated_at: now })
      .eq("id", invoiceId);
    if (uErr) return res.status(500).json({ error: uErr.message });
    return res.status(200).json({ ok: true });
  }

  if (action === "confirm_paid") {
    if (invoice.status !== "proof_submitted") {
      return res.status(400).json({ error: "Invoice must be in proof_submitted to confirm" });
    }
    const { error: uErr } = await supabaseAdmin
      .from("student_invoice_rows")
      .update({ status: "paid", paid_at: now, updated_at: now })
      .eq("id", invoiceId);
    if (uErr) return res.status(500).json({ error: uErr.message });
    return res.status(200).json({ ok: true });
  }

  if (action === "reject") {
    if (invoice.status !== "proof_submitted") {
      return res.status(400).json({ error: "Invoice must be in proof_submitted to reject" });
    }
    const { error: uErr } = await supabaseAdmin
      .from("student_invoice_rows")
      .update({
        status: "unpaid",
        proof_submitted_at: null,
        proof_storage_path: null,
        updated_at: now,
      })
      .eq("id", invoiceId);
    if (uErr) return res.status(500).json({ error: uErr.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: "Invalid action" });
}
