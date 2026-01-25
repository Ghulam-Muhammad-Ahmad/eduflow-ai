import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface AIUsage {
  current_usage: number;
  limit: number;
  remaining: number;
  can_request: boolean;
  reason?: string;
}

export interface MonthlyUsage {
  month: string;
  interactions_count: number;
  tokens_used: number;
  cost: number;
  limit_reached: boolean;
  usage_limit: number;
}

export const useAIUsage = () => {
  const { user } = useAuth();
  const [usage, setUsage] = useState<AIUsage | null>(null);
  const [monthlyUsage, setMonthlyUsage] = useState<MonthlyUsage | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadUsage();
    }
  }, [user]);

  const loadUsage = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      
      // Get current usage status
      const { data: usageData, error: usageError } = await supabase.rpc(
        'can_make_ai_request',
        { _user_id: user.id }
      );

      if (usageError) throw usageError;
      setUsage(usageData as AIUsage);

      // Get monthly usage details
      const currentMonth = new Date();
      currentMonth.setDate(1);
      
      const { data: monthlyData, error: monthlyError } = await supabase
        .from('user_ai_usage')
        .select('*')
        .eq('user_id', user.id)
        .eq('month', currentMonth.toISOString().split('T')[0])
        .maybeSingle();

      if (monthlyError) throw monthlyError;
      if (monthlyData) {
        setMonthlyUsage({
          month: monthlyData.month,
          interactions_count: monthlyData.interactions_count,
          tokens_used: monthlyData.tokens_used,
          cost: monthlyData.cost,
          limit_reached: monthlyData.limit_reached,
          usage_limit: monthlyData.usage_limit || 0,
        });
      }
    } catch (error) {
      console.error('Error loading AI usage:', error);
    } finally {
      setLoading(false);
    }
  };

  const getUsagePercentage = (): number => {
    if (!usage || !usage.limit) return 0;
    return Math.min((usage.current_usage / usage.limit) * 100, 100);
  };

  const isNearLimit = (): boolean => {
    if (!usage || !usage.limit) return false;
    return getUsagePercentage() >= 80;
  };

  return {
    usage,
    monthlyUsage,
    loading,
    refresh: loadUsage,
    getUsagePercentage,
    isNearLimit,
  };
};
