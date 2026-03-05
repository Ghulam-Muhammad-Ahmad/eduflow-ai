import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";

/**
 * GET ?tutor_contract_id=xxx
 * Returns a signed URL to download the contract PDF. Caller must be owner of the workspace or the tutor.
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

  if (!supabaseAdmin) {
    return res.status(503).json({ error: "Server configuration error" });
  }

  const tutorContractId = typeof req.query?.tutor_contract_id === "string" ? req.query.tutor_contract_id.trim() : null;
  if (!tutorContractId) {
    return res.status(400).json({ error: "tutor_contract_id required" });
  }

  const { data: contract, error: fetchError } = await supabaseAdmin
    .from("tutor_contracts")
    .select("id, workspace_id, tutor_id, contract_storage_path")
    .eq("id", tutorContractId)
    .maybeSingle();

  if (fetchError || !contract) {
    return res.status(404).json({ error: "Contract not found" });
  }

  const c = contract as { workspace_id: string; tutor_id: string; contract_storage_path: string | null };
  const isOwner = await (async () => {
    const { data: w } = await supabaseAdmin
      .from("workspaces")
      .select("owner_id")
      .eq("id", c.workspace_id)
      .maybeSingle();
    return (w as { owner_id?: string } | null)?.owner_id === user.id;
  })();
  const isTutor = c.tutor_id === user.id;
  if (!isOwner && !isTutor) {
    return res.status(403).json({ error: "Not allowed to access this contract" });
  }

  if (!c.contract_storage_path) {
    return res.status(404).json({ error: "Contract PDF not yet generated" });
  }

  const { data: signed, error: signError } = await supabaseAdmin.storage
    .from("contracts")
    .createSignedUrl(c.contract_storage_path, 60);

  if (signError || !signed?.signedUrl) {
    return res.status(500).json({ error: "Failed to generate download URL" });
  }

  return res.status(200).json({ url: signed.signedUrl });
}
