import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function CatSelectableItem(props: {
  catId: number;
  name: string;
  checked: boolean;
  onToggle: (next: boolean) => void;
  imageUrl?: string;
  href?: string;
  dense?: boolean;
  secondary?: React.ReactNode;
}) {
  const {
    catId,
    name,
    checked,
    onToggle,
    imageUrl,
    href,
    dense = true,
    secondary,
  } = props;
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = !!imageUrl && !imageFailed;

  return (
    <div
      className={cn(
        "group flex items-start gap-2 rounded-2xl px-2 py-2 transition-colors",
        checked ? "bg-primary/5" : "hover:bg-muted/35",
      )}
    >
      <button
        type="button"
        onClick={() => onToggle(!checked)}
        className={cn(
          "flex min-w-0 flex-1 items-start gap-3 rounded-2xl px-2 py-2 text-left transition-colors",
          dense ? "min-h-[68px]" : "min-h-[84px]",
        )}
      >
        <div
          className={cn(
            "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors",
            checked
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border/80 bg-background text-transparent group-hover:border-primary/40",
          )}
        >
          ✓
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="truncate text-sm font-semibold text-foreground">
                {name}
              </div>
              {secondary ? (
                <div className="text-xs text-muted-foreground">{secondary}</div>
              ) : (
                <div className="text-xs text-muted-foreground">#{catId}</div>
              )}
            </div>
            {showImage ? (
              <img
                src={imageUrl}
                alt=""
                width={40}
                height={40}
                loading="lazy"
                onError={() => setImageFailed(true)}
                className="size-10 rounded-xl object-cover ring-1 ring-border/35"
              />
            ) : (
              <div className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                #{catId}
              </div>
            )}
          </div>
        </div>
      </button>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          aria-label={`查看 ${name} 資料`}
          className="mt-2 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
        >
          <ArrowUpRight className="size-4" />
        </a>
      ) : null}
    </div>
  );
}
