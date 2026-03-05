"use client";

import { useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Circle, Minus, Maximize2, X, Check } from "lucide-react";
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
  userName?: string;
  instructionText?: string;
  items: OnboardingItem[];
  hideWhenComplete?: boolean;
}

const PIE_SIZE = 25;
const PIE_STROKE = 3;
const PIE_R = (PIE_SIZE - PIE_STROKE) / 2;
const PIE_C = PIE_SIZE / 2;
const PIE_CIRCUMFERENCE = 2 * Math.PI * PIE_R;

function PieProgress({ value }: { value: number }) {
  const clamped = Math.min(100, Math.max(0, value));
  const offset = PIE_CIRCUMFERENCE - (clamped / 100) * PIE_CIRCUMFERENCE;
  return (
    <svg width={PIE_SIZE} height={PIE_SIZE} className="shrink-0 text-muted" aria-hidden>
      <circle cx={PIE_C} cy={PIE_C} r={PIE_R} fill="none" stroke="currentColor" strokeWidth={PIE_STROKE} opacity={0.3} />
      <circle
        cx={PIE_C}
        cy={PIE_C}
        r={PIE_R}
        fill="none"
        stroke="currentColor"
        strokeWidth={PIE_STROKE}
        strokeLinecap="round"
        className="text-primary transition-[stroke-dashoffset] duration-200"
        strokeDasharray={PIE_CIRCUMFERENCE}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${PIE_C} ${PIE_C})`}
      />
    </svg>
  );
}

export function OnboardingChecklist({
  title = "Get started",
  userName,
  instructionText = "You should complete all steps to fully activate your account",
  items,
  hideWhenComplete = true,
}: OnboardingChecklistProps) {
  const [minimized, setMinimized] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const allDone = items.every((i) => i.done);
  if (hideWhenComplete && allDone) return null;
  if (dismissed) return null;

  const doneCount = items.filter((i) => i.done).length;
  const percent = items.length ? Math.round((doneCount / items.length) * 100) : 0;
  const filledSegments = items.length ? Math.round((doneCount / items.length) * 10) : 0;

  if (minimized) {
    return (
      <div
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl border border-border/80 bg-card/95 backdrop-blur px-2.5 py-2 shadow-sm"
        data-cursor-element-id="cursor-el-1"
      >
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="flex items-center gap-2 rounded-lg py-1 pr-1 hover:bg-muted/50 transition-colors outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
          aria-label="Expand checklist"
        >
          <PieProgress value={percent} />
          <span className="text-xs font-medium text-foreground tabular-nums">{percent}%</span>
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        </button>
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground"
          aria-label="Expand"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-destructive"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      className="fixed bottom-5 right-5 z-50 w-[320px] rounded-xl border border-border/80 bg-card/95 backdrop-blur p-4 shadow-sm"
      data-cursor-element-id="cursor-el-1"
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">
            {userName !== undefined ? `Hi ${userName}` : title}
          </p>
          <p className="text-xs text-muted-foreground truncate">{percent}% done</p>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={() => setMinimized(true)}
            className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground"
            aria-label="Minimize"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-destructive"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex gap-0.5 mb-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className={cn("h-1 flex-1 rounded-full transition-colors", i < filledSegments ? "bg-primary" : "bg-muted/60")}
          />
        ))}
      </div>

      <ul className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon ?? DEFAULT_ICON;
          return (
            <li key={item.label}>
              <div className="flex items-center gap-2 rounded-lg py-2 px-2 -mx-2 hover:bg-muted/40 transition-colors">
                {item.done ? (
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                ) : (
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span className="text-sm text-foreground flex-1 min-w-0 truncate">{item.label}</span>
                {!item.done && (
                  <Link
                    href={item.href}
                    className="text-xs font-medium text-primary hover:underline shrink-0"
                  >
                    Start
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
