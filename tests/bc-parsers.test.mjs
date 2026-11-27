import assert from "node:assert/strict";
import { unlink } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { build } from "esbuild";

const require = createRequire(import.meta.url);

async function loadParser(name, path) {
  const outfile = join(tmpdir(), `bc-${name}-${process.pid}.cjs`);
  await build({ entryPoints: [path], outfile, bundle: true, platform: "node", format: "cjs" });
  const parser = require(outfile);
  await unlink(outfile);
  return parser;
}

const { parseEventsFromHomeHtml } = await loadParser("events-parser", "netlify/functions/_lib/parseEvents.ts");
const { parseEventCatsFromHtml } = await loadParser("cats-parser", "netlify/functions/_lib/parseEventCats.ts");
const { findTracksTable, parseTrackCellsFromTableHtml } = await loadParser("track-parser", "netlify/functions/_lib/parseTrackTable.ts");

const html = `
  <select class="events">
    <optgroup label="Upcoming:"><option value="pool-one">2026-09-25 ~ 2026-09-27: 測試轉蛋</option></optgroup>
    <optgroup label="Past:"><option value="pool-old">2026-09-01: 白金轉蛋</option></optgroup>
  </select>
  <select id="last_select">
    <optgroup label="Rare"><option value="38">跳跳貓</option><option value="38">跳跳貓</option></optgroup>
    <optgroup label="Uber"><option value="77">雷神珊迪亞</option></optgroup>
  </select>
  <table><tr><th>無關資料</th></tr></table>
  <table><tr><th>normal</th><th>alt</th><th>guaranteed</th></tr>
    <tr><td class="rare" onclick="pick('1A')"><a href="/cats/38" title="測試說明">跳跳貓</a> -&gt; 2A</td></tr>
  </table>
`;

test("固定 HTML 的活動解析維持日期、名稱與卡池類型", () => {
  const upcoming = parseEventsFromHomeHtml(html, "upcoming");
  const past = parseEventsFromHomeHtml(html, "past");
  assert.deepEqual(upcoming.map((event) => [event.value, event.name, event.start_date, event.end_date, event.pool_type]), [
    ["pool-one", "測試轉蛋", "2026-09-25", "2026-09-27", "normal"],
  ]);
  assert.deepEqual(past.map((event) => [event.value, event.pool_type]), [["pool-old", "platinum"]]);
});

test("固定 HTML 的貓咪解析維持稀有度與 ID 去重", () => {
  const parsed = parseEventCatsFromHtml(html);
  assert.equal(parsed.source, "last_select");
  assert.deepEqual(parsed.cats.map((cat) => [cat.id, cat.tier]), [[38, "rare"], [77, "uber"]]);
  assert.deepEqual(parsed.groups.map((group) => group.cats.length), [1, 1]);
});

test("固定 HTML 的軌道解析選取正確表格並保留貓咪與跳轉", () => {
  const { tableHtml } = findTracksTable(html);
  assert.ok(tableHtml?.includes("pick('1A')"));
  const cells = parseTrackCellsFromTableHtml(tableHtml);
  assert.deepEqual([cells["1A"].cat.id, cells["1A"].rarity, cells["1A"].jump_to], [38, "rare", "2A"]);
});

test("2026-11 改版後的軌道 HTML（pick 帶 event 參數、minor/major 稀有度、score 欄）仍可解析", () => {
  const tableHtml = `
    <table><tr><th>No.</th><th>Result</th><th>Guaranteed</th><th>Alt. result</th><th>Alt. guaranteed</th></tr>
      <tr>
        <td class="position score pick minor_rare major_rare" onclick="pick('1AX', event)"></td>
        <td class="position score pick minor_rare major_rare" onclick="pick('1AGX', event)"></td>
      </tr>
      <tr>
        <td class="position cat pick minor_supa_fest major_supa_fest" onclick="pick('1A', event)">
          <span><a href="//bc.godfat.org/tracks?seed=1&amp;last=84" title="說明">地龍索多姆</a> <a href="//bc.godfat.org/cats/84?seed=1">🐾</a></span>
        </td>
        <td class="position cat pick minor_rare major_rare" onclick="pick('1AG', event)">
          <span><a href="//bc.godfat.org/tracks?seed=2&amp;last=43">冰雪貓</a> <a href="//bc.godfat.org/cats/43?seed=1">🐾</a> -&gt; 11B</span>
        </td>
      </tr>
    </table>`;
  const cells = parseTrackCellsFromTableHtml(tableHtml);
  assert.deepEqual(Object.keys(cells).sort(), ["1A", "1AG"]);
  assert.deepEqual([cells["1A"].cat.id, cells["1A"].cat.name, cells["1A"].rarity], [84, "地龍索多姆", "supa_fest"]);
  assert.deepEqual([cells["1AG"].cat.id, cells["1AG"].rarity, cells["1AG"].jump_to], [43, "rare", "11B"]);
});
