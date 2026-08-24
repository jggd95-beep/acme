/**
 * Instant vs deferred incentives, and customer financing choices (incl. PACE).
 *
 * Instant  → reduces the amount due on the contract (before-the-line / due now)
 * Deferred → customer receives later (tax credit, mail-in, pay-by-check after payment)
 *
 * Financing program catalog lives in financing-store (Backend → Financing).
 */
import { getFinancingCatalogForProposal } from "./financing-store";

export type RebateTiming = "instant" | "deferred";

export type RebateKind =
  | "utility"
  | "manufacturer"
  | "tax_credit"
  | "pay_by_check"
  | "promo"
  | "other";

/** Where this rebate may be offered. Empty lists = all locations. */
export type RebateLocationScope = {
  /** City names (case-insensitive), e.g. Berkeley, Oakland */
  cities?: string[];
  /** 5-digit ZIPs */
  zips?: string[];
  /** County names without "County", e.g. Alameda, Contra Costa */
  counties?: string[];
};

/** Equipment / situation tags for advisor filtering */
export type RebateEquipmentTag =
  | "any"
  | "furnace"
  | "gas_furnace"
  | "water_heater"
  | "heat_pump"
  | "ac"
  | "ductless"
  | "hpwh"
  | "buyback";

export type Rebate = {
  id: string;
  name: string;
  description: string;
  /** Fixed dollars off, or percent of measure subtotal before tax. */
  amountType: "fixed" | "percent";
  amount: number;
  timing: RebateTiming;
  kind: RebateKind;
  /** Offered on this quote */
  enabled: boolean;
  /** Customer must opt in (e.g. pay by check) */
  requiresCustomerOptIn: boolean;
  /** Pre-checked when requiresCustomerOptIn */
  defaultSelected: boolean;
  customerSelected?: boolean;
  /**
   * Location limits — only show when property matches city, ZIP, or county.
   * Omit or leave empty = available everywhere.
   */
  location?: RebateLocationScope;
  /**
   * Only offer when the quote includes matching equipment / buyback situation.
   * Empty or ["any"] = always eligible (location still applies).
   */
  equipmentTags?: RebateEquipmentTag[];
  /**
   * Optional tighter match — specific catalog products.
   * Empty = any product that already passed equipmentTags.
   */
  productIds?: string[];
  /**
   * Optional SKU / SKU prefix list (case-insensitive).
   * Empty = no SKU filter. Lets a program attach to “Carrier 25VNA3…” without
   * listing every catalog id.
   */
  skus?: string[];
  /**
   * Program list keys (ENERGY STAR, AHRI, “seer2_16”, series names).
   * Matched against product sku / matchKey / tierLabel. Empty = no key filter.
   */
  qualifyingKeys?: string[];
  /** Advisor can change the $ / % on the quote before finish */
  advisorAdjustable?: boolean;
  minAmount?: number;
  maxAmount?: number;
};

export type FinancingType =
  | "same_as_cash"
  | "installment"
  | "pace"
  | "heloc_partner"
  | "cash";

export type FinancingOption = {
  id: string;
  name: string;
  provider: string;
  type: FinancingType;
  description: string;
  /** e.g. "0% for 12 months" or "as low as 5.99% APR" */
  rateNote: string;
  termMonths: number | null;
  /** Optional estimated monthly for display (0 = calc from balance). */
  monthlyEstimate: number | null;
  /** Highlight PACE / featured */
  featured: boolean;
  enabled: boolean;
  /** Optional lender apply URL — Present / signing can open this. */
  applyUrl?: string;
};

export type InvestmentStack = {
  measuresSubtotal: number;
  discount: number;
  taxableAfterDiscount: number;
  tax: number;
  /** After measures, job discount, tax — before any rebates */
  contractGross: number;
  instantRebates: { rebate: Rebate; dollars: number }[];
  instantTotal: number;
  /** What customer owes Acme HVAC now (after instant incentives) */
  amountDueNow: number;
  deferredRebates: { rebate: Rebate; dollars: number }[];
  deferredTotal: number;
  /** Illustrative net after deferred incentives land */
  netAfterAllIncentives: number;
};

function rid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Default rebates for new proposals — always from Backend → Rebates.
 * Stable ids; full list (including disabled) so advisors can re-enable per quote.
 */
export function defaultRebates(): Rebate[] {
  return [];
}

/**
 * Default financing for new proposals — always from Backend → Financing.
 * Stable ids so selection survives edit/sign. Falls back to factory if store empty.
 */
export function defaultFinancingOptions(): FinancingOption[] {
  try {
    const list = getFinancingCatalogForProposal();
    if (list?.length) return list.map((f) => ({ ...f }));
  } catch {
    /* store unavailable during early init */
  }
  return [
    {
      id: "fin_cash",
      name: "Pay in Full",
      provider: "Cash / check / card",
      type: "cash",
      description:
        "No finance charges. Pay-by-check discount may apply when offered.",
      rateNote: "0% · paid at completion",
      termMonths: null,
      monthlyEstimate: null,
      featured: false,
      enabled: true,
    },
    {
      id: "fin_sac_12",
      name: "12-Month Same as Cash",
      provider: "Consumer financing partner",
      type: "same_as_cash",
      description:
        "No interest if paid in full within the promotional period. Subject to credit approval.",
      rateNote: "0% if paid in 12 months",
      termMonths: 12,
      monthlyEstimate: null,
      featured: false,
      enabled: true,
    },
    {
      id: "fin_install_60",
      name: "60-Month Fixed Installment",
      provider: "Consumer financing partner",
      type: "installment",
      description: "Fixed monthly payments for budget-friendly comfort upgrades.",
      rateNote: "Rates from ~6.99% APR (credit-based)",
      termMonths: 60,
      monthlyEstimate: null,
      featured: false,
      enabled: true,
    },
    {
      id: "fin_pace",
      name: "PACE Financing",
      provider: "PACE (Property Assessed Clean Energy)",
      type: "pace",
      description:
        "Finance eligible energy-efficiency improvements through a voluntary assessment on your property tax bill. Repayment stays with the property if you sell (program rules apply). Not a traditional home-equity cash-out loan; it's a land-secured assessment. Availability varies by city/county in California.",
      rateNote: "Repaid via property tax · term often 10–20+ years",
      termMonths: 180,
      monthlyEstimate: null,
      featured: true,
      enabled: true,
    },
  ];
}

export function rebateDollars(
  rebate: Rebate,
  basis: number,
): number {
  if (!rebate.enabled) return 0;
  const b = Math.max(0, basis);
  if (rebate.amountType === "percent") {
    return Math.round(b * (Math.max(0, rebate.amount) / 100) * 100) / 100;
  }
  return Math.min(Math.max(0, rebate.amount), b);
}

export function isRebateActive(
  rebate: Rebate,
  selectedOptInIds?: Set<string> | string[],
): boolean {
  if (!rebate.enabled) return false;
  if (!rebate.requiresCustomerOptIn) return true;
  const selected =
    selectedOptInIds instanceof Set
      ? selectedOptInIds
      : selectedOptInIds
        ? new Set(selectedOptInIds)
        : null;
  if (selected) return selected.has(rebate.id);
  if (rebate.customerSelected !== undefined) return rebate.customerSelected;
  return rebate.defaultSelected;
}

export function buildInvestmentStack(opts: {
  measuresSubtotal: number;
  discount: number;
  taxRate: number;
  rebates: Rebate[];
  /** Opt-in rebate ids (pay-by-check, etc.) */
  selectedRebateIds?: Set<string> | string[];
}): InvestmentStack {
  const measuresSubtotal = Math.max(0, opts.measuresSubtotal);
  const discount = Math.min(Math.max(0, opts.discount), measuresSubtotal);
  const taxableAfterDiscount = Math.max(measuresSubtotal - discount, 0);
  const tax = taxableAfterDiscount * (Math.max(0, opts.taxRate) / 100);
  const contractGross = taxableAfterDiscount + tax;

  const active = (opts.rebates || []).filter(
    (r) =>
      r.kind !== "tax_credit" &&
      !/federal|tax credit|25c|ira energy/i.test(r.name + " " + (r.description || "")) &&
      isRebateActive(r, opts.selectedRebateIds),
  );

  // Instant rebates reduce amount due now (applied after tax for simplicity, capped)
  let remaining = contractGross;
  const instantRebates: InvestmentStack["instantRebates"] = [];
  for (const r of active.filter((x) => x.timing === "instant")) {
    const dollars = Math.min(rebateDollars(r, remaining), remaining);
    if (dollars <= 0) continue;
    instantRebates.push({ rebate: r, dollars });
    remaining -= dollars;
  }
  const instantTotal = instantRebates.reduce((s, x) => s + x.dollars, 0);
  const amountDueNow = Math.max(0, contractGross - instantTotal);

  // Deferred: illustrative only — basis often pre-tax equipment; use measures subtotal
  const deferredRebates: InvestmentStack["deferredRebates"] = [];
  let deferredTotal = 0;
  for (const r of active.filter((x) => x.timing === "deferred")) {
    const basis =
      r.kind === "tax_credit" ? taxableAfterDiscount : amountDueNow;
    const dollars = rebateDollars(r, basis);
    if (dollars <= 0) continue;
    deferredRebates.push({ rebate: r, dollars });
    deferredTotal += dollars;
  }

  return {
    measuresSubtotal,
    discount,
    taxableAfterDiscount,
    tax,
    contractGross,
    instantRebates,
    instantTotal,
    amountDueNow,
    deferredRebates,
    deferredTotal,
    netAfterAllIncentives: Math.max(0, amountDueNow - deferredTotal),
  };
}

export function estimateMonthly(balance: number, termMonths: number | null): number | null {
  if (!termMonths || termMonths <= 0 || balance <= 0) return null;
  // Simple illustrative payment (not a Truth-in-Lending quote)
  return Math.round((balance / termMonths) * 100) / 100;
}

export function emptyRebate(timing: RebateTiming = "instant"): Rebate {
  return {
    id: rid("rb"),
    name: timing === "instant" ? "Instant rebate" : "Deferred incentive",
    description: "",
    amountType: "fixed",
    amount: 0,
    timing,
    kind: "other",
    enabled: true,
    requiresCustomerOptIn: false,
    defaultSelected: true,
  };
}
