import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getWorkspaceIdForOwner } from "@/server/storage-allocation";

export type ActivityItem = {
  id: string;
  type: "session" | "contract" | "invoice" | "enrollment";
  title: string;
  description: string;
  status: string;
  amount?: number;
  currency?: string;
  actor?: string;   // tutor or student display name
  date: string;
};

export type ActivitiesResponse = {
  activities: ActivityItem[];
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ActivitiesResponse | { error: string }>
) {
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

  const workspaceId = await getWorkspaceIdForOwner(supabaseAdmin, user.id);
  if (!workspaceId) {
    return res.status(403).json({ error: "Only workspace owners can access activities" });
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: sessions },
    { data: contracts },
    { data: invoices },
  ] = await Promise.all([
    // Recent sessions
    supabaseAdmin
      .from("sessions")
      .select("id, title, status, scope_type, starts_at, teacher_id, student_id")
      .eq("workspace_id", workspaceId)
      .gte("starts_at", sevenDaysAgo)
      .order("starts_at", { ascending: false })
      .limit(20),

    // Recent contract updates
    supabaseAdmin
      .from("tutor_contracts")
      .select("id, updated_at, owner_signature_url, tutor_signature_url, tutor_id")
      .eq("workspace_id", workspaceId)
      .gte("updated_at", sevenDaysAgo)
      .order("updated_at", { ascending: false })
      .limit(10),

    // Recent invoice updates
    supabaseAdmin
      .from("student_invoice_rows")
      .select("id, description, amount, currency, status, updated_at, student_id")
      .eq("workspace_id", workspaceId)
      .gte("updated_at", sevenDaysAgo)
      .order("updated_at", { ascending: false })
      .limit(10),
  ]);

  // Collect profile IDs to resolve names
  const profileIds = new Set<string>();
  (sessions ?? []).forEach((s: any) => {
    if (s.teacher_id) profileIds.add(s.teacher_id);
    if (s.student_id) profileIds.add(s.student_id);
  });
  (contracts ?? []).forEach((c: any) => { if (c.tutor_id) profileIds.add(c.tutor_id); });
  (invoices ?? []).forEach((i: any) => { if (i.student_id) profileIds.add(i.student_id); });

  const { data: profiles } = profileIds.size > 0
    ? await supabaseAdmin
        .from("profiles")
        .select("id, display_name")
        .in("id", Array.from(profileIds))
    : { data: [] };

  const nameMap = new Map<string, string>();
  (profiles ?? []).forEach((p: any) => {
    if (p.id && p.display_name) nameMap.set(p.id, p.display_name);
  });

  const activities: ActivityItem[] = [];

  // Sessions
  (sessions ?? []).forEach((s: any) => {
    const tutorName = nameMap.get(s.teacher_id) ?? "Tutor";
    const studentName = nameMap.get(s.student_id) ?? "Student";
    activities.push({
      id: s.id,
      type: "session",
      title: s.title ?? (s.scope_type === "one_to_one" ? "1v1 Session" : "Class Session"),
      description: s.scope_type === "one_to_one"
        ? `${tutorName} with ${studentName}`
        : tutorName,
      status: s.status,
      date: s.starts_at,
    });
  });

  // Contracts
  (contracts ?? []).forEach((c: any) => {
    const tutorName = nameMap.get(c.tutor_id) ?? "Tutor";
    const bothSigned = c.owner_signature_url && c.tutor_signature_url;
    const ownerSigned = !!c.owner_signature_url;
    activities.push({
      id: c.id,
      type: "contract",
      title: "Tutor Contract",
      description: tutorName,
      status: bothSigned ? "signed" : ownerSigned ? "pending_tutor" : "pending_owner",
      date: c.updated_at,
    });
  });

  // Invoices
  (invoices ?? []).forEach((i: any) => {
    const studentName = nameMap.get(i.student_id) ?? "Student";
    activities.push({
      id: i.id,
      type: "invoice",
      title: i.description ?? "Invoice",
      description: studentName,
      status: i.status,
      amount: i.amount,
      currency: i.currency,
      date: i.updated_at,
    });
  });

  // Sort all by date desc, cap at 20
  activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return res.status(200).json({ activities: activities.slice(0, 20) });
}
