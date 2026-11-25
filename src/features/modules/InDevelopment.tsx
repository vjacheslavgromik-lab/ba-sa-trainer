import { Badge } from "@/components/ui/badge";

/** Раздел модуля без готового содержимого (US-8.4). */
export function InDevelopment({ what }: { what: string }) {
  return (
    <p className="muted">
      <Badge tone="planned">В разработке</Badge> {what} для этого модуля появятся с наполнением модуля.
    </p>
  );
}
