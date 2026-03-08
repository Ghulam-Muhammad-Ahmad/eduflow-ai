import { supabaseAdmin } from "@/integrations/supabase/admin";
import type { AppRole } from "@/types/auth";
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

type TutorContractRecord = {
  workspace_id: string;
  tutor_id: string;
  pay_type: "hourly" | "per_session";
  rate_amount: number;
  rate_currency: string;
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

export type SessionFinancialMockRecord = {
  id: string;
  session_id: string;
  workspace_id: string;
  tutor_id: string;
  tutor_rate_amount: number;
  tutor_rate_currency: string;
  tutor_rate_type: "hourly" | "per_session";
  student_charge_amount: number;
  student_charge_currency: string;
  student_charge_type: "hourly" | "per_session" | "per_student";
  created_by_user_id: string;
  updated_by_user_id: string;
  created_at: string;
  updated_at: string;
};

export type CurrencyTotal = {
  currency: string;
  amount: number;
};

export type MockFinancialLineItem = {
  sessionId: string;
  title: string;
  status: string;
  scopeType: SessionScopeType;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  participantCount: number;
  tutorPayrollAmount: number;
  tutorPayrollCurrency: string;
  studentChargeAmount: number;
  studentChargeCurrency: string;
  source: "contract_default" | "session_override";
};

export type MockFinancialSummary = {
  completedSessions: number;
  scheduledSessions: number;
  completedDurationMinutes: number;
  participantCountTotal: number;
  tutorPayrollByCurrency: CurrencyTotal[];
  studentChargesByCurrency: CurrencyTotal[];
  lineItems: MockFinancialLineItem[];
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

async function getStudentAssignmentById(
  studentId: string,
  tutorId?: string
): Promise<StudentAssignmentRecord> {
  const admin = assertAdminClient();
  let query = admin
    .from("tutor_student_assignments")
    .select("workspace_id, tutor_id, student_id")
    .eq("student_id", studentId);

  if (tutorId) {
    query = query.eq("tutor_id", tutorId);
  }

  const { data, error } = await query.maybeSingle();

  if (error || !data) {
    throw new Error("Student assignment not found.");
  }

  return data as StudentAssignmentRecord;
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

  let assignment = await getStudentAssignmentById(params.studentId, params.requestedTutorId);
  let tutorId = assignment.tutor_id;

  if (params.callerRole === "admin") {
    const ownsWorkspace = await isOwnerOfWorkspace(params.callerId, assignment.workspace_id);
    if (!ownsWorkspace) {
      throw new Error("You do not have access to schedule lectures for this student.");
    }
  } else if (params.callerRole === "teacher") {
    assignment = await getStudentAssignmentById(params.studentId, params.callerId);
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

export function canManageLectureOutcome(params: {
  callerId: string;
  callerRole: AppRole;
  session: SessionRecord;
}) {
  return params.callerRole === "teacher" && params.session.tutor_id === params.callerId;
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

export async function getSessionFinancialMockBySessionId(sessionId: string) {
  const admin = assertAdminClient();
  const { data, error } = await admin
    .from("session_financial_mock")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) throw error;
  return (data as SessionFinancialMockRecord | null) ?? null;
}

export async function getSessionFinancialMocksBySessionIds(sessionIds: string[]) {
  if (sessionIds.length === 0) return {} as Record<string, SessionFinancialMockRecord>;

  const admin = assertAdminClient();
  const { data, error } = await admin
    .from("session_financial_mock")
    .select("*")
    .in("session_id", sessionIds);

  if (error) throw error;

  return Object.fromEntries(
    ((data ?? []) as SessionFinancialMockRecord[]).map((item) => [item.session_id, item])
  );
}

async function getTutorContractForSession(workspaceId: string, tutorId: string) {
  const admin = assertAdminClient();
  const { data, error } = await admin
    .from("tutor_contracts")
    .select("workspace_id, tutor_id, pay_type, rate_amount, rate_currency")
    .eq("workspace_id", workspaceId)
    .eq("tutor_id", tutorId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as TutorContractRecord | null) ?? null;
}

export async function getActiveClassroomStudentCount(classroomId: string) {
  const admin = assertAdminClient();
  const { count, error } = await admin
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .eq("classroom_id", classroomId)
    .eq("status", "active");

  if (error) throw error;
  return count ?? 0;
}

export async function getSessionParticipantCount(
  session: Pick<SessionRecord, "scope_type" | "classroom_id" | "student_id">
) {
  if (session.scope_type === "one_to_one") {
    return session.student_id ? 1 : 0;
  }

  if (!session.classroom_id) return 0;
  return getActiveClassroomStudentCount(session.classroom_id);
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function amountFromRate(params: {
  amount: number;
  type: "hourly" | "per_session" | "per_student";
  durationMinutes: number;
  participantCount: number;
}) {
  if (params.type === "per_session") return roundCurrency(params.amount);
  if (params.type === "per_student") {
    return roundCurrency(params.amount * params.participantCount);
  }

  return roundCurrency(params.amount * (params.durationMinutes / 60));
}

function sumCurrencyTotals(items: Array<{ currency: string; amount: number }>) {
  const totals = new Map<string, number>();

  for (const item of items) {
    const currency = item.currency.trim().toUpperCase();
    totals.set(currency, roundCurrency((totals.get(currency) ?? 0) + item.amount));
  }

  return Array.from(totals.entries()).map(([currency, amount]) => ({
    currency,
    amount,
  }));
}

export async function buildMockFinancialSummary(
  sessions: SessionRecord[],
  financialMocks: Record<string, SessionFinancialMockRecord>
): Promise<MockFinancialSummary> {
  const lineItems: MockFinancialLineItem[] = [];
  const contractCache = new Map<string, TutorContractRecord | null>();

  for (const session of sessions) {
    const durationMinutes = Math.max(
      0,
      Math.round(
        (new Date(session.ends_at).getTime() - new Date(session.starts_at).getTime()) / 60_000
      )
    );
    const participantCount = await getSessionParticipantCount(session);
    const financialMock = financialMocks[session.id] ?? null;
    const contractKey = `${session.workspace_id}:${session.tutor_id}`;

    if (!contractCache.has(contractKey)) {
      contractCache.set(
        contractKey,
        await getTutorContractForSession(session.workspace_id, session.tutor_id)
      );
    }

    const contract = contractCache.get(contractKey) ?? null;
    const tutorRateAmount = Number(
      financialMock?.tutor_rate_amount ?? contract?.rate_amount ?? 0
    );
    const tutorRateCurrency = (
      financialMock?.tutor_rate_currency ??
      contract?.rate_currency ??
      "GBP"
    ).trim().toUpperCase();
    const tutorRateType =
      financialMock?.tutor_rate_type ?? contract?.pay_type ?? "hourly";

    const studentChargeAmount = Number(financialMock?.student_charge_amount ?? 0);
    const studentChargeCurrency = (
      financialMock?.student_charge_currency ?? tutorRateCurrency
    ).trim().toUpperCase();
    const studentChargeType = financialMock?.student_charge_type ?? "per_session";

    lineItems.push({
      sessionId: session.id,
      title: session.title,
      status: session.status,
      scopeType: session.scope_type,
      startsAt: session.starts_at,
      endsAt: session.ends_at,
      durationMinutes,
      participantCount,
      tutorPayrollAmount: amountFromRate({
        amount: tutorRateAmount,
        type: tutorRateType,
        durationMinutes,
        participantCount,
      }),
      tutorPayrollCurrency: tutorRateCurrency,
      studentChargeAmount: amountFromRate({
        amount: studentChargeAmount,
        type: studentChargeType,
        durationMinutes,
        participantCount,
      }),
      studentChargeCurrency: studentChargeCurrency,
      source: financialMock ? "session_override" : "contract_default",
    });
  }

  const completedLineItems = lineItems.filter((item) => item.status === "completed");

  return {
    completedSessions: sessions.filter((session) => session.status === "completed").length,
    scheduledSessions: sessions.filter((session) => session.status === "scheduled").length,
    completedDurationMinutes: completedLineItems.reduce(
      (total, item) => total + item.durationMinutes,
      0
    ),
    participantCountTotal: completedLineItems.reduce(
      (total, item) => total + item.participantCount,
      0
    ),
    tutorPayrollByCurrency: sumCurrencyTotals(
      completedLineItems.map((item) => ({
        currency: item.tutorPayrollCurrency,
        amount: item.tutorPayrollAmount,
      }))
    ),
    studentChargesByCurrency: sumCurrencyTotals(
      completedLineItems.map((item) => ({
        currency: item.studentChargeCurrency,
        amount: item.studentChargeAmount,
      }))
    ),
    lineItems,
  };
}

export function buildRecurringOccurrences(params: {
  startsAt: string;
  endsAt: string;
  frequency: "daily" | "weekly";
  interval: number;
  occurrencesCount: number;
}) {
  const startsAtDate = new Date(params.startsAt);
  const endsAtDate = new Date(params.endsAt);
  const durationMs = endsAtDate.getTime() - startsAtDate.getTime();

  return Array.from({ length: params.occurrencesCount }, (_, index) => {
    const occurrenceStart = new Date(startsAtDate);
    if (index > 0) {
      const dayMultiplier = params.frequency === "weekly" ? 7 : 1;
      occurrenceStart.setUTCDate(
        occurrenceStart.getUTCDate() + index * params.interval * dayMultiplier
      );
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
