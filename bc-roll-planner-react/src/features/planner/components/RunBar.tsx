import { LoaderCircle, Play, RotateCcw } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type LoadState = "idle" | "loading" | "ok" | "error";

export function RunBar(props: {
  state: LoadState;
  onRun: () => void;
  disabled: boolean;
  hint?: string;
  error?: string;
  hasResult?: boolean;
}) {
  const { state, onRun, disabled, hint, error, hasResult = false } = props;

  const label = hasResult ? "重新執行" : "開始執行";

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onRun} disabled={disabled} className="min-w-28">
          {state === "loading" ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : hasResult ? (
            <RotateCcw className="size-4" />
          ) : (
            <Play className="size-4" />
          )}
          {label}
        </Button>

      </div>

      {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      {state === "error" && error ? (
        <Alert variant="error">{error}</Alert>
      ) : null}
    </div>
  );
}
