import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        // Default - Primary/Info style
        default: "border-transparent bg-primary/10 text-primary",
        
        // Success - Slime lime based
        success: "border-transparent bg-slime-lime/10 text-brand-lime-dark",
        
        // Neutral - Dust grey based
        neutral: "border-transparent bg-dust-grey/20 text-foreground",
        
        // Secondary
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        
        // Destructive
        destructive: "border-transparent bg-destructive/10 text-destructive",
        
        // Outline
        outline: "text-foreground border-dust-grey",
        
        // Premium - For special badges
        premium: "border-transparent bg-gradient-premium text-ink-black font-bold",
        
        // Live/Active status
        live: "border-transparent bg-slime-lime/20 text-brand-lime-dark animate-pulse",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
