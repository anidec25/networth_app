export const ASSET_CATEGORIES = [
  "Cash",
  "Bank",
  "Investments",
  "Retirement",
  "Real Estate",
  "Vehicle",
  "Other",
] as const;

export const LIABILITY_CATEGORIES = [
  "Credit Card",
  "Mortgage",
  "Student Loan",
  "Personal Loan",
  "Auto Loan",
  "Other",
] as const;

export type AssetCategory = (typeof ASSET_CATEGORIES)[number];
export type LiabilityCategory = (typeof LIABILITY_CATEGORIES)[number];

export type AssetEntry = {
  id: string;
  name: string;
  category: AssetCategory;
  value: number;
  updatedAt: string;
};

export type LiabilityEntry = {
  id: string;
  name: string;
  category: LiabilityCategory;
  value: number;
  apr?: number;
  dueDate?: string;
  updatedAt: string;
};

export type Snapshot = {
  date: string;
  totalAssets: number;
  totalLiabilities: number;
  assetCategoryTotals?: Partial<Record<AssetCategory, number>>;
};

export type AppState = {
  assets: AssetEntry[];
  liabilities: LiabilityEntry[];
  snapshots: Snapshot[];
};
