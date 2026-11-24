import type { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Виды из Figma: error, questions.
const alertVariants = cva("rounded-[var(--radius-card)] border px-4 py-3 text-sm", {
  variants: {
    kind: {
      error: "border-[var(--status-error)] bg-[var(--status-error-soft)] text-[var(--status-error)]",
      questions: "border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--text-primary)]",
    },
  },
  defaultVariants: { kind: "questions" },
});

export function Alert({
  kind,
  children,
  className,
}: VariantProps<typeof alertVariants> & { children: ReactNode; className?: string }) {
  return (
    <div role={kind === "error" ? "alert" : "status"} className={cn(alertVariants({ kind }), className)}>
      {children}
    </div>
  );
}
