import type { ActionLabel } from "../logic/view-model";
import { cn } from "@/lib/utils";

const ACTION_IMAGE: Record<ActionLabel, string> = {
  稀有券: "/稀有券.png",
  白金券: "/白金券.png",
  傳說券: "/傳說券.png",
  罐頭: "/貓罐頭.png",
  "10連抽": "/貓罐頭.png",
};

const ACTION_COUNT: Partial<Record<ActionLabel, number>> = {
  罐頭: 150,
  "10連抽": 1500,
};

export function ResourceImg({
  label,
  height = 20,
  showCount = true,
  countOverride,
  subtitle,
  className,
}: {
  label: ActionLabel;
  height?: number;
  showCount?: boolean;
  countOverride?: number | null;
  subtitle?: string | null;
  className?: string;
}) {
  const src = ACTION_IMAGE[label];
  const count = showCount ? countOverride ?? ACTION_COUNT[label] : undefined;
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <img
        src={src}
        alt={label}
        width={height}
        height={height}
        style={{ display: "block" }}
      />
      {count != null || subtitle ? (
        <span className="inline-flex min-w-0 flex-col gap-0.5">
          {count != null ? (
            <span className="text-[0.82rem] font-black leading-none text-muted-foreground">
              x{count}
            </span>
          ) : null}
          {subtitle ? (
            <span className="text-[0.6rem] font-semibold leading-none text-muted-foreground">
              {subtitle}
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
