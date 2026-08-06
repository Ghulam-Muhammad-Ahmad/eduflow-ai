export interface GradedAssignmentLike {
  grade: number | null;
  points_possible: number | null;
}

export interface QuizAttemptLike {
  quiz_id: string;
  score: number | null;
  points_earned: number | null;
  points_possible: number | null;
}

export interface StudentRecordAverages {
  /** Average assignment score (0-100) across graded assignments only. */
  assignmentAvg: number | null;
  /** Average of the best score (0-100) per quiz, across quizzes with at least one usable score. */
  quizAvg: number | null;
  /** Count-weighted blend of assignmentAvg and quizAvg, 0-100. */
  overallAvg: number | null;
  /** How many distinct quizzes contributed to quizAvg (at least one attempt has a usable score). */
  gradedQuizzesCount: number;
}

function hasUsableScore(attempt: QuizAttemptLike): boolean {
  return attempt.score != null || (attempt.points_earned != null && (attempt.points_possible ?? 0) > 0);
}

function scoreValue(attempt: QuizAttemptLike): number {
  if (attempt.score != null) return attempt.score;
  if (attempt.points_earned != null && attempt.points_possible) {
    return (attempt.points_earned / attempt.points_possible) * 100;
  }
  return 0;
}

/**
 * Averaging math shared by every "student record" view (teacher, owner, and student-facing).
 * Assumes `quizAttempts` is already scoped to one student and filtered to submitted/graded status
 * — this only computes the numbers, it does not decide which rows are eligible.
 */
export function computeStudentRecordAverages(
  assignments: GradedAssignmentLike[],
  quizAttempts: QuizAttemptLike[]
): StudentRecordAverages {
  const gradedAssignments = assignments.filter((a) => a.grade != null);

  const attemptsByQuiz = new Map<string, QuizAttemptLike[]>();
  for (const attempt of quizAttempts) {
    if (!hasUsableScore(attempt)) continue;
    const list = attemptsByQuiz.get(attempt.quiz_id) ?? [];
    list.push(attempt);
    attemptsByQuiz.set(attempt.quiz_id, list);
  }
  const gradedQuizzesCount = attemptsByQuiz.size;
  const bestScoresPerQuiz = [...attemptsByQuiz.values()].map((attemptsForQuiz) =>
    Math.max(...attemptsForQuiz.map(scoreValue))
  );

  const assignmentAvg =
    gradedAssignments.length > 0
      ? gradedAssignments.reduce((sum, a) => {
          const possible = a.points_possible ?? 100;
          return sum + (possible > 0 ? ((a.grade ?? 0) / possible) * 100 : 0);
        }, 0) / gradedAssignments.length
      : null;

  const quizAvg =
    bestScoresPerQuiz.length > 0
      ? bestScoresPerQuiz.reduce((sum, s) => sum + s, 0) / bestScoresPerQuiz.length
      : null;

  const totalGraded = gradedAssignments.length + gradedQuizzesCount;
  const overallAvg =
    totalGraded > 0
      ? ((assignmentAvg ?? 0) * gradedAssignments.length + (quizAvg ?? 0) * gradedQuizzesCount) / totalGraded
      : null;

  return { assignmentAvg, quizAvg, overallAvg, gradedQuizzesCount };
}
