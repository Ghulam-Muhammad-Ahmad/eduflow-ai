import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTutorWorkspace } from "@/hooks/useTutorWorkspace";

export type TutorContractRow = {
  id: string;
  workspace_id: string;
  tutor_id: string;
  contract_status: string;
  pay_type: string;
  rate_amount: number;
  rate_currency: string;
  subjects: string[];
  contract_body_text: string | null;
  contract_storage_path: string | null;
  contract_signed_at: string | null;
  tutor_signature_name: string | null;
  change_requested_at: string | null;
  change_request_note: string | null;
  created_at: string;
  updated_at: string;
};

export function useTutorContract() {
  const { user } = useAuth();
  const { data: workspace } = useTutorWorkspace();

  const workspaceId = workspace?.workspaceId ?? null;

  const query = useQuery({
    queryKey: ["tutor-contract", user?.id, workspaceId],
    queryFn: async (): Promise<TutorContractRow | null> => {
      if (!user?.id || !workspaceId) return null;
      const { data, error } = await supabase
        .from("tutor_contracts")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("tutor_id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = data as Record<string, unknown>;
      return {
        ...row,
        subjects: Array.isArray(row.subjects) ? (row.subjects as string[]) : [],
      } as TutorContractRow;
    },
    enabled: !!user && !!workspaceId,
  });

  return {
    contract: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
