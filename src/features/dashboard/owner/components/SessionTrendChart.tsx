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

interface SessionTrendChartProps {
  data: Array<{
    date: string;
    count: number;
  }>;
  loading?: boolean;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-md text-sm">
      <p className="font-medium text-foreground mb-1">{label}</p>
      <p className="text-primary font-semibold">
        {Number(payload[0].value)} sessions
      </p>
    </div>
  );
}

export function SessionTrendChart({
  data = [],
  loading = false,
}: SessionTrendChartProps) {
  const chartConfig: ChartConfig = {
    count: {
      label: "Sessions",
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

  const avgCount = useMemo(() => {
    if (data.length === 0) return 0;
    return Math.round(data.reduce((sum, d) => sum + d.count, 0) / data.length);
  }, [data]);

  const maxCount = useMemo(() => {
    if (data.length === 0) return 10;
    return Math.ceil(Math.max(...data.map((d) => d.count)) * 1.2);
  }, [data]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Session Activity</CardTitle>
          <CardDescription>Last 30 days</CardDescription>
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
          <CardTitle className="text-lg">Session Activity</CardTitle>
          <CardDescription>Last 30 days</CardDescription>
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
        <CardTitle className="text-lg">Session Activity</CardTitle>
        <CardDescription>Last 30 days — drag brush to zoom</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: -10, bottom: 24 }}>
              <defs>
                <linearGradient id="sessionGradient" x1="0" y1="0" x2="0" y2="1">
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
                domain={[0, maxCount]}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={40}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine
                y={avgCount}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="4 4"
                label={{ value: "avg", position: "right", fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#sessionGradient)"
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
