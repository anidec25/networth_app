"use client";

import { useEffect, useMemo, useState } from "react";
import {
  assetCategoryTotals,
  currency,
  groupedTotals,
  netWorth,
  toAssetMoMSeries,
  toNetSeries,
  totalAssets,
  totalLiabilities,
} from "@/lib/networth";
import { loadState, saveState } from "@/lib/storage";
import {
  ASSET_CATEGORIES,
  LIABILITY_CATEGORIES,
  type AppState,
  type AssetCategory,
  type LiabilityCategory,
} from "@/types/finance";

type EntryDraft = {
  name: string;
  value: string;
};

const emptyDraft: EntryDraft = { name: "", value: "" };
const thisMonth = new Date().toISOString().slice(0, 7);
const THEME_KEY = "networth-tracker-theme";
type Theme = "dark" | "light";
type MoMAssetFilter = "All" | AssetCategory;
const PIE_COLORS = ["#2dd4bf", "#06b6d4", "#f59e0b", "#f97316", "#a78bfa", "#84cc16", "#f43f5e"];

function upsertSnapshot(
  state: AppState,
  date: string,
  update: {
    assetsDelta: number;
    liabilitiesDelta: number;
    assetCategory?: AssetCategory;
  },
) {
  const existing = state.snapshots.find((snapshot) => snapshot.date === date);
  const nextCategoryTotals = { ...(existing?.assetCategoryTotals ?? {}) };

  if (update.assetCategory) {
    nextCategoryTotals[update.assetCategory] =
      (nextCategoryTotals[update.assetCategory] ?? 0) + update.assetsDelta;
  }

  const nextPoint = {
    date,
    totalAssets: (existing?.totalAssets ?? 0) + update.assetsDelta,
    totalLiabilities: (existing?.totalLiabilities ?? 0) + update.liabilitiesDelta,
    assetCategoryTotals: Object.keys(nextCategoryTotals).length > 0 ? nextCategoryTotals : undefined,
  };

  if (existing) {
    return state.snapshots
      .map((snapshot) => (snapshot.date === date ? nextPoint : snapshot))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  return [...state.snapshots, nextPoint].sort((a, b) => a.date.localeCompare(b.date));
}

function applyRemovalToSnapshots(
  snapshots: AppState["snapshots"],
  date: string,
  update: {
    assetsDelta: number;
    liabilitiesDelta: number;
    assetCategory?: AssetCategory;
  },
) {
  if (snapshots.length === 0) {
    return snapshots;
  }

  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const targetIndex = sorted.findIndex((snapshot) => snapshot.date === date);
  const index = targetIndex >= 0 ? targetIndex : sorted.length - 1;
  const target = sorted[index];

  const categoryTotals = { ...(target.assetCategoryTotals ?? {}) };
  if (update.assetCategory) {
    const next = Math.max(0, (categoryTotals[update.assetCategory] ?? 0) - update.assetsDelta);
    if (next === 0) {
      delete categoryTotals[update.assetCategory];
    } else {
      categoryTotals[update.assetCategory] = next;
    }
  }

  const nextSnapshot = {
    ...target,
    totalAssets: Math.max(0, target.totalAssets - update.assetsDelta),
    totalLiabilities: Math.max(0, target.totalLiabilities - update.liabilitiesDelta),
    assetCategoryTotals:
      Object.keys(categoryTotals).length > 0 ? categoryTotals : undefined,
  };

  sorted[index] = nextSnapshot;
  return sorted;
}

export default function Home() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") {
      return "dark";
    }
    return window.localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
  });
  const [assetCategory, setAssetCategory] = useState<AssetCategory>("Cash");
  const [liabilityCategory, setLiabilityCategory] =
    useState<LiabilityCategory>("Credit Card");
  const [assetDraft, setAssetDraft] = useState<EntryDraft>(emptyDraft);
  const [liabilityDraft, setLiabilityDraft] = useState<EntryDraft>(emptyDraft);
  const [liabilityApr, setLiabilityApr] = useState<string>("");
  const [momAssetFilter, setMomAssetFilter] = useState<MoMAssetFilter>("All");
  const [assetMonth, setAssetMonth] = useState<string>(thisMonth);
  const [liabilityMonth, setLiabilityMonth] = useState<string>(thisMonth);

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(theme);
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const assetsTotal = useMemo(() => totalAssets(state.assets), [state.assets]);
  const liabilitiesTotal = useMemo(
    () => totalLiabilities(state.liabilities),
    [state.liabilities],
  );
  const net = useMemo(() => netWorth(state.assets, state.liabilities), [state]);
  const trend = useMemo(() => toNetSeries(state.snapshots), [state.snapshots]);
  const assetMoM = useMemo(
    () => toAssetMoMSeries(state.snapshots, momAssetFilter),
    [state.snapshots, momAssetFilter],
  );

  const latestSnapNet =
    trend.length > 0 ? trend[trend.length - 1].net : net;
  const delta = net - latestSnapNet;

  function addAsset() {
    const value = Number(assetDraft.value);
    if (!assetDraft.name.trim() || Number.isNaN(value) || value < 0) return;
    const month = assetMonth || thisMonth;
    const date = `${month}-01`;

    setState((prev) => ({
      assets: [
        {
          id: crypto.randomUUID(),
          name: assetDraft.name.trim(),
          category: assetCategory,
          value,
          updatedAt: new Date(`${date}T00:00:00`).toISOString(),
        },
        ...prev.assets,
      ],
      liabilities: prev.liabilities,
      snapshots: upsertSnapshot(prev, date, {
        assetsDelta: value,
        liabilitiesDelta: 0,
        assetCategory: assetCategory,
      }),
    }));
    setAssetDraft(emptyDraft);
  }

  function addLiability() {
    const value = Number(liabilityDraft.value);
    const apr = liabilityApr ? Number(liabilityApr) : undefined;
    if (!liabilityDraft.name.trim() || Number.isNaN(value) || value < 0) return;
    if (apr !== undefined && (Number.isNaN(apr) || apr < 0)) return;
    const month = liabilityMonth || thisMonth;
    const date = `${month}-01`;

    setState((prev) => ({
      assets: prev.assets,
      liabilities: [
        {
          id: crypto.randomUUID(),
          name: liabilityDraft.name.trim(),
          category: liabilityCategory,
          value,
          apr,
          updatedAt: new Date(`${date}T00:00:00`).toISOString(),
        },
        ...prev.liabilities,
      ],
      snapshots: upsertSnapshot(prev, date, {
        assetsDelta: 0,
        liabilitiesDelta: value,
      }),
    }));
    setLiabilityDraft(emptyDraft);
    setLiabilityApr("");
  }

  function removeAsset(id: string) {
    setState((prev) => {
      const target = prev.assets.find((item) => item.id === id);
      if (!target) {
        return prev;
      }
      const nextAssets = prev.assets.filter((item) => item.id !== id);
      const monthDate = target.updatedAt.slice(0, 10);
      const nextSnapshots = applyRemovalToSnapshots(prev.snapshots, monthDate, {
        assetsDelta: target.value,
        liabilitiesDelta: 0,
        assetCategory: target.category,
      });

      return {
        assets: nextAssets,
        liabilities: prev.liabilities,
        snapshots: nextSnapshots,
      };
    });
  }

  function removeLiability(id: string) {
    setState((prev) => ({
      assets: prev.assets,
      liabilities: prev.liabilities.filter((item) => item.id !== id),
      snapshots: (() => {
        const target = prev.liabilities.find((item) => item.id === id);
        if (!target) return prev.snapshots;
        const monthDate = target.updatedAt.slice(0, 10);
        return applyRemovalToSnapshots(prev.snapshots, monthDate, {
          assetsDelta: 0,
          liabilitiesDelta: target.value,
        });
      })(),
    }));
  }

  function captureSnapshot() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const date = monthStart.toISOString().split("T")[0];

    setState((prev) => {
      const exists = prev.snapshots.some((snap) => snap.date === date);
      const nextPoint = {
        date,
        totalAssets: totalAssets(prev.assets),
        totalLiabilities: totalLiabilities(prev.liabilities),
        assetCategoryTotals: assetCategoryTotals(prev.assets),
      };
      return {
        ...prev,
        snapshots: exists
          ? prev.snapshots.map((snap) => (snap.date === date ? nextPoint : snap))
          : [...prev.snapshots, nextPoint].sort((a, b) => a.date.localeCompare(b.date)),
      };
    });
  }

  const assetGroups = groupedTotals(state.assets);
  const liabilityGroups = groupedTotals(state.liabilities);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <header className="mb-6 flex flex-col gap-3 rounded-3xl border border-black/5 bg-[var(--surface)] p-5 shadow-sm sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              Personal Finance
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              NetWorth Tracker
            </h1>
            <p className="text-sm text-[var(--muted)] sm:text-base">
              Track every asset and liability, then monitor your net worth trend in one place.
            </p>
          </div>
          <button
            onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
            className="rounded-xl border border-black/10 bg-[var(--surface-strong)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:brightness-110"
          >
            {theme === "dark" ? "Switch to Light" : "Switch to Dark"}
          </button>
        </div>
      </header>

      <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total Assets" value={currency(assetsTotal)} tone="positive" />
        <MetricCard label="Total Liabilities" value={currency(liabilitiesTotal)} tone="negative" />
        <MetricCard label="Net Worth" value={currency(net)} tone={net >= 0 ? "positive" : "negative"} />
        <MetricCard
          label="Change vs Last Snapshot"
          value={`${delta >= 0 ? "+" : ""}${currency(delta)}`}
          tone={delta >= 0 ? "positive" : "negative"}
        />
      </section>

      <section className="mb-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <div className="h-fit rounded-3xl border border-black/5 bg-[var(--surface)] p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h2 className="text-xl font-semibold">Net Worth Trend</h2>
              <p className="text-base text-[var(--muted)]">
                Monthly snapshots of assets, liabilities, and net worth
              </p>
            </div>
            <button
              onClick={captureSnapshot}
              className="h-11 whitespace-nowrap rounded-xl bg-[var(--accent)] px-5 text-sm font-semibold text-white transition hover:brightness-110"
            >
              Capture This Month
            </button>
          </div>
          <MiniChart values={trend.map((item) => item.net)} labels={trend.map((item) => item.label)} />
        </div>
        <div className="h-fit rounded-3xl border border-black/5 bg-[var(--surface)] p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-semibold sm:text-2xl">MoM Asset Tracking</h2>
          <p className="mb-4 text-base text-[var(--muted)]">
            Month-over-month changes in total assets with trend depth
          </p>
          <AssetMoMPanel
            points={assetMoM}
            selectedFilter={momAssetFilter}
            onFilterChange={setMomAssetFilter}
          />
        </div>
      </section>

      <section className="mb-6 rounded-3xl border border-black/5 bg-[var(--surface)] p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">Asset Allocation</h2>
        <p className="mb-4 text-sm text-[var(--muted)]">
          Distribution of your current assets by category
        </p>
        <AssetAllocationPie groups={assetGroups} total={assetsTotal} />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-black/5 bg-[var(--surface)] p-5 shadow-sm sm:p-6">
          <h2 className="mb-3 text-lg font-semibold">Assets</h2>
          <div className="mb-5 rounded-2xl border border-black/10 bg-[var(--surface-strong)]/60 p-3 sm:p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Asset Name
                </span>
                <input
                  placeholder="Primary Checking"
                  value={assetDraft.name}
                  onChange={(event) =>
                    setAssetDraft((prev) => ({ ...prev, name: event.target.value }))
                  }
                  className="h-11 w-full rounded-xl border border-black/15 bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] outline-none ring-[var(--accent)] focus:ring-2"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Category
                </span>
                <select
                  value={assetCategory}
                  onChange={(event) => setAssetCategory(event.target.value as AssetCategory)}
                  className="h-11 w-full rounded-xl border border-black/15 bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none ring-[var(--accent)] focus:ring-2"
                >
                  {ASSET_CATEGORIES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Month
                </span>
                <input
                  type="month"
                  value={assetMonth}
                  onChange={(event) => setAssetMonth(event.target.value)}
                  className="h-11 w-full rounded-xl border border-black/15 bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none ring-[var(--accent)] focus:ring-2"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Value (USD)
                </span>
                <input
                  placeholder="0"
                  inputMode="numeric"
                  value={assetDraft.value}
                  onChange={(event) =>
                    setAssetDraft((prev) => ({ ...prev, value: event.target.value }))
                  }
                  className="h-11 w-full rounded-xl border border-black/15 bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] outline-none ring-[var(--accent)] focus:ring-2"
                />
              </label>
            </div>
            <button
              onClick={addAsset}
              className="mt-3 h-11 w-full rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:brightness-110"
            >
              Add Asset
            </button>
          </div>

          <div className="mb-4 space-y-2">
            {state.assets.length === 0 && (
              <p className="rounded-xl border border-black/10 bg-[var(--surface-strong)] p-3 text-sm text-[var(--muted)]">No assets yet.</p>
            )}
            {state.assets.map((asset) => (
              <RowItem
                key={asset.id}
                name={asset.name}
                meta={asset.category}
                value={currency(asset.value)}
                onDelete={() => removeAsset(asset.id)}
              />
            ))}
          </div>

          <h3 className="mb-2 text-sm font-semibold text-[var(--muted)]">Asset Mix</h3>
          <CategoryBars groups={assetGroups} total={assetsTotal} />
        </section>

        <section className="rounded-3xl border border-black/5 bg-[var(--surface)] p-5 shadow-sm sm:p-6">
          <h2 className="mb-3 text-lg font-semibold">Liabilities</h2>
          <div className="mb-5 rounded-2xl border border-black/10 bg-[var(--surface-strong)]/60 p-3 sm:p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Liability Name
                </span>
                <input
                  placeholder="Mortgage Balance"
                  value={liabilityDraft.name}
                  onChange={(event) =>
                    setLiabilityDraft((prev) => ({ ...prev, name: event.target.value }))
                  }
                  className="h-11 w-full rounded-xl border border-black/15 bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] outline-none ring-[var(--accent)] focus:ring-2"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Category
                </span>
                <select
                  value={liabilityCategory}
                  onChange={(event) =>
                    setLiabilityCategory(event.target.value as LiabilityCategory)
                  }
                  className="h-11 w-full rounded-xl border border-black/15 bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none ring-[var(--accent)] focus:ring-2"
                >
                  {LIABILITY_CATEGORIES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Month
                </span>
                <input
                  type="month"
                  value={liabilityMonth}
                  onChange={(event) => setLiabilityMonth(event.target.value)}
                  className="h-11 w-full rounded-xl border border-black/15 bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none ring-[var(--accent)] focus:ring-2"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Balance (USD)
                </span>
                <input
                  placeholder="0"
                  inputMode="numeric"
                  value={liabilityDraft.value}
                  onChange={(event) =>
                    setLiabilityDraft((prev) => ({ ...prev, value: event.target.value }))
                  }
                  className="h-11 w-full rounded-xl border border-black/15 bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] outline-none ring-[var(--accent)] focus:ring-2"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  APR % (Optional)
                </span>
                <input
                  placeholder="0.0"
                  inputMode="decimal"
                  value={liabilityApr}
                  onChange={(event) => setLiabilityApr(event.target.value)}
                  className="h-11 w-full rounded-xl border border-black/15 bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] outline-none ring-[var(--accent)] focus:ring-2"
                />
              </label>
            </div>
            <button
              onClick={addLiability}
              className="mt-3 h-11 w-full rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:brightness-110"
            >
              Add Liability
            </button>
          </div>

          <div className="mb-4 space-y-2">
            {state.liabilities.length === 0 && (
              <p className="rounded-xl border border-black/10 bg-[var(--surface-strong)] p-3 text-sm text-[var(--muted)]">No liabilities yet.</p>
            )}
            {state.liabilities.map((liability) => (
              <RowItem
                key={liability.id}
                name={liability.name}
                meta={`${liability.category}${liability.apr ? ` • ${liability.apr}% APR` : ""}`}
                value={currency(liability.value)}
                onDelete={() => removeLiability(liability.id)}
              />
            ))}
          </div>

          <h3 className="mb-2 text-sm font-semibold text-[var(--muted)]">Liability Mix</h3>
          <CategoryBars groups={liabilityGroups} total={liabilitiesTotal} />
        </section>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "positive" | "negative";
}) {
  return (
    <div className="rounded-2xl border border-black/5 bg-[var(--surface)] p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold ${
          tone === "positive" ? "text-[var(--positive)]" : "text-[var(--negative)]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function RowItem({
  name,
  meta,
  value,
  onDelete,
}: {
  name: string;
  meta: string;
  value: string;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-black/10 bg-[var(--surface-strong)] px-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{name}</p>
        <p className="truncate text-xs text-[var(--muted)]">{meta}</p>
      </div>
      <div className="ml-3 flex items-center gap-3">
        <p className="text-sm font-semibold">{value}</p>
        <button
          onClick={onDelete}
          className="h-8 rounded-lg border border-black/10 bg-[var(--background)] px-2.5 text-xs font-semibold text-[var(--muted)] transition hover:border-red-400/30 hover:text-red-300"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function CategoryBars({
  groups,
  total,
}: {
  groups: Array<{ category: string; total: number }>;
  total: number;
}) {
  if (groups.length === 0) {
    return <p className="text-sm text-[var(--muted)]">No category data yet.</p>;
  }

  return (
    <div className="space-y-2">
      {groups.map((group) => {
        const width = total > 0 ? Math.max(6, (group.total / total) * 100) : 0;
        return (
          <div key={group.category}>
            <div className="mb-1 flex items-center justify-between text-xs text-[var(--muted)]">
              <span>{group.category}</span>
              <span>{currency(group.total)}</span>
            </div>
            <div className="h-2 rounded-full bg-[var(--surface-strong)]">
              <div
                className="h-full rounded-full bg-[var(--accent)]"
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MiniChart({
  values,
  labels,
}: {
  values: number[];
  labels: string[];
}) {
  if (values.length === 0) {
    return (
      <div className="rounded-xl border border-black/10 bg-[var(--surface-strong)] p-4 text-sm text-[var(--muted)]">
        No snapshots yet. Capture your first month.
      </div>
    );
  }

  const width = 700;
  const height = 250;
  const padX = 14;
  const padTop = 26;
  const padBottom = 36;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const mid = min + span / 2;

  const points = values.map((value, index) => {
    const x = padX + (index * (width - padX * 2)) / Math.max(1, values.length - 1);
    const y = height - padBottom - ((value - min) / span) * (height - padTop - padBottom);
    return [x, y];
  });

  const polyline = points.map(([x, y]) => `${x},${y}`).join(" ");
  const final = points[points.length - 1];
  const first = points[0];
  const areaPath = `M ${first[0]} ${height - padBottom} L ${polyline.replaceAll(",", " ")} L ${final[0]} ${height - padBottom} Z`;
  const upper = currency(max);
  const middle = currency(mid);
  const lower = currency(min);

  return (
    <div className="rounded-2xl border border-black/10 bg-[var(--surface-strong)] p-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full">
        <path d={areaPath} fill="var(--accent)" fillOpacity="0.12" />
        <line
          x1={padX}
          y1={padTop}
          x2={width - padX}
          y2={padTop}
          stroke="var(--muted)"
          strokeOpacity="0.22"
          strokeWidth="1"
        />
        <line
          x1={padX}
          y1={(height - padBottom + padTop) / 2}
          x2={width - padX}
          y2={(height - padBottom + padTop) / 2}
          stroke="var(--muted)"
          strokeOpacity="0.18"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        <line
          x1={padX}
          y1={height - padBottom}
          x2={width - padX}
          y2={height - padBottom}
          stroke="var(--muted)"
          strokeOpacity="0.35"
          strokeWidth="1"
        />
        {points.map(([x], index) => (
          <line
            key={`grid-${labels[index]}-${x}`}
            x1={x}
            y1={padTop}
            x2={x}
            y2={height - padBottom}
            stroke="var(--muted)"
            strokeOpacity="0.08"
            strokeWidth="1"
          />
        ))}
        <polyline
          fill="none"
          stroke="var(--accent)"
          strokeWidth="3.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={polyline}
        />
        <circle cx={final[0]} cy={final[1]} r="8" fill="var(--accent)" fillOpacity="0.25" />
        <circle cx={final[0]} cy={final[1]} r="4" fill="var(--accent)" />
        {points.map(([x, y], index) => (
          <g key={`${labels[index]}-${x}`}>
            <circle cx={x} cy={y} r="2.2" fill="var(--accent)" />
            <text x={x} y={height - 8} fontSize="11" textAnchor="middle" fill="var(--muted)">
              {labels[index]}
            </text>
          </g>
        ))}
        <text x={padX + 4} y={padTop - 6} fontSize="11" fill="var(--muted)">
          {upper}
        </text>
        <text x={padX + 4} y={(height - padBottom + padTop) / 2 - 6} fontSize="11" fill="var(--muted)">
          {middle}
        </text>
        <text x={padX + 4} y={height - padBottom - 6} fontSize="11" fill="var(--muted)">
          {lower}
        </text>
        <text x={final[0] - 6} y={final[1] - 12} fontSize="11" textAnchor="end" fill="var(--foreground)">
          {currency(values[values.length - 1])}
        </text>
      </svg>
    </div>
  );
}

function AssetAllocationPie({
  groups,
  total,
}: {
  groups: Array<{ category: string; total: number }>;
  total: number;
}) {
  if (groups.length === 0 || total <= 0) {
    return (
      <div className="rounded-xl border border-black/10 bg-[var(--surface-strong)] p-4 text-sm text-[var(--muted)]">
        Add assets to view allocation.
      </div>
    );
  }

  const size = 220;
  const radius = 84;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const segments = groups.reduce<Array<{ category: string; color: string; length: number; offset: number }>>(
    (acc, group, index) => {
      const previousOffset = acc.length > 0 ? acc[acc.length - 1].offset + acc[acc.length - 1].length : 0;
      const length = (group.total / total) * circumference;
      acc.push({
        category: group.category,
        color: PIE_COLORS[index % PIE_COLORS.length],
        length,
        offset: previousOffset,
      });
      return acc;
    },
    [],
  );

  return (
    <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[240px_1fr]">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="mx-auto h-56 w-56"
        aria-label="Asset allocation pie chart"
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--surface-strong)"
          strokeWidth="28"
        />
        {segments.map((segment) => (
          <circle
            key={segment.category}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={segment.color}
            strokeWidth="28"
            strokeDasharray={`${segment.length} ${circumference - segment.length}`}
            strokeDashoffset={-segment.offset}
            transform={`rotate(-90 ${center} ${center})`}
            strokeLinecap="butt"
          />
        ))}
        <text x={center} y={center - 4} textAnchor="middle" className="fill-[var(--muted)] text-[10px]">
          Total Assets
        </text>
        <text x={center} y={center + 18} textAnchor="middle" className="fill-[var(--foreground)] text-[18px] font-semibold">
          {currency(total)}
        </text>
      </svg>
      <div className="space-y-2">
        {groups.map((group, index) => {
          const ratio = (group.total / total) * 100;
          const color = PIE_COLORS[index % PIE_COLORS.length];
          return (
            <div
              key={group.category}
              className="flex items-center justify-between rounded-lg border border-black/10 bg-[var(--surface-strong)] px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-sm">{group.category}</span>
              </div>
              <div className="text-right text-xs text-[var(--muted)]">
                <p>{ratio.toFixed(1)}%</p>
                <p>{currency(group.total)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AssetMoMPanel({
  points,
  selectedFilter,
  onFilterChange,
}: {
  points: Array<{ label: string; assets: number; change: number; changePct: number | null }>;
  selectedFilter: MoMAssetFilter;
  onFilterChange: (value: MoMAssetFilter) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-black/10 bg-[var(--surface-strong)] px-4 py-3">
          <label
            htmlFor="mom-asset-filter"
            className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]"
          >
            Asset Class
          </label>
          <select
            id="mom-asset-filter"
            value={selectedFilter}
            onChange={(event) => onFilterChange(event.target.value as MoMAssetFilter)}
            className="h-11 w-full rounded-lg border border-black/15 bg-[var(--background)] px-3 text-base text-[var(--foreground)] outline-none ring-[var(--accent)] focus:ring-2"
          >
            <option value="All">All</option>
            {ASSET_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
        <div className="rounded-xl border border-black/10 bg-[var(--surface-strong)] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
            Latest Month {selectedFilter === "All" ? "Assets" : selectedFilter}
          </p>
          <p className="mt-1 text-3xl font-semibold">{points.length > 0 ? currency(points[points.length - 1].assets) : "--"}</p>
        </div>
      </div>
      {points.length < 2 ? (
        <div className="rounded-xl border border-black/10 bg-[var(--surface-strong)] p-4 text-base text-[var(--muted)]">
          Capture at least two monthly snapshots with category totals to see this view.
        </div>
      ) : (
        <MoMBarChart points={points.slice(-7).slice(1)} />
      )}
    </div>
  );
}

function MoMBarChart({
  points,
}: {
  points: Array<{ label: string; assets: number; change: number; changePct: number | null }>;
}) {
  if (points.length === 0) {
    return null;
  }

  const width = 700;
  const height = 320;
  const padTop = 30;
  const padRight = 24;
  const padBottom = 76;
  const padLeft = 24;
  const innerWidth = width - padLeft - padRight;
  const innerHeight = height - padTop - padBottom;

  const min = Math.min(0, ...points.map((point) => point.change));
  const max = Math.max(0, ...points.map((point) => point.change));
  const span = Math.max(1, max - min);
  const zeroY = padTop + ((max - 0) / span) * innerHeight;

  const barGap = 12;
  const barWidth = Math.max(
    16,
    (innerWidth - barGap * Math.max(0, points.length - 1)) / points.length,
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-black/10 bg-[var(--surface-strong)] p-4">
      <div className="mb-3 flex items-center gap-4 text-xs font-medium text-[var(--muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--positive)]" />
          Positive Growth
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--negative)]" />
          Negative Growth
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[19rem] w-full">
        <line
          x1={padLeft}
          y1={zeroY}
          x2={width - padRight}
          y2={zeroY}
          stroke="var(--muted)"
          strokeOpacity="0.55"
          strokeWidth="1"
        />
        <line
          x1={padLeft}
          y1={padTop}
          x2={width - padRight}
          y2={padTop}
          stroke="var(--muted)"
          strokeOpacity="0.14"
          strokeWidth="1"
        />
        <line
          x1={padLeft}
          y1={height - padBottom}
          x2={width - padRight}
          y2={height - padBottom}
          stroke="var(--muted)"
          strokeOpacity="0.14"
          strokeWidth="1"
        />
        {points.map((point, index) => {
          const x = padLeft + index * (barWidth + barGap);
          const y = padTop + ((max - point.change) / span) * innerHeight;
          const barTop = point.change >= 0 ? y : zeroY;
          const barHeight = Math.max(4, Math.abs(zeroY - y));
          const positive = point.change >= 0;

          return (
            <g key={`${point.label}-${index}`}>
              <rect
                x={x}
                y={barTop}
                width={barWidth}
                height={barHeight}
                rx="5"
                fill={positive ? "var(--positive)" : "var(--negative)"}
                opacity="0.9"
              />
              <text
                x={x + barWidth / 2}
                y={point.change >= 0 ? barTop - 10 : barTop - 6}
                textAnchor="middle"
                fontSize="14"
                fontWeight="700"
                fill={positive ? "var(--positive)" : "var(--negative)"}
              >
                {point.changePct !== null ? `${positive ? "+" : ""}${point.changePct.toFixed(1)}%` : "--"}
              </text>
              <text
                x={x + barWidth / 2}
                y={height - 38}
                textAnchor="middle"
                fontSize="12"
                fontWeight="600"
                fill="var(--foreground)"
              >
                {point.label}
              </text>
              <text
                x={x + barWidth / 2}
                y={height - 18}
                textAnchor="middle"
                fontSize="11"
                fontWeight="500"
                fill={positive ? "var(--positive)" : "var(--negative)"}
              >
                {currency(point.assets)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
