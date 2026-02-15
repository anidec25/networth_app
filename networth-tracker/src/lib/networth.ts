import type { AssetCategory, AssetEntry, LiabilityEntry, Snapshot } from "@/types/finance";

export function currency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function totalAssets(items: AssetEntry[]): number {
  return items.reduce((sum, item) => sum + item.value, 0);
}

export function totalLiabilities(items: LiabilityEntry[]): number {
  return items.reduce((sum, item) => sum + item.value, 0);
}

export function netWorth(assets: AssetEntry[], liabilities: LiabilityEntry[]): number {
  return totalAssets(assets) - totalLiabilities(liabilities);
}

export function groupedTotals<T extends { category: string; value: number }>(
  items: T[],
): Array<{ category: string; total: number }> {
  const map = new Map<string, number>();
  for (const item of items) {
    map.set(item.category, (map.get(item.category) ?? 0) + item.value);
  }
  return [...map.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

export function assetCategoryTotals(
  assets: AssetEntry[],
): Partial<Record<AssetCategory, number>> {
  const totals: Partial<Record<AssetCategory, number>> = {};
  for (const asset of assets) {
    totals[asset.category] = (totals[asset.category] ?? 0) + asset.value;
  }
  return totals;
}

export function toNetSeries(
  snapshots: Snapshot[],
): Array<{ label: string; net: number; assets: number; liabilities: number }> {
  return snapshots.map((point) => ({
    label: new Date(point.date).toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    }),
    assets: point.totalAssets,
    liabilities: point.totalLiabilities,
    net: point.totalAssets - point.totalLiabilities,
  }));
}

export function toAssetMoMSeries(
  snapshots: Snapshot[],
  category: AssetCategory | "All",
): Array<{ label: string; assets: number; change: number; changePct: number | null }> {
  if (category === "All") {
    return snapshots.map((point, index) => {
      const assets = point.totalAssets;
      const previous = index > 0 ? snapshots[index - 1].totalAssets : null;
      const change = previous === null ? 0 : assets - previous;
      const changePct =
        previous === null || previous === 0 ? null : (change / previous) * 100;

      return {
        label: new Date(point.date).toLocaleDateString("en-US", {
          month: "short",
          year: "2-digit",
        }),
        assets,
        change,
        changePct,
      };
    });
  }

  const categoryPoints = snapshots
    .map((point) => {
      const assets = point.assetCategoryTotals?.[category];
      if (assets === undefined) return null;
      return {
        label: new Date(point.date).toLocaleDateString("en-US", {
          month: "short",
          year: "2-digit",
        }),
        assets,
      };
    })
    .filter((point): point is { label: string; assets: number } => point !== null);

  return categoryPoints.map((point, index) => {
    const previous = index > 0 ? categoryPoints[index - 1].assets : null;
    const change = previous === null ? 0 : point.assets - previous;
    const changePct =
      previous === null || previous === 0 ? null : (change / previous) * 100;
    return {
      label: point.label,
      assets: point.assets,
      change,
      changePct,
    };
  });
}
