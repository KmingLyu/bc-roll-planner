import assert from "node:assert/strict";
import { unlink } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { build } from "esbuild";

const outfile = join(tmpdir(), `bc-result-groups-${process.pid}.cjs`);
await build({ entryPoints: ["src/features/planner/logic/view-model.ts"], outfile, bundle: true, platform: "node", format: "cjs" });
const { buildResultGroups, buildHitStepStats } = createRequire(import.meta.url)(outfile);
await unlink(outfile);

const rows = [
  { key: "header", eventValue: "event-a", stepIndex: 0, isBundle: true, isHeader: true, isTarget: false, isVirtual: false },
  { key: "miss", eventValue: "event-a", stepIndex: 0, isBundle: true, isHeader: false, isTarget: false, isVirtual: false },
  { key: "hit", eventValue: "event-a", stepIndex: 0, isBundle: true, isHeader: false, isTarget: true, isVirtual: false },
  { key: "virtual", eventValue: "event-a", stepIndex: 1, isBundle: false, isHeader: false, isTarget: false, isVirtual: true },
  { key: "second-event", eventValue: "event-b", stepIndex: 2, isBundle: false, isHeader: false, isTarget: true, isVirtual: false },
];

test("桌面保留虛擬行，手機排除虛擬行", () => {
  const { desktopGroups, mobileGroups } = buildResultGroups(rows, "all");
  assert.deepEqual(desktopGroups.flatMap((group) => group.blocks.map((block) => block.key)), ["header", "virtual", "second-event"]);
  assert.deepEqual(mobileGroups.flatMap((group) => group.blocks.map((block) => block.key)), ["header", "second-event"]);
});

test("目標篩選保留含目標的組合及命中的子行", () => {
  const { desktopGroups, mobileGroups } = buildResultGroups(rows, "targets");
  assert.deepEqual(desktopGroups.map((group) => group.eventValue), ["event-a", "event-b"]);
  assert.deepEqual(mobileGroups[0].blocks[0].children.map((row) => row.key), ["hit"]);
});

test("同一步驟命中多隻目標仍只算一步", () => {
  const stats = buildHitStepStats({
    result: { plan: [{ draws: [{ cat_id: 1 }, { cat_id: 2 }] }, { draws: [{ cat_id: 3 }] }] },
    targetCatIds: [1, 2],
  });
  assert.deepEqual(stats, { hitSteps: 1, totalSteps: 2 });
});
