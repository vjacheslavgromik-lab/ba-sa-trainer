import type { ReactNode } from "react";

export type BadgeTone = "success" | "warning" | "error" | "info" | "planned";

const ICON: Record<BadgeTone, string> = {
  success: "✓",
  warning: "!",
  error: "✕",
  info: "●",
  planned: "◷",
};

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <span className={`badge badge--${tone}`}>
      <span aria-hidden="true">{ICON[tone]}</span> {children}
    </span>
  );
}
