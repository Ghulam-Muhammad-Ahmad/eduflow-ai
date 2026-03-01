"use client";

import Link from "next/link";
import { CheckCircle2, Circle, ChevronRight } from "lucide-react";

export type OnboardingItem = {
  label: string;
  done: boolean;
  href: string;
};

interface OnboardingChecklistProps {
  title?: string;
  items: OnboardingItem[];
  /** Hide the checklist when all items are done */
  hideWhenComplete?: boolean;
}

export function OnboardingChecklist({
  title = "Get started",
  items,
  hideWhenComplete = true,
}: OnboardingChecklistProps) {
  const allDone = items.every((i) => i.done);
  if (hideWhenComplete && allDone) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">{title}</h2>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.label}>
            <Link
              href={item.href}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors"
            >
              {item.done ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 dark:text-green-500" />
              ) : (
                <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
              )}
              <span className={item.done ? "text-muted-foreground line-through" : "font-medium"}>
                {item.label}
              </span>
              {!item.done && <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
