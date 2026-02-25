import type { WorksheetContent, WorksheetQuestion } from "@/types/worksheet";
import { isValidQuestionType } from "@/types/worksheet";

interface WorksheetContentRenderProps {
  data: WorksheetContent;
  /** When true, render as plain display (no form elements). Default true. */
  readOnly?: boolean;
  /** Optional template id to adjust layout (tables, boxes, etc.) */
  templateId?: string;
}

function QuestionBlock({ q, index }: { q: WorksheetQuestion; index: number }) {
  const type = isValidQuestionType(q.type) ? q.type : "short";
  const num = index + 1;

  return (
    <div className="mb-6">
      <div className="flex items-baseline gap-2 mb-1">
        <span className="font-medium line-height-1 shrink-0">{num}.</span>
        <span className="text-xs line-height-1 uppercase tracking-wide text-muted-foreground shrink-0">
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
  templateId,
}: WorksheetContentRenderProps) {
  const title = data.title?.trim() || "Worksheet";
  const instructions = data.instructions?.trim() || "";
  const questions = Array.isArray(data.questions) ? data.questions : [];

  if (templateId === "life_skills_grid") {
    return (
      <div className="worksheet-content space-y-4">
        {instructions && (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {instructions}
          </p>
        )}
        <div className="mt-2">
          <table className="w-full text-sm border border-border border-collapse">
            <thead className="bg-muted">
              <tr>
                <th className="border border-border px-2 py-1 text-left w-32">
                  Outcome code
                </th>
                <th className="border border-border px-2 py-1 text-left">
                  Syllabus outcome
                </th>
                <th className="border border-border px-2 py-1 text-center w-24">
                  Achieved
                </th>
                <th className="border border-border px-2 py-1 text-center w-32">
                  Achieved with support
                </th>
                <th className="border border-border px-2 py-1 text-center w-28">
                  Not yet
                </th>
              </tr>
            </thead>
            <tbody>
              {questions.map((q, idx) => (
                <tr key={q.id || idx}>
                  <td className="border border-border px-2 py-1 align-top">
                    {q.id || `FTLS-${idx + 1}`}
                  </td>
                  <td className="border border-border px-2 py-1 align-top">
                    {q.question}
                  </td>
                  <td className="border border-border px-2 py-1" />
                  <td className="border border-border px-2 py-1" />
                  <td className="border border-border px-2 py-1" />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (templateId === "transcript_grid") {
    return (
      <div className="worksheet-content space-y-4">
        {instructions && (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {instructions}
          </p>
        )}
        <div className="mt-2">
          <table className="w-full text-xs border border-border border-collapse">
            <thead className="bg-muted">
              <tr>
                <th className="border border-border px-2 py-1 text-left w-56">
                  Content topic
                </th>
                <th className="border border-border px-2 py-1 text-left w-32">
                  College / University
                </th>
                <th className="border border-border px-2 py-1 text-left w-24">
                  Course #
                </th>
                <th className="border border-border px-2 py-1 text-left w-16">
                  Credits
                </th>
                <th className="border border-border px-2 py-1 text-left">
                  Course title
                </th>
              </tr>
            </thead>
            <tbody>
              {questions.map((q, idx) => (
                <tr key={q.id || idx}>
                  <td className="border border-border px-2 py-1 align-top">
                    {q.question}
                  </td>
                  <td className="border border-border px-2 py-1" />
                  <td className="border border-border px-2 py-1" />
                  <td className="border border-border px-2 py-1" />
                  <td className="border border-border px-2 py-1" />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (templateId === "english_color_blocks") {
    return (
      <div className="worksheet-content space-y-4">
        {instructions && (
          <p className="text-sm text-muted-foreground text-center whitespace-pre-wrap">
            {instructions}
          </p>
        )}
        <div className="mt-6 space-y-4">
          {questions.map((q, idx) => (
            <div
              key={q.id || idx}
              className="rounded-lg border bg-muted/40 px-4 py-3 shadow-sm"
            >
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                <span className="font-semibold">Question {idx + 1}</span>
                <span className="uppercase tracking-wide">
                  {isValidQuestionType(q.type) ? q.type.replace("_", " ") : "short"}
                </span>
              </div>
              <p className="text-sm mb-2">{q.question}</p>
              <div className="mt-1">
                <QuestionBlock q={q} index={idx} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="worksheet-content space-y-4">
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
