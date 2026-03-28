import { LoaderCircle, Play, RotateCcw } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type LoadState = "idle" | "loading" | "ok" | "error";

export function RunBar(props: {
  state: LoadState;
  onRun: () => void;
  disabled: boolean;
  hint?: string;
  error?: string;
  stale?: boolean;
  hasResult?: boolean;
}) {
  const { state, onRun, disabled, hint, error, stale = false, hasResult = false } =
    props;

  const label = hasResult ? "重新執行" : "開始執行";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={onRun} disabled={disabled} className="min-w-32">
          {state === "loading" ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : hasResult ? (
            <RotateCcw className="size-4" />
          ) : (
            <Play className="size-4" />
          )}
          {label}
        </Button>

        {stale ? <Badge variant="warning">條件已變更</Badge> : null}
      </div>

      {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      {state === "loading" ? (
        <Alert variant="info">規劃中…</Alert>
      ) : null}
      {state === "error" && error ? (
        <Alert variant="error">{error}</Alert>
      ) : null}
    </div>
  );
}
