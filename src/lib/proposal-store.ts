import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  createBlankProposal,
  createBlankProduct,
  createSampleProposal,
  withSalespersonSignature,
  ensureSalespersonSignature,
  emptyQA,
  emptyQuoteLine,
  normalizeLine,
  productToLine,
  SAMPLE_PRODUCTS,
  buildTierUpgradeOptions,
  applyStandardMeasureOrder,
  collapseFamilyDuplicateLines,
  sortedMeasures,
  type MeasureRole,
  type Product,
  type ProductOption,
  type Proposal,
  type ProposalQA,
  type ProposalStatus,
  type QuoteLine,
  type SignatureRecord,
} from "./proposal-types";
import {
  createRichTrainingSample,
  createDemoOutputProposal,
} from "./test-measures";
import { enrichCatalogWarranties, enrichProductWarranty } from "./warranty";
import { scrubLineWarrantyBenefits } from "./warranty";
import { enrichCatalogManufacturerLinks } from "./manufacturer-links";
import { refreshAuditAfterSignature } from "./advisor-audit";
import { buildPullList } from "./pull-list";
import {
  buildSizedEquipmentCatalog,
  invalidateSizedEquipmentCache,
  isDuctlessProduct,
} from "./equipment-catalog";
import { resolveProductPhotoUrl } from "./product-photos";
import { buildWestCoastPilotCatalog } from "./west-coast-pilot-catalog";
import { condenseBenefits, parseProductCsv } from "./owner-settings";
import { useOwnerSettings } from "./owner-settings";
import { COMPANY } from "./company";
import { loadWizardDraft, clearWizardDraft } from "./wizard-draft";
import {
  freezeQuoteLinePrices,
  thawOptionPrice,
} from "./domain/pricing-pipeline";

/** Factory rows that must exist even on a persist-hydrated catalog. */
export function factoryCatalogPool(): Product[] {
  return [
    ...SAMPLE_PRODUCTS,
    ...buildSizedEquipmentCatalog(),
    ...buildWestCoastPilotCatalog(),
  ];
}

/** Add any factory SKU the saved catalog is missing. Never changes existing rows. */
export function absorbMissingFactorySkus(live: Product[]): Product[] {
  const have = new Set(
    live
      .map((p) => (p.sku || "").trim().toUpperCase())
      .filter(Boolean),
  );
  const extra: Product[] = [];
  const seen = new Set<string>();
  for (const p of factoryCatalogPool()) {
    const sku = (p.sku || "").trim().toUpperCase();
    if (!sku || have.has(sku) || seen.has(sku)) continue;
    seen.add(sku);
    extra.push({
      ...p,
      id: p.id || `prod_${sku.toLowerCase()}`,
      options: p.options ? p.options.map((o) => ({ ...o })) : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  return extra.length ? [...extra, ...live] : live;
}

/**
 * Factory SKUs: face (photo, name, packet copy) comes from code.
 * Pricing the owner set in Backend stays. Custom SKUs are untouched.
 */
export function refreshFactoryCatalogFace(live: Product[]): Product[] {
  const factoryBySku = new Map<string, Product>();
  for (const p of factoryCatalogPool()) {
    const sku = (p.sku || "").trim().toUpperCase();
    if (sku && !factoryBySku.has(sku)) factoryBySku.set(sku, p);
  }
  let changed = false;
  const next = live.map((p) => {
    const sku = (p.sku || "").trim().toUpperCase();
    const f = sku ? factoryBySku.get(sku) : undefined;
    if (!f) return p;
    const imageUrl = f.imageUrl || p.imageUrl;
    const name = f.name || p.name;
    const workScope = f.workScope || p.workScope;
    const benefits = f.benefits?.length ? f.benefits : p.benefits;
    const description = f.description || p.description;
    const tierLabel = f.tierLabel ?? p.tierLabel;
    const equipmentKind = f.equipmentKind || p.equipmentKind;
    const familyId = f.familyId || p.familyId;
    if (
      imageUrl === p.imageUrl &&
      name === p.name &&
      workScope === p.workScope &&
      description === p.description &&
      tierLabel === p.tierLabel &&
      equipmentKind === p.equipmentKind &&
      familyId === p.familyId &&
      (benefits || []).join("\n") === (p.benefits || []).join("\n")
    ) {
      return p;
    }
    changed = true;
    return {
      ...p,
      name,
      imageUrl,
      workScope,
      benefits,
      description,
      tierLabel,
      equipmentKind,
      familyId,
      matchKey: f.matchKey ?? p.matchKey,
      manufacturer: f.manufacturer ?? p.manufacturer,
      capacityValue: f.capacityValue ?? p.capacityValue,
      updatedAt: new Date().toISOString(),
    };
  });
  return changed ? next : live;
}

type CatalogStore = {
  products: Product[];
  proposals: Proposal[];
  dismissedTrainingSample: boolean;

  seedIfEmpty: () => void;
  ensureCoreCatalog: () => void;
  ensureTrainingSample: () => void;
  createOutputDemoProposal: () => string;

  addProduct: (partial?: Partial<Product>) => string;
  updateProduct: (id: string, patch: Partial<Product>) => void;
  /**
   * Global catalog pricing bump (e.g. +5 / +10%).
   * percent: 5 means multiply by 1.05. Negative allowed for markdowns.
   */
  adjustAllProductPricing: (opts: {
    percent: number;
    applyToUnitPrice?: boolean;
    applyToMaterialCost?: boolean;
    applyToOptions?: boolean;
    /** Empty = all products; otherwise category contains (case-insensitive) */
    categoryContains?: string;
  }) => number;
  deleteProduct: (id: string) => void;
  importProductsJson: (raw: string) => { ok: true; count: number } | { ok: false; error: string };
  importProductsCsv: (raw: string) => { ok: true; count: number } | { ok: false; error: string };
  importProductsFile: (
    raw: string,
    filename?: string,
  ) => { ok: true; count: number } | { ok: false; error: string };

  createProposal: () => string;
  duplicateProposal: (id: string) => string | null;
  deleteProposal: (id: string) => void;
  updateProposal: (id: string, patch: Partial<Proposal>) => void;
  setStatus: (id: string, status: ProposalStatus) => void;

  addLineFromProduct: (proposalId: string, productId: string, optional?: boolean) => void;
  addCustomLine: (proposalId: string, optional?: boolean) => void;
  updateLineItem: (proposalId: string, itemId: string, patch: Partial<QuoteLine>) => void;
  removeLineItem: (proposalId: string, itemId: string) => void;
  reorderLineItem: (proposalId: string, itemId: string, dir: "up" | "down") => void;

  addQuestion: (proposalId: string) => void;
  updateQuestion: (proposalId: string, qaId: string, patch: Partial<ProposalQA>) => void;
  removeQuestion: (proposalId: string, qaId: string) => void;

  sendForSignature: (proposalId: string) => string | null;
  markViewed: (token: string) => void;
  completeSignature: (
    token: string,
    payload: Omit<SignatureRecord, "signedAt" | "ipNote"> & {
      selectedOptionalIds: string[];
      selectedNestedOptionKeys?: string[];
      selectedRebateIds: string[];
      selectedFinancingId: string | null;
      finalTotal: number;
      amountDueNow: number;
    },
  ) => boolean;
  declineSignature: (token: string) => boolean;
  getByToken: (token: string) => Proposal | undefined;
  getById: (id: string) => Proposal | undefined;
};

function touchProposal(p: Proposal, patch: Partial<Proposal>): Proposal {
  return { ...p, ...patch, updatedAt: new Date().toISOString() };
}

function touchProduct(p: Product, patch: Partial<Product>): Product {
  return { ...p, ...patch, updatedAt: new Date().toISOString() };
}

function newToken() {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function reindex(items: QuoteLine[], catalog?: Product[]): QuoteLine[] {
  return collapseFamilyDuplicateLines(
    applyStandardMeasureOrder(items, catalog),
    catalog,
  );
}

function ownerPricing() {
  try {
    const s = useOwnerSettings.getState();
    return {
      materialDivisor: s.materialDivisor,
      laborDivisor: s.laborDivisor,
      laborRate: s.laborRate,
      grossProfitPerManDay: s.grossProfitPerManDay ?? 0,
      pricingMix: s.pricingMix || "balanced",
    };
  } catch {
    return {};
  }
}

function salesSafeLinePatch(patch: Partial<QuoteLine>): Partial<QuoteLine> {
  const unlocked = (() => {
    try {
      return useOwnerSettings.getState().unlocked;
    } catch {
      return false;
    }
  })();
  if (unlocked) return patch;
  const {
    materialDivisor: _md,
    laborDivisor: _ld,
    laborRate: _lr,
    ...rest
  } = patch;
  return rest;
}

function isRiveraProposal(p: Proposal): boolean {
  const blob = `${p.title || ""} ${p.clientContact || ""} ${p.clientCompany || ""}`;
  return /rivera/i.test(blob);
}

function stripLeadingQuoteNumber(title: string): string {
  return String(title || "")
    .replace(/^\s*\d+\s*[.)\-–—·:]\s*/, "")
    .trim();
}

function numberRiveraQuoteTitles(proposals: Proposal[]): Proposal[] {
  const hits = proposals
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => isRiveraProposal(p))
    .sort((a, b) => {
      const ta = new Date(a.p.createdAt || 0).getTime();
      const tb = new Date(b.p.createdAt || 0).getTime();
      if (ta !== tb) return ta - tb;
      return a.i - b.i;
    });
  if (!hits.length) return proposals;
  const titles = new Map<string, string>();
  hits.forEach(({ p }, n) => {
    const base =
      stripLeadingQuoteNumber(p.title || "") ||
      (p.clientContact || "").trim() ||
      (p.clientCompany || "").trim() ||
      "Rivera";
    titles.set(p.id, `${n + 1} · ${base}`);
  });
  let changed = false;
  const next = proposals.map((p) => {
    const t = titles.get(p.id);
    if (!t || t === p.title) return p;
    changed = true;
    return { ...p, title: t };
  });
  return changed ? next : proposals;
}

function importRows(
  rows: {
    name: string;
    sku: string;
    category: string;
    description: string;
    unitPrice: number;
    unit: string;
    benefits: string[];
    workScope?: string;
    materialCost?: number;
    laborHours?: number;
  }[],
): number {
  if (rows.length === 0) return 0;
  const now = new Date().toISOString();
  const op = ownerPricing();
  const imported = rows.map((r) =>
    createBlankProduct({
      name: r.name,
      sku: r.sku,
      category: r.category,
      description: r.description,
      unitPrice: r.unitPrice,
      unit: r.unit,
      benefits:
        r.benefits.length > 0
          ? r.benefits
          : condenseBenefits(r.description || r.name),
      workScope: r.workScope || "",
      options: [],
      materialCost: r.materialCost,
      laborHours: r.laborHours,
      laborRate: op.laborRate,
      materialDivisor: op.materialDivisor,
      laborDivisor: op.laborDivisor,
      createdAt: now,
      updatedAt: now,
    }),
  );
  useProposalStore.setState((s) => ({
    products: [...imported, ...s.products],
  }));
  return imported.length;
}

/** Session guard — avoid re-running heavy catalog migrations on every page. */
let catalogSessionReady = false;
let catalogWhRevApplied = "";
const CATALOG_WH_REV = "20260814-wh-aos-nav";

/** Debounced localStorage writes so rapid product edits don't freeze the UI. */
let persistFlush = () => {};

function slimPersistedBlob(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as {
      state?: { proposals?: Proposal[]; products?: Product[] };
    };
    const props = parsed.state?.proposals;
    if (!Array.isArray(props)) return raw;
    parsed.state!.proposals = props.map((p) => ({
      ...p,
      wizardSnapshot: p.wizardSnapshot
        ? {
            ...p.wizardSnapshot,
            answers: {
              ...p.wizardSnapshot.answers,
              measureInstances: (
                p.wizardSnapshot.answers?.measureInstances || []
              ).map((m) => ({
                ...m,
                workShots: [],
              })),
            },
          }
        : p.wizardSnapshot,
    }));
    return JSON.stringify(parsed);
  } catch {
    return raw;
  }
}

function createDebouncedStorage(ms = 250) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: { name: string; value: string } | null = null;
  const flush = () => {
    if (pending) {
      const { name, value } = pending;
      pending = null;
      try {
        localStorage.setItem(name, value);
        try {
          localStorage.setItem(name + "-quotes", JSON.stringify({
            at: Date.now(),
            ids: JSON.parse(value)?.state?.proposals?.map((p: { id: string }) => p.id) || [],
          }));
        } catch {
          /* backup is best-effort */
        }
      } catch {
        try {
          localStorage.setItem(name, slimPersistedBlob(value));
        } catch {
          try {
            const parsed = JSON.parse(value) as {
              state?: { products?: unknown; proposals?: unknown };
            };
            if (parsed?.state) parsed.state.products = [];
            localStorage.setItem(name, JSON.stringify(parsed));
          } catch {
            /* keep last good write — never throw into the quote */
          }
        }
      }
    }
    timer = null;
  };
  persistFlush = flush;
  return {
    getItem: (name: string) => {
      try {
        return localStorage.getItem(name);
      } catch {
        return null;
      }
    },
    setItem: (name: string, value: string) => {
      pending = { name, value };
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, ms);
    },
    removeItem: (name: string) => {
      try {
        localStorage.removeItem(name);
      } catch {
        /* ignore */
      }
    },
  };
}

export function flushProposalStore(): void {
  try {
    persistFlush();
  } catch {
    /* ignore */
  }
}

export const useProposalStore = create<CatalogStore>()(

  persist(
    (set, get) => ({
      products: [],
      proposals: [],
      dismissedTrainingSample: false,

      seedIfEmpty: () => {
        const st = get();
        // Fast path: already bootstrapped this session
        if (catalogSessionReady && st.products.length > 0) {
          get().ensureTrainingSample();
          get().ensureCoreCatalog();
          return;
        }
        if (st.products.length === 0) {
          set({
            products: enrichCatalogManufacturerLinks(
              enrichCatalogWarranties(
                SAMPLE_PRODUCTS.map((p) => ({
                  ...p,
                  options: p.options ? p.options.map((o) => ({ ...o })) : [],
                })),
              ),
            ),
          });
        }
        get().ensureCoreCatalog();
        // Force re-scrub warranties on catalog (permits must not keep 3-year labor lines)
        {
          const products = get().products;
          const cleaned = enrichCatalogWarranties(products);
          // Only write if something actually changed
          let dirty = cleaned.length !== products.length;
          if (!dirty) {
            for (let i = 0; i < cleaned.length; i++) {
              const a = products[i]?.benefits || [];
              const b = cleaned[i]?.benefits || [];
              if (
                a.length !== b.length ||
                a.some((x, j) => x !== b[j]) ||
                products[i]?.laborWarrantyYears !== cleaned[i]?.laborWarrantyYears
              ) {
                dirty = true;
                break;
              }
            }
          }
          if (dirty) set({ products: cleaned });
        }
        // Rebrand legacy Aarvaks / Axme company fields on saved proposals
        {
          const props = get().proposals;
          let changed = false;
          const next = props.map((p) => {
            const name = p.companyName || "";
            let prop = p;
            if (
              /aarvaks|axme heating|acme rvacs/i.test(name) ||
              !name ||
              name === "Aarvaks Heating and Air Conditioning" ||
              name === "Acme RVACs Heating and Air Conditioning"
            ) {
              changed = true;
              prop = {
                ...prop,
                companyName: COMPANY.name,
                companyTagline: prop.companyTagline || COMPANY.tagline,
                companyPhone: prop.companyPhone || COMPANY.phone,
              };
            }
            // One-pass scrub of duplicated / wrong warranty benefit lines on measures
            const lines = (prop.lineItems || []).map((li) => {
              const benefits = scrubLineWarrantyBenefits(li.benefits || [], {
                id: li.productId || li.id,
                name: li.name,
                sku: "",
                category: li.name,
                description: li.description || "",
                familyId: /permit/i.test(li.name)
                  ? "permit"
                  : /load.?calc/i.test(li.name)
                    ? "load-calc"
                    : undefined,
              } as any);
              if (
                benefits.length === (li.benefits || []).length &&
                benefits.every((b, i) => b === (li.benefits || [])[i])
              ) {
                return li;
              }
              changed = true;
              return { ...li, benefits };
            });
            if (lines !== prop.lineItems) {
              prop = { ...prop, lineItems: lines };
            }
            return prop;
          });
          if (changed) set({ proposals: next });
        }
        // One-time enrich only for products missing warranty/links (cheap)
        {
          const catalog = get().products;
          let touched = false;
          const next = catalog.map((p) => {
            if (p.warrantySummary && p.productInfoUrl) return p;
            touched = true;
            let np = enrichProductWarranty(p);
            if (!np.productInfoUrl) {
              np = enrichCatalogManufacturerLinks([np])[0]!;
            }
            return np;
          });
          if (touched) set({ products: next });
        }
        get().ensureTrainingSample();
        // Backfill creator signature once
        {
          const props = get().proposals;
          let changed = false;
          const next = props.map((p) => {
            if (p.salesperson?.name) return p;
            changed = true;
            return withSalespersonSignature(p);
          });
          if (changed) set({ proposals: next });
        }
        catalogSessionReady = true;
        {
          const numbered = numberRiveraQuoteTitles(get().proposals);
          if (numbered !== get().proposals) set({ proposals: numbered });
        }
      },

      ensureTrainingSample: () => {
        const st = get();
        if (st.dismissedTrainingSample) return;
        const products = st.products.length ? st.products : SAMPLE_PRODUCTS;
        const hasSample = st.proposals.some(
          (p) =>
            p.id === "prop_sample_training" ||
            p.proposalNumber === "TEST-SAMPLE-001",
        );
        if (hasSample) return;
        const sample = createRichTrainingSample(products);
        set({ proposals: [sample, ...st.proposals] });
      },

      /** Create a full demo quote for packet/PDF QA (always new id). */
      createOutputDemoProposal: () => {
        const products = get().products.length
          ? get().products
          : SAMPLE_PRODUCTS;
        const demo = createDemoOutputProposal(products);
        set((s) => ({ proposals: [demo, ...s.proposals] }));
        return demo.id;
      },

      ensureCoreCatalog: () => {
        const existing = get().products;
        const lockSkus = new Set(["SVC-PERMIT", "SVC-HERS"]);
        {
          const bySku = new Map(
            existing
              .filter((p) => (p.sku || "").trim())
              .map((p) => [p.sku.trim().toUpperCase(), p] as const),
          );
          let next = existing;
          let changed = false;
          for (const sku of lockSkus) {
            const factory = SAMPLE_PRODUCTS.find(
              (f) => (f.sku || "").toUpperCase() === sku,
            );
            if (!factory) continue;
            const have = bySku.get(sku);
            if (!have) {
              next = [
                ...next,
                {
                  ...factory,
                  id: `prod_${Math.random().toString(36).slice(2, 10)}`,
                  options: factory.options
                    ? factory.options.map((o) => ({ ...o }))
                    : [],
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              ];
              changed = true;
              continue;
            }
            if (
              have.name === factory.name &&
              have.workScope === factory.workScope &&
              have.familyId === factory.familyId
            ) {
              continue;
            }
            next = next.map((p) =>
              (p.sku || "").toUpperCase() === sku
                ? {
                    ...p,
                    name: factory.name,
                    description: factory.description,
                    benefits: factory.benefits
                      ? [...factory.benefits]
                      : p.benefits,
                    workScope: factory.workScope,
                    familyId: factory.familyId || p.familyId,
                    laborHours: factory.laborHours ?? p.laborHours,
                    unitPrice: factory.unitPrice ?? p.unitPrice,
                    updatedAt: new Date().toISOString(),
                  }
                : p,
            );
            changed = true;
          }
          if (changed) set({ products: next });
        }
        // Bath fan line is Panasonic only — drop Broan/NuTone bath SKUs and upsert Select / Ceiling / Sense.
        {
          const RETIRE = new Set([
            "FAN-BROAN-80",
            "FAN-BROAN-110",
            "FAN-NUTONE-80",
          ]);
          const WANT = [
            "FAN-PANA-VKS3",
            "FAN-PANA-VKSL3",
            "FAN-PANA-WC80",
            "FAN-PANA-WC110L",
            "FAN-PANA-SENSE",
          ];
          let next = get().products.filter(
            (p) => !RETIRE.has((p.sku || "").trim().toUpperCase()),
          );
          const have = new Set(
            next.map((p) => (p.sku || "").trim().toUpperCase()).filter(Boolean),
          );
          let changed = next.length !== get().products.length;
          const factoryPool = buildWestCoastPilotCatalog();
          for (const sku of WANT) {
            const factory = factoryPool.find(
              (f) => (f.sku || "").toUpperCase() === sku,
            );
            if (!factory) continue;
            const idx = next.findIndex(
              (p) => (p.sku || "").trim().toUpperCase() === sku,
            );
            if (idx < 0) {
              next = [
                ...next,
                {
                  ...factory,
                  id: `prod_${sku.toLowerCase()}`,
                  options: factory.options
                    ? factory.options.map((o) => ({ ...o }))
                    : [],
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              ];
              have.add(sku);
              changed = true;
              continue;
            }
            const cur = next[idx]!;
            const staleBenefit = (cur.benefits || []).some((b) =>
              /80 CFM — typical hall bath|Very quiet operation|Ducted to the exterior with a working damper|^110 CFM — larger baths$|^Dual-speed 80 \/ 110 CFM$|1-year labor|Manufacturer limited parts warranty/i.test(
                b,
              ),
            );
            const missingDims =
              !cur.dimensions ||
              !Number(cur.dimensions.widthIn) ||
              !Number(cur.dimensions.heightIn);
            if (
              missingDims ||
              staleBenefit ||
              !(cur.benefits || []).length
            ) {
              next[idx] = {
                ...cur,
                dimensions: factory.dimensions || cur.dimensions,
                benefits:
                  factory.benefits?.length ? factory.benefits : cur.benefits,
                description: factory.description || cur.description,
                updatedAt: new Date().toISOString(),
              };
              changed = true;
            }
          }
          // One row per bath-fan SKU if a prior pass doubled them.
          {
            const seen = new Set<string>();
            const deduped = [];
            for (const p of next) {
              const sku = (p.sku || "").trim().toUpperCase();
              if (sku.startsWith("FAN-PANA-")) {
                if (seen.has(sku)) {
                  changed = true;
                  continue;
                }
                seen.add(sku);
              }
              deduped.push(p);
            }
            next = deduped;
          }
          if (changed) set({ products: next });
        }
        // Old ton-class 1-to-1 mini-splits (2 / 2.5 / 3T…) — replaced by 9/12/18/24/36k.
        {
          const live = get().products;
          const next = live.filter((p) => {
            const sku = (p.sku || "").trim().toUpperCase();
            return !/^(MIT-MS|MIT-HYPER|CAR-MS-PERF|CAR-MS-INF)-(2|2P5|3|3P5|4|5)$/.test(
              sku,
            );
          });
          if (next.length !== live.length) set({ products: next });
        }
        // Keep packet photos on already-hydrated catalogs (all equipment families).
        {
          const live = get().products;
          let photoChanged = false;
          const next = live.map((p) => {
            const factoryUrl = resolveProductPhotoUrl({
              name: p.name,
              sku: p.sku,
              category: p.category,
              equipmentKind: p.equipmentKind,
              imageUrl: null,
              familyId: p.familyId,
            });
            if (!factoryUrl) {
              const blob = `${p.name} ${p.sku} ${p.equipmentKind || ""}`.toLowerCase();
              const stuckWrong =
                (p.imageUrl || "").startsWith("/product-photos/") &&
                (p.equipmentKind === "ductless" ||
                  /ductless|mini-?split|car-ms|bosch/i.test(blob));
              if (!stuckWrong) return p;
              photoChanged = true;
              return {
                ...p,
                imageUrl: "/product-art/generic.svg",
                updatedAt: new Date().toISOString(),
              };
            }
            // Don't clobber a real photo with nothing; skip service-only SVGs
            if (
              !factoryUrl.startsWith("/product-photos/") &&
              !/^https?:\/\//i.test(factoryUrl)
            )
              return p;
            if (factoryUrl === p.imageUrl) return p;
            photoChanged = true;
            return {
              ...p,
              imageUrl: factoryUrl,
              updatedAt: new Date().toISOString(),
            };
          });
          if (photoChanged) set({ products: next });
        }
        // After HMR the in-memory flags reset. A persist-hydrated catalog
        // already has factory rows — rebuilding it wedges the preview.
        // Still fold in NEW factory SKUs (Bosch / Navien indoors, etc.)
        // or the live quote never sees matching equipment added after first boot.
        if (get().products.length >= 80) {
          catalogWhRevApplied = CATALOG_WH_REV;
          catalogSessionReady = true;
          const merged = refreshFactoryCatalogFace(
            absorbMissingFactorySkus(get().products),
          );
          if (merged !== get().products) set({ products: merged });
          return;
        }
        invalidateSizedEquipmentCache();
        const bySku = new Map(
          existing
            .filter((p) => (p.sku || "").trim())
            .map((p) => [p.sku.trim().toUpperCase(), p] as const),
        );

        const sized = buildSizedEquipmentCatalog();
        const pool = [...SAMPLE_PRODUCTS, ...sized];
        const added: Product[] = [];
        const refreshed: Product[] = [];

        for (const p of pool) {
          const sku = (p.sku || "").trim().toUpperCase();
          if (!sku) continue;
          const have = bySku.get(sku);
          if (!have) {
            bySku.set(sku, p);
            added.push({
              ...p,
              id: `prod_${Math.random().toString(36).slice(2, 10)}`,
              options: p.options ? p.options.map((o) => ({ ...o })) : [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
            continue;
          }
          // Refresh ladder labels so "Two-Stage" names reappear after renames
          const needsLabel =
            (p.tier != null && p.tier >= 2) ||
            /Performance|Infinity|Two-Stage|Variable|Boiler|Hydro-Furnace/i.test(
              p.name + " " + (have.name || ""),
            ) ||
            /NAV-NHB|NAV-NFB|NAV-NPF|NAV-AH-H2AIR|WTR-TL-|WTR-NAV|WTR-GAS-HE|AOS-HPWH|AOS-VOLTEX|NAV-NWP|WTR-HPWH|CAR-COIL/i.test(sku);
          if (
            needsLabel &&
            (have.name !== p.name ||
              have.tierLabel !== p.tierLabel ||
              have.tier !== p.tier ||
              have.equipmentKind !== p.equipmentKind ||
              have.packageRule !== p.packageRule)
          ) {
            refreshed.push({
              ...have,
              name: p.name,
              tier: p.tier ?? have.tier,
              tierLabel: p.tierLabel || have.tierLabel,
              description: p.description || have.description,
              equipmentKind: p.equipmentKind || have.equipmentKind,
              matchKey: p.matchKey || have.matchKey,
              familyId: p.familyId || have.familyId,
              category: p.category || have.category,
              packageRule: p.packageRule ?? have.packageRule,
              requiresTpValve: p.requiresTpValve ?? have.requiresTpValve,
              capacityValue: p.capacityValue ?? have.capacityValue,
              installFuel: p.installFuel || have.installFuel,
              installPower: p.installPower || have.installPower,
              updatedAt: new Date().toISOString(),
            });
          }
        }

        if (added.length || refreshed.length) {
          const refreshById = new Map(refreshed.map((p) => [p.id, p]));
          set({
            products: [
              ...added,
              ...get().products.map((p) => refreshById.get(p.id) || p),
            ],
          });
        }

        // One-shot upsert of factory water-heater SKUs per catalog revision
        if (catalogWhRevApplied !== CATALOG_WH_REV) {
          const WH_SKU =
            /^(AOS-VOLTEX-|AOS-HPWH-|AOS-HE-|AOS-GRAV-|AOS-GULN-|AOS-E-|AOS-ADAPT-|AOS-SIG-TL-|NAV-NWP-|WTR-NAV-NPE-|WTR-GAS-HE-|WTR-AOS-E)/i;
          const live = get().products;
          const bySku = new Map(
            live
              .filter((p) => (p.sku || "").trim())
              .map((p) => [p.sku.trim().toUpperCase(), p] as const),
          );
          const factoryWh = [...SAMPLE_PRODUCTS, ...sized].filter((p) =>
            WH_SKU.test(p.sku || ""),
          );
          const factoryBySku = new Map(
            factoryWh.map((p) => [p.sku.trim().toUpperCase(), p] as const),
          );
          let changed = false;
          const extra: Product[] = [];
          const replaced = live.map((p) => {
            const sku = (p.sku || "").trim().toUpperCase();
            const factory = factoryBySku.get(sku);
            if (!factory) return p;
            if (
              p.name === factory.name &&
              p.capacityValue === factory.capacityValue &&
              p.installFootprint === factory.installFootprint &&
              p.tierLabel === factory.tierLabel
            ) {
              return p;
            }
            changed = true;
            return {
              ...p,
              name: factory.name,
              description: factory.description,
              tier: factory.tier ?? p.tier,
              tierLabel: factory.tierLabel || p.tierLabel,
              capacityValue: factory.capacityValue ?? p.capacityValue,
              installFuel: factory.installFuel || p.installFuel,
              installPower: factory.installPower || p.installPower,
              installFootprint: factory.installFootprint || p.installFootprint,
              familyId: factory.familyId || p.familyId,
              category: factory.category || p.category,
              benefits: factory.benefits?.length ? [...factory.benefits] : p.benefits,
              dimensions: factory.dimensions || p.dimensions,
              ventStyle: factory.ventStyle || p.ventStyle,
              updatedAt: new Date().toISOString(),
            };
          });
          for (const f of factoryWh) {
            const sku = (f.sku || "").trim().toUpperCase();
            if (bySku.has(sku)) continue;
            changed = true;
            extra.push({
              ...f,
              id: `prod_${Math.random().toString(36).slice(2, 10)}`,
              options: f.options ? f.options.map((o) => ({ ...o })) : [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
          if (changed) set({ products: [...extra, ...replaced] });
          catalogWhRevApplied = CATALOG_WH_REV;
        }

        if (catalogSessionReady && get().products.length > 0 && !added.length) {
          // Still allow light retag below once per session
        }

        // One-shot cleanup: legacy SKU + LP wall heaters + equipmentKind tags
        {
          let cat = get().products;
          const hasNewTstat = cat.some((p) =>
            /^(CTRL-ECO|CTRL-NEST|CTRL-INF|CTRL-CAR)/i.test(p.sku || ""),
          );
          let next = cat;
          if (
            hasNewTstat &&
            cat.some((p) => (p.sku || "").toUpperCase() === "CTRL-SMART")
          ) {
            next = next.filter(
              (p) => (p.sku || "").toUpperCase() !== "CTRL-SMART",
            );
          }
          next = next.filter((p) => {
            const sku = (p.sku || "").toUpperCase();
            if (!sku.startsWith("WALL-")) return true;
            if (sku.startsWith("WALL-WIL-") || sku.startsWith("WALL-RIN-") || sku.startsWith("WALL-COZ-")) {
              if (/2509621A|3509621A|5009621A/i.test(sku)) return false;
              if (/DTP|[-_]LP\b/i.test(sku)) return false;
              return true;
            }
            return false;
          });
          let retagged = false;
          next = next.map((p) => {
            if (isDuctlessProduct(p) && p.equipmentKind !== "ductless") {
              retagged = true;
              return {
                ...p,
                equipmentKind: "ductless" as const,
                category: p.category?.toLowerCase().includes("ductless")
                  ? p.category
                  : `Ductless · ${p.category || "Mini-split"}`,
                updatedAt: new Date().toISOString(),
              };
            }
            if (/^CAR-HP-/i.test(p.sku) && p.equipmentKind !== "heat_pump") {
              retagged = true;
              return {
                ...p,
                equipmentKind: "heat_pump" as const,
                category: p.category?.includes("Heat pump")
                  ? p.category
                  : "Heat pump · Carrier",
                updatedAt: new Date().toISOString(),
              };
            }
            return p;
          });
          if (next.length !== cat.length || retagged) {
            set({ products: next });
          }

          // Refresh dimensions + SEER/HSPF/dB from factory when they changed
          {
            const factoryBySku = new Map(
              [...SAMPLE_PRODUCTS, ...buildSizedEquipmentCatalog()]
                .filter((p) => (p.sku || "").trim())
                .map((p) => [p.sku.trim().toUpperCase(), p] as const),
            );
            let live = get().products;
            let specChanged = false;
            const specNext = live.map((p) => {
              const sku = (p.sku || "").trim().toUpperCase();
              if (!sku) return p;
              const factory = factoryBySku.get(sku);
              if (!factory) return p;
              const a = p.dimensions;
              const b = factory.dimensions;
              const dimDiff =
                Boolean(b) &&
                (!a ||
                  a.widthIn !== b!.widthIn ||
                  a.depthIn !== b!.depthIn ||
                  a.heightIn !== b!.heightIn);
              const rateDiff =
                (factory.seer2 != null && factory.seer2 !== p.seer2) ||
                (factory.eer2 != null && factory.eer2 !== p.eer2) ||
                (factory.hspf2 != null && factory.hspf2 !== p.hspf2) ||
                (factory.soundDb != null && factory.soundDb !== p.soundDb) ||
                (factory.ventStyle != null && factory.ventStyle !== p.ventStyle) ||
                (factory.flueHeightIn != null &&
                  factory.flueHeightIn !== p.flueHeightIn) ||
                (factory.energyStar != null &&
                  factory.energyStar !== p.energyStar);
              const photoUrl = factory.imageUrl || "";
              const photoDiff =
                photoUrl.startsWith("/product-photos/") &&
                photoUrl !== p.imageUrl &&
                (!p.imageUrl ||
                  /\/(minisplit|ductless|heatpump|outdoor|generic)\.(jpg|png|svg)(\?|$)/i.test(
                    p.imageUrl,
                  ) ||
                  p.imageUrl.startsWith("/product-art/"));
              const factoryFamily = factory.familyId || "";
              const familyDiff =
                Boolean(factoryFamily) &&
                factoryFamily !== p.familyId &&
                /^ductless-1to1-/i.test(factoryFamily);
              if (!dimDiff && !rateDiff && !photoDiff && !familyDiff) return p;
              specChanged = true;
              return {
                ...p,
                dimensions: b ? { ...b } : p.dimensions,
                seer2: factory.seer2 ?? p.seer2,
                eer2: factory.eer2 ?? p.eer2,
                hspf2: factory.hspf2 ?? p.hspf2,
                soundDb: factory.soundDb ?? p.soundDb,
                ventStyle: factory.ventStyle ?? p.ventStyle,
                flueHeightIn: factory.flueHeightIn ?? p.flueHeightIn,
                energyStar: factory.energyStar ?? p.energyStar,
                installFootprint:
                  factory.installFootprint ?? p.installFootprint,
                imageUrl: photoDiff ? factory.imageUrl : p.imageUrl,
                familyId: familyDiff ? factory.familyId : p.familyId,
                packageRule: factory.packageRule ?? p.packageRule,
                updatedAt: new Date().toISOString(),
              };
            });
            if (specChanged) set({ products: specNext });
          }
        }

        // Keep permit / HERS packet language on the factory copy
        {
          const LOCK = new Set(["SVC-PERMIT", "SVC-HERS", "SVC-DUCT"]);
          let cat = get().products;
          let changed = false;
          const next = cat.map((p) => {
            const sku = (p.sku || "").toUpperCase();
            if (!LOCK.has(sku)) return p;
            const factory = SAMPLE_PRODUCTS.find(
              (f) => (f.sku || "").toUpperCase() === sku,
            );
            if (!factory) return p;
            if (
              p.name === factory.name &&
              p.workScope === factory.workScope &&
              p.familyId === factory.familyId
            ) {
              return p;
            }
            changed = true;
            return {
              ...p,
              name: factory.name,
              description: factory.description,
              benefits: factory.benefits ? [...factory.benefits] : p.benefits,
              workScope: factory.workScope,
              familyId: factory.familyId || p.familyId,
              laborHours: factory.laborHours ?? p.laborHours,
              unitPrice: factory.unitPrice ?? p.unitPrice,
              updatedAt: new Date().toISOString(),
            };
          });
          if (changed) set({ products: next });
        }

        // Attach remote-sensor packs on Nest / ecobee if the live SKU is missing them
        {
          const SENSOR_SKUS = new Set([
            "CTRL-ECO-PREM",
            "CTRL-ECO-ENH",
            "CTRL-NEST-LRN",
          ]);
          let cat = get().products;
          let changed = false;
          const next = cat.map((p) => {
            const sku = (p.sku || "").toUpperCase();
            if (!SENSOR_SKUS.has(sku)) return p;
            if ((p.options || []).some((o) => /remote sensor/i.test(o.title))) {
              return p;
            }
            const factory = SAMPLE_PRODUCTS.find(
              (f) => (f.sku || "").toUpperCase() === sku,
            );
            if (!factory?.options?.length) return p;
            changed = true;
            return {
              ...p,
              options: [
                ...(p.options || []),
                ...factory.options.map((o) => ({ ...o })),
              ],
              updatedAt: new Date().toISOString(),
            };
          });
          if (changed) set({ products: next });
        }

        // Only when we just added products: lightly attach tier options on open drafts
        if (added.length) {
          const catalog = get().products;
          const byId = new Map(catalog.map((p) => [p.id, p]));
          const proposals = get().proposals.map((prop) => {
            if (prop.status !== "draft") return prop;
            let changed = false;
            const lineItems = prop.lineItems.map((li) => {
              const n = normalizeLine(li);
              const product =
                (n.productId && byId.get(n.productId)) || undefined;
              if (!product?.familyId || product.tier == null) return n;
              const tierOpts = buildTierUpgradeOptions(product, catalog);
              if (!tierOpts.length) return n;
              const existingIds = new Set((n.options || []).map((o) => o.id));
              const toAdd = tierOpts.filter((o) => !existingIds.has(o.id));
              if (!toAdd.length) return n;
              changed = true;
              const accessories = (n.options || []).filter(
                (o) => o.kind !== "tier_upgrade",
              );
              return normalizeLine({
                ...n,
                options: [...accessories, ...tierOpts],
              });
            });
            return changed
              ? { ...prop, lineItems }
              : prop;
          });
          if (proposals.some((p, i) => p !== get().proposals[i])) {
            set({ proposals });
          }
        }
      },

      addProduct: (partial) => {
        const op = ownerPricing();
        const p = createBlankProduct({
          materialDivisor: op.materialDivisor,
          laborDivisor: op.laborDivisor,
          laborRate: op.laborRate,
          options: [],
          ...partial,
        });
        set((s) => ({ products: [p, ...s.products] }));
        return p.id;
      },

      updateProduct: (id, patch) => {
        set((s) => ({
          products: s.products.map((p) =>
            p.id === id ? touchProduct(p, patch) : p,
          ),
        }));
      },

      adjustAllProductPricing: (opts) => {
        const pct = Number(opts.percent);
        if (!Number.isFinite(pct) || pct === 0) return 0;
        const factor = 1 + pct / 100;
        const cat = (opts.categoryContains || "").trim().toLowerCase();
        const doPrice = opts.applyToUnitPrice !== false;
        const doMat = opts.applyToMaterialCost !== false;
        const doOpts = opts.applyToOptions !== false;
        let count = 0;
        set((s) => ({
          products: s.products.map((p) => {
            if (cat && !(p.category || "").toLowerCase().includes(cat)) {
              return p;
            }
            count += 1;
            const patch: Partial<Product> = {};
            if (doPrice) {
              patch.unitPrice =
                Math.round(Math.max(0, (p.unitPrice || 0) * factor) * 100) / 100;
            }
            if (doMat && p.materialCost != null) {
              patch.materialCost =
                Math.round(Math.max(0, (p.materialCost || 0) * factor) * 100) /
                100;
            }
            if (doOpts && p.options?.length) {
              patch.options = p.options.map((o) => ({
                ...o,
                priceDelta:
                  Math.round(
                    Math.max(0, (Number(o.priceDelta) || 0) * factor) * 100,
                  ) / 100,
                materialCost:
                  o.materialCost != null
                    ? Math.round(
                        Math.max(0, (Number(o.materialCost) || 0) * factor) *
                          100,
                      ) / 100
                    : o.materialCost,
              }));
            }
            return touchProduct(p, patch);
          }),
        }));
        return count;
      },

      deleteProduct: (id) => {
        set((s) => ({ products: s.products.filter((p) => p.id !== id) }));
      },

      importProductsJson: (raw) => {
        try {
          const data = JSON.parse(raw) as unknown;
          const arr = Array.isArray(data)
            ? data
            : data &&
                typeof data === "object" &&
                Array.isArray((data as { products?: unknown }).products)
              ? (data as { products: unknown[] }).products
              : null;
          if (!arr)
            return { ok: false, error: "JSON must be an array or { products: [] }" };
          const rows = arr.map((row) => {
            const r = row as Record<string, unknown>;
            const benefits = Array.isArray(r.benefits)
              ? (r.benefits as string[])
              : String(r.benefits || "")
                  .split(/[;\n|]/)
                  .map((s) => s.trim())
                  .filter(Boolean);
            return {
              name: String(r.name || r.product || "Imported"),
              sku: String(r.sku || r.model || ""),
              category: String(r.category || "Imported"),
              description: String(r.description || ""),
              unitPrice: Number(r.unitPrice ?? r.price ?? r.list ?? 0) || 0,
              unit: String(r.unit || "each"),
              benefits,
              workScope: String(r.workScope || r.work_scope || ""),
              materialCost:
                r.materialCost != null || r.material_cost != null
                  ? Number(r.materialCost ?? r.material_cost) || 0
                  : undefined,
              laborHours:
                r.laborHours != null || r.labor_hours != null
                  ? Number(r.laborHours ?? r.labor_hours) || 0
                  : undefined,
            };
          });
          const count = importRows(rows);
          return { ok: true, count };
        } catch (e) {
          return {
            ok: false,
            error: e instanceof Error ? e.message : "Invalid JSON",
          };
        }
      },

      importProductsCsv: (raw) => {
        try {
          const rows = parseProductCsv(raw);
          const count = importRows(rows);
          return { ok: true, count };
        } catch (e) {
          return {
            ok: false,
            error: e instanceof Error ? e.message : "CSV parse failed",
          };
        }
      },

      importProductsFile: (raw, filename) => {
        const name = (filename || "").toLowerCase();
        if (
          name.endsWith(".json") ||
          raw.trim().startsWith("{") ||
          raw.trim().startsWith("[")
        ) {
          return get().importProductsJson(raw);
        }
        return get().importProductsCsv(raw);
      },

      createProposal: () => {
        const p = withSalespersonSignature(createBlankProposal());
        set((s) => ({ proposals: numberRiveraQuoteTitles([p, ...s.proposals]) }));
        return p.id;
      },

      duplicateProposal: (id) => {
        const src = get().proposals.find((p) => p.id === id);
        if (!src) return null;
        const fresh = createBlankProposal({
          ...src,
          title: `${src.title} (copy)`,
          status: "draft",
          signingToken: null,
          sentAt: null,
          viewedAt: null,
          signature: null,
          lineItems: src.lineItems.map((li) =>
            normalizeLine({
              ...li,
              id: `li_${Math.random().toString(36).slice(2, 10)}`,
              customerSelected: undefined,
              priceLocked: false,
              options: (li.options || []).map((o) => thawOptionPrice(o)),
            }),
          ),
        });
        set((s) => ({ proposals: numberRiveraQuoteTitles([fresh, ...s.proposals]) }));
        return fresh.id;
      },

      deleteProposal: (id) => {
        const victim = get().proposals.find((p) => p.id === id);
        const isTraining =
          id === "prop_sample_training" ||
          victim?.proposalNumber === "TEST-SAMPLE-001";
        set((s) => ({
          proposals: numberRiveraQuoteTitles(s.proposals.filter((p) => p.id !== id)),
          ...(isTraining ? { dismissedTrainingSample: true } : {}),
        }));
        try {
          const draft = loadWizardDraft();
          if (draft && (draft.proposalId === id || isTraining)) clearWizardDraft();
        } catch { /* ignore */ }
      },

      updateProposal: (id, patch) => {
        set((s) => ({
          proposals: s.proposals.map((p) =>
            p.id === id ? touchProposal(p, patch) : p,
          ),
        }));
      },

      setStatus: (id, status) => {
        get().updateProposal(id, { status });
      },

      addLineFromProduct: (proposalId, productId, optional) => {
        const product = get().products.find((p) => p.id === productId);
        if (!product) return;
        const proposal = get().proposals.find((p) => p.id === proposalId);
        if (!proposal) return;
        const role: MeasureRole = optional ? "optional" : "included";
        const line = productToLine(product, {
          role,
          defaultSelected: role === "included",
          catalog: get().products,
        });
        get().updateProposal(proposalId, {
          lineItems: reindex([...proposal.lineItems, line], get().products),
        });
      },

      addCustomLine: (proposalId, optional) => {
        const proposal = get().proposals.find((p) => p.id === proposalId);
        if (!proposal) return;
        const role: MeasureRole = optional ? "optional" : "included";
        const line = emptyQuoteLine({
          role,
          defaultSelected: role === "included",
        });
        get().updateProposal(proposalId, {
          lineItems: reindex([...proposal.lineItems, line], get().products),
        });
      },

      updateLineItem: (proposalId, itemId, patch) => {
        const proposal = get().proposals.find((p) => p.id === proposalId);
        if (!proposal) return;
        const safe = salesSafeLinePatch(patch);
        get().updateProposal(proposalId, {
          lineItems: proposal.lineItems.map((li) =>
            li.id === itemId ? normalizeLine({ ...li, ...safe }) : li,
          ),
        });
      },

      removeLineItem: (proposalId, itemId) => {
        const proposal = get().proposals.find((p) => p.id === proposalId);
        if (!proposal) return;
        get().updateProposal(proposalId, {
          lineItems: reindex(
            proposal.lineItems.filter((li) => li.id !== itemId),
            get().products,
          ),
        });
      },

      reorderLineItem: (proposalId, itemId, dir) => {
        const proposal = get().proposals.find((p) => p.id === proposalId);
        if (!proposal) return;
        // Manual reorder still allowed; reindex by array position after swap
        const items = sortedMeasures(proposal.lineItems);
        const idx = items.findIndex((li) => li.id === itemId);
        if (idx < 0) return;
        const j = dir === "up" ? idx - 1 : idx + 1;
        if (j < 0 || j >= items.length) return;
        const next = [...items];
        [next[idx], next[j]] = [next[j], next[idx]];
        get().updateProposal(proposalId, {
          lineItems: next.map((li, i) => normalizeLine({ ...li, sortOrder: i })),
        });
      },

      addQuestion: (proposalId) => {
        const proposal = get().proposals.find((p) => p.id === proposalId);
        if (!proposal) return;
        get().updateProposal(proposalId, {
          questions: [...proposal.questions, emptyQA()],
        });
      },

      updateQuestion: (proposalId, qaId, patch) => {
        const proposal = get().proposals.find((p) => p.id === proposalId);
        if (!proposal) return;
        get().updateProposal(proposalId, {
          questions: proposal.questions.map((q) =>
            q.id === qaId ? { ...q, ...patch } : q,
          ),
        });
      },

      removeQuestion: (proposalId, qaId) => {
        const proposal = get().proposals.find((p) => p.id === proposalId);
        if (!proposal) return;
        get().updateProposal(proposalId, {
          questions: proposal.questions.filter((q) => q.id !== qaId),
        });
      },

      sendForSignature: (proposalId) => {
        const proposal = get().proposals.find((p) => p.id === proposalId);
        if (!proposal) return null;
        const token = proposal.signingToken || newToken();
        const salesperson = ensureSalespersonSignature(proposal, {
          // Keep original signedAt if already present; otherwise mark at send time
          signedAt: proposal.salesperson?.signedAt || new Date().toISOString(),
        });
        const now = new Date().toISOString();
        get().updateProposal(proposalId, {
          signingToken: token,
          status: "sent",
          sentAt: now,
          pricesLockedAt: proposal.pricesLockedAt || now,
          salesperson,
          lineItems: proposal.lineItems.map((li) =>
            freezeQuoteLinePrices(normalizeLine(li)),
          ),
        });
        return token;
      },

      markViewed: (token) => {
        const proposal = get().proposals.find((p) => p.signingToken === token);
        if (!proposal) return;
        if (!proposal.viewedAt) {
          get().updateProposal(proposal.id, {
            viewedAt: new Date().toISOString(),
            status: proposal.status === "sent" ? "viewed" : proposal.status,
          });
        }
      },

      completeSignature: (token, payload) => {
        const proposal = get().proposals.find((p) => p.signingToken === token);
        if (!proposal) return false;
        const selected = new Set(payload.selectedOptionalIds);
        const nestedKeys = new Set(payload.selectedNestedOptionKeys || []);
        const lineItems = proposal.lineItems.map((li) => {
          const n = normalizeLine(li);
          const selectedOpts = (n.options || [])
            .filter((o) => nestedKeys.has(`${n.id}::${o.id}`))
            .map((o) => o.id);
          if (n.role === "optional") {
            return normalizeLine({
              ...n,
              customerSelected: selected.has(n.id),
              selectedOptionIds: selectedOpts,
            });
          }
          return normalizeLine({
            ...n,
            selectedOptionIds: selectedOpts,
          });
        });
        const signature = {
          signerName: payload.signerName,
          signerEmail: payload.signerEmail,
          signedAt: new Date().toISOString(),
          signatureDataUrl: payload.signatureDataUrl,
          agreedToTerms: payload.agreedToTerms,
          selectedOptionalIds: payload.selectedOptionalIds,
          selectedNestedOptionKeys: payload.selectedNestedOptionKeys || [],
          selectedRebateIds: payload.selectedRebateIds,
          selectedFinancingId: payload.selectedFinancingId,
          finalTotal: payload.finalTotal,
          amountDueNow: payload.amountDueNow,
          ipNote: "Signed in browser",
        };
        const signedProposal: Proposal = {
          ...proposal,
          status: "signed",
          lineItems,
          preferredFinancingId: payload.selectedFinancingId,
          signature,
          updatedAt: new Date().toISOString(),
        };
        const products = get().products;
        const advisorAudit = refreshAuditAfterSignature(
          signedProposal,
          products,
          proposal.advisorAudit,
        );
        const pullList = buildPullList(signedProposal, products);
        get().updateProposal(proposal.id, {
          status: "signed",
          lineItems,
          preferredFinancingId: payload.selectedFinancingId,
          signature,
          advisorAudit,
          pullList,
        });
        return true;
      },

      declineSignature: (token) => {
        const proposal = get().proposals.find((p) => p.signingToken === token);
        if (!proposal) return false;
        get().updateProposal(proposal.id, { status: "declined" });
        return true;
      },

      getByToken: (token) => get().proposals.find((p) => p.signingToken === token),
      getById: (id) => get().proposals.find((p) => p.id === id),
    }),
    {
      name: "axme-quotes-v8",
      storage: createJSONStorage(() => createDebouncedStorage(400)),
      version: 8,
      migrate: (persisted) => {
        const state = persisted as { products?: Product[]; proposals?: Proposal[] };
        return {
          products: state.products ?? [],
          proposals: state.proposals ?? [],
        };
      },
      partialize: (s) => ({ products: s.products, proposals: s.proposals, dismissedTrainingSample: s.dismissedTrainingSample }),
    },
  ),
);

/** Force rehydrate from storage (safe no-op if already hydrated). */
export function hydrateProposalStore() {
  try {
    void useProposalStore.persist.rehydrate();
  } catch {
    /* ignore */
  }
}

/** Catalog is usable for quoting — splash should wait for this. */
export function isFieldCatalogReady(): boolean {
  try {
    const n = useProposalStore.getState().products.length;
    if (n >= 20) return true;
    if (catalogSessionReady && n >= 8) return true;
  } catch {
    /* ignore */
  }
  return false;
}

/** Seed + core catalog if needed. Safe to call from splash. */
export function bootFieldCatalog(): void {
  try {
    useProposalStore.getState().seedIfEmpty();
  } catch {
    /* ignore */
  }
}
