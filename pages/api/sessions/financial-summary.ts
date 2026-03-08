import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import {
  buildMockFinancialSummary,
  getCallerRole,
  getSessionFinancialMocksBySessionIds,
  type SessionRecord,
} from "@/server/lecture-sessions";

type SummaryFilters = {
  tutorId?: string;
  classroomId?: string;
  studentId?: string;
};

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
    const callerRole = await getCallerRole(user.id);
    if (callerRole !== "admin" && callerRole !== "teacher") {
      return res.status(403).json({ error: "Only owners and tutors can access mock summaries." });
    }

    const filters: SummaryFilters = {
      tutorId: typeof req.query.tutorId === "string" ? req.query.tutorId : undefined,
      classroomId:
        typeof req.query.classroomId === "string" ? req.query.classroomId : undefined,
      studentId: typeof req.query.studentId === "string" ? req.query.studentId : undefined,
    };

    let query = supabaseAdmin.from("sessions").select("*").neq("status", "cancelled");

    if (callerRole === "teacher") {
      query = query.eq("tutor_id", user.id);
    } else if (filters.tutorId) {
      query = query.eq("tutor_id", filters.tutorId);
    }

    if (filters.classroomId) {
      query = query.eq("classroom_id", filters.classroomId);
    }

    if (filters.studentId) {
      query = query.eq("student_id", filters.studentId);
    }

    const { data: sessions, error: sessionsError } = await query.order("starts_at", {
      ascending: false,
    });

    if (sessionsError) throw sessionsError;

    const sessionIds = (sessions ?? []).map((session) => session.id);
    const financialMocks = await getSessionFinancialMocksBySessionIds(sessionIds);
    const summary = await buildMockFinancialSummary(
      ((sessions ?? []) as SessionRecord[]),
      financialMocks
    );

    return res.status(200).json({ summary });
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to read mock financial summary.",
    });
  }
}
