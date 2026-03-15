import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import type { AppRole } from "@/types/auth";

const PENDING_STATUSES = [
  "invite_sent",
  "pending_contract",
  "pending_profile",
  "pending_activation",
] as const;

type TutorInviteContract = {
  invite_token: string | null;
  invite_token_expires_at: string | null;
  status: string | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { user: caller, error: authError } = await getAuthUser(req, res);
  if (authError || !caller) {
    return res.status(401).json({ error: authError?.message ?? "Unauthorized" });
  }

  if (!supabaseAdmin) {
    return res.status(503).json({ error: "Server configuration error" });
  }

  const tutorId = typeof req.query.tutorId === "string" ? req.query.tutorId.trim() : null;
  if (!tutorId) {
    return res.status(400).json({ error: "Missing tutorId" });
  }

  const { data: roleRow } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", caller.id).maybeSingle();
  const callerRole = roleRow?.role as AppRole | undefined;
  if (callerRole !== "admin") {
    return res.status(403).json({ error: "Only workspace owners can get invite links" });
  }

  const { data: workspace, error: wsErr } = await supabaseAdmin
    .from("workspaces")
    .select("id")
    .eq("owner_id", caller.id)
    .limit(1)
    .maybeSingle();
  if (wsErr || !workspace) {
    return res.status(403).json({ error: "No workspace found for owner" });
  }

  const { data: contractData, error: contractErr } = await supabaseAdmin
    .from("tutor_contracts")
    .select("invite_token, invite_token_expires_at, status")
    .eq("workspace_id", workspace.id)
    .eq("tutor_id", tutorId)
    .maybeSingle();
  const contract = contractData as unknown as TutorInviteContract | null;

  if (contractErr || !contract?.invite_token) {
    return res.status(404).json({ error: "No invite found for this tutor" });
  }

  if (!PENDING_STATUSES.includes(contract.status as (typeof PENDING_STATUSES)[number])) {
    return res.status(400).json({ error: "Invite link is no longer valid for this tutor" });
  }

  const expiresAt = contract.invite_token_expires_at ? new Date(contract.invite_token_expires_at).getTime() : 0;
  if (expiresAt > 0 && Date.now() >= expiresAt) {
    return res.status(400).json({ error: "Invite link has expired. Use Resend invite to generate a new link." });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.headers.origin || "";
  const inviteLink = `${baseUrl}/join/tutor/${contract.invite_token}`;

  return res.status(200).json({ inviteLink });
}
