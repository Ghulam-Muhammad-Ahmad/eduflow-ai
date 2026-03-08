import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useTutorWorkspace } from "@/hooks/useTutorWorkspace";
import { useCurrentStorageContext } from "@/hooks/useStorage";

export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "inactive";

export interface SubscriptionRow {
  id: string;
  status: SubscriptionStatus;
  price_id: string | null;
  current_period_ends_at: string | null;
  trial_ends_at: string | null;
  paddle_subscription_id: string | null;
  /** Max Doc Center storage in MB; from Paddle product custom_data.doc_storage (GB). */
  doc_storage_limit_mb: number | null;
}

function isActive(status: SubscriptionStatus): boolean {
  return status === "active" || status === "trialing";
}

function daysLeft(endsAt: string | null): number | null {
  if (!endsAt) return null;
  const end = new Date(endsAt).getTime();
  const now = Date.now();
  const days = Math.ceil((end - now) / (24 * 60 * 60 * 1000));
  return days > 0 ? days : 0;
}

/** Workspace subscription (Owner). Use workspaceId from useOwnerWorkspace or useTutorWorkspace. */
export function useWorkspaceSubscription(workspaceId: string | null) {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["workspace-subscription", workspaceId],
    queryFn: async (): Promise<SubscriptionRow | null> => {
      if (!workspaceId) return null;
      const { data: row, error: e } = await supabase
        .from("workspace_subscriptions")
        .select("id, status, price_id, current_period_ends_at, trial_ends_at, paddle_subscription_id, doc_storage_limit_mb")
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (e) throw e;
      return row as SubscriptionRow | null;
    },
    enabled: !!workspaceId,
  });

  const status = (data?.status ?? "inactive") as SubscriptionStatus;
  const hasAccess = isActive(status);
  const trialEndsAt = data?.trial_ends_at ?? null;
  const periodEndsAt = data?.current_period_ends_at ?? null;
  const trialDaysLeft = daysLeft(trialEndsAt);
  const periodDaysLeft = daysLeft(periodEndsAt);

  return {
    subscription: data,
    isLoading,
    error,
    status,
    hasAccess,
    isTrialing: status === "trialing",
    trialDaysLeft,
    periodDaysLeft,
    invalidate: () => queryClient.invalidateQueries({ queryKey: ["workspace-subscription", workspaceId] }),
  };
}

/** User subscription (Student). */
export function useUserSubscription() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["user-subscription", user?.id],
    queryFn: async (): Promise<SubscriptionRow | null> => {
      if (!user?.id) return null;
      const { data: row, error: e } = await supabase
        .from("user_subscriptions")
        .select("id, status, price_id, current_period_ends_at, trial_ends_at, paddle_subscription_id, doc_storage_limit_mb")
        .eq("user_id", user.id)
        .maybeSingle();
      if (e) throw e;
      return row as SubscriptionRow | null;
    },
    enabled: !!user?.id,
  });

  const status = (data?.status ?? "inactive") as SubscriptionStatus;
  const hasAccess = isActive(status);
  const trialEndsAt = data?.trial_ends_at ?? null;
  const periodEndsAt = data?.current_period_ends_at ?? null;
  const trialDaysLeft = daysLeft(trialEndsAt);
  const periodDaysLeft = daysLeft(periodEndsAt);

  return {
    subscription: data,
    isLoading,
    error,
    status,
    hasAccess,
    isTrialing: status === "trialing",
    trialDaysLeft,
    periodDaysLeft,
    invalidate: () => queryClient.invalidateQueries({ queryKey: ["user-subscription", user?.id] }),
  };
}

/**
 * For students: whether they have access via a workspace (tenant model).
 * Students created by owner/tutor are assigned to a workspace; if that workspace
 * has an active subscription, the student gets access without their own plan.
 * Uses an API route so RLS does not need to expose assignment/subscription to students.
 */
export function useStudentWorkspaceAccess() {
  const { user } = useAuth();
  const { data: hasAccess = false, isLoading } = useQuery({
    queryKey: ["student-workspace-access", user?.id],
    queryFn: async (): Promise<boolean> => {
      if (!user?.id) return false;
      const res = await fetch("/api/tenant/student-workspace-access", { credentials: "include" });
      if (!res.ok) return false;
      const data = (await res.json()) as { hasAccess?: boolean };
      return !!data.hasAccess;
    },
    enabled: !!user?.id,
  });
  return { hasAccess, isLoading };
}

/** Resolve workspace for current user (owner or tutor) for billing context. */
export function useBillingWorkspaceId(): string | null {
  const { role } = useAuth();
  const { workspace: ownerWorkspace } = useOwnerWorkspace();
  const { workspaceId: tutorWorkspaceId } = useTutorWorkspace();
  if (role === "admin" && ownerWorkspace?.id) return ownerWorkspace.id;
  if (role === "teacher" && tutorWorkspaceId) return tutorWorkspaceId;
  return null;
}

/** Whether the current user has an active subscription (by role: workspace for owner/teacher, user or tenant-workspace for student). */
export function useHasActiveSubscription(): { hasAccess: boolean; isLoading: boolean } {
  const { user, role } = useAuth();
  const { workspace: ownerWorkspace, isLoading: ownerWorkspaceLoading } = useOwnerWorkspace();
  const { workspaceId: tutorWorkspaceId, isLoading: tutorWorkspaceLoading } = useTutorWorkspace();
  const workspaceId =
    role === "admin" && ownerWorkspace?.id
      ? ownerWorkspace.id
      : role === "teacher" && tutorWorkspaceId
        ? tutorWorkspaceId
        : null;
  const { hasAccess: workspaceAccess, isLoading: workspaceSubLoading } = useWorkspaceSubscription(workspaceId);
  const { hasAccess: userAccess, isLoading: userLoading } = useUserSubscription();
  const { hasAccess: studentWorkspaceAccess, isLoading: studentWorkspaceLoading } = useStudentWorkspaceAccess();

  if (!user) return { hasAccess: false, isLoading: false };
  if (role === "student") {
    const hasAccess = userAccess || studentWorkspaceAccess;
    const isLoading = userLoading || studentWorkspaceLoading;
    return { hasAccess, isLoading };
  }
  if (role === "admin") {
    const workspaceStillLoading = ownerWorkspaceLoading;
    const subStillLoading = !!workspaceId && workspaceSubLoading;
    const isLoading = workspaceStillLoading || subStillLoading;
    // Grant access if they have workspace subscription OR user subscription (webhook may write to both or either).
    const hasAccess = workspaceAccess || userAccess;
    return { hasAccess, isLoading };
  }
  if (role === "teacher") {
    const workspaceStillLoading = tutorWorkspaceLoading;
    const subStillLoading = !!workspaceId && workspaceSubLoading;
    const isLoading = workspaceStillLoading || subStillLoading;
    const hasAccess = workspaceAccess || userAccess;
    return { hasAccess, isLoading };
  }
  return { hasAccess: false, isLoading: false };
}

/**
 * Effective Doc Center storage for the current user.
 * For workspace plans this now respects owner-managed member allocations.
 */
export function useDocStorageLimit(): {
  limitBytes: number;
  usedBytes: number;
  remainingBytes: number;
  isLoading: boolean;
  refetch: () => Promise<unknown>;
} {
  const query = useCurrentStorageContext();
  const storage = query.storage;

  return {
    limitBytes: storage?.limitBytes ?? 0,
    usedBytes: storage?.usedBytes ?? 0,
    remainingBytes: storage?.remainingBytes ?? 0,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

