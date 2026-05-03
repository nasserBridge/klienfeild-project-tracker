import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "h-9 w-full bg-white border border-line rounded-md px-3 text-sm text-ink",
        "placeholder:text-muted focus:outline-none focus:border-lineStrong",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
