/**
 * Decimal efficiency ratings for AC / heat pumps — advisor-facing only.
 * Never print these on the customer PDF / DocuSign packet.
 */

import type { Product } from "./proposal-types";
import { productIsEnergyStar } from "./energy-star";

export type EfficiencyRatings = {
  seer2?: number | null;
  eer2?: number | null;
  hspf2?: number | null;
  soundDb?: number | null;
};

/** Format one rating with one decimal place when needed. */
export function formatRating(n?: number | null): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return "";
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

export function productHasEfficiency(p: Product | null | undefined): boolean {
  if (!p) return false;
  const k = p.equipmentKind;
  if (k !== "ac" && k !== "heat_pump" && k !== "ductless") return false;
  return Boolean(p.seer2 || p.eer2 || p.hspf2);
}

/** Compact advisor line: SEER2 15.2 · EER2 12.0 · HSPF2 7.8 */
export function formatEfficiencyLine(p: Product | EfficiencyRatings | null | undefined): string {
  if (!p) return "";
  const parts: string[] = [];
  const s = formatRating(p.seer2);
  const e = formatRating(p.eer2);
  const h = formatRating(p.hspf2);
  if (s) parts.push(`SEER2 ${s}`);
  if (e) parts.push(`EER2 ${e}`);
  if (h) parts.push(`HSPF2 ${h}`);
  return parts.join(" · ");
}

/**
 * Typical published-class ratings by tier (1 Comfort / 2 Performance / 3 Infinity)
 * from current Carrier / similar residential families — not a specific AHRI cert.
 */
export function ratingsForOutdoor(
  kind: "ac" | "heat_pump" | "ductless",
  tier: number,
  tonnage = 3,
): EfficiencyRatings {
  const t = Math.max(1.5, tonnage || 3);
  const derate = Math.max(0, (t - 3) * 0.12);

  if (kind === "ac") {
    const table: Record<number, { seer2: number; eer2: number }> = {
      1: { seer2: 15.2, eer2: 12.0 },
      2: { seer2: 17.0, eer2: 12.5 },
      3: { seer2: 21.0, eer2: 14.0 },
    };
    const row = table[tier] || table[1];
    return {
      seer2: round1(row.seer2 - derate),
      eer2: round1(row.eer2 - derate * 0.35),
      hspf2: null,
    };
  }

  if (kind === "ductless") {
    const table: Record<number, { seer2: number; eer2: number; hspf2: number }> = {
      1: { seer2: 18.0, eer2: 12.0, hspf2: 8.8 },
      2: { seer2: 20.5, eer2: 12.5, hspf2: 10.0 },
      3: { seer2: 22.0, eer2: 13.5, hspf2: 10.5 },
    };
    const row = table[tier] || table[1];
    return {
      seer2: round1(row.seer2 - derate),
      eer2: round1(row.eer2 - derate * 0.3),
      hspf2: round1(row.hspf2),
    };
  }

  const table: Record<number, { seer2: number; eer2: number; hspf2: number }> = {
    1: { seer2: 15.2, eer2: 11.7, hspf2: 7.8 },
    2: { seer2: 17.5, eer2: 12.0, hspf2: 8.1 },
    3: { seer2: 20.5, eer2: 13.0, hspf2: 9.5 },
  };
  const row = table[tier] || table[1];
  return {
    seer2: round1(row.seer2 - derate),
    eer2: round1(row.eer2 - derate * 0.35),
    hspf2: round1(row.hspf2),
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Resolve ratings from product fields or infer from kind/tier. */
export function resolveEfficiency(
  p: Product,
  tonnageHint?: number,
): EfficiencyRatings {
  if (p.seer2 || p.eer2 || p.hspf2) {
    return { seer2: p.seer2, eer2: p.eer2, hspf2: p.hspf2 };
  }
  const k = p.equipmentKind;
  if (k !== "ac" && k !== "heat_pump" && k !== "ductless") return {};
  return ratingsForOutdoor(k, p.tier ?? 1, tonnageHint);
}


/** Typical outdoor sound (dBA, published class — advisor only). */
export function soundDbFor(
  kind: "ac" | "heat_pump" | "ductless" | string | null | undefined,
  tier = 1,
): number | null {
  if (kind === "ductless") {
    return tier >= 3 ? 49 : tier >= 2 ? 52 : 54;
  }
  if (kind === "heat_pump") {
    return tier >= 3 ? 56 : tier >= 2 ? 68 : 72;
  }
  if (kind === "ac") {
    return tier >= 3 ? 58 : tier >= 2 ? 70 : 74;
  }
  return null;
}

export function resolveSoundDb(p: Product, tonnageHint?: number): number | null {
  if (p.soundDb != null && p.soundDb > 0) return p.soundDb;
  return soundDbFor(p.equipmentKind, p.tier ?? 1);
}

/** Compact advisor specs: Size · dB · SEER */
export function formatAdvisorSpecs(
  p: Product,
  sizeLabel: string,
  tonnageHint?: number,
): string {
  const parts: string[] = [];
  if (sizeLabel) parts.push(sizeLabel);
  const db = resolveSoundDb(p, tonnageHint);
  if (db != null) parts.push(`${db} dB`);
  const eff = resolveEfficiency(p, tonnageHint);
  const seer = formatRating(eff.seer2);
  if (seer) parts.push(`SEER2 ${seer}`);
  return parts.join(" · ");
}


/** ENERGY STAR — uses explicit product.energyStar, then conservative class inference. */
export function qualifiesEnergyStar(p: Product | null | undefined): boolean {
  return productIsEnergyStar(p);
}
