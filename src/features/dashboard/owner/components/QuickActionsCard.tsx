"use client";

import React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  UserPlus,
  FileText,
  Wallet,
  GraduationCap,
  BookOpen,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickAction {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  href: string;
  badge?: string | number;
  variant: "primary" | "secondary";
}

interface QuickActionsCardProps {
  pendingContracts?: number;
}

export function QuickActionsCard({ pendingContracts = 0 }: QuickActionsCardProps) {
  const actions: QuickAction[] = [
    {
      id: "add-student",
      label: "Invite Student",
      description: "Add a new student to your workspace",
      icon: <GraduationCap className="h-4 w-4" />,
      href: "/dashboard/owner/students/invite",
      variant: "primary",
    },
    {
      id: "add-tutor",
      label: "Invite Tutor",
      description: "Recruit a tutor to your platform",
      icon: <UserPlus className="h-4 w-4" />,
      href: "/dashboard/owner/tutors/invite",
      variant: "primary",
    },
    {
      id: "make-classroom",
      label: "Classroom",
      description: "Create a new classroom",
      icon: <BookOpen className="h-4 w-4" />,
      href: "/dashboard/owner/classrooms",
      variant: "secondary",
    },
    {
      id: "review-contracts",
      label: "Contracts",
      description: "Review & sign agreements",
      icon: <FileText className="h-4 w-4" />,
      href: "/dashboard/owner/contracts",
      badge: pendingContracts > 0 ? pendingContracts : undefined,
      variant: "secondary",
    },
    {
      id: "manage-billing",
      label: "Billing",
      description: "Manage subscriptions & credits",
      icon: <Wallet className="h-4 w-4" />,
      href: "/dashboard/owner/billing",
      variant: "secondary",
    },
  ];

  const primary = actions.filter((a) => a.variant === "primary");
  const secondary = actions.filter((a) => a.variant === "secondary");

  return (
    <Card className="flex-1 flex flex-col">
      <CardHeader className="pb-2 pt-5 px-5">
        <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-5 flex flex-col flex-1">

        {/* Primary actions — clean rows */}
        <div className="space-y-1">
          {primary.map((action) => (
            <Link key={action.id} href={action.href}>
              <div className="flex items-center gap-3 px-2 py-3 rounded-lg hover:bg-muted transition-colors group cursor-pointer">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                  {action.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-tight">{action.label}</p>
                  {action.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{action.description}</p>
                  )}
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
              </div>
            </Link>
          ))}
        </div>

        {/* Secondary actions pushed to bottom */}
        <div className="mt-auto pt-4">
          <div className="h-px bg-border mb-4" />
          <div className="grid grid-cols-3 gap-2">
            {secondary.map((action) => (
              <Link key={action.id} href={action.href}>
                <div className={cn(
                  "flex flex-col items-center gap-2 py-4 px-3 rounded-lg border border-border",
                  "hover:bg-muted hover:border-primary/25 transition-colors cursor-pointer relative"
                )}>
                  <div className="relative">
                    <div className="text-primary">{action.icon}</div>
                    {action.badge != null && (
                      <Badge className="absolute -top-2.5 -right-3 h-5 min-w-5 flex items-center justify-center text-[10px] px-1 bg-destructive text-destructive-foreground border-2 border-card font-bold">
                        {action.badge}
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-foreground">{action.label}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
