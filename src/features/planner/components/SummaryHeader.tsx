import { PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SummaryHeader(props: { onReset: () => void }) {
  const { onReset } = props;

  return (
    <div
      className={cn(
        "workspace-toolbar",
        "items-start sm:items-center",
      )}
    >
      <div className="min-w-0 flex flex-1 flex-wrap items-center gap-2.5">
        <div className="text-sm font-semibold text-foreground">結果摘要</div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="shrink-0 self-start text-muted-foreground hover:text-foreground"
        onClick={onReset}
      >
        <PencilLine className="size-4" />
        重新輸入
      </Button>
    </div>
  );
}
