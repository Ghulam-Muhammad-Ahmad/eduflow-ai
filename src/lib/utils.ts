import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Strip a single surrounding markdown code fence (e.g. ```markdown ... ```) so content renders as HTML, not inside <code>. */
export function stripMarkdownCodeFence(s: string): string {
  const t = s.trim();
  const open = /^```(\w*)\s*\n?/;
  const close = /\n?```\s*$/;
  const openMatch = t.match(open);
  if (!openMatch) return s;
  const afterOpen = t.slice(openMatch[0].length);
  const closeMatch = afterOpen.match(close);
  if (!closeMatch) return s;
  return afterOpen.slice(0, -closeMatch[0].length).trim();
}
