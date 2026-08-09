import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Regression coverage for the gateway returning 200 with no usable content.
 *
 * That used to surface to the user as {"error":"AI returned invalid JSON","raw":""}
 * because chatComplete handed back an empty string as if it were a success.
 */

const create = vi.fn();
const modelsList = vi.fn();

vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create } };
    models = { list: modelsList };
  },
}));

/** Fresh module instance each time — the client is cached in module scope. */
async function loadModule() {
  vi.resetModules();
  return import("@/server/ai/opencode");
}

const completion = (
  message: Record<string, unknown>,
  extra: Record<string, unknown> = {}
) => ({
  model: "test-model",
  choices: [{ message, finish_reason: "stop" }],
  usage: { prompt_tokens: 10, completion_tokens: 5 },
  ...extra,
});

const paramError = (message: string) => Object.assign(new Error(message), { status: 400 });

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

describe("chatComplete", () => {
  it("returns content from a normal reply", async () => {
    const { chatComplete } = await loadModule();
    create.mockResolvedValue(completion({ content: '{"ok":true}' }));

    const result = await chatComplete({ prompt: "hi", taskType: "checker" });

    expect(result.content).toBe('{"ok":true}');
    expect(result.inputTokens).toBe(10);
    expect(result.outputTokens).toBe(5);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("throws instead of returning an empty string when every attempt is blank", async () => {
    const { chatComplete } = await loadModule();
    create.mockResolvedValue(completion({ content: "" }));

    // The old behaviour resolved with content "" and the caller reported
    // "AI returned invalid JSON" with an empty raw value.
    await expect(
      chatComplete({ prompt: "hi", taskType: "teacher_evaluation", json: true })
    ).rejects.toThrow(/returned no content/i);
  });

  it("names the model and points at /models when the reply is empty", async () => {
    const { chatComplete, OPENCODE_MODELS } = await loadModule();
    create.mockResolvedValue(completion({ content: "" }));

    await expect(
      chatComplete({ prompt: "hi", role: "reasoning", json: true })
    ).rejects.toThrow(
      new RegExp(`${OPENCODE_MODELS.reasoning}[\\s\\S]*\\/models`, "i")
    );
  });

  it("retries without response_format when the gateway rejects JSON mode", async () => {
    const { chatComplete } = await loadModule();
    create
      .mockRejectedValueOnce(paramError("response_format is not supported for this model"))
      .mockResolvedValueOnce(completion({ content: '{"ok":true}' }));

    const result = await chatComplete({ prompt: "hi", json: true });

    expect(result.content).toBe('{"ok":true}');
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0][0]).toHaveProperty("response_format");
    expect(create.mock.calls[1][0]).not.toHaveProperty("response_format");
  });

  it("retries without temperature when the model rejects it", async () => {
    const { chatComplete } = await loadModule();
    create
      .mockRejectedValueOnce(paramError("temperature is not supported"))
      .mockRejectedValueOnce(paramError("temperature is not supported"))
      .mockResolvedValueOnce(completion({ content: "done" }));

    const result = await chatComplete({ prompt: "hi", json: true });

    expect(result.content).toBe("done");
    expect(create.mock.calls[2][0]).not.toHaveProperty("temperature");
  });

  it("retries as plain text when JSON mode yields an empty reply", async () => {
    const { chatComplete } = await loadModule();
    create
      .mockResolvedValueOnce(completion({ content: "" }))
      .mockResolvedValueOnce(completion({ content: '{"ok":true}' }));

    const result = await chatComplete({ prompt: "hi", json: true });

    expect(result.content).toBe('{"ok":true}');
    expect(create.mock.calls[0][0]).toHaveProperty("response_format");
    expect(create.mock.calls[1][0]).not.toHaveProperty("response_format");
  });

  it("falls back to reasoning_content when content is empty", async () => {
    const { chatComplete } = await loadModule();
    create.mockResolvedValue(
      completion({ content: "", reasoning_content: '{"ok":true}' })
    );

    const result = await chatComplete({ prompt: "hi" });

    expect(result.content).toBe('{"ok":true}');
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("joins array-shaped content parts", async () => {
    const { chatComplete } = await loadModule();
    create.mockResolvedValue(
      completion({ content: [{ text: '{"ok"' }, { text: ":true}" }] })
    );

    const result = await chatComplete({ prompt: "hi" });

    expect(result.content).toBe('{"ok":true}');
  });

  it("surfaces a refusal without burning the remaining retries", async () => {
    const { chatComplete } = await loadModule();
    create.mockResolvedValue(completion({ content: "", refusal: "I can't help with that" }));

    await expect(chatComplete({ prompt: "hi", json: true })).rejects.toThrow(
      /declined to answer: I can't help with that/
    );
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("does not retry an auth failure", async () => {
    const { chatComplete } = await loadModule();
    create.mockRejectedValue(Object.assign(new Error("Invalid API key"), { status: 401 }));

    await expect(chatComplete({ prompt: "hi", json: true })).rejects.toThrow(/Invalid API key/);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("does not retry an unknown-model 404", async () => {
    const { chatComplete } = await loadModule();
    create.mockRejectedValue(
      Object.assign(new Error("model not found"), { status: 404 })
    );

    await expect(chatComplete({ prompt: "hi", json: true })).rejects.toThrow(/model not found/);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("fails fast with a clear message when the key is missing", async () => {
    delete process.env.OPENCODE_API_KEY;
    const { chatComplete } = await loadModule();

    await expect(chatComplete({ prompt: "hi" })).rejects.toThrow(/OPENCODE_API_KEY/);
    expect(create).not.toHaveBeenCalled();
  });
});

describe("listAvailableModels", () => {
  it("returns sorted model ids", async () => {
    const { listAvailableModels } = await loadModule();
    modelsList.mockResolvedValue({
      data: [{ id: "kimi-k2.6" }, { id: "glm-5.1" }, { id: "minimax-m3" }],
    });

    await expect(listAvailableModels()).resolves.toEqual([
      "glm-5.1",
      "kimi-k2.6",
      "minimax-m3",
    ]);
  });
});
