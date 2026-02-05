import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { gradeSubmission } from '@/services/aiService';
import type { AIGenerateResult } from '@/services/aiService';

export interface AIFeedback {
  id: string;
  submission_id: string;
  user_id: string;
  feedback_data: {
    grammar_errors: Array<{ text: string; suggestion: string; position?: number }>;
    spelling_errors: Array<{ word: string; suggestion: string }>;
    content_analysis: string;
    suggestions: Array<{ type: string; text: string; priority: 'high' | 'medium' | 'low' }>;
    overall_feedback: string;
  };
  rubric_suggestions?: Array<{ criterion: string; score: number; max_score: number; feedback: string }>;
  consistency_hash?: string;
  accepted: boolean;
  modified_feedback?: string;
  created_at: string;
  updated_at: string;
}

export const useAIChecker = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Check a single submission with AI
  const gradeSubmissionWithAI = async (
    submissionId: string,
    submissionText: string,
    assignmentDescription: string,
    rubric?: string
  ): Promise<AIGenerateResult | null> => {
    if (!user?.id) return null;

    setLoading(true);
    try {
      const result = await gradeSubmission(
        submissionText,
        assignmentDescription,
        rubric,
        user.id
      );

      if (result.success) {
        await saveAIFeedback(submissionId, result.content, rubric);
      }

      return result;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to check submission',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Check multiple submissions in batch
  const gradeBatchSubmissions = async (
    submissions: Array<{
      id: string;
      text: string;
      assignmentDescription: string;
      rubric?: string;
    }>
  ): Promise<Array<{ submissionId: string; result: AIGenerateResult | null }>> => {
    if (!user?.id) return [];

    setLoading(true);
    const results: Array<{ submissionId: string; result: AIGenerateResult | null }> = [];

    try {
      for (const submission of submissions) {
        const result = await gradeSubmission(
          submission.text,
          submission.assignmentDescription,
          submission.rubric,
          user.id
        );

        if (result.success) {
          await saveAIFeedback(submission.id, result.content, submission.rubric);
        }

        results.push({ submissionId: submission.id, result });
      }

      toast({
        title: 'Success',
        description: `Checked ${results.length} submissions`,
      });

      return results;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to check submissions',
        variant: 'destructive',
      });
      return results;
    } finally {
      setLoading(false);
    }
  };

  // Save AI feedback to database
  const saveAIFeedback = async (
    submissionId: string,
    feedbackText: string,
    rubric?: string
  ) => {
    if (!user?.id) return null;

    try {
      const feedbackData = parseFeedback(feedbackText);
      const consistencyHash = calculateConsistencyHash(feedbackData);

      const { data, error } = await supabase
        .from('ai_feedback')
        .insert({
          submission_id: submissionId,
          user_id: user.id,
          feedback_data: feedbackData,
          consistency_hash: consistencyHash,
        })
        .select()
        .single();

      if (error) throw error;
      return data as AIFeedback;
    } catch (error: any) {
      console.error('Error saving AI feedback:', error);
      return null;
    }
  };

  // Fetch AI feedback for a submission
  const fetchAIFeedback = async (submissionId: string): Promise<AIFeedback | null> => {
    try {
      const { data, error } = await supabase
        .from('ai_feedback')
        .select('*')
        .eq('submission_id', submissionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as AIFeedback | null;
    } catch (error: any) {
      console.error('Error fetching AI feedback:', error);
      return null;
    }
  };

  // Accept AI feedback (mark as accepted)
  const acceptAIFeedback = async (feedbackId: string, modifiedFeedback?: string) => {
    try {
      const { error } = await supabase
        .from('ai_feedback')
        .update({
          accepted: true,
          modified_feedback: modifiedFeedback || null,
        })
        .eq('id', feedbackId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Feedback accepted',
      });
      return true;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to accept feedback',
        variant: 'destructive',
      });
      return false;
    }
  };

  const parseFeedback = (text: string): any => {
    return {
      overall_feedback: text,
      grammar_errors: [],
      spelling_errors: [],
      content_analysis: text,
      suggestions: [],
    };
  };

  const calculateConsistencyHash = (feedbackData: any): string => {
    const errorTypes = [
      ...(feedbackData.grammar_errors || []).map((e: any) => e.type || 'grammar'),
      ...(feedbackData.spelling_errors || []).map((e: any) => 'spelling'),
    ].sort().join(',');
    return btoa(errorTypes).substring(0, 16);
  };

  return {
    loading,
    gradeSubmissionWithAI,
    gradeBatchSubmissions,
    fetchAIFeedback,
    acceptAIFeedback,
  };
};
