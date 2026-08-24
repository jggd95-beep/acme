/**
 * Backend-editable rebate / incentive catalog.
 * New proposals clone enabled programs; managers add, edit, disable, remove.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Rebate, RebateKind, RebateTiming } from "./rebates-financing";
import { formatMeasureTitle } from "./title-case";

export type RebateProgram = Rebate & {
  sortOrder: number;
  /** Internal note for managers */
  managerNote?: string;
  /** Optional end / season note shown to advisors only */
  seasonNote?: string;
};

const now = () => new Date().toISOString();

export const FACTORY_REBATES: RebateProgram[] = [
  {
    id: "rb_gsr_hpwh_gas",
    name: "Golden State Rebates — heat pump water heater (gas replacement)",
    description:
      "PG&E instant rebate when a gas storage tank is replaced with a qualifying heat pump water heater (UEF 3.30+). Typical $600–$700 by tank size. Program currently runs through July 31, 2026.",
    amountType: "fixed",
    amount: 650,
    timing: "instant",
    kind: "utility",
    enabled: true,
    requiresCustomerOptIn: false,
    defaultSelected: false,
    sortOrder: 0,
    equipmentTags: ["hpwh", "water_heater"],
    advisorAdjustable: true,
    minAmount: 400,
    maxAmount: 700,
    seasonNote: "Confirm current Golden State table and July 31, 2026 end date.",
    managerNote:
      "PG&E / Golden State. Contra Costa and Marin are in PG&E territory. Advisor picks $400–$700 to match tank size.",
  },
  {
    id: "rb_gsr_hpwh_electric",
    name: "Golden State Rebates — heat pump water heater (electric replacement)",
    description:
      "PG&E instant rebate when an electric storage tank is replaced with a qualifying heat pump water heater. $400. Through July 31, 2026.",
    amountType: "fixed",
    amount: 400,
    timing: "instant",
    kind: "utility",
    enabled: true,
    requiresCustomerOptIn: false,
    defaultSelected: false,
    sortOrder: 1,
    equipmentTags: ["hpwh", "water_heater"],
    advisorAdjustable: true,
    minAmount: 0,
    maxAmount: 400,
    managerNote: "Use this OR the gas-replacement Golden State line — not both.",
  },
  {
    id: "rb_25c_heat_pump",
    name: "Federal 25C tax credit — heat pump",
    description:
      "Federal energy-efficient home improvement credit: 30% of qualifying cost, up to $2,000, for a qualifying heat pump. Claimed on their tax return — not taken off this contract.",
    amountType: "fixed",
    amount: 2000,
    timing: "deferred",
    kind: "tax_credit",
    enabled: true,
    requiresCustomerOptIn: false,
    defaultSelected: false,
    sortOrder: 2,
    equipmentTags: ["heat_pump", "ductless"],
    advisorAdjustable: true,
    minAmount: 0,
    maxAmount: 2000,
    managerNote: "Post / tax credit. Advisor may lower $ if the job is smaller.",
  },
  {
    id: "rb_25c_hpwh",
    name: "Federal 25C tax credit — heat pump water heater",
    description:
      "Federal credit: 30% of qualifying cost, up to $2,000, for a qualifying heat pump water heater. Claimed at tax time.",
    amountType: "fixed",
    amount: 2000,
    timing: "deferred",
    kind: "tax_credit",
    enabled: true,
    requiresCustomerOptIn: false,
    defaultSelected: false,
    sortOrder: 3,
    equipmentTags: ["hpwh"],
    advisorAdjustable: true,
    minAmount: 0,
    maxAmount: 2000,
    managerNote: "Only when the water heater on the job is a heat pump / hybrid.",
  },
  {
    id: "rb_mce_hp",
    name: "MCE — heat pump HVAC (Marin / Contra Costa)",
    description:
      "Marin Clean Energy incentive for a qualifying heat pump HVAC when MCE is the electricity provider. Amount changes — your advisor confirms the current table and stacks it with other programs when allowed.",
    amountType: "fixed",
    amount: 1000,
    timing: "deferred",
    kind: "utility",
    enabled: true,
    requiresCustomerOptIn: false,
    defaultSelected: false,
    sortOrder: 4,
    location: { counties: ["Marin", "Contra Costa"] },
    equipmentTags: ["heat_pump", "ductless"],
    advisorAdjustable: true,
    minAmount: 0,
    maxAmount: 8000,
    seasonNote: "Confirm on MCE Incentive Finder before presenting a dollar amount.",
    managerNote: "MCE territory: Marin County and much of Contra Costa. Turn off if the house is bundled PG&E only.",
  },
  {
    id: "rb_mce_hpwh",
    name: "MCE — heat pump water heater (Marin / Contra Costa)",
    description:
      "Marin Clean Energy incentive for a qualifying heat pump water heater for MCE customers. Advisor confirms the current amount.",
    amountType: "fixed",
    amount: 1000,
    timing: "deferred",
    kind: "utility",
    enabled: true,
    requiresCustomerOptIn: false,
    defaultSelected: false,
    sortOrder: 5,
    location: { counties: ["Marin", "Contra Costa"] },
    equipmentTags: ["hpwh"],
    advisorAdjustable: true,
    minAmount: 0,
    maxAmount: 5000,
    managerNote: "Same MCE territory note as the HVAC line.",
  },
  {
    id: "rb_pinole_peer",
    name: "Pinole Energy Enhancement (PEER)",
    description:
      "City of Pinole rebate for qualifying all-electric upgrades, including heat pump HVAC and heat pump water heaters. Up to $3,000 per upgrade. Open through December 31, 2026 or until funds run out.",
    amountType: "fixed",
    amount: 3000,
    timing: "deferred",
    kind: "utility",
    enabled: true,
    requiresCustomerOptIn: false,
    defaultSelected: false,
    sortOrder: 6,
    location: { cities: ["Pinole"], zips: ["94564"] },
    equipmentTags: ["heat_pump", "ductless", "hpwh"],
    advisorAdjustable: true,
    minAmount: 0,
    maxAmount: 3000,
    managerNote: "Pinole residents only.",
  },
  {
    id: "rb_clean_heet",
    name: "Bay Area Air District — Clean HEET (wood to heat pump)",
    description:
      "Incentive to replace a wood-burning stove, fireplace, or insert with an electric heat pump. Bay Area homeowners. First-come funds.",
    amountType: "fixed",
    amount: 1000,
    timing: "deferred",
    kind: "utility",
    enabled: true,
    requiresCustomerOptIn: false,
    defaultSelected: false,
    sortOrder: 7,
    location: { counties: ["Marin", "Contra Costa", "Alameda"] },
    equipmentTags: ["heat_pump", "ductless"],
    advisorAdjustable: true,
    minAmount: 0,
    maxAmount: 15000,
    managerNote: "Only when they are taking out wood heat. Confirm current Air District amount.",
  },
  {
    id: "rb_pay_by_check",
    name: "Pay-by-Check Discount",
    description:
      "Applied only if you pay the balance by personal or cashier's check (not card/financing). Credited after payment clears.",
    amountType: "fixed",
    amount: 200,
    timing: "deferred",
    kind: "pay_by_check",
    enabled: true,
    requiresCustomerOptIn: true,
    defaultSelected: false,
    sortOrder: 20,
    managerNote:
      "Must stay Post (deferred). Money is only real after they pay by check — never Pre.",
  },
  {
    id: "rb_carbon_buyback_500",
    name: "Gas equipment buyback — $500",
    description:
      "Company credit when we take out gas equipment and install a heat pump (carbon-free). Comes off this contract.",
    amountType: "fixed",
    amount: 500,
    timing: "instant",
    kind: "promo",
    enabled: true,
    requiresCustomerOptIn: false,
    defaultSelected: false,
    sortOrder: 18,
    equipmentTags: ["heat_pump", "ductless", "hpwh", "buyback"],
    advisorAdjustable: true,
    minAmount: 0,
    maxAmount: 500,
    managerNote:
      "Pick this OR the $1,000 buyback — not both. Advisor taps on the rebates page. Nothing pre-selected.",
  },
  {
    id: "rb_carbon_buyback_1000",
    name: "Gas equipment buyback — $1,000",
    description:
      "Larger company credit for a full gas-to-heat-pump conversion. Comes off this contract.",
    amountType: "fixed",
    amount: 1000,
    timing: "instant",
    kind: "promo",
    enabled: true,
    requiresCustomerOptIn: false,
    defaultSelected: false,
    sortOrder: 19,
    equipmentTags: ["heat_pump", "ductless", "hpwh", "buyback"],
    advisorAdjustable: true,
    minAmount: 0,
    maxAmount: 1000,
    managerNote:
      "Pick this OR the $500 buyback — not both. Advisor taps on the rebates page. Nothing pre-selected.",
  },
];

export const CARBON_BUYBACK_IDS = [
  "rb_carbon_buyback_500",
  "rb_carbon_buyback_1000",
] as const;

/** Old catalog rows — never merge back onto a quote or the Backend list. */
export const RETIRED_REBATE_PROGRAM_IDS = new Set([
  "rb_utility_instant",
  "rb_tech_clean_ca",
  "rb_heehr",
  "rb_gas_furnace_buyback",
  "rb_water_heater_buyback",
]);

function cloneFactory(): RebateProgram[] {
  return JSON.parse(JSON.stringify(FACTORY_REBATES));
}

function rid() {
  return `rb_${Math.random().toString(36).slice(2, 10)}`;
}

type State = {
  programs: RebateProgram[];
  updatedAt: string;
  list: () => RebateProgram[];
  catalogForProposal: () => Rebate[];
  update: (id: string, patch: Partial<RebateProgram>) => void;
  remove: (id: string) => void;
  reorder: (id: string, dir: "up" | "down") => void;
  addBlank: () => string;
  resetAll: () => void;
};

function toRebate(p: RebateProgram): Rebate {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    amountType: p.amountType,
    amount: p.amount,
    timing: p.timing,
    kind: p.kind,
    enabled: p.enabled,
    requiresCustomerOptIn: p.requiresCustomerOptIn,
    defaultSelected: p.defaultSelected,
    customerSelected: p.customerSelected,
    location: p.location,
    equipmentTags: p.equipmentTags,
    productIds: p.productIds,
    skus: p.skus,
    qualifyingKeys: p.qualifyingKeys,
    advisorAdjustable: p.advisorAdjustable,
    minAmount: p.minAmount,
    maxAmount: p.maxAmount,
  };
}

export const useRebatesStore = create<State>()(
  persist(
    (set, get) => ({
      programs: cloneFactory(),
      updatedAt: now(),

      list: () =>
        [...get().programs]
          .filter((p) => !RETIRED_REBATE_PROGRAM_IDS.has(p.id))
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),

      catalogForProposal: () =>
        get()
          .list()
          .map(toRebate)
          .map((r) => ({ ...r })),

      update: (id, patch) => {
        set({
          programs: get().programs.map((p) => {
            if (p.id !== id) return p;
            const next = { ...p, ...patch };
            if (patch.name != null) {
              next.name = formatMeasureTitle(patch.name);
            }
            if (patch.amount !== undefined) {
              next.amount = Math.max(0, Number(patch.amount) || 0);
            }
            return next;
          }),
          updatedAt: now(),
        });
      },

      remove: (id) => {
        set({
          programs: get().programs.filter((p) => p.id !== id),
          updatedAt: now(),
        });
      },

      reorder: (id, dir) => {
        const sorted = get().list();
        const i = sorted.findIndex((p) => p.id === id);
        if (i < 0) return;
        const j = dir === "up" ? i - 1 : i + 1;
        if (j < 0 || j >= sorted.length) return;
        const a = sorted[i];
        const b = sorted[j];
        const ao = a.sortOrder;
        a.sortOrder = b.sortOrder;
        b.sortOrder = ao;
        set({
          programs: get().programs.map((p) => {
            if (p.id === a.id) return a;
            if (p.id === b.id) return b;
            return p;
          }),
          updatedAt: now(),
        });
      },

      addBlank: () => {
        const id = rid();
        const maxOrder = get().programs.reduce(
          (m, p) => Math.max(m, p.sortOrder ?? 0),
          0,
        );
        const blank: RebateProgram = {
          id,
          name: "New rebate",
          description: "",
          amountType: "fixed",
          amount: 0,
          timing: "deferred",
          kind: "utility",
          enabled: true,
          requiresCustomerOptIn: false,
          defaultSelected: false,
          sortOrder: maxOrder + 1,
          managerNote: "",
          location: { cities: [], zips: [], counties: [] },
          equipmentTags: ["any"],
          advisorAdjustable: true,
          minAmount: 0,
          maxAmount: 5000,
        };
        set({
          programs: [...get().programs, blank],
          updatedAt: now(),
        });
        return id;
      },

      resetAll: () => set({ programs: cloneFactory(), updatedAt: now() }),
    }),
    {
      name: "aarvaks-rebates-catalog-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        programs: s.programs,
        updatedAt: s.updatedAt,
      }),
      merge: (persisted, current) => {
        const p = persisted as
          | { programs?: RebateProgram[]; updatedAt?: string }
          | undefined;
        if (!p?.programs?.length) return current;
        const byId = new Map(p.programs.map((x) => [x.id, x]));
        const merged: RebateProgram[] = [];
        const seen = new Set<string>();
        for (const f of FACTORY_REBATES) {
          const saved = byId.get(f.id);
          merged.push(
            saved
              ? {
                  ...f,
                  enabled: saved.enabled,
                  amount: saved.amount,
                  location: saved.location ?? f.location,
                  minAmount: saved.minAmount ?? f.minAmount,
                  maxAmount: saved.maxAmount ?? f.maxAmount,
                  defaultSelected: false,
                }
              : { ...f },
          );
          seen.add(f.id);
        }
        for (const s of p.programs) {
          if (seen.has(s.id)) continue;
          if (RETIRED_REBATE_PROGRAM_IDS.has(s.id)) continue;
          merged.push(s);
        }
        return {
          ...current,
          programs: merged,
          updatedAt: p.updatedAt || now(),
        };
      },
    },
  ),
);

export function getRebatesCatalogForProposal(): Rebate[] {
  return useRebatesStore.getState().catalogForProposal();
}

export const REBATE_KIND_LABELS: Record<RebateKind, string> = {
  utility: "Utility",
  manufacturer: "Manufacturer",
  tax_credit: "Tax credit",
  pay_by_check: "Pay-by-check",
  promo: "Company promo",
  other: "Other",
};

export const REBATE_TIMING_LABELS: Record<RebateTiming, string> = {
  instant: "Pre — reduces total due now",
  deferred: "Post — after payment / later credit",
};

export const REBATE_TIMING_SHORT: Record<RebateTiming, string> = {
  instant: "Pre",
  deferred: "Post",
};

export const REBATE_TIMING_HELP: Record<RebateTiming, string> = {
  instant: "Comes off the amount due on this contract.",
  deferred: "They get it later — tax credit, mail-in, or after a condition.",
};
