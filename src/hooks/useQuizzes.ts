import { useState, useEffect, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase as supabaseClient } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';

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

export interface Quiz {
  id: string;
  classroom_id: string;
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
  show_correct_answers: boolean;
  show_results_immediately: boolean;
  status: 'draft' | 'scheduled' | 'active' | 'closed';
  published_at?: string;
  created_at: string;
  updated_at: string;
  classroom?: {
    name: string;
    subject?: string | null;
  };
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
  auto_graded_at?: string;
  manually_graded_at?: string;
  feedback?: string;
  created_at: string;
  updated_at: string;
  quiz?: Quiz;
  student?: {
    display_name: string;
    email?: string;
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
  type QuizAttemptInsert = Database['public']['Tables']['quiz_attempts']['Insert'];

  type QuizAttemptWithQuiz = QuizAttempt & {
    quiz?: QuizWithClassroom;
  };

  type QuizAttemptWithStudent = QuizAttempt & {
    student: {
      display_name: string;
      email?: string | null;
    };
  };

  type StudentProfile = {
    user_id: string;
    display_name: string | null;
    email: string | null;
  };

  // Fetch all quizzes for a teacher (stable ref to avoid infinite fetch loops)
  const fetchTeacherQuizzes = useCallback(async (teacherId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('quizzes')
        .select('*, classroom:classrooms(name, subject), quiz_questions(id)')
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

  // Fetch quizzes for a specific classroom
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

  // Fetch available quizzes for a student
  const fetchStudentQuizzes = async (studentId: string) => {
    try {
      setLoading(true);
      
      // Get student's enrolled classrooms
      const { data: enrollments, error: enrollError } = await supabase
        .from('enrollments')
        .select('classroom_id')
        .eq('student_id', studentId)
        .eq('status', 'active')
        .returns<Array<{ classroom_id: string }>>();

      if (enrollError) throw enrollError;

      const classroomIds = enrollments?.map(e => e.classroom_id) || [];

      if (classroomIds.length === 0) {
        return [];
      }

      // Get quizzes from enrolled classrooms
      // Fetch both 'scheduled' and 'active' status (matches RLS policy)
      const { data, error } = await supabase
        .from('quizzes')
        .select('*, classroom:classrooms(name, subject)')
        .in('classroom_id', classroomIds)
        .in('status', ['scheduled', 'active', 'closed'])
        .order('created_at', { ascending: false })
        .returns<QuizWithClassroom[]>();

      if (error) throw error;

      // Return all quizzes (scheduled/active) including expired — students can see them and view past results
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
        .select('*, classroom:classrooms(name, subject)')
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

      // Update with score
      const { error: updateError } = await supabase
        .from('quiz_attempts')
        .update({
          score: scoreData.score,
          points_earned: scoreData.points_earned,
          points_possible: scoreData.points_possible,
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
        .select('user_id, display_name, email')
        .in('user_id', studentIds)
        .returns<StudentProfile[]>();

      if (profilesError) throw profilesError;

      // Combine attempts with profile data
      const attemptsWithProfiles: QuizAttemptWithStudent[] = attemptsData.map((attempt) => ({
        ...attempt,
        student: profilesData?.find(p => p.user_id === attempt.student_id) || {
          display_name: 'Unknown Student',
          email: undefined,
        },
      }));

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
      const updatedAnswers = attempt.answers.map((answer) => {
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

      // Update with new score and mark as graded (manual grading complete)
      const { error: finalUpdateError } = await supabase
        .from('quiz_attempts')
        .update({
          score: scoreData.score,
          points_earned: scoreData.points_earned,
          points_possible: scoreData.points_possible,
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

  return {
    loading,
    fetchTeacherQuizzes,
    fetchClassroomQuizzes,
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
  };
};