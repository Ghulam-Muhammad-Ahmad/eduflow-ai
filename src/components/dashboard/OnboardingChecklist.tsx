"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type OnboardingItem = {
  label: string;
  description?: string;
  done: boolean;
  href: string;
  icon?: LucideIcon;
};

const DEFAULT_ICON = Circle;

interface OnboardingChecklistProps {
  title?: string;
  /** User's display name for greeting e.g. "Hello Dmitry!" */
  userName?: string;
  /** Subtitle below greeting e.g. "You should complete all steps to fully activate your account" */
  instructionText?: string;
  items: OnboardingItem[];
  /** Hide the checklist when all items are done */
  hideWhenComplete?: boolean;
}

const SEGMENT_COUNT = 10;

export function OnboardingChecklist({
  title = "Get started",
  userName,
  instructionText = "You should complete all steps to fully activate your account",
  items,
  hideWhenComplete = true,
}: OnboardingChecklistProps) {
  const allDone = items.every((i) => i.done);
  if (hideWhenComplete && allDone) return null;

  const doneCount = items.filter((i) => i.done).length;
  const percent = items.length ? Math.round((doneCount / items.length) * 100) : 0;
  const filledSegments = items.length
    ? Math.round((doneCount / items.length) * SEGMENT_COUNT)
    : 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      {/* Header: greeting + instruction + progress */}
      <div className="text-start mb-6">
        {userName !== undefined && (
          <h2 className="text-2xl font-bold text-foreground mb-1">
            Hello {userName}! 🎉
          </h2>
        )}
        {!userName && title && (
          <h2 className="text-2xl font-bold text-foreground mb-1">{title}</h2>
        )}
        <p className="text-sm text-muted-foreground mb-4">
          {instructionText}
        </p>
        {/* Segment progress bar */}
        <div className="flex justify-start gap-0.5 mb-2">
          {Array.from({ length: SEGMENT_COUNT }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-1.5 rounded-sm min-h-[20px] transition-colors",
                i < filledSegments ? "bg-primary" : "bg-muted"
              )}
              style={{ height: 20 }}
            />
          ))}
        </div>
        <p className="text-sm font-medium text-primary text-left">
          {percent}% Completed
        </p>
      </div>

      {/* Checklist cards */}
      <ul className="space-y-3">
        {items.map((item) => {
          const Icon = item.icon ?? DEFAULT_ICON;
          return (
            <li key={item.label}>
              <div className="flex items-center gap-4 rounded-xl border border-border bg-background p-4 hover:border-border/80 transition-colors">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#f4f4f5] border border-border">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">{item.label}</p>
                  {/* {item.description && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {item.description}
                    </p>
                  )} */}
                </div>
                <div className="shrink-0">
                  {item.done ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-700 dark:text-green-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                      Completed
                    </span>
                  ) : (
                    <Link href={item.href}>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="rounded-lg px-4 py-2 bg-primary text-background hover:bg-primary/90"
                      >
                        Start
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
