// src/domain/utils.ts
import type { Track } from "@/shared/models";

/**
 * Cursor（前端 core 用的最小版本）
 */
export type Cursor = {
  pos: number;
  track: Track;
  id: string; // `${pos}${track}`
};

const PICK_ID_RE = /^(\d+)([AB])(.*)$/;

/**
 * 解析像 "3A", "3AG", "3AR" 這類 pick_id
 * 回傳 (pos, track, suffix)
 */
export function parsePickId(pickId: string): {
  pos: number;
  track: Track;
  suffix: string;
} {
  const m = PICK_ID_RE.exec(String(pickId || "").trim());
  if (!m) throw new Error(`Invalid pick_id: ${pickId}`);
  const pos = Number(m[1]);
  const track = m[2] as Track;
  const suffix = m[3] || "";
  return { pos, track, suffix };
}

/**
 * 解析位置字串（只能是 base：例如 "3A"/"15B"）
 * - suffix 不允許
 */
export function parsePosId(posId: string): Cursor {
  const { pos, track, suffix } = parsePickId(posId);
  if (suffix) throw new Error(`Invalid pos_id (suffix not allowed): ${posId}`);
  return { pos, track, id: `${pos}${track}` };
}

export function makeCursor(pos: number, track: Track): Cursor {
  return { pos, track, id: `${pos}${track}` };
}
