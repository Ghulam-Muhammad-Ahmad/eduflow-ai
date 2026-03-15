import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";

const FALLBACK_CURRENCY = "GBP";

/**
 * Returns the workspace default currency for the current user.
 * Owner: from useOwnerWorkspace (no extra request). Teacher/Student: from GET /api/workspace/currency.
 */
export function useWorkspaceCurrency(): string {
  const { user, role } = useAuth();
  const { workspace } = useOwnerWorkspace();

  const { data } = useQuery({
    queryKey: ["workspace-currency", user?.id],
    queryFn: async (): Promise<{ currency: string }> => {
      const res = await fetch("/api/workspace/currency", { credentials: "include" });
      if (!res.ok) return { currency: FALLBACK_CURRENCY };
      const body = await res.json().catch(() => ({}));
      const c = typeof (body as { currency?: string }).currency === "string"
        ? (body as { currency: string }).currency.trim()
        : FALLBACK_CURRENCY;
      return { currency: c || FALLBACK_CURRENCY };
    },
    enabled: !!user && role !== "admin",
  });

  if (role === "admin" && workspace?.settings?.default_currency) {
    const c = workspace.settings.default_currency.trim();
    return c || FALLBACK_CURRENCY;
  }
  return data?.currency ?? FALLBACK_CURRENCY;
}
