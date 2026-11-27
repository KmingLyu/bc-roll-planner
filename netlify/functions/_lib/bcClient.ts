import { getBcServerEnv } from "./env";
import { fetchTextWithRetry } from "./http";

export async function fetchBcHtml(params: {
  query: Record<string, string>;
  lang?: string | null;
  ui?: string | null;
}): Promise<string> {
  const env = getBcServerEnv();
  const url = new URL(`${env.baseUrl}/`);
  url.searchParams.set("lang", params.lang?.trim() || env.lang);
  url.searchParams.set("ui", params.ui?.trim() || env.ui);
  for (const [key, value] of Object.entries(params.query)) {
    url.searchParams.set(key, value);
  }
  return fetchTextWithRetry(url.toString(), { timeoutMs: 30_000, retries: 3 });
}
