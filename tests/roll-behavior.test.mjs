import assert from "node:assert/strict";
import { unlink } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { build } from "esbuild";

const require = createRequire(import.meta.url);

async function loadModule(name, entryPoint) {
  const outfile = join(tmpdir(), `bc-${name}-${process.pid}.cjs`);
  await build({ entryPoints: [entryPoint], outfile, bundle: true, platform: "node", format: "cjs" });
  const module = require(outfile);
  await unlink(outfile);
  return module;
}

const { simulateOnGraph, SimulationError } = await loadModule("simulator", "src/features/simulator/simulator.ts");
const { planMinCost } = await loadModule("planner", "src/features/planner/logic/core.ts");

function cat(id) { return { id, name: `cat-${id}` }; }

function graph({ stepUp = false } = {}) {
  const nodes = {};
  for (let pos = 1; pos <= 45; pos += 1) {
    for (const track of ["A", "B"]) {
      const id = `${pos}${track}`;
      const catId = track === "A" ? pos + 100 : pos + 200;
      nodes[id] = {
        id, pos, track,
        edges: {
          normal: { action: "normal", to: `${pos + 1}${track}`, cat: cat(catId), rolls: 1, advance: 1, cost_rolls: 1 },
        },
      };
    }
  }
  nodes[2 + "A"].edges.normal.cat = cat(101);
  nodes["2A"].edges.switch_track = {
    action: "switch_track", to: "3B", cat: cat(301), rolls: 1, advance: 1, cost_rolls: 1,
  };
  if (!stepUp) {
    nodes["1A"].edges.guaranteed = {
      action: "guaranteed", to: "11B", cat: cat(901), rolls: 11, advance: 10, cost_rolls: 11,
    };
    nodes["1B"].edges.guaranteed = {
      action: "guaranteed", to: "12A", cat: cat(902), rolls: 11, advance: 11, cost_rolls: 11,
    };
  }
  const raw_cells = stepUp ? {
    "1AG": { pick_id: "1AG", pos: 1, track: "A", suffix: "G", cat: cat(903), jump_to: "16B" },
  } : {};
  return {
    seed: "fixture", count: 45,
    event: { value: "fixture", name: stepUp ? "好康轉蛋活動中" : "標準卡池", raw_name: "fixture", pool_type: "normal" },
    nodes, raw_cells,
  };
}

function actions(...methods) { return methods.map((method) => ({ event_value: "fixture", method })); }

test("重複貓咪的第二抽換到 B 軌", () => {
  const result = simulateOnGraph({ graph: graph(), actions: actions("single", "single") });
  assert.deepEqual(result.records.map((r) => [r.used, r.cat_id, r.to_pos_id]), [
    ["normal", 101, "2A"], ["switch_track", 301, "3B"],
  ]);
  assert.equal(result.final_cursor.id, "3B");
});

test("模擬器的資料缺漏仍回報 SimulationError", () => {
  const fixture = graph();
  delete fixture.nodes["1A"].edges.normal;
  assert.throws(
    () => simulateOnGraph({ graph: fixture, actions: actions("single") }),
    SimulationError,
  );
});

test("A 軌十連的第 11 抽使用保底並落在 11B", () => {
  const result = simulateOnGraph({ graph: graph(), actions: actions("ten") });
  assert.equal(result.records.length, 11);
  assert.deepEqual([result.records[10].used, result.records[10].cat_id, result.final_cursor.id], ["guaranteed", 901, "11B"]);
});

test("B 軌十連的保底落在 12A", () => {
  const result = simulateOnGraph({ graph: graph(), actions: actions("ten"), start_pos_id: "1B" });
  assert.deepEqual([result.records[10].used, result.records[10].cat_id, result.final_cursor.id], ["guaranteed", 902, "12A"]);
});

test("沒有保底時第 11 抽沿用單抽規則", () => {
  const result = simulateOnGraph({ graph: graph({ stepUp: true }), actions: actions("ten"), start_pos_id: "3A" });
  assert.deepEqual([result.records[10].used, result.records[10].from_pos_id, result.final_cursor.id], ["normal", "13A", "14A"]);
});

test("模擬器在保底落點缺失時維持換軌後備行為", () => {
  const fixture = graph();
  fixture.nodes["1A"].edges.guaranteed.to = "";
  const result = simulateOnGraph({ graph: fixture, actions: actions("ten") });
  assert.equal(result.final_cursor.id, "12A");
});

test("好康 3→5→7 的最後一抽取 AG 保底", () => {
  const result = simulateOnGraph({ graph: graph({ stepUp: true }), actions: actions("step_up_3", "step_up_5", "step_up_7") });
  assert.equal(result.records.length, 15);
  assert.deepEqual([result.records[14].used, result.records[14].cat_id, result.final_cursor.id], ["guaranteed", 903, "16B"]);
});

test("規劃器在一張固定圖上找到單抽目標", () => {
  const result = planMinCost({
    graphs_by_event: { fixture: graph() }, events: [{ event_value: "fixture" }], target_cats: [101],
    tickets: 1, platinum_tickets: 0, legend_tickets: 0, food: 0,
  });
  assert.equal(result.success, true);
  assert.deepEqual(result.plan.map((step) => [step.method, step.resource, step.end_cursor_id]), [["single", "ticket", "2A"]]);
  assert.deepEqual(result.targets_hit_ids, [101]);
});

test("規劃器使用 B 軌十連保底取得目標", () => {
  const result = planMinCost({
    graphs_by_event: { fixture: graph() }, events: [{ event_value: "fixture" }], target_cats: [902],
    tickets: 0, platinum_tickets: 0, legend_tickets: 0, food: 1500, start_pos_id: "1B",
  });
  assert.equal(result.success, true);
  assert.deepEqual(result.plan.map((step) => [step.method, step.draws.length, step.end_cursor_id]), [["ten", 11, "12A"]]);
});

test("規劃器完成好康轉蛋 3→5→7", () => {
  const result = planMinCost({
    graphs_by_event: { fixture: graph({ stepUp: true }) }, events: [{ event_value: "fixture" }], target_cats: [903],
    tickets: 0, platinum_tickets: 0, legend_tickets: 0, food: 2100,
  });
  assert.equal(result.success, true);
  assert.deepEqual(result.plan.map((step) => step.method), ["step_up_3", "step_up_5", "step_up_7"]);
  assert.deepEqual([result.final_cursor_id, result.food_used], ["16B", 2100]);
});
