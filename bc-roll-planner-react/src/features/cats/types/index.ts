export type CatTier = "rare" | "super" | "uber" | "legendary";

export function tierOrder(t: CatTier): number {
  if (t === "legendary") return 0;
  if (t === "uber") return 1;
  if (t === "super") return 2;
  return 3;
}

export type UiCat = {
  id: number;
  name: string;
  tier?: CatTier;
};

export type TierGroup = {
  tier: CatTier;
  cats: UiCat[];
};

