import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import {
  buildRecurringOccurrences,
  getCallerRole,
  getValidGoogleConnection,
  resolveLectureCreationContext,
} from "@/server/lecture-sessions";
import {
  createGoogleMeetEvent,
  deleteGoogleCalendarEvent,
} from "@/server/google-calendar";

type RecurrenceFrequency = "daily" | "weekly";
type SessionScopeType = "classroom" | "one_to_one";

type CreateLectureBody = {
  scopeType?: unknown;
  classroomId?: unknown;
  studentId?: unknown;
  tutorId?: unknown;
  title?: unknown;
  description?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
  recurrenceFrequency?: unknown;
  recurrenceInterval?: unknown;
  occurrencesCount?: unknown;
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

function validateCreateBody(body: CreateLectureBody) {
  if (typeof body.title !== "string" || body.title.trim().length === 0) {
    throw new Error("title is required.");
  }

  const scopeType: SessionScopeType =
    body.scopeType === "one_to_one" ? "one_to_one" : "classroom";

  if (scopeType === "classroom") {
    if (typeof body.classroomId !== "string" || body.classroomId.length === 0) {
      throw new Error("classroomId is required.");
    }
  } else if (typeof body.studentId !== "string" || body.studentId.length === 0) {
    throw new Error("studentId is required.");
  }

  const recurrenceFrequency =
    body.recurrenceFrequency === "daily" || body.recurrenceFrequency === "weekly"
      ? (body.recurrenceFrequency as RecurrenceFrequency)
      : null;

  const recurrenceInterval =
    typeof body.recurrenceInterval === "number" &&
    Number.isInteger(body.recurrenceInterval) &&
    body.recurrenceInterval > 0
      ? body.recurrenceInterval
      : 1;

  const occurrencesCount =
    typeof body.occurrencesCount === "number" &&
    Number.isInteger(body.occurrencesCount) &&
    body.occurrencesCount > 1
      ? body.occurrencesCount
      : 1;

  return {
    scopeType,
    classroomId: scopeType === "classroom" ? (body.classroomId as string) : undefined,
    studentId: scopeType === "one_to_one" ? (body.studentId as string) : undefined,
    tutorId: typeof body.tutorId === "string" && body.tutorId.length > 0 ? body.tutorId : undefined,
    title: body.title.trim(),
    description:
      typeof body.description === "string" && body.description.trim().length > 0
        ? body.description.trim()
        : null,
    startsAt: parseIsoDate(body.startsAt, "startsAt"),
    endsAt: parseIsoDate(body.endsAt, "endsAt"),
    recurrenceFrequency,
    recurrenceInterval,
    occurrencesCount,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
    if (callerRole !== "admin" && callerRole !== "teacher") {
      return res.status(403).json({ error: "Only owners and tutors can schedule lectures." });
    }

    const input = validateCreateBody((req.body ?? {}) as CreateLectureBody);
    if (new Date(input.endsAt).getTime() <= new Date(input.startsAt).getTime()) {
      return res.status(400).json({ error: "The lecture end time must be after the start time." });
    }

    const context = await resolveLectureCreationContext({
      callerId: user.id,
      callerRole,
      scopeType: input.scopeType,
      classroomId: input.classroomId,
      studentId: input.studentId,
      requestedTutorId: input.tutorId,
    });

    const googleConnection = await getValidGoogleConnection(context.tutorId);
    const now = new Date().toISOString();

    let seriesId: string | null = null;
    const recurring =
      input.recurrenceFrequency != null && input.occurrencesCount > 1;

    if (recurring) {
      const { data: series, error: seriesError } = await supabaseAdmin
        .from("session_series")
        .insert({
          workspace_id: context.workspaceId,
          scope_type: context.scopeType,
          classroom_id: context.classroom?.id ?? null,
          student_id: context.studentId,
          tutor_id: context.tutorId,
          created_by_user_id: user.id,
          title: input.title,
          description: input.description,
          starts_at: input.startsAt,
          ends_at: input.endsAt,
          recurrence_frequency: input.recurrenceFrequency!,
          recurrence_interval: input.recurrenceInterval,
          occurrences_count: input.occurrencesCount,
          created_at: now,
          updated_at: now,
        })
        .select("id")
        .single();

      if (seriesError || !series) {
        throw seriesError ?? new Error("Failed to create lecture series.");
      }

      seriesId = series.id;
    }

    const occurrences = recurring
      ? buildRecurringOccurrences({
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          frequency: input.recurrenceFrequency!,
          interval: input.recurrenceInterval,
          occurrencesCount: input.occurrencesCount,
        })
      : [{ occurrenceIndex: 0, startsAt: input.startsAt, endsAt: input.endsAt }];

    const createdGoogleEvents: Array<{ eventId: string | null; calendarId: string }> = [];

    try {
      const sessionRows = [];

      for (const occurrence of occurrences) {
        const googleEvent = await createGoogleMeetEvent({
          accessToken: googleConnection.accessToken,
          calendarId: googleConnection.calendarId,
          title: input.title,
          description: input.description,
          startsAt: occurrence.startsAt,
          endsAt: occurrence.endsAt,
          attendeeEmails: context.attendeeEmails,
        });

        createdGoogleEvents.push({
          eventId: googleEvent.eventId,
          calendarId: googleEvent.calendarId,
        });

        sessionRows.push({
          workspace_id: context.workspaceId,
          scope_type: context.scopeType,
          classroom_id: context.classroom?.id ?? null,
          student_id: context.studentId,
          series_id: seriesId,
          occurrence_index: recurring ? occurrence.occurrenceIndex : null,
          tutor_id: context.tutorId,
          created_by_user_id: user.id,
          title: input.title,
          description: input.description,
          starts_at: occurrence.startsAt,
          ends_at: occurrence.endsAt,
          status: "scheduled",
          meeting_provider: "google_meet",
          meeting_url: googleEvent.meetingUrl,
          external_event_id: googleEvent.eventId,
          google_calendar_id: googleEvent.calendarId,
          created_at: now,
          updated_at: now,
        });
      }

      const { data: sessions, error: insertError } = await supabaseAdmin
        .from("sessions")
        .insert(sessionRows)
        .select("*")
        .order("starts_at", { ascending: true });

      if (insertError) {
        throw insertError;
      }

      return res.status(200).json({
        session: sessions?.[0] ?? null,
        sessions: sessions ?? [],
        seriesId,
      });
    } catch (error) {
      for (const googleEvent of createdGoogleEvents) {
        if (!googleEvent.eventId) continue;
        await deleteGoogleCalendarEvent({
          accessToken: googleConnection.accessToken,
          calendarId: googleEvent.calendarId || googleConnection.calendarId,
          eventId: googleEvent.eventId,
        }).catch(() => undefined);
      }

      if (seriesId) {
        const { error: rollbackSeriesError } = await supabaseAdmin
          .from("session_series")
          .delete()
          .eq("id", seriesId);

        if (rollbackSeriesError) {
          // Ignore rollback cleanup failures so the original error is preserved.
        }
      }

      throw error;
    }
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to schedule lecture.",
    });
  }
}
