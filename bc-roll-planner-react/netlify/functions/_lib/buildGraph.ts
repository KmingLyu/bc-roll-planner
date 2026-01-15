import type {
  ActionType,
  Edge,
  Event,
  PickCell,
  PositionNode,
  TrackGraph,
  Track,
  Rarity,
} from "../../../shared/models";
import {
  inferGuaranteedTo,
  nextPosId,
  otherTrack,
} from "../../../shared/models";

function normalizeRarity(r: string | null | undefined): Rarity | null {
  if (!r) return null;
  return (["rare", "supa", "uber_fest", "supa_fest"] as const).includes(
    r as any
  )
    ? (r as Rarity)
    : null;
}

export function buildTrackGraphFromCells(args: {
  seed: string;
  count: number;
  event: Event;
  raw_cells: Record<string, PickCell>;
}): TrackGraph {
  const { seed, count, event, raw_cells } = args;
  // console.log("raw_cells", raw_cells);

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
    const track = baseCell.track as Track;

    const edges: Partial<Record<ActionType, Edge>> = {};

    // normal
    edges.normal = {
      action: "normal",
      to: nextPosId(pos, track),
      cat: baseCell.cat ?? null,
      rolls: 1,
      advance: 1,
      cost_rolls: 1,
      note: "normal roll",
      // ref_from: baseCell.ref_from ?? null,
      source_pick_id: baseId,
    };

    // guaranteed (G)
    const gId = `${baseId}G`;
    const gCell = raw_cells[gId];
    if (gCell?.cat) {
      const to = (
        gCell.jump_to ||
        // gCell.ref_from ||
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
          : // : gCell.ref_from
            // ? `guaranteed (ref_from ${gCell.ref_from})`
            "guaranteed (inferred)",
        // ref_from: gCell.ref_from ?? null,
        source_pick_id: gId,
      };
    }

    // switch_track (R)
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
        // ref_from: rCell.ref_from ?? null,
        source_pick_id: rId,
      };
    }

    nodes[baseId] = {
      id: baseId,
      pos,
      track,
      rarity: normalizeRarity(baseCell.rarity ?? null),
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
