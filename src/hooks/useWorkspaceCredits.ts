import { useQuery } from "@tanstack/react-query";

export interface WorkspaceCreditsSummary {
  creditsAllocated: number;
  creditsAssignedOut: number;
  creditsUsedDirect: number;
  creditsUsedByMembers: number;
  totalUsed: number;
  remaining: number;
  period: string;
}

/** Fetches workspace credit summary for the current user's owned workspace. Use in owner dashboard/billing. Returns 403 when caller is not an owner. */
export function useWorkspaceCredits(enabled = true) {
  const query = useQuery({
    queryKey: ["workspace-credits"],
    queryFn: async (): Promise<WorkspaceCreditsSummary> => {
      const res = await fetch("/api/credits/workspace");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to load workspace credits");
      }
      return res.json();
    },
    enabled,
  });
  return {
    ...query,
    workspaceCredits: query.data,
  };
}
