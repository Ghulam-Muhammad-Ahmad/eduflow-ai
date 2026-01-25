import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  generateContent,
  generateRubric,
  generateQuizQuestions,
  generateAI,
  type AIGenerateResult,
} from '@/services/aiService';

export interface AIGeneratedContent {
  id: string;
  user_id: string;
  content_type: string;
  title: string;
  content: any;
  source_materials?: any;
  metadata?: any;
  saved_to_documents: boolean;
  document_id?: string;
  created_at: string;
  updated_at: string;
}

export const useAIStudio = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Generate worksheet, discussion questions, or project ideas
  const generateWorksheet = async (
    topic: string,
    gradeLevel: string,
    subject: string
  ): Promise<AIGenerateResult | null> => {
    if (!user?.id) return null;

    setLoading(true);
    try {
      const prompt = `Create a worksheet for ${gradeLevel} grade ${subject} on the topic: ${topic}. Include a variety of question types and activities.`;
      const result = await generateContent(prompt, user.id, 'worksheet');
      
      if (result.success) {
        await saveGeneratedContent({
          content_type: 'worksheet',
          title: `${topic} Worksheet`,
          content: { text: result.content },
          metadata: { topic, gradeLevel, subject },
        });
      }
      
      return result;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate worksheet',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const generateDiscussionQuestions = async (
    topic: string,
    numQuestions: number = 5
  ): Promise<AIGenerateResult | null> => {
    if (!user?.id) return null;

    setLoading(true);
    try {
      const prompt = `Generate ${numQuestions} thought-provoking discussion questions about: ${topic}`;
      const result = await generateContent(prompt, user.id, 'discussion_questions');
      
      if (result.success) {
        await saveGeneratedContent({
          content_type: 'discussion_questions',
          title: `Discussion Questions: ${topic}`,
          content: { text: result.content },
          metadata: { topic, numQuestions },
        });
      }
      
      return result;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate discussion questions',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const generateProjectIdeas = async (
    subject: string,
    gradeLevel: string,
    topic: string
  ): Promise<AIGenerateResult | null> => {
    if (!user?.id) return null;

    setLoading(true);
    try {
      const prompt = `Generate creative project ideas for ${gradeLevel} grade ${subject} students on the topic: ${topic}. Include project descriptions, materials needed, and learning objectives.`;
      const result = await generateContent(prompt, user.id, 'project_ideas');
      
      if (result.success) {
        await saveGeneratedContent({
          content_type: 'project_ideas',
          title: `Project Ideas: ${topic}`,
          content: { text: result.content },
          metadata: { subject, gradeLevel, topic },
        });
      }
      
      return result;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate project ideas',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Generate rubric from assignment description
  const createRubric = async (assignmentDescription: string): Promise<AIGenerateResult | null> => {
    if (!user?.id) return null;

    setLoading(true);
    try {
      const result = await generateRubric(assignmentDescription, user.id);
      
      if (result.success) {
        await saveGeneratedContent({
          content_type: 'rubric',
          title: 'Generated Rubric',
          content: { text: result.content },
          metadata: { assignmentDescription },
        });
      }
      
      return result;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate rubric',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Generate quiz questions from source material
  const createQuizQuestions = async (
    sourceMaterial: string,
    numQuestions: number,
    questionType: 'multiple_choice' | 'true_false' | 'short_answer'
  ): Promise<AIGenerateResult | null> => {
    if (!user?.id) return null;

    setLoading(true);
    try {
      const result = await generateQuizQuestions(
        sourceMaterial,
        numQuestions,
        questionType,
        user.id
      );
      
      if (result.success) {
        await saveGeneratedContent({
          content_type: 'quiz_questions',
          title: `Quiz Questions (${questionType})`,
          content: { text: result.content, questions: parseQuizQuestions(result.content) },
          source_materials: [{ type: 'text', content: sourceMaterial }],
          metadata: { numQuestions, questionType },
        });
      }
      
      return result;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate quiz questions',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Differentiation assistant - modify content for different learning levels
  const differentiateContent = async (
    originalContent: string,
    targetLevel: 'below_grade' | 'at_grade' | 'above_grade',
    subject: string,
    gradeLevel: string
  ): Promise<AIGenerateResult | null> => {
    if (!user?.id) return null;

    setLoading(true);
    try {
      const levelDescriptions = {
        below_grade: 'simplified for students working below grade level',
        at_grade: 'appropriate for students at grade level',
        above_grade: 'challenging for students working above grade level',
      };

      const prompt = `Modify this ${subject} content for ${gradeLevel} grade students, making it ${levelDescriptions[targetLevel]}:\n\n${originalContent}\n\nMaintain the core concepts but adjust complexity, vocabulary, and depth appropriately.`;
      
      const result = await generateAI({
        taskType: 'differentiation',
        prompt,
        systemInstruction: 'You are an expert in differentiated instruction. Modify content appropriately for different learning levels while maintaining educational value.',
        userId: user.id,
      });
      
      if (result.success) {
        await saveGeneratedContent({
          content_type: 'worksheet',
          title: `Differentiated Content (${targetLevel})`,
          content: { text: result.content, original: originalContent },
          metadata: { targetLevel, subject, gradeLevel },
        });
      }
      
      return result;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to differentiate content',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Save generated content to database
  const saveGeneratedContent = async (data: {
    content_type: string;
    title: string;
    content: any;
    source_materials?: any;
    metadata?: any;
  }) => {
    if (!user?.id) return null;

    try {
      const { data: saved, error } = await supabase
        .from('ai_generated_content')
        .insert({
          user_id: user.id,
          ...data,
        })
        .select()
        .single();

      if (error) throw error;
      return saved as AIGeneratedContent;
    } catch (error: any) {
      console.error('Error saving generated content:', error);
      return null;
    }
  };

  // Fetch user's generated content
  const fetchGeneratedContent = async (contentType?: string) => {
    if (!user?.id) return [];

    try {
      let query = supabase
        .from('ai_generated_content')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (contentType) {
        query = query.eq('content_type', contentType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AIGeneratedContent[];
    } catch (error: any) {
      console.error('Error fetching generated content:', error);
      return [];
    }
  };

  // Delete generated content
  const deleteGeneratedContent = async (id: string) => {
    try {
      const { error } = await supabase
        .from('ai_generated_content')
        .delete()
        .eq('id', id)
        .eq('user_id', user?.id);

      if (error) throw error;
      
      toast({
        title: 'Success',
        description: 'Content deleted successfully',
      });
      return true;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete content',
        variant: 'destructive',
      });
      return false;
    }
  };

  // Helper to parse quiz questions from JSON response
  const parseQuizQuestions = (content: string): any[] => {
    try {
      // Try to extract JSON from the response
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
    generateWorksheet,
    generateDiscussionQuestions,
    generateProjectIdeas,
    createRubric,
    createQuizQuestions,
    differentiateContent,
    saveGeneratedContent,
    fetchGeneratedContent,
    deleteGeneratedContent,
  };
};
