/**
 * Server-only: check and deduct credits before an AI request.
 * Use in API routes; returns error payload for 402 or null on success.
 */

import { createClient } from "@supabase/supabase-js";
import type { AITaskType } from "@/types/ai";
import { getCreditWeight } from "./ai-credits";

export type DeductCreditsResult =
  | { status: 402; body: { error: string } }
  | null;

/**
 * Deduct credits for the given user and task type. Uses env-based weight.
 * Returns { status: 402, body } if insufficient credits; null on success.
 * Caller should return res.status(result.status).json(result.body) when result is non-null.
 */
export async function deductCreditsForRequest(
  userId: string,
  taskType: AITaskType
): Promise<DeductCreditsResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return { status: 402, body: { error: "Server not configured" } };
  }
  const cost = getCreditWeight(taskType);
  if (cost <= 0) {
    return null;
  }
  const supabase = createClient(url, key);
  const { data, error } = await supabase.rpc("check_and_deduct_credits", {
    _user_id: userId,
    _task_type: taskType,
    _credit_cost: cost,
  });
  if (error) {
    console.error("[deductCreditsForRequest] RPC error:", error);
    return { status: 402, body: { error: "Failed to check credits" } };
  }
  const ok = data?.ok === true;
  if (!ok) {
    return {
      status: 402,
      body: { error: data?.reason ?? "Insufficient credits" },
    };
  }
  return null;
}
