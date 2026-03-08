import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import {
  canManageLectureSession,
  getCallerRole,
  getSessionById,
  getSessionFinancialMockBySessionId,
} from "@/server/lecture-sessions";

type FinancialBody = {
  tutorRateAmount?: unknown;
  tutorRateCurrency?: unknown;
  tutorRateType?: unknown;
  studentChargeAmount?: unknown;
  studentChargeCurrency?: unknown;
  studentChargeType?: unknown;
};

function parseNonNegativeNumber(value: unknown, fieldName: string) {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : NaN;

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw new Error(`${fieldName} must be a non-negative number.`);
  }

  return numericValue;
}

function parseFinancialBody(body: FinancialBody) {
  const tutorRateType =
    body.tutorRateType === "hourly" || body.tutorRateType === "per_session"
      ? body.tutorRateType
      : null;
  const studentChargeType =
    body.studentChargeType === "hourly" ||
    body.studentChargeType === "per_session" ||
    body.studentChargeType === "per_student"
      ? body.studentChargeType
      : null;

  if (!tutorRateType) {
    throw new Error("tutorRateType is required.");
  }

  if (!studentChargeType) {
    throw new Error("studentChargeType is required.");
  }

  if (typeof body.tutorRateCurrency !== "string" || body.tutorRateCurrency.trim().length === 0) {
    throw new Error("tutorRateCurrency is required.");
  }

  if (
    typeof body.studentChargeCurrency !== "string" ||
    body.studentChargeCurrency.trim().length === 0
  ) {
    throw new Error("studentChargeCurrency is required.");
  }

  return {
    tutorRateAmount: parseNonNegativeNumber(body.tutorRateAmount, "tutorRateAmount"),
    tutorRateCurrency: body.tutorRateCurrency.trim().toUpperCase(),
    tutorRateType,
    studentChargeAmount: parseNonNegativeNumber(
      body.studentChargeAmount,
      "studentChargeAmount"
    ),
    studentChargeCurrency: body.studentChargeCurrency.trim().toUpperCase(),
    studentChargeType,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const sessionId = typeof req.query.id === "string" ? req.query.id : null;
  if (!sessionId) {
    return res.status(400).json({ error: "Session id is required." });
  }

  if (req.method !== "GET" && req.method !== "PUT") {
    res.setHeader("Allow", "GET, PUT");
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
      return res.status(403).json({ error: "Only owners and tutors can access mock financials." });
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

    if (req.method === "GET") {
      const financial = await getSessionFinancialMockBySessionId(session.id);
      return res.status(200).json({ financial });
    }

    const input = parseFinancialBody((req.body ?? {}) as FinancialBody);
    const now = new Date().toISOString();
    const existing = await getSessionFinancialMockBySessionId(session.id);

    const { data: financial, error: upsertError } = await supabaseAdmin
      .from("session_financial_mock")
      .upsert(
        {
          session_id: session.id,
          workspace_id: session.workspace_id,
          tutor_id: session.tutor_id,
          tutor_rate_amount: input.tutorRateAmount,
          tutor_rate_currency: input.tutorRateCurrency,
          tutor_rate_type: input.tutorRateType,
          student_charge_amount: input.studentChargeAmount,
          student_charge_currency: input.studentChargeCurrency,
          student_charge_type: input.studentChargeType,
          created_by_user_id: existing?.created_by_user_id ?? user.id,
          updated_by_user_id: user.id,
          created_at: existing?.created_at ?? now,
          updated_at: now,
        },
        { onConflict: "session_id" }
      )
      .select("*")
      .single();

    if (upsertError) throw upsertError;

    return res.status(200).json({ financial });
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to save mock financial inputs.",
    });
  }
}
