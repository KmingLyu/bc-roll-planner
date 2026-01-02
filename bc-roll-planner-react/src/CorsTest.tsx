// src/CorsTest.tsx
import React, { useState } from "react";

/**
 * 方案 A（純前端、無後端、無 proxy）：
 * - 永遠直接抓 https://bc.godfat.org/?...
 * - 上線到 Netlify 後，如果被 CORS 擋，fetch 會直接失敗（TypeError: Failed to fetch）
 *   這是瀏覽器同源政策，前端無法解決，只能改用：
 *   - 方案 B（Netlify redirect / proxy）
 *   - 或提供「匯入 HTML / 匯入 TrackGraph JSON」的替代方案
 */
function buildGodfatUrl(params: {
  lang: string;
  ui: string;
  seed: string;
  count: number;
  event: string;
}) {
  const u = new URL("https://bc.godfat.org/");

  // 必要參數：lang/ui
  u.searchParams.set("lang", params.lang);
  u.searchParams.set("ui", params.ui);

  // 以下參數可選：有值才塞，避免無效參數導致遠端回 404
  const seed = params.seed.trim();
  if (seed) u.searchParams.set("seed", seed);

  if (Number.isFinite(params.count) && params.count > 0) {
    u.searchParams.set("count", String(params.count));
  }

  const ev = params.event.trim();
  if (ev) u.searchParams.set("event", ev);

  return u.toString();
}

export default function CorsTest() {
  // 使用者可調參數
  const [lang, setLang] = useState("tw");
  const [ui, setUi] = useState("tw");
  const [seed, setSeed] = useState("1234");
  const [count, setCount] = useState<number>(50);
  const [event, setEvent] = useState(""); // 建議先空：避免你填的 event 過期造成 404

  // 輸出狀態
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState("");

  async function run() {
    setLoading(true);
    setOutput("");

    // 1) 組出 direct URL
    const url = buildGodfatUrl({ lang, ui, seed, count, event });

    try {
      // 2) 直接 fetch（上線後是否會被 CORS 擋，就看這一行）
      const resp = await fetch(url, { method: "GET" });

      // 3) 印出狀態與前 1200 字（幫你判斷抓到的是不是正確頁面）
      const ct = resp.headers.get("content-type") ?? "(no content-type)";
      const text = await resp.text();
      const head = text.slice(0, 1200);

      setOutput(
        [
          `✅ Fetch OK (Direct)`,
          `url=${url}`,
          `status=${resp.status} ${resp.statusText}`,
          `content-type=${ct}`,
          `--- body (first 1200 chars) ---`,
          head,
        ].join("\n")
      );
    } catch (e: any) {
      // CORS 被擋通常會來這裡（瀏覽器會阻止你讀取 response）
      setOutput(
        [
          `❌ Fetch Failed (Direct)`,
          `url=${url}`,
          `error=${String(e?.message ?? e)}`,
          ``,
          `可能原因：CORS（瀏覽器同源政策）`,
          `建議：`,
          `- 之後改方案 B：用 Netlify redirects 做 /api/bc proxy`,
          `- 或實作匯入模式：貼 HTML / 上傳 TrackGraph JSON`,
        ].join("\n")
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        padding: 16,
        fontFamily: "system-ui, sans-serif",
        maxWidth: 860,
      }}
    >
      <h2>bc.godfat.org Direct 抓取測試（方案 A）</h2>

      <div
        style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8 }}
      >
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
          placeholder="可先留空；下一步再做 events 下拉選"
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
        如果上線到 Netlify 後 Direct 失敗且 DevTools 顯示
        CORS，代表純前端無法直抓。 那時再改方案 B（Netlify redirects
        proxy）或做匯入模式即可。
      </p>
    </div>
  );
}
