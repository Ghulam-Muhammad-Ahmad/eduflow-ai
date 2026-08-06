import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import {
  canManageLectureSession,
  getCallerRole,
  getSessionAttendeeEmails,
  getSessionById,
  getSessionSeriesById,
  getSessionsBySeriesId,
  getValidGoogleConnection,
} from "@/server/lecture-sessions";
import {
  createGoogleMeetEvent,
  deleteGoogleCalendarEvent,
  updateGoogleMeetEvent,
} from "@/server/google-calendar";

type UpdateLectureBody = {
  title?: unknown;
  description?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
};

function parseIsoDate(value: unknown, fieldName: string) {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} is required.`);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} must be a valid date.`);
  }

  return parsed.toISOString();
}

function validateUpdateBody(body: UpdateLectureBody) {
  if (typeof body.title !== "string" || body.title.trim().length === 0) {
    throw new Error("title is required.");
  }

  return {
    title: body.title.trim(),
    description:
      typeof body.description === "string" && body.description.trim().length > 0
        ? body.description.trim()
        : null,
    startsAt: parseIsoDate(body.startsAt, "startsAt"),
    endsAt: parseIsoDate(body.endsAt, "endsAt"),
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const sessionId = typeof req.query.id === "string" ? req.query.id : null;
  const deleteMode = req.query.mode === "series" ? "series" : "single";
  if (!sessionId) {
    return res.status(400).json({ error: "Session id is required." });
  }

  if (req.method !== "PATCH" && req.method !== "DELETE") {
    res.setHeader("Allow", "PATCH, DELETE");
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
      return res.status(403).json({ error: "Only owners and tutors can manage lectures." });
    }

    const session = await getSessionById(sessionId);
    const canManage = await canManageLectureSession({
      callerId: user.id,
      callerRole,
      session,
    });

    if (!canManage) {
      return res.status(403).json({ error: "You do not have access to manage this lecture." });
    }

    if (req.method === "DELETE") {
      if (deleteMode === "series") {
        if (!session.series_id) {
          return res.status(400).json({ error: "This lecture is not part of a recurring series." });
        }

        await getSessionSeriesById(session.series_id);
        const seriesSessions = await getSessionsBySeriesId(session.series_id);
        const googleConnection = await getValidGoogleConnection(session.tutor_id);

        for (const seriesSession of seriesSessions) {
          if (!seriesSession.external_event_id) continue;
          await deleteGoogleCalendarEvent({
            accessToken: googleConnection.accessToken,
            calendarId: seriesSession.google_calendar_id || googleConnection.calendarId,
            eventId: seriesSession.external_event_id,
          }).catch(() => undefined);
        }

        const now = new Date().toISOString();
        const { error: seriesUpdateError } = await supabaseAdmin
          .from("sessions")
          .update({
            status: "cancelled",
            updated_at: now,
          })
          .eq("series_id", session.series_id)
          .neq("status", "cancelled");

        if (seriesUpdateError) throw seriesUpdateError;

        await supabaseAdmin
          .from("session_series")
          .update({ updated_at: now })
          .eq("id", session.series_id);

        return res.status(200).json({ success: true, cancelledCount: seriesSessions.length });
      }

      if (session.external_event_id) {
        const googleConnection = await getValidGoogleConnection(session.tutor_id);
        await deleteGoogleCalendarEvent({
          accessToken: googleConnection.accessToken,
          calendarId: session.google_calendar_id || googleConnection.calendarId,
          eventId: session.external_event_id,
        });
      }

      const { error: updateError } = await supabaseAdmin
        .from("sessions")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.id);

      if (updateError) throw updateError;
      return res.status(200).json({ success: true });
    }

    const input = validateUpdateBody((req.body ?? {}) as UpdateLectureBody);
    if (new Date(input.endsAt).getTime() <= new Date(input.startsAt).getTime()) {
      return res.status(400).json({ error: "The lecture end time must be after the start time." });
    }

    const attendeeEmails = await getSessionAttendeeEmails(session);
    const googleConnection = await getValidGoogleConnection(session.tutor_id);

    const googleEvent = session.external_event_id
      ? await updateGoogleMeetEvent({
          accessToken: googleConnection.accessToken,
          calendarId: session.google_calendar_id || googleConnection.calendarId,
          eventId: session.external_event_id,
          title: input.title,
          description: input.description,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          timezone: (session as { timezone?: string | null }).timezone ?? null,
          attendeeEmails,
        })
      : await createGoogleMeetEvent({
          accessToken: googleConnection.accessToken,
          calendarId: session.google_calendar_id || googleConnection.calendarId,
          title: input.title,
          description: input.description,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          timezone: (session as { timezone?: string | null }).timezone ?? null,
          attendeeEmails,
        });

    const { data: updatedSession, error: updateError } = await supabaseAdmin
      .from("sessions")
      .update({
        title: input.title,
        description: input.description,
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        meeting_url: googleEvent.meetingUrl,
        external_event_id: googleEvent.eventId,
        google_calendar_id: googleEvent.calendarId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.id)
      .select("*")
      .single();

    if (updateError) throw updateError;

    return res.status(200).json({ session: updatedSession });
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to update lecture.",
    });
  }
}
