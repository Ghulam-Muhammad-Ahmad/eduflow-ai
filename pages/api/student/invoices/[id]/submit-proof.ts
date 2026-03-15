import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { uploadPaymentProof } from "@/server/billing/proof-storage";

/**
 * POST /api/student/invoices/[id]/submit-proof
 * Body: { proof_base64: string, proof_mime: string }
 * Student only; invoice must belong to student and status = unpaid.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const invoiceId = typeof req.query.id === "string" ? req.query.id : null;
  if (!invoiceId) return res.status(400).json({ error: "Invoice id required" });

  const { user, error: authError } = await getAuthUser(req, res);
  if (authError || !user) return res.status(401).json({ error: authError?.message ?? "Unauthorized" });
  if (!supabaseAdmin) return res.status(503).json({ error: "Server configuration error" });

  const { data: inv, error: fetchErr } = await supabaseAdmin
    .from("student_invoice_rows")
    .select("id, workspace_id, student_id, status")
    .eq("id", invoiceId)
    .single();

  if (fetchErr || !inv) return res.status(404).json({ error: "Invoice not found" });
  const invoice = inv as { workspace_id: string; student_id: string; status: string };
  if (invoice.student_id !== user.id) return res.status(403).json({ error: "Not your invoice" });
  if (invoice.status !== "unpaid") return res.status(400).json({ error: "Only unpaid invoices can have proof submitted" });

  const body = (req.body || {}) as { proof_base64?: string; proof_mime?: string };
  const proofBase64 = body.proof_base64;
  const proofMime = typeof body.proof_mime === "string" ? body.proof_mime.toLowerCase() : null;
  if (!proofBase64 || !proofMime) return res.status(400).json({ error: "proof_base64 and proof_mime required" });
  if (!["image/png", "image/jpeg", "image/jpg", "application/pdf"].includes(proofMime)) {
    return res.status(400).json({ error: "proof_mime must be image/png, image/jpeg, or application/pdf" });
  }

  const buf = Buffer.from(proofBase64, "base64");
  if (buf.length > 10 * 1024 * 1024) return res.status(400).json({ error: "Proof file too large" });

  const proofPath = await uploadPaymentProof({
    workspaceId: invoice.workspace_id,
    entityType: "invoices",
    entityId: invoiceId,
    file: buf,
    mimeType: proofMime,
  });

  const now = new Date().toISOString();
  const { error: updateErr } = await supabaseAdmin
    .from("student_invoice_rows")
    .update({
      proof_storage_path: proofPath,
      proof_submitted_at: now,
      status: "proof_submitted",
      updated_at: now,
    })
    .eq("id", invoiceId);

  if (updateErr) return res.status(500).json({ error: updateErr.message });
  return res.status(200).json({ ok: true });
}
