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
  const tutorId = typeof req.body?.tutor_id === "string" ? req.body.tutor_id.trim() : null;
  const workspaceId = typeof req.body?.workspace_id === "string" ? req.body.workspace_id.trim() : null;
  const instructions = typeof req.body?.instructions === "string" ? req.body.instructions.trim() : null;

  if (!tutorContractId && !(tutorId && workspaceId)) {
    return res.status(400).json({ error: "Provide tutor_contract_id or (tutor_id and workspace_id)" });
  }

  let contract: {
    id: string;
    workspace_id: string;
    tutor_id: string;
    pay_type: string;
    rate_amount: number;
    rate_currency: string;
    subjects: unknown;
    contract_status: string;
  } | null = null;

  if (tutorContractId) {
    const { data, error } = await supabaseAdmin
      .from("tutor_contracts")
      .select("id, workspace_id, tutor_id, pay_type, rate_amount, rate_currency, subjects, contract_status")
      .eq("id", tutorContractId)
      .maybeSingle();
    if (error || !data) {
      return res.status(404).json({ error: "Contract not found" });
    }
    contract = data as typeof contract;
  } else {
    const { data, error } = await supabaseAdmin
      .from("tutor_contracts")
      .select("id, workspace_id, tutor_id, pay_type, rate_amount, rate_currency, subjects, contract_status")
      .eq("workspace_id", workspaceId!)
      .eq("tutor_id", tutorId!)
      .maybeSingle();
    if (error || !data) {
      return res.status(404).json({ error: "Contract not found" });
    }
    contract = data as typeof contract;
  }

  const isOwner = await (async () => {
    const { data: w } = await supabaseAdmin
      .from("workspaces")
      .select("owner_id")
      .eq("id", contract!.workspace_id)
      .maybeSingle();
    return w?.owner_id === user.id;
  })();
  const isTutor = contract!.tutor_id === user.id;
  if (!isOwner && !isTutor) {
    return res.status(403).json({ error: "Not allowed to generate this contract" });
  }

  if (isOwner && (!instructions || instructions.length < 10)) {
    return res.status(400).json({ error: "As the owner, you must provide instructions for the AI (at least 10 characters) describing what the contract should include." });
  }

  const { data: workspace } = await supabaseAdmin
    .from("workspaces")
    .select("name")
    .eq("id", contract!.workspace_id)
    .single();
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("display_name")
    .eq("user_id", contract!.tutor_id)
    .maybeSingle();

  const workspaceName = (workspace as { name?: string } | null)?.name ?? "The Business";
  const tutorName = (profile as { display_name?: string } | null)?.display_name ?? "Tutor";
  const subjectsList = Array.isArray(contract!.subjects)
    ? (contract!.subjects as string[]).join(", ")
    : typeof contract!.subjects === "string"
      ? contract!.subjects
      : "";

  const contextBlock = `Context:
- Business/Workspace: ${workspaceName}
- Tutor: ${tutorName}
- Rate: ${contract!.rate_amount} ${contract!.rate_currency} per ${contract!.pay_type === "per_session" ? "session" : "hour"}
- Subjects: ${subjectsList || "General tutoring"}`;

  const systemInstruction = `You are a legal assistant. Generate a tutoring services agreement in **Markdown format**.
Use the context provided and follow the owner's instructions. Output valid Markdown: use # for title, ## for section headings, paragraphs, and lists where appropriate.
Include parties, scope, rate, subjects, start date, and any clauses the owner requests. Output only the contract in Markdown, no preamble.`;

  const userContent = isOwner
    ? `${contextBlock}\n\nOwner's instructions:\n${instructions}`
    : `${contextBlock}\n\nGenerate a standard tutoring services agreement.`;

  const openai = getOpenAIClient();
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemInstruction },
      { role: "user", content: userContent },
    ],
    temperature: 0.4,
  });
  const content = response.choices?.[0]?.message?.content?.trim();
  if (!content) {
    return res.status(500).json({ error: "AI did not return contract text" });
  }

  const { error: updateError } = await supabaseAdmin
    .from("tutor_contracts")
    .update({
      contract_body_text: content,
      contract_status: "pending_signature",
      updated_at: new Date().toISOString(),
    })
    .eq("id", contract!.id);

  if (updateError) {
    return res.status(500).json({ error: "Failed to save contract" });
  }

  return res.status(200).json({
    success: true,
    contract_body_text: content,
  });
}
