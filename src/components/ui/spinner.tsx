import { cn } from "@/lib/utils";

const SPOKES = 12;
const SPOKE_ANGLES = Array.from({ length: SPOKES }, (_, i) => (i * 360) / SPOKES);

/** Opacity per spoke: darker at top (12 o'clock), lightest at bottom, for gradient motion. */
function spokeOpacity(index: number): number {
  const angle = (index * 360) / SPOKES;
  const t = angle / 180;
  return 0.4 + 0.6 * Math.sin((t * Math.PI) / 2);
}

export interface SpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

/**
 * Custom loading spinner: 12 radial spokes with purple gradient and rounded ends.
 * Sunburst/wheel design; use with animate-spin for loading states.
 */
export function Spinner({ className, size = "md" }: SpinnerProps) {
  const sizeClass = sizeClasses[size];

  return (
    <svg
      className={cn("animate-spin text-primary", sizeClass, className)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <g transform="translate(12, 12)">
        {SPOKE_ANGLES.map((angle, i) => {
          const opacity = spokeOpacity(i);
          return (
            <g key={i} transform={`rotate(${angle})`}>
              <rect
                x={2}
                y={-0.6}
                width={10}
                height={1.2}
                rx={0.6}
                ry={0.6}
                fill="currentColor"
                fillOpacity={opacity}
              />
            </g>
          );
        })}
      </g>
    </svg>
  );
}
