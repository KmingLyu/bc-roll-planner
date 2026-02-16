export type CatTier = "rare" | "super" | "uber" | "legendary";

export type UiCat = {
  id: number;
  name: string;
  tier?: CatTier;
};

export type TierGroup = {
  tier: CatTier;
  cats: UiCat[];
};

