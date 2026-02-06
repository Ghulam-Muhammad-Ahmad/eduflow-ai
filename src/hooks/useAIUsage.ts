import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const TOKENS_PER_CREDIT = 1000;

interface AIUsage {
  /** Raw tokens used this period */
  current: number;
  current_usage?: number; // alias for components that use this name
  /** Limit in tokens */
  limit: number;
  /** Remaining tokens */
  remaining: number;
  percentage: number;
  /** Display: 1 credit = 1000 tokens */
  currentCredits: number;
  limitCredits: number;
  remainingCredits: number;
}

// This type disables the type error by accepting any RPC argument.
type SupabaseAnyRpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: any; error: any }>;

export const useAIUsage = () => {
  const { user } = useAuth();
  const [usage, setUsage] = useState<AIUsage | null>(null);
  const [loading, setLoading] = useState(true);

  // fix typing issue by casting supabase.rpc to any RPC
  const fetchAIUsage = useCallback(async () => {
    if (!user?.id) return;

    try {
      // @ts-expect-error // Overriding type, allow dynamic RPC call.
      const { data, error } = await (supabase.rpc as SupabaseAnyRpc)('can_make_ai_request', {
        _user_id: user.id,
      });

      if (error) throw error;

      if (data) {
        const current = data.current_usage || 0;
        const limit = data.limit || 0;
        const remaining = data.remaining || 0;
        const percentage = limit > 0 ? (current / limit) * 100 : 0;

        setUsage({
          current,
          current_usage: current,
          limit,
          remaining,
          percentage,
          currentCredits: Math.round(current / TOKENS_PER_CREDIT),
          limitCredits: Math.round(limit / TOKENS_PER_CREDIT),
          remainingCredits: Math.round(remaining / TOKENS_PER_CREDIT),
        });
      }
    } catch (error) {
      console.error('Error fetching AI usage:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user?.id) {
      fetchAIUsage();
      // Refresh every 30 seconds
      const interval = setInterval(fetchAIUsage, 30000);
      return () => clearInterval(interval);
    }
  }, [user, fetchAIUsage]);

  const isNearLimit = (): boolean => {
    if (!usage) return false;
    return usage.remainingCredits <= 10 || usage.percentage >= 70;
  };

  const getUsagePercentage = (): number => usage?.percentage ?? 0;

  return {
    usage,
    monthlyUsage: usage,
    loading,
    refetch: fetchAIUsage,
    isNearLimit,
    getUsagePercentage,
  };
};
