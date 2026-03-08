import { useQuery } from "@tanstack/react-query";

export interface CurrentStorageContext {
  role: "admin" | "teacher" | "student" | "unknown";
  source: "workspace-owner" | "workspace-allocation" | "user-subscription" | "fallback";
  workspaceId: string | null;
  limitBytes: number;
  usedBytes: number;
  remainingBytes: number;
  hasExplicitAllocation: boolean;
}

export interface WorkspaceStorageSummary {
  totalLimitBytes: number;
  assignedBytes: number;
  usedBytes: number;
  remainingFreeBytes: number;
  unassignedBytes: number;
  allocatedMembersCount: number;
}

export function useCurrentStorageContext(enabled = true) {
  const query = useQuery({
    queryKey: ["current-storage-context"],
    queryFn: async (): Promise<CurrentStorageContext> => {
      const res = await fetch("/api/storage/context", { credentials: "include" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? "Failed to load storage");
      }
      return res.json();
    },
    enabled,
  });

  return {
    ...query,
    storage: query.data,
  };
}

export function useWorkspaceStorageSummary(enabled = true) {
  const query = useQuery({
    queryKey: ["workspace-storage-summary"],
    queryFn: async (): Promise<WorkspaceStorageSummary> => {
      const res = await fetch("/api/storage/workspace", { credentials: "include" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? "Failed to load workspace storage");
      }
      return res.json();
    },
    enabled,
  });

  return {
    ...query,
    workspaceStorage: query.data,
  };
}
