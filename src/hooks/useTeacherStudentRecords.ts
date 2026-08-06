/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { computeStudentRecordAverages } from "@/lib/studentRecord";

export interface AssignmentGrade {
  assignment_id: string;
  title: string;
  points_possible: number | null;
  grade: number | null;
  status: string;
  submitted_at: string | null;
  graded_at: string | null;
  classroom_name: string;
}

export interface QuizGrade {
  quiz_id: string;
  title: string;
  attempt_number: number;
  score: number | null;
  points_earned: number | null;
  points_possible: number | null;
  status: string;
  submitted_at: string | null;
  classroom_name: string;
}

export interface StudentRecord {
  student_id: string;
  display_name: string | null;
  /**
   * Owner-only. Teacher-facing queries never select it, so it is absent on their records —
   * every consumer must treat it as optional.
   */
  email?: string | null;
  avatar_url: string | null;
  classroom_id: string;
  classroom_name: string;
  joined_at: string;
  assignmentGrades: AssignmentGrade[];
  quizGrades: QuizGrade[];
  /** Average assignment score (0-100) for graded assignments only */
  assignmentAvg: number | null;
  /** Average quiz score (0-100) for graded attempts only */
  quizAvg: number | null;
  /** Overall average (assignments + quizzes) 0-100 */
  overallAvg: number | null;
  totalAssignments: number;
  totalQuizzes: number;
  gradedAssignments: number;
  gradedQuizzes: number;
}

export interface ClassroomSummary {
  id: string;
  name: string;
  subject: string | null;
  studentCount: number;
}

/**
 * Fetches all data needed for teacher student records: classrooms, 1v1 rooms,
 * roster, assignments, quizzes, submissions, and quiz attempts.
 * When oneToOneRoomId is set, returns a single-student "1v1 room student report" view.
 */
export function useTeacherStudentRecords(classroomId: string | null, oneToOneRoomId: string | null = null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["teacher-student-records", user?.id, classroomId, oneToOneRoomId],
    queryFn: async (): Promise<{
      classrooms: ClassroomSummary[];
      students: StudentRecord[];
      assignments: { id: string; title: string; points_possible: number | null; classroom_id: string; classroom_name: string }[];
      quizzes: { id: string; title: string; classroom_id: string; classroom_name: string }[];
    }> => {
      if (!user) return { classrooms: [], students: [], assignments: [], quizzes: [] };

      // 1v1 room mode: single student, assignments/quizzes for that room (teacher must be tutor)
      if (oneToOneRoomId) {
        const { data: room, error: roomError } = await supabase
          .from("one_to_one_rooms")
          .select("id, name, student_id, created_at")
          .eq("id", oneToOneRoomId)
          .eq("tutor_id", user.id)
          .single();
        if (roomError || !room) return { classrooms: [], students: [], assignments: [], quizzes: [] };

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
        let submissions: any[] = [];
        if (assignmentsList.length > 0) {
          const { data: subData } = await supabase
            .from("submissions")
            .select("id, assignment_id, student_id, grade, status, submitted_at, graded_at")
            .in("assignment_id", assignmentsList.map((a) => a.id))
            .eq("student_id", room.student_id);
          if (subData) submissions = subData;
        }
        let attempts: any[] = [];
        if (quizzesList.length > 0) {
          const { data: attemptData } = await supabase
            .from("quiz_attempts")
            .select("id, quiz_id, student_id, attempt_number, score, points_earned, points_possible, status, submitted_at")
            .in("quiz_id", quizzesList.map((q) => q.id))
            .eq("student_id", room.student_id)
            .in("status", ["submitted", "graded"]);
          if (attemptData) attempts = attemptData;
        }
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name, avatar_url")
          .in("user_id", [room.student_id]);
        const profile = Array.isArray(profiles) && profiles[0] ? profiles[0] : null;
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
        const { assignmentAvg, quizAvg, overallAvg, gradedQuizzesCount } = computeStudentRecordAverages(
          assignmentGrades,
          quizGrades
        );
        const studentRecord: StudentRecord = {
          student_id: room.student_id,
          display_name: profile?.display_name ?? null,
          avatar_url: profile?.avatar_url ?? null,
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
        return { classrooms: [], students: [studentRecord], assignments: assignmentsList, quizzes: quizzesList };
      }

      // 1. Teacher's classrooms
      const { data: classrooms, error: classroomsError } = await supabase
        .from("classrooms")
        .select("id, name, subject")
        .eq("teacher_id", user.id)
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

      // 3. Profiles for students
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", studentIds);

      if (profilesError) throw profilesError;
      // If profiles query fails, profiles may be returned as an error object, not an array.
      // Only map if profiles is an array.
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

      // 6. Submissions for these assignments (any student in roster)
      let submissions: any[] = [];
      if (assignmentIds.length > 0 && studentIds.length > 0) {
        const { data: subData, error: subError } = await supabase
          .from("submissions")
          .select("id, assignment_id, student_id, grade, status, submitted_at, graded_at")
          .in("assignment_id", assignmentIds)
          .in("student_id", studentIds);
        if (subError) {
          console.error("submissions query failed:", subError);
          throw subError;
        }
        if (Array.isArray(subData)) submissions = subData;
      }

      // 7. Quiz attempts for these quizzes (any student in roster)
      let attempts: any[] = [];
      if (quizIds.length > 0 && studentIds.length > 0) {
        const { data: attemptData, error: attemptError } = await supabase
          .from("quiz_attempts")
          .select("id, quiz_id, student_id, attempt_number, score, points_earned, points_possible, status, submitted_at")
          .in("quiz_id", quizIds)
          .in("student_id", studentIds)
          .in("status", ["submitted", "graded"]);
        
        if (attemptError) {
          console.error("quiz attempts query failed:", attemptError);
          attempts = [];
          throw attemptError;
        }
        if (Array.isArray(attemptData)) attempts = attemptData;
      }

      // Build classroom name lookup
      const classroomNameById = new Map(
        classroomList.map((c) => [c.id, c.name])
      );

      // Build student records (one per enrollment so same student in two classes = two rows, or we can merge by student; per-enrollment is better for "per classroom" view)
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
        const { assignmentAvg, quizAvg, overallAvg, gradedQuizzesCount } = computeStudentRecordAverages(
          assignmentGrades,
          quizGrades
        );

        return {
          student_id: enrollment.student_id,
          display_name: profile && typeof profile === "object" && "display_name" in profile ? (profile.display_name as string | null) : null,
          avatar_url: profile && typeof profile === "object" && "avatar_url" in profile ? (profile.avatar_url as string | null) : null,
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

      // Classroom summary with student counts
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
    enabled: !!user,
  });
}
