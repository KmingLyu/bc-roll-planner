// src/hooks/usePlannerWorker.ts
import { useEffect, useRef, useState } from "react";
import PlannerWorker from "../workers/planner.worker?worker";
import type { PlannerWorkerResponse } from "../workers/planner.worker";
import type { PlanResult } from "../core/planner";

type LoadState = "idle" | "loading" | "ok" | "error";
type WorkerResp = PlannerWorkerResponse;

type RunPayload =
  | { kind: "run"; req: any }
  | { kind: "errorOnly"; error: string };

export function usePlannerWorker() {
  const workerRef = useRef<Worker | null>(null);
  const seqRef = useRef(0);

  const [planState, setPlanState] = useState<LoadState>("idle");
  const [planErr, setPlanErr] = useState<string>("");
  const [planResult, setPlanResult] = useState<PlanResult | null>(null);

  function ensureWorker() {
    if (!workerRef.current) workerRef.current = new PlannerWorker();
    return workerRef.current;
  }

  function resetPlan() {
    setPlanState("idle");
    setPlanErr("");
    setPlanResult(null);
  }

  function runPlanner(payload: RunPayload) {
    if (payload.kind === "errorOnly") {
      setPlanState("error");
      setPlanErr(payload.error);
      setPlanResult(null);
      return;
    }

    const w = ensureWorker();
    const seq = ++seqRef.current;

    setPlanState("loading");
    setPlanErr("");
    setPlanResult(null);

    w.onmessage = (e: MessageEvent<WorkerResp>) => {
      if (seq !== seqRef.current) return;

      if (e.data.ok) {
        setPlanResult(e.data.result as any);
        setPlanState("ok");
      } else {
        setPlanResult(null);
        setPlanState("error");
        setPlanErr(e.data.error);
      }
    };

    w.postMessage(payload.req);
  }

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  return {
    planState,
    planErr,
    planResult,
    runPlanner,
    resetPlan,
  };
}
