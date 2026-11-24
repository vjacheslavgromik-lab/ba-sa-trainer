import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "min-h-48 w-full resize-y rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--bg-page)] p-3 font-[inherit] text-[var(--text-primary)]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]",
        "disabled:opacity-85",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
