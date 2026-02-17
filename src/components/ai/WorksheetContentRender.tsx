import type { WorksheetContent, WorksheetQuestion } from "@/types/worksheet";
import { isValidQuestionType } from "@/types/worksheet";

interface WorksheetContentRenderProps {
  data: WorksheetContent;
  /** When true, render as plain display (no form elements). Default true. */
  readOnly?: boolean;
}

function QuestionBlock({ q, index }: { q: WorksheetQuestion; index: number }) {
  const type = isValidQuestionType(q.type) ? q.type : "short";
  const num = index + 1;

  return (
    <div className="mb-6">
      <div className="flex items-start gap-2 mb-1">
        <span className="font-medium shrink-0">{num}.</span>
        <span className="text-xs uppercase tracking-wide text-muted-foreground shrink-0">
          {type.replace("_", " ")}
        </span>
      </div>
      <p className="mb-2">{q.question}</p>
      {type === "mcq" && Array.isArray(q.options) && q.options.length > 0 && (
        <ul className="list-disc list-inside ml-2 space-y-1 text-sm">
          {q.options.map((opt, i) => (
            <li key={i}>{opt}</li>
          ))}
        </ul>
      )}
      {(type === "short" || type === "long" || type === "fill_blank") && (
        <div className="mt-2 h-8 border-b border-border" aria-hidden />
      )}
    </div>
  );
}

export function WorksheetContentRender({
  data,
  readOnly = true,
}: WorksheetContentRenderProps) {
  const title = data.title?.trim() || "Worksheet";
  const instructions = data.instructions?.trim() || "";
  const questions = Array.isArray(data.questions) ? data.questions : [];

  return (
    <div className="worksheet-content space-y-4">
      <h2 className="text-xl font-semibold">{title}</h2>
      {instructions && (
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
          {instructions}
        </p>
      )}
      <div className="mt-6 space-y-2">
        {questions.map((q, idx) => (
          <QuestionBlock key={q.id || idx} q={q} index={idx} />
        ))}
      </div>
    </div>
  );
}
