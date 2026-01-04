export type CatTier = "rare" | "super" | "uber" | "legendary";
export type UiCat = { id: number; name: string; tier?: CatTier };
export type TierGroup = { tier: CatTier; cats: UiCat[] };

export function tierLabel(t: CatTier): string {
  if (t === "rare") return "Rare";
  if (t === "super") return "Super";
  if (t === "uber") return "Uber";
  return "Legendary";
}

// Legendary > Uber > Super > Rare
export function tierOrder(t: CatTier): number {
  if (t === "legendary") return 0;
  if (t === "uber") return 1;
  if (t === "super") return 2;
  return 3;
}
