export type FetchOptions = {
  timeoutMs?: number;
  retries?: number;
  backoffMs?: number;
  headers?: Record<string, string>;
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchTextWithRetry(
  url: string,
  opt: FetchOptions = {}
): Promise<string> {
  const timeoutMs = opt.timeoutMs ?? 30_000;
  const retries = opt.retries ?? 3;
  const backoffMs = opt.backoffMs ?? 600;

  // 預設 header（模仿瀏覽器 + zh-TW）
  const headers: HeadersInit = {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Accept-Language": "zh-TW,zh;q=0.9",
    ...(opt.headers ?? {}),
  };

  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resp = await fetch(url, {
        method: "GET",
        headers,
        signal: controller.signal,
      });

      // 429 / 5xx：通常可重試
      if (!resp.ok) {
        const body = await resp.text().catch(() => "");
        const msg = `HTTP ${resp.status} ${
          resp.statusText
        } url=${url} body=${body.slice(0, 200)}`;
        if (attempt < retries && (resp.status === 429 || resp.status >= 500)) {
          await sleep(backoffMs * Math.pow(2, attempt));
          continue;
        }
        throw new Error(msg);
      }

      return await resp.text();
    } catch (e) {
      lastErr = e;
      if (attempt < retries) {
        await sleep(backoffMs * Math.pow(2, attempt));
        continue;
      }
      throw lastErr;
    } finally {
      clearTimeout(t);
    }
  }

  throw lastErr ?? new Error("fetchTextWithRetry failed");
}
