import { describe, it, expect } from "vitest";
import {
  OPENCODE_MODELS,
  parseJsonResponse,
  resolveModel,
  stripJsonFence,
} from "@/server/ai/opencode";

describe("resolveModel", () => {
  it("routes each task to its default model role", () => {
    // Grading and evaluation need reasoning.
    expect(resolveModel({ taskType: "checker" })).toBe(OPENCODE_MODELS.reasoning);
    expect(resolveModel({ taskType: "teacher_evaluation" })).toBe(OPENCODE_MODELS.reasoning);
    expect(resolveModel({ taskType: "tutor_matching" })).toBe(OPENCODE_MODELS.reasoning);
    // JSON-shaped output goes to the structured model.
    expect(resolveModel({ taskType: "rubric_generation" })).toBe(OPENCODE_MODELS.structured);
    expect(resolveModel({ taskType: "worksheet_generation" })).toBe(OPENCODE_MODELS.structured);
    expect(resolveModel({ taskType: "quiz_questions" })).toBe(OPENCODE_MODELS.structured);
    // Prose generation goes to the general model.
    expect(resolveModel({ taskType: "content_generation" })).toBe(OPENCODE_MODELS.general);
    expect(resolveModel({ taskType: "lesson_planning" })).toBe(OPENCODE_MODELS.general);
  });

  it("falls back to the general model with no task or role", () => {
    expect(resolveModel()).toBe(OPENCODE_MODELS.general);
  });

  it("honours an explicit role override", () => {
    expect(resolveModel({ role: "fast" })).toBe(OPENCODE_MODELS.fast);
  });

  it("maps legacy OpenAI model ids onto OpenCode models", () => {
    expect(resolveModel({ requested: "gpt-4" })).toBe(OPENCODE_MODELS.general);
    expect(resolveModel({ requested: "gpt-4o" })).toBe(OPENCODE_MODELS.general);
    expect(resolveModel({ requested: "GPT-4o-mini" })).toBe(OPENCODE_MODELS.fast);
    expect(resolveModel({ requested: "gpt-3.5-turbo" })).toBe(OPENCODE_MODELS.fast);
  });

  it("passes an explicit OpenCode model id through untouched", () => {
    expect(resolveModel({ requested: "qwen3.8-max", taskType: "checker" })).toBe("qwen3.8-max");
    expect(resolveModel({ requested: "glm-5.1" })).toBe("glm-5.1");
  });

  it("switches to the long-context model for very large prompts", () => {
    const huge = 200_000;
    expect(resolveModel({ taskType: "paper_generation", promptChars: huge })).toBe(
      OPENCODE_MODELS.longContext
    );
    // Legacy aliases are upgraded too, since they carry no real context budget.
    expect(resolveModel({ requested: "gpt-4o-mini", promptChars: huge })).toBe(
      OPENCODE_MODELS.longContext
    );
  });

  it("keeps the task default for ordinary prompt sizes", () => {
    expect(resolveModel({ taskType: "paper_generation", promptChars: 5_000 })).toBe(
      OPENCODE_MODELS.general
    );
  });
});

describe("stripJsonFence", () => {
  it("removes a ```json fence", () => {
    expect(stripJsonFence('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("removes a bare ``` fence", () => {
    expect(stripJsonFence('```\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("leaves unfenced JSON alone", () => {
    expect(stripJsonFence('  {"a":1}  ')).toBe('{"a":1}');
  });
});

describe("parseJsonResponse", () => {
  it("parses a plain JSON object", () => {
    expect(parseJsonResponse<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
  });

  it("parses a fenced JSON object", () => {
    expect(parseJsonResponse<{ a: number }>('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("recovers an object wrapped in stray prose", () => {
    const raw = 'Here is the rubric you asked for:\n{"criteria":[]}\nHope that helps!';
    expect(parseJsonResponse<{ criteria: unknown[] }>(raw)).toEqual({ criteria: [] });
  });

  it("recovers a JSON array wrapped in stray prose", () => {
    const raw = 'Sure!\n[{"question_text":"q"}]\n';
    expect(parseJsonResponse<Array<{ question_text: string }>>(raw)).toEqual([
      { question_text: "q" },
    ]);
  });

  it("throws when there is no JSON at all", () => {
    expect(() => parseJsonResponse("I cannot help with that.")).toThrow(
      /did not return valid JSON/
    );
  });
});
