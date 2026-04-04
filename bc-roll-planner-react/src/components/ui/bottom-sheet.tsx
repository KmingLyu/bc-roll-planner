import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const DISMISS_THRESHOLD = 150;
const VELOCITY_THRESHOLD = 0.5;
const TRANSITION_DURATION = "300ms";
const TRANSITION_EASING = "cubic-bezier(0.32, 0.72, 0, 1)";

type BottomSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  toolbar?: ReactNode;
  children: ReactNode;
};

export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  toolbar,
  children,
}: BottomSheetProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const historyPushedRef = useRef(false);

  // Drag state refs (avoid re-renders during gesture)
  const draggingRef = useRef(false);
  const startYRef = useRef(0);
  const currentDeltaRef = useRef(0);
  const lastMoveTimeRef = useRef(0);
  const lastMoveYRef = useRef(0);
  const pointerIdRef = useRef<number | null>(null);

  const closeSheet = useCallback(() => {
    if (historyPushedRef.current) {
      historyPushedRef.current = false;
      window.history.back();
    }
    onOpenChange(false);
  }, [onOpenChange]);

  // Mount/unmount + enter animation
  useEffect(() => {
    if (open) {
      setMounted(true);
      // Trigger enter animation on next frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    } else {
      setVisible(false);
      const timer = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Lock body scroll when open
  useEffect(() => {
    if (!open) return;
    const { body, documentElement } = document;
    const prevBody = body.style.overflow;
    const prevHtml = documentElement.style.overflow;
    body.style.overflow = "hidden";
    documentElement.style.overflow = "hidden";
    return () => {
      body.style.overflow = prevBody;
      documentElement.style.overflow = prevHtml;
    };
  }, [open]);

  // History pushState for back button
  useEffect(() => {
    if (!open) return;

    if (!historyPushedRef.current) {
      window.history.pushState({ bottomSheet: true }, "");
      historyPushedRef.current = true;
    }

    const onPopState = () => {
      historyPushedRef.current = false;
      onOpenChange(false);
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [open, onOpenChange]);

  // Clean up history state on unmount
  useEffect(() => {
    return () => {
      if (historyPushedRef.current) {
        historyPushedRef.current = false;
        window.history.back();
      }
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const syncViewportMode = () => setIsDesktop(mediaQuery.matches);

    syncViewportMode();
    mediaQuery.addEventListener("change", syncViewportMode);
    return () => mediaQuery.removeEventListener("change", syncViewportMode);
  }, []);

  // Escape key
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeSheet();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, closeSheet]);

  // --- Drag gesture handlers ---

  function applyTransform(deltaY: number, animate: boolean) {
    if (isDesktop) return;
    const panel = panelRef.current;
    const backdrop = backdropRef.current;
    if (!panel) return;

    const clampedDelta = Math.max(0, deltaY);

    if (animate) {
      panel.style.transition = `transform ${TRANSITION_DURATION} ${TRANSITION_EASING}`;
      if (backdrop)
        backdrop.style.transition = `opacity ${TRANSITION_DURATION} ${TRANSITION_EASING}`;
    } else {
      panel.style.transition = "none";
      if (backdrop) backdrop.style.transition = "none";
    }

    panel.style.transform = `translateY(${clampedDelta}px)`;
    if (backdrop) {
      const panelHeight = panel.offsetHeight || 1;
      const progress = Math.min(1, clampedDelta / panelHeight);
      backdrop.style.opacity = String(1 - progress);
    }
  }

  function dismissWithAnimation() {
    if (isDesktop) {
      closeSheet();
      return;
    }
    const panel = panelRef.current;
    if (panel) {
      panel.style.transition = `transform ${TRANSITION_DURATION} ${TRANSITION_EASING}`;
      panel.style.transform = "translateY(100%)";
    }
    const backdrop = backdropRef.current;
    if (backdrop) {
      backdrop.style.transition = `opacity ${TRANSITION_DURATION} ${TRANSITION_EASING}`;
      backdrop.style.opacity = "0";
    }
    setTimeout(() => closeSheet(), 300);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (isDesktop) return;
    // Only start drag from handle area or when content is scrolled to top
    const target = e.target as HTMLElement;
    const isHandle = target.closest("[data-drag-handle]");
    const contentEl = contentRef.current;
    const contentAtTop = !contentEl || contentEl.scrollTop <= 0;

    if (!isHandle && !contentAtTop) return;

    draggingRef.current = false; // Will become true on first move
    startYRef.current = e.clientY;
    currentDeltaRef.current = 0;
    lastMoveTimeRef.current = e.timeStamp;
    lastMoveYRef.current = e.clientY;
    pointerIdRef.current = e.pointerId;

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (isDesktop) return;
    if (pointerIdRef.current !== e.pointerId) return;

    const deltaY = e.clientY - startYRef.current;

    // Only start dragging if moving downward
    if (!draggingRef.current) {
      if (deltaY <= 2) return; // Not enough movement, or upward
      // Check if content is scrolled - if so, don't initiate drag
      const contentEl = contentRef.current;
      if (contentEl && contentEl.scrollTop > 0) {
        pointerIdRef.current = null;
        return;
      }
      draggingRef.current = true;
    }

    e.preventDefault();
    currentDeltaRef.current = deltaY;
    lastMoveYRef.current = e.clientY;
    lastMoveTimeRef.current = e.timeStamp;

    applyTransform(deltaY, false);
  }

  function onPointerUp(e: React.PointerEvent) {
    if (isDesktop) return;
    if (pointerIdRef.current !== e.pointerId) return;
    pointerIdRef.current = null;

    if (!draggingRef.current) return;
    draggingRef.current = false;

    const delta = currentDeltaRef.current;
    const timeDiff = e.timeStamp - lastMoveTimeRef.current;
    const velocity =
      timeDiff > 0
        ? (e.clientY - lastMoveYRef.current) / timeDiff
        : 0;

    if (delta > DISMISS_THRESHOLD || velocity > VELOCITY_THRESHOLD) {
      dismissWithAnimation();
    } else {
      applyTransform(0, true);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className={cn(
          "fixed inset-0 bg-slate-950/40 backdrop-blur-[2px]",
          visible ? "opacity-100" : "opacity-0",
        )}
        style={{
          transition: `opacity ${TRANSITION_DURATION} ${TRANSITION_EASING}`,
        }}
        onClick={closeSheet}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={cn(
          "fixed z-50 flex flex-col overflow-hidden border border-border bg-card",
          isDesktop
            ? "left-1/2 top-1/2 w-[min(1160px,calc(100vw-2.5rem))] max-h-[88vh] rounded-2xl shadow-[0_24px_80px_-32px_rgba(15,23,42,0.45)]"
            : "inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl border-x-0 border-b-0 shadow-[0_-16px_60px_-24px_rgba(15,23,42,0.5)]",
          isDesktop ? (visible ? "opacity-100" : "opacity-0") : visible ? "translate-y-0" : "translate-y-full",
        )}
        style={{
          transition: isDesktop
            ? `opacity ${TRANSITION_DURATION} ${TRANSITION_EASING}, transform ${TRANSITION_DURATION} ${TRANSITION_EASING}`
            : `transform ${TRANSITION_DURATION} ${TRANSITION_EASING}`,
          touchAction: isDesktop ? undefined : "none",
          transform: isDesktop
            ? visible
              ? "translate(-50%, -50%) scale(1)"
              : "translate(-50%, calc(-50% + 16px)) scale(0.985)"
            : undefined,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={(e) => {
          if (pointerIdRef.current === e.pointerId) {
            pointerIdRef.current = null;
            if (draggingRef.current) {
              draggingRef.current = false;
              applyTransform(0, true);
            }
          }
        }}
      >
        {/* Drag handle */}
        {!isDesktop ? (
          <div
            data-drag-handle
            className="flex shrink-0 items-center justify-center pb-1 pt-3"
          >
            <div className="h-1 w-9 rounded-full bg-muted-foreground/30" />
          </div>
        ) : null}

        {/* Header */}
        <div className="flex shrink-0 flex-col gap-3 border-b border-border/50 px-5 pb-3 pt-1 lg:flex-row lg:items-start lg:gap-4 lg:pt-4">
          <div className="flex min-w-0 items-start justify-between gap-4 lg:flex-1">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-foreground">
                {title}
              </h2>
              {description ? (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={closeSheet}
              className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
            >
              <X className="size-4" />
            </button>
          </div>
          {toolbar ? (
            <div className="min-w-0 lg:w-[360px] lg:shrink-0">{toolbar}</div>
          ) : null}
          <button
            type="button"
            onClick={closeSheet}
            className="hidden rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:inline-flex"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div
          ref={contentRef}
          className="subtle-scrollbar flex-1 overflow-y-auto overscroll-contain px-5 pb-5"
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
