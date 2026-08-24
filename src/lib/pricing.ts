/**
 * Contractor-style pricing with material / labor divisors.
 *
 * Divisor model (common in HVAC / trades):
 *   sell = cost / divisor
 * e.g. material cost $600 with divisor 0.55 → sell materials ≈ $1,090.91
 *
 * Markup % equivalent: markupPct = (1 / divisor - 1) * 100
 *
 * Gross profit per man-day (optional, default 0):
 *   Adds a target profit pool from labor hours (and material proxy when
 *   equipment-heavy / low hours) so managers can stay competitive while
 *   protecting margin. Applied globally via owner settings.
 */

export type CostBreakdown = {
  materialCost: number;
  laborHours: number;
  laborRate: number;
  /** 0–1 exclusive typical; sell_mat = materialCost / materialDivisor */
  materialDivisor: number;
  /** sell_lab = (laborHours * laborRate) / laborDivisor */
  laborDivisor: number;
  /** When "auto", unitPrice is derived from costs + divisors. */
  priceMode: "auto" | "manual";
  /**
   * Target gross profit dollars per man-day (8 labor hours).
   * 0 = off (default). Applied on top of divisor-based sells.
   */
  grossProfitPerManDay?: number;
  /**
   * How to weight the man-day GP pool between materials vs labor.
   * equipment_heavy → more on materials; labor_heavy → more on labor.
   */
  pricingMix?: PricingMix;
};

/** How company-wide GP / man-day is allocated into material vs labor sell. */
export type PricingMix = "balanced" | "equipment_heavy" | "labor_heavy";

export const DEFAULT_LABOR_RATE = 95;
/** ~45% gross on materials when divisor 0.55 */
export const DEFAULT_MATERIAL_DIVISOR = 0.55;
/** ~60% gross on labor when divisor 0.40 */
export const DEFAULT_LABOR_DIVISOR = 0.4;
/** Hours in one man-day for GP target math */
export const HOURS_PER_MAN_DAY = 8;

export const PRICING_MIX_WEIGHTS: Record<
  PricingMix,
  { material: number; labor: number }
> = {
  balanced: { material: 0.4, labor: 0.6 },
  equipment_heavy: { material: 0.75, labor: 0.25 },
  labor_heavy: { material: 0.2, labor: 0.8 },
};

export function clampDivisor(d: number): number {
  if (!Number.isFinite(d) || d <= 0) return 0.01;
  if (d >= 1) return 0.99;
  return d;
}

export function laborCost(hours: number, rate: number): number {
  return Math.max(0, hours) * Math.max(0, rate);
}

export function sellFromCost(cost: number, divisor: number): number {
  const c = Math.max(0, cost);
  if (c === 0) return 0;
  return c / clampDivisor(divisor);
}

export function divisorToMarkupPct(divisor: number): number {
  const d = clampDivisor(divisor);
  return (1 / d - 1) * 100;
}

export function markupPctToDivisor(markupPct: number): number {
  const m = Math.max(0, markupPct) / 100;
  return clampDivisor(1 / (1 + m));
}

/**
 * Allocate a man-day gross-profit target across material and labor sell.
 * When G = 0, returns zeros (no change to base divisor pricing).
 */
export function manDayGrossProfitPool(opts: {
  materialCost: number;
  laborHours: number;
  grossProfitPerManDay: number;
  pricingMix?: PricingMix;
}): {
  materialGp: number;
  laborGp: number;
  totalGp: number;
  manDays: number;
} {
  const G = Math.max(0, Number(opts.grossProfitPerManDay) || 0);
  if (G <= 0) {
    return { materialGp: 0, laborGp: 0, totalGp: 0, manDays: 0 };
  }
  const mix: PricingMix = opts.pricingMix || "balanced";
  const w = PRICING_MIX_WEIGHTS[mix];
  const hours = Math.max(0, Number(opts.laborHours) || 0);
  const matCost = Math.max(0, Number(opts.materialCost) || 0);
  let manDays = hours / HOURS_PER_MAN_DAY;

  // Equipment-heavy / pure material lines still need a GP path when hours are low.
  if (hours < 0.25 && matCost > 0) {
    // Implied man-days from material volume (tunable later from Financials).
    const implied =
      mix === "equipment_heavy"
        ? matCost / 2000
        : mix === "balanced"
          ? matCost / 4000
          : 0;
    manDays = Math.max(manDays, implied);
  }

  const totalGp = manDays * G;
  return {
    materialGp: totalGp * w.material,
    laborGp: totalGp * w.labor,
    totalGp,
    manDays,
  };
}

export function measureCostParts(
  c: Pick<
    CostBreakdown,
    | "materialCost"
    | "laborHours"
    | "laborRate"
    | "materialDivisor"
    | "laborDivisor"
    | "grossProfitPerManDay"
    | "pricingMix"
  >,
) {
  const matCost = Math.max(0, c.materialCost || 0);
  const hours = Math.max(0, c.laborHours || 0);
  const rate = Math.max(0, c.laborRate || 0);
  const labCost = laborCost(hours, rate);
  let matSell = sellFromCost(
    matCost,
    c.materialDivisor ?? DEFAULT_MATERIAL_DIVISOR,
  );
  let labSell = sellFromCost(labCost, c.laborDivisor ?? DEFAULT_LABOR_DIVISOR);

  const gp = manDayGrossProfitPool({
    materialCost: matCost,
    laborHours: hours,
    grossProfitPerManDay: c.grossProfitPerManDay ?? 0,
    pricingMix: c.pricingMix,
  });
  matSell += gp.materialGp;
  labSell += gp.laborGp;

  const totalCost = matCost + labCost;
  const totalSell = matSell + labSell;
  const margin = totalSell - totalCost;
  const marginPct = totalSell > 0 ? (margin / totalSell) * 100 : 0;
  return {
    matCost,
    hours,
    rate,
    labCost,
    matSell,
    labSell,
    totalCost,
    totalSell,
    margin,
    marginPct,
    gpAllocated: gp.totalGp,
    manDays: gp.manDays,
  };
}

/** Selling unit price from costs (quantity is applied outside). */
export function autoUnitPrice(c: CostBreakdown): number {
  const { totalSell } = measureCostParts(c);
  return Math.round(totalSell * 100) / 100;
}

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}
