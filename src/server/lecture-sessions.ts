import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import type { AppRole } from "@/types/auth";
import { isValidTimezone } from "@/lib/timezone";
import { refreshGoogleAccessToken } from "@/server/google-calendar";

type SessionScopeType = "classroom" | "one_to_one";

type ClassroomRecord = {
  id: string;
  name: string;
  subject: string | null;
  workspace_id: string | null;
  teacher_id: string;
};

type StudentAssignmentRecord = {
  workspace_id: string;
  tutor_id: string;
  student_id: string;
};

export type SessionRecord = {
  id: string;
  classroom_id: string | null;
  workspace_id: string;
  tutor_id: string;
  created_by_user_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  meeting_provider: string;
  meeting_url: string | null;
  external_event_id: string | null;
  google_calendar_id: string | null;
  completed_at: string | null;
  completed_by_user_id?: string | null;
  scope_type: SessionScopeType;
  student_id: string | null;
  series_id: string | null;
  occurrence_index: number | null;
  created_at: string;
  updated_at: string;
};

export type SessionNoteRecord = {
  id: string;
  session_id: string;
  workspace_id: string;
  tutor_id: string;
  content: string;
  created_by_user_id: string;
  updated_by_user_id: string;
  created_at: string;
  updated_at: string;
};

export type SessionSeriesRecord = {
  id: string;
  workspace_id: string;
  scope_type: SessionScopeType;
  classroom_id: string | null;
  student_id: string | null;
  tutor_id: string;
  created_by_user_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  recurrence_frequency: "daily" | "weekly";
  recurrence_interval: number;
  occurrences_count: number;
  created_at: string;
  updated_at: string;
};

type GoogleConnectionRecord = {
  id: string;
  user_id: string;
  google_email: string | null;
  google_calendar_id: string;
  access_token: string;
  refresh_token: string | null;
  token_type: string | null;
  scope: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

type LectureCreationContext = {
  scopeType: SessionScopeType;
  workspaceId: string;
  tutorId: string;
  classroom: ClassroomRecord | null;
  studentId: string | null;
  studentName: string | null;
  attendeeEmails: string[];
};

function assertAdminClient() {
  if (!supabaseAdmin) {
    throw new Error("Server configuration error");
  }
  return supabaseAdmin;
}

export async function getCallerRole(userId: string): Promise<AppRole | null> {
  const admin = assertAdminClient();
  const { data, error } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return (data?.role as AppRole | undefined) ?? null;
}

async function getClassroomById(classroomId: string): Promise<ClassroomRecord> {
  const admin = assertAdminClient();
  const { data, error } = await admin
    .from("classrooms")
    .select("id, name, subject, workspace_id, teacher_id")
    .eq("id", classroomId)
    .single();

  if (error || !data) {
    throw new Error("Classroom not found");
  }

  return data as ClassroomRecord;
}

async function getOneToOneRoom(
  studentId: string,
  tutorId?: string
): Promise<StudentAssignmentRecord> {
  const admin = assertAdminClient();
  let query = admin
    .from("one_to_one_rooms")
    .select("workspace_id, tutor_id, student_id")
    .eq("student_id", studentId);

  if (tutorId) {
    query = query.eq("tutor_id", tutorId);
  }

  const { data, error } = await query.limit(1);

  if (error || !data?.length) {
    throw new Error("1v1 room not found for this student.");
  }

  return data[0] as StudentAssignmentRecord;
}

async function getStudentProfile(studentId: string) {
  const admin = assertAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("display_name, email")
    .eq("user_id", studentId)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function getStudentEmail(studentId: string) {
  const profile = await getStudentProfile(studentId);
  return profile?.email?.trim().toLowerCase() ?? null;
}

async function isOwnerOfWorkspace(userId: string, workspaceId: string) {
  const admin = assertAdminClient();
  const { data, error } = await admin
    .from("workspaces")
    .select("id")
    .eq("id", workspaceId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

async function isTutorAssignedToClassroom(userId: string, classroom: ClassroomRecord) {
  if (classroom.teacher_id === userId) return true;

  const admin = assertAdminClient();
  const { data, error } = await admin
    .from("classroom_tutors")
    .select("classroom_id")
    .eq("classroom_id", classroom.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

/**
 * Session creation is owner-only — POST /api/sessions rejects any non-admin caller before
 * reaching here. The `teacher` branches below are kept as defence in depth.
 */
export async function resolveLectureCreationContext(params: {
  callerId: string;
  callerRole: AppRole;
  scopeType: SessionScopeType;
  classroomId?: string;
  studentId?: string;
  requestedTutorId?: string;
}): Promise<LectureCreationContext> {
  if (params.scopeType === "classroom") {
    if (!params.classroomId) {
      throw new Error("classroomId is required for classroom sessions.");
    }

    const classroom = await getClassroomById(params.classroomId);

    if (!classroom.workspace_id) {
      throw new Error("This classroom is not linked to a workspace.");
    }

    let tutorId = params.requestedTutorId ?? classroom.teacher_id;

    if (params.callerRole === "admin") {
      const ownsWorkspace = await isOwnerOfWorkspace(params.callerId, classroom.workspace_id);
      if (!ownsWorkspace) {
        throw new Error("You do not have access to schedule lectures for this classroom.");
      }

      const tutorIsAssigned = await isTutorAssignedToClassroom(tutorId, classroom);
      if (!tutorIsAssigned) {
        throw new Error("Selected tutor is not assigned to this classroom.");
      }
    } else if (params.callerRole === "teacher") {
      const tutorIsAssigned = await isTutorAssignedToClassroom(params.callerId, classroom);
      if (!tutorIsAssigned) {
        throw new Error("You do not teach this classroom.");
      }

      tutorId = params.callerId;
    } else {
      throw new Error("You do not have permission to schedule lectures.");
    }

    const attendeeEmails = await getActiveClassroomStudentEmails(classroom.id);

    return {
      scopeType: "classroom",
      workspaceId: classroom.workspace_id,
      tutorId,
      classroom,
      studentId: null,
      studentName: null,
      attendeeEmails,
    };
  }

  if (!params.studentId) {
    throw new Error("studentId is required for one-to-one sessions.");
  }

  let assignment = await getOneToOneRoom(params.studentId, params.requestedTutorId);
  let tutorId = assignment.tutor_id;

  if (params.callerRole === "admin") {
    const ownsWorkspace = await isOwnerOfWorkspace(params.callerId, assignment.workspace_id);
    if (!ownsWorkspace) {
      throw new Error("You do not have access to schedule lectures for this student.");
    }
  } else if (params.callerRole === "teacher") {
    assignment = await getOneToOneRoom(params.studentId, params.callerId);
    tutorId = params.callerId;
  } else {
    throw new Error("You do not have permission to schedule lectures.");
  }

  const studentProfile = await getStudentProfile(params.studentId);
  const attendeeEmails = studentProfile?.email ? [studentProfile.email] : [];

  return {
    scopeType: "one_to_one",
    workspaceId: assignment.workspace_id,
    tutorId,
    classroom: null,
    studentId: assignment.student_id,
    studentName: studentProfile?.display_name ?? null,
    attendeeEmails,
  };
}

export async function getSessionById(sessionId: string): Promise<SessionRecord> {
  const admin = assertAdminClient();
  const { data, error } = await admin
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (error || !data) {
    throw new Error("Lecture session not found.");
  }

  return data as SessionRecord;
}

export async function getSessionSeriesById(seriesId: string): Promise<SessionSeriesRecord> {
  const admin = assertAdminClient();
  const { data, error } = await admin
    .from("session_series")
    .select("*")
    .eq("id", seriesId)
    .single();

  if (error || !data) {
    throw new Error("Lecture series not found.");
  }

  return data as SessionSeriesRecord;
}

export async function getSessionsBySeriesId(seriesId: string) {
  const admin = assertAdminClient();
  const { data, error } = await admin
    .from("sessions")
    .select("*")
    .eq("series_id", seriesId)
    .order("occurrence_index", { ascending: true });

  if (error) throw error;
  return (data ?? []) as SessionRecord[];
}

export async function canManageLectureSession(params: {
  callerId: string;
  callerRole: AppRole;
  session: SessionRecord;
}) {
  if (params.callerRole === "admin") {
    return isOwnerOfWorkspace(params.callerId, params.session.workspace_id);
  }

  if (params.callerRole === "teacher") {
    return params.session.tutor_id === params.callerId;
  }

  return false;
}

export async function canManageLectureOutcome(params: {
  callerId: string;
  callerRole: AppRole;
  session: SessionRecord;
}) {
  if (params.callerRole === "teacher" && params.session.tutor_id === params.callerId) return true;
  if (params.callerRole === "admin") {
    return isOwnerOfWorkspace(params.callerId, params.session.workspace_id);
  }
  return false;
}

export async function getActiveClassroomStudentEmails(classroomId: string) {
  const admin = assertAdminClient();
  const { data: enrollments, error: enrollmentsError } = await admin
    .from("enrollments")
    .select("student_id")
    .eq("classroom_id", classroomId)
    .eq("status", "active");

  if (enrollmentsError) throw enrollmentsError;

  const studentIds = Array.from(
    new Set((enrollments ?? []).map((enrollment) => enrollment.student_id))
  );

  if (studentIds.length === 0) return [];

  const { data: profiles, error: profileError } = await admin
    .from("profiles")
    .select("email")
    .in("user_id", studentIds)
    .not("email", "is", null);

  if (profileError) throw profileError;

  return Array.from(
    new Set(
      (profiles ?? [])
        .map((profile) => profile.email?.trim().toLowerCase())
        .filter((email): email is string => Boolean(email))
    )
  );
}

export async function getSessionAttendeeEmails(session: Pick<SessionRecord, "scope_type" | "classroom_id" | "student_id">) {
  if (session.scope_type === "one_to_one") {
    if (!session.student_id) return [];
    const studentEmail = await getStudentEmail(session.student_id);
    return studentEmail ? [studentEmail] : [];
  }

  if (!session.classroom_id) return [];
  return getActiveClassroomStudentEmails(session.classroom_id);
}

export async function getSessionNoteBySessionId(sessionId: string) {
  const admin = assertAdminClient();
  const { data, error } = await admin
    .from("session_notes")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) throw error;
  return (data as SessionNoteRecord | null) ?? null;
}

export function buildRecurringOccurrences(params: {
  startsAt: string;
  endsAt: string;
  frequency: "daily" | "weekly";
  interval: number;
  occurrencesCount: number;
  timezone?: string;
}) {
  const startsAtDate = new Date(params.startsAt);
  const endsAtDate = new Date(params.endsAt);
  const durationMs = endsAtDate.getTime() - startsAtDate.getTime();
  const timezone = params.timezone && isValidTimezone(params.timezone) ? params.timezone : "UTC";

  return Array.from({ length: params.occurrencesCount }, (_, index) => {
    let occurrenceStart = new Date(startsAtDate);
    if (index > 0) {
      const dayMultiplier = params.frequency === "weekly" ? 7 : 1;
      const days = index * params.interval * dayMultiplier;
      // Advance calendar days on the *wall clock* in the scheduler's zone, then re-anchor.
      // Adding a flat 24h/168h in UTC would shift a 9am local series by an hour across a
      // DST boundary. The wall clock is carried through a Date as if it were UTC purely so
      // we can use calendar arithmetic on it — the value is naive, not an instant.
      const naive = new Date(`${formatInTimeZone(startsAtDate, timezone, "yyyy-MM-dd'T'HH:mm:ss")}Z`);
      naive.setUTCDate(naive.getUTCDate() + days);
      occurrenceStart = fromZonedTime(naive.toISOString().slice(0, 19), timezone);
    }

    const occurrenceEnd = new Date(occurrenceStart.getTime() + durationMs);
    return {
      occurrenceIndex: index,
      startsAt: occurrenceStart.toISOString(),
      endsAt: occurrenceEnd.toISOString(),
    };
  });
}

export async function getValidGoogleConnection(userId: string) {
  const admin = assertAdminClient();
  const { data, error } = await admin
    .from("google_calendar_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error("This tutor has not connected Google Calendar yet.");
  }

  const connection = data as GoogleConnectionRecord;
  const expiresAt = connection.expires_at ? new Date(connection.expires_at).getTime() : null;
  const isExpired = expiresAt != null && expiresAt <= Date.now() + 60_000;

  if (!isExpired) {
    return {
      accessToken: connection.access_token,
      calendarId: connection.google_calendar_id || "primary",
      email: connection.google_email,
    };
  }

  if (!connection.refresh_token) {
    throw new Error("Google Calendar connection expired. Please reconnect Google Calendar.");
  }

  const refreshed = await refreshGoogleAccessToken(connection.refresh_token);
  const { error: updateError } = await admin
    .from("google_calendar_connections")
    .update({
      access_token: refreshed.accessToken,
      expires_at: refreshed.expiresAt,
      scope: refreshed.scope,
      token_type: refreshed.tokenType,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id);

  if (updateError) throw updateError;

  return {
    accessToken: refreshed.accessToken,
    calendarId: connection.google_calendar_id || "primary",
    email: connection.google_email,
  };
}
