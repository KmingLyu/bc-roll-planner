import assert from "node:assert/strict";
import { unlink } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { build } from "esbuild";

const outfile = join(tmpdir(), `bc-http-test-${process.pid}.cjs`);
await build({ entryPoints: ["netlify/functions/_lib/http.ts"], outfile, bundle: true, platform: "node", format: "cjs" });
const { fetchTextWithRetry } = createRequire(import.meta.url)(outfile);
await unlink(outfile);

test("404 不重試遠端請求", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => { calls += 1; return new Response("missing", { status: 404 }); };
    await assert.rejects(fetchTextWithRetry("https://bc.godfat.org/", { retries: 3, backoffMs: 0 }));
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("503 會重試並在成功後回傳內容", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => {
      calls += 1;
      return calls === 1 ? new Response("busy", { status: 503 }) : new Response("ready", { status: 200 });
    };
    assert.equal(await fetchTextWithRetry("https://bc.godfat.org/", { retries: 3, backoffMs: 0 }), "ready");
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
