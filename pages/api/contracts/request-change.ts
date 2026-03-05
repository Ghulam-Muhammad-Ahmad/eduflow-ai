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
  const note = typeof req.body?.note === "string" ? req.body.note.trim() : "";

  if (!tutorContractId) {
    return res.status(400).json({ error: "tutor_contract_id is required" });
  }

  const { data: contract, error: fetchError } = await supabaseAdmin
    .from("tutor_contracts")
    .select("id, tutor_id, contract_status")
    .eq("id", tutorContractId)
    .maybeSingle();

  if (fetchError || !contract) {
    return res.status(404).json({ error: "Contract not found" });
  }

  if ((contract as { tutor_id: string }).tutor_id !== user.id) {
    return res.status(403).json({ error: "Only the tutor can request a change" });
  }

  if ((contract as { contract_status: string }).contract_status === "signed") {
    return res.status(400).json({ error: "Cannot request change on a signed contract" });
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabaseAdmin
    .from("tutor_contracts")
    .update({
      contract_status: "change_requested",
      change_requested_at: now,
      change_request_note: note || null,
      updated_at: now,
    })
    .eq("id", (contract as { id: string }).id);

  if (updateError) {
    return res.status(500).json({ error: "Failed to save request" });
  }

  return res.status(200).json({
    success: true,
    contract_status: "change_requested",
  });
}
