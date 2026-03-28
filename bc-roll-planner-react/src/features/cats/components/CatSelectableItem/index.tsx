import { Badge } from "@/components/ui/badge";
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

  const content = (
    <button
      type="button"
      onClick={() => onToggle(!checked)}
      className={cn(
        "flex w-full items-start gap-3 rounded-3xl border px-3 py-3 text-left transition-[transform,background-color,border-color,box-shadow]",
        dense ? "min-h-[76px]" : "min-h-[88px]",
        checked
          ? "border-success/40 bg-success/5 shadow-sm"
          : "border-border bg-background hover:border-primary/30 hover:bg-accent/30",
      )}
    >
      <div
        className={cn(
          "inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold",
          checked
            ? "border-success bg-success text-success-foreground"
            : "border-border text-transparent",
        )}
      >
        ✓
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground">{name}</div>
            {secondary ? (
              <div className="mt-1 text-xs text-muted-foreground">{secondary}</div>
            ) : null}
          </div>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              width={40}
              height={40}
              loading="lazy"
              className="size-10 rounded-2xl border border-border object-cover"
            />
          ) : (
            <Badge variant="muted">#{catId}</Badge>
          )}
        </div>
      </div>
    </button>
  );

  if (!href) return content;

  return (
    <div className="space-y-2">
      {content}
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="inline-flex pl-3 text-xs font-medium text-primary underline decoration-primary/30 underline-offset-4"
      >
        查看資料
      </a>
    </div>
  );
}
