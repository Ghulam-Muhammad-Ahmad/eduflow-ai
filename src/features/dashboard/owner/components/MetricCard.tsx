"use client";

import React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string;
  icon?: React.ReactNode;
  subtext?: string;
  trend?: number;
  href?: string;
  loading?: boolean;
  className?: string;
  accentColor?: "primary" | "accent" | "destructive" | "muted";
  layout?: "default" | "horizontal";
}

const iconBg: Record<NonNullable<MetricCardProps["accentColor"]>, string> = {
  primary:     "bg-primary/10 text-primary",
  accent:      "bg-accent/20 text-accent-foreground",
  destructive: "bg-destructive/10 text-destructive",
  muted:       "bg-muted text-muted-foreground",
};

export function MetricCard({
  label,
  value,
  icon,
  subtext,
  trend,
  href,
  loading = false,
  className,
  accentColor = "primary",
  layout = "default",
}: MetricCardProps) {
  const trendPositive = trend !== undefined && trend >= 0;

  /* ── Horizontal (slim) layout ── */
  if (layout === "horizontal") {
    const inner = (
      <div className={cn("flex items-center gap-4 px-4 py-3.5", href && "group")}>
        {icon && (
          <div className={cn(
            "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-transform",
            iconBg[accentColor],
            href && "group-hover:scale-110"
          )}>
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="h-5 w-24 bg-muted rounded animate-pulse mb-1" />
          ) : (
            <p className="text-xl font-bold tracking-tight leading-none">{value}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1 truncate">{label}</p>
        </div>
        {subtext && (
          <span className="text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-full shrink-0 whitespace-nowrap">
            {subtext}
          </span>
        )}
      </div>
    );

    if (href) {
      return (
        <Link href={href}>
          <Card hoverable className={cn("shadow-[var(--shadow-subtle)] hover:shadow-[var(--shadow-large)] transition-all", className)}>
            {inner}
          </Card>
        </Link>
      );
    }
    return (
      <Card className={cn("shadow-[var(--shadow-subtle)]", className)}>
        {inner}
      </Card>
    );
  }

  /* ── Default (tall) layout ── */
  const inner = (
    <div className={cn("h-full", href && "group")}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3 pt-5 px-5">
        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider leading-none">
          {label}
        </CardTitle>
        {icon && (
          <div className={cn(
            "h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-transform",
            iconBg[accentColor],
            href && "group-hover:scale-110"
          )}>
            {icon}
          </div>
        )}
      </CardHeader>

      <CardContent className="px-5 pb-5 space-y-2">
        {loading ? (
          <div className="h-9 w-36 bg-muted rounded-lg animate-pulse" />
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight">{value}</span>
            {trend !== undefined && (
              <span className={cn(
                "flex items-center gap-0.5 text-xs font-semibold",
                trendPositive ? "text-[hsl(var(--success))]" : "text-destructive"
              )}>
                {trendPositive
                  ? <TrendingUp className="h-3.5 w-3.5" />
                  : <TrendingDown className="h-3.5 w-3.5" />}
                {Math.abs(trend)}%
              </span>
            )}
          </div>
        )}
        {subtext && (
          <p className="text-xs text-muted-foreground font-medium">{subtext}</p>
        )}
      </CardContent>
    </div>
  );

  if (href) {
    return (
      <Link href={href}>
        <Card hoverable className={cn("shadow-[var(--shadow-subtle)] hover:shadow-[var(--shadow-large)] transition-all", className)}>
          {inner}
        </Card>
      </Link>
    );
  }

  return (
    <Card className={cn("shadow-[var(--shadow-subtle)]", className)}>
      {inner}
    </Card>
  );
}
