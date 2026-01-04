import { useCallback, useEffect, useRef } from "react";
import type { PlannerWorkerResponse } from "../../workers/planner.worker";

type WorkerResp = PlannerWorkerResponse;

export function usePlannerWorker(WorkerCtor: new () => Worker) {
  const workerRef = useRef<Worker | null>(null);
  const seqRef = useRef(0);

  const ensure = useCallback(() => {
    if (!workerRef.current) workerRef.current = new WorkerCtor();
    return workerRef.current;
  }, [WorkerCtor]);

  const terminate = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  useEffect(() => {
    return () => terminate();
  }, [terminate]);

  const run = useCallback(
    (req: any): Promise<WorkerResp> => {
      const w = ensure();
      const seq = ++seqRef.current;

      return new Promise((resolve) => {
        w.onmessage = (e: MessageEvent<WorkerResp>) => {
          if (seq !== seqRef.current) return;
          resolve(e.data);
        };
        w.onerror = (err: any) => {
          if (seq !== seqRef.current) return;
          resolve({
            ok: false,
            error: String(err?.message || err || "Worker error"),
          } as any);
        };
        w.postMessage(req);
      });
    },
    [ensure]
  );

  return { run, terminate };
}
