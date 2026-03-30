import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RunBlockingOverlay(props: {
  open: boolean;
  onCancel: () => void;
}) {
  const { open, onCancel } = props;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/38 px-4 backdrop-blur-[2px]"
      aria-live="polite"
      aria-modal="true"
      role="alertdialog"
    >
      <div className="workspace-pane flex w-full max-w-sm flex-col items-center gap-4 border-border/60 bg-card px-6 py-7 text-center shadow-lg">
        <LoaderCircle className="size-10 animate-spin text-primary" />
        <div className="space-y-1">
          <p className="text-base font-semibold text-foreground">計算中…</p>
          {/* <p className="text-sm text-muted-foreground">
            目前只開放取消，其他區域暫時不可操作。
          </p> */}
        </div>
        <Button variant="outline" className="min-w-24" onClick={onCancel}>
          取消
        </Button>
      </div>
    </div>
  );
}
