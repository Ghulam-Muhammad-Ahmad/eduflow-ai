/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  generateLessonPlanFromSyllabus,
  type SyllabusLessonInput,
  type SyllabusLessonPlanResult,
} from '@/services/aiService';
import { usePlannerCalendar } from '@/hooks/usePlannerCalendar';
import { addWeeks, setHours, setMinutes, setDay } from 'date-fns';
import { generateLessonPlanPDF } from '@/lib/lessonPlanPdf';

export type TeachingLevel = 'beginner' | 'intermediate' | 'advanced';
export type TeachingStyle = 'concept-based' | 'practice-heavy' | 'revision-focused';

const DEFAULT_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export function useSyllabusLessonPlanner() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { addEvents } = usePlannerCalendar();

  const [contentText, setContentText] = useState('');
  const [subject, setSubject] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [curriculum, setCurriculum] = useState('');
  const [teachingLevel, setTeachingLevel] = useState<TeachingLevel | ''>('');
  const [totalWeeks, setTotalWeeks] = useState(4);
  const [hoursPerWeek, setHoursPerWeek] = useState(5);
  const [classDurationMinutes, setClassDurationMinutes] = useState(60);
  const [daysAvailable, setDaysAvailable] = useState<string[]>(DEFAULT_DAYS);
  const [teachingStyle, setTeachingStyle] = useState<TeachingStyle | ''>('');

  const [plan, setPlan] = useState<SyllabusLessonPlanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [extractingDoc, setExtractingDoc] = useState(false);
  const [savedPlanId, setSavedPlanId] = useState<string | null>(null);
  const [contentPdfBase64, setContentPdfBase64] = useState<string | null>(null);
  const [contentPdfFileName, setContentPdfFileName] = useState<string | null>(null);

  const fetchDocumentText = useCallback(
    async (documentId: string): Promise<string> => {
      if (!user?.id) return '';
      setExtractingDoc(true);
      try {
        const res = await fetch('/api/documents/extract-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to extract text');
        return data.text || '';
      } catch (e: any) {
        toast({
          title: 'Could not extract document',
          description: e.message,
          variant: 'destructive',
        });
        return '';
      } finally {
        setExtractingDoc(false);
      }
    },
    [user?.id, toast]
  );

  const setContentFromDocument = useCallback(
    async (documentId: string) => {
      const text = await fetchDocumentText(documentId);
      if (text) {
        setContentText(text);
        setContentPdfBase64(null);
        setContentPdfFileName(null);
      }
    },
    [fetchDocumentText]
  );

  const setContentFromPdf = useCallback((base64: string, fileName: string) => {
    setContentPdfBase64(base64);
    setContentPdfFileName(fileName);
    setContentText('');
  }, []);

  const buildInput = useCallback((): SyllabusLessonInput => ({
    text: contentText,
    subject,
    gradeLevel: gradeLevel || undefined,
    curriculum: curriculum || undefined,
    teachingLevel: teachingLevel || undefined,
    totalWeeks,
    hoursPerWeek,
    classDurationMinutes,
    daysAvailable: daysAvailable.length ? daysAvailable : undefined,
    teachingStyle: teachingStyle || undefined,
    pdfBase64: contentPdfBase64 ?? undefined,
    pdfFileName: contentPdfFileName ?? undefined,
  }), [contentText, contentPdfBase64, contentPdfFileName, subject, gradeLevel, curriculum, teachingLevel, totalWeeks, hoursPerWeek, classDurationMinutes, daysAvailable, teachingStyle]);

  const generate = useCallback(async () => {
    if (!user?.id) return;
    const hasContent = contentText.trim().length > 0 || (contentPdfBase64 != null && contentPdfBase64.length > 0);
    if (!hasContent) {
      toast({ title: 'Add content', description: 'Paste text, select a document, or upload a PDF.', variant: 'destructive' });
      return;
    }
    if (!subject.trim()) {
      toast({ title: 'Subject required', variant: 'destructive' });
      return;
    }
    setLoading(true);
    setPlan(null);
    try {
      const result = await generateLessonPlanFromSyllabus(buildInput(), user.id);
      if (!result.success) {
        toast({ title: 'Generation failed', description: result.error, variant: 'destructive' });
        return;
      }
      if (result.plan) setPlan(result.plan);
      toast({ title: 'Lesson plan generated', description: result.plan?.summary });
    } finally {
      setLoading(false);
    }
  }, [user?.id, contentText, contentPdfBase64, subject, buildInput, toast]);

  const regenerate = useCallback(
    async (editPrompt: string) => {
      if (!user?.id || !editPrompt.trim()) return;
      setLoading(true);
      try {
        const result = await generateLessonPlanFromSyllabus(
          { ...buildInput(), editPrompt: editPrompt.trim() },
          user.id
        );
        if (!result.success) {
          toast({ title: 'Regeneration failed', description: result.error, variant: 'destructive' });
          return;
        }
        if (result.plan) setPlan(result.plan);
        toast({ title: 'Plan updated', description: editPrompt });
      } finally {
        setLoading(false);
      }
    },
    [user?.id, buildInput, toast]
  );

  const savePlan = useCallback(async () => {
    if (!user?.id || !plan) return;
    try {
      const { data, error } = await supabase
        .from('ai_generated_content')
        .insert({
          user_id: user.id,
          content_type: 'syllabus_lesson_plan',
          title: `Lesson plan: ${subject || 'Syllabus'} (${new Date().toLocaleDateString()})`,
          content: plan as unknown as Json,
          metadata: {
            subject,
            grade_level: gradeLevel,
            curriculum,
            teaching_level: teachingLevel,
            total_weeks: totalWeeks,
            hours_per_week: hoursPerWeek,
            class_duration_minutes: classDurationMinutes,
            days_available: daysAvailable,
            teaching_style: teachingStyle,
          } as unknown as Json,
        })
        .select('id')
        .single();
      if (error) throw error;
      setSavedPlanId(data?.id ?? null);
      toast({ title: 'Plan saved', description: 'Saved to your content.' });
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    }
  }, [user?.id, plan, subject, gradeLevel, curriculum, teachingLevel, totalWeeks, hoursPerWeek, classDurationMinutes, daysAvailable, teachingStyle, toast]);

  const scheduleToCalendar = useCallback(async () => {
    if (!user?.id || !plan?.lessons?.length) return;
    const dayMap: Record<string, number> = {
      Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
    };
    const startDate = new Date();
    let sessionIndex = 0;
    const events: { title: string; start_at: string; end_at: string; all_day: boolean; description: string | null }[] = [];
    for (let w = 0; w < totalWeeks; w++) {
      const weekStart = addWeeks(startDate, w);
      for (const dayName of daysAvailable) {
        const dayNum = dayMap[dayName] ?? 1;
        let slot = setDay(weekStart, dayNum);
        slot = setHours(slot, 9);
        slot = setMinutes(slot, 0);
        const lesson = plan.lessons[sessionIndex];
        if (!lesson) break;
        const end = new Date(slot.getTime() + lesson.durationMinutes * 60 * 1000);
        events.push({
          title: lesson.title,
          start_at: slot.toISOString(),
          end_at: end.toISOString(),
          all_day: false,
          description: [
            lesson.topics?.length ? `Topics: ${lesson.topics.join(', ')}` : '',
            lesson.teachingNotes ? `Notes: ${lesson.teachingNotes}` : '',
          ].filter(Boolean).join('\n') || null,
        });
        sessionIndex++;
        if (sessionIndex >= plan.lessons.length) break;
      }
      if (sessionIndex >= plan.lessons.length) break;
    }
    if (events.length === 0) {
      toast({ title: 'No events', description: 'Could not map lessons to calendar.', variant: 'destructive' });
      return;
    }
    await addEvents(events);
    toast({ title: 'Scheduled', description: `${events.length} lesson(s) added to Calendar.` });
  }, [user?.id, plan, totalWeeks, daysAvailable, addEvents, toast]);

  const downloadPlanPdf = useCallback(() => {
    if (!plan) return;
    const doc = generateLessonPlanPDF(plan, subject || 'Syllabus', `Lesson plan: ${subject || 'Syllabus'}`);
    doc.save(`lesson-plan-${(subject || 'syllabus').replace(/\s+/g, '-')}-${Date.now()}.pdf`);
    toast({ title: 'Download started', description: 'PDF saved to your device.' });
  }, [plan, subject, toast]);

  return {
    contentText,
    setContentText: (t: string) => {
      setContentText(t);
      if (t.trim()) {
        setContentPdfBase64(null);
        setContentPdfFileName(null);
      }
    },
    setContentFromDocument,
    setContentFromPdf,
    contentPdfBase64,
    contentPdfFileName,
    extractingDoc,
    subject,
    setSubject,
    gradeLevel,
    setGradeLevel,
    curriculum,
    setCurriculum,
    teachingLevel,
    setTeachingLevel,
    totalWeeks,
    setTotalWeeks,
    hoursPerWeek,
    setHoursPerWeek,
    classDurationMinutes,
    setClassDurationMinutes,
    daysAvailable,
    setDaysAvailable,
    teachingStyle,
    setTeachingStyle,
    plan,
    setPlan,
    loading,
    savedPlanId,
    generate,
    regenerate,
    savePlan,
    scheduleToCalendar,
    downloadPlanPdf,
    buildInput,
  };
}
