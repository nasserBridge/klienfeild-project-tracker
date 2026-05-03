"use client";
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors duration-150 ease-soft focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-accent text-accent-fg hover:bg-[#143d2e]",
        outline: "border border-line text-ink hover:bg-rowHover",
        ghost: "text-ink hover:bg-rowHover",
        subtle: "bg-[rgba(15,15,14,0.04)] text-ink hover:bg-[rgba(15,15,14,0.08)]",
        danger: "bg-bad text-white hover:bg-[#8a2418]",
      },
      size: {
        default: "h-9 px-3 rounded-md",
        sm: "h-8 px-2.5 text-xs rounded",
        lg: "h-10 px-4 rounded-md",
        icon: "h-8 w-8 rounded",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { buttonVariants };
