"use client";

import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartContainer, ChartConfig } from "@/components/ui/chart";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Brush,
  ReferenceLine,
} from "recharts";
import { Loader2 } from "lucide-react";

interface RevenueTrendChartProps {
  data: Array<{
    date: string;
    amount: number;
  }>;
  loading?: boolean;
  currency?: string;
}

function CustomTooltip({ active, payload, label, currency }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-md text-sm">
      <p className="font-medium text-foreground mb-1">{label}</p>
      <p className="text-primary font-semibold">
        {currency} {Number(payload[0].value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
    </div>
  );
}

export function RevenueTrendChart({
  data = [],
  loading = false,
  currency = "USD",
}: RevenueTrendChartProps) {
  const chartConfig: ChartConfig = {
    amount: {
      label: "Revenue",
      color: "hsl(var(--primary))",
    },
  };

  const formattedData = useMemo(() => {
    return data.map((item) => ({
      ...item,
      date: new Date(item.date).toLocaleDateString("en-GB", {
        month: "short",
        day: "numeric",
      }),
    }));
  }, [data]);

  const avgAmount = useMemo(() => {
    if (data.length === 0) return 0;
    return data.reduce((sum, d) => sum + d.amount, 0) / data.length;
  }, [data]);

  const minAmount = useMemo(() => {
    if (data.length === 0) return 0;
    return Math.max(0, Math.floor(Math.min(...data.map((d) => d.amount)) * 0.8));
  }, [data]);

  const maxAmount = useMemo(() => {
    if (data.length === 0) return 100;
    return Math.ceil(Math.max(...data.map((d) => d.amount)) * 1.2);
  }, [data]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Revenue Trend</CardTitle>
          <CardDescription>Last 90 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Revenue Trend</CardTitle>
          <CardDescription>Last 90 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Revenue Trend</CardTitle>
        <CardDescription>Last 90 days — drag brush to zoom</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: -10, bottom: 24 }}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[minAmount, maxAmount]}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${currency}${v}`}
                width={60}
              />
              <Tooltip content={<CustomTooltip currency={currency} />} />
              <ReferenceLine
                y={avgAmount}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="4 4"
                label={{ value: "avg", position: "right", fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#revenueGradient)"
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--primary))", fill: "hsl(var(--background))" }}
                isAnimationActive={true}
              />
              <Brush
                dataKey="date"
                height={20}
                stroke="hsl(var(--border))"
                fill="hsl(var(--muted))"
                travellerWidth={6}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
