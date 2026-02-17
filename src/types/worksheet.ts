/** Question types supported in worksheet content (AI output / stored in content.worksheet) */
export type WorksheetQuestionType =
  | "short"
  | "long"
  | "mcq"
  | "true_false"
  | "fill_blank";

export interface WorksheetQuestion {
  id: string;
  type: WorksheetQuestionType;
  question: string;
  options?: string[];
  answer?: string;
}

export interface WorksheetContent {
  title: string;
  instructions: string;
  questions: WorksheetQuestion[];
}

/** Layout config: header, footer, margins (design only) */
export interface WorksheetTemplateLayout {
  header: {
    showTitle: boolean;
    showLogo: boolean;
    showDate: boolean;
  };
  footer: {
    showPageNumber: boolean;
    customText?: string;
  };
  margins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

/** Styles: fonts, colors (design only) */
export interface WorksheetTemplateStyles {
  fontFamily: string;
  primaryColor: string;
  headingSize: string;
}

export interface WorksheetTemplate {
  id: string;
  name: string;
  type: "system" | "custom";
  layout: WorksheetTemplateLayout;
  styles: WorksheetTemplateStyles;
}

/** System templates (MVP: no DB). Used for template selection and rendering. */
export const WORKSHEET_SYSTEM_TEMPLATES: WorksheetTemplate[] = [
  {
    id: "classic",
    name: "Classic",
    type: "system",
    layout: {
      header: { showTitle: true, showLogo: false, showDate: true },
      footer: { showPageNumber: true, customText: undefined },
      margins: { top: 20, bottom: 20, left: 20, right: 20 },
    },
    styles: {
      fontFamily: "Georgia, serif",
      primaryColor: "#1e293b",
      headingSize: "1.5rem",
    },
  },
  {
    id: "minimal",
    name: "Minimal",
    type: "system",
    layout: {
      header: { showTitle: true, showLogo: false, showDate: false },
      footer: { showPageNumber: false, customText: undefined },
      margins: { top: 24, bottom: 24, left: 24, right: 24 },
    },
    styles: {
      fontFamily: "system-ui, sans-serif",
      primaryColor: "#0f172a",
      headingSize: "1.25rem",
    },
  },
  {
    id: "modern",
    name: "Modern",
    type: "system",
    layout: {
      header: { showTitle: true, showLogo: false, showDate: true },
      footer: { showPageNumber: true, customText: "Generated with EduFlow" },
      margins: { top: 18, bottom: 18, left: 22, right: 22 },
    },
    styles: {
      fontFamily: "Inter, system-ui, sans-serif",
      primaryColor: "#6366f1",
      headingSize: "1.5rem",
    },
  },
];

const VALID_QUESTION_TYPES: WorksheetQuestionType[] = [
  "short",
  "long",
  "mcq",
  "true_false",
  "fill_blank",
];

export function isValidQuestionType(
  value: string
): value is WorksheetQuestionType {
  return VALID_QUESTION_TYPES.includes(value as WorksheetQuestionType);
}

export function getSystemTemplate(
  id: string | undefined
): WorksheetTemplate | undefined {
  if (!id) return WORKSHEET_SYSTEM_TEMPLATES[0];
  return WORKSHEET_SYSTEM_TEMPLATES.find((t) => t.id === id);
}

export function getDefaultSystemTemplate(): WorksheetTemplate {
  return WORKSHEET_SYSTEM_TEMPLATES[0];
}

/** Normalize AI output: ensure each question has an id; filter invalid types. */
export function normalizeWorksheetContent(
  data: Partial<WorksheetContent>
): WorksheetContent {
  const title =
    typeof data.title === "string" && data.title.trim()
      ? data.title.trim()
      : "Worksheet";
  const instructions =
    typeof data.instructions === "string" ? data.instructions : "";
  const rawQuestions = Array.isArray(data.questions) ? data.questions : [];
  const questions: WorksheetQuestion[] = rawQuestions
    .map((q, i) => {
      const type = q?.type && isValidQuestionType(q.type) ? q.type : "short";
      return {
        id: typeof q?.id === "string" && q.id ? q.id : `q-${i + 1}`,
        type,
        question: typeof q?.question === "string" ? q.question : "",
        options: Array.isArray(q?.options) ? q.options : undefined,
        answer: typeof q?.answer === "string" ? q.answer : undefined,
      };
    })
    .filter((q) => q.question.length > 0);
  return { title, instructions, questions };
}
