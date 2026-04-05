import * as React from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Sheet({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </Dialog.Root>
  );
}

export function SheetTrigger({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Dialog.Trigger className={className}>{children}</Dialog.Trigger>
  );
}

export function SheetContent({
  title,
  description,
  side = "right",
  className,
  children,
}: {
  title: string;
  description?: string;
  side?: "right" | "bottom";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[2px]" />
      <Dialog.Viewport className="fixed inset-0 z-50">
        <Dialog.Popup
          className={cn(
            "fixed bg-card shadow-[0_24px_80px_-32px_rgba(15,23,42,0.6)] outline-none",
            side === "right"
              ? "inset-y-0 right-0 h-full w-full max-w-xl border-l border-border"
              : "inset-x-0 bottom-0 max-h-[88vh] rounded-t-[28px] border-t border-border",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="text-base font-semibold text-foreground">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <div className="subtle-scrollbar overflow-y-auto overscroll-contain px-5 py-5">
            {children}
          </div>
        </Dialog.Popup>
      </Dialog.Viewport>
    </Dialog.Portal>
  );
}
