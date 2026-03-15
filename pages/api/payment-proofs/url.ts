import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { createProofSignedUrl } from "@/server/billing/proof-storage";

/**
 * GET /api/payment-proofs/url?entity=payout|invoice&id=<uuid>
 * Returns signed URL if caller is owner or the tutor (payout) / student (invoice) for that entity.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { user, error: authError } = await getAuthUser(req, res);
  if (authError || !user) {
    return res.status(401).json({ error: authError?.message ?? "Unauthorized" });
  }

  const entity = typeof req.query.entity === "string" ? req.query.entity : null;
  const id = typeof req.query.id === "string" ? req.query.id : null;
  if (!entity || !id || (entity !== "payout" && entity !== "invoice")) {
    return res.status(400).json({ error: "Query params entity (payout|invoice) and id are required." });
  }

  if (!supabaseAdmin) {
    return res.status(503).json({ error: "Server configuration error" });
  }

  try {
    if (entity === "payout") {
      const { data: payout, error } = await supabaseAdmin
        .from("tutor_payouts")
        .select("workspace_id, tutor_id, proof_storage_path")
        .eq("id", id)
        .single();

      if (error || !payout?.proof_storage_path) {
        return res.status(404).json({ error: "Payout or proof not found." });
      }

      const { data: ws } = await supabaseAdmin
        .from("workspaces")
        .select("owner_id")
        .eq("id", payout.workspace_id)
        .single();

      const isOwner = (ws as { owner_id?: string } | null)?.owner_id === user.id;
      const isTutor = payout.tutor_id === user.id;
      if (!isOwner && !isTutor) {
        return res.status(403).json({ error: "You do not have access to this proof." });
      }

      const url = await createProofSignedUrl(payout.proof_storage_path);
      return res.status(200).json({ url });
    }

    const { data: invoice, error } = await supabaseAdmin
      .from("student_invoice_rows")
      .select("workspace_id, student_id, proof_storage_path")
      .eq("id", id)
      .single();

    if (error || !invoice?.proof_storage_path) {
      return res.status(404).json({ error: "Invoice or proof not found." });
    }

    const { data: ws } = await supabaseAdmin
      .from("workspaces")
      .select("owner_id")
      .eq("id", invoice.workspace_id)
      .single();

    const isOwner = (ws as { owner_id?: string } | null)?.owner_id === user.id;
    const isStudent = invoice.student_id === user.id;
    if (!isOwner && !isStudent) {
      return res.status(403).json({ error: "You do not have access to this proof." });
    }

    const url = await createProofSignedUrl(invoice.proof_storage_path);
    return res.status(200).json({ url });
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to create signed URL",
    });
  }
}
