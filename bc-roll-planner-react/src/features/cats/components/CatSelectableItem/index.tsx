import { useState } from "react";
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
    <button
      type="button"
      onClick={() => onToggle(!checked)}
      className={cn(
        "group flex h-full w-full items-start rounded-lg border px-2 py-2 text-left transition-colors",
        checked
          ? "border-primary/45 bg-primary/[0.06] shadow-[inset_0_0_0_1px_rgba(59,130,246,0.12)]"
          : "border-transparent hover:border-border/60 hover:bg-muted/20",
      )}
    >
      <div
        className={cn(
          "flex min-w-0 flex-1 items-start gap-1.5",
          dense ? "min-h-[54px]" : "min-h-[70px]",
        )}
      >
        {showImage ? (
          <img
            src={imageUrl}
            alt=""
            width={34}
            height={34}
            loading="lazy"
            onError={() => setImageFailed(true)}
            className={cn(
              "size-[34px] shrink-0 rounded-md object-cover ring-1 ring-border/20",
              checked && "ring-primary/25",
            )}
          />
        ) : null}
        <div className="min-w-0 flex-1 space-y-0.5">
          <div
            className={cn(
              "line-clamp-2 break-keep text-sm font-semibold leading-5 text-foreground",
              checked && "text-foreground",
            )}
          >
            {name}
          </div>
          {secondary ? (
            <div className="text-xs text-muted-foreground">{secondary}</div>
          ) : (
            <div className="text-xs text-muted-foreground">#{catId}</div>
          )}
        </div>
      </div>
    </button>
  );
}
