// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * 目的：在「開發環境」提供一個同源 API：/api/bc
 * - 前端打 http://localhost:5173/api/bc?...（同源，不會被 CORS 擋）
 * - Vite dev server middleware 代你去抓 https://bc.godfat.org?... 再把內容回傳
 *
 * 注意：
 * - 這是 dev-only。正式部署時你可能會改成 Cloudflare Worker / Vercel / Node server。
 */
export default defineConfig({
  plugins: [
    react(),

    {
      name: "bc-godfat-dev-proxy",
      configureServer(server) {
        server.middlewares.use("/api/bc", async (req, res) => {
          try {
            // req.url 在這個 middleware 內通常長這樣：
            //   "?lang=tw&ui=tw&seed=1234&count=50&event=..."
            // 我們把它直接接到 bc.godfat.org 後面
            const target = "https://bc.godfat.org" + (req.url ?? "");

            // 給你在終端機確認 request 有進來
            console.log("[bc-proxy] ->", target);

            // Node 18+ 內建 fetch，可直接使用
            const upstream = await fetch(target, {
              method: "GET",
              headers: {
                // 某些站會依 UA / 語系回不同內容，這裡固定給常見值
                "user-agent":
                  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
                "accept-language": "zh-TW,zh;q=0.9,en;q=0.8",
              },
            });

            // 加一個標記，前端可用來確認「真的走 proxy」
            res.setHeader("x-dev-proxy", "bc-godfat");

            // 至少把 content-type 帶回去（不然前端可能誤判）
            const ct = upstream.headers.get("content-type");
            if (ct) res.setHeader("content-type", ct);

            // 開發期避免快取造成看不到最新結果
            res.setHeader("cache-control", "no-store");

            // 讀取上游 body，原封不動回傳
            const buf = Buffer.from(await upstream.arrayBuffer());
            res.statusCode = upstream.status;
            res.end(buf);
          } catch (err: any) {
            // upstream 掛掉 / 網路問題 / 其他例外會進這裡
            console.error("[bc-proxy] error:", err?.message ?? err);
            res.statusCode = 502;
            res.setHeader("content-type", "text/plain; charset=utf-8");
            res.end("bc proxy failed: " + String(err?.message ?? err));
          }
        });
      },
    },
  ],
});
