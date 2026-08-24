import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  DEFAULT_LABOR_DIVISOR,
  DEFAULT_LABOR_RATE,
  DEFAULT_MATERIAL_DIVISOR,
  clampDivisor,
  type PricingMix,
} from "./pricing";

/**
 * Testing: show labor + materials on each site-question chip.
 * Flip to false before live comfort-advisor use — they should not see
 * the adders on the buttons.
 */
export const SHOW_OPTION_COST_HINTS = false;

/**
 * Owner-controlled pricing controls (divisors + default labor rate +
 * gross profit per man-day target). Salespeople never edit these unless
 * Backend / owner unlock is active.
 *
 * Demo PIN: owner  (changeable in Owner settings)
 */
type OwnerSettingsState = {
  /** Session unlock — not persisted so lock returns after reload. */
  unlocked: boolean;
  pin: string;
  materialDivisor: number;
  laborDivisor: number;
  laborRate: number;
  /**
   * Target gross profit $ per man-day (8 hrs). Default 0 = off.
   * Flows into every auto-priced measure/option via the pricing pipeline.
   */
  grossProfitPerManDay: number;
  /**
   * equipment_heavy → more GP into material markup
   * labor_heavy → more GP into labor charge
   * balanced → split
   */
  pricingMix: PricingMix;
  /**
   * Field pictures on path questions (reconnect / alter / job path).
   * Default on. Owner can kill them from Backend.
   */
  visualPickers: boolean;
  /**
   * Markup on contractor-supplied work (asbestos, crane).
   * Advisor types what they were quoted; sell = cost × (1 + pct/100).
   */
  contractorMarkupPct: number;
  unlock: (pin: string) => boolean;
  lock: () => void;
  setPin: (pin: string) => void;
  setMaterialDivisor: (d: number) => void;
  setLaborDivisor: (d: number) => void;
  setLaborRate: (r: number) => void;
  setGrossProfitPerManDay: (n: number) => void;
  setPricingMix: (m: PricingMix) => void;
  setVisualPickers: (on: boolean) => void;
  setContractorMarkupPct: (n: number) => void;
};

export const useOwnerSettings = create<OwnerSettingsState>()(
  persist(
    (set, get) => ({
      unlocked: false,
      pin: "owner",
      materialDivisor: DEFAULT_MATERIAL_DIVISOR,
      laborDivisor: DEFAULT_LABOR_DIVISOR,
      laborRate: DEFAULT_LABOR_RATE,
      grossProfitPerManDay: 0,
      pricingMix: "balanced",
      visualPickers: true,
      contractorMarkupPct: 30,
      unlock: (attempt) => {
        const a = attempt.trim().toLowerCase();
        const stored = (get().pin || "owner").trim().toLowerCase();
        // "owner" always works so the console is never permanently locked
        if (a && (a === stored || a === "owner")) {
          set({ unlocked: true });
          return true;
        }
        return false;
      },
      lock: () => set({ unlocked: false }),
      setPin: (pin) => set({ pin: pin.trim() || "owner" }),
      setMaterialDivisor: (d) => set({ materialDivisor: clampDivisor(d) }),
      setLaborDivisor: (d) => set({ laborDivisor: clampDivisor(d) }),
      setLaborRate: (r) => set({ laborRate: Math.max(0, r) }),
      setGrossProfitPerManDay: (n) =>
        set({
          grossProfitPerManDay: Math.max(0, Number(n) || 0),
        }),
      setPricingMix: (m) => set({ pricingMix: m }),
      setVisualPickers: (on) => set({ visualPickers: Boolean(on) }),
      setContractorMarkupPct: (n) => {
        const v = Number(n);
        set({
          contractorMarkupPct: Number.isFinite(v)
            ? Math.min(200, Math.max(0, v))
            : 30,
        });
      },
    }),
    {
      name: "axme-owner-settings",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        pin: s.pin,
        materialDivisor: s.materialDivisor,
        laborDivisor: s.laborDivisor,
        laborRate: s.laborRate,
        grossProfitPerManDay: s.grossProfitPerManDay,
        pricingMix: s.pricingMix,
        visualPickers: s.visualPickers,
        contractorMarkupPct: s.contractorMarkupPct,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<OwnerSettingsState> | undefined;
        return {
          ...current,
          ...p,
          // Always start locked; never hydrate unlocked=true
          unlocked: false,
          grossProfitPerManDay: Math.max(
            0,
            Number(p?.grossProfitPerManDay) || 0,
          ),
          pricingMix:
            p?.pricingMix === "equipment_heavy" ||
            p?.pricingMix === "labor_heavy" ||
            p?.pricingMix === "balanced"
              ? p.pricingMix
              : "balanced",
          visualPickers: p?.visualPickers !== false,
          contractorMarkupPct: (() => {
            const n = Number(p?.contractorMarkupPct);
            return Number.isFinite(n) ? Math.min(200, Math.max(0, n)) : 30;
          })(),
        };
      },
    },
  ),
);

/** Snapshot used by pricing pipeline — safe outside React. */
export function getOwnerPricingSnapshot(): {
  materialDivisor: number;
  laborDivisor: number;
  laborRate: number;
  grossProfitPerManDay: number;
  pricingMix: PricingMix;
  contractorMarkupPct: number;
} {
  try {
    const s = useOwnerSettings.getState();
    return {
      materialDivisor: s.materialDivisor,
      laborDivisor: s.laborDivisor,
      laborRate: s.laborRate,
      grossProfitPerManDay: s.grossProfitPerManDay ?? 0,
      pricingMix: s.pricingMix || "balanced",
      contractorMarkupPct:
        s.contractorMarkupPct == null ? 30 : Number(s.contractorMarkupPct) || 0,
    };
  } catch {
    return {
      materialDivisor: DEFAULT_MATERIAL_DIVISOR,
      laborDivisor: DEFAULT_LABOR_DIVISOR,
      laborRate: DEFAULT_LABOR_RATE,
      grossProfitPerManDay: 0,
      pricingMix: "balanced",
      contractorMarkupPct: 30,
    };
  }
}

/** What we sell a sub’s invoice for. Owner sets the percent in Backend. */
export function contractorSellFromCost(cost: number, pct?: number): number {
  const n = Number(cost) || 0;
  const p =
    pct == null
      ? getOwnerPricingSnapshot().contractorMarkupPct
      : Number(pct);
  const rate = Number.isFinite(p) ? p : 30;
  return Math.round(n * (1 + rate / 100) * 100) / 100;
}

/** Short customer-facing benefits from long datasheet / marketing copy. */
export function condenseBenefits(
  text: string,
  maxItems = 5,
  maxLen = 90,
): string[] {
  if (!text.trim()) return [];
  const chunks = text
    .split(/\n+|•|\u2022|;|\|(?=\s)|\.\s+(?=[A-Z])/)
    .map((s) => s.replace(/^[-–—*]\s*/, "").trim())
    .filter((s) => s.length >= 8 && s.length <= 200);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of chunks) {
    const key = c.toLowerCase();
    if (seen.has(key)) continue;
    // Prefer benefit-like phrases
    const looksLikeFeature =
      /energy|quiet|warranty|efficient|comfort|save|protect|smart|filter|heat|cool|install|reliable|rebate|afue|seer|labor|air/i.test(
        c,
      ) || c.length <= maxLen;
    if (!looksLikeFeature && chunks.length > 3) continue;
    seen.add(key);
    out.push(c.length > maxLen ? `${c.slice(0, maxLen - 1).trim()}…` : c);
    if (out.length >= maxItems) break;
  }
  if (out.length === 0) {
    const one = text.replace(/\s+/g, " ").trim();
    if (one) out.push(one.length > maxLen ? `${one.slice(0, maxLen - 1)}…` : one);
  }
  return out;
}

/** Pull a work-scope paragraph from datasheet paste (longer operational sentences). */
export function extractWorkScope(text: string, maxLen = 480): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  // Prefer sentences that sound like install / scope
  const sentences = cleaned.split(/(?<=[.!?])\s+/);
  const scopey = sentences.filter((s) =>
    /install|remove|set|connect|startup|test|permit|haul|mount|wire|charge|evacuate|commission|replace|duct/i.test(
      s,
    ),
  );
  const body = (scopey.length ? scopey : sentences).join(" ").trim();
  return body.length > maxLen ? `${body.slice(0, maxLen - 1).trim()}…` : body;
}

/** Parse CSV price list (header row required). */
export function parseProductCsv(raw: string): {
  name: string;
  sku: string;
  category: string;
  description: string;
  unitPrice: number;
  unit: string;
  benefits: string[];
  workScope: string;
  materialCost?: number;
  laborHours?: number;
}[] {
  const lines = raw
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim());
  if (lines.length < 2) return [];

  const split = (line: string) => {
    const cells: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = !inQ;
      } else if (ch === "," && !inQ) {
        cells.push(cur.trim());
        cur = "";
      } else cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  };

  const headers = split(lines[0]!).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const idx = (names: string[]) => {
    for (const n of names) {
      const i = headers.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  };

  const iName = idx(["name", "product", "product_name", "model", "description_name"]);
  const iSku = idx(["sku", "model_number", "part", "part_number", "item"]);
  const iCat = idx(["category", "type", "family", "group"]);
  const iDesc = idx(["description", "desc", "notes", "long_description"]);
  const iPrice = idx(["unitprice", "unit_price", "price", "list", "list_price", "sell"]);
  const iUnit = idx(["unit", "uom"]);
  const iBen = idx(["benefits", "benefit", "features", "selling_points"]);
  const iScope = idx(["work_scope", "workscope", "scope", "install_scope", "labor_scope"]);
  const iMat = idx(["material_cost", "materialcost", "cost", "dealer_cost"]);
  const iHrs = idx(["labor_hours", "laborhours", "hours", "labor_hrs"]);

  if (iName < 0 && iDesc < 0) return [];

  const out: ReturnType<typeof parseProductCsv> = [];
  for (let r = 1; r < lines.length; r++) {
    const cells = split(lines[r]!);
    const name = (iName >= 0 ? cells[iName] : "") || (iDesc >= 0 ? cells[iDesc] : "");
    if (!name?.trim()) continue;
    const desc = iDesc >= 0 ? cells[iDesc] || "" : "";
    const benefitsRaw = iBen >= 0 ? cells[iBen] || "" : "";
    const benefits = benefitsRaw
      ? benefitsRaw.split(/[;|]/).map((b) => b.trim()).filter(Boolean)
      : condenseBenefits(desc || name);
    const workScope =
      (iScope >= 0 ? cells[iScope] || "" : "") ||
      extractWorkScope(desc);
    out.push({
      name: name.trim(),
      sku: (iSku >= 0 ? cells[iSku] : "") || "",
      category: (iCat >= 0 ? cells[iCat] : "") || "Imported",
      description: desc.trim(),
      unitPrice: Math.max(0, Number((iPrice >= 0 ? cells[iPrice] : "0")?.replace(/[$,]/g, "")) || 0),
      unit: (iUnit >= 0 ? cells[iUnit] : "") || "each",
      benefits: benefits.slice(0, 6),
      workScope: workScope.trim(),
      materialCost:
        iMat >= 0
          ? Math.max(0, Number(cells[iMat]?.replace(/[$,]/g, "")) || 0) || undefined
          : undefined,
      laborHours:
        iHrs >= 0
          ? Math.max(0, Number(cells[iHrs]) || 0) || undefined
          : undefined,
    });
  }
  return out;
}
