import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { generateContractDoc } from "@/lib/contractDoc";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Export contract to Word (.docx): reads contract_body_text (Markdown), generates DOC, uploads to storage.
 * Returns a signed download URL. Caller must be owner or the tutor.
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
  if (!tutorContractId) {
    return res.status(400).json({ error: "tutor_contract_id is required" });
  }

  const { data: contract, error: fetchError } = await supabaseAdmin
    .from("tutor_contracts")
    .select("id, workspace_id, tutor_id, contract_body_text, tutor_signature_name, contract_signed_at, owner_signature_name, owner_signed_at, updated_at")
    .eq("id", tutorContractId)
    .maybeSingle();

  if (fetchError || !contract) {
    return res.status(404).json({ error: "Contract not found" });
  }

  const c = contract as {
    workspace_id: string;
    tutor_id: string;
    contract_body_text: string | null;
    tutor_signature_name: string | null;
    contract_signed_at: string | null;
    owner_signature_name: string | null;
    owner_signed_at: string | null;
    updated_at: string;
  };
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
    return res.status(403).json({ error: "Not allowed to export this contract" });
  }

  if (!c.contract_body_text) {
    return res.status(400).json({ error: "Contract has no content to export; generate or revise the contract first" });
  }

  const docBuffer = await generateContractDoc(c.contract_body_text, {
    tutorSignatureName: c.tutor_signature_name,
    contractSignedAt: c.contract_signed_at,
    ownerSignatureName: c.owner_signature_name,
    ownerSignedAt: c.owner_signed_at,
    updatedAt: c.updated_at,
  });
  const storagePath = `${c.workspace_id}/${c.tutor_id}.docx`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from("contracts")
    .upload(storagePath, docBuffer, {
      contentType: DOCX_MIME,
      upsert: true,
    });

  if (uploadError) {
    console.error("[contracts/export-doc] storage upload:", uploadError);
    return res.status(500).json({ error: "Failed to upload document" });
  }

  const { error: updateError } = await supabaseAdmin
    .from("tutor_contracts")
    .update({
      contract_storage_path: storagePath,
      updated_at: new Date().toISOString(),
    })
    .eq("id", (contract as { id: string }).id);

  if (updateError) {
    return res.status(500).json({ error: "Failed to update contract record" });
  }

  const { data: signed, error: signError } = await supabaseAdmin.storage
    .from("contracts")
    .createSignedUrl(storagePath, 60);

  if (signError || !signed?.signedUrl) {
    return res.status(500).json({ error: "Failed to generate download URL" });
  }

  return res.status(200).json({
    success: true,
    contract_storage_path: storagePath,
    url: signed.signedUrl,
  });
}
