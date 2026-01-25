import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { generateLessonPlan, generateAI } from '@/services/aiService';
import type { AIGenerateResult } from '@/services/aiService';

export interface LessonPlan {
  id?: string;
  user_id: string;
  title: string;
  subject: string;
  grade_level: string;
  topic: string;
  duration: number;
  learning_objectives: string[];
  curriculum_standards?: string[];
  content: any; // Structured lesson plan content
  template_type?: string;
  saved_to_documents: boolean;
  document_id?: string;
  created_at?: string;
  updated_at?: string;
}

const LESSON_TEMPLATES = [
  { id: 'lecture', name: 'Lecture-Based', description: 'Traditional lecture format' },
  { id: 'discussion', name: 'Discussion-Based', description: 'Interactive discussion format' },
  { id: 'lab', name: 'Lab/Hands-On', description: 'Practical hands-on activities' },
  { id: 'project', name: 'Project-Based', description: 'Project-based learning' },
  { id: 'blended', name: 'Blended', description: 'Mix of activities' },
];

export const useLessonPlanner = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Generate lesson plan
  const generatePlan = async (
    subject: string,
    gradeLevel: string,
    topic: string,
    duration: number,
    learningObjectives: string[],
    curriculumStandards?: string[],
    templateType?: string
  ): Promise<AIGenerateResult | null> => {
    if (!user?.id) return null;

    setLoading(true);
    try {
      const result = await generateLessonPlan(
        subject,
        gradeLevel,
        topic,
        duration,
        learningObjectives,
        curriculumStandards,
        user.id
      );

      if (result.success) {
        // Parse and save lesson plan
        const lessonPlanData: Partial<LessonPlan> = {
          user_id: user.id,
          title: `${topic} - ${subject}`,
          subject,
          grade_level: gradeLevel,
          topic,
          duration,
          learning_objectives: learningObjectives,
          curriculum_standards: curriculumStandards,
          content: { text: result.content, structured: parseLessonPlan(result.content) },
          template_type: templateType,
        };

        await saveLessonPlan(lessonPlanData);
      }

      return result;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate lesson plan',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Regenerate a section of the lesson plan
  const regenerateSection = async (
    lessonPlanId: string,
    section: string,
    instructions: string
  ): Promise<AIGenerateResult | null> => {
    if (!user?.id) return null;

    setLoading(true);
    try {
      const prompt = `Regenerate the "${section}" section of this lesson plan with the following modifications: ${instructions}`;
      
      const result = await generateAI({
        taskType: 'lesson_planning',
        prompt,
        systemInstruction: 'You are an expert curriculum designer. Generate lesson plan sections that are clear and actionable.',
        userId: user.id,
      });

      return result;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to regenerate section',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Save lesson plan to database
  const saveLessonPlan = async (data: Partial<LessonPlan>) => {
    if (!user?.id) return null;

    try {
      const { data: saved, error } = await supabase
        .from('ai_generated_content')
        .insert({
          user_id: user.id,
          content_type: 'lesson_plan',
          title: data.title || 'Untitled Lesson Plan',
          content: data.content,
          metadata: {
            subject: data.subject,
            grade_level: data.grade_level,
            topic: data.topic,
            duration: data.duration,
            learning_objectives: data.learning_objectives,
            curriculum_standards: data.curriculum_standards,
            template_type: data.template_type,
          },
        })
        .select()
        .single();

      if (error) throw error;
      return saved;
    } catch (error: any) {
      console.error('Error saving lesson plan:', error);
      return null;
    }
  };

  // Fetch user's lesson plans
  const fetchLessonPlans = async () => {
    if (!user?.id) return [];

    try {
      const { data, error } = await supabase
        .from('ai_generated_content')
        .select('*')
        .eq('user_id', user.id)
        .eq('content_type', 'lesson_plan')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error fetching lesson plans:', error);
      return [];
    }
  };

  // Parse lesson plan text into structured format
  const parseLessonPlan = (text: string): any => {
    // Simple parsing - in production, you'd use more sophisticated parsing
    // or have AI return structured JSON
    const sections = {
      introduction: extractSection(text, 'Introduction', 'Direct Instruction'),
      directInstruction: extractSection(text, 'Direct Instruction', 'Guided Practice'),
      guidedPractice: extractSection(text, 'Guided Practice', 'Independent Practice'),
      independentPractice: extractSection(text, 'Independent Practice', 'Assessment'),
      assessment: extractSection(text, 'Assessment', 'Materials'),
      materials: extractSection(text, 'Materials', ''),
    };

    return sections;
  };

  const extractSection = (text: string, startMarker: string, endMarker: string): string => {
    const startIndex = text.indexOf(startMarker);
    if (startIndex === -1) return '';
    
    const endIndex = endMarker ? text.indexOf(endMarker, startIndex) : text.length;
    if (endIndex === -1) return text.substring(startIndex);
    
    return text.substring(startIndex, endIndex).trim();
  };

  return {
    loading,
    generatePlan,
    regenerateSection,
    saveLessonPlan,
    fetchLessonPlans,
    templates: LESSON_TEMPLATES,
  };
};
