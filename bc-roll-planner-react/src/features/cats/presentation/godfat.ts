const BCGODFAT_BASE_URL = "https://bc.godfat.org";

function normalizeLocale(value?: string) {
  if (value === "jp" || value === "kr" || value === "tw") return value;
  return "en";
}

export function buildGodfatCatHref(
  catId: number,
  options?: {
    lang?: string;
    ui?: string;
  },
) {
  if (!Number.isFinite(catId) || catId <= 0) return undefined;

  const url = new URL(`/cats/${Math.floor(catId)}`, BCGODFAT_BASE_URL);
  const lang = normalizeLocale(options?.lang);

  url.searchParams.set("lang", lang);
  if (options?.ui) {
    url.searchParams.set("ui", options.ui);
  }

  return url.toString();
}

export function buildGodfatCatImageUrl(
  catId: number,
  options?: {
    lang?: string;
  },
) {
  if (!Number.isFinite(catId) || catId <= 0) return undefined;

  const lang = normalizeLocale(options?.lang);
  const assetId = Math.max(0, Math.floor(catId) - 1);

  return `${BCGODFAT_BASE_URL}/extract/${lang}/uni${assetId}_f00.png`;
}
