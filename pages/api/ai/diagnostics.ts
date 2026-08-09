/**
 * Owner-only health check for the OpenCode Go gateway.
 *
 * When a generation route fails there is usually no way to tell a bad key from
 * a model id the plan does not expose without reading server logs. This lists
 * the models the configured key can actually reach, shows which model each role
 * resolves to, and optionally sends a tiny probe prompt.
 *
 * GET /api/ai/diagnostics          — key + model catalog + role mapping
 * GET /api/ai/diagnostics?probe=1  — also sends a one-token-ish JSON probe
 *
 * No credits are deducted; the probe is deliberately tiny.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getWorkspaceIdForOwner } from "@/server/storage-allocation";
import {
  OPENCODE_MODELS,
  chatComplete,
  hasOpenCodeKey,
  listAvailableModels,
  MISSING_KEY_MESSAGE,
} from "@/server/ai/opencode";

type ProbeResult =
  | { ok: true; model: string; content: string }
  | { ok: false; error: string };

type DiagnosticsResponse = {
  keyConfigured: boolean;
  baseUrl: string;
  /** Model chosen for each routing role, from OPENCODE_MODEL_* or the defaults. */
  configuredModels: Record<string, string>;
  /** Model ids the key can reach; null when the catalog could not be listed. */
  availableModels: string[] | null;
  modelsError?: string;
  /** Configured models that the gateway did not list — the usual cause of empty replies. */
  unknownModels?: string[];
  probe?: ProbeResult;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DiagnosticsResponse | { error: string }>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { user, error: authError } = await getAuthUser(req, res);
  if (authError || !user) {
    return res.status(401).json({ error: authError?.message ?? "Unauthorized" });
  }
  if (!supabaseAdmin) {
    return res.status(503).json({ error: "Server configuration error" });
  }

  // Owners only: the response describes server configuration.
  const workspaceId = await getWorkspaceIdForOwner(supabaseAdmin, user.id);
  if (!workspaceId) {
    return res.status(403).json({ error: "Only workspace owners can run AI diagnostics" });
  }

  const baseUrl = process.env.OPENCODE_BASE_URL?.trim() || "https://opencode.ai/zen/go/v1";
  const keyConfigured = hasOpenCodeKey();

  const body: DiagnosticsResponse = {
    keyConfigured,
    baseUrl,
    configuredModels: { ...OPENCODE_MODELS },
    availableModels: null,
  };

  if (!keyConfigured) {
    return res.status(200).json({ ...body, modelsError: MISSING_KEY_MESSAGE });
  }

  try {
    const models = await listAvailableModels();
    body.availableModels = models;
    const unknown = Object.values(OPENCODE_MODELS).filter((m) => !models.includes(m));
    if (unknown.length > 0) body.unknownModels = [...new Set(unknown)];
  } catch (error: unknown) {
    body.modelsError = error instanceof Error ? error.message : "Could not list models";
  }

  if (req.query.probe) {
    try {
      const result = await chatComplete({
        prompt: 'Reply with exactly this JSON and nothing else: {"ok":true}',
        system: "You return only raw JSON.",
        role: "fast",
        temperature: 0,
        json: true,
      });
      body.probe = { ok: true, model: result.model, content: result.content.slice(0, 500) };
    } catch (error: unknown) {
      body.probe = {
        ok: false,
        error: error instanceof Error ? error.message : "Probe failed",
      };
    }
  }

  return res.status(200).json(body);
}
