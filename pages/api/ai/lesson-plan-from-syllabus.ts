import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
import { getAuthUser } from "@/integrations/supabase/server";
import { deductCreditsForRequest } from "@/lib/ai-credits-deduct";

const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API key not configured");
  return new OpenAI({ apiKey });
};

const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

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

  const userPromptText = hasPdf
    ? `Current date: ${new Date().toISOString().slice(0, 10)}

The teaching content (syllabus / topics to cover) is in the attached PDF document. Use it as the basis for the lesson plan.

${constraintsBlock}`
    : `Current date: ${new Date().toISOString().slice(0, 10)}

TEACHING CONTENT (syllabus / topics to cover):
---
${(text ?? "").slice(0, 12000)}
${(text ?? "").length > 12000 ? "\n[... content truncated for length ...]" : ""}
---

${constraintsBlock}`;

  try {
    const openai = getOpenAIClient();
    let raw: string;
    let inputTokens: number;
    let outputTokens: number;

    if (hasPdf) {
      const base64String = (pdfBase64 as string).startsWith("data:")
        ? (pdfBase64 as string).replace(/^data:application\/pdf;base64,/, "")
        : (pdfBase64 as string);
      const fileData = `data:application/pdf;base64,${base64String}`;
      const filename = (pdfFileName && typeof pdfFileName === "string" ? pdfFileName.trim() : null) || "syllabus.pdf";

      const response = await openai.responses.create({
        model: "gpt-4o",
        instructions: SYSTEM,
        input: [
          {
            role: "user",
            content: [
              { type: "input_file", filename, file_data: fileData },
              { type: "input_text", text: userPromptText },
            ],
          },
        ],
        temperature: 0.5,
        truncation: "auto",
      });

      raw =
        (response as { output_text?: string }).output_text ??
        (Array.isArray((response as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> }).output)
          ? (response as { output: Array<{ content?: Array<{ type?: string; text?: string }> }> }).output
              .flatMap((o) => o.content ?? [])
              .find((c) => c.type === "output_text")
              ?.text ?? ""
          : "") ?? "";
      const usage = (response as { usage?: { input_tokens?: number; output_tokens?: number } }).usage;
      inputTokens = usage?.input_tokens ?? 0;
      outputTokens = usage?.output_tokens ?? 0;
    } else {
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userPromptText },
        ],
        temperature: 0.5,
      });

      raw = completion.choices[0]?.message?.content?.trim() ?? "";
      const usage = completion.usage;
      inputTokens = usage?.prompt_tokens ?? estimateTokens(SYSTEM + userPromptText);
      outputTokens = usage?.completion_tokens ?? estimateTokens(raw);
    }

    const cleaned = raw.replace(/^```json?\s*|\s*```$/g, "");
    const plan = JSON.parse(cleaned) as {
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
    };

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
