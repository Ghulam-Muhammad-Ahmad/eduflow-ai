import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getCallerRole } from "@/server/lecture-sessions";
import { isGoogleCalendarConfigured } from "@/server/google-calendar";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { user, error: authError } = await getAuthUser(req, res);
  if (authError || !user) {
    return res.status(401).json({ error: authError?.message ?? "Unauthorized" });
  }

  const configured = isGoogleCalendarConfigured();
  const role = await getCallerRole(user.id);
  if (role !== "teacher" && role !== "admin" && role !== "student") {
    return res.status(200).json({
      configured,
      connected: false,
    });
  }

  if (!configured || !supabaseAdmin) {
    return res.status(200).json({
      configured,
      connected: false,
    });
  }

  const { data, error } = await supabaseAdmin
    .from("google_calendar_connections")
    .select("google_email, google_calendar_id, expires_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({
    configured,
    connected: Boolean(data),
    email: data?.google_email ?? null,
    calendarId: data?.google_calendar_id ?? null,
    expiresAt: data?.expires_at ?? null,
  });
}
