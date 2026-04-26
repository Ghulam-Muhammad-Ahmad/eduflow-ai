"use client";

import React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  FileCheck,
  Clock,
  Zap,
  HardDrive,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface Alert {
  id: string;
  type: "pending" | "warning" | "error" | "info";
  title: string;
  description: string;
  count?: number;
  icon?: React.ReactNode;
  action?: {
    label: string;
    href: string;
  };
}

interface AlertCardProps {
  alerts: Alert[];
  loading?: boolean;
}

const typeConfig = {
  pending: {
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800",
    icon: "text-blue-600 dark:text-blue-400",
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  },
  warning: {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-800",
    icon: "text-amber-600 dark:text-amber-400",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  },
  error: {
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-200 dark:border-red-800",
    icon: "text-red-600 dark:text-red-400",
    badge: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  },
  info: {
    bg: "bg-slate-50 dark:bg-slate-950/30",
    border: "border-slate-200 dark:border-slate-800",
    icon: "text-slate-600 dark:text-slate-400",
    badge: "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200",
  },
};

export function AlertCard({ alerts = [], loading = false }: AlertCardProps) {
  if (alerts.length === 0 && !loading) {
    return (
      <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="text-emerald-600 dark:text-emerald-400">✓</div>
            All Clear
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No pending actions or alerts</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Alerts & Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          alerts.map((alert) => {
            const config = typeConfig[alert.type];
            return (
              <div
                key={alert.id}
                className={cn(
                  "rounded-lg border p-3 space-y-2",
                  config.bg,
                  config.border
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    {alert.icon ? (
                      <div className={cn("h-5 w-5 mt-0.5 shrink-0", config.icon)}>
                        {alert.icon}
                      </div>
                    ) : (
                      <AlertCircle className={cn("h-5 w-5 mt-0.5 shrink-0", config.icon)} />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{alert.title}</span>
                        {alert.count !== undefined && (
                          <Badge className={config.badge}>
                            {alert.count}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {alert.description}
                      </p>
                    </div>
                  </div>
                  {alert.action && (
                    <Link href={alert.action.href} className="shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
