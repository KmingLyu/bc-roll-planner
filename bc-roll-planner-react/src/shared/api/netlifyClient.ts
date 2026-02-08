// src/shared/api/netlifyClient.ts
type Query = Record<string, string | number | boolean | null | undefined>;

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

function toQueryString(q: Query): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    // 擋掉 undefined 和 null
    if (v === null || v === undefined) continue;
    usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

/**
 * Netlify Functions 在 dev / prod 都可用同一路徑
 * - /.netlify/functions/events
 * - /.netlify/functions/trackGraph
 */
export async function netlifyGet<T>(
  fnName: string,
  query: Query = {},
  init?: RequestInit
): Promise<T> {
  const url = `/.netlify/functions/${fnName}${toQueryString(query)}`;
  const resp = await fetch(url, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const text = await resp.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!resp.ok) {
    const msg =
      (payload as any)?.error ||
      (payload as any)?.message ||
      `HTTP ${resp.status}`;
    throw new ApiError(msg, resp.status, payload);
  }

  return payload as T;
}
