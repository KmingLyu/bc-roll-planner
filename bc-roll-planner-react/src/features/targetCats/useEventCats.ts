import { useEffect, useMemo, useState } from "react";
import type { LoadState } from "../../ui/types";
import { fetchEventCats } from "../../api/eventCatsApi";
import { ApiError } from "../../api/netlifyClient";
import type { TierGroup } from "../../uiTypes/homeTypes";
import { tierOrder } from "../../uiTypes/homeTypes";
import type { Event } from "../../../shared/models";

type Input = {
  seed: string;
  count: number;
  activeEvent: Event | null;
};

export function useEventCats({ seed, count, activeEvent }: Input) {
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState("");
  const [groups, setGroups] = useState<TierGroup[]>([]);

  const paramsKey = useMemo(() => {
    const ev = activeEvent?.value || "";
    const s = seed.trim();
    const c = Number(count);
    return `${ev}__${s}__${c}`;
  }, [activeEvent, seed, count]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const ev = activeEvent?.value?.trim() || "";
      const s = seed.trim();
      const c = Number(count);

      if (!ev || !s || !Number.isFinite(c) || c <= 0) {
        setState("idle");
        setError("");
        setGroups([]);
        return;
      }

      setState("loading");
      setError("");
      setGroups([]);

      try {
        const res = await fetchEventCats({
          seed: s,
          event: ev,
          count: c,
          lang: "tw",
          ui: "tw",
          name: activeEvent?.name ?? ev,
          start_date: activeEvent?.start_date ?? null,
          end_date: activeEvent?.end_date ?? null,
        });

        if (cancelled) return;

        const next = ((res.groups || []) as TierGroup[]).slice();
        next.sort((a, b) => tierOrder(a.tier) - tierOrder(b.tier));
        setGroups(next);
        setState("ok");
      } catch (e: any) {
        if (cancelled) return;
        setState("error");
        setError(
          e instanceof ApiError
            ? `${e.message} (HTTP ${e.status})`
            : String(e?.message || e)
        );
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [paramsKey, seed, count, activeEvent]);

  return { state, error, groups };
}
