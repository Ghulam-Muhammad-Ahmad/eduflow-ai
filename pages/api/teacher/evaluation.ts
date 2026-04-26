import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { user, error: authError } = await getAuthUser(req, res);
  if (authError || !user) return res.status(401).json({ error: "Unauthorized" });

  if (!supabaseAdmin) return res.status(500).json({ error: "Server configuration error" });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;

  if (req.method === "GET") {
    const { data: test, error: testError } = await db
      .from("teacher_evaluation_tests")
      .select("*")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (testError) return res.status(500).json({ error: testError.message });
    if (!test) return res.status(200).json({ test: null, profile: null });

    const { data: profile } = await db
      .from("teacher_ai_profiles")
      .select("*")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return res.status(200).json({ test, profile: profile ?? null });
  }

  if (req.method === "PATCH") {
    const { evaluation_test_id, status } = req.body as {
      evaluation_test_id?: string;
      status?: string;
    };

    if (!evaluation_test_id) return res.status(400).json({ error: "evaluation_test_id required" });
    if (status !== "in_progress") return res.status(400).json({ error: "Only in_progress transition supported" });

    const { data: test } = await db
      .from("teacher_evaluation_tests")
      .select("id, status, teacher_id")
      .eq("id", evaluation_test_id)
      .eq("teacher_id", user.id)
      .maybeSingle();

    if (!test) return res.status(404).json({ error: "Test not found" });
    if (test.status !== "pending") return res.status(400).json({ error: "Test cannot be started" });

    const { error: updateError } = await db
      .from("teacher_evaluation_tests")
      .update({ status: "in_progress", started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", evaluation_test_id);

    if (updateError) return res.status(500).json({ error: updateError.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
