import type { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Статусы из Figma: success, error, warning, info, planned.
const badgeVariants = cva(
  "inline-flex items-center gap-1 h-6 px-3 rounded-full text-[13px] font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        success: "text-[var(--status-success)] bg-[var(--status-success-soft)]",
        warning: "text-[var(--status-warning)] bg-[var(--status-warning-soft)]",
        error: "text-[var(--status-error)] bg-[var(--status-error-soft)]",
        info: "text-[var(--accent-primary)] bg-[var(--accent-soft)]",
        planned: "text-[var(--status-planned)] bg-[var(--bg-muted)]",
      },
    },
    defaultVariants: { tone: "planned" },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

const ICON: Record<BadgeTone, string> = {
  success: "✓",
  warning: "!",
  error: "✕",
  info: "●",
  planned: "◷",
};

export function Badge({ tone, children, className }: { tone: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn(badgeVariants({ tone }), className)}>
      <span aria-hidden="true">{ICON[tone]}</span> {children}
    </span>
  );
}
