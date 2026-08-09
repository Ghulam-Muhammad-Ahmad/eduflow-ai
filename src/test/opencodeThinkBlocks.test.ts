import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Regression coverage for models that emit their chain of thought inline.
 *
 * The live gateway health check showed minimax-m3 — the long-context role, used
 * for any prompt over 60k chars — answering a plain JSON prompt with a
 * `<think>` block followed by the JSON. Left in place that breaks JSON.parse
 * and leaks the model's reasoning into user-facing papers and contracts.
 */

const create = vi.fn();
const modelsList = vi.fn();

vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create } };
    models = { list: modelsList };
  },
}));

async function loadModule() {
  vi.resetModules();
  return import("@/server/ai/opencode");
}

/** Verbatim reply from minimax-m3 during the live model test. */
const MINIMAX_REPLY =
  '<think>\nThe user wants me to reply with exactly {"ok":true} and nothing else. I should output raw JSON.\n</think>\n{"ok":true}';

beforeEach(() => {
  create.mockReset();
  modelsList.mockReset();
  process.env.OPENCODE_API_KEY = "sk-test";
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.OPENCODE_API_KEY;
});

describe("stripThinkBlocks", () => {
  it("removes the block minimax-m3 actually returned", async () => {
    const { stripThinkBlocks } = await loadModule();
    expect(stripThinkBlocks(MINIMAX_REPLY)).toBe('{"ok":true}');
  });

  it("handles the other tag spellings", async () => {
    const { stripThinkBlocks } = await loadModule();
    expect(stripThinkBlocks("<thinking>hmm</thinking>answer")).toBe("answer");
    expect(stripThinkBlocks("<reasoning>hmm</reasoning>answer")).toBe("answer");
    expect(stripThinkBlocks("<Think>hmm</Think>answer")).toBe("answer");
  });

  it("removes several blocks in one reply", async () => {
    const { stripThinkBlocks } = await loadModule();
    expect(stripThinkBlocks("<think>a</think>one<think>b</think>two")).toBe("onetwo");
  });

  it("drops a dangling open tag rather than keeping half a thought", async () => {
    const { stripThinkBlocks } = await loadModule();
    expect(stripThinkBlocks("answer<think>cut off mid-thought")).toBe("answer");
  });

  it("leaves ordinary text untouched", async () => {
    const { stripThinkBlocks } = await loadModule();
    const markdown = "# Paper\n\nQuestion 1. What is 2+2?";
    expect(stripThinkBlocks(markdown)).toBe(markdown);
  });
});

describe("parseJsonResponse", () => {
  it("parses the minimax-m3 reply that used to fail", async () => {
    const { parseJsonResponse } = await loadModule();
    expect(parseJsonResponse<{ ok: boolean }>(MINIMAX_REPLY)).toEqual({ ok: true });
  });

  it("ignores JSON quoted inside the reasoning and takes the real answer", async () => {
    const { parseJsonResponse } = await loadModule();
    const raw = '<think>I could say {"ok":false} but that is wrong.</think>{"ok":true}';
    expect(parseJsonResponse<{ ok: boolean }>(raw)).toEqual({ ok: true });
  });

  it("handles JSON followed by trailing prose", async () => {
    // The old first-brace-to-last-brace slice broke on anything after the JSON.
    const { parseJsonResponse } = await loadModule();
    const raw = '{"grade":80}\n\nLet me know if you would like more detail.';
    expect(parseJsonResponse<{ grade: number }>(raw)).toEqual({ grade: 80 });
  });

  it("handles a brace appearing in prose before the JSON", async () => {
    const { parseJsonResponse } = await loadModule();
    const raw = 'Use { } for blocks. Here is the result: {"grade":80}';
    expect(parseJsonResponse<{ grade: number }>(raw)).toEqual({ grade: 80 });
  });

  it("does not trip over braces or quotes inside string values", async () => {
    const { parseJsonResponse } = await loadModule();
    const raw = 'Result: {"feedback":"Use {braces} and \\"quotes\\" carefully","grade":9}';
    expect(parseJsonResponse<{ feedback: string; grade: number }>(raw)).toEqual({
      feedback: 'Use {braces} and "quotes" carefully',
      grade: 9,
    });
  });

  it("still parses fenced and nested JSON", async () => {
    const { parseJsonResponse } = await loadModule();
    expect(parseJsonResponse('```json\n{"a":{"b":[1,2]}}\n```')).toEqual({ a: { b: [1, 2] } });
  });

  it("still parses arrays", async () => {
    const { parseJsonResponse } = await loadModule();
    expect(parseJsonResponse('Sure!\n[{"q":"one"}]')).toEqual([{ q: "one" }]);
  });

  it("throws when there is no JSON at all", async () => {
    const { parseJsonResponse } = await loadModule();
    expect(() => parseJsonResponse("I cannot help with that.")).toThrow(
      /did not return valid JSON/
    );
  });
});

describe("chatComplete with a thinking model", () => {
  const completion = (content: string) => ({
    model: "minimax-m3",
    choices: [{ message: { content }, finish_reason: "stop" }],
    usage: { prompt_tokens: 10, completion_tokens: 5 },
  });

  it("returns the answer without the reasoning", async () => {
    const { chatComplete } = await loadModule();
    create.mockResolvedValue(completion(MINIMAX_REPLY));

    const result = await chatComplete({ prompt: "hi", role: "longContext" });

    expect(result.content).toBe('{"ok":true}');
  });

  it("keeps prose answers free of leaked reasoning", async () => {
    // Papers, worksheets and contracts render this text directly to users.
    const { chatComplete } = await loadModule();
    create.mockResolvedValue(
      completion("<think>Plan the sections first.</think>\n# Exam Paper\n\nSection A")
    );

    const result = await chatComplete({ prompt: "write a paper" });

    expect(result.content).toBe("# Exam Paper\n\nSection A");
    expect(result.content).not.toContain("<think>");
  });

  it("falls back to the reasoning text when there is nothing else", async () => {
    // Better than reporting an empty response and burning the retry ladder.
    const { chatComplete } = await loadModule();
    create.mockResolvedValue(completion("<think>only thinking, no answer</think>"));

    const result = await chatComplete({ prompt: "hi" });

    expect(result.content).toBe("only thinking, no answer");
  });
});
