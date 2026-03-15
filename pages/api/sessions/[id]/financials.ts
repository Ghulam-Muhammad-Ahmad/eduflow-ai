import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import {
  canManageLectureSession,
  getCallerRole,
  getSessionById,
} from "@/server/lecture-sessions";

/**
 * GET /api/sessions/[id]/financials - read-only: returns real earning rows and invoice rows for this session.
 * PUT is deprecated (mock financials removed); returns 410 Gone.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const sessionId = typeof req.query.id === "string" ? req.query.id : null;
  if (!sessionId) {
    return res.status(400).json({ error: "Session id is required." });
  }

  if (req.method === "PUT") {
    return res.status(410).json({
      error: "Mock financials are no longer used. Earnings and fees are managed by contracts and fee configs.",
    });
  }

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
      return res.status(403).json({ error: "Only owners and tutors can access session financials." });
    }

    const session = await getSessionById(sessionId);
    const canManage = await canManageLectureSession({
      callerId: user.id,
      callerRole,
      session,
    });

    if (!canManage) {
      return res.status(403).json({ error: "You do not have access to this lecture financial data." });
    }

    const [earningRes, invoiceRes] = await Promise.all([
      supabaseAdmin
        .from("tutor_earning_rows")
        .select("*")
        .eq("session_id", session.id),
      supabaseAdmin
        .from("student_invoice_rows")
        .select("*")
        .eq("session_id", session.id),
    ]);

    if (earningRes.error) throw earningRes.error;
    if (invoiceRes.error) throw invoiceRes.error;

    return res.status(200).json({
      financial: null,
      earningRows: earningRes.data ?? [],
      invoiceRows: invoiceRes.data ?? [],
    });
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to load session financials.",
    });
  }
}
