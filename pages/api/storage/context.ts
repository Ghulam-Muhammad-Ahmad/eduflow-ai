import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getUserStorageContext } from "@/server/storage-allocation";

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

  try {
    const context = await getUserStorageContext(supabaseAdmin, user.id);
    return res.status(200).json(context);
  } catch (error) {
    console.error("[storage/context] failed:", error);
    return res.status(500).json({ error: "Failed to load storage context" });
  }
}
