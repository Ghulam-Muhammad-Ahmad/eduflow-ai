/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';

interface AIUsage {
  current: number;
  current_usage?: number;
  limit: number;
  remaining: number;
  percentage: number;
  currentCredits: number;
  limitCredits: number;
  remainingCredits: number;
}

type CreditContextRow = Database["public"]["Functions"]["get_credit_context"]["Returns"][number];

export const useAIUsage = () => {
  const { user } = useAuth();
  const [usage, setUsage] = useState<AIUsage | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAIUsage = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase.rpc('get_credit_context', {
        _user_id: user.id,
      });

      if (error) throw error;

      // get_credit_context returns TABLE → array of rows; use first row
      const row: CreditContextRow | null = Array.isArray(data) ? (data[0] ?? null) : null;
      const limit = row ? Number(row.credits_limit) || 0 : 0;
      const used = row ? Number(row.credits_used) || 0 : 0;
      const rawRemaining = row?.remaining;
      const remaining =
        typeof rawRemaining === 'number' && Number.isFinite(rawRemaining)
          ? rawRemaining
          : Math.max(0, limit - used);
      const percentage = limit > 0 ? (used / limit) * 100 : 0;

      setUsage({
        current: used,
        current_usage: used,
        limit,
        remaining,
        percentage,
        currentCredits: used,
        limitCredits: limit,
        remainingCredits: remaining,
      });
    } catch (error) {
      console.error('Error fetching AI usage:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user?.id) {
      fetchAIUsage();
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
