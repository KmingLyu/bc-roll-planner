export type ActionType = "normal" | "guaranteed" | "switch_track";
export type Rarity = "rare" | "supa" | "uber_fest" | "supa_fest";

export type Cat = {
  id: number;
  name: string;
  desc?: string;
};

export type Event = {
  value: string;
  name: string;
  start_date?: string | null;
  end_date?: string | null;
};

export type Edge = {
  action: ActionType;
  to: string;
  cat?: Cat | null;

  rolls: number;
  advance: number;
  cost_rolls: number;

  note?: string;
  ref_from?: string | null;
  source_pick_id?: string | null;
};

export type PositionNode = {
  id: string;
  pos: number;
  track: "A" | "B";
  rarity?: Rarity | null;
  edges: Record<ActionType, Edge>;
};

export type PickCell = {
  pick_id: string; // e.g. "3A", "3AG", "3AR", "3ARG"
  pos: number;
  track: "A" | "B";
  suffix: string; // "", "G", "R", "RG", ...
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

export function otherTrack(track: "A" | "B"): "A" | "B" {
  return track === "A" ? "B" : "A";
}

export function nextPosId(pos: number, track: "A" | "B"): string {
  return `${pos + 1}${track}`;
}

export function inferGuaranteedTo(pos: number, track: "A" | "B"): string {
  // bc.godfat 的 11 連（含保底）通常前進 10 格並換線
  return `${pos + 10}${otherTrack(track)}`;
}

export function buildTrackGraphFromCells(args: {
  seed: string;
  count: number;
  event: Event;
  raw_cells: Record<string, PickCell>;
}): TrackGraph {
  const { seed, count, event, raw_cells } = args;

  // base ids：suffix=="" 的 "nA"/"nB"
  const baseIds = Object.keys(raw_cells)
    .filter((pid) => {
      const c = raw_cells[pid];
      return c && c.suffix === "" && (c.track === "A" || c.track === "B");
    })
    .sort((a, b) => {
      const ca = raw_cells[a];
      const cb = raw_cells[b];
      if (ca.pos !== cb.pos) return ca.pos - cb.pos;
      return ca.track.localeCompare(cb.track);
    });

  const nodes: Record<string, PositionNode> = {};

  for (const baseId of baseIds) {
    const baseCell = raw_cells[baseId];
    const pos = baseCell.pos;
    const track = baseCell.track;

    const edges: Record<ActionType, Edge> = {} as any;

    // normal
    edges.normal = {
      action: "normal",
      to: nextPosId(pos, track),
      cat: baseCell.cat ?? null,
      rolls: 1,
      advance: 1,
      cost_rolls: 1,
      note: "normal roll",
      ref_from: baseCell.ref_from ?? null,
      source_pick_id: baseId,
    };

    // guaranteed：baseId + "G"
    const gId = `${baseId}G`;
    const gCell = raw_cells[gId];
    if (gCell?.cat) {
      const to = (
        gCell.jump_to ||
        gCell.ref_from ||
        inferGuaranteedTo(pos, track)
      ).trim();

      edges.guaranteed = {
        action: "guaranteed",
        to,
        cat: gCell.cat,
        rolls: 11,
        advance: 10,
        cost_rolls: 11,
        note: gCell.jump_to
          ? `guaranteed ${gCell.jump_to}`
          : gCell.ref_from
          ? `guaranteed (ref_from ${gCell.ref_from})`
          : "guaranteed (inferred)",
        ref_from: gCell.ref_from ?? null,
        source_pick_id: gId,
      };
    }

    // switch_track：baseId + "R"
    const rId = `${baseId}R`;
    const rCell = raw_cells[rId];
    if (rCell?.cat) {
      const to = (rCell.jump_to || `${pos + 1}${otherTrack(track)}`).trim();

      edges.switch_track = {
        action: "switch_track",
        to,
        cat: rCell.cat,
        rolls: 1,
        advance: 1,
        cost_rolls: 1,
        note: rCell.jump_to
          ? `switch_track ${rCell.jump_to}`
          : "switch_track (fallback)",
        ref_from: rCell.ref_from ?? null,
        source_pick_id: rId,
      };
    }

    const rarity =
      baseCell.rarity &&
      ["rare", "supa", "uber_fest", "supa_fest"].includes(baseCell.rarity)
        ? (baseCell.rarity as Rarity)
        : null;

    nodes[baseId] = {
      id: baseId,
      pos,
      track,
      rarity,
      edges,
    };
  }

  return {
    seed,
    count,
    event,
    nodes,
    raw_cells,
  };
}
