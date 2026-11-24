import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";

export function Progress({
  className,
  value,
  max,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & { value: number; max: number }) {
  const percent = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <ProgressPrimitive.Root
      value={value}
      max={max}
      className={cn("relative h-2 w-full overflow-hidden rounded bg-[var(--border-default)]", className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className="h-full bg-[var(--status-success)] transition-transform"
        style={{ width: `${percent}%` }}
      />
    </ProgressPrimitive.Root>
  );
}
