import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  variant?: "default" | "gradient" | "success";
  showMilestones?: boolean;
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value, variant = "default", showMilestones = false, ...props }, ref) => {
  const getIndicatorClass = () => {
    switch (variant) {
      case "gradient":
        return "bg-gradient-progress";
      case "success":
        return "bg-slime-lime";
      default:
        return "bg-primary";
    }
  };

  return (
    <div className="relative">
      <ProgressPrimitive.Root
        ref={ref}
        className={cn(
          "relative h-3 w-full overflow-hidden rounded-full bg-dust-grey/30",
          className
        )}
        {...props}
      >
        <ProgressPrimitive.Indicator
          className={cn(
            "h-full w-full flex-1 transition-all duration-300 ease-out rounded-full",
            getIndicatorClass()
          )}
          style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
        />
      </ProgressPrimitive.Root>
      
      {/* Milestone dots */}
      {showMilestones && (
        <div className="absolute inset-0 flex items-center justify-between px-1 pointer-events-none">
          {[25, 50, 75, 100].map((milestone) => (
            <div
              key={milestone}
              className={cn(
                "w-2 h-2 rounded-full transition-colors duration-300",
                (value || 0) >= milestone
                  ? "bg-slime-lime shadow-glow"
                  : "bg-dust-grey/50"
              )}
              style={{ marginLeft: milestone === 25 ? '25%' : undefined }}
            />
          ))}
        </div>
      )}
    </div>
  );
});
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
