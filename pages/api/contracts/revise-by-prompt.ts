import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";

const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API key not configured");
  return new OpenAI({ apiKey });
};

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
  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : null;

  if (!tutorContractId || !prompt) {
    return res.status(400).json({ error: "tutor_contract_id and prompt are required" });
  }

  const { data: contract, error: fetchError } = await supabaseAdmin
    .from("tutor_contracts")
    .select("id, workspace_id, tutor_id, contract_body_text, contract_status")
    .eq("id", tutorContractId)
    .maybeSingle();

  if (fetchError || !contract) {
    return res.status(404).json({ error: "Contract not found" });
  }

  if ((contract as { contract_status: string }).contract_status === "signed") {
    return res.status(400).json({ error: "Cannot revise a signed contract" });
  }

  const isOwner = await (async () => {
    const { data: w } = await supabaseAdmin
      .from("workspaces")
      .select("owner_id")
      .eq("id", (contract as { workspace_id: string }).workspace_id)
      .maybeSingle();
    return (w as { owner_id?: string } | null)?.owner_id === user.id;
  })();
  const isTutor = (contract as { tutor_id: string }).tutor_id === user.id;
  if (!isOwner && !isTutor) {
    return res.status(403).json({ error: "Not allowed to revise this contract" });
  }

  const currentText = (contract as { contract_body_text: string | null }).contract_body_text;
  if (!currentText) {
    return res.status(400).json({ error: "Contract has no text to revise; generate a draft first" });
  }

  const systemInstruction = `You are a legal assistant. You will be given the current contract (Markdown) and a revision request.
Output the complete revised contract in the same Markdown format. Apply only the requested change; keep the rest unchanged in structure and tone.
Output only the full contract Markdown, no preamble or explanation.`;

  const openai = getOpenAIClient();
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemInstruction },
      { role: "user", content: `Current contract:\n\n${currentText}\n\nRevision request: ${prompt}` },
    ],
    temperature: 0.3,
  });
  const revised = response.choices?.[0]?.message?.content?.trim();
  if (!revised) {
    return res.status(500).json({ error: "AI did not return revised contract text" });
  }

  const { error: updateError } = await supabaseAdmin
    .from("tutor_contracts")
    .update({
      contract_body_text: revised,
      change_requested_at: null,
      change_request_note: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", (contract as { id: string }).id);

  if (updateError) {
    return res.status(500).json({ error: "Failed to save revised contract" });
  }

  return res.status(200).json({
    success: true,
    contract_body_text: revised,
  });
}
