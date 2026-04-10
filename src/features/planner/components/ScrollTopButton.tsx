import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

export function ScrollTopButton(props: {
  visible: boolean;
  onClick: () => void;
}) {
  const { visible, onClick } = props;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="回到最上方"
      className={cn(
        "fixed z-40 inline-flex items-center justify-center gap-2 rounded-full border border-border/70 bg-background/92 text-foreground shadow-[0_14px_32px_rgba(15,23,42,0.14)] backdrop-blur transition-all duration-200 focus-visible:ring-4 focus-visible:ring-primary/20",
        "bottom-[calc(env(safe-area-inset-bottom,0px)+3.75rem)] right-5 size-12 sm:bottom-[calc(env(safe-area-inset-bottom,0px)+4rem)] sm:right-6 sm:h-11 sm:w-auto sm:px-4 lg:bottom-16 lg:right-7 2xl:right-[calc((100vw-1480px)/2+1.5rem)]",
        visible
          ? "translate-y-0 opacity-100 hover:-translate-y-0.5 hover:bg-background"
          : "pointer-events-none translate-y-3 opacity-0",
      )}
    >
      <ArrowUp className="size-4 shrink-0" />
      <span className="hidden text-sm font-semibold sm:inline">回到頂部</span>
    </button>
  );
}
