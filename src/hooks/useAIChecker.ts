import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { gradeSubmission } from '@/services/aiService';
import type { AIGenerateResult } from '@/services/aiService';

// Utility Types and Functions for Safe Data Handling
type Json = any; // for Supabase raw output, you may want to use 'unknown' and add runtime logic

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}
function coerceString(val: unknown): string {
  return typeof val === 'string' ? val : '';
}
function coerceNumber(val: unknown): number {
  return typeof val === 'number' ? val : Number(val) || 0;
}
// Defensive parsing for feedback_data
function parseFeedbackData(json: Json): AIFeedback['feedback_data'] {
  if (!isRecord(json)) return {
    grammar_errors: [],
    spelling_errors: [],
    content_analysis: '',
    suggestions: [],
    overall_feedback: '',
  };
  return {
    grammar_errors: Array.isArray(json.grammar_errors)
      ? json.grammar_errors.map((e: any) => ({
          text: coerceString(e?.text),
          suggestion: coerceString(e?.suggestion),
          position: typeof e?.position === 'number' ? e.position : undefined,
        }))
      : [],
    spelling_errors: Array.isArray(json.spelling_errors)
      ? json.spelling_errors.map((e: any) => ({
          word: coerceString(e?.word),
          suggestion: coerceString(e?.suggestion),
        }))
      : [],
    content_analysis: coerceString(json.content_analysis),
    suggestions: Array.isArray(json.suggestions)
      ? json.suggestions.map((e: any) => ({
          type: coerceString(e?.type),
          text: coerceString(e?.text),
          priority: ['high', 'medium', 'low'].includes(e?.priority)
            ? e.priority
            : 'medium',
        }))
      : [],
    overall_feedback: coerceString(json.overall_feedback),
  };
}
function parseRubricSuggestions(json: Json): Array<{ criterion: string; score: number; max_score: number; feedback: string }> | undefined {
  if (!Array.isArray(json)) return undefined;
  return json
    .filter(isRecord)
    .map((r) => ({
      criterion: coerceString(r.criterion),
      score: coerceNumber(r.score),
      max_score: coerceNumber(r.max_score),
      feedback: coerceString(r.feedback),
    }));
}

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

// Reconstruct AIFeedback from raw DB (Json) record
function convertDbToAIFeedback(data: any): AIFeedback {
  return {
    id: coerceString(data.id),
    submission_id: coerceString(data.submission_id),
    user_id: coerceString(data.user_id),
    feedback_data: parseFeedbackData(data.feedback_data),
    rubric_suggestions: parseRubricSuggestions(data.rubric_suggestions),
    consistency_hash: typeof data.consistency_hash === 'string' ? data.consistency_hash : undefined,
    accepted: !!data.accepted,
    modified_feedback: typeof data.modified_feedback === 'string' ? data.modified_feedback : undefined,
    created_at: coerceString(data.created_at),
    updated_at: coerceString(data.updated_at),
  };
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
      return data ? convertDbToAIFeedback(data) : null;
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
      return data ? convertDbToAIFeedback(data) : null;
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
