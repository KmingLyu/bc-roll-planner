import { LoaderCircle } from "lucide-react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";

export function Overlay(props: {
  open: boolean;
  onCancel: () => void;
}) {
  const { open, onCancel } = props;

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/38 px-4 backdrop-blur-[2px]"
      aria-live="polite"
      aria-modal="true"
      role="alertdialog"
    >
      <div className="workspace-pane flex w-full max-w-sm flex-col items-center gap-4 border-border/60 bg-card px-6 py-7 text-center shadow-lg">
        <LoaderCircle className="size-10 animate-spin text-primary" />
        <p className="text-base font-semibold text-foreground">計算中…</p>
        <Button variant="outline" className="min-w-24" onClick={onCancel}>
          取消
        </Button>
      </div>
    </div>,
    document.body,
  );
}
