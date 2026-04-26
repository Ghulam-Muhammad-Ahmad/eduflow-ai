import { useEffect, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceCurrency } from "@/hooks/useWorkspaceCurrency";

interface FinanceData {
  mrr: number;
  revenueThisMonth: number;
  outstanding: number;
  pendingPayouts: number;
  revenueTrend: Array<{ date: string; amount: number }>;
}

interface EngagementData {
  activeStudents: number;
  activeTutors: number;
  sessionsThisMonth: number;
  avgSessionDuration: number;
  sessionTrend: Array<{ date: string; count: number }>;
}

interface AlertData {
  pendingContracts: number;
  failedSessionsLastWeek: number;
  creditUsagePercent: number;
  storageUsagePercent: number;
}

interface DashboardData {
  finance: FinanceData;
  engagement: EngagementData;
  alerts: AlertData;
  lastUpdated: string;
}

export function useOwnerDashboardData() {
  const workspaceCurrency = useWorkspaceCurrency();
  const [lastUpdateTime, setLastUpdateTime] = useState<string>(
    new Date().toISOString()
  );

  const { data: dashboardData, isLoading, error, refetch } = useQuery({
    queryKey: ["owner-dashboard-data", workspaceCurrency],
    queryFn: async (): Promise<DashboardData> => {
      const res = await fetch("/api/owner/dashboard-data", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load dashboard data");
      return res.json();
    },
    refetchInterval: 30000, // Fallback: refetch every 30 seconds
    staleTime: 5000, // Consider data fresh for 5 seconds
  });

  // Subscribe to real-time updates
  useEffect(() => {

    const subscriptions: Array<{
      unsubscribe: () => void;
    }> = [];

    // Subscribe to invoice changes for MRR/revenue updates
    const invoiceSubscription = supabase
      .channel("dashboard-invoices")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "student_invoice_rows",
        },
        () => {
          refetch();
          setLastUpdateTime(new Date().toISOString());
        }
      )
      .subscribe();

    // Subscribe to payout changes
    const payoutSubscription = supabase
      .channel("dashboard-payouts")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tutor_payouts",
        },
        () => {
          refetch();
          setLastUpdateTime(new Date().toISOString());
        }
      )
      .subscribe();

    // Subscribe to session changes
    const sessionSubscription = supabase
      .channel("dashboard-sessions")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "lecture_sessions",
        },
        () => {
          refetch();
          setLastUpdateTime(new Date().toISOString());
        }
      )
      .subscribe();

    // Subscribe to contract changes
    const contractSubscription = supabase
      .channel("dashboard-contracts")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tutor_contracts",
        },
        () => {
          refetch();
          setLastUpdateTime(new Date().toISOString());
        }
      )
      .subscribe();

    return () => {
      invoiceSubscription.unsubscribe();
      payoutSubscription.unsubscribe();
      sessionSubscription.unsubscribe();
      contractSubscription.unsubscribe();
    };
  }, [supabase, refetch]);

  return {
    data: dashboardData || {
      finance: {
        mrr: 0,
        revenueThisMonth: 0,
        outstanding: 0,
        pendingPayouts: 0,
        revenueTrend: [],
      },
      engagement: {
        activeStudents: 0,
        activeTutors: 0,
        sessionsThisMonth: 0,
        avgSessionDuration: 0,
        sessionTrend: [],
      },
      alerts: {
        pendingContracts: 0,
        failedSessionsLastWeek: 0,
        creditUsagePercent: 0,
        storageUsagePercent: 0,
      },
      lastUpdated: lastUpdateTime,
    },
    isLoading,
    error: error as Error | null,
    refetch,
    lastUpdateTime,
  };
}
