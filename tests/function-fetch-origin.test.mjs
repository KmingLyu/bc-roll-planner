import assert from "node:assert/strict";
import { unlink } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { build } from "esbuild";

const require = createRequire(import.meta.url);

for (const name of ["events", "eventCats", "trackGraph"]) {
  test(`${name} fetches only the configured origin`, async () => {
    const originalFetch = globalThis.fetch;
    const originalBaseUrl = process.env.BC_GODFAT_BASE_URL;
    const outfile = join(tmpdir(), `bc-${name}-origin-test-${process.pid}.cjs`);

    try {
      process.env.BC_GODFAT_BASE_URL = "https://bc.godfat.org";
      await build({
        entryPoints: [`netlify/functions/${name}.ts`],
        outfile,
        bundle: true,
        platform: "node",
        format: "cjs",
      });
      const { handler } = require(outfile);
      const requested = [];
      globalThis.fetch = async (url) => {
        requested.push(String(url));
        return new Response("", { status: 200 });
      };

      await handler({
        httpMethod: "GET",
        queryStringParameters: {
          base_url: "http://127.0.0.1:9999",
          event: "test",
          seed: "123",
          count: "1",
        },
      });

      assert.equal(requested.length, 1);
      assert.equal(new URL(requested[0]).origin, "https://bc.godfat.org");
    } finally {
      globalThis.fetch = originalFetch;
      await unlink(outfile).catch(() => {});
      if (originalBaseUrl === undefined) delete process.env.BC_GODFAT_BASE_URL;
      else process.env.BC_GODFAT_BASE_URL = originalBaseUrl;
    }
  });
}
