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
        "group flex items-start gap-1.5 px-1 py-1 transition-colors",
        checked ? "bg-primary/5" : "hover:bg-muted/25",
      )}
    >
      <button
        type="button"
        onClick={() => onToggle(!checked)}
        className={cn(
          "flex min-w-0 flex-1 items-start gap-2.5 px-1.5 py-1 text-left transition-colors",
          dense ? "min-h-[48px]" : "min-h-[72px]",
        )}
      >
        <div
          className={cn(
            "mt-0.5 inline-flex size-[18px] shrink-0 items-center justify-center rounded-md border text-[10px] font-semibold transition-colors",
            checked
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border/80 bg-background text-transparent group-hover:border-primary/40",
          )}
        >
          ✓
        </div>
        {showImage ? (
          <img
            src={imageUrl}
            alt=""
            width={32}
            height={32}
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="size-8 shrink-0 rounded-md object-cover ring-1 ring-border/20"
          />
        ) : null}
        <div className="min-w-0 space-y-1">
          <div className="line-clamp-2 text-sm font-semibold leading-5 text-foreground">
            {name}
          </div>
          {secondary ? (
            <div className="text-xs text-muted-foreground">{secondary}</div>
          ) : (
            <div className="text-xs text-muted-foreground">#{catId}</div>
          )}
        </div>
      </button>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          aria-label={`查看 ${name} 資料`}
          className="mt-1.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
        >
          <ArrowUpRight className="size-4" />
        </a>
      ) : null}
    </div>
  );
}
