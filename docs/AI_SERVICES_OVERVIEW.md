# AI Services Overview: Lesson Planner, Paper Generator, Worksheet Generator

This document lists all AI service functions and API routes used by the **Lesson Planner**, **Paper Generator**, and **Worksheet Generator** features.

---

## 1. Lesson Planner

### 1a. Syllabus Lesson Planner (syllabus → structured lesson plan)

| Layer | What | API / Service |
|-------|------|----------------|
| **UI** | `TeacherSyllabusLessonPlanner.tsx` | Uses `useSyllabusLessonPlanner()` |
| **Hook** | `useSyllabusLessonPlanner.ts` | Calls `generateLessonPlanFromSyllabus()` from aiService |
| **Service** | `aiService.ts` | `generateLessonPlanFromSyllabus(input, userId)` |
| **API** | **POST** `/api/ai/lesson-plan-from-syllabus` | `pages/api/ai/lesson-plan-from-syllabus.ts` |

- **Input:** Syllabus text, subject, grade level, total weeks, hours per week, class duration, etc. (see `SyllabusLessonInput`).
- **Output:** Structured JSON plan (`SyllabusLessonPlanResult`: lessons, weeklyDistribution, confidence, summary).
- **Regenerate:** Same API with `editPrompt` in the input.

### 1b. Simple Lesson Planner (topic + objectives → lesson plan)

| Layer | What | API / Service |
|-------|------|----------------|
| **Hook** | `useLessonPlanner.ts` | Calls `generateLessonPlan()` and `generateAI()` from aiService |
| **Service** | `aiService.ts` | `generateLessonPlan(subject, gradeLevel, topic, duration, learningObjectives, userId, curriculumStandards)` → uses `generateAI()` |
| **API** | **POST** `/api/ai/generate` | `pages/api/ai/generate.ts` |

- **Task type:** `lesson_planning`
- **Regenerate section:** `generateAI({ taskType: 'content_generation', prompt, systemInstruction, userId })` → same `/api/ai/generate`.

---

## 2. Paper Generator

| Layer | What | API / Service |
|-------|------|----------------|
| **UI** | `PaperGenerator.tsx` | Uses `useAIStudio()` → `createPaper(params)` |
| **Hook** | `useAIStudio.ts` | `createPaper(params)` → calls `generatePaper(params, user.id)` from aiService |
| **Service** | `aiService.ts` | `generatePaper(params, userId)` → builds prompt and calls `generateAI()` with `taskType: 'paper_generation'`; supports `sourcePdfBase64` + `sourcePdfFileName` for PDF-as-is |
| **API** | **POST** `/api/ai/generate` | `pages/api/ai/generate.ts` |

- **Task type:** `paper_generation`
- **Params:** `GeneratePaperParams`: subject, gradeLevel, topic, sourceMaterial (text) or sourcePdfBase64/sourcePdfFileName (PDF sent as base64, no text extraction), customInstruction, duration, questionTypes, numQuestions, questionBreakdown, totalMarks.
- **PDF handling:** When `sourcePdfBase64` is set, the API uses Responses API with `input_file` + base64 (no PDF-to-text conversion).

---

## 3. Worksheet Generator

| Layer | What | API / Service |
|-------|------|----------------|
| **UI** | `WorksheetGenerator.tsx` | Uses `useAIStudio()` → `createWorksheet(params)` |
| **Hook** | `useAIStudio.ts` | `createWorksheet()`, `regenerateWorksheet()`, `regenerateWorksheetQuestion()` |
| **Service** | `aiService.ts` | `generateWorksheet(params, userId)`, `generateWorksheetQuestion(params, userId)` → both use `generateAI()` with `taskType: 'worksheet_generation'` |
| **API** | **POST** `/api/ai/generate` | `pages/api/ai/generate.ts` |

- **Task type:** `worksheet_generation`
- **Functions:**
  - **Full worksheet:** `generateWorksheet({ topic, grade, difficulty, instructions, questionCount, questionTypes?, sourceMaterial? }, userId)`.
  - **Single question (regenerate one):** `generateWorksheetQuestion({ topic, grade, difficulty, questionType, currentQuestionText? }, userId)`.
- **Note:** Worksheet generator currently uses **text only** (source from Doc Center is extracted to text via `/api/documents/extract-file`). No PDF-as-is path for worksheets.

---

## Shared: `/api/ai/generate` and `generateAI()`

The following **task types** go through **POST** `/api/ai/generate` (used by lesson planner simple flow, paper generator, worksheet generator, and others):

- `paper_generation` — Paper/exam generation (supports PDF base64).
- `worksheet_generation` — Worksheet JSON generation (and single-question regeneration).
- `lesson_planning` — Simple lesson plan from topic + objectives.
- `content_generation` — Generic (e.g. lesson section regeneration).
- `rubric_generation` — Rubric JSON.
- `checker` — Grade + feedback (e.g. check paper, grade submission).

**Service entry point:** `generateAI(options)` in `src/services/aiService.ts`  
**Options:** `taskType`, `prompt`, `systemInstruction`, `model`, `userId`, `pointsPossible?`, `sourcePdfBase64?`, `sourcePdfFileName?`.

---

## API Routes Summary

| Route | Used by | Purpose |
|-------|---------|--------|
| **POST** `/api/ai/generate` | Paper, Worksheet, simple Lesson Planner, Rubric, Checker, etc. | Single generic AI endpoint with `taskType` + optional PDF base64 for paper. |
| **POST** `/api/ai/lesson-plan-from-syllabus` | Syllabus Lesson Planner | Syllabus text → structured lesson plan JSON. |
| **POST** `/api/ai/check-paper` | Check Paper flow | Grade/feedback for pasted text or PDF (PDF as base64, no text extraction). |
| **POST** `/api/ai/smart-tutor` | Smart Tutor | Adapt content by level; pasted text or PDF (PDF as base64). |

---

## File Reference

| File | Role |
|------|------|
| `src/services/aiService.ts` | All AI service functions; calls `/api/ai/generate` or dedicated routes. |
| `src/hooks/useSyllabusLessonPlanner.ts` | Syllabus lesson planner state + `generateLessonPlanFromSyllabus`. |
| `src/hooks/useLessonPlanner.ts` | Simple lesson planner + `generateLessonPlan`, `generateAI`. |
| `src/hooks/useAIStudio.ts` | Paper, worksheet, rubric, quiz, smart tutor; uses `generatePaper`, `generateWorksheet`, `generateWorksheetQuestion`, etc. |
| `pages/api/ai/generate.ts` | Handles `paper_generation` (with PDF), `worksheet_generation`, `lesson_planning`, and other task types. |
| `pages/api/ai/lesson-plan-from-syllabus.ts` | Syllabus → lesson plan. |
