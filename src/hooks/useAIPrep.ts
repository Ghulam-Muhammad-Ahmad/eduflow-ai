/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  generateStudyMaterials,
  explainConcept,
  generateStudyPlan,
} from '@/services/aiService';
import type { AIGenerateResult } from '@/services/aiService';

export interface StudyMaterial {
  id?: string;
  user_id: string;
  content_type: 'summary' | 'flashcards' | 'practice_questions' | 'concept_explanation' | 'study_plan';
  title: string;
  content: any;
  source_materials?: any;
  metadata?: any;
  created_at?: string;
}

export const useAIPrep = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Generate summary from study materials
  const generateSummary = async (sourceMaterial: string): Promise<AIGenerateResult | null> => {
    if (!user?.id) return null;

    setLoading(true);
    try {
      const result = await generateStudyMaterials(sourceMaterial, 'summary', user.id);
      
      if (result.success) {
        await saveStudyMaterial({
          content_type: 'summary',
          title: 'Study Summary',
          content: { text: result.content },
          source_materials: [{ type: 'text', content: sourceMaterial }],
        });
      }

      return result;
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate summary',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Generate flashcards
  const generateFlashcards = async (sourceMaterial: string): Promise<AIGenerateResult | null> => {
    if (!user?.id) return null;

    setLoading(true);
    try {
      const result = await generateStudyMaterials(sourceMaterial, 'flashcards', user.id);
      
      if (result.success) {
        const flashcards = parseFlashcards(result.content);
        await saveStudyMaterial({
          content_type: 'flashcards',
          title: 'Flashcards',
          content: { flashcards, text: result.content },
          source_materials: [{ type: 'text', content: sourceMaterial }],
        });
      }

      return result;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate flashcards',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Generate practice questions
  const generatePracticeQuestions = async (
    sourceMaterial: string,
    numQuestions: number = 10
  ): Promise<AIGenerateResult | null> => {
    if (!user?.id) return null;

    setLoading(true);
    try {
      const result = await generateStudyMaterials(sourceMaterial, 'practice_questions', user.id);
      
      if (result.success) {
        const questions = parsePracticeQuestions(result.content);
        await saveStudyMaterial({
          content_type: 'practice_questions',
          title: `Practice Questions (${numQuestions})`,
          content: { questions, text: result.content },
          source_materials: [{ type: 'text', content: sourceMaterial }],
          metadata: { numQuestions },
        });
      }

      return result;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate practice questions',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Explain a concept
  const explainConceptSimple = async (
    concept: string,
    context?: string
  ): Promise<AIGenerateResult | null> => {
    if (!user?.id) return null;

    setLoading(true);
    try {
      const result = await explainConcept(concept, user.id, context);
      
      if (result.success) {
        await saveStudyMaterial({
          content_type: 'concept_explanation',
          title: `Explanation: ${concept}`,
          content: { text: result.content, concept, context },
        });
      }

      return result;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to explain concept',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Generate study plan
  const createStudyPlan = async (
    upcomingAssignments: Array<{ title: string; dueDate: string }>,
    availableTime: number
  ): Promise<AIGenerateResult | null> => {
    if (!user?.id) return null;

    setLoading(true);
    try {
      const result = await generateStudyPlan(upcomingAssignments, availableTime, user.id);
      
      if (result.success) {
        await saveStudyMaterial({
          content_type: 'study_plan',
          title: 'Study Plan',
          content: { text: result.content },
          metadata: { upcomingAssignments, availableTime },
        });
      }

      return result;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate study plan',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Save study material to database
  const saveStudyMaterial = async (data: Partial<StudyMaterial>) => {
    if (!user?.id) return null;

    try {
      const { data: saved, error } = await supabase
        .from('ai_generated_content')
        .insert({
          user_id: user.id,
          content_type: data.content_type!,
          title: data.title!,
          content: data.content,
          source_materials: data.source_materials,
          metadata: data.metadata,
        })
        .select()
        .single();

      if (error) throw error;
      return saved;
    } catch (error: any) {
      console.error('Error saving study material:', error);
      return null;
    }
  };

  // Fetch user's study materials
  const fetchStudyMaterials = async (contentType?: string) => {
    if (!user?.id) return [];

    try {
      let query = supabase
        .from('ai_generated_content')
        .select('*')
        .eq('user_id', user.id)
        .in('content_type', [
          'summary',
          'flashcards',
          'practice_questions',
          'concept_explanation',
          'study_plan',
        ])
        .order('created_at', { ascending: false });

      if (contentType) {
        query = query.eq('content_type', contentType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error fetching study materials:', error);
      return [];
    }
  };

  // Helper to parse flashcards from JSON response
  const parseFlashcards = (content: string): any[] => {
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return [];
    } catch {
      return [];
    }
  };

  // Helper to parse practice questions from JSON response
  const parsePracticeQuestions = (content: string): any[] => {
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return [];
    } catch {
      return [];
    }
  };

  return {
    loading,
    generateSummary,
    generateFlashcards,
    generatePracticeQuestions,
    explainConceptSimple,
    createStudyPlan,
    fetchStudyMaterials,
    saveStudyMaterial,
  };
};
