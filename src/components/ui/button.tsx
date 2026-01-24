import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        // Primary - Medium Slate Blue
        default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-medium hover:shadow-large",
        
        // Premium CTA - Slime Lime (use sparingly)
        premium: "bg-slime-lime text-ink-black font-semibold hover:shadow-glow animate-premium-pulse hover:animate-none hover:brightness-110",
        
        // Destructive
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        
        // Secondary - Transparent with dust grey border
        outline: "border border-dust-grey bg-transparent hover:bg-dust-grey/20 text-foreground",
        secondary: "border border-dust-grey bg-transparent hover:bg-dust-grey/20 text-foreground",
        
        // Ghost - No background, primary text
        ghost: "text-primary hover:bg-primary/10 hover:text-primary",
        
        // Link
        link: "text-primary underline-offset-4 hover:underline",
        
        // Hero CTA - Gradient background
        hero: "bg-gradient-primary text-white shadow-large hover:shadow-glow-purple hover:scale-[1.02] active:scale-[0.98]",
        
        // Hero Outline
        "hero-outline": "border-2 border-primary/30 bg-background/50 backdrop-blur-sm text-foreground hover:border-primary/50 hover:bg-primary/5",
        
        // Accent - For secondary premium actions
        accent: "bg-accent text-accent-foreground hover:brightness-110 shadow-medium",
        
        // Nav CTA
        "nav-cta": "bg-primary text-primary-foreground hover:bg-primary/90 shadow-subtle",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-12 px-8 text-base",
        xl: "h-14 px-10 text-lg rounded-xl",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
