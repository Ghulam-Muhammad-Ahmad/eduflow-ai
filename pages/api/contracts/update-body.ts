import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";

/**
 * POST body: { tutor_contract_id: string, contract_body_text: string, set_pending_signature?: boolean, pay_type?: 'hourly'|'per_session'|'fixed_monthly', contract_type?: same, rate_amount?: number, rate_currency?: string }
 * Updates contract_body_text and optionally pay_type, contract_type, rate_amount, rate_currency. If set_pending_signature is true, also sets contract_status to "pending_signature".
 * Caller must be workspace owner; contract must not be signed.
 */
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
  const contractBodyText = typeof req.body?.contract_body_text === "string" ? req.body.contract_body_text : null;
  const setPendingSignature = req.body?.set_pending_signature === true;
  const validPayTypes = ["hourly", "per_session", "fixed_monthly"] as const;
  const payType = validPayTypes.includes(req.body?.pay_type) ? req.body.pay_type : undefined;
  const contractType = validPayTypes.includes(req.body?.contract_type) ? req.body.contract_type : payType;
  const rateAmount = typeof req.body?.rate_amount === "number" && req.body.rate_amount >= 0 ? req.body.rate_amount : typeof req.body?.rate_amount === "string" && /^\d+(\.\d+)?$/.test(req.body.rate_amount) ? parseFloat(req.body.rate_amount) : undefined;
  const rateCurrency = typeof req.body?.rate_currency === "string" && req.body.rate_currency.trim().length > 0 && req.body.rate_currency.trim().length <= 10 ? req.body.rate_currency.trim() : undefined;

  if (!tutorContractId) {
    return res.status(400).json({ error: "tutor_contract_id is required" });
  }
  if (contractBodyText === null) {
    return res.status(400).json({ error: "contract_body_text is required" });
  }

  const { data: contract, error: fetchError } = await supabaseAdmin
    .from("tutor_contracts")
    .select("id, workspace_id, contract_status")
    .eq("id", tutorContractId)
    .maybeSingle();

  if (fetchError || !contract) {
    return res.status(404).json({ error: "Contract not found" });
  }

  const c = contract as { workspace_id: string; contract_status: string };
  if (c.contract_status === "signed") {
    return res.status(400).json({ error: "Cannot edit a signed contract" });
  }

  const { data: w } = await supabaseAdmin
    .from("workspaces")
    .select("owner_id")
    .eq("id", c.workspace_id)
    .maybeSingle();
  const isOwner = (w as { owner_id?: string } | null)?.owner_id === user.id;
  if (!isOwner) {
    return res.status(403).json({ error: "Only the workspace owner can edit the contract" });
  }

  type ContractType = "hourly" | "per_session" | "fixed_monthly";
  const updatePayload: {
    contract_body_text: string;
    updated_at: string;
    contract_status?: string;
    pay_type?: ContractType;
    contract_type?: ContractType;
    rate_amount?: number;
    rate_currency?: string;
  } = {
    contract_body_text: contractBodyText,
    updated_at: new Date().toISOString(),
  };
  if (setPendingSignature) {
    updatePayload.contract_status = "pending_signature";
  }
  if (payType !== undefined) updatePayload.pay_type = payType;
  if (contractType !== undefined) updatePayload.contract_type = contractType;
  if (rateAmount !== undefined) updatePayload.rate_amount = rateAmount;
  if (rateCurrency !== undefined) updatePayload.rate_currency = rateCurrency;

  const { error: updateError } = await supabaseAdmin
    .from("tutor_contracts")
    .update(updatePayload)
    .eq("id", (contract as { id: string }).id);

  if (updateError) {
    return res.status(500).json({ error: "Failed to update contract" });
  }

  return res.status(200).json({ success: true });
}
