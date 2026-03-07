import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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

  const query = useQuery({
    queryKey: ["tutor-contract", user?.id],
    queryFn: async (): Promise<TutorContractRow | null> => {
      if (!user?.id) return null;
      // Query by tutor_id only so the contract shows regardless of which workspace
      // useTutorWorkspace returned (e.g. limit(1) without order can pick the wrong workspace).
      const { data, error } = await supabase
        .from("tutor_contracts")
        .select("*")
        .eq("tutor_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = data as Record<string, unknown>;
      return {
        ...row,
        subjects: Array.isArray(row.subjects) ? (row.subjects as string[]) : [],
      } as TutorContractRow;
    },
    enabled: !!user,
  });

  return {
    contract: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
