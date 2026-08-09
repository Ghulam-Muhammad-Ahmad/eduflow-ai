import { describe, it, expect } from "vitest";
import { isDocumentResponseQuiz, DEFAULT_RESPONSE_POINTS } from "@/lib/quiz";

const withDocs = (n: number) => ({
  quiz_attachments: Array.from({ length: n }, (_, i) => ({
    document_id: `doc-${i}`,
    documents: {
      id: `doc-${i}`,
      name: `paper-${i}.pdf`,
      file_path: `path/${i}`,
      file_type: "application/pdf",
      file_size: 1024,
    },
  })),
});

describe("isDocumentResponseQuiz", () => {
  it("is true when a document is attached and there are no questions", () => {
    expect(isDocumentResponseQuiz(withDocs(1), 0)).toBe(true);
    expect(isDocumentResponseQuiz(withDocs(3), 0)).toBe(true);
  });

  it("is false once the quiz has questions, even with documents attached", () => {
    // Documents are then just reference material alongside the questions.
    expect(isDocumentResponseQuiz(withDocs(1), 1)).toBe(false);
    expect(isDocumentResponseQuiz(withDocs(2), 10)).toBe(false);
  });

  it("is false for a quiz with neither questions nor documents", () => {
    // This is the misconfigured case the take screen now reports instead of
    // spinning on "Loading quiz...".
    expect(isDocumentResponseQuiz({ quiz_attachments: [] }, 0)).toBe(false);
    expect(isDocumentResponseQuiz({ quiz_attachments: undefined }, 0)).toBe(false);
  });

  it("is false for a question-only quiz", () => {
    expect(isDocumentResponseQuiz({ quiz_attachments: [] }, 5)).toBe(false);
  });

  it("handles a null/undefined quiz while it is still loading", () => {
    expect(isDocumentResponseQuiz(null, 0)).toBe(false);
    expect(isDocumentResponseQuiz(undefined, 0)).toBe(false);
  });
});

describe("DEFAULT_RESPONSE_POINTS", () => {
  it("is a positive default so a grade never divides by zero", () => {
    expect(DEFAULT_RESPONSE_POINTS).toBeGreaterThan(0);
  });
});
