import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

/**
 * `timezone` is declared here rather than coming from the generated types: it was added by
 * the 20260806120000_session_timezone migration and lands in types.ts on the next
 * `supabase gen types typescript` run.
 */
export type LectureSession = Tables<"sessions"> & { timezone?: string | null };
export type LectureSessionNote = Tables<"session_notes">;
export type LectureSessionFinancialMock = Tables<"session_financial_mock">;
export type SessionScopeType = "classroom" | "one_to_one";
export type RecurrenceFrequency = "daily" | "weekly";
export type TutorRateType = "hourly" | "per_session";
export type StudentChargeType = "hourly" | "per_session" | "per_student";

export type CreateLectureSessionInput = {
  scopeType?: SessionScopeType;
  classroomId?: string;
  studentId?: string;
  tutorId?: string;
  title: string;
  description?: string | null;
  startsAt: string;
  endsAt: string;
  recurrenceFrequency?: RecurrenceFrequency | null;
  recurrenceInterval?: number;
  occurrencesCount?: number;
  /** IANA zone the start/end wall-clock times were entered in. Defaults to UTC server-side. */
  timezone?: string;
};

export type UpdateLectureSessionInput = {
  id: string;
  title: string;
  description?: string | null;
  startsAt: string;
  endsAt: string;
};

export type SaveLectureSessionNoteInput = {
  sessionId: string;
  content: string;
};

export type SaveLectureSessionFinancialInput = {
  sessionId: string;
  tutorRateAmount: number;
  tutorRateCurrency: string;
  tutorRateType: TutorRateType;
  studentChargeAmount: number;
  studentChargeCurrency: string;
  studentChargeType: StudentChargeType;
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
  tutorPayrollByCurrency: Array<{ currency: string; amount: number }>;
  studentChargesByCurrency: Array<{ currency: string; amount: number }>;
  lineItems: MockFinancialLineItem[];
};

export type GoogleCalendarConnectionStatus = {
  configured: boolean;
  connected: boolean;
  email?: string | null;
  calendarId?: string | null;
  expiresAt?: string | null;
};

function getLectureRequestErrorMessage(error: Error) {
  const message = error.message.trim();

  if (
    /not connected Google Calendar/i.test(message) ||
    /Please reconnect Google Calendar/i.test(message) ||
    /Google Calendar connection expired/i.test(message)
  ) {
    return "Connect or reconnect Google Calendar before managing Google Meet lecture events.";
  }

  if (/No Google Meet link is available/i.test(message)) {
    return "This lecture does not have a valid Google Meet link yet. Reconnect Google Calendar and resave the session.";
  }

  return message;
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error((payload as { error?: string }).error ?? "Request failed");
  }
  return payload;
}

function useLectureSessionsQuery(params: {
  scopeType: SessionScopeType;
  classroomId?: string | null;
  studentId?: string | null;
}) {
  return useQuery({
    queryKey: ["lecture-sessions", params.scopeType, params.classroomId, params.studentId],
    queryFn: async (): Promise<LectureSession[]> => {
      if (params.scopeType === "classroom" && !params.classroomId) return [];
      if (params.scopeType === "one_to_one" && !params.studentId) return [];

      let query = supabase
        .from("sessions")
        .select("*")
        .eq("scope_type", params.scopeType)
        .order("starts_at", { ascending: true });

      query =
        params.scopeType === "classroom"
          ? query.eq("classroom_id", params.classroomId!)
          : query.eq("student_id", params.studentId!);

      const { data, error } = await query;

      if (error) throw error;
      return (data ?? []) as LectureSession[];
    },
    enabled:
      (params.scopeType === "classroom" && !!params.classroomId) ||
      (params.scopeType === "one_to_one" && !!params.studentId),
  });
}

export function useClassroomLectureSessions(classroomId: string | null) {
  return useLectureSessionsQuery({
    scopeType: "classroom",
    classroomId,
  });
}

export function useStudentLectureSessions(studentId: string | null) {
  return useLectureSessionsQuery({
    scopeType: "one_to_one",
    studentId,
  });
}

export function useTeacherLectureCalendar(range: { start: Date; end: Date } | null) {
  const { user, role } = useAuth();

  return useQuery({
    queryKey: [
      "teacher-lecture-calendar",
      user?.id,
      range?.start.toISOString(),
      range?.end.toISOString(),
    ],
    queryFn: async (): Promise<LectureSession[]> => {
      if (!user?.id || role !== "teacher" || !range) return [];

      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("tutor_id", user.id)
        .lte("starts_at", range.end.toISOString())
        .gte("ends_at", range.start.toISOString())
        .order("starts_at", { ascending: true });

      if (error) throw error;
      return (data ?? []) as LectureSession[];
    },
    enabled: !!user?.id && role === "teacher" && !!range,
  });
}

export function useWorkspaceLectureSessions(workspaceId: string | null) {
  return useQuery({
    queryKey: ["workspace-lecture-sessions", workspaceId],
    queryFn: async (): Promise<LectureSession[]> => {
      if (!workspaceId) return [];

      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("starts_at", { ascending: true });

      if (error) throw error;
      return (data ?? []) as LectureSession[];
    },
    enabled: !!workspaceId,
  });
}

export function useTeacherAllLectureSessions() {
  const { user, role } = useAuth();

  return useQuery({
    queryKey: ["teacher-all-lecture-sessions", user?.id],
    queryFn: async (): Promise<LectureSession[]> => {
      if (!user?.id || role !== "teacher") return [];

      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("tutor_id", user.id)
        .order("starts_at", { ascending: true });

      if (error) throw error;
      return (data ?? []) as LectureSession[];
    },
    enabled: !!user?.id && role === "teacher",
  });
}

/** All sessions visible to the current student (classroom sessions for enrolled classes + own 1:1 sessions). RLS filters. */
export function useStudentAllLectureSessions() {
  const { user, role } = useAuth();

  return useQuery({
    queryKey: ["student-all-lecture-sessions", user?.id],
    queryFn: async (): Promise<LectureSession[]> => {
      if (!user?.id || role !== "student") return [];

      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .order("starts_at", { ascending: true });

      if (error) throw error;
      return (data ?? []) as LectureSession[];
    },
    enabled: !!user?.id && role === "student",
  });
}

export function useUpcomingClassroomLectureSessions(classroomId: string | null) {
  const sessionsQuery = useClassroomLectureSessions(classroomId);

  const sessions = useMemo(
    () =>
      (sessionsQuery.data ?? []).filter(
        (session) =>
          session.status === "scheduled" &&
          new Date(session.ends_at).getTime() >= Date.now()
      ),
    [sessionsQuery.data]
  );

  return {
    ...sessionsQuery,
    data: sessions,
  };
}

export function useUpcomingStudentLectureSessions(studentId: string | null) {
  const sessionsQuery = useStudentLectureSessions(studentId);

  const sessions = useMemo(
    () =>
      (sessionsQuery.data ?? []).filter(
        (session) =>
          session.status === "scheduled" &&
          new Date(session.ends_at).getTime() >= Date.now()
      ),
    [sessionsQuery.data]
  );

  return {
    ...sessionsQuery,
    data: sessions,
  };
}

export function useLectureSessionNotes(sessionIds: string[], enabled: boolean) {
  const normalizedIds = useMemo(
    () => Array.from(new Set(sessionIds)).filter(Boolean).sort(),
    [sessionIds]
  );

  return useQuery({
    queryKey: ["lecture-session-notes", normalizedIds],
    queryFn: async (): Promise<Record<string, LectureSessionNote>> => {
      if (normalizedIds.length === 0) return {};

      const { data, error } = await supabase
        .from("session_notes")
        .select("*")
        .in("session_id", normalizedIds);

      if (error) throw error;

      return Object.fromEntries(
        (data ?? []).map((note) => [note.session_id, note as LectureSessionNote])
      );
    },
    enabled: enabled && normalizedIds.length > 0,
  });
}

/** Response from GET /api/sessions/[id]/financials (real earning/invoice rows; financial is always null). */
export type SessionFinancialsData = {
  financial: null;
  earningRows: Array<Record<string, unknown>>;
  invoiceRows: Array<Record<string, unknown>>;
};

export function useLectureSessionFinancial(sessionId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["lecture-session-financial", sessionId],
    queryFn: async (): Promise<SessionFinancialsData> => {
      if (!sessionId) return { financial: null, earningRows: [], invoiceRows: [] };
      const response = await fetch(`/api/sessions/${sessionId}/financials`);
      const payload = await readJson<SessionFinancialsData>(response);
      return payload;
    },
    enabled: enabled && !!sessionId,
  });
}

export function useLectureFinancialSummary(filters?: {
  tutorId?: string | null;
  classroomId?: string | null;
  studentId?: string | null;
}) {
  return useQuery({
    queryKey: [
      "lecture-financial-summary",
      filters?.tutorId,
      filters?.classroomId,
      filters?.studentId,
    ],
    queryFn: async (): Promise<MockFinancialSummary> => {
      const params = new URLSearchParams();

      if (filters?.tutorId) params.set("tutorId", filters.tutorId);
      if (filters?.classroomId) params.set("classroomId", filters.classroomId);
      if (filters?.studentId) params.set("studentId", filters.studentId);

      const queryString = params.toString();
      const response = await fetch(
        queryString
          ? `/api/sessions/financial-summary?${queryString}`
          : "/api/sessions/financial-summary"
      );

      const payload = await readJson<{ summary: MockFinancialSummary }>(response);
      return payload.summary;
    },
  });
}

export function useCreateLectureSession() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: CreateLectureSessionInput) => {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      return readJson<{ session: LectureSession }>(response);
    },
    onSuccess: ({ session }) => {
      queryClient.invalidateQueries({ queryKey: ["lecture-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["teacher-lecture-calendar"] });
      queryClient.invalidateQueries({ queryKey: ["workspace-lecture-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["teacher-all-lecture-sessions"] });
      toast({
        title: "Lecture scheduled",
        description:
          session?.series_id != null
            ? "The recurring Google Meet lectures have been created."
            : "The Google Meet lecture has been created.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to schedule lecture",
        description: getLectureRequestErrorMessage(error),
        variant: "destructive",
      });
    },
  });
}

export function useUpdateLectureSession() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: UpdateLectureSessionInput) => {
      const response = await fetch(`/api/sessions/${input.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      return readJson<{ session: LectureSession }>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lecture-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["teacher-lecture-calendar"] });
      queryClient.invalidateQueries({ queryKey: ["workspace-lecture-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["teacher-all-lecture-sessions"] });
      toast({
        title: "Lecture updated",
        description: "The lecture schedule has been updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update lecture",
        description: getLectureRequestErrorMessage(error),
        variant: "destructive",
      });
    },
  });
}

export function useCancelLectureSession() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (session: Pick<LectureSession, "id" | "classroom_id" | "student_id" | "series_id"> & { mode?: "single" | "series" }) => {
      const query = session.mode === "series" ? "?mode=series" : "";
      const response = await fetch(`/api/sessions/${session.id}${query}`, {
        method: "DELETE",
      });

      await readJson<{ success: boolean }>(response);
      return session;
    },
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ["lecture-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["teacher-lecture-calendar"] });
      queryClient.invalidateQueries({ queryKey: ["workspace-lecture-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["teacher-all-lecture-sessions"] });
      toast({
        title: session.mode === "series" ? "Lecture series cancelled" : "Lecture cancelled",
        description:
          session.mode === "series"
            ? "All recurring lectures were removed from Google Meet and marked cancelled."
            : "The lecture has been removed from Google Meet and marked cancelled.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to cancel lecture",
        description: getLectureRequestErrorMessage(error),
        variant: "destructive",
      });
    },
  });
}

export function useCompleteLectureSession() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await fetch(`/api/sessions/${sessionId}/complete`, {
        method: "POST",
      });

      return readJson<{ session: LectureSession }>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lecture-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["teacher-lecture-calendar"] });
      queryClient.invalidateQueries({ queryKey: ["workspace-lecture-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["teacher-all-lecture-sessions"] });
      toast({
        title: "Lecture completed",
        description: "The lecture has been marked completed.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to complete lecture",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useSaveLectureSessionNote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: SaveLectureSessionNoteInput) => {
      const response = await fetch(`/api/sessions/${input.sessionId}/notes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: input.content }),
      });

      return readJson<{ note: LectureSessionNote | null }>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lecture-session-notes"] });
      toast({
        title: "Notes saved",
        description: "Private tutor notes have been updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to save notes",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

/** Mock financials are deprecated; earnings/fees come from contracts and fee configs. Save is a no-op that shows a message. */
export function useSaveLectureSessionFinancial() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: SaveLectureSessionFinancialInput) => {
      const response = await fetch(`/api/sessions/${input.sessionId}/financials`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (response.status === 410) {
        const body = await response.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Mock financials are no longer used.");
      }
      return readJson<{ financial: LectureSessionFinancialMock }>(response);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["lecture-session-financial", variables.sessionId],
      });
      queryClient.invalidateQueries({ queryKey: ["lecture-financial-summary"] });
      toast({
        title: "Saved",
        description: "Financial data has been updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Cannot save",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useGoogleCalendarConnection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const connectionQuery = useQuery({
    queryKey: ["google-calendar-connection"],
    queryFn: async (): Promise<GoogleCalendarConnectionStatus> => {
      const response = await fetch("/api/google/connection", {
        credentials: "include",
      });
      return readJson<GoogleCalendarConnectionStatus>(response);
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/google/disconnect", {
        method: "DELETE",
        credentials: "include",
      });
      return readJson<{ success: boolean }>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-calendar-connection"] });
      toast({
        title: "Google Calendar disconnected",
        description: "Your Google Meet connection has been removed.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to disconnect Google Calendar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const beginConnect = (redirectTo?: string) => {
    const target =
      redirectTo ??
      (typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : "/dashboard/teacher");

    if (typeof window !== "undefined") {
      window.location.href = `/api/google/connect?redirectTo=${encodeURIComponent(target)}`;
    }
  };

  return {
    ...connectionQuery,
    disconnect: disconnectMutation,
    beginConnect,
  };
}
