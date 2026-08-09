import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/** Coverage for the owner-facing "test every model" health check. */

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

const reply = (content: string) => ({
  model: "echo",
  choices: [{ message: { content }, finish_reason: "stop" }],
  usage: { prompt_tokens: 5, completion_tokens: 3 },
});

beforeEach(() => {
  create.mockReset();
  modelsList.mockReset();
  process.env.OPENCODE_API_KEY = "sk-test";
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.OPENCODE_API_KEY;
  delete process.env.OPENCODE_MODEL_GENERAL;
  delete process.env.OPENCODE_MODEL_FAST;
  delete process.env.OPENCODE_MODEL_REASONING;
});

describe("testConfiguredModels", () => {
  it("probes each distinct configured model exactly once", async () => {
    const { testConfiguredModels, OPENCODE_MODELS } = await loadModule();
    modelsList.mockResolvedValue({ data: [] });
    create.mockResolvedValue(reply('{"ok":true}'));

    const report = await testConfiguredModels();

    const distinct = new Set(Object.values(OPENCODE_MODELS));
    expect(report.results).toHaveLength(distinct.size);
    expect(create).toHaveBeenCalledTimes(distinct.size);
    expect(report.ok).toBe(true);
  });

  it("collapses roles that share one model into a single probe", async () => {
    // Point two roles at the same id: it should be tested once and listed once,
    // carrying both roles.
    process.env.OPENCODE_MODEL_GENERAL = "shared-model";
    process.env.OPENCODE_MODEL_FAST = "shared-model";
    const { testConfiguredModels } = await loadModule();
    modelsList.mockResolvedValue({ data: [] });
    create.mockResolvedValue(reply("ok"));

    const report = await testConfiguredModels();

    const shared = report.results.filter((r) => r.model === "shared-model");
    expect(shared).toHaveLength(1);
    expect(shared[0].roles.sort()).toEqual(["fast", "general"]);
  });

  it("reports a failing model without failing the whole run", async () => {
    // Roles share one model by default, so split one off to get a mixed report.
    process.env.OPENCODE_MODEL_REASONING = "broken-model";
    const { testConfiguredModels } = await loadModule();
    modelsList.mockResolvedValue({ data: [] });
    create.mockImplementation((body: { model: string }) =>
      body.model === "broken-model"
        ? Promise.reject(Object.assign(new Error("model not found"), { status: 404 }))
        : Promise.resolve(reply("ok"))
    );

    const report = await testConfiguredModels();

    expect(report.ok).toBe(false);
    const failed = report.results.find((r) => r.model === "broken-model");
    expect(failed?.ok).toBe(false);
    expect(failed?.error).toMatch(/model not found/);
    // Every other model still reported a result.
    expect(report.results.filter((r) => r.ok).length).toBeGreaterThan(0);
  });

  it("flags configured models missing from the plan catalog", async () => {
    process.env.OPENCODE_MODEL_REASONING = "not-in-catalog";
    const { testConfiguredModels, OPENCODE_MODELS } = await loadModule();
    modelsList.mockResolvedValue({ data: [{ id: OPENCODE_MODELS.general }] });
    create.mockResolvedValue(reply("ok"));

    const report = await testConfiguredModels();

    expect(report.results.find((r) => r.model === OPENCODE_MODELS.general)?.inCatalog).toBe(true);
    expect(report.results.find((r) => r.model === "not-in-catalog")?.inCatalog).toBe(false);
  });

  it("still tests models when the catalog cannot be listed", async () => {
    const { testConfiguredModels } = await loadModule();
    modelsList.mockRejectedValue(new Error("catalog unavailable"));
    create.mockResolvedValue(reply("ok"));

    const report = await testConfiguredModels();

    expect(report.catalogError).toMatch(/catalog unavailable/);
    expect(report.availableModels).toBeNull();
    expect(report.ok).toBe(true);
    // inCatalog is unknown rather than falsely negative.
    expect(report.results.every((r) => r.inCatalog === null)).toBe(true);
  });

  it("records which parameters the gateway rejected on a passing model", async () => {
    const { testConfiguredModels } = await loadModule();
    modelsList.mockResolvedValue({ data: [] });
    create.mockImplementation((body: { response_format?: unknown }) =>
      body.response_format
        ? Promise.reject(
            Object.assign(new Error("response_format is not supported"), { status: 400 })
          )
        : Promise.resolve(reply("ok"))
    );

    const report = await testConfiguredModels();

    expect(report.ok).toBe(true);
    expect(report.results.every((r) => r.droppedParams?.includes("response_format"))).toBe(true);
  });
});
