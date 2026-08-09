import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { deductCreditsForRequest } from "@/lib/ai-credits-deduct";
import { chatComplete, extractDocumentText, parseJsonResponse } from "@/server/ai/opencode";

const SYSTEM = `You are an expert academic planner for teachers. Given syllabus or teaching content and time constraints, you produce a structured lesson plan that fits the content into the available time.

Output ONLY valid JSON with no markdown or extra text. Use this exact structure:
{
  "lessons": [
    {
      "lessonNo": 1,
      "title": "Lesson title",
      "learningObjectives": ["objective 1", "objective 2"],
      "durationMinutes": 60,
      "topics": ["topic A", "topic B"],
      "activities": "Brief note on activities (optional)",
      "teachingNotes": "Optional note for teacher",
      "isRevision": false
    }
  ],
  "weeklyDistribution": { "Week 1": [1, 2], "Week 2": [3, 4] },
  "confidence": "full" | "tight" | "insufficient",
  "summary": "One sentence on coverage.",
  "message": "Optional warning if time is tight or content too large."
}

Rules:
- lessonNo must be 1-based and sequential.
- durationMinutes is per session. Total lessons must fit within total teaching hours (totalWeeks * hoursPerWeek * 60 minutes).
- Give harder topics more time. Include revision/assessment slots where appropriate.
- If content cannot fit, set confidence to "insufficient" and suggest in message: skip optional topics, extend duration, or assign self-study.
- weeklyDistribution maps "Week N" to array of lesson numbers in that week.
- teachingNotes and activities can be short; keep teacher-ready.`;

export interface LessonPlanFromSyllabusBody {
  text: string;
  subject: string;
  gradeLevel?: string;
  curriculum?: string;
  teachingLevel?: "beginner" | "intermediate" | "advanced";
  totalWeeks: number;
  hoursPerWeek: number;
  classDurationMinutes: number;
  daysAvailable?: string[];
  teachingStyle?: "concept-based" | "practice-heavy" | "revision-focused";
  editPrompt?: string;
  /** When set, syllabus content is sent as PDF (base64) to the AI; text is ignored for content. */
  pdfBase64?: string;
  pdfFileName?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { user, error: authError } = await getAuthUser(req, res);
  if (authError || !user) {
    return res.status(401).json({
      success: false,
      error: authError?.message ?? "Unauthorized",
    });
  }

  const body = req.body as LessonPlanFromSyllabusBody;
  const {
    text,
    subject,
    gradeLevel,
    curriculum,
    teachingLevel,
    totalWeeks,
    hoursPerWeek,
    classDurationMinutes,
    daysAvailable,
    teachingStyle,
    editPrompt,
    pdfBase64,
    pdfFileName,
  } = body;

  const hasText = Boolean(text?.trim());
  const hasPdf = Boolean(pdfBase64 && typeof pdfBase64 === "string");
  if ((!hasText && !hasPdf) || !subject?.trim()) {
    return res.status(400).json({
      success: false,
      error: "subject is required; provide either text or pdfBase64 (syllabus content)",
    });
  }

  const creditError = await deductCreditsForRequest(user.id, "lesson_planning");
  if (creditError) {
    return res.status(creditError.status).json({
      success: false,
      error: creditError.body.error,
    });
  }

  const totalMinutes = totalWeeks * hoursPerWeek * 60;
  const maxSessions = Math.floor(totalMinutes / Math.max(1, classDurationMinutes));

  const constraintsBlock = `CONSTRAINTS:
- Subject: ${subject}
${gradeLevel ? `- Grade/Class: ${gradeLevel}` : ""}
${curriculum ? `- Curriculum: ${curriculum}` : ""}
${teachingLevel ? `- Level: ${teachingLevel}` : ""}
- Total time: ${totalWeeks} weeks, ${hoursPerWeek} hours/week (${totalMinutes} minutes total)
- Class duration: ${classDurationMinutes} minutes per session
- Max sessions that fit: ~${maxSessions}
${daysAvailable?.length ? `- Days available: ${daysAvailable.join(", ")}` : ""}
${teachingStyle ? `- Teaching style: ${teachingStyle}` : ""}
${editPrompt ? `\nTEACHER EDIT REQUEST: ${editPrompt}` : ""}

Produce the lesson plan JSON. Ensure total lesson duration fits within ${totalMinutes} minutes.`;

  try {
    // The OpenCode gateway is Chat Completions only, so an uploaded syllabus is
    // extracted to text and inlined instead of being attached as a file part.
    let syllabusText: string;
    let sourceLabel: string;
    if (hasPdf) {
      const filename =
        (pdfFileName && typeof pdfFileName === "string" ? pdfFileName.trim() : null) || "syllabus.pdf";
      syllabusText = await extractDocumentText(pdfBase64 as string, filename);
      if (!syllabusText) {
        return res.status(400).json({
          success: false,
          error: "No text could be extracted from the syllabus file. Try another file or paste the content.",
        });
      }
      sourceLabel = `TEACHING CONTENT (syllabus / topics to cover, from ${filename}):`;
    } else {
      syllabusText = (text ?? "").slice(0, 12000);
      if ((text ?? "").length > 12000) {
        syllabusText += "\n[... content truncated for length ...]";
      }
      sourceLabel = "TEACHING CONTENT (syllabus / topics to cover):";
    }

    const userPromptText = `Current date: ${new Date().toISOString().slice(0, 10)}

${sourceLabel}
---
${syllabusText}
---

${constraintsBlock}`;

    const completion = await chatComplete({
      prompt: userPromptText,
      system: SYSTEM,
      taskType: "lesson_planning",
      temperature: 0.5,
      json: true,
    });

    const raw = completion.content;
    const inputTokens = completion.inputTokens;
    const outputTokens = completion.outputTokens;

    const plan = parseJsonResponse<{
      lessons: Array<{
        lessonNo: number;
        title: string;
        learningObjectives?: string[];
        durationMinutes: number;
        topics?: string[];
        activities?: string;
        teachingNotes?: string;
        isRevision?: boolean;
      }>;
      weeklyDistribution?: Record<string, number[]>;
      confidence?: string;
      summary?: string;
      message?: string;
    }>(raw);

    if (!Array.isArray(plan.lessons)) {
      return res.status(500).json({
        success: false,
        error: "AI did not return a valid lessons array",
      });
    }

    return res.status(200).json({
      success: true,
      plan: {
        lessons: plan.lessons,
        weeklyDistribution: plan.weeklyDistribution ?? {},
        confidence: plan.confidence ?? "full",
        summary: plan.summary ?? "",
        message: plan.message ?? null,
      },
      tokens: inputTokens + outputTokens,
      inputTokens,
      outputTokens,
    });
  } catch (err: unknown) {
    console.error("Lesson plan from syllabus error:", err);
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : "Failed to generate lesson plan",
    });
  }
}
