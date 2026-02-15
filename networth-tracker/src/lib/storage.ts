import type { AppState } from "@/types/finance";

const STORAGE_KEY = "networth-tracker-state-v1";

const demoState: AppState = {
  assets: [
    {
      id: "a-checking",
      name: "Primary Checking",
      category: "Bank",
      value: 12800,
      updatedAt: new Date().toISOString(),
    },
    {
      id: "a-401k",
      name: "401(k)",
      category: "Retirement",
      value: 68400,
      updatedAt: new Date().toISOString(),
    },
    {
      id: "a-home",
      name: "Home Value",
      category: "Real Estate",
      value: 440000,
      updatedAt: new Date().toISOString(),
    },
  ],
  liabilities: [
    {
      id: "l-mortgage",
      name: "Mortgage Balance",
      category: "Mortgage",
      value: 295000,
      apr: 5.1,
      updatedAt: new Date().toISOString(),
    },
    {
      id: "l-cc",
      name: "Credit Card",
      category: "Credit Card",
      value: 2100,
      apr: 22.9,
      updatedAt: new Date().toISOString(),
    },
  ],
  snapshots: [
    {
      date: "2025-10-01",
      totalAssets: 501000,
      totalLiabilities: 310000,
      assetCategoryTotals: { Bank: 10000, Retirement: 67000, "Real Estate": 424000 },
    },
    {
      date: "2025-11-01",
      totalAssets: 507500,
      totalLiabilities: 304500,
      assetCategoryTotals: { Bank: 11400, Retirement: 67800, "Real Estate": 428300 },
    },
    {
      date: "2025-12-01",
      totalAssets: 514200,
      totalLiabilities: 301000,
      assetCategoryTotals: { Bank: 12000, Retirement: 68200, "Real Estate": 434000 },
    },
    {
      date: "2026-01-01",
      totalAssets: 519500,
      totalLiabilities: 298300,
      assetCategoryTotals: { Bank: 12400, Retirement: 68400, "Real Estate": 438700 },
    },
  ],
};

export function loadState(): AppState {
  if (typeof window === "undefined") {
    return demoState;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return demoState;
  }

  try {
    const parsed = JSON.parse(raw) as AppState;
    if (
      !parsed ||
      !Array.isArray(parsed.assets) ||
      !Array.isArray(parsed.liabilities) ||
      !Array.isArray(parsed.snapshots)
    ) {
      return demoState;
    }
    return parsed;
  } catch {
    return demoState;
  }
}

export function saveState(state: AppState): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
