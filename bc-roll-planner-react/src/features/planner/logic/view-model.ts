/**
 * src/features/planner/ui/planViewModel.ts
 *
 * 用途
 * - 把 planner 的原始資料（PlanResult/PlanStep/DrawHit + TrackGraph）整理成「UI 好用」的結構。
 * - 集中管理顯示用文字（UI_TEXT）、資源名稱映射（ACTIONS/actionLabelFromStep）、
 *   狀態樣式（STATUS_STYLE、TARGET_*）以及 Event 顏色分配策略。
 *
 * 這支檔案的定位
 * - 只做「顯示層」的 mapping/formatting，不改動 planner 核心演算法輸出。
 * - 讓 UI 元件保持乾淨：UI 元件只要吃 DrawRow 就能畫表。
 */
import type {
  PlanResult,
  PlanStep,
  DrawHit,
} from "@/features/planner/logic/core";
import type { TrackGraph } from "@/types/models";
import { parsePosId } from "@/utils/cursor";

/**
 * ============================================================
 * 可集中修改的「寫死字串」區
 * ============================================================
 */
export const UI_TEXT = {
  stepPrefix: "步驟", // e.g. `${stepPrefix} 1`
  tenRollPrefix: "10連", // e.g. `${tenRollPrefix}#3`
  singleRollLabel: "單抽",
  dash: "-", // 表格用 "-"
  targetPrefix: "抽中目標 x",
  guaranteedCountText: "（保底）",
} as const;

export function formatStepText(stepIndex1Based: number): string {
  return `${UI_TEXT.stepPrefix} ${stepIndex1Based}`;
}
export function formatTenRollHead(i1Based: number): string {
  return `${UI_TEXT.tenRollPrefix}#${i1Based}`;
}
export function formatTargetCount(n: number): string {
  return `${UI_TEXT.targetPrefix}${n}`;
}

/**
 * 將命中目標的 Map<catId, count> 格式化為 "貓名A、貓名Bx2" 格式
 * count === 1 不加 x1，count >= 2 加 xN
 */
export function formatHitCatNames(
  hitMap: Map<number, number>,
  catNameById: Map<number, string>,
): string {
  return [...hitMap.entries()]
    .map(([catId, count]) => {
      const name = catNameById.get(catId) ?? "?";
      return count >= 2 ? `${name}x${count}` : name;
    })
    .join("、");
}

export const ACTIONS = ["金券", "白金券", "傳說券", "罐頭", "10連抽"] as const;
export type ActionLabel = (typeof ACTIONS)[number];

export type StatusKey = "normal" | "hit" | "guaranteed";
export const STATUS_STYLE: Record<
  StatusKey,
  { bg: string; node: string; border?: string }
> = {
  // 抽到：不透明黃底
  hit: {
    bg: "#fef5c4",
    node: "#fde04b",
  },

  // 保底：不透明紫底
  guaranteed: {
    bg: "#f9e1fc",
    node: "#de75f1",
  },

  normal: {
    bg: "#f8fafc",
    node: "#f8fafc",
    border: "#cbd5e1",
  },
};

/**
 * ✅ target：文字 pill 的綠框樣式
 * - 邊框更清楚
 * - 淺綠底稍微再淡一點，避免壓過內容
 */
export const TARGET_BORDER_STYLE = {
  border: "2.5px solid rgba(16, 185, 129, 0.95)",
  boxShadow: "none",
  background: "#e7f8f2",
};

/**
 * ✅ target：node（圓點）專用樣式（集中管理）
 * - 注意：不要改 width/height，確保 node 大小跟非 target 完全相同
 * - 用 boxShadow 做「外圈」與「發光」，辨識度大幅提升
 */
export const TARGET_NODE_STYLE = {
  bg: "#10b981",
  borderColor: "rgba(16, 185, 129, 0.95)",
  ringShadow: "none",
  textColor: "rgba(0, 0, 0, 0.85)",
};

export function hashString(s: string): number {
  const str = String(s || "");
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  // console.log("hashString:", s, "->", h);
  return h >>> 0;
}

// 30 色（Hue 調色盤）
export const EVENT_HUES_30 = [
  240, 24, 180, 288, 0, 216, 324, 48, 204, 336, 12, 252, 276, 36, 228, 312,
  192, 348, 264, 96, 108, 120, 132, 144, 156, 168, 72, 84, 60, 300,
] as const;

export function makeEventColorPicker(eventValuesInOrder: string[]) {
  // 照 list 順序分配 hue（同名 event 只分配一次）
  const hueByEvent = new Map<string, number>();
  let idx = 0;

  for (const ev of eventValuesInOrder) {
    const k = String(ev || "");
    if (!k || hueByEvent.has(k)) continue;
    hueByEvent.set(k, EVENT_HUES_30[idx % EVENT_HUES_30.length]);
    idx++;
  }

  function hueOf(ev: string): number {
    const k = String(ev || "");
    // 若有新的 ev（例如資料後來才出現），就接續分配，避免回到 hash
    if (!hueByEvent.has(k)) {
      hueByEvent.set(k, EVENT_HUES_30[idx % EVENT_HUES_30.length]);
      idx++;
    }
    return hueByEvent.get(k)!;
  }

  return {
    hueOf,
    colorOf: (ev: string) => `hsl(${hueOf(ev)}, 72%, 42%)`,
    tintOf: (ev: string) => `hsla(${hueOf(ev)}, 72%, 55%, 0.14)`,
  };
}

// export function eventHue(ev: string): number {
//   console.log("eventHue:", ev, "->", hashString(ev) % EVENT_HUES_30.length);
//   return EVENT_HUES_30[hashString(ev) % EVENT_HUES_30.length];
// }
// export function eventColor(ev: string): string {
//   return `hsl(${eventHue(ev)}, 72%, 42%)`;
// }
// export function eventTint(ev: string): string {
//   return `hsla(${eventHue(ev)}, 72%, 55%, 0.14)`;
// }

export function truncateText(s: string, n: number): string {
  const t = String(s || "");
  return t.length <= n ? t : t.slice(0, n) + "…";
}

export function actionLabelFromStep(step: PlanStep): ActionLabel {
  if (step.resource === "ticket" && step.method === "single") return "金券";
  if (step.resource === "platinum_ticket" && step.method === "single")
    return "白金券";
  if (step.resource === "legend_ticket" && step.method === "single")
    return "傳說券";
  if (step.resource === "food" && step.method === "single") return "罐頭";
  if (step.resource === "food" && step.method === "ten") return "10連抽";
  return "金券";
}

export function safeGetNormalCatName(
  g: TrackGraph | null | undefined,
  posId: string,
): string {
  const node = g?.nodes?.[posId];
  const cat = node?.edges?.normal?.cat;
  return cat?.name || UI_TEXT.dash;
}

export function safeGetNormalCat(
  g: TrackGraph | null | undefined,
  posId: string,
) {
  const node = g?.nodes?.[posId];
  return node?.edges?.normal?.cat ?? null;
}

/**
 * ✅ 強化：如果 parsePosId 太嚴格解析失敗，改用 regex 撈出「數字 + A/B」
 */
export function posTrackFromPosId(posId: string): {
  ok: boolean;
  pos: number;
  track: "A" | "B";
  id: string;
} {
  const raw = String(posId || "");
  try {
    const c = parsePosId(raw);
    return { ok: true, pos: c.pos, track: c.track, id: c.id };
  } catch {
    const m = raw.match(/(\d+)\s*([AB])/i);
    if (m) {
      const pos = Number(m[1]);
      const track = m[2].toUpperCase() as "A" | "B";
      return { ok: Number.isFinite(pos), pos, track, id: `${pos}${track}` };
    }
    return { ok: false, pos: 0, track: "A", id: "" };
  }
}

export type DrawRow = {
  key: string;

  countText: string;

  stepText: string;
  actionText: ActionLabel;
  eventValue: string;
  eventName: string;
  eventRawName: string;
  eventStartDate: string | null;
  eventEndDate: string | null;

  A: string;
  B: string;
  catIdA: number | null;
  catIdB: number | null;

  statusA: StatusKey;
  statusB: StatusKey;

  // lane 專用 target
  isTargetA: boolean;
  isTargetB: boolean;

  // lane 專用 duplicate（同一隻貓在計畫中已出現過）
  isDuplicateA: boolean;
  isDuplicateB: boolean;

  note: string;

  pos: number | null;
  track: "A" | "B" | null;
  used: DrawHit["used"];
  catId: number | null;

  stepIndex: number;
  withinStepIndex: number;
  isHeader: boolean;
  isTen: boolean;
  isGuaranteedRow: boolean;

  isTarget: boolean;
};

export function buildDrawRows(params: {
  result: PlanResult;
  graphsByEvent: Record<string, TrackGraph>;
  targetIdSet: Set<number>;
  catNameById: Map<number, string>;
}): DrawRow[] {
  const { result, graphsByEvent, targetIdSet, catNameById } = params;
  const plan = (result.plan || []) as PlanStep[];

  const out: DrawRow[] = [];
  const seenCatIds = new Set<number>();
  const targetDrawCount = new Map<number, number>(); // 目標貓累計抽到次數

  for (let si = 0; si < plan.length; si++) {
    const st = plan[si];
    const action = actionLabelFromStep(st);
    const g = graphsByEvent[st.event_value];
    const eventMeta = g?.event;
    const eventName = eventMeta?.name || st.event_value;
    const eventRawName = eventMeta?.raw_name || eventName;
    const eventStartDate = eventMeta?.start_date ?? null;
    const eventEndDate = eventMeta?.end_date ?? null;

    const isTen = st.method === "ten";
    const draws = (st.draws || []) as DrawHit[];

    // -------------------------
    // ten：摘要 header
    // -------------------------
    if (isTen) {
      // ✅ 依 lane 統計 target 命中（用 Map 記錄每隻目標貓的命中次數）
      const hitMapA = new Map<number, number>();
      const hitMapB = new Map<number, number>();

      for (const d of draws) {
        if (d.cat_id == null || !targetIdSet.has(d.cat_id)) continue;
        const p = posTrackFromPosId(d.from_pos_id);
        if (p.ok) {
          if (p.track === "A")
            hitMapA.set(d.cat_id, (hitMapA.get(d.cat_id) || 0) + 1);
          else hitMapB.set(d.cat_id, (hitMapB.get(d.cat_id) || 0) + 1);
        }
      }

      const hitA = hitMapA.size;
      const hitB = hitMapB.size;
      const totalHit = hitA + hitB;
      const sp = posTrackFromPosId(st.start_cursor_id);

      out.push({
        key: `s${si}-ten-summary`,
        countText: sp.ok ? String(sp.pos) : UI_TEXT.dash,
        stepText: formatStepText(si + 1),
        actionText: action,
        eventValue: st.event_value,
        eventName,
        eventRawName,
        eventStartDate,
        eventEndDate,

        A: hitA > 0 ? formatHitCatNames(hitMapA, catNameById) : UI_TEXT.dash,
        B: hitB > 0 ? formatHitCatNames(hitMapB, catNameById) : UI_TEXT.dash,
        catIdA: hitMapA.size === 1 ? [...hitMapA.keys()][0] : null,
        catIdB: hitMapB.size === 1 ? [...hitMapB.keys()][0] : null,

        statusA: hitA > 0 ? "hit" : "normal",
        statusB: hitB > 0 ? "hit" : "normal",
        isTargetA: hitA > 0,
        isTargetB: hitB > 0,

        note: `${st.start_cursor_id} → ${st.end_cursor_id}`,
        pos: sp.ok ? sp.pos : null,
        track: sp.ok ? sp.track : null,
        used: "normal",
        catId: null,

        stepIndex: si,
        withinStepIndex: 0,
        isHeader: true,
        isTen: true,
        isGuaranteedRow: false,

        isTarget: totalHit > 0,

        isDuplicateA: false,
        isDuplicateB: false,
      });
    }

    // -------------------------
    // draws 列（single/ten 展開列）
    // -------------------------
    for (let di = 0; di < draws.length; di++) {
      const d = draws[di];
      const from = posTrackFromPosId(d.from_pos_id);
      const isGuaranteed = d.used === "guaranteed";

      const pos = from.ok ? from.pos : null;
      const track = from.ok ? from.track : null;

      // const baseA = isGuaranteed
      //   ? track === "A"
      //     ? d.cat_name || UI_TEXT.dash
      //     : pos != null
      //     ? safeGetNormalCatName(g, `${pos}A`)
      //     : UI_TEXT.dash
      //   : pos != null
      //   ? safeGetNormalCatName(g, `${pos}A`)
      //   : UI_TEXT.dash;

      // const baseB = isGuaranteed
      //   ? track === "B"
      //     ? d.cat_name || UI_TEXT.dash
      //     : pos != null
      //     ? safeGetNormalCatName(g, `${pos}B`)
      //     : UI_TEXT.dash
      //   : pos != null
      //   ? safeGetNormalCatName(g, `${pos}B`)
      //   : UI_TEXT.dash;
      const normalA =
        pos != null ? safeGetNormalCat(g, `${pos}A`) : null;
      const normalB =
        pos != null ? safeGetNormalCat(g, `${pos}B`) : null;

      // 預設先用 normal 軌道當底（用來顯示另一條 lane 的對照）
      let baseA = normalA?.name || UI_TEXT.dash;
      let baseB = normalB?.name || UI_TEXT.dash;
      let catIdA = normalA?.id ?? null;
      let catIdB = normalB?.id ?? null;

      // 不管 used 是 normal / switch_track / guaranteed：抽到的那條 lane 一律顯示結果貓
      if (track === "A") {
        baseA = (d.cat_name || "").trim() ? d.cat_name : baseA;
        catIdA = d.cat_id ?? catIdA;
      } else if (track === "B") {
        baseB = (d.cat_name || "").trim() ? d.cat_name : baseB;
        catIdB = d.cat_id ?? catIdB;
      } else {
        // 解析不到 track 的保守處理：維持你原本習慣（當作 B）
        baseB = (d.cat_name || "").trim() ? d.cat_name : baseB;
        catIdB = d.cat_id ?? catIdB;
      }

      if (isGuaranteed) {
        if (track === "A") {
          baseB = UI_TEXT.dash;
          catIdB = null;
        } else if (track === "B") {
          baseA = UI_TEXT.dash;
          catIdA = null;
        }
      }

      const isTarget = d.cat_id != null && targetIdSet.has(d.cat_id);

      // 目標貓累計次數（跨步驟）
      if (isTarget && d.cat_id != null) {
        targetDrawCount.set(d.cat_id, (targetDrawCount.get(d.cat_id) || 0) + 1);
      }
      const targetCount =
        isTarget && d.cat_id != null ? targetDrawCount.get(d.cat_id) || 1 : 0;

      // 重複判斷（全域跨步驟）
      const isDup = d.cat_id != null && seenCatIds.has(d.cat_id);
      if (d.cat_id != null) seenCatIds.add(d.cat_id);

      // 目標貓名稱加上累計次數後綴（x1 不顯示）
      let A = baseA;
      let B = baseB;
      if (isTarget && targetCount >= 2) {
        if (track === "A") A = `${baseA} x ${targetCount}`;
        else B = `${baseB} x ${targetCount}`;
      }

      let statusA: StatusKey = "normal";
      let statusB: StatusKey = "normal";
      let isTargetA = false;
      let isTargetB = false;
      let isDuplicateA = false;
      let isDuplicateB = false;

      if (track === "A") {
        statusA = isGuaranteed ? "guaranteed" : "hit";
        isTargetA = isTarget;
        isDuplicateA = isDup;
      } else if (track === "B") {
        statusB = isGuaranteed ? "guaranteed" : "hit";
        isTargetB = isTarget;
        isDuplicateB = isDup;
      } else {
        statusB = isGuaranteed ? "guaranteed" : "hit";
        isTargetB = isTarget;
        isDuplicateB = isDup;
      }

      const countText =
        isGuaranteed && isTen
          ? UI_TEXT.guaranteedCountText
          : pos != null
            ? String(pos)
            : UI_TEXT.dash;

      const stepText = isTen
        ? UI_TEXT.dash
        : di === 0
          ? formatStepText(si + 1)
          : UI_TEXT.dash;

      out.push({
        key: `s${si}-d${di}-${d.from_pos_id}-${d.cat_id ?? "x"}`,
        countText,
        stepText,
        actionText: action,
        eventValue: st.event_value,
        eventName,
        eventRawName,
        eventStartDate,
        eventEndDate,
        A,
        B,
        catIdA,
        catIdB,
        statusA,
        statusB,
        isTargetA,
        isTargetB,
        note: (() => {
          const head = isTen
            ? formatTenRollHead(di + 1)
            : UI_TEXT.singleRollLabel;

          const used = d.used;
          const cat =
            d.cat_id != null ? `${d.cat_name}#${d.cat_id}` : UI_TEXT.dash;
          const src = d.source_pick_id ? `src=${d.source_pick_id}` : "";
          const n = (d.note || "").trim();

          return [
            head,
            used ? `used=${used}` : "",
            `${d.from_pos_id}→${d.to_pos_id}`,
            cat,
            src,
            n ? `(${n})` : "",
          ]
            .filter(Boolean)
            .join(" ");
        })(),
        pos,
        track,
        used: d.used,
        catId: d.cat_id ?? null,
        stepIndex: si,
        withinStepIndex: di + 1,
        isHeader: !isTen && di === 0,
        isTen,
        isGuaranteedRow: isGuaranteed,
        isTarget,
        isDuplicateA,
        isDuplicateB,
      });
    }
  }

  return out;
}
