/**
 * Server-only: OpenCode Go (Zen) provider.
 *
 * Every AI feature in the app goes through this module. OpenCode Go is a flat
 * subscription that exposes an OpenAI-compatible `/chat/completions` endpoint at
 * `https://opencode.ai/zen/go/v1`, authenticated with a single `sk-` key, and
 * fronts frontier open models (MiniMax, Kimi, GLM, DeepSeek, Qwen, MiMo).
 *
 * Because the endpoint is OpenAI-compatible we keep using the `openai` SDK, but
 * only the Chat Completions surface — the OpenAI-specific Responses API, Files
 * API and `input_file` document parts are not part of the compatible subset, so
 * documents are turned into text before being sent (see `extractDocumentText`).
 */

import OpenAI from "openai";
import type { AITaskType } from "@/types/ai";

/** Value stored in `ai_interactions.provider` for anything generated here. */
export const AI_PROVIDER = "opencode" as const;
export type AIProviderName = typeof AI_PROVIDER;

const DEFAULT_BASE_URL = "https://opencode.ai/zen/go/v1";

/**
 * Best-in-class models available on the OpenCode Go plan, grouped by what they
 * are good at. The catalog moves as new versions ship, so every id can be
 * overridden per-role with an env var without touching code.
 */
export const OPENCODE_MODELS = {
  /** Kimi K2.6 — strongest all-round instruction following and long-form writing. */
  general: process.env.OPENCODE_MODEL_GENERAL || "kimi-k2.6",
  /** DeepSeek V4 Pro — deep reasoning; used for grading and evaluation. */
  reasoning: process.env.OPENCODE_MODEL_REASONING || "deepseek-v4-pro",
  /** GLM 5.1 — very reliable structured/JSON output. */
  structured: process.env.OPENCODE_MODEL_STRUCTURED || "glm-5.1",
  /** MiniMax M3 — 512K context; used when a whole document is in the prompt. */
  longContext: process.env.OPENCODE_MODEL_LONG_CONTEXT || "minimax-m3",
  /** DeepSeek V4 Flash — fast and cheap for short, low-stakes calls. */
  fast: process.env.OPENCODE_MODEL_FAST || "deepseek-v4-flash",
} as const;

export type ModelRole = keyof typeof OPENCODE_MODELS;

/**
 * Which model handles which task. Grading and evaluation go to the reasoning
 * model, anything that must return JSON goes to the structured model, and prose
 * generation goes to the general model.
 */
const TASK_MODEL_ROLE: Record<AITaskType, ModelRole> = {
  content_generation: "general",
  checker: "reasoning",
  lesson_planning: "general",
  study_materials: "general",
  rubric_generation: "structured",
  paper_generation: "general",
  worksheet_generation: "structured",
  quiz_questions: "structured",
  differentiation: "general",
  concept_explanation: "general",
  practice_questions: "structured",
  flashcards: "structured",
  study_plan: "fast",
  contract_generation: "general",
  contract_revision: "general",
  teacher_test_generation: "structured",
  teacher_evaluation: "reasoning",
  tutor_matching: "reasoning",
  // Health check probes each configured model explicitly, so its default is
  // only a fallback.
  model_test: "fast",
};

/**
 * Model ids that used to be hardcoded (or persisted) while the app ran on
 * OpenAI. Callers may still send them, so they are mapped onto the closest
 * OpenCode model instead of being forwarded and rejected.
 */
const LEGACY_MODEL_ALIASES: Record<string, ModelRole> = {
  "gpt-4": "general",
  "gpt-4-turbo": "general",
  "gpt-4o": "general",
  "gpt-4o-mini": "fast",
  "gpt-3.5-turbo": "fast",
};

/** Threshold (in characters) above which a prompt is routed to the long-context model. */
const LONG_CONTEXT_CHAR_THRESHOLD = 60_000;

export interface ResolveModelOptions {
  /** Model explicitly requested by the caller. Legacy OpenAI ids are remapped. */
  requested?: string | null;
  /** Task being performed; picks the default model when nothing is requested. */
  taskType?: AITaskType;
  /** Role override, used by routes that have no `AITaskType`. */
  role?: ModelRole;
  /** Total prompt size; large prompts are routed to the long-context model. */
  promptChars?: number;
}

/** Pick the OpenCode model for a call. */
export function resolveModel({
  requested,
  taskType,
  role,
  promptChars,
}: ResolveModelOptions = {}): string {
  const trimmed = requested?.trim();
  if (trimmed) {
    const alias = LEGACY_MODEL_ALIASES[trimmed.toLowerCase()];
    if (!alias) return trimmed; // an explicit OpenCode model id — use as-is
    // Fall through to default routing so the task/size heuristics still apply,
    // but keep the alias as the floor.
    const aliasModel = OPENCODE_MODELS[alias];
    if (promptChars != null && promptChars > LONG_CONTEXT_CHAR_THRESHOLD) {
      return OPENCODE_MODELS.longContext;
    }
    return aliasModel;
  }

  if (promptChars != null && promptChars > LONG_CONTEXT_CHAR_THRESHOLD) {
    return OPENCODE_MODELS.longContext;
  }
  if (role) return OPENCODE_MODELS[role];
  if (taskType) return OPENCODE_MODELS[TASK_MODEL_ROLE[taskType]];
  return OPENCODE_MODELS.general;
}

/** Human-readable message shown when the subscription key is missing. */
export const MISSING_KEY_MESSAGE =
  "OpenCode API key not configured. Set OPENCODE_API_KEY to your OpenCode Go subscription key.";

export function hasOpenCodeKey(): boolean {
  return Boolean(process.env.OPENCODE_API_KEY?.trim());
}

let cachedClient: OpenAI | null = null;

/** OpenAI-SDK client pointed at the OpenCode Go gateway. */
export function getOpenCodeClient(): OpenAI {
  const apiKey = process.env.OPENCODE_API_KEY?.trim();
  if (!apiKey) throw new Error(MISSING_KEY_MESSAGE);
  const baseURL = process.env.OPENCODE_BASE_URL?.trim() || DEFAULT_BASE_URL;
  if (!cachedClient) {
    cachedClient = new OpenAI({ apiKey, baseURL });
  }
  return cachedClient;
}

export interface ChatCompleteOptions {
  prompt: string;
  system?: string;
  taskType?: AITaskType;
  role?: ModelRole;
  model?: string | null;
  temperature?: number;
  /** Ask the gateway for a JSON object response. Falls back silently if unsupported. */
  json?: boolean;
  /** Abort a single attempt after this long. Used by the health check. */
  timeoutMs?: number;
}

export interface ChatCompleteResult {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  /**
   * Optional parameters the gateway would not accept for this model, dropped to
   * get an answer. Empty on a clean first-attempt success. Surfaced so the
   * health check can report "works, but JSON mode is unsupported".
   */
  droppedParams: string[];
}

const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

/**
 * Pull the assistant text out of a completion.
 *
 * The gateway fronts several model families, and they do not all put the answer
 * in `message.content`:
 *  - reasoning models (DeepSeek-style) can leave `content` empty and put the
 *    text in `reasoning_content` / `reasoning`;
 *  - some OpenAI-compatible servers return `content` as an array of parts.
 * Anything we can read as text is better than reporting an empty response.
 */
function extractMessageText(completion: OpenAI.Chat.ChatCompletion): {
  text: string;
  finishReason: string | null;
  refusal: string | null;
} {
  const choice = completion.choices?.[0];
  const message = choice?.message as
    | (OpenAI.Chat.ChatCompletionMessage & {
        reasoning_content?: unknown;
        reasoning?: unknown;
      })
    | undefined;

  const asText = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) {
      return value
        .map((part) =>
          typeof part === "string"
            ? part
            : typeof (part as { text?: unknown })?.text === "string"
              ? (part as { text: string }).text
              : ""
        )
        .join("");
    }
    return "";
  };

  const text =
    asText(message?.content) ||
    asText(message?.reasoning_content) ||
    asText(message?.reasoning) ||
    "";

  return {
    text,
    finishReason: choice?.finish_reason ?? null,
    refusal: typeof message?.refusal === "string" ? message.refusal : null,
  };
}

/** Describe an empty completion well enough to act on it without server logs. */
function describeEmptyCompletion(
  completion: OpenAI.Chat.ChatCompletion,
  requestedModel: string,
  finishReason: string | null,
  refusal: string | null
): string {
  const parts = [
    `model=${completion.model || requestedModel}`,
    `finish_reason=${finishReason ?? "none"}`,
    `choices=${completion.choices?.length ?? 0}`,
  ];
  if (refusal) parts.push(`refusal=${refusal}`);
  if (completion.usage) {
    parts.push(`completion_tokens=${completion.usage.completion_tokens ?? 0}`);
  }
  return parts.join(", ");
}

/**
 * Single entry point for text generation. Returns the raw assistant message
 * plus token usage (estimated when the gateway omits it).
 *
 * The gateway is an aggregator, and not every model behind it accepts every
 * OpenAI parameter — some reject `response_format`/`temperature` outright,
 * others accept them and then return nothing. So the request is retried down a
 * ladder that drops the optional parameters, and an empty result is treated as
 * a failure to retry rather than a successful empty answer. Callers used to
 * receive `""` here and report it as invalid JSON, which hid the real cause.
 */
export async function chatComplete({
  prompt,
  system,
  taskType,
  role,
  model,
  temperature = 0.7,
  json = false,
  timeoutMs,
}: ChatCompleteOptions): Promise<ChatCompleteResult> {
  const client = getOpenCodeClient();
  const selectedModel = resolveModel({
    requested: model,
    taskType,
    role,
    promptChars: prompt.length + (system?.length ?? 0),
  });

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  if (system?.trim()) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });

  const buildRequest = (opts: {
    withJson: boolean;
    withTemperature: boolean;
  }): OpenAI.Chat.ChatCompletionCreateParamsNonStreaming => {
    const request: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
      model: selectedModel,
      messages,
    };
    if (opts.withTemperature) request.temperature = temperature;
    if (opts.withJson) request.response_format = { type: "json_object" };
    return request;
  };

  // Progressively drop the optional parameters. Each variant is tried once.
  const variants: Array<{ withJson: boolean; withTemperature: boolean }> = [
    { withJson: json, withTemperature: true },
  ];
  if (json) variants.push({ withJson: false, withTemperature: true });
  variants.push({ withJson: false, withTemperature: false });

  let lastDiagnostic = "";
  let lastError: unknown = null;

  for (let i = 0; i < variants.length; i += 1) {
    const isLast = i === variants.length - 1;
    try {
      const completion = await client.chat.completions.create(
        buildRequest(variants[i]),
        timeoutMs ? { timeout: timeoutMs } : undefined
      );
      const { text, finishReason, refusal } = extractMessageText(completion);

      if (text.trim()) {
        const usage = completion.usage;
        const dropped: string[] = [];
        if (json && !variants[i].withJson) dropped.push("response_format");
        if (!variants[i].withTemperature) dropped.push("temperature");
        return {
          content: text,
          model: completion.model || selectedModel,
          inputTokens: usage?.prompt_tokens ?? estimateTokens((system ?? "") + prompt),
          outputTokens: usage?.completion_tokens ?? estimateTokens(text),
          droppedParams: dropped,
        };
      }

      lastDiagnostic = describeEmptyCompletion(
        completion,
        selectedModel,
        finishReason,
        refusal
      );
      if (refusal) {
        // A refusal is a real answer, not a transport problem — retrying with
        // fewer parameters will not change it.
        throw new Error(`The AI model declined to answer: ${refusal}`);
      }
      console.error(
        `[opencode] empty completion (attempt ${i + 1}/${variants.length}): ${lastDiagnostic}`
      );
    } catch (error: unknown) {
      lastError = error;
      const retryable = isUnsupportedParamError(error);
      console.error(
        `[opencode] chat completion failed (attempt ${i + 1}/${variants.length}, model=${selectedModel}):`,
        error instanceof Error ? error.message : error
      );
      if (isLast || !retryable) throw error;
    }
  }

  // Every variant came back empty.
  const hint =
    `The AI gateway accepted the request but returned no content (${lastDiagnostic}). ` +
    `Check that "${selectedModel}" is a model your OpenCode Go plan exposes — ` +
    `GET ${process.env.OPENCODE_BASE_URL?.trim() || DEFAULT_BASE_URL}/models lists them. ` +
    `Override it with the matching OPENCODE_MODEL_* env var if not.`;
  throw lastError instanceof Error ? new Error(`${hint} Last error: ${lastError.message}`) : new Error(hint);
}

/**
 * True when the gateway rejected the request because of an optional parameter
 * we can simply drop (JSON mode, temperature), rather than something retrying
 * cannot fix — a bad key, a missing model, or a rate limit.
 */
function isUnsupportedParamError(error: unknown): boolean {
  const status = (error as { status?: number })?.status;
  if (status !== 400 && status !== 422) return false;
  const message = String((error as { message?: string })?.message ?? "").toLowerCase();
  return (
    message.includes("response_format") ||
    message.includes("json_object") ||
    message.includes("json mode") ||
    message.includes("temperature") ||
    message.includes("unsupported") ||
    message.includes("not supported") ||
    message.includes("unknown parameter") ||
    message.includes("unrecognized")
  );
}

/**
 * Models the configured key can actually reach. Used by the diagnostics route
 * so a bad model id can be identified without reading server logs.
 */
export async function listAvailableModels(): Promise<string[]> {
  const client = getOpenCodeClient();
  const response = await client.models.list();
  return response.data.map((m) => m.id).sort();
}

/** Outcome of probing one model with a real generation call. */
export interface ModelTestResult {
  model: string;
  /** Routing roles this model serves — which features break if it fails. */
  roles: ModelRole[];
  ok: boolean;
  latencyMs: number;
  /** Trimmed reply, when the call succeeded. */
  reply?: string;
  /** Parameters the gateway would not accept (e.g. `response_format`). */
  droppedParams?: string[];
  error?: string;
  /** Whether the id appears in the gateway's catalog; null if it couldn't be listed. */
  inCatalog: boolean | null;
}

export interface ModelTestReport {
  ok: boolean;
  baseUrl: string;
  testedAt: string;
  results: ModelTestResult[];
  /** Ids the gateway lists; null when the catalog call failed. */
  availableModels: string[] | null;
  catalogError?: string;
}

/** Per-probe timeout. A wedged model must not hang the whole report. */
const PROBE_TIMEOUT_MS = 30_000;

/**
 * Send a real generation call to every distinct model the app is configured to
 * use, and report which ones answer.
 *
 * Probes run against the same `chatComplete` path the app uses, so a model that
 * passes here is genuinely callable — including the parameter fallbacks. Models
 * are deduplicated: several roles often point at one id, and each is only worth
 * one call.
 */
export async function testConfiguredModels(): Promise<ModelTestReport> {
  const baseUrl = process.env.OPENCODE_BASE_URL?.trim() || DEFAULT_BASE_URL;

  let availableModels: string[] | null = null;
  let catalogError: string | undefined;
  try {
    availableModels = await listAvailableModels();
  } catch (error: unknown) {
    catalogError = error instanceof Error ? error.message : "Could not list models";
  }

  // Group roles by model id so one call covers every role sharing it.
  const rolesByModel = new Map<string, ModelRole[]>();
  (Object.keys(OPENCODE_MODELS) as ModelRole[]).forEach((role) => {
    const id = OPENCODE_MODELS[role];
    rolesByModel.set(id, [...(rolesByModel.get(id) ?? []), role]);
  });

  const results = await Promise.all(
    [...rolesByModel.entries()].map(async ([model, roles]): Promise<ModelTestResult> => {
      const startedAt = Date.now();
      const inCatalog = availableModels ? availableModels.includes(model) : null;
      try {
        const result = await chatComplete({
          prompt: 'Reply with exactly this JSON and nothing else: {"ok":true}',
          system: "You return only raw JSON.",
          model,
          temperature: 0,
          json: true,
          timeoutMs: PROBE_TIMEOUT_MS,
        });
        return {
          model,
          roles,
          ok: true,
          latencyMs: Date.now() - startedAt,
          reply: result.content.trim().slice(0, 200),
          droppedParams: result.droppedParams,
          inCatalog,
        };
      } catch (error: unknown) {
        return {
          model,
          roles,
          ok: false,
          latencyMs: Date.now() - startedAt,
          error: error instanceof Error ? error.message : "Request failed",
          inCatalog,
        };
      }
    })
  );

  results.sort((a, b) => a.model.localeCompare(b.model));

  return {
    ok: results.every((r) => r.ok),
    baseUrl,
    testedAt: new Date().toISOString(),
    results,
    availableModels,
    catalogError,
  };
}

/** Strip a leading/trailing markdown code fence before JSON.parse. */
export function stripJsonFence(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

/**
 * Parse a model response as JSON, tolerating stray prose around the object by
 * falling back to the outermost `{...}` / `[...]` span.
 */
export function parseJsonResponse<T>(raw: string): T {
  const cleaned = stripJsonFence(raw);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.search(/[[{]/);
    const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    }
    throw new Error("Model did not return valid JSON");
  }
}

/** Max characters of extracted document text inlined into a prompt. */
export const DOCUMENT_TEXT_MAX_CHARS = 180_000;

/**
 * Turn an uploaded document into plain text.
 *
 * The OpenCode gateway speaks Chat Completions only — there is no document part
 * type — so PDFs are parsed with `pdf-parse` and DOCX with `mammoth` before the
 * text is inlined into the prompt.
 */
export async function extractDocumentText(
  base64: string,
  fileName?: string
): Promise<string> {
  const cleanedBase64 = base64.includes(",") && base64.startsWith("data:")
    ? base64.slice(base64.indexOf(",") + 1)
    : base64;
  const buffer = Buffer.from(cleanedBase64, "base64");
  const lower = (fileName ?? "").toLowerCase();

  if (lower.endsWith(".txt") || lower.endsWith(".text") || lower.endsWith(".md")) {
    return truncateDocument(buffer.toString("utf-8"));
  }

  if (lower.endsWith(".docx") || lower.endsWith(".doc")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return truncateDocument(result?.value ?? "");
  }

  // Default to PDF: it is the dominant upload type and the only one the old
  // OpenAI path accepted without a file name.
  const pdfParse = (await import("pdf-parse")).default;
  const parsed = await pdfParse(buffer);
  return truncateDocument(parsed?.text ?? "");
}

function truncateDocument(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= DOCUMENT_TEXT_MAX_CHARS) return trimmed;
  return (
    trimmed.slice(0, DOCUMENT_TEXT_MAX_CHARS) +
    "\n\n[Document truncated due to length. Base your answer on the content above.]"
  );
}
