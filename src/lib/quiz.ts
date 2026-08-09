/**
 * Pure quiz-mode helpers.
 *
 * Kept out of `useQuizzes` so they can be imported (and tested) without pulling
 * in the Supabase browser client, which needs env vars at module load.
 */

/** Marks available on a document-response quiz when the teacher hasn't set one. */
export const DEFAULT_RESPONSE_POINTS = 100;

/**
 * A quiz with no `quiz_questions` rows but at least one attached document: the
 * document carries the questions, and the student answers with free text and/or
 * a file upload. Teachers mark these by hand.
 *
 * A quiz with questions is never in this mode — attached documents are then just
 * reference material alongside the questions.
 */
export const isDocumentResponseQuiz = (
  quiz: { quiz_attachments?: unknown[] | null } | null | undefined,
  questionCount: number
): boolean => questionCount === 0 && (quiz?.quiz_attachments?.length ?? 0) > 0;
