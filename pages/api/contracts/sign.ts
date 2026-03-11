import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { user, error: authError } = await getAuthUser(req, res);
  if (authError || !user) {
    return res.status(401).json({ error: authError?.message ?? "Unauthorized" });
  }

  if (!supabaseAdmin) {
    return res.status(503).json({ error: "Server configuration error" });
  }

  const tutorContractId = typeof req.body?.tutor_contract_id === "string" ? req.body.tutor_contract_id.trim() : null;
  const signatureName = typeof req.body?.signature_name === "string" ? req.body.signature_name.trim() : null;
  const signer = req.body?.signer === "owner" ? "owner" : "tutor";

  if (!tutorContractId || !signatureName) {
    return res.status(400).json({ error: "tutor_contract_id and signature_name are required" });
  }

  const { data: contract, error: fetchError } = await supabaseAdmin
    .from("tutor_contracts")
    .select("id, workspace_id, tutor_id, contract_status")
    .eq("id", tutorContractId)
    .maybeSingle();

  if (fetchError || !contract) {
    return res.status(404).json({ error: "Contract not found" });
  }

  const c = contract as { id: string; workspace_id: string; tutor_id: string; contract_status: string };
  const now = new Date().toISOString();

  if (signer === "tutor") {
    if (c.tutor_id !== user.id) {
      return res.status(403).json({ error: "Only the tutor can sign as tutor" });
    }
    if (c.contract_status !== "pending_signature") {
      return res.status(400).json({ error: "Contract is not pending signature" });
    }
    const { error: updateError } = await supabaseAdmin
      .from("tutor_contracts")
      .update({
        contract_signed_at: now,
        tutor_signature_name: signatureName,
        contract_status: "signed",
        change_requested_at: null,
        change_request_note: null,
        updated_at: now,
      })
      .eq("id", c.id);
    if (updateError) {
      return res.status(500).json({ error: "Failed to save signature" });
    }
    return res.status(200).json({
      success: true,
      contract_signed_at: now,
    });
  }

  if (signer === "owner") {
    const { data: workspace } = await supabaseAdmin
      .from("workspaces")
      .select("owner_id")
      .eq("id", c.workspace_id)
      .maybeSingle();
    const ownerId = (workspace as { owner_id?: string } | null)?.owner_id;
    if (ownerId !== user.id) {
      return res.status(403).json({ error: "Only the workspace owner can sign as owner" });
    }
    const { error: updateError } = await supabaseAdmin
      .from("tutor_contracts")
      .update({
        owner_signature_name: signatureName,
        owner_signed_at: now,
        updated_at: now,
      })
      .eq("id", c.id);
    if (updateError) {
      return res.status(500).json({ error: "Failed to save signature" });
    }
    return res.status(200).json({
      success: true,
      owner_signed_at: now,
    });
  }

  return res.status(400).json({ error: "Invalid signer" });
}
