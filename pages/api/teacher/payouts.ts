import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";

/**
 * GET /api/teacher/payouts
 * Returns payouts for the current user (tutor). Teacher role only.
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

  const { data: payouts, error } = await supabaseAdmin
    .from("tutor_payouts")
    .select("*")
    .eq("tutor_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ payouts: payouts ?? [] });
}
