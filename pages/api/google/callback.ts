import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getCallerRole } from "@/server/lecture-sessions";
import {
  exchangeGoogleCodeForTokens,
  fetchGoogleUserEmail,
  isGoogleCalendarConfigured,
} from "@/server/google-calendar";

function readRedirectTarget(rawState: string | string[] | undefined) {
  if (typeof rawState !== "string") return "/dashboard/teacher";

  try {
    const parsed = JSON.parse(Buffer.from(rawState, "base64url").toString("utf8")) as {
      redirectTo?: string;
    };
    return parsed.redirectTo && parsed.redirectTo.startsWith("/")
      ? parsed.redirectTo
      : "/dashboard/teacher";
  } catch {
    return "/dashboard/teacher";
  }
}

function redirectWithStatus(
  res: NextApiResponse,
  target: string,
  status: "connected" | "error",
  message?: string
) {
  const url = new URL(target, "http://localhost");
  url.searchParams.set("googleCalendar", status);
  if (message) url.searchParams.set("message", message);
  return res.redirect(`${url.pathname}${url.search}`);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const redirectTarget = readRedirectTarget(req.query.state);

  if (!isGoogleCalendarConfigured() || !supabaseAdmin) {
    return redirectWithStatus(res, redirectTarget, "error", "Google Calendar is not configured.");
  }

  const { user, error: authError } = await getAuthUser(req, res);
  if (authError || !user) {
    return redirectWithStatus(res, "/auth", "error", authError?.message ?? "Unauthorized");
  }

  const role = await getCallerRole(user.id);
  if (role !== "teacher" && role !== "admin" && role !== "student") {
    return redirectWithStatus(res, redirectTarget, "error", "Only owners, tutors, and students can connect Google Calendar.");
  }

  const code = typeof req.query.code === "string" ? req.query.code : null;
  if (!code) {
    return redirectWithStatus(res, redirectTarget, "error", "Missing Google authorization code.");
  }

  try {
    const tokenPayload = await exchangeGoogleCodeForTokens(req, code);
    const googleEmail = await fetchGoogleUserEmail(tokenPayload.accessToken);

    const { data: existingConnection, error: existingError } = await supabaseAdmin
      .from("google_calendar_connections")
      .select("id, refresh_token")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingError) throw existingError;

    const refreshToken = tokenPayload.refreshToken ?? existingConnection?.refresh_token ?? null;
    const now = new Date().toISOString();

    const row: Record<string, unknown> = {
      user_id: user.id,
      google_email: googleEmail ?? null,
      google_calendar_id: "primary",
      access_token: tokenPayload.accessToken,
      refresh_token: refreshToken,
      token_type: tokenPayload.tokenType ?? null,
      scope: tokenPayload.scope ?? null,
      expires_at: tokenPayload.expiresAt ?? null,
      created_at: now,
      updated_at: now,
    };
    if (existingConnection?.id) {
      row.id = existingConnection.id;
    }

    const { error: upsertError } = await supabaseAdmin
      .from("google_calendar_connections")
      .upsert(row, { onConflict: "user_id" });

    if (upsertError) throw upsertError;

    return redirectWithStatus(res, redirectTarget, "connected");
  } catch (error) {
    return redirectWithStatus(
      res,
      redirectTarget,
      "error",
      error instanceof Error ? error.message : "Failed to connect Google Calendar."
    );
  }
}
