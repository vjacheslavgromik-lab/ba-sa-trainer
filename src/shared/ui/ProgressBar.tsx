import { Progress } from "@/components/ui/progress";

export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <Progress className="flex-1" value={value} max={max} aria-label={label} />
      <span className="whitespace-nowrap text-sm text-[var(--text-secondary)]">
        {value} из {max}
      </span>
    </div>
  );
}
