// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function bcGodfatDevProxy() {
  return {
    name: "bc-godfat-dev-proxy",
    configureServer(server: any) {
      server.middlewares.use("/api/bc", async (req: any, res: any) => {
        try {
          const target = "https://bc.godfat.org" + (req.url ?? "");
          const r = await fetch(target, {
            headers: {
              "user-agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
              "accept-language": "zh-TW,zh;q=0.9,en;q=0.8",
            },
          });

          res.setHeader("x-dev-proxy", "bc-godfat");
          const ct = r.headers.get("content-type");
          if (ct) res.setHeader("content-type", ct);
          res.statusCode = r.status;
          res.end(Buffer.from(await r.arrayBuffer()));
        } catch (e: any) {
          res.statusCode = 502;
          res.setHeader("content-type", "text/plain; charset=utf-8");
          res.end("bc proxy failed: " + String(e?.message ?? e));
        }
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  plugins: [react(), ...(command === "serve" ? [bcGodfatDevProxy()] : [])],
}));
