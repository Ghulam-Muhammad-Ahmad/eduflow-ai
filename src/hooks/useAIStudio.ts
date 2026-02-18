/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  generateRubric,
  generateRubricCriterion,
  generateQuizQuestions,
  generatePaper,
  generateWorksheet,
  generateWorksheetQuestion,
  AI_SOURCE_TEXT_MAX_CHARS,
  type AIGenerateResult,
  type GeneratePaperParams,
  type GenerateWorksheetParams,
  type PaperQuestionType,
} from '@/services/aiService';
import { parseRubricJson, type RubricJson } from '@/types/rubric';
import {
  normalizeWorksheetContent,
  type WorksheetContent,
  type WorksheetQuestion,
} from '@/types/worksheet';

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
  const [regeneratingCriterionIndex, setRegeneratingCriterionIndex] = useState<number | null>(null);
  const [regeneratingWorksheetQuestionIndex, setRegeneratingWorksheetQuestionIndex] = useState<number | null>(null);

  // Generate rubric from assignment description and/or a document with instructions. At least one must be provided.
  const createRubric = async (params: {
    assignmentDescription?: string;
    sourceMaterial?: string;
    sourceName?: string;
  }): Promise<(AIGenerateResult & { savedContent?: AIGeneratedContent | null }) | null> => {
    if (!user?.id) return null;

    const typedDescription = params.assignmentDescription?.trim() ?? "";
    const docText = params.sourceMaterial?.trim();
    const effectiveDescription = (typedDescription || docText) ?? "";
    if (!effectiveDescription) {
      toast({
        title: 'Error',
        description: 'Provide an assignment description or attach a document with instructions.',
        variant: 'destructive',
      });
      return null;
    }

    setLoading(true);
    try {
      const sourceMaterialRaw = docText;
      const overLimit = (sourceMaterialRaw?.length ?? 0) > AI_SOURCE_TEXT_MAX_CHARS;
      const sourceMaterial =
        sourceMaterialRaw && overLimit
          ? sourceMaterialRaw.slice(0, AI_SOURCE_TEXT_MAX_CHARS) +
            "\n\n[Reference material was truncated due to length.]"
          : sourceMaterialRaw;
      if (overLimit) {
        toast({
          title: 'Source truncated',
          description: `Only the first ~${AI_SOURCE_TEXT_MAX_CHARS.toLocaleString()} characters were sent. Use a shorter document or PDF for full content.`,
          variant: 'default',
        });
      }

      // When user provided both: use typed as main assignment, doc as reference. When only doc: use doc as assignment (no separate reference block).
      const assignmentDescription = typedDescription || effectiveDescription;
      const source =
        typedDescription && sourceMaterialRaw
          ? { sourceMaterial: sourceMaterial ?? undefined, sourceName: params.sourceName }
          : undefined;

      const result = await generateRubric(
        assignmentDescription,
        user.id,
        undefined,
        source
      );

      if (result.success) {
        const parsed = parseRubricJson(result.content);
        const saved = await saveGeneratedContent({
          content_type: 'rubric',
          title: 'Generated Rubric',
          content: { text: result.content, rubric: parsed ?? undefined },
          metadata: {
            assignmentDescription: effectiveDescription,
            sourceName: params.sourceName ?? undefined,
            sourceMaterial: sourceMaterial ?? undefined,
          },
        });
        return { ...result, savedContent: saved ?? undefined };
      }

      return { ...result, savedContent: undefined };
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

  /** Generate rubric content only (no save). Use to regenerate and then update an existing record. Sends current rubric + optional instructions for context. */
  const regenerateRubricContent = async (
    assignmentDescription: string,
    options?: { currentRubric?: string; editInstructions?: string },
    source?: { sourceMaterial?: string; sourceName?: string }
  ): Promise<AIGenerateResult | null> => {
    if (!user?.id) return null;
    setLoading(true);
    try {
      const result = await generateRubric(assignmentDescription, user.id, options, source);
      return result;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to regenerate rubric',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  /** Regenerate a single criterion; returns result with content = JSON (full rubric with one criterion). Sends full rubric as context. */
  const regenerateCriterion = async (
    assignmentDescription: string,
    rubric: RubricJson,
    criterionIndex: number,
    source?: { sourceMaterial?: string; sourceName?: string }
  ): Promise<AIGenerateResult | null> => {
    if (!user?.id) return null;
    const criterion = rubric.criteria[criterionIndex];
    if (!criterion) return null;

    setRegeneratingCriterionIndex(criterionIndex);
    try {
      const otherNames = rubric.criteria.filter((_, i) => i !== criterionIndex).map((c) => c.name);
      const currentRubricContext = JSON.stringify(rubric, null, 2);
      const result = await generateRubricCriterion(
        assignmentDescription,
        { name: criterion.name, max_points: criterion.max_points },
        otherNames,
        user.id,
        currentRubricContext,
        source
      );
      return result;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to regenerate criterion',
        variant: 'destructive',
      });
      return null;
    } finally {
      setRegeneratingCriterionIndex(null);
    }
  };

  // Paper (exam/test) generation
  const createPaper = async (
    params: GeneratePaperParams
  ): Promise<(AIGenerateResult & { savedContent?: AIGeneratedContent | null }) | null> => {
    if (!user?.id) return null;

    setLoading(true);
    try {
      const result = await generatePaper(params, user.id);

      if (result.success && result.content) {
        const title = `Paper: ${params.subject} - ${params.topic}`;
        const saved = await saveGeneratedContent({
          content_type: 'paper',
          title,
          content: { text: result.content },
          metadata: {
            subject: params.subject,
            gradeLevel: params.gradeLevel,
            topic: params.topic,
            duration: params.duration,
            questionTypes: params.questionTypes,
            numQuestions: params.numQuestions,
            questionBreakdown: params.questionBreakdown,
            totalMarks: params.totalMarks,
            customInstruction: params.customInstruction,
            sourceMaterial: params.sourceMaterial,
            sourcePdfBase64: params.sourcePdfBase64,
            sourcePdfFileName: params.sourcePdfFileName,
            sourceName: params.sourceName,
          },
        });
        return { ...result, savedContent: saved ?? undefined };
      }

      return { ...result, savedContent: undefined };
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate paper',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Worksheet (template + JSON content) generation
  const createWorksheet = async (params: {
    templateId: string;
    topic: string;
    grade: string;
    difficulty: string;
    instructions?: string;
    questionCount?: number;
    sourceMaterial?: string;
    sourcePdfBase64?: string;
    sourcePdfFileName?: string;
  }): Promise<(AIGenerateResult & { savedContent?: AIGeneratedContent | null }) | null> => {
    if (!user?.id) return null;

    setLoading(true);
    try {
      const genParams: GenerateWorksheetParams = {
        topic: params.topic,
        grade: params.grade,
        difficulty: params.difficulty,
        instructions: params.instructions,
        questionCount: params.questionCount,
        sourceMaterial: params.sourceMaterial,
        sourcePdfBase64: params.sourcePdfBase64,
        sourcePdfFileName: params.sourcePdfFileName,
      };
      const result = await generateWorksheet(genParams, user.id);

      if (result.success && result.content) {
        try {
          const raw = result.content.trim().replace(/^```json?\s*|\s*```$/g, '');
          const parsed = JSON.parse(raw) as Partial<WorksheetContent>;
          const data = normalizeWorksheetContent(parsed);
          const saved = await saveGeneratedContent({
            content_type: 'worksheet_builder',
            title: data.title,
            content: { worksheet: data, text: JSON.stringify(data) },
            metadata: {
              templateId: params.templateId,
              topic: params.topic,
              grade: params.grade,
              difficulty: params.difficulty,
              instructions: params.instructions,
              questionCount: params.questionCount,
              sourceMaterial: params.sourceMaterial ? true : undefined,
            },
          });
          return { ...result, savedContent: saved ?? undefined };
        } catch (parseErr: any) {
          toast({
            title: 'Error',
            description: parseErr?.message || 'Invalid worksheet JSON from AI',
            variant: 'destructive',
          });
          return { ...result, success: false, error: 'Invalid worksheet JSON', savedContent: undefined };
        }
      }
      return { ...result, savedContent: undefined };
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

  /** Regenerate entire worksheet; loads item by contentId, uses metadata for topic/grade/difficulty. */
  const regenerateWorksheet = async (
    contentId: string,
    options?: { editInstructions?: string }
  ): Promise<AIGeneratedContent | null> => {
    if (!user?.id) return null;
    const item = await fetchGeneratedContentById(contentId);
    if (!item || item.content_type !== 'worksheet_builder') return null;
    const meta = (item.metadata && typeof item.metadata === 'object' ? item.metadata : {}) as Record<string, unknown>;
    const topic = (meta.topic as string) ?? '';
    const grade = (meta.grade as string) ?? '';
    const difficulty = (meta.difficulty as string) ?? 'medium';
    const questionCount = (meta.questionCount as number) ?? 10;

    setLoading(true);
    try {
      const result = await generateWorksheet(
        {
          topic,
          grade,
          difficulty,
          instructions: options?.editInstructions,
          questionCount,
        },
        user.id
      );
      if (!result.success || !result.content) return null;
      const raw = result.content.trim().replace(/^```json?\s*|\s*```$/g, '');
      const parsed = JSON.parse(raw) as Partial<WorksheetContent>;
      const data = normalizeWorksheetContent(parsed);
      const contentObj = item.content && typeof item.content === 'object' ? item.content : {};
      const updated = await updateGeneratedContent(
        contentId,
        {
          content: { ...contentObj, worksheet: data, text: JSON.stringify(data) },
          metadata: { ...meta, lastEditInstructions: options?.editInstructions },
        },
        { silent: true }
      );
      if (updated) toast({ title: 'Regenerated', description: 'Worksheet updated.' });
      return updated;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to regenerate worksheet',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  /** Regenerate a single question at questionIndex; returns updated content or null. */
  const regenerateWorksheetQuestion = async (
    contentId: string,
    questionIndex: number,
    options?: { difficulty?: string }
  ): Promise<WorksheetQuestion | null> => {
    if (!user?.id) return null;
    const item = await fetchGeneratedContentById(contentId);
    if (!item || item.content_type !== 'worksheet_builder') return null;
    const contentObj = item.content && typeof item.content === 'object' ? item.content : {};
    const worksheet = contentObj.worksheet as WorksheetContent | undefined;
    const questions = worksheet?.questions ?? [];
    const question = questions[questionIndex];
    if (!question) return null;

    const meta = (item.metadata && typeof item.metadata === 'object' ? item.metadata : {}) as Record<string, unknown>;
    const topic = (meta.topic as string) ?? '';
    const grade = (meta.grade as string) ?? '';
    const difficulty = (options?.difficulty as string) ?? (meta.difficulty as string) ?? 'medium';

    setRegeneratingWorksheetQuestionIndex(questionIndex);
    try {
      const result = await generateWorksheetQuestion(
        {
          topic,
          grade,
          difficulty,
          questionType: question.type,
          currentQuestionText: question.question,
        },
        user.id
      );
      if (!result.success || !result.content) return null;
      const raw = result.content.trim().replace(/^```json?\s*|\s*```$/g, '');
      const one = JSON.parse(raw) as Partial<WorksheetQuestion>;
      const newQuestion: WorksheetQuestion = {
        id: question.id,
        type: (one.type && ['short', 'long', 'mcq', 'true_false', 'fill_blank'].includes(one.type) ? one.type : question.type) as WorksheetQuestion['type'],
        question: typeof one.question === 'string' ? one.question : question.question,
        options: Array.isArray(one.options) ? one.options : question.options,
        answer: typeof one.answer === 'string' ? one.answer : question.answer,
      };
      const newQuestions = questions.map((q, i) => (i === questionIndex ? newQuestion : q));
      const newWorksheet: WorksheetContent = {
        ...worksheet,
        title: worksheet?.title ?? 'Worksheet',
        instructions: worksheet?.instructions ?? '',
        questions: newQuestions,
      };
      await updateGeneratedContent(
        contentId,
        { content: { ...contentObj, worksheet: newWorksheet, text: JSON.stringify(newWorksheet) } },
        { silent: true }
      );
      return newQuestion;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to regenerate question',
        variant: 'destructive',
      });
      return null;
    } finally {
      setRegeneratingWorksheetQuestionIndex(null);
    }
  };

  /** Regenerate paper: uses original source (PDF/text), metadata, and optional edit instructions. */
  const regeneratePaper = async (
    contentId: string,
    options?: { editInstructions?: string }
  ): Promise<AIGeneratedContent | null> => {
    if (!user?.id) return null;
    const item = await fetchGeneratedContentById(contentId);
    if (!item || item.content_type !== 'paper') return null;
    const meta = (item.metadata && typeof item.metadata === 'object' ? item.metadata : {}) as Record<string, unknown>;
    const contentObj = item.content && typeof item.content === 'object' ? (item.content as { text?: string }) : {};
    const currentText = contentObj.text ?? '';
    const subject = (meta.subject as string) ?? '';
    const gradeLevel = (meta.gradeLevel as string) ?? '';
    const topic = (meta.topic as string) ?? '';
    if (!subject || !gradeLevel || !topic) {
      toast({
        title: 'Cannot regenerate',
        description: 'Original paper subject, grade level, or topic is missing.',
        variant: 'destructive',
      });
      return null;
    }
    const questionTypes = Array.isArray(meta.questionTypes)
      ? (meta.questionTypes as PaperQuestionType[]).filter((t) =>
          ['multiple_choice', 'short_answer', 'long_answer', 'true_false'].includes(t)
        )
      : (['multiple_choice', 'short_answer'] as PaperQuestionType[]);
    const params: GeneratePaperParams = {
      subject,
      gradeLevel,
      topic,
      questionTypes: questionTypes.length ? questionTypes : (['multiple_choice', 'short_answer'] as PaperQuestionType[]),
      sourceMaterial: meta.sourceMaterial as string | undefined,
      sourcePdfBase64: meta.sourcePdfBase64 as string | undefined,
      sourcePdfFileName: meta.sourcePdfFileName as string | undefined,
      customInstruction: meta.customInstruction as string | undefined,
      duration: meta.duration as number | undefined,
      numQuestions: meta.numQuestions as number | undefined,
      questionBreakdown: meta.questionBreakdown as Partial<Record<PaperQuestionType, number>> | undefined,
      totalMarks: meta.totalMarks as number | undefined,
      editInstructions: options?.editInstructions?.trim() || undefined,
      currentPaperText: currentText || undefined,
    };
    setLoading(true);
    try {
      const result = await generatePaper(params, user.id);
      if (!result.success || !result.content) return null;
      const updated = await updateGeneratedContent(
        contentId,
        {
          content: { ...contentObj, text: result.content },
          metadata: { ...meta, lastEditInstructions: options?.editInstructions?.trim() || undefined },
        },
        { silent: true }
      );
      if (updated) toast({ title: 'Regenerated', description: 'Paper updated with same source and your instructions.' });
      return updated;
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to regenerate paper',
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

  // Smart Tutor: adapt content from pasted text or uploaded file (PDF sent to OpenAI; DOCX/DOC/TXT extracted to text)
  // For regeneration from output page: pass current content as pastedText and optional editInstructions.
  const smartTutorContent = async (payload: {
    pastedText?: string;
    pdfBase64?: string;
    /** File name when uploading (e.g. "notes.docx") so API can choose PDF vs text extraction. */
    fileName?: string;
    targetLevel: 'below_grade' | 'at_grade' | 'above_grade';
    subject: string;
    gradeLevel: string;
    /** Optional instructions when regenerating (e.g. "add more examples", "simplify further"). */
    editInstructions?: string;
  }): Promise<(AIGenerateResult & { savedContent?: AIGeneratedContent }) | null> => {
    if (!user?.id) return null;
    if (!payload.pastedText && !payload.pdfBase64) return null;

    setLoading(true);
    try {
      const response = await fetch('/api/ai/smart-tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pastedText: payload.pastedText || undefined,
          pdfBase64: payload.pdfBase64 || undefined,
          fileName: payload.fileName || undefined,
          targetLevel: payload.targetLevel,
          subject: payload.subject,
          gradeLevel: payload.gradeLevel,
          editInstructions: payload.editInstructions || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Smart tutor request failed');
      }

      if (data.success && data.content) {
        const saved = await saveGeneratedContent({
          content_type: 'worksheet',
          title: `Smart Tutor (${payload.targetLevel})`,
          content: {
            text: data.content,
            original: payload.pastedText ? payload.pastedText : '[PDF document]',
          },
          metadata: {
            targetLevel: payload.targetLevel,
            subject: payload.subject,
            gradeLevel: payload.gradeLevel,
            source: payload.pdfBase64 ? 'pdf' : 'paste',
          },
        });
        return {
          content: data.content,
          provider: 'openai',
          model: data.model || 'gpt-4o',
          tokens: 0,
          cost: 0,
          success: true,
          savedContent: saved ?? undefined,
        };
      }

      return null;
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to adapt content',
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
          content_type: data.content_type,
          title: data.title,
          content: data.content,
          source_materials: data.source_materials ?? null,
          metadata: data.metadata ?? null,
          saved_to_documents: false,
        })
        .select()
        .single();

      if (error) throw error;
      return saved as AIGeneratedContent;
    } catch (error: any) {
      console.error('Error saving generated content:', error);
      toast({
        title: 'Could not save to history',
        description: error?.message ?? 'Please try again or copy the content below.',
        variant: 'destructive',
      });
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

  // Fetch a single generated content by id (must belong to user)
  const fetchGeneratedContentById = async (id: string): Promise<AIGeneratedContent | null> => {
    if (!user?.id) return null;
    try {
      const { data, error } = await supabase
        .from('ai_generated_content')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();
      if (error) throw error;
      return data as AIGeneratedContent;
    } catch (error: any) {
      console.error('Error fetching generated content by id:', error);
      return null;
    }
  };

  // Update generated content (partial update). Set options.silent to skip success toast.
  const updateGeneratedContent = async (
    id: string,
    updates: { title?: string; content?: any; metadata?: any },
    options?: { silent?: boolean }
  ): Promise<AIGeneratedContent | null> => {
    if (!user?.id) return null;
    try {
      const { data, error } = await supabase
        .from('ai_generated_content')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();
      if (error) throw error;
      if (!options?.silent) {
        toast({ title: 'Saved', description: 'Content updated successfully' });
      }
      return data as AIGeneratedContent;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update content',
        variant: 'destructive',
      });
      return null;
    }
  };

  // Toggle favorite (stored in metadata.is_favorite)
  const toggleFavorite = async (id: string): Promise<boolean> => {
    const item = await fetchGeneratedContentById(id);
    if (!item) return false;
    const next = !(item.metadata && typeof item.metadata === 'object' && (item.metadata as { is_favorite?: boolean }).is_favorite);
    const updated = await updateGeneratedContent(
      id,
      { metadata: { ...(item.metadata as object || {}), is_favorite: next } },
      { silent: true }
    );
    if (updated) {
      toast({
        title: next ? 'Added to favorites' : 'Removed from favorites',
      });
      return true;
    }
    return false;
  };

  // Delete generated content
  const deleteGeneratedContent = async (id: string) => {
    if (!user?.id) return false;
    try {
      const { error } = await supabase
        .from('ai_generated_content')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

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
    regeneratingCriterionIndex,
    regeneratingWorksheetQuestionIndex,
    createRubric,
    regenerateRubricContent,
    regenerateCriterion,
    createPaper,
    regeneratePaper,
    createWorksheet,
    regenerateWorksheet,
    regenerateWorksheetQuestion,
    createQuizQuestions,
    smartTutorContent,
    saveGeneratedContent,
    fetchGeneratedContent,
    fetchGeneratedContentById,
    updateGeneratedContent,
    toggleFavorite,
    deleteGeneratedContent,
  };
};
