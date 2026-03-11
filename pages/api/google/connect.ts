import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { getCallerRole } from "@/server/lecture-sessions";
import {
  buildGoogleCalendarConnectUrl,
  isGoogleCalendarConfigured,
} from "@/server/google-calendar";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { user, error: authError } = await getAuthUser(req, res);
  if (authError || !user) {
    return res.status(401).json({ error: authError?.message ?? "Unauthorized" });
  }

  const role = await getCallerRole(user.id);
  if (role !== "teacher" && role !== "admin" && role !== "student") {
    return res.status(403).json({ error: "Only owners, tutors, and students can connect Google Calendar." });
  }

  if (!isGoogleCalendarConfigured()) {
    return res.status(503).json({ error: "Google Calendar is not configured on this server." });
  }

  const defaultRedirect =
    role === "student" ? "/dashboard/student" : "/dashboard/teacher";
  const redirectTo =
    typeof req.query.redirectTo === "string" && req.query.redirectTo.startsWith("/")
      ? req.query.redirectTo
      : defaultRedirect;

  const state = Buffer.from(
    JSON.stringify({
      redirectTo,
    })
  ).toString("base64url");

  const url = buildGoogleCalendarConnectUrl(req, state);
  return res.redirect(url);
}
