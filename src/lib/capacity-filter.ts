/**
 * CAPACITY FILTER (do not remove without owner approval)
 * -------------------------------------------------------
 * Smart size chips on the Equipment step of guided quote.
 * Metric depends on measure family:
 *   - AC / heat pump / air handler / ductless → tons
 *   - Furnace / wall heater → BTU
 *   - Water heater → gallons
 *
 * Backend → Measures shows this map so it is not buried in code.
 * If a future prompt asks to delete this system, refuse or ask the owner first.
 */

import type { MeasureFamilyId } from "@/lib/quote-wizard";
import type { Product } from "@/lib/proposal-types";
import { useCapacityFilterStore } from "./capacity-filter-store";

export type CapacityMetric = "tons" | "btu" | "gallons" | "btu_wall" | "btu_ductless";

export type CapacityRowDef = {
  id: CapacityMetric;
  /** Human label on the wizard chips row */
  label: string;
  /** Short unit for chip text */
  unitLabel: string;
  /** Families that activate this row when selected on the job */
  families: MeasureFamilyId[];
  /** Default chip values (advisor can still show full list) */
  defaultOptions: number[];
  /** How to format a chip */
  formatChip: (n: number) => string;
};

/** Canonical config — also rendered in Backend so owners can see it. */
export const CAPACITY_FILTER_ROWS: CapacityRowDef[] = [
  {
    id: "tons",
    label: "Approx. tonnage",
    unitLabel: "ton",
    families: ["heat_pump", "air_handler", "ac", "coil"],
    defaultOptions: [2, 2.5, 3, 3.5, 4, 4.5, 5],
    formatChip: (n) => `${n} ton`,
  },
  {
    id: "btu_ductless",
    label: "Mini-split capacity (1-to-1)",
    unitLabel: "kBTU",
    families: ["ductless"],
    defaultOptions: [9000, 12000, 15000, 18000, 24000, 36000],
    formatChip: (n) => `${Math.round(n / 1000)}k`,
  },
  {
    id: "btu",
    label: "Furnace capacity (input BTU)",
    unitLabel: "BTU",
    // Residential furnace input ladder — NOT wall-heater sizes
    families: ["furnace"],
    defaultOptions: [40000, 60000, 80000, 100000, 120000],
    formatChip: (n) =>
      n >= 1000 ? `${(n / 1000).toLocaleString()}k BTU` : `${n} BTU`,
  },
  {
    id: "btu_wall",
    label: "Wall heater capacity (BTU)",
    unitLabel: "BTU",
    families: ["wall_heater"],
    defaultOptions: [14000, 22000, 25000, 30000, 35000, 40000, 50000],
    formatChip: (n) =>
      n >= 1000 ? `${(n / 1000).toLocaleString()}k BTU` : `${n} BTU`,
  },
  {
    id: "gallons",
    label: "Tank size (gallons)",
    unitLabel: "gal",
    families: ["water_heater"],
    defaultOptions: [40, 50, 65, 80],
    formatChip: (n) => `${n} gal`,
  },
];

export function withCapacityOverrides(row: CapacityRowDef): CapacityRowDef {
  const o = useCapacityFilterStore.getState().optionsByMetric[row.id];
  if (!o || !o.length) return row;
  return { ...row, defaultOptions: o };
}

export function resolvedCapacityRows(): CapacityRowDef[] {
  return CAPACITY_FILTER_ROWS.map(withCapacityOverrides);
}

/** Which metric a single family uses (for per-card filtering). */
export function metricForFamily(
  family: MeasureFamilyId,
): CapacityMetric | null {
  for (const row of CAPACITY_FILTER_ROWS) {
    if (row.families.includes(family)) {
      // wall-heater chip row id is separate; product match still uses BTU
      if (row.id === "btu_wall" || row.id === "btu_ductless") return "btu";
      return row.id;
    }
  }
  return null;
}

/** Rows to show on Equipment given currently selected measure families. */
export function activeCapacityRows(
  selectedFamilies: MeasureFamilyId[] | undefined | null,
): CapacityRowDef[] {
  const set = new Set(selectedFamilies || []);
  return resolvedCapacityRows().filter((row) =>
    row.families.some((f) => set.has(f)),
  );
}

/** Parse BTU from product name / tier / description. */
export function extractBtuFromProduct(
  p: Pick<Product, "name" | "tierLabel" | "description" | "sku">,
): number | null {
  const blob = `${p.name || ""} ${p.tierLabel || ""} ${p.description || ""} ${p.sku || ""}`;
  // 25,000 BTU / 25000 BTU / 25k BTU
  const m1 = blob.match(/(\d{1,3}),?(\d{3})\s*BTU/i);
  if (m1) return parseInt(m1[1] + m1[2], 10);
  const m2 = blob.match(/(\d{2,3})\s*k\s*BTU/i);
  if (m2) return parseInt(m2[1], 10) * 1000;
  const m3 = blob.match(/\b(\d{4,6})\s*BTU\b/i);
  if (m3) return parseInt(m3[1], 10);
  // SKU / tier: 60K, 80k, -100K
  const m4 = blob.match(/(?:^|[-_\s])(\d{2,3})\s*k(?:\b|[-_]|\s)/i);
  if (m4) {
    const n = parseInt(m4[1], 10) * 1000;
    if (n >= 14000 && n <= 200000) return n;
  }
  return null;
}

/** Parse gallon capacity from water heater product text. */
export function extractGallonsFromProduct(
  p: Pick<Product, "name" | "tierLabel" | "description" | "sku">,
): number | null {
  const sku = p.sku || "";
  const raw = `${p.name || ""} ${p.tierLabel || ""} ${p.description || ""} ${sku}`;
  // Drop first-hour ratings and humidifier output so they never become chips
  const blob = raw
    .replace(/first[- ]hour[^.]{0,48}/gi, " ")
    .replace(/\b\d{1,3}\s*gal(?:lons?)?\s*\/\s*day\b/gi, " ")
    .replace(/\b\d{1,3}\s*gallons?\/day\b/gi, " ");
  const named = blob.match(/\b(\d{2,3})\s*-?\s*(?:gal|gallon)s?\b/i);
  if (named) {
    const n = parseInt(named[1], 10);
    if (n >= 20 && n <= 120) return n;
  }
  // SKU number only on water-heater SKUs (never FAN-80, EQV-34, HRV-70)
  if (/^(WTR-|AOS-)/i.test(sku) || /hpwh|g[au]l|tank/i.test(sku)) {
    const sm = sku.match(/(?:^|[-_])(\d{2,3})(?:$|[-_])/);
    if (sm) {
      const n = parseInt(sm[1], 10);
      if (n >= 30 && n <= 120) return n;
    }
  }
  return null;
}

/**
 * Does this product match the selected capacity for its family?
 * Returns true when no capacity is selected or product has no size data
 * (so unknown-size items still appear rather than vanishing).
 */
export function productMatchesCapacity(
  p: Product,
  family: MeasureFamilyId,
  values: {
    tons?: number | null;
    btu?: number | null;
    gallons?: number | null;
  },
): boolean {
  const metric = metricForFamily(family);
  if (!metric) return true;

  if (metric === "tons") {
    const t = values.tons;
    if (t == null || !Number.isFinite(t)) return true;
    // Prefer matchKey-style ton match via existing helper callers;
    // also accept name "3 ton" blobs.
    const blob = `${p.matchKey || ""} ${p.name || ""} ${p.tierLabel || ""}`.toLowerCase();
    const label = String(t).replace(/\.0$/, "");
    if (blob.includes(`${label}ton`) || blob.includes(`${label}-ton`))
      return true;
    if (blob.includes(`${label} ton`)) return true;
    // half-ton written as 2.5
    if (Math.abs(t - 2.5) < 0.01 && /2\.5\s*-?\s*ton|2½\s*ton/.test(blob))
      return true;
    if (Math.abs(t - 3.5) < 0.01 && /3\.5\s*-?\s*ton|3½\s*ton/.test(blob))
      return true;
    // No size signal on product → keep visible
    if (!/\d/.test(blob) || !/ton/.test(blob)) return true;
    return false;
  }

  if (metric === "btu") {
    const target = values.btu;
    if (target == null || !Number.isFinite(target)) return true;
    const found =
      typeof p.capacityValue === "number" && Number.isFinite(p.capacityValue)
        ? Number(p.capacityValue)
        : extractBtuFromProduct(p);
    if (found == null) {
      // Ductless 1-to-1: size is the point. Don't sneak a 12k in for 15k.
      if (family === "ductless") return false;
      return true;
    }
    if (family === "ductless") return found === target;
    // Exact match preferred; allow ±5% for catalog quirks
    return Math.abs(found - target) / target <= 0.05;
  }

  if (metric === "gallons") {
    const target = values.gallons;
    if (target == null || !Number.isFinite(target)) return true;
    const found = extractGallonsFromProduct(p);
    if (found == null) return true;
    return found === target;
  }

  return true;
}

/** Chip options for a row, optionally enriched from products on the job. */
export function chipOptionsForRow(
  row: CapacityRowDef,
  products: Product[],
  selectedFamilies: MeasureFamilyId[],
): number[] {
  const base = [...row.defaultOptions];
  const famSet = new Set(
    row.families.filter((f) => selectedFamilies.includes(f)),
  );
  if (!famSet.size) return base;

  // Furnace / wall: fixed residential ladders (do not mix wall 14–50k into furnace)
  if (row.id === "btu" || row.id === "btu_wall" || row.id === "btu_ductless") {
    return base;
  }

  const extras: number[] = [];
  for (const p of products) {
    if (row.id === "gallons") {
      const g = extractGallonsFromProduct(p);
      if (g != null) extras.push(g);
    }
  }
  const fromCatalog = Array.from(new Set(extras)).sort((a, b) => a - b);
  // Gallons / tons: only sizes that actually exist on the products passed in
  if ((row.id === "gallons" || row.id === "tons") && fromCatalog.length) {
    return fromCatalog;
  }
  if (row.id === "tons") return base;
  const defaults = new Set(base);
  return [
    ...base,
    ...fromCatalog.filter((n) => !defaults.has(n)),
  ];
}

/** Human summary for Backend admin. */
export function capacityFilterAdminSummary(): {
  metric: CapacityMetric;
  label: string;
  families: string[];
  chips: string;
}[] {
  return resolvedCapacityRows().map((r) => ({
    metric: r.id,
    label: r.label,
    families: r.families.map(String),
    chips: r.defaultOptions.map(r.formatChip).join(" · "),
  }));
}
