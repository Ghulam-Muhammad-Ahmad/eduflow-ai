import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/integrations/supabase/admin";
import type { Database } from "@/integrations/supabase/types";
import { getCreditsForPlan } from "@/lib/ai-credits";

type WorkspaceSubscriptionInsert = Database["public"]["Tables"]["workspace_subscriptions"]["Insert"];
type UserSubscriptionInsert = Database["public"]["Tables"]["user_subscriptions"]["Insert"];

interface SelectPlanRequest {
  userId?: string;
  workspaceId?: string;
  planTier: "basic" | "pro" | "plus";
  billingCycle: "monthly" | "annual";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const admin = supabaseAdmin;
  if (!admin) {
    return res.status(500).json({ error: "Server not configured" });
  }

  try {
    const { userId, workspaceId, planTier, billingCycle } = req.body as SelectPlanRequest;

    if (!planTier || !billingCycle) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!["basic", "pro", "plus"].includes(planTier)) {
      return res.status(400).json({ error: "Invalid plan tier" });
    }

    if (!["monthly", "annual"].includes(billingCycle)) {
      return res.status(400).json({ error: "Invalid billing cycle" });
    }

    if (!userId && !workspaceId) {
      return res.status(400).json({ error: "Either userId or workspaceId required" });
    }

    // Calculate current period start (first day of month)
    const periodStart = new Date();
    periodStart.setUTCDate(1);
    periodStart.setUTCHours(0, 0, 0, 0);
    const periodStr = periodStart.toISOString().slice(0, 10);

    // Get credits for this plan
    const creditsAllocated = getCreditsForPlan("business", planTier);

    // Create/update workspace subscription if workspaceId provided
    if (workspaceId) {
      const workspaceSubscriptionRow: WorkspaceSubscriptionInsert = {
        workspace_id: workspaceId,
        paddle_subscription_id: null,
        paddle_customer_id: null,
        price_id: null,
        status: "active",
        current_period_ends_at: null,
        trial_ends_at: null,
        updated_at: new Date().toISOString(),
      };

      const { error: upsertError } = await admin
        .from("workspace_subscriptions")
        .upsert(workspaceSubscriptionRow, {
          onConflict: "workspace_id",
        });

      if (upsertError) {
        console.error("[plans/select] workspace_subscriptions upsert error:", upsertError);
        return res.status(500).json({ error: "Failed to create workspace subscription" });
      }

      // Allocate credits to workspace credit pool
      if (creditsAllocated > 0) {
        const { error: poolError } = await admin.rpc("upsert_workspace_credit_pool", {
          _workspace_id: workspaceId,
          _period: periodStr,
          _credits_allocated: creditsAllocated,
        });

        if (poolError) {
          console.error("[plans/select] upsert_workspace_credit_pool error:", poolError);
          return res.status(500).json({ error: "Failed to allocate credits" });
        }
      }
    }

    // Create/update user subscription if userId provided (and not a workspace subscription)
    if (userId && !workspaceId) {
      const userSubscriptionRow: UserSubscriptionInsert = {
        user_id: userId,
        paddle_subscription_id: null,
        paddle_customer_id: null,
        price_id: null,
        status: "active",
        current_period_ends_at: null,
        trial_ends_at: null,
        updated_at: new Date().toISOString(),
      };

      const { error: upsertError } = await admin
        .from("user_subscriptions")
        .upsert(userSubscriptionRow, {
          onConflict: "user_id",
        });

      if (upsertError) {
        console.error("[plans/select] user_subscriptions upsert error:", upsertError);
        return res.status(500).json({ error: "Failed to create user subscription" });
      }

      // Allocate credits to user (only if not in a workspace)
      if (creditsAllocated > 0) {
        const { error: allocError } = await admin.rpc("upsert_user_credit_allocation_subscription", {
          _user_id: userId,
          _period: periodStr,
          _credits_limit: creditsAllocated,
        });

        if (allocError) {
          console.error("[plans/select] upsert_user_credit_allocation_subscription error:", allocError);
          return res.status(500).json({ error: "Failed to allocate credits" });
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: "Plan selected successfully",
      plan: planTier,
      billingCycle,
    });
  } catch (err) {
    console.error("[plans/select] Unexpected error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
