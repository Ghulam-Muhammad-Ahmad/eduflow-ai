import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import {
  canManageLectureOutcome,
  getCallerRole,
  getSessionById,
} from "@/server/lecture-sessions";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const sessionId = typeof req.query.id === "string" ? req.query.id : null;
  if (!sessionId) {
    return res.status(400).json({ error: "Session id is required." });
  }

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

  try {
    const callerRole = await getCallerRole(user.id);
    if (callerRole !== "teacher") {
      return res.status(403).json({ error: "Only the assigned tutor can complete a lecture." });
    }

    const session = await getSessionById(sessionId);
    const canManageOutcome = canManageLectureOutcome({
      callerId: user.id,
      callerRole,
      session,
    });

    if (!canManageOutcome) {
      return res.status(403).json({ error: "You do not have access to complete this lecture." });
    }

    if (session.status === "cancelled") {
      return res.status(400).json({ error: "Cancelled lectures cannot be marked completed." });
    }

    const now = new Date().toISOString();
    const { data: updatedSession, error: updateError } = await supabaseAdmin
      .from("sessions")
      .update({
        status: "completed",
        completed_at: now,
        updated_at: now,
      })
      .eq("id", session.id)
      .select("*")
      .single();

    if (updateError) throw updateError;

    return res.status(200).json({ session: updatedSession });
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to complete lecture.",
    });
  }
}
