import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type WeeklyActivityPoint = {
  day: string;
  submissions: number;
  graded: number;
};

export type MonthlyEngagementPoint = {
  month: string;
  submissions: number;
  graded: number;
  engagement: number;
};

export type AssignmentWithStats = {
  id: string;
  title: string;
  due_date: string | null;
  status: string;
  classroom_name: string | null;
  students: number;
  submitted: number;
};

export type GradingProgressItem = {
  id: string;
  title: string;
  completed: number;
  total: number;
  progress: number;
};

/**
 * Fetches all stats and chart data for the teacher dashboard from the database.
 */
export function useTeacherDashboardStats() {
  const { user, role } = useAuth();

  return useQuery({
    queryKey: ["teacher-dashboard-stats", user?.id],
    queryFn: async () => {
      if (!user?.id || role !== "teacher") {
        return {
          documentsCount: 0,
          pendingAssignmentsCount: 0,
          papersGradedCount: 0,
          studentsEnrolledCount: 0,
          classroomsCount: 0,
          assignmentsCount: 0,
          weeklyActivity: [] as WeeklyActivityPoint[],
          monthlyEngagement: [] as MonthlyEngagementPoint[],
          recentAssignments: [] as AssignmentWithStats[],
          gradingProgress: [] as GradingProgressItem[],
          recentDocuments: [] as { id: string; name: string; file_type: string; updated_at: string }[],
        };
      }

      const teacherId = user.id;

      // 1. Teacher's classrooms and enrollment count
      const { data: classrooms } = await supabase
        .from("classrooms")
        .select("id")
        .eq("teacher_id", teacherId);
      const classroomIds = (classrooms ?? []).map((c) => c.id);

      let studentsEnrolledCount = 0;
      if (classroomIds.length > 0) {
        const { count } = await supabase
          .from("enrollments")
          .select("id", { count: "exact", head: true })
          .in("classroom_id", classroomIds)
          .eq("status", "active");
        studentsEnrolledCount = count ?? 0;
      }

      // 2. Assignments (for counts and list)
      const { data: assignments = [] } = await supabase
        .from("assignments")
        .select(`
          id,
          title,
          due_date,
          status,
          classroom_id,
          classrooms ( name )
        `)
        .eq("teacher_id", teacherId)
        .order("created_at", { ascending: false });

      const assignmentIds = assignments.map((a) => a.id);
      const pendingAssignmentsCount = assignments.filter(
        (a) => a.status === "published"
      ).length;

      // 3. Documents count and recent (from documents table by user_id)
      const { data: docs = [] } = await supabase
        .from("documents")
        .select("id, name, file_type, updated_at")
        .eq("user_id", teacherId)
        .order("updated_at", { ascending: false })
        .limit(5);
      const { count: totalDocsCount } = await supabase
        .from("documents")
        .select("id", { count: "exact", head: true })
        .eq("user_id", teacherId);
      const totalDocuments = totalDocsCount ?? 0;

      // 4. Submissions for teacher's assignments (for graded count, weekly, monthly, per-assignment)
      let submissions: {
        id: string;
        assignment_id: string;
        submitted_at: string | null;
        graded_at: string | null;
        status: string;
      }[] = [];
      if (assignmentIds.length > 0) {
        const { data: subData } = await supabase
          .from("submissions")
          .select("id, assignment_id, submitted_at, graded_at, status")
          .in("assignment_id", assignmentIds);
        submissions = subData ?? [];
      }

      const papersGradedCount = submissions.filter((s) => s.graded_at != null).length;

      // 5. Weekly activity (last 7 days)
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const weeklyActivity: WeeklyActivityPoint[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayStart = new Date(d);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(d);
        dayEnd.setHours(23, 59, 59, 999);
        const subs = submissions.filter((s) => {
          const t = s.submitted_at ? new Date(s.submitted_at).getTime() : 0;
          return t >= dayStart.getTime() && t <= dayEnd.getTime();
        });
        const graded = submissions.filter((s) => {
          const t = s.graded_at ? new Date(s.graded_at).getTime() : 0;
          return t >= dayStart.getTime() && t <= dayEnd.getTime();
        });
        weeklyActivity.push({
          day: dayNames[dayStart.getDay()],
          submissions: subs.length,
          graded: graded.length,
        });
      }

      // 6. Monthly engagement (last 6 months) – submissions per month, engagement = % of expected
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthlyEngagement: MonthlyEngagementPoint[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
        const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
        const subs = submissions.filter((s) => {
          const t = s.submitted_at ? new Date(s.submitted_at).getTime() : 0;
          return t >= monthStart.getTime() && t <= monthEnd.getTime();
        });
        const graded = submissions.filter((s) => {
          const t = s.graded_at ? new Date(s.graded_at).getTime() : 0;
          return t >= monthStart.getTime() && t <= monthEnd.getTime();
        });
        monthlyEngagement.push({
          month: monthNames[monthStart.getMonth()],
          submissions: subs.length,
          graded: graded.length,
          engagement: studentsEnrolledCount > 0
            ? Math.min(100, Math.round((subs.length / Math.max(1, studentsEnrolledCount)) * 100))
            : 0,
        });
      }

      // 7. Per-assignment: enrollment count per classroom, submission count per assignment
      const enrollmentCountByClass: Record<string, number> = {};
      if (classroomIds.length > 0) {
        const { data: enrolls } = await supabase
          .from("enrollments")
          .select("classroom_id")
          .in("classroom_id", classroomIds)
          .eq("status", "active");
        (enrolls ?? []).forEach((e) => {
          enrollmentCountByClass[e.classroom_id] = (enrollmentCountByClass[e.classroom_id] ?? 0) + 1;
        });
      }
      const submissionCountByAssignment: Record<string, number> = {};
      const gradedCountByAssignment: Record<string, number> = {};
      submissions.forEach((s) => {
        submissionCountByAssignment[s.assignment_id] = (submissionCountByAssignment[s.assignment_id] ?? 0) + 1;
        if (s.graded_at) {
          gradedCountByAssignment[s.assignment_id] = (gradedCountByAssignment[s.assignment_id] ?? 0) + 1;
        }
      });

      type AssignmentRow = (typeof assignments)[number] & { classrooms?: { name: string } | null };
      const recentAssignments: AssignmentWithStats[] = assignments.slice(0, 5).map((a) => {
        const row = a as AssignmentRow;
        const classroomId = row.classroom_id;
        const name = row.classrooms?.name ?? null;
        const students = classroomId ? enrollmentCountByClass[classroomId] ?? 0 : 0;
        const submitted = submissionCountByAssignment[a.id] ?? 0;
        return {
          id: a.id,
          title: a.title,
          due_date: a.due_date,
          status: a.status,
          classroom_name: name,
          students,
          submitted,
        };
      });

      // 8. Grading progress (assignments with submissions: graded / total)
      const gradingProgress: GradingProgressItem[] = assignments
        .filter((a) => (submissionCountByAssignment[a.id] ?? 0) > 0)
        .slice(0, 5)
        .map((a) => {
          const total = submissionCountByAssignment[a.id] ?? 0;
          const completed = gradedCountByAssignment[a.id] ?? 0;
          return {
            id: a.id,
            title: a.title,
            completed,
            total,
            progress: total > 0 ? Math.round((completed / total) * 100) : 0,
          };
        });

      return {
        documentsCount: totalDocuments,
        pendingAssignmentsCount,
        papersGradedCount,
        studentsEnrolledCount,
        classroomsCount: classroomIds.length,
        assignmentsCount: assignments.length,
        weeklyActivity,
        monthlyEngagement,
        recentAssignments,
        gradingProgress,
        recentDocuments: docs.map((d) => ({
          id: d.id,
          name: d.name,
          file_type: d.file_type,
          updated_at: d.updated_at,
        })),
      };
    },
    enabled: !!user && role === "teacher",
  });
}
