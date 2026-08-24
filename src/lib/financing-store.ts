/**
 * Backend-editable financing programs.
 * New proposals clone from here; signing always shows proposal options
 * (so a sent quote stays stable) while Backend controls the living catalog.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { FinancingOption, FinancingType } from "./rebates-financing";
import { formatMeasureTitle } from "./title-case";

export type FinancingProgram = FinancingOption & {
  sortOrder: number;
  /** Internal manager note — not customer-facing */
  managerNote?: string;
};

const now = () => new Date().toISOString();

export const FACTORY_FINANCING: FinancingProgram[] = [
  {
    id: "fin_cash",
    name: "Pay in Full",
    provider: "Cash / check / card",
    type: "cash",
    description:
      "No finance charges. Pay by cash, check, or card per your agreement. Pay-by-check discount may apply when offered on this proposal.",
    rateNote: "0% · paid at completion",
    termMonths: null,
    monthlyEstimate: null,
    featured: false,
    enabled: true,
    sortOrder: 0,
    managerNote: "Always offer unless company policy changes.",
  },
  {
    id: "fin_sac_12",
    name: "12-Month Same as Cash",
    provider: "Consumer financing partner",
    type: "same_as_cash",
    description:
      "No interest if paid in full within the promotional period. After the promo window, deferred interest may apply per lender terms. Subject to credit approval.",
    rateNote: "0% if paid in 12 months",
    termMonths: 12,
    monthlyEstimate: null,
    featured: false,
    enabled: true,
    sortOrder: 1,
    managerNote: "Update rateNote when promo terms change.",
  },
  {
    id: "fin_install_60",
    name: "60-Month Fixed Installment",
    provider: "Consumer financing partner",
    type: "installment",
    description:
      "Fixed monthly payments for budget-friendly comfort upgrades. Rate and payment depend on credit tier and approval. Not a commitment until lender docs are signed.",
    rateNote: "Rates from ~6.99% APR (credit-based)",
    termMonths: 60,
    monthlyEstimate: null,
    featured: false,
    enabled: true,
    sortOrder: 2,
  },
  {
    id: "fin_install_120",
    name: "120-Month Installment",
    provider: "Consumer financing partner",
    type: "installment",
    description:
      "Longer term for lower estimated monthly payment on larger projects. Subject to credit approval and lender underwriting.",
    rateNote: "Longer term · credit-based APR",
    termMonths: 120,
    monthlyEstimate: null,
    featured: false,
    enabled: true,
    sortOrder: 3,
  },
  {
    id: "fin_pace",
    name: "PACE Financing",
    provider: "PACE (Property Assessed Clean Energy)",
    type: "pace",
    description:
      "Finance eligible energy-efficiency improvements through a voluntary assessment on your property tax bill. Repayment typically stays with the property if you sell (program rules apply). Not a traditional home-equity cash-out loan — it is a land-secured assessment. Availability varies by city/county in California. Subject to program eligibility, disclosures, and cooling-off rules.",
    rateNote: "Repaid via property tax · term often 10–20+ years",
    termMonths: 180,
    monthlyEstimate: null,
    featured: true,
    enabled: true,
    sortOrder: 4,
    managerNote: "Confirm local PACE program is open before enabling.",
  },
  {
    id: "fin_heloc",
    name: "Home Equity / HELOC Partner",
    provider: "Bank or credit-union partner",
    type: "heloc_partner",
    description:
      "Use available home equity through a partner lender when you prefer a bank relationship. Terms, rates, and closing costs vary. Subject to underwriting and property eligibility.",
    rateNote: "Variable or fixed · credit & LTV based",
    termMonths: null,
    monthlyEstimate: null,
    featured: false,
    enabled: true,
    sortOrder: 5,
  },
];

function cloneFactory(): FinancingProgram[] {
  return JSON.parse(JSON.stringify(FACTORY_FINANCING));
}

function rid() {
  return `fin_${Math.random().toString(36).slice(2, 10)}`;
}

type State = {
  programs: FinancingProgram[];
  updatedAt: string;
  list: () => FinancingProgram[];
  /** Enabled programs sorted — cloned for a new proposal */
  catalogForProposal: () => FinancingOption[];
  upsert: (program: FinancingProgram) => void;
  update: (id: string, patch: Partial<FinancingProgram>) => void;
  remove: (id: string) => void;
  reorder: (id: string, dir: "up" | "down") => void;
  setEnabled: (id: string, enabled: boolean) => void;
  addBlank: () => string;
  resetAll: () => void;
};

export const useFinancingStore = create<State>()(
  persist(
    (set, get) => ({
      programs: cloneFactory(),
      updatedAt: now(),

      list: () =>
        [...get().programs].sort(
          (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
        ),

      catalogForProposal: () => {
        return get()
          .list()
          .filter((p) => p.enabled)
          .map(
            ({
              id,
              name,
              provider,
              type,
              description,
              rateNote,
              termMonths,
              monthlyEstimate,
              featured,
              enabled,
              applyUrl,
            }): FinancingOption => ({
              id,
              name,
              provider,
              type,
              description,
              rateNote,
              termMonths,
              monthlyEstimate,
              featured,
              enabled,
              applyUrl,
            }),
          );
      },

      upsert: (program) => {
        const list = get().programs;
        const i = list.findIndex((p) => p.id === program.id);
        const next =
          i >= 0
            ? list.map((p) => (p.id === program.id ? program : p))
            : [...list, program];
        set({ programs: next, updatedAt: now() });
      },

      update: (id, patch) => {
        set({
          programs: get().programs.map((p) => {
            if (p.id !== id) return p;
            const next = { ...p, ...patch };
            if (patch.name != null) {
              next.name = formatMeasureTitle(patch.name);
            }
            if (patch.termMonths !== undefined) {
              next.termMonths =
                patch.termMonths == null || Number.isNaN(Number(patch.termMonths))
                  ? null
                  : Math.max(0, Math.round(Number(patch.termMonths)));
            }
            if (patch.monthlyEstimate !== undefined) {
              next.monthlyEstimate =
                patch.monthlyEstimate == null
                  ? null
                  : Math.max(0, Number(patch.monthlyEstimate) || 0);
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
        [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
        set({
          programs: sorted.map((p, idx) => ({ ...p, sortOrder: idx })),
          updatedAt: now(),
        });
      },

      setEnabled: (id, enabled) => {
        get().update(id, { enabled });
      },

      addBlank: () => {
        const id = rid();
        const maxOrder = get().programs.reduce(
          (m, p) => Math.max(m, p.sortOrder ?? 0),
          0,
        );
        get().upsert({
          id,
          name: "New Financing Program",
          provider: "Partner lender",
          type: "installment",
          description:
            "Describe eligibility, repayment, and what the homeowner should expect.",
          rateNote: "See current rate sheet",
          termMonths: 60,
          monthlyEstimate: null,
          featured: false,
          enabled: true,
          sortOrder: maxOrder + 1,
          managerNote: "",
        });
        return id;
      },

      resetAll: () => set({ programs: cloneFactory(), updatedAt: now() }),
    }),
    {
      name: "aarvaks-financing-programs-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        programs: s.programs,
        updatedAt: s.updatedAt,
      }),
      merge: (persisted, current) => {
        const p = persisted as
          | { programs?: FinancingProgram[]; updatedAt?: string }
          | undefined;
        if (!p?.programs?.length) return current;
        // Keep factory ids; merge unknown custom programs
        const byId = new Map(p.programs.map((x) => [x.id, x]));
        const merged: FinancingProgram[] = [];
        const seen = new Set<string>();
        for (const f of FACTORY_FINANCING) {
          const saved = byId.get(f.id);
          merged.push(
            saved
              ? {
                  ...f,
                  enabled: saved.enabled,
                  rateNote: saved.rateNote || f.rateNote,
                  applyUrl: saved.applyUrl || f.applyUrl,
                }
              : { ...f },
          );
          seen.add(f.id);
        }
        for (const s of p.programs) {
          if (!seen.has(s.id)) merged.push(s);
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

/** Live catalog for new proposals (enabled only) */
export function getFinancingCatalogForProposal(): FinancingOption[] {
  return useFinancingStore.getState().catalogForProposal();
}

export const FINANCING_TYPE_LABELS: Record<FinancingType, string> = {
  cash: "Pay in full",
  same_as_cash: "Same as cash / promo",
  installment: "Installment loan",
  pace: "PACE assessment",
  heloc_partner: "HELOC / home equity",
};
