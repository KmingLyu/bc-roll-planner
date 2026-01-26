/**
 * src/components/planner/planViewModel.ts
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
import type { PlanResult, PlanStep, DrawHit } from "../../core/planner";
import type { TrackGraph } from "../../../shared/models";
import { parsePosId } from "../../core/utils";

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

export const ACTIONS = ["金券", "白金券", "傳說券", "罐頭", "10連抽"] as const;
export type ActionLabel = (typeof ACTIONS)[number];

export type StatusKey = "normal" | "hit" | "guaranteed";
export const STATUS_STYLE: Record<
  StatusKey,
  { bg: string; node: string; border?: string }
> = {
  // 抽到：黃底
  hit: {
    bg: "rgba(253, 224, 71, 0.32)",
    node: "rgba(253, 224, 71, 0.95)",
  },

  // 保底：粉紫
  guaranteed: {
    bg: "rgba(217, 70, 239, 0.16)",
    node: "rgba(217, 70, 239, 0.82)",
  },

  normal: { bg: "action.hover", node: "background.paper" },
};

/**
 * ✅ target：文字 pill 的綠框樣式
 * - 邊框更清楚
 * - 淺綠底稍微再淡一點，避免壓過內容
 */
export const TARGET_BORDER_STYLE = {
  border: "2.5px solid rgba(16, 185, 129, 0.95)",
  boxShadow:
    "0 0 0 2px rgba(16, 185, 129, 0.28), 0 10px 20px rgba(16, 185, 129, 0.16)",
  background:
    "linear-gradient(0deg, rgba(16, 185, 129, 0.10), rgba(16, 185, 129, 0.10))",
};

/**
 * ✅ target：node（圓點）專用樣式（集中管理）
 * - 注意：不要改 width/height，確保 node 大小跟非 target 完全相同
 * - 用 boxShadow 做「外圈」與「發光」，辨識度大幅提升
 */
export const TARGET_NODE_STYLE = {
  bg: "rgba(16, 185, 129, 0.92)", // 更明顯的綠
  borderColor: "rgba(16, 185, 129, 1)",
  ringShadow:
    "0 0 0 2px rgba(16, 185, 129, 0.30), 0 8px 16px rgba(16, 185, 129, 0.18)",
  textColor: "rgba(0, 0, 0, 0.85)", // 綠底上 A/B 字更清楚
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
  240, 24, 180, 288, 0, 216, 324, 48, 204, 336, 12, 252, 276, 36, 228, 312, 192,
  348, 264, 96, 108, 120, 132, 144, 156, 168, 72, 84, 60, 300,
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
  const node = g?.nodes?.[posId as any];
  const cat = node?.edges?.normal?.cat;
  return cat?.name || UI_TEXT.dash;
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
    return { ok: true, pos: c.pos, track: c.track as any, id: c.id };
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

  A: string;
  B: string;

  statusA: StatusKey;
  statusB: StatusKey;

  // lane 專用 target
  isTargetA: boolean;
  isTargetB: boolean;

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
}): DrawRow[] {
  const { result, graphsByEvent, targetIdSet } = params;
  const plan = (result.plan || []) as PlanStep[];

  const out: DrawRow[] = [];

  for (let si = 0; si < plan.length; si++) {
    const st = plan[si];
    const action = actionLabelFromStep(st);
    const g = graphsByEvent[st.event_value];
    const eventName = g?.event?.name || st.event_value;

    const isTen = st.method === "ten";
    const draws = (st.draws || []) as DrawHit[];

    // -------------------------
    // ten：摘要 header
    // -------------------------
    if (isTen) {
      // ✅ 依 lane 統計 target 命中
      let hitA = 0;
      let hitB = 0;

      for (const d of draws) {
        if (d.cat_id == null || !targetIdSet.has(d.cat_id)) continue;
        const p = posTrackFromPosId(d.from_pos_id);
        if (p.ok) {
          if (p.track === "A") hitA++;
          else hitB++;
        }
      }

      const totalHit = hitA + hitB;
      const sp = posTrackFromPosId(st.start_cursor_id);

      out.push({
        key: `s${si}-ten-summary`,
        countText: sp.ok ? String(sp.pos) : UI_TEXT.dash,
        stepText: formatStepText(si + 1),
        actionText: action,
        eventValue: st.event_value,
        eventName,

        A: hitA > 0 ? formatTargetCount(hitA) : UI_TEXT.dash,
        B: hitB > 0 ? formatTargetCount(hitB) : UI_TEXT.dash,

        statusA: "hit",
        statusB: "hit",
        isTargetA: hitA > 0,
        isTargetB: hitB > 0,

        note: `${st.start_cursor_id} → ${st.end_cursor_id}`,
        pos: sp.ok ? sp.pos : null,
        track: sp.ok ? (sp.track as any) : null,
        used: "normal",
        catId: null,

        stepIndex: si,
        withinStepIndex: 0,
        isHeader: true,
        isTen: true,
        isGuaranteedRow: false,

        isTarget: totalHit > 0,
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
      const track = from.ok ? (from.track as any) : null;

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
        pos != null ? safeGetNormalCatName(g, `${pos}A`) : UI_TEXT.dash;
      const normalB =
        pos != null ? safeGetNormalCatName(g, `${pos}B`) : UI_TEXT.dash;

      // 預設先用 normal 軌道當底（用來顯示另一條 lane 的對照）
      let baseA = normalA;
      let baseB = normalB;

      // 不管 used 是 normal / switch_track / guaranteed：抽到的那條 lane 一律顯示結果貓
      if (track === "A") {
        baseA = (d.cat_name || "").trim() ? d.cat_name : normalA;
      } else if (track === "B") {
        baseB = (d.cat_name || "").trim() ? d.cat_name : normalB;
      } else {
        // 解析不到 track 的保守處理：維持你原本習慣（當作 B）
        baseB = (d.cat_name || "").trim() ? d.cat_name : normalB;
      }

      const isTarget = d.cat_id != null && targetIdSet.has(d.cat_id);

      let A = baseA;
      let B = baseB;

      let statusA: StatusKey = "normal";
      let statusB: StatusKey = "normal";
      let isTargetA = false;
      let isTargetB = false;

      if (track === "A") {
        statusA = isGuaranteed ? "guaranteed" : "hit";
        isTargetA = isTarget;
      } else if (track === "B") {
        statusB = isGuaranteed ? "guaranteed" : "hit";
        isTargetB = isTarget;
      } else {
        statusB = isGuaranteed ? "guaranteed" : "hit";
        isTargetB = isTarget;
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
        A,
        B,
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
      });
    }
  }

  return out;
}
