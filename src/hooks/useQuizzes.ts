/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import { useState, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as supabaseClient } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_RESPONSE_POINTS, isDocumentResponseQuiz } from '@/lib/quiz';

// Re-exported so quiz components can pull the hook and these helpers from one place.
export { DEFAULT_RESPONSE_POINTS, isDocumentResponseQuiz };

// Types
export interface QuizQuestion {
  id?: string;
  quiz_id?: string;
  question_type: 'multiple_choice' | 'true_false' | 'short_answer';
  question_text: string;
  points: number;
  order_index: number;
  options?: Array<{ id: string; text: string; is_correct: boolean }>;
  correct_answer?: string;
  explanation?: string;
}

/** A Doc Center document attached to a quiz as reference material. */
export interface QuizAttachedDocument {
  id: string;
  name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
}

export interface Quiz {
  id: string;
  classroom_id: string | null;
  teacher_id: string;
  title: string;
  description?: string;
  instructions?: string;
  time_limit_minutes?: number;
  available_from?: string;
  available_until?: string;
  passing_score?: number;
  max_attempts?: number;
  randomize_questions: boolean;
  /** Marks available when this is a document-response quiz (no questions). */
  response_points?: number;
  show_correct_answers: boolean;
  show_results_immediately: boolean;
  status: 'draft' | 'scheduled' | 'active' | 'closed';
  published_at?: string;
  created_at: string;
  updated_at: string;
  one_to_one_room_id?: string | null;
  classroom?: {
    name: string;
    subject?: string | null;
  };
  one_to_one_rooms?: {
    id: string;
    name: string | null;
    tutor_id: string;
    student_id: string;
  } | null;
  /** Only populated by the student-facing queries, which embed the attachment rows. */
  quiz_attachments?: { document_id: string; documents: QuizAttachedDocument | null }[];
}

export interface QuizAttempt {
  id: string;
  quiz_id: string;
  student_id: string;
  attempt_number: number;
  started_at: string;
  submitted_at?: string;
  time_spent_seconds?: number;
  answers: Array<{
    question_id: string;
    answer: string | string[];
    is_correct?: boolean;
    points_earned?: number;
    points_possible?: number;
  }>;
  score?: number;
  points_earned?: number;
  points_possible?: number;
  status: 'in_progress' | 'submitted' | 'graded';
  /** Document-response quizzes only: the student's typed answer. */
  response_text?: string | null;
  /** Document-response quizzes only: storage path of the uploaded answer file. */
  response_file_path?: string | null;
  response_file_name?: string | null;
  response_file_size?: number | null;
  auto_graded_at?: string;
  manually_graded_at?: string;
  feedback?: string;
  created_at: string;
  updated_at: string;
  quiz?: Quiz;
  student?: {
    display_name: string;
  };
}

export const useQuizzes = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const supabase: SupabaseClient<Database> = supabaseClient;

  type QuizWithClassroom = Quiz & {
    classroom?: {
      name: string;
      subject?: string | null;
    };
  };

  /** Used by teacher quiz list: includes question count via quiz_questions relation */
  type QuizWithClassroomAndQuestions = QuizWithClassroom & {
    quiz_questions?: { id: string }[];
  };

  type QuizInsert = Database['public']['Tables']['quizzes']['Insert'];
  type QuizQuestionInsert = Database['public']['Tables']['quiz_questions']['Insert'];
  type QuizAttemptWithQuiz = QuizAttempt & {
    quiz?: QuizWithClassroom;
  };

  type QuizAttemptWithStudent = QuizAttempt & {
    student: {
      display_name: string;
    };
  };

  // Teachers see student names only — contact details are deliberately not fetched.
  type StudentProfile = {
    user_id: string;
    display_name: string | null;
  };

  /**
   * Shape returned by the `calculate_quiz_score` RPC. Declared here because the function
   * returns `jsonb`, which the generated types widen to `Json`.
   * See supabase/migrations/20260308170000_basenew.sql:244-247.
   */
  type QuizScoreResult = {
    score: number;
    points_earned: number;
    points_possible: number;
  };

  // Fetch all quizzes for a teacher (classrooms and 1v1 rooms)
  const fetchTeacherQuizzes = useCallback(async (teacherId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('quizzes')
        .select('*, classroom:classrooms(name, subject), one_to_one_rooms(id, name, tutor_id, student_id), quiz_questions(id), quiz_attachments(document_id, documents(id, name, file_path, file_type, file_size))')
        .eq('teacher_id', teacherId)
        .order('created_at', { ascending: false })
        .returns<QuizWithClassroomAndQuestions[]>();

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch quizzes',
        variant: 'destructive',
      });
      return [];
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Fetch quizzes for a specific classroom or 1v1 room
  const fetchClassroomQuizzes = useCallback(async (classroomId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('quizzes')
        .select('*')
        .eq('classroom_id', classroomId)
        .order('created_at', { ascending: false })
        .returns<Quiz[]>();

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch quizzes',
        variant: 'destructive',
      });
      return [];
    } finally {
      setLoading(false);
    }
  }, [supabase, toast]);

  const fetchOneToOneRoomQuizzes = useCallback(async (roomId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('quizzes')
        .select('*')
        .eq('one_to_one_room_id', roomId)
        .order('created_at', { ascending: false })
        .returns<Quiz[]>();

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch quizzes',
        variant: 'destructive',
      });
      return [];
    } finally {
      setLoading(false);
    }
  }, [supabase, toast]);

  // Fetch available quizzes for a student (classrooms and 1v1 rooms)
  const fetchStudentQuizzes = async (studentId: string) => {
    try {
      setLoading(true);

      const classroomIds: string[] = [];
      const { data: enrollments, error: enrollError } = await supabase
        .from('enrollments')
        .select('classroom_id')
        .eq('student_id', studentId)
        .eq('status', 'active')
        .returns<Array<{ classroom_id: string }>>();
      if (!enrollError && enrollments) classroomIds.push(...enrollments.map(e => e.classroom_id));

      const roomIds: string[] = [];
      const { data: rooms, error: roomsError } = await supabase
        .from('one_to_one_rooms')
        .select('id')
        .eq('student_id', studentId);
      if (!roomsError && rooms) roomIds.push(...rooms.map(r => r.id));

      const orParts: string[] = [];
      if (classroomIds.length) orParts.push(`classroom_id.in.(${classroomIds.join(',')})`);
      if (roomIds.length) orParts.push(`one_to_one_room_id.in.(${roomIds.join(',')})`);
      if (orParts.length === 0) return [];

      const { data, error } = await supabase
        .from('quizzes')
        .select('*, classroom:classrooms(name, subject), one_to_one_rooms(id, name, tutor_id, student_id), quiz_attachments(document_id, documents(id, name, file_path, file_type, file_size))')
        .or(orParts.join(','))
        .in('status', ['scheduled', 'active', 'closed'])
        .order('created_at', { ascending: false })
        .returns<QuizWithClassroom[]>();

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch quizzes',
        variant: 'destructive',
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Fetch a single quiz with questions (stable ref for useEffect deps)
  const fetchQuizWithQuestions = useCallback(async (quizId: string) => {
    try {
      setLoading(true);
      
      const { data: quiz, error: quizError } = await supabase
        .from('quizzes')
        .select('*, classroom:classrooms(name, subject), one_to_one_rooms(id, name, tutor_id, student_id), quiz_attachments(document_id, documents(id, name, file_path, file_type, file_size))')
        .eq('id', quizId)
        .returns<QuizWithClassroom>()
        .single();

      if (quizError) throw quizError;

      const { data: questions, error: questionsError } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', quizId)
        .order('order_index', { ascending: true })
        .returns<QuizQuestion[]>();

      if (questionsError) throw questionsError;

      return { quiz, questions };
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch quiz',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Create a new quiz
  const createQuiz = async (quiz: Partial<Quiz>, questions: QuizQuestion[]) => {
    try {
      setLoading(true);

      // Insert quiz
      const { data: newQuiz, error: quizError } = await supabase
        .from('quizzes')
        .insert([quiz as QuizInsert])
        .select()
        .returns<Quiz>()
        .single();

      if (quizError) throw quizError;
      if (!newQuiz) throw new Error('Quiz creation failed');
      const createdQuiz = newQuiz as Quiz;

      // Insert questions
      const questionsWithQuizId: QuizQuestionInsert[] = questions.map((q, index) => ({
        ...q,
        quiz_id: createdQuiz.id,
        order_index: index,
      }));

      const { error: questionsError } = await supabase
        .from('quiz_questions')
        .insert(questionsWithQuizId);

      if (questionsError) throw questionsError;

      toast({
        title: 'Success',
        description: 'Quiz created successfully',
      });

      return createdQuiz;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create quiz',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Update a quiz
  const updateQuiz = async (quizId: string, updates: Partial<Quiz>, questions?: QuizQuestion[]) => {
    try {
      setLoading(true);

      // Update quiz
      const { error: quizError } = await supabase
        .from('quizzes')
        .update(updates)
        .eq('id', quizId);

      if (quizError) throw quizError;

      // Update questions if provided
      if (questions) {
        // Delete existing questions
        const { error: deleteError } = await supabase
          .from('quiz_questions')
          .delete()
          .eq('quiz_id', quizId);

        if (deleteError) throw deleteError;

        // Insert updated questions
      const questionsWithQuizId: QuizQuestionInsert[] = questions.map((q, index) => ({
          ...q,
          quiz_id: quizId,
          order_index: index,
        }));

        const { error: insertError } = await supabase
          .from('quiz_questions')
          .insert(questionsWithQuizId);

        if (insertError) throw insertError;
      }

      toast({
        title: 'Success',
        description: 'Quiz updated successfully',
      });

      return true;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update quiz',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Delete a quiz
  const deleteQuiz = async (quizId: string) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('quizzes')
        .delete()
        .eq('id', quizId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Quiz deleted successfully',
      });

      return true;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete quiz',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Publish a quiz
  const publishQuiz = async (quizId: string) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('quizzes')
        .update({ status: 'active', published_at: new Date().toISOString() })
        .eq('id', quizId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Quiz published successfully',
      });

      return true;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to publish quiz',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Close a quiz
  const closeQuiz = async (quizId: string) => {
    try {
      setLoading(true);
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('quizzes')
        .update({ status: 'closed', available_until: now })
        .eq('id', quizId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Quiz closed successfully',
      });

      return true;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to close quiz',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Check if student can attempt quiz
  const checkCanAttemptQuiz = async (quizId: string, studentId: string) => {
    try {
      const { data, error } = await supabase.rpc('can_attempt_quiz', {
        _quiz_id: quizId,
        _student_id: studentId,
      });

      if (error) throw error;
      return data as { can_attempt: boolean; reason: string | null };
    } catch (error: any) {
      console.error('Error checking quiz attempt:', error);
      return { can_attempt: false, reason: 'Failed to check quiz availability' };
    }
  };

  // Start a quiz attempt (atomic RPC prevents race: only one attempt created when max_attempts=1).
  // Returns { attempt, alreadyInProgress? } so caller can redirect to existing attempt when already in progress.
  const startQuizAttempt = async (
    quizId: string,
    studentId: string
  ): Promise<{ attempt: QuizAttempt | null; alreadyInProgress?: boolean }> => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .rpc('start_quiz_attempt', {
          _quiz_id: quizId,
          _student_id: studentId,
        })
        .returns<QuizAttempt>()
        .single();

      if (error) {
        const isAlreadyInProgress = /already in progress/i.test(error.message);
        if (!isAlreadyInProgress) {
          toast({
            title: 'Cannot Start Quiz',
            description: error.message || 'You cannot attempt this quiz',
            variant: 'destructive',
          });
        }
        return { attempt: null, alreadyInProgress: isAlreadyInProgress };
      }

      toast({
        title: 'Quiz Started',
        description: 'Good luck!',
      });

      return { attempt: data };
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to start quiz',
        variant: 'destructive',
      });
      return { attempt: null };
    } finally {
      setLoading(false);
    }
  };

  // Submit quiz attempt (idempotent: only in_progress rows are updated).
  // When hasShortAnswer is true, status stays 'submitted' until teacher manually grades; then gradeShortAnswers sets 'graded'.
  const submitQuizAttempt = async (
    attemptId: string,
    answers: QuizAttempt['answers'],
    timeSpentSeconds: number,
    options?: { hasShortAnswer?: boolean }
  ) => {
    try {
      setLoading(true);
      const hasShortAnswer = options?.hasShortAnswer === true;

      const { data: updatedRow, error } = await supabase
        .from('quiz_attempts')
        .update({
          answers,
          submitted_at: new Date().toISOString(),
          time_spent_seconds: timeSpentSeconds,
          status: 'submitted',
          auto_graded_at: hasShortAnswer ? null : new Date().toISOString(),
        })
        .eq('id', attemptId)
        .eq('status', 'in_progress')
        .select('id')
        .maybeSingle();

      if (error) throw error;

      // Already submitted (e.g. double-click or timer + manual): still succeed so caller can redirect to results
      if (!updatedRow) {
        toast({
          title: 'Already Submitted',
          description: 'Your quiz was already submitted. Redirecting to results.',
        });
        return true;
      }

      if (hasShortAnswer) {
        toast({
          title: 'Quiz Submitted',
          description: 'Your teacher will grade short answer questions. Results will appear after grading.',
        });
        return true;
      }

      // Calculate score for auto-gradable quizzes
      const { data: scoreData, error: scoreError } = await supabase.rpc(
        'calculate_quiz_score',
        { attempt_id: attemptId }
      );

      if (scoreError) throw scoreError;
      if (!scoreData) throw new Error('Score calculation failed');
      const score = scoreData as unknown as QuizScoreResult;

      // Update with score
      const { error: updateError } = await supabase
        .from('quiz_attempts')
        .update({
          score: score.score,
          points_earned: score.points_earned,
          points_possible: score.points_possible,
          status: 'graded',
          auto_graded_at: new Date().toISOString(),
        })
        .eq('id', attemptId);

      if (updateError) throw updateError;

      toast({
        title: 'Quiz Submitted',
        description: 'Your answers have been submitted successfully',
      });

      return true;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit quiz',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Fetch quiz attempts for a student
  const fetchStudentAttempts = async (studentId: string, quizId?: string) => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('quiz_attempts')
        .select('*, quiz:quizzes(*, classroom:classrooms(name, subject))')
        .eq('student_id', studentId);

      if (quizId) {
        query = query.eq('quiz_id', quizId);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .returns<QuizAttemptWithQuiz[]>();

      if (error) throw error;
      return data;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch quiz attempts',
        variant: 'destructive',
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Fetch quiz attempts for a teacher (stable ref for useEffect deps)
  const fetchQuizAttempts = useCallback(async (quizId: string) => {
    try {
      setLoading(true);
      
      // First fetch the attempts
      const { data: attemptsData, error: attemptsError } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('quiz_id', quizId)
        .order('submitted_at', { ascending: false, nullsFirst: false })
        .returns<QuizAttempt[]>();

      if (attemptsError) throw attemptsError;
      if (!attemptsData || attemptsData.length === 0) return [];

      // Get unique student IDs
      const studentIds = [...new Set(attemptsData.map(a => a.student_id))];

      // Fetch profiles for these students
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', studentIds)
        .returns<StudentProfile[]>();

      if (profilesError) throw profilesError;

      // Combine attempts with profile data
      const attemptsWithProfiles: QuizAttemptWithStudent[] = attemptsData.map((attempt) => {
        const p = profilesData?.find(pr => pr.user_id === attempt.student_id);
        return {
          ...attempt,
          student: {
            display_name: p?.display_name ?? 'Unknown Student',
          },
        };
      });

      return attemptsWithProfiles;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch quiz attempts',
        variant: 'destructive',
      });
      return [];
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Grade short answer questions
  const gradeShortAnswers = async (
    attemptId: string,
    gradedAnswers: Array<{ question_id: string; points_earned: number; is_correct: boolean }>
  ) => {
    try {
      setLoading(true);

      // Get current attempt
      const { data: attempt, error: fetchError } = await supabase
        .from('quiz_attempts')
        .select('answers')
        .eq('id', attemptId)
        .returns<Pick<QuizAttempt, 'answers'>>()
        .single();

      if (fetchError) throw fetchError;
      if (!attempt) throw new Error('Attempt not found');

      // Update answers with grades
      const answers = (attempt as { answers: QuizAttempt['answers'] }).answers;
      const updatedAnswers = answers.map((answer: QuizAttempt['answers'][number]) => {
        const graded = gradedAnswers.find((g) => g.question_id === answer.question_id);
        if (graded) {
          return {
            ...answer,
            points_earned: graded.points_earned,
            is_correct: graded.is_correct,
          };
        }
        return answer;
      });

      const { error: updateError } = await supabase
        .from('quiz_attempts')
        .update({
          answers: updatedAnswers,
          manually_graded_at: new Date().toISOString(),
        })
        .eq('id', attemptId);

      if (updateError) throw updateError;

      // Recalculate score
      const { data: scoreData, error: scoreError } = await supabase.rpc(
        'calculate_quiz_score',
        { attempt_id: attemptId }
      );

      if (scoreError) throw scoreError;
      if (!scoreData) throw new Error('Score calculation failed');
      const score = scoreData as unknown as QuizScoreResult;

      // Update with new score and mark as graded (manual grading complete)
      const { error: finalUpdateError } = await supabase
        .from('quiz_attempts')
        .update({
          score: score.score,
          points_earned: score.points_earned,
          points_possible: score.points_possible,
          status: 'graded',
        })
        .eq('id', attemptId);

      if (finalUpdateError) throw finalUpdateError;

      toast({
        title: 'Success',
        description: 'Quiz graded successfully',
      });

      return true;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to grade quiz',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  /** Max size for a student's uploaded answer file. */
  const MAX_RESPONSE_FILE_MB = 20;

  /**
   * Upload a student's answer file for a document-response quiz.
   * Path must start with the student's own id — the `submissions` bucket policy
   * ("Students can upload submissions") keys off the first folder segment.
   */
  const uploadQuizResponseFile = async (
    quizId: string,
    studentId: string,
    file: File
  ): Promise<{ path: string; name: string; size: number } | null> => {
    if (file.size > MAX_RESPONSE_FILE_MB * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: `Maximum file size is ${MAX_RESPONSE_FILE_MB} MB.`,
        variant: 'destructive',
      });
      return null;
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${studentId}/quiz-${quizId}/${Date.now()}_${safeName}`;
    const { error } = await supabase.storage.from('submissions').upload(path, file, {
      contentType: file.type || undefined,
    });
    if (error) {
      toast({
        title: 'Upload failed',
        description: error.message || 'Could not upload your file',
        variant: 'destructive',
      });
      return null;
    }
    return { path, name: file.name, size: file.size };
  };

  /**
   * Submit a document-response attempt (a quiz with no questions). Nothing is
   * auto-graded — the attempt stays 'submitted' until the teacher marks it.
   */
  const submitDocumentResponse = async (
    attemptId: string,
    response: {
      responseText?: string | null;
      file?: { path: string; name: string; size: number } | null;
    },
    timeSpentSeconds: number,
    pointsPossible: number
  ): Promise<boolean> => {
    try {
      setLoading(true);

      const { data: updatedRow, error } = await supabase
        .from('quiz_attempts')
        .update({
          answers: [],
          response_text: response.responseText?.trim() || null,
          response_file_path: response.file?.path ?? null,
          response_file_name: response.file?.name ?? null,
          response_file_size: response.file?.size ?? null,
          submitted_at: new Date().toISOString(),
          time_spent_seconds: timeSpentSeconds,
          status: 'submitted',
          auto_graded_at: null,
          points_possible: pointsPossible,
        })
        .eq('id', attemptId)
        .eq('status', 'in_progress')
        .select('id')
        .maybeSingle();

      if (error) throw error;

      // Already submitted (double-click, or timer fired alongside a manual submit).
      if (!updatedRow) {
        toast({
          title: 'Already Submitted',
          description: 'Your response was already submitted. Redirecting to results.',
        });
        return true;
      }

      toast({
        title: 'Response Submitted',
        description: 'Your teacher will review and grade your response.',
      });
      return true;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit your response',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  /** Teacher marks a document-response attempt: points out of the quiz's response_points. */
  const gradeDocumentResponse = async (
    attemptId: string,
    pointsEarned: number,
    pointsPossible: number,
    feedback?: string
  ): Promise<boolean> => {
    try {
      setLoading(true);
      const safePossible = pointsPossible > 0 ? pointsPossible : DEFAULT_RESPONSE_POINTS;
      const clamped = Math.min(Math.max(0, pointsEarned), safePossible);

      const { error } = await supabase
        .from('quiz_attempts')
        .update({
          points_earned: clamped,
          points_possible: safePossible,
          score: (clamped / safePossible) * 100,
          feedback: feedback?.trim() || null,
          status: 'graded',
          manually_graded_at: new Date().toISOString(),
        })
        .eq('id', attemptId);

      if (error) throw error;

      toast({ title: 'Graded', description: 'The response has been graded.' });
      return true;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to grade response',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  /** Signed URL for downloading a student's uploaded answer file. */
  const getQuizResponseFileUrl = async (filePath: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from('submissions')
      .createSignedUrl(filePath, 60 * 10);
    if (error) {
      toast({
        title: 'Error',
        description: error.message || 'Could not open the file',
        variant: 'destructive',
      });
      return null;
    }
    return data?.signedUrl ?? null;
  };

  // Fetch a single quiz attempt by ID
  const fetchQuizAttemptById = async (attemptId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('id', attemptId)
        .returns<QuizAttempt>()
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch quiz attempt',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Replace a quiz's attachments with `documentIds`. Deleting first keeps this idempotent
   * and lets the caller pass the full desired set rather than a diff.
   */
  const saveQuizAttachments = useCallback(async (quizId: string, documentIds: string[]) => {
    const { error: deleteError } = await supabase
      .from('quiz_attachments')
      .delete()
      .eq('quiz_id', quizId);
    if (deleteError) {
      toast({
        title: 'Error',
        description: deleteError.message || 'Failed to update quiz documents',
        variant: 'destructive',
      });
      return false;
    }

    if (documentIds.length === 0) return true;

    const { error: insertError } = await supabase
      .from('quiz_attachments')
      .insert(documentIds.map((document_id) => ({ quiz_id: quizId, document_id })));
    if (insertError) {
      toast({
        title: 'Error',
        description: insertError.message || 'Failed to attach quiz documents',
        variant: 'destructive',
      });
      return false;
    }
    return true;
  }, [toast]);

  return {
    loading,
    saveQuizAttachments,
    fetchTeacherQuizzes,
    fetchClassroomQuizzes,
    fetchOneToOneRoomQuizzes,
    fetchStudentQuizzes,
    fetchQuizWithQuestions,
    createQuiz,
    updateQuiz,
    deleteQuiz,
    publishQuiz,
    closeQuiz,
    checkCanAttemptQuiz,
    startQuizAttempt,
    submitQuizAttempt,
    fetchStudentAttempts,
    fetchQuizAttempts,
    fetchQuizAttemptById,
    gradeShortAnswers,
    uploadQuizResponseFile,
    submitDocumentResponse,
    gradeDocumentResponse,
    getQuizResponseFileUrl,
  };
};