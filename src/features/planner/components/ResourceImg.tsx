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
  const isStepUpSubtitle = subtitle === "好康轉蛋";
  const stepUpSubtitleStyle = isStepUpSubtitle
    ? {
        textShadow: [
          "-1px 0 0 rgba(82, 48, 0, 0.95)",
          "1px 0 0 rgba(82, 48, 0, 0.95)",
          "0 -1px 0 rgba(82, 48, 0, 0.95)",
          "0 1px 0 rgba(82, 48, 0, 0.95)",
          "0 1px 1px rgba(82, 48, 0, 0.4)",
        ].join(", "),
      }
    : undefined;

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
            <span
              className={cn(
                "text-[0.6rem] font-semibold leading-none",
                isStepUpSubtitle
                  ? "inline-flex self-start rounded-full border border-[#4f3000] bg-[linear-gradient(180deg,#fff9a3_0%,#ffe94d_42%,#f2bf00_100%)] px-1.5 py-[2px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_1px_0_rgba(79,48,0,0.28)]"
                  : "text-muted-foreground",
              )}
              style={stepUpSubtitleStyle}
            >
              {subtitle}
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
