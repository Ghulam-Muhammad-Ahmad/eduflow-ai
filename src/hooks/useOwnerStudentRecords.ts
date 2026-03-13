/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import type {
  StudentRecord,
  ClassroomSummary,
  AssignmentGrade,
  QuizGrade,
} from "@/hooks/useTeacherStudentRecords";

/**
 * Fetches all data needed for owner student records: workspace classrooms (and 1v1 rooms),
 * roster, assignments, quizzes, submissions, and quiz attempts.
 * When oneToOneRoomId is set, returns a single-student "1v1 room student report" view.
 */
export function useOwnerStudentRecords(classroomId: string | null, oneToOneRoomId: string | null = null) {
  const { workspaceId } = useOwnerWorkspace();

  return useQuery({
    queryKey: ["owner-student-records", workspaceId, classroomId, oneToOneRoomId],
    queryFn: async (): Promise<{
      classrooms: ClassroomSummary[];
      students: StudentRecord[];
      assignments: { id: string; title: string; points_possible: number | null; classroom_id: string; classroom_name: string }[];
      quizzes: { id: string; title: string; classroom_id: string; classroom_name: string }[];
    }> => {
      if (!workspaceId) return { classrooms: [], students: [], assignments: [], quizzes: [] };

      // 1v1 room mode: single student, assignments/quizzes for that room
      if (oneToOneRoomId) {
        const { data: room, error: roomError } = await supabase
          .from("one_to_one_rooms")
          .select("id, name, student_id, created_at")
          .eq("id", oneToOneRoomId)
          .eq("workspace_id", workspaceId)
          .single();
        if (roomError || !room) return { classrooms: [], students: [], assignments: [], quizzes: [] };

        const studentIds = [room.student_id];
        const roomName = room.name || "1v1 Room";

        const { data: assignData, error: assignErr } = await supabase
          .from("assignments")
          .select("id, title, points_possible, one_to_one_room_id")
          .eq("one_to_one_room_id", oneToOneRoomId)
          .order("created_at", { ascending: false });
        if (assignErr) throw assignErr;
        const assignmentsList = (assignData ?? []).map((a: any) => ({
          id: a.id,
          title: a.title,
          points_possible: a.points_possible,
          classroom_id: oneToOneRoomId,
          classroom_name: roomName,
        }));
        const assignmentIds = assignmentsList.map((a) => a.id);

        const { data: quizData, error: quizErr } = await supabase
          .from("quizzes")
          .select("id, title, one_to_one_room_id")
          .eq("one_to_one_room_id", oneToOneRoomId)
          .order("created_at", { ascending: false });
        if (quizErr) throw quizErr;
        const quizzesList = (quizData ?? []).map((q: any) => ({
          id: q.id,
          title: q.title,
          classroom_id: oneToOneRoomId,
          classroom_name: roomName,
        }));
        const quizIds = quizzesList.map((q) => q.id);

        let submissions: any[] = [];
        if (assignmentIds.length > 0) {
          const { data: subData, error: subError } = await supabase
            .from("submissions")
            .select("id, assignment_id, student_id, grade, status, submitted_at, graded_at")
            .in("assignment_id", assignmentIds)
            .eq("student_id", room.student_id);
          if (!subError && subData) submissions = subData;
        }
        let attempts: any[] = [];
        if (quizIds.length > 0) {
          const { data: attemptData, error: attemptError } = await supabase
            .from("quiz_attempts")
            .select("id, quiz_id, student_id, attempt_number, score, points_earned, points_possible, status, submitted_at")
            .in("quiz_id", quizIds)
            .eq("student_id", room.student_id)
            .in("status", ["submitted", "graded"]);
          if (!attemptError && attemptData) attempts = attemptData;
        }

        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name, avatar_url, email")
          .in("user_id", studentIds);
        const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
        const profile = profileMap.get(room.student_id);
        const profileObj = profile && typeof profile === "object" ? profile : null;

        const assignmentGrades: AssignmentGrade[] = assignmentsList.map((a) => {
          const sub = submissions.find((s) => s.assignment_id === a.id);
          return {
            assignment_id: a.id,
            title: a.title,
            points_possible: a.points_possible,
            grade: sub?.grade ?? null,
            status: sub?.status ?? "not_submitted",
            submitted_at: sub?.submitted_at ?? null,
            graded_at: sub?.graded_at ?? null,
            classroom_name: a.classroom_name,
          };
        });
        const quizGrades: QuizGrade[] = attempts.map((at) => {
          const quiz = quizzesList.find((q) => q.id === at.quiz_id);
          return {
            quiz_id: at.quiz_id,
            title: quiz?.title ?? "",
            attempt_number: at.attempt_number,
            score: at.score,
            points_earned: at.points_earned,
            points_possible: at.points_possible,
            status: at.status,
            submitted_at: at.submitted_at,
            classroom_name: roomName,
          };
        });

        const gradedAssignments = assignmentGrades.filter((g) => g.grade != null);
        const gradedAttemptsByQuiz = new Map<string, QuizGrade[]>();
        quizGrades.forEach((g) => {
          const list = gradedAttemptsByQuiz.get(g.quiz_id) ?? [];
          list.push(g);
          gradedAttemptsByQuiz.set(g.quiz_id, list);
        });
        const gradedQuizzesCount = gradedAttemptsByQuiz.size;
        const bestScoresPerQuiz = [...gradedAttemptsByQuiz.values()].map((attemptsForQuiz) => {
          const withScore = attemptsForQuiz
            .map((g) => ({
              g,
              value: g.score ?? (g.points_possible && g.points_earned != null ? (g.points_earned / g.points_possible) * 100 : 0),
            }))
            .filter((x) => x.g.score != null || (x.g.points_earned != null && (x.g.points_possible ?? 0) > 0));
          return withScore.length ? Math.max(...withScore.map((x) => x.value)) : 0;
        });
        const assignmentAvg =
          gradedAssignments.length > 0
            ? gradedAssignments.reduce((sum, g) => {
                const possible = g.points_possible ?? 100;
                return sum + (possible > 0 ? ((g.grade ?? 0) / possible) * 100 : 0);
              }, 0) / gradedAssignments.length
            : null;
        const quizAvg = bestScoresPerQuiz.length > 0 ? bestScoresPerQuiz.reduce((sum, s) => sum + s, 0) / bestScoresPerQuiz.length : null;
        const totalGraded = gradedAssignments.length + gradedQuizzesCount;
        const overallAvg =
          totalGraded > 0
            ? ((assignmentAvg ?? 0) * gradedAssignments.length + (quizAvg ?? 0) * gradedQuizzesCount) / totalGraded
            : null;

        const studentRecord: StudentRecord = {
          student_id: room.student_id,
          display_name: profileObj && "display_name" in profileObj ? (profileObj.display_name as string | null) : null,
          email: profileObj && "email" in profileObj ? (profileObj.email as string | null) : null,
          avatar_url: profileObj && "avatar_url" in profileObj ? (profileObj.avatar_url as string | null) : null,
          classroom_id: oneToOneRoomId,
          classroom_name: `1v1: ${roomName}`,
          joined_at: room.created_at,
          assignmentGrades,
          quizGrades,
          assignmentAvg,
          quizAvg,
          overallAvg,
          totalAssignments: assignmentGrades.length,
          totalQuizzes: quizzesList.length,
          gradedAssignments: gradedAssignments.length,
          gradedQuizzes: gradedQuizzesCount,
        };

        return {
          classrooms: [],
          students: [studentRecord],
          assignments: assignmentsList,
          quizzes: quizzesList,
        };
      }

      // 1. Workspace classrooms
      const { data: classrooms, error: classroomsError } = await supabase
        .from("classrooms")
        .select("id, name, subject")
        .eq("workspace_id", workspaceId)
        .eq("is_archived", false)
        .order("name");

      if (classroomsError) throw classroomsError;
      const classroomList = Array.isArray(classrooms) ? classrooms : [];
      const targetClassroomIds = classroomId
        ? [classroomId]
        : classroomList.map((c) => c.id);
      if (targetClassroomIds.length === 0) {
        return {
          classrooms: classroomList.map((c) => ({ ...c, subject: c.subject ?? null, studentCount: 0 })),
          students: [],
          assignments: [],
          quizzes: [],
        };
      }

      // 2. Enrollments (roster) for target classroom(s)
      const { data: enrollments, error: enrollError } = await supabase
        .from("enrollments")
        .select("id, student_id, classroom_id, joined_at")
        .in("classroom_id", targetClassroomIds)
        .eq("status", "active")
        .order("joined_at", { ascending: false });

      if (enrollError) throw enrollError;
      const roster = Array.isArray(enrollments) ? enrollments : [];
      const studentIds = [...new Set(roster.map((e) => e.student_id))];

      // 3. Profiles for students (include email for owner view)
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url, email")
        .in("user_id", studentIds);

      if (profilesError) throw profilesError;
      const profileMap = Array.isArray(profiles)
        ? new Map(profiles.map((p) => [p.user_id, p]))
        : new Map();

      // 4. Assignments for target classrooms
      const { data: assignmentsData, error: assignError } = await supabase
        .from("assignments")
        .select(`
          id,
          title,
          points_possible,
          classroom_id,
          classrooms ( name )
        `)
        .in("classroom_id", targetClassroomIds)
        .order("created_at", { ascending: false });

      if (assignError) throw assignError;
      const assignmentsList = Array.isArray(assignmentsData)
        ? assignmentsData.map((a: any) => ({
            id: a.id,
            title: a.title,
            points_possible: a.points_possible,
            classroom_id: a.classroom_id,
            classroom_name: a.classrooms?.name ?? "",
          }))
        : [];
      const assignmentIds = assignmentsList.map((a) => a.id);

      // 5. Quizzes for target classrooms
      const { data: quizzesData, error: quizzesError } = await supabase
        .from("quizzes")
        .select(`
          id,
          title,
          classroom_id,
          classrooms ( name )
        `)
        .in("classroom_id", targetClassroomIds)
        .order("created_at", { ascending: false });

      if (quizzesError) throw quizzesError;
      const quizzesList = Array.isArray(quizzesData)
        ? quizzesData.map((q: any) => ({
            id: q.id,
            title: q.title,
            classroom_id: q.classroom_id,
            classroom_name: q.classrooms?.name ?? "",
          }))
        : [];
      const quizIds = quizzesList.map((q) => q.id);

      // 6. Submissions
      let submissions: any[] = [];
      if (assignmentIds.length > 0 && studentIds.length > 0) {
        const { data: subData, error: subError } = await supabase
          .from("submissions")
          .select("id, assignment_id, student_id, grade, status, submitted_at, graded_at")
          .in("assignment_id", assignmentIds)
          .in("student_id", studentIds);
        if (subError) throw subError;
        if (Array.isArray(subData)) submissions = subData;
      }

      // 7. Quiz attempts
      let attempts: any[] = [];
      if (quizIds.length > 0 && studentIds.length > 0) {
        const { data: attemptData, error: attemptError } = await supabase
          .from("quiz_attempts")
          .select("id, quiz_id, student_id, attempt_number, score, points_earned, points_possible, status, submitted_at")
          .in("quiz_id", quizIds)
          .in("student_id", studentIds)
          .in("status", ["submitted", "graded"]);
        if (attemptError) throw attemptError;
        if (Array.isArray(attemptData)) attempts = attemptData;
      }

      const classroomNameById = new Map(classroomList.map((c) => [c.id, c.name]));

      const students: StudentRecord[] = roster.map((enrollment) => {
        const profile = profileMap.get(enrollment.student_id);
        const classroomName = classroomNameById.get(enrollment.classroom_id) ?? "";

        const assignmentGrades: AssignmentGrade[] = assignmentsList
          .filter((a) => a.classroom_id === enrollment.classroom_id)
          .map((a) => {
            const sub = submissions.find(
              (s) =>
                s.assignment_id === a.id && s.student_id === enrollment.student_id
            );
            return {
              assignment_id: a.id,
              title: a.title,
              points_possible: a.points_possible,
              grade: sub?.grade ?? null,
              status: sub?.status ?? "not_submitted",
              submitted_at: sub?.submitted_at ?? null,
              graded_at: sub?.graded_at ?? null,
              classroom_name: a.classroom_name,
            };
          });

        const quizGrades: QuizGrade[] = [];
        const studentQuizAttempts = attempts.filter(
          (at) =>
            at.student_id === enrollment.student_id &&
            quizzesList.some((q) => q.id === at.quiz_id && q.classroom_id === enrollment.classroom_id)
        );
        studentQuizAttempts.forEach((at) => {
          const quiz = quizzesList.find((q) => q.id === at.quiz_id);
          if (!quiz) return;
          quizGrades.push({
            quiz_id: at.quiz_id,
            title: quiz.title,
            attempt_number: at.attempt_number,
            score: at.score,
            points_earned: at.points_earned,
            points_possible: at.points_possible,
            status: at.status,
            submitted_at: at.submitted_at,
            classroom_name: quiz.classroom_name,
          });
        });

        const gradedAssignments = assignmentGrades.filter((g) => g.grade != null);
        const gradedAttemptsByQuiz = new Map<string, QuizGrade[]>();
        quizGrades.forEach((g) => {
          if (g.score != null || (g.points_earned != null && (g.points_possible ?? 0) > 0)) {
            const list = gradedAttemptsByQuiz.get(g.quiz_id) ?? [];
            list.push(g);
            gradedAttemptsByQuiz.set(g.quiz_id, list);
          }
        });
        const gradedQuizzesCount = gradedAttemptsByQuiz.size;
        const bestScoresPerQuiz = [...gradedAttemptsByQuiz.values()].map((attemptsForQuiz) => {
          const withScore = attemptsForQuiz
            .map((g) => ({
              g,
              value: g.score ?? (g.points_possible && g.points_earned != null
                ? (g.points_earned / g.points_possible) * 100
                : 0),
            }))
            .filter((x) => x.g.score != null || (x.g.points_earned != null && (x.g.points_possible ?? 0) > 0));
          return withScore.length ? Math.max(...withScore.map((x) => x.value)) : 0;
        });

        const assignmentAvg =
          gradedAssignments.length > 0
            ? gradedAssignments.reduce((sum, g) => {
                const possible = g.points_possible ?? 100;
                const pct = possible > 0 ? ((g.grade ?? 0) / possible) * 100 : 0;
                return sum + pct;
              }, 0) / gradedAssignments.length
            : null;

        const quizAvg =
          bestScoresPerQuiz.length > 0
            ? bestScoresPerQuiz.reduce((sum, s) => sum + s, 0) / bestScoresPerQuiz.length
            : null;

        const totalGraded = gradedAssignments.length + gradedQuizzesCount;
        const overallAvg =
          totalGraded > 0
            ? ((assignmentAvg ?? 0) * gradedAssignments.length +
                (quizAvg ?? 0) * gradedQuizzesCount) /
              totalGraded
            : null;

        const profileObj = profile && typeof profile === "object" ? profile : null;
        return {
          student_id: enrollment.student_id,
          display_name: profileObj && "display_name" in profileObj ? (profileObj.display_name as string | null) : null,
          email: profileObj && "email" in profileObj ? (profileObj.email as string | null) : null,
          avatar_url: profileObj && "avatar_url" in profileObj ? (profileObj.avatar_url as string | null) : null,
          classroom_id: enrollment.classroom_id,
          classroom_name: classroomName,
          joined_at: enrollment.joined_at,
          assignmentGrades,
          quizGrades,
          assignmentAvg,
          quizAvg,
          overallAvg,
          totalAssignments: assignmentGrades.length,
          totalQuizzes: quizzesList.filter((q) => q.classroom_id === enrollment.classroom_id).length,
          gradedAssignments: gradedAssignments.length,
          gradedQuizzes: gradedQuizzesCount,
        };
      });

      const classroomsSummary: ClassroomSummary[] = classroomList.map((c) => ({
        id: c.id,
        name: c.name,
        subject: c.subject ?? null,
        studentCount: roster.filter((e) => e.classroom_id === c.id).length,
      }));

      return {
        classrooms: classroomsSummary,
        students,
        assignments: assignmentsList,
        quizzes: quizzesList,
      };
    },
    enabled: !!workspaceId,
  });
}
