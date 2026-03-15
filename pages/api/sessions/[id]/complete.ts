import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import {
  canManageLectureOutcome,
  getCallerRole,
  getSessionById,
} from "@/server/lecture-sessions";
import { runContractEngineForSession } from "@/server/billing/contract-engine";
import { runFeeEngineForSession } from "@/server/billing/fee-engine";

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
    if (callerRole !== "teacher" && callerRole !== "admin") {
      return res.status(403).json({
        error: "Only the assigned tutor or workspace owner can complete a lecture.",
      });
    }

    const session = await getSessionById(sessionId);
    const canManageOutcome = await canManageLectureOutcome({
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
        completed_by_user_id: user.id,
        updated_at: now,
      })
      .eq("id", session.id)
      .select("*")
      .single();

    if (updateError) throw updateError;

    // Run billing engines: contract (tutor earning row) and fee (student invoice rows)
    try {
      await runContractEngineForSession({
        workspaceId: session.workspace_id,
        tutorId: session.tutor_id,
        sessionId: session.id,
        sessionTitle: session.title,
        startsAt: session.starts_at,
        endsAt: session.ends_at,
      });
      await runFeeEngineForSession({
        workspaceId: session.workspace_id,
        sessionId: session.id,
        scopeType: session.scope_type,
        classroomId: session.classroom_id,
        studentId: session.student_id,
        startsAt: session.starts_at,
        endsAt: session.ends_at,
      });
    } catch (engineError) {
      // Log but do not fail the request; session is already marked completed
      console.error("Billing engines error on session complete:", engineError);
    }

    return res.status(200).json({ session: updatedSession });
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to complete lecture.",
    });
  }
}
