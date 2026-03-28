import { AlertCircle, CheckCircle2, Info, OctagonAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const styles = {
  info: {
    icon: Info,
    className: "border-primary/25 bg-primary/5 text-foreground",
  },
  success: {
    icon: CheckCircle2,
    className: "border-success/20 bg-success/5 text-foreground",
  },
  warning: {
    icon: AlertCircle,
    className: "border-warning/20 bg-warning/5 text-foreground",
  },
  error: {
    icon: OctagonAlert,
    className: "border-destructive/20 bg-destructive/5 text-foreground",
  },
} as const;

export function Alert({
  variant = "info",
  className,
  title,
  children,
}: {
  variant?: keyof typeof styles;
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  const Icon = styles[variant].icon;

  return (
    <div
      className={cn(
        "flex gap-3 rounded-[4px] border-l-2 border-r border-y px-3 py-2 text-sm leading-6",
        styles[variant].className,
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        {title ? <div className="font-semibold">{title}</div> : null}
        <div className={title ? "text-muted-foreground" : ""}>{children}</div>
      </div>
    </div>
  );
}
