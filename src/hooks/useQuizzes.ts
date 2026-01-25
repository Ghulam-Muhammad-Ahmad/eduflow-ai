import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
    subject?: string;
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

  // Fetch all quizzes for a teacher
  const fetchTeacherQuizzes = async (teacherId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('quizzes')
        .select(`
          *,
          classroom:classrooms(name, subject)
        `)
        .eq('teacher_id', teacherId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Quiz[];
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

  // Fetch quizzes for a specific classroom
  const fetchClassroomQuizzes = async (classroomId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('quizzes')
        .select('*')
        .eq('classroom_id', classroomId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Quiz[];
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

  // Fetch available quizzes for a student
  const fetchStudentQuizzes = async (studentId: string) => {
    try {
      setLoading(true);
      
      // Get student's enrolled classrooms
      const { data: enrollments, error: enrollError } = await supabase
        .from('enrollments')
        .select('classroom_id')
        .eq('student_id', studentId)
        .eq('status', 'active');

      if (enrollError) throw enrollError;

      const classroomIds = enrollments?.map(e => e.classroom_id) || [];

      if (classroomIds.length === 0) {
        return [];
      }

      // Get active quizzes from enrolled classrooms
      const { data, error } = await supabase
        .from('quizzes')
        .select(`
          *,
          classroom:classrooms(name, subject)
        `)
        .in('classroom_id', classroomIds)
        .in('status', ['scheduled', 'active'])
        .order('available_from', { ascending: true, nullsFirst: false });

      if (error) throw error;
      return data as Quiz[];
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

  // Fetch a single quiz with questions
  const fetchQuizWithQuestions = async (quizId: string) => {
    try {
      setLoading(true);
      
      const { data: quiz, error: quizError } = await supabase
        .from('quizzes')
        .select(`
          *,
          classroom:classrooms(name, subject)
        `)
        .eq('id', quizId)
        .single();

      if (quizError) throw quizError;

      const { data: questions, error: questionsError } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', quizId)
        .order('order_index', { ascending: true });

      if (questionsError) throw questionsError;

      return { quiz: quiz as Quiz, questions: questions as QuizQuestion[] };
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
  };

  // Create a new quiz
  const createQuiz = async (quiz: Partial<Quiz>, questions: QuizQuestion[]) => {
    try {
      setLoading(true);

      // Insert quiz
      const { data: newQuiz, error: quizError } = await supabase
        .from('quizzes')
        .insert([quiz])
        .select()
        .single();

      if (quizError) throw quizError;

      // Insert questions
      const questionsWithQuizId = questions.map((q, index) => ({
        ...q,
        quiz_id: newQuiz.id,
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

      return newQuiz as Quiz;
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
        const questionsWithQuizId = questions.map((q, index) => ({
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
      const { error } = await supabase
        .from('quizzes')
        .update({ status: 'closed' })
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

  // Start a quiz attempt
  const startQuizAttempt = async (quizId: string, studentId: string) => {
    try {
      setLoading(true);

      // Check if can attempt
      const canAttempt = await checkCanAttemptQuiz(quizId, studentId);
      if (!canAttempt.can_attempt) {
        toast({
          title: 'Cannot Start Quiz',
          description: canAttempt.reason || 'You cannot attempt this quiz',
          variant: 'destructive',
        });
        return null;
      }

      // Get attempt number
      const { data: attempts, error: attemptsError } = await supabase
        .from('quiz_attempts')
        .select('attempt_number')
        .eq('quiz_id', quizId)
        .eq('student_id', studentId)
        .order('attempt_number', { ascending: false })
        .limit(1);

      if (attemptsError) throw attemptsError;

      const attemptNumber = attempts && attempts.length > 0 ? attempts[0].attempt_number + 1 : 1;

      // Create attempt
      const { data: attempt, error } = await supabase
        .from('quiz_attempts')
        .insert([
          {
            quiz_id: quizId,
            student_id: studentId,
            attempt_number: attemptNumber,
            status: 'in_progress',
          },
        ])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Quiz Started',
        description: 'Good luck!',
      });

      return attempt as QuizAttempt;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to start quiz',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Submit quiz attempt
  const submitQuizAttempt = async (
    attemptId: string,
    answers: QuizAttempt['answers'],
    timeSpentSeconds: number
  ) => {
    try {
      setLoading(true);

      const { error } = await supabase
        .from('quiz_attempts')
        .update({
          answers,
          submitted_at: new Date().toISOString(),
          time_spent_seconds: timeSpentSeconds,
          status: 'submitted',
          auto_graded_at: new Date().toISOString(),
        })
        .eq('id', attemptId);

      if (error) throw error;

      // Calculate score
      const { data: scoreData, error: scoreError } = await supabase.rpc(
        'calculate_quiz_score',
        { attempt_id: attemptId }
      );

      if (scoreError) throw scoreError;

      // Update with score
      const { error: updateError } = await supabase
        .from('quiz_attempts')
        .update({
          score: scoreData.score,
          points_earned: scoreData.points_earned,
          points_possible: scoreData.points_possible,
          status: 'graded',
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
        .select(`
          *,
          quiz:quizzes(
            *,
            classroom:classrooms(name, subject)
          )
        `)
        .eq('student_id', studentId);

      if (quizId) {
        query = query.eq('quiz_id', quizId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      return data as QuizAttempt[];
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

  // Fetch quiz attempts for a teacher (all attempts for their quizzes)
  const fetchQuizAttempts = async (quizId: string) => {
    try {
      setLoading(true);
      
      // First fetch the attempts
      const { data: attemptsData, error: attemptsError } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('quiz_id', quizId)
        .order('submitted_at', { ascending: false, nullsFirst: false });

      if (attemptsError) throw attemptsError;
      if (!attemptsData || attemptsData.length === 0) return [];

      // Get unique student IDs
      const studentIds = [...new Set(attemptsData.map(a => a.student_id))];

      // Fetch profiles for these students
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name, email')
        .in('user_id', studentIds);

      if (profilesError) throw profilesError;

      // Combine attempts with profile data
      const attemptsWithProfiles = attemptsData.map(attempt => ({
        ...attempt,
        student: profilesData?.find(p => p.user_id === attempt.student_id) || {
          display_name: 'Unknown Student',
          email: undefined,
        },
      }));

      return attemptsWithProfiles as QuizAttempt[];
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
        .single();

      if (fetchError) throw fetchError;

      // Update answers with grades
      const updatedAnswers = (attempt.answers as QuizAttempt['answers']).map((answer) => {
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

      // Update with new score
      const { error: finalUpdateError } = await supabase
        .from('quiz_attempts')
        .update({
          score: scoreData.score,
          points_earned: scoreData.points_earned,
          points_possible: scoreData.points_possible,
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
        .single();

      if (error) throw error;
      return data as QuizAttempt;
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
