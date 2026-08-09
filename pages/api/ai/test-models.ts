/**
 * Owner-only: send a real generation call to every model the app is configured
 * to use and report which ones answer.
 *
 * Costs one credit for the whole run, not one per model — the probes are tiny
 * and this exists so an owner can confirm the AI integration works at all.
 *
 * POST /api/ai/test-models
 *
 * `GET /api/ai/diagnostics` is the read-only, free version: it reports the key
 * status and model catalog without calling any model.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthUser } from "@/integrations/supabase/server";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import { getWorkspaceIdForOwner } from "@/server/storage-allocation";
import { deductCreditsForRequest, ensureOwnerWorkspaceCreditPool } from "@/lib/ai-credits-deduct";
import {
  hasOpenCodeKey,
  MISSING_KEY_MESSAGE,
  testConfiguredModels,
  type ModelTestReport,
} from "@/server/ai/opencode";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ModelTestReport | { error: string }>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { user, error: authError } = await getAuthUser(req, res);
  if (authError || !user) {
    return res.status(401).json({ error: authError?.message ?? "Unauthorized" });
  }
  if (!supabaseAdmin) {
    return res.status(503).json({ error: "Server configuration error" });
  }

  // Owners only: this reports server configuration and spends workspace credit.
  const workspaceId = await getWorkspaceIdForOwner(supabaseAdmin, user.id);
  if (!workspaceId) {
    return res.status(403).json({ error: "Only workspace owners can test AI models" });
  }

  // Check the key before spending anything — a missing key is not worth a credit.
  if (!hasOpenCodeKey()) {
    return res.status(400).json({ error: MISSING_KEY_MESSAGE });
  }

  await ensureOwnerWorkspaceCreditPool(user.id);
  const creditError = await deductCreditsForRequest(user.id, "model_test");
  if (creditError) {
    return res.status(creditError.status).json(creditError.body);
  }

  try {
    const report = await testConfiguredModels();
    return res.status(200).json(report);
  } catch (error: unknown) {
    console.error("AI model test error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to test models",
    });
  }
}
