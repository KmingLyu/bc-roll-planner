/**
 * shared/models.ts
 *
 * 前端 /Functions 共用型別（單一真實來源）
 * 命名完全對齊目前 functions 的 JSON 欄位：
 *    - graph.nodes
 *    - graph.raw_cells
 *    - PickCell.pick_id / jump_to / ref_from
 *
 * 注意：
 * - 這裡只放「資料結構」與少量不會引入其他模組的 helper
 * - 不要在 shared 引入 netlify/functions 或 cheerio，避免循環與環境耦合
 */

// -------------------------
// Domain models
// -------------------------

export type CatTier = "rare" | "super" | "uber" | "legendary";

export type Cat = {
  id: number;
  name: string;
  desc?: string;

  // 貓咪本身稀有度（來自 select optgroup label）
  // - tracks table 解析出來的 cat 可能沒有 tier，因此設成 optional
  tier?: CatTier;
};

export type Event = {
  value: string;
  name: string;
  start_date?: string | null;
  end_date?: string | null;
};

// - normal: 單抽
// - guaranteed: 10 連保底+1(會換線)
// - switch_track: 換線(因為重複貓咪導致)
export type ActionType = "normal" | "guaranteed" | "switch_track";

// 注意這裡的「稀有度」是序列/格子設定，不是貓本身稀有度
export type Rarity = "rare" | "supa" | "uber_fest" | "supa_fest";

export type Edge = {
  action: ActionType;
  to: string;
  cat?: Cat | null;

  rolls: number;
  advance: number;

  cost_rolls: number; // 你目前 functions 仍保留

  note?: string;
  ref_from?: string | null;
  source_pick_id?: string | null; // e.g. "3AG" / "3AR"
};

export type PositionNode = {
  id: string; // "3A"
  pos: number;
  track: "A" | "B";
  rarity?: Rarity | null;

  // JSON 會長這樣：edges.normal / edges.guaranteed / edges.switch_track
  edges: Partial<Record<ActionType, Edge>>;
};

export type PickCell = {
  pick_id: string; // e.g. "3A", "3AG", "3AR", "3ARG"
  pos: number;
  track: "A" | "B";
  suffix: string; // "", "G", "R", "RG", "X"...（我們主要用到 "", "G", "R", "RG"）
  rarity?: string | null;

  cat?: Cat | null;

  jump_to?: string | null; // "13B"
  ref_from?: string | null; // "12A"
};

export type TrackGraph = {
  seed: string;
  count: number;
  event: Event;

  nodes: Record<string, PositionNode>;
  raw_cells: Record<string, PickCell>;
};

// -------------------------
// Small helpers (safe to share)
// -------------------------

export type Track = "A" | "B";

export function otherTrack(track: Track): Track {
  return track === "A" ? "B" : "A";
}

export function nextPosId(pos: number, track: Track): string {
  return `${pos + 1}${track}`;
}

export function inferGuaranteedTo(pos: number, track: Track): string {
  // bc.godfat 的 11 連（含保底）通常前進 10 格並換線
  // nA -> (n+10)B
  // nB -> (n+10)A
  return `${pos + 10}${otherTrack(track)}`;
}
