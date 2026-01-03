// src/CorsTest.tsx
import { useState } from "react";

/**
 * 測試模式：
 * - direct：前端直接抓 https://bc.godfat.org/?...
 *   很可能被 CORS 擋（瀏覽器安全限制）
 *
 * - proxy：抓自己 dev server 的 /api/bc?...（同源）
 *   再由 vite middleware 去轉抓 bc.godfat.org
 *   開發期最穩的方式
 */
type Mode = "direct" | "proxy";

/**
 * 統一組出「要 fetch 的 URL」
 * - direct：回傳完整 https://bc.godfat.org/?...
 * - proxy ：回傳 http://localhost:5173/api/bc?...
 *
 * 注意：
 * - event 可能是空字串：空就不要塞進 query（避免遠端 404）
 */
function buildFetchUrl(
  mode: Mode,
  params: {
    lang: string;
    ui: string;
    seed: string;
    count: number;
    event: string;
  }
) {
  const base =
    mode === "direct"
      ? new URL("https://bc.godfat.org/")
      : new URL("/api/bc", window.location.origin);

  base.searchParams.set("lang", params.lang);
  base.searchParams.set("ui", params.ui);

  // seed / count / event 不是每次都必要：有值才塞，減少遠端出錯機率
  const seed = params.seed.trim();
  if (seed) base.searchParams.set("seed", seed);

  if (Number.isFinite(params.count) && params.count > 0) {
    base.searchParams.set("count", String(params.count));
  }

  const ev = params.event.trim();
  if (ev) base.searchParams.set("event", ev);

  return base.toString();
}

export default function CorsTest() {
  // --- 使用者可調參數（先給合理預設） ---
  const [mode, setMode] = useState<Mode>("proxy"); // 開發期通常用 proxy
  const [lang, setLang] = useState("tw");
  const [ui, setUi] = useState("tw");
  const [seed, setSeed] = useState("1234");
  const [count, setCount] = useState<number>(50);
  const [event, setEvent] = useState(""); // ✅ 預設先空，避免用過期 event 造成 404

  // --- 輸出狀態 ---
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");

  async function run() {
    setLoading(true);
    setOutput("");

    // 1) 組出要抓的 URL
    const url = buildFetchUrl(mode, { lang, ui, seed, count, event });

    try {
      // 2) 發 request
      const resp = await fetch(url, { method: "GET" });

      // 3) 把重要資訊印出來（含 proxy header，方便確認真的走 proxy）
      const ct = resp.headers.get("content-type") ?? "(no content-type)";
      const xProxy = resp.headers.get("x-dev-proxy") ?? "(none)";
      const text = await resp.text();
      const head = text.slice(0, 1200);

      setOutput(
        [
          `✅ Fetch OK`,
          `mode=${mode}`,
          `url=${url}`,
          `status=${resp.status} ${resp.statusText}`,
          `content-type=${ct}`,
          `x-dev-proxy=${xProxy}`,
          `--- body (first 1200 chars) ---`,
          head,
        ].join("\n")
      );
    } catch (e: any) {
      // direct 模式被 CORS 擋通常會來這裡：TypeError: Failed to fetch
      setOutput(
        [
          `❌ Fetch Failed`,
          `mode=${mode}`,
          `url=${url}`,
          `error=${String(e?.message ?? e)}`,
          ``,
          `提示：DevTools -> Console / Network 通常會有更完整的 CORS 訊息`,
        ].join("\n")
      );
    } finally {
      setLoading(false);
    }
  }

  // 目前 UI 做到「最少必要」
  // 之後你要改成：先抓 events -> 下拉選 event -> 再抓 tracks
  return (
    <div
      style={{
        padding: 16,
        fontFamily: "system-ui, sans-serif",
        maxWidth: 860,
      }}
    >
      <h2>bc.godfat.org 抓取測試（Direct vs Proxy）</h2>

      <div
        style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8 }}
      >
        <label>模式</label>
        <div style={{ display: "flex", gap: 12 }}>
          <label>
            <input
              type="radio"
              checked={mode === "proxy"}
              onChange={() => setMode("proxy")}
            />
            Proxy（建議）
          </label>
          <label>
            <input
              type="radio"
              checked={mode === "direct"}
              onChange={() => setMode("direct")}
            />
            Direct（可能被 CORS 擋）
          </label>
        </div>

        <label>lang</label>
        <input value={lang} onChange={(e) => setLang(e.target.value)} />

        <label>ui</label>
        <input value={ui} onChange={(e) => setUi(e.target.value)} />

        <label>seed</label>
        <input value={seed} onChange={(e) => setSeed(e.target.value)} />

        <label>count</label>
        <input
          type="number"
          value={count}
          min={1}
          onChange={(e) => setCount(Number(e.target.value))}
        />

        <label>event（可空）</label>
        <input
          value={event}
          onChange={(e) => setEvent(e.target.value)}
          placeholder="先留空，下一步會做『抓 events 下拉選』"
        />
      </div>

      <div style={{ marginTop: 12 }}>
        <button
          onClick={run}
          disabled={loading}
          style={{ padding: "8px 12px" }}
        >
          {loading ? "測試中..." : "開始測試"}
        </button>
      </div>

      <pre
        style={{
          marginTop: 12,
          padding: 12,
          background: "#111",
          color: "#eee",
          whiteSpace: "pre-wrap",
          borderRadius: 8,
          minHeight: 120,
        }}
      >
        {output || "（尚未執行）"}
      </pre>

      <p style={{ color: "#666" }}>
        小技巧：Proxy 成功時通常會看到 <code>x-dev-proxy=bc-godfat</code>。
        Direct 模式若失敗，多半是瀏覽器 CORS 限制。
      </p>
    </div>
  );
}
