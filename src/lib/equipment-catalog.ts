import type { Product, ProductOption, QuoteLine } from "./proposal-types";
import { stampEnergyStar } from "./energy-star";
import { ratingsForOutdoor, soundDbFor } from "./efficiency-ratings";
import {
  defaultDimensionsForKind,
  slimOutdoorDims,
  boschIdsDims,
  airHandlerCabinetDims,
  furnaceCabinetDims,
} from "./equipment-dimensions";
import {
  autoUnitPrice,
  DEFAULT_LABOR_DIVISOR,
  DEFAULT_LABOR_RATE,
  DEFAULT_MATERIAL_DIVISOR,
} from "./pricing";
import { getOwnerPricingSnapshot } from "./owner-settings";
import { getConcretePadConfig } from "./standard-copy-store";
import { buildWestCoastPilotCatalog } from "./west-coast-pilot-catalog";
import {
  AC_SERIES_MODELS,
  AC_SERIES_PHOTOS,
  AH_SERIES_MODELS,
  AH_SERIES_PHOTOS,
  DUCTLESS_PHOTOS,
  FURN_SERIES_PHOTOS,
  HP_SERIES_MODELS,
  HP_SERIES_PHOTOS,
  stampOfficialPhoto,
} from "./product-photos";
import { stampLockedBenefits } from "./locked-benefits";

const ART = {
  heatpump: "/product-art/heatpump.svg",
  minisplit: "/product-art/heatpump.svg",
  generic: "/product-art/generic.svg",
};

const nowIso = () => new Date().toISOString();

/**
 * Custom concrete pad — language + defaults come from Backend → Measures
 * (standard copy store). Never hardcode customer text here.
 */
export function getPadMaterial(): number {
  return getConcretePadConfig().materialCost;
}
export function getPadLabor(): number {
  return getConcretePadConfig().laborHours;
}

/** @deprecated use getPadMaterial() — kept for older imports */
export const PAD_MATERIAL = 1080;
/** @deprecated use getPadLabor() */
export const PAD_LABOR = 6.75;

/** Live customer price from pad materials + labor (same divisors as measures). */
export function padCustomerPrice(
  materialCost: number,
  laborHours: number,
): number {
  const rates = getOwnerPricingSnapshot();
  return autoUnitPrice({
    materialCost: Math.max(0, materialCost || 0),
    laborHours: Math.max(0, laborHours || 0),
    laborRate: rates.laborRate,
    materialDivisor: rates.materialDivisor,
    laborDivisor: rates.laborDivisor,
    grossProfitPerManDay: rates.grossProfitPerManDay,
    pricingMix: rates.pricingMix,
    priceMode: "auto",
  });
}

export function getPadSell(): number {
  const c = getConcretePadConfig();
  return padCustomerPrice(c.materialCost, c.laborHours);
}

/** @deprecated use getPadSell() */
export const PAD_SELL_DEPRECATED = padCustomerPrice(120, 0.75);

/**
 * When materials or labor change on an option, recompute customer priceDelta.
 * Pass lockPrice:true only when the sales person is typing the price field itself.
 */
export function repriceOptionFromCost(
  o: ProductOption,
  partial: Partial<ProductOption> = {},
  opts?: { lockPrice?: boolean },
): ProductOption {
  const next: ProductOption = {
    ...o,
    ...partial,
    body: partial.body ?? o.body,
    title: partial.title ?? o.title,
  };
  if (!opts?.lockPrice) {
    let mat = next.materialCost != null ? Number(next.materialCost) : 0;
    let hours = next.laborHours != null ? Number(next.laborHours) : 0;
    if (isPadOption(next)) {
      const padMat = getPadMaterial();
      const padLab = getPadLabor();
      if (!(mat > 0)) mat = padMat;
      if (!(hours > 0) && next.laborHours == null) hours = padLab;
      // If laborHours is explicitly 0, keep 0
      if (next.laborHours != null) hours = Math.max(0, Number(next.laborHours) || 0);
      if (next.materialCost != null) mat = Math.max(0, Number(next.materialCost) || 0);
      next.priceDelta = padCustomerPrice(mat || padMat, hours);
      next.materialCost = mat || padMat;
      next.laborHours = hours;
    } else if (mat > 0 || hours > 0) {
      next.priceDelta = padCustomerPrice(mat, hours);
    }
  } else if (partial.priceDelta != null) {
    next.priceDelta = Math.max(0, Number(partial.priceDelta) || 0);
  }
  return next;
}

/** Live title from Backend standard copy */
export function getCustomConcretePadTitle(): string {
  return getConcretePadConfig().title;
}
/** @deprecated — use getCustomConcretePadTitle() */
export const CUSTOM_CONCRETE_PAD_TITLE = "Custom Concrete Pad";

export function getCustomConcretePadBenefits(): string[] {
  return [...getConcretePadConfig().benefits];
}
/** @deprecated — use getCustomConcretePadBenefits() */
export const CUSTOM_CONCRETE_PAD_BENEFITS: string[] = [];

/** Customer option body — always from Backend store */
export function customConcretePadBody(): string {
  return getConcretePadConfig().body;
}

export function makeConcretePadOption(suffix: string): ProductOption {
  const c = getConcretePadConfig();
  return {
    id: `PAD-${suffix}`,
    title: c.title,
    body: c.body,
    priceDelta: padCustomerPrice(c.materialCost, c.laborHours),
    materialCost: c.materialCost,
    laborHours: c.laborHours,
    defaultSelected: c.defaultSelected,
    kind: "pad",
  };
}

/**
 * Always re-apply Backend → Measures pad language onto a pad option.
 * Keeps advisor-adjusted material/labor when already set; language always live.
 * Strips empty whitespace so cleared backend text does not inflate the packet row.
 */
export function withLivePadCopy(o: ProductOption): ProductOption {
  if (!isPadOption(o)) return o;
  if (o.priceLocked) return o;
  const c = getConcretePadConfig();
  const body = String(c.body || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const mat =
    o.materialCost != null && Number(o.materialCost) > 0
      ? Number(o.materialCost)
      : c.materialCost;
  const hours =
    o.laborHours != null ? Math.max(0, Number(o.laborHours) || 0) : c.laborHours;
  return {
    ...o,
    kind: "pad",
    title: c.title,
    body,
    materialCost: mat,
    laborHours: hours,
    priceDelta:
      o.materialCost != null || o.laborHours != null
        ? padCustomerPrice(mat, hours)
        : padCustomerPrice(c.materialCost, c.laborHours),
    defaultSelected:
      o.defaultSelected != null ? o.defaultSelected : c.defaultSelected,
  };
}

/** Compact customer body for any option row (pad, upgrade, accessory). */
export function cleanOptionBody(body: string | undefined | null): string {
  return String(body || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function refreshPadOptionsOnProduct(p: Product): Product {
  const opts = p.options || [];
  if (!opts.some(isPadOption)) return p;
  return {
    ...p,
    options: opts.map((o) => (isPadOption(o) ? withLivePadCopy(o) : o)),
    updatedAt: new Date().toISOString(),
  };
}

export function isPadOption(
  o: Pick<ProductOption, "kind" | "title" | "id"> | null | undefined,
): boolean {
  if (!o) return false;
  if (o.kind === "pad") return true;
  if (/^PAD-/i.test(o.id || "")) return true;
  return /custom concrete pad|concrete pad|equipment pad|composite pad/i.test(
    o.title || "",
  );
}

/** Outdoor units that can host the single job custom concrete pad. */
export function isOutdoorPadHost(
  p: Pick<Product, "equipmentKind" | "name" | "sku" | "category">,
): boolean {
  const kind = p.equipmentKind || "";
  if (kind === "heat_pump" || kind === "ac" || kind === "ductless") return true;
  const blob = `${p.name} ${p.category} ${p.sku}`.toLowerCase();
  return /condenser|outdoor unit|heat pump|air condition|mini-?split|ductless/i.test(
    blob,
  );
}

/**
 * Only the first selected outdoor measure should carry the pad option.
 * Prefer heat pump / ductless over AC when both are on the job.
 */
export function pickPadOwnerProductId(
  productIds: string[],
  products: Product[],
  preferIncluded: string[] = [],
): string | null {
  const byId = new Map(products.map((p) => [p.id, p]));
  const outdoors = productIds
    .map((id) => byId.get(id))
    .filter((p): p is Product => Boolean(p && isOutdoorPadHost(p)));
  if (!outdoors.length) return null;

  const rank = (p: Product) => {
    const kind = p.equipmentKind || "";
    if (kind === "heat_pump") return 0;
    if (kind === "ductless") return 1;
    if (kind === "ac") return 2;
    return 3;
  };
  const sorted = [...outdoors].sort((a, b) => {
    const ai = preferIncluded.includes(a.id) ? 0 : 1;
    const bi = preferIncluded.includes(b.id) ? 0 : 1;
    if (ai !== bi) return ai - bi;
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    return productIds.indexOf(a.id) - productIds.indexOf(b.id);
  });
  return sorted[0].id;
}

export function optionsWithoutPadIfNotOwner(
  product: Product,
  padOwnerId: string | null,
): ProductOption[] {
  const opts = product.options || [];
  if (!opts.some(isPadOption)) return opts;
  if (padOwnerId && product.id === padOwnerId) return opts;
  if (!padOwnerId && isOutdoorPadHost(product)) return opts;
  return opts.filter((o) => !isPadOption(o));
}

/**
 * Keep pad option on at most one outdoor line after quote build.
 */
export function enforceSinglePadOnLines(lines: QuoteLine[]): QuoteLine[] {
  let ownerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const li = lines[i];
    const hasPad = (li.options || []).some(isPadOption);
    if (!hasPad) continue;
    const padIds = (li.options || []).filter(isPadOption).map((o) => o.id);
    const selected = (li.selectedOptionIds || []).some((id) =>
      padIds.includes(id),
    );
    if (selected && ownerIdx < 0) ownerIdx = i;
    if (ownerIdx < 0 && li.role === "included") ownerIdx = i;
  }
  if (ownerIdx < 0) {
    for (let i = 0; i < lines.length; i++) {
      if ((lines[i].options || []).some(isPadOption)) {
        ownerIdx = i;
        break;
      }
    }
  }
  if (ownerIdx < 0) return lines;

  return lines.map((li, i) => {
    const opts = li.options || [];
    if (!opts.some(isPadOption)) return li;
    if (i === ownerIdx) {
      const options = opts.map((o) =>
        isPadOption(o)
          ? repriceOptionFromCost({
              ...o,
              kind: "pad" as const,
              title: getCustomConcretePadTitle(),
              body:
                o.body && o.body.length > 40 ? o.body : customConcretePadBody(),
              materialCost:
                o.materialCost != null && o.materialCost > 0
                  ? o.materialCost
                  : getPadMaterial(),
              laborHours:
                o.laborHours != null && o.laborHours > 0
                  ? o.laborHours
                  : getPadLabor(),
            })
          : o,
      );
      return { ...li, options };
    }
    const padIds = new Set(opts.filter(isPadOption).map((o) => o.id));
    return {
      ...li,
      options: opts.filter((o) => !isPadOption(o)),
      selectedOptionIds: (li.selectedOptionIds || []).filter(
        (id) => !padIds.has(id),
      ),
    };
  });
}

/** A leftover kit card — pad is never its own measure on the contract. */
export function isStandalonePadLine(
  line: Pick<QuoteLine, "id" | "name"> & { sku?: string | null },
): boolean {
  const id = String(line.id || "");
  const sku = String(line.sku || "");
  const name = String(line.name || "").trim();
  if (/__opt_pad$/i.test(id) || /offer_.*_pad/i.test(id)) return true;
  if (/^OPT-PAD$/i.test(sku)) return true;
  return /^(custom\s+)?concrete pad$/i.test(name);
}

function padOwnerLineIndex(lines: QuoteLine[]): number {
  const score = (li: QuoteLine): number => {
    if ((li.options || []).some(isPadOption)) return 0;
    const blob = `${li.name} ${li.description || ""}`.toLowerCase();
    if (/heat pump/.test(blob) && !/water heater/.test(blob)) return 1;
    if (/ductless|mini-?split/.test(blob)) return 2;
    if (/\bac\b|air condition|condenser|outdoor/.test(blob)) return 3;
    return 99;
  };
  let best = -1;
  let bestScore = 99;
  for (let i = 0; i < lines.length; i++) {
    const s = score(lines[i]);
    if (s < bestScore) {
      best = i;
      bestScore = s;
    }
  }
  return bestScore < 99 ? best : -1;
}

/**
 * Concrete pad is a small option on the outdoor unit (same as a furnace
 * option). Never leave it as its own Optional · Concrete pad card.
 */
export function foldStandalonePadIntoOwner(lines: QuoteLine[]): QuoteLine[] {
  const pads = lines.filter(isStandalonePadLine);
  const rest = lines.filter((l) => !isStandalonePadLine(l));
  const normalized = enforceSinglePadOnLines(rest);
  if (!pads.length) return normalized;

  const ownerIdx = padOwnerLineIndex(normalized);
  if (ownerIdx < 0) return normalized;

  const owner = normalized[ownerIdx];
  const src = pads[0];
  let opts = [...(owner.options || [])];
  if (!opts.some(isPadOption)) {
    opts.unshift(makeConcretePadOption(owner.id.replace(/^li_/, "") || owner.id));
  }
  const extraScope = [src.workScope, src.description]
    .filter(Boolean)
    .join("\n")
    .trim();
  opts = opts.map((o) => {
    if (!isPadOption(o)) return o;
    const extra = extraScope
      .split(/\n+/)
      .map((s) => s.replace(/^\d+[\.)]\s*/, "").trim())
      .filter(Boolean)
      .filter((s) => !(o.body || "").includes(s))
      .join("\n");
    return {
      ...o,
      kind: "pad" as const,
      title: getCustomConcretePadTitle(),
      priceDelta:
        Number(src.unitPrice) > 0 ? Number(src.unitPrice) : o.priceDelta,
      materialCost:
        Number(src.materialCost) > 0 ? Number(src.materialCost) : o.materialCost,
      laborHours:
        Number(src.laborHours) > 0 ? Number(src.laborHours) : o.laborHours,
      body: [o.body || customConcretePadBody(), extra].filter(Boolean).join("\n"),
    };
  });
  const padIds = opts.filter(isPadOption).map((o) => o.id);
  const selected = (owner.selectedOptionIds || []).filter(
    (id) => !padIds.includes(id),
  );
  const padWasIncluded = !src.optional && src.role !== "optional";
  if (padWasIncluded) selected.push(...padIds);

  const next = [...normalized];
  next[ownerIdx] = { ...owner, options: opts, selectedOptionIds: selected };
  return enforceSinglePadOnLines(next);
}

export const TONNAGE_OPTIONS = [2, 2.5, 3, 3.5, 4, 5] as const;

export function normalizeTonnage(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 3;
  const opts = [...TONNAGE_OPTIONS];
  return opts.reduce((best, x) =>
    Math.abs(x - n) < Math.abs(best - n) ? x : best,
  );
}

export function tonnageLabel(ton: number): string {
  return String(normalizeTonnage(ton));
}

export function matchKeyFor(
  kind: "hp" | "ah" | "ac" | "furnace",
  tonnage: number,
): string {
  const t = tonnageLabel(normalizeTonnage(tonnage));
  if (kind === "furnace") return "80afue-mid";
  if (kind === "ah") return t + "ton-ah";
  if (kind === "ac") return t + "ton-class";
  return t + "ton-hp";
}

export function productMatchesTonnage(
  p: Pick<Product, "matchKey" | "equipmentKind" | "category" | "name">,
  tonnage: number,
): boolean {
  if (!p.matchKey) return true;
  const t = tonnageLabel(normalizeTonnage(tonnage));
  if (p.matchKey.includes(t + "ton")) return true;
  if (p.equipmentKind === "furnace") return true;
  if (p.matchKey === "ductless-mid") return tonnage <= 3.5;
  if (p.matchKey === "ductless-large") return tonnage >= 3.5;
  if (p.matchKey === "bosch-mid") return tonnage >= 2 && tonnage <= 4;
  if (p.matchKey === "bosch-large") return tonnage >= 3.5;
  return false;
}

export function tonnageNeighborhood(tonnage: number): number[] {
  const opts = [...TONNAGE_OPTIONS];
  const t = normalizeTonnage(tonnage);
  let i = opts.findIndex((x) => Math.abs(x - t) < 0.01);
  if (i < 0) {
    i = opts.reduce(
      (best, x, idx) =>
        Math.abs(x - t) < Math.abs(opts[best] - t) ? idx : best,
      0,
    );
  }
  const out: number[] = [opts[i]];
  if (i > 0) out.unshift(opts[i - 1]);
  if (i < opts.length - 1) out.push(opts[i + 1]);
  return out;
}

export function productMatchesTonnageNeighborhood(
  p: Pick<Product, "matchKey" | "equipmentKind" | "category" | "name">,
  tonnage: number,
): boolean {
  if (
    !p.equipmentKind ||
    p.equipmentKind === "other" ||
    p.equipmentKind === "furnace"
  ) {
    return true;
  }
  if (
    p.equipmentKind !== "heat_pump" &&
    p.equipmentKind !== "air_handler" &&
    p.equipmentKind !== "ac" &&
    p.equipmentKind !== "ductless"
  ) {
    return true;
  }
  return tonnageNeighborhood(tonnage).some((t) => productMatchesTonnage(p, t));
}

export function tonnageFromProduct(
  p: Pick<Product, "matchKey" | "name" | "tierLabel">,
): number | null {
  const blob = `${p.matchKey || ""} ${p.name || ""} ${p.tierLabel || ""}`;
  const m = blob.match(/(\d+(?:\.\d+)?)\s*ton/i);
  if (!m) return null;
  return normalizeTonnage(Number(m[1]));
}

export function isDuctlessProduct(
  p: Pick<Product, "equipmentKind" | "category" | "name" | "sku" | "familyId">,
): boolean {
  const sku = (p.sku || "").toUpperCase();
  // Communicating FAU (SVZ/PVA + SUZ/PUZ) is ducted — not a wall/cassette ductless
  if (/^MIT-(SUZ|SVZ|PUZ|PVA)/.test(sku)) return false;
  if (p.equipmentKind === "ductless") return true;
  const blob =
    `${p.name} ${p.category} ${p.sku} ${p.familyId || ""}`.toLowerCase();
  return (
    /ductless/.test(blob) ||
    /mini-?split/.test(blob) ||
    /multi-?split/.test(blob) ||
    /hyper-?heating/.test(blob) ||
    /mitsu-ductless/.test(blob) ||
    /^mit-ms|^mit-hyper|^mit-msz|^mit-mxz/i.test(p.sku || "")
  );
}

type LadderTier = {
  tier: number;
  tierLabel: string;
  nameSuffix: string;
  skuSuffix: string;
  seerNote: string;
  benefits: string[];
  priceMult: number;
  matMult: number;
  modelSku?: string;
  photoUrl?: string;
};

const HP_TIERS: LadderTier[] = [
  {
    tier: 1,
    tierLabel: "Comfort heat pump · 27SCA5",
    nameSuffix: "Comfort™ 16 Heat Pump 27SCA5",
    skuSuffix: "COM",
    seerNote: "Comfort 27SCA5 single-stage heat pump",
    modelSku: HP_SERIES_MODELS.comfort,
    photoUrl: HP_SERIES_PHOTOS.comfort,
    benefits: [
      "Current Comfort 27SCA5 — heat and cool with one outdoor unit",
      "Solid SEER2 / HSPF2 Comfort-tier efficiency",
      "Matched Comfort indoor equipment",
    ],
    priceMult: 1,
    matMult: 1,
  },
  {
    tier: 2,
    tierLabel: "Performance heat pump · 27TPA8",
    nameSuffix: "Performance™ 17 Heat Pump 27TPA8",
    skuSuffix: "PER",
    seerNote: "Performance 27TPA8 two-stage heat pump",
    modelSku: HP_SERIES_MODELS.performance,
    photoUrl: HP_SERIES_PHOTOS.performance,
    benefits: [
      "Current Performance 27TPA8 — two-stage compressor",
      "More even temperatures than Comfort",
      "Quieter outdoor operation than single-stage",
    ],
    priceMult: 1.18,
    matMult: 1.12,
  },
  {
    tier: 3,
    tierLabel: "Infinity heat pump · 27VNA3",
    nameSuffix: "Infinity® 23 Heat Pump 27VNA3",
    skuSuffix: "INF",
    seerNote: "Infinity 27VNA3 variable-speed heat pump",
    modelSku: HP_SERIES_MODELS.infinity,
    photoUrl: HP_SERIES_PHOTOS.infinity,
    benefits: [
      "Current Infinity 27VNA3 — variable-speed compressor",
      "Top-tier quiet and humidity control",
      "Infinity communicating controls",
    ],
    priceMult: 1.42,
    matMult: 1.28,
  },
];

const AH_TIERS: LadderTier[] = [
  {
    tier: 1,
    tierLabel: "Comfort air handler · FJ5",
    nameSuffix: "Comfort™ Air Handler FJ5",
    skuSuffix: "COM",
    seerNote: "Matched Comfort FJ5 indoor",
    modelSku: AH_SERIES_MODELS.comfort,
    photoUrl: AH_SERIES_PHOTOS.comfort,
    benefits: [
      "Current Comfort FJ5 indoor",
      "Reliable multi-speed blower",
      "Clean cabinet service access",
    ],
    priceMult: 1,
    matMult: 1,
  },
  {
    tier: 2,
    tierLabel: "Performance air handler · FT5",
    nameSuffix: "Performance™ Air Handler FT5",
    skuSuffix: "PER",
    seerNote: "Performance FT5 indoor",
    modelSku: AH_SERIES_MODELS.performance,
    photoUrl: AH_SERIES_PHOTOS.performance,
    benefits: [
      "Current Performance FT5 indoor",
      "Better humidity help",
      "Quieter than base Comfort",
    ],
    priceMult: 1.15,
    matMult: 1.1,
  },
  {
    tier: 3,
    tierLabel: "Infinity air handler · FE5B",
    nameSuffix: "Infinity® Air Handler FE5B",
    skuSuffix: "INF",
    seerNote: "Infinity FE5B communicating indoor",
    modelSku: AH_SERIES_MODELS.infinity,
    photoUrl: AH_SERIES_PHOTOS.infinity,
    benefits: [
      "Variable-speed constant airflow",
      "Infinity communicating",
      "Premium comfort & filtration options",
    ],
    priceMult: 1.35,
    matMult: 1.22,
  },
];

const AC_TIERS: LadderTier[] = [
  {
    tier: 1,
    tierLabel: "Comfort AC · 26SCA5",
    nameSuffix: "Comfort™ 16 Air Conditioner 26SCA5",
    skuSuffix: "COM",
    seerNote: "Comfort 26SCA5 single-stage cooling · up to 16.5 SEER2",
    modelSku: AC_SERIES_MODELS.comfort,
    photoUrl: AC_SERIES_PHOTOS.comfort,
    benefits: [
      "Current Comfort 26SCA5 — single-stage cooling",
      "Solid SEER2 Comfort efficiency",
      "Matched Comfort indoor equipment",
    ],
    priceMult: 1,
    matMult: 1,
  },
  {
    tier: 2,
    tierLabel: "Performance AC · 26TPA8",
    nameSuffix: "Performance™ 18 Air Conditioner 26TPA8",
    skuSuffix: "PER",
    seerNote: "Performance 26TPA8 two-stage cooling · up to 18 SEER2",
    modelSku: AC_SERIES_MODELS.performance,
    photoUrl: AC_SERIES_PHOTOS.performance,
    benefits: [
      "Current Performance 26TPA8 — two-stage cooling",
      "More even temps and humidity control",
      "Quieter outdoor operation than Comfort",
    ],
    priceMult: 1.16,
    matMult: 1.1,
  },
  {
    tier: 3,
    tierLabel: "Infinity AC · 26VNA1",
    nameSuffix: "Infinity® 21 Air Conditioner 26VNA1",
    skuSuffix: "INF",
    seerNote: "Infinity 26VNA1 variable-speed cooling · up to 21 SEER2",
    modelSku: AC_SERIES_MODELS.infinity,
    photoUrl: AC_SERIES_PHOTOS.infinity,
    benefits: [
      "Current Infinity 26VNA1 — variable-speed compressor",
      "Top humidity and quiet performance",
      "Infinity communicating controls",
    ],
    priceMult: 1.38,
    matMult: 1.25,
  },
];

function baseHpPrice(ton: number): number {
  const map: Record<number, number> = {
    2: 4800,
    2.5: 5200,
    3: 5600,
    3.5: 6100,
    4: 6600,
    5: 7400,
  };
  return map[ton] ?? 5600;
}

function baseAhPrice(ton: number): number {
  const map: Record<number, number> = {
    2: 2200,
    2.5: 2500,
    3: 2800,
    3.5: 3100,
    4: 3400,
    5: 3900,
  };
  return map[ton] ?? 2800;
}

function baseAcPrice(ton: number): number {
  const map: Record<number, number> = {
    2: 3200,
    2.5: 3500,
    3: 3800,
    3.5: 4200,
    4: 4600,
    5: 5200,
  };
  return map[ton] ?? 3800;
}

function tonSlug(ton: number): string {
  return String(ton).replace(".", "p");
}

export function buildGoodmanSizedEquipment(): Product[] {
  const out: Product[] = [];
  const now = nowIso();
  for (const ton of TONNAGE_OPTIONS) {
    const tLabel = tonnageLabel(ton);
    const slug = tonSlug(ton);
    const hpPrice = Math.round(baseHpPrice(ton) * 0.78);
    const hpMat = Math.round(hpPrice * 0.48);
    out.push({
      id: "prod_gdm_hp_" + slug,
      name: "Goodman GSZH5 Heat Pump (" + tLabel + " ton)",
      sku: "GDM-GSZH5-" + slug.toUpperCase(),
      category: "Heat pump · Goodman",
      description:
        tLabel +
        "-ton Goodman GSZH5 15.2 SEER2 heat pump. 24-volt. Pair with the matching Goodman AMST air handler.",
      unitPrice: hpPrice,
      unit: "each",
      materialCost: hpMat,
      laborHours: 2.4 + ton * 0.32,
      familyId: "goodman-hp-" + slug,
      tier: 1,
      tierLabel: "Goodman GSZH5 · " + tLabel + " ton",
      equipmentKind: "heat_pump",
      matchKey: matchKeyFor("hp", ton),
      dimensions: defaultDimensionsForKind("heat_pump", ton)!,
      ...ratingsForOutdoor("heat_pump", 1, ton),
      soundDb: 71,
      installFuel: "electric",
      installPower: "dedicated_circuit",
      installMount: "pad",
      installFootprint: "standard_cube",
      installEcosystem: "none",
      installCommunicating: false,
      benefits: [
        "Goodman GSZH5 — 15.2 SEER2 class",
        "24-volt — works with a regular thermostat",
        tLabel + "-ton capacity class",
        "Pair with the matching Goodman AMST air handler",
      ],
      options: [makeConcretePadOption("gdm_hp_" + slug)],
      imageUrl: "/product-photos/hp-goodman-gszh5.svg",
      workScope:
        "1. Set the Goodman outdoor heat pump on the agreed pad.\n2. Connect the line set, power, and control wire to the matching air handler.\n3. Charge, start, and check heat and cool.",
      createdAt: now,
      updatedAt: now,
    });
    const ahPrice = Math.round(baseAhPrice(ton) * 0.82);
    const ahMat = Math.round(ahPrice * 0.5);
    out.push({
      id: "prod_gdm_ah_" + slug,
      name: "Goodman AMST Air Handler (" + tLabel + " ton)",
      sku: "GDM-AMST-" + slug.toUpperCase(),
      category: "Air handler · Goodman",
      description:
        tLabel +
        "-ton Goodman AMST multi-position air handler. 24-volt. Pair with the matching Goodman GSZH5 heat pump.",
      unitPrice: ahPrice,
      unit: "each",
      materialCost: ahMat,
      laborHours: 3.2 + ton * 0.28,
      familyId: "goodman-ah-" + slug,
      tier: 1,
      tierLabel: "Goodman AMST · " + tLabel + " ton",
      equipmentKind: "air_handler",
      matchKey: matchKeyFor("ah", ton),
      dimensions: airHandlerCabinetDims(ton),
      installFuel: "electric",
      installPower: "from_outdoor_shared",
      installMount: "either",
      installFootprint: "standard_cube",
      installEcosystem: "none",
      installCommunicating: false,
      benefits: [
        "Goodman AMST multi-position air handler",
        "24-volt — regular thermostat",
        tLabel + "-ton capacity class",
        "Pair with the matching Goodman GSZH5 heat pump",
      ],
      options: [],
      imageUrl: "/product-photos/ah-goodman-amst.svg",
      workScope:
        "1. Set the Goodman air handler at the agreed indoor location.\n2. Connect the coil, drain, power, and control wire.\n3. Start with the matching outdoor and check airflow.",
      createdAt: now,
      updatedAt: now,
    });
  }
  return out;
}

export function buildCarrierSizedEquipment(): Product[] {
  const out: Product[] = [];
  for (const ton of TONNAGE_OPTIONS) {
    const tLabel = tonnageLabel(ton);
    const slug = tonSlug(ton);
    for (const tier of HP_TIERS) {
      // Infinity line is whole-ton only (no 2.5 / 3.5) — half-ton jobs bridge to 3 & 4
      if (tier.tier === 3 && Math.abs(ton * 2 - Math.round(ton * 2)) < 0.01 && !Number.isInteger(ton)) {
        continue;
      }
      const unitPrice = Math.round(baseHpPrice(ton) * tier.priceMult);
      const materialCost = Math.round(unitPrice * 0.46 * tier.matMult);
      out.push({
        id: "prod_car_hp_" + slug + "_t" + tier.tier,
        name: "Carrier " + tier.nameSuffix + " (" + tLabel + " ton)",
        sku: "CAR-HP-" + slug.toUpperCase() + "-" + tier.skuSuffix,
        category: "Heat pump · Carrier",
        description:
          tLabel +
          "-ton Carrier heat pump · " +
          tier.seerNote +
          ". Sized to your load class. Custom concrete pad offered as option (default on).",
        unitPrice,
        unit: "each",
        materialCost,
        laborHours: 2.5 + ton * 0.35 + (tier.tier - 1) * 0.25,
        familyId: "carrier-hp-" + slug,
        tier: tier.tier,
        tierLabel: tier.tierLabel + " · " + tLabel + " ton",
        equipmentKind: "heat_pump",
        matchKey: matchKeyFor("hp", ton),
        dimensions: defaultDimensionsForKind("heat_pump", ton)!,
        ...ratingsForOutdoor("heat_pump", tier.tier, ton),
        soundDb: soundDbFor("heat_pump", tier.tier) ?? undefined,
        benefits: [
          ...tier.benefits,
          "Quoted in the " + tLabel + "-ton capacity class",
          "Custom concrete pad available — sturdier mount & better line-set protection",
        ],
        options: [makeConcretePadOption("hp_" + slug + "_t" + tier.tier)],
        imageUrl: tier.photoUrl || HP_SERIES_PHOTOS.comfort,
        workScope:
          "1. Recover refrigerant; remove existing outdoor unit.\n2. Set outdoor unit (custom concrete pad if selected).\n3. Line set and electrical.\n4. Evacuate, charge, and commission heat/cool modes.\n5. Owner orientation on heat pump operation.",
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    }
    for (const tier of AH_TIERS) {
      if (tier.tier === 3 && Math.abs(ton * 2 - Math.round(ton * 2)) < 0.01 && !Number.isInteger(ton)) {
        continue;
      }
      const unitPrice = Math.round(baseAhPrice(ton) * tier.priceMult);
      const materialCost = Math.round(unitPrice * 0.48 * tier.matMult);
      out.push({
        id: "prod_car_ah_" + slug + "_t" + tier.tier,
        name: "Carrier " + tier.nameSuffix + " (" + tLabel + " ton)",
        sku: "CAR-AH-" + slug.toUpperCase() + "-" + tier.skuSuffix,
        category: "Air handler · Carrier",
        description:
          tLabel +
          "-ton Carrier air handler matched to the outdoor capacity class.",
        unitPrice,
        unit: "each",
        materialCost,
        laborHours: 2.5 + ton * 0.2 + (tier.tier - 1) * 0.2,
        familyId: "carrier-ah-" + slug,
        tier: tier.tier,
        tierLabel: tier.tierLabel + " · " + tLabel + " ton",
        equipmentKind: "air_handler",
        matchKey: matchKeyFor("ah", ton),
        dimensions: defaultDimensionsForKind("air_handler", ton) ?? undefined,
        benefits: [
          ...tier.benefits,
          "Matched to " + tLabel + "-ton outdoor capacity class",
        ],
        options: [],
        imageUrl: tier.photoUrl || AH_SERIES_PHOTOS.comfort,
        workScope:
          "1. Set air handler / fan coil with proper clearances.\n2. Refrigerant, condensate, electrical, and transitions.\n3. Commission with matched outdoor unit.",
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    }
    for (const tier of AC_TIERS) {
      if (
        tier.tier === 3 &&
        Math.abs(ton * 2 - Math.round(ton * 2)) < 0.01 &&
        !Number.isInteger(ton)
      ) {
        continue;
      }
      const unitPrice = Math.round(baseAcPrice(ton) * tier.priceMult);
      const materialCost = Math.round(unitPrice * 0.45 * tier.matMult);
      out.push({
        id: "prod_car_ac_" + slug + "_t" + tier.tier,
        name: "Carrier " + tier.nameSuffix + " (" + tLabel + " ton)",
        sku: "CAR-AC-" + slug.toUpperCase() + "-" + tier.skuSuffix,
        category: "Air conditioner · Carrier",
        description:
          tLabel +
          "-ton Carrier air conditioner · " +
          tier.seerNote +
          ". Custom concrete pad offered as option (default on).",
        unitPrice,
        unit: "each",
        materialCost,
        laborHours: 2.25 + ton * 0.3 + (tier.tier - 1) * 0.2,
        familyId: "carrier-ac-" + slug,
        tier: tier.tier,
        tierLabel: tier.tierLabel + " · " + tLabel + " ton",
        equipmentKind: "ac",
        matchKey: matchKeyFor("ac", ton),
        dimensions: defaultDimensionsForKind("ac", ton) ?? undefined,
        ...ratingsForOutdoor("ac", tier.tier, ton),
        soundDb: soundDbFor("ac", tier.tier) ?? undefined,
        benefits: [
          ...tier.benefits,
          "Quoted in the " + tLabel + "-ton capacity class",
          "Custom concrete pad available — sturdier mount & line-set protection",
        ],
        options: [makeConcretePadOption("ac_" + slug + "_t" + tier.tier)],
        imageUrl: tier.photoUrl || AC_SERIES_PHOTOS.comfort,
        workScope:
          "1. Recover refrigerant; remove existing condenser.\n2. Set outdoor unit (custom concrete pad if selected).\n3. Line set and electrical.\n4. Evacuate, charge, and commission cooling.\n5. Owner orientation.",
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    }
  }
  return out;
}

export function buildAltBrandHeatPumps(): Product[] {
  const out: Product[] = [];
  const mitMz = [
    { zones: 2, ton: 1.5, sku: "2Z-15", mat: 4000, labor: 7 },
    { zones: 2, ton: 2, sku: "2Z", mat: 4600, labor: 7.5 },
    { zones: 2, ton: 2.5, sku: "2Z-25", mat: 5200, labor: 8 },
    { zones: 2, ton: 3, sku: "2Z-3", mat: 5800, labor: 8.5 },
    { zones: 2, ton: 3.5, sku: "2Z-35", mat: 6400, labor: 9 },
    { zones: 3, ton: 2, sku: "3Z-2", mat: 5000, labor: 8.5 },
    { zones: 3, ton: 2.5, sku: "3Z-25", mat: 5400, labor: 9 },
    { zones: 3, ton: 3, sku: "3Z", mat: 5800, labor: 9.5 },
    { zones: 3, ton: 3.5, sku: "3Z-35", mat: 6400, labor: 10 },
    { zones: 3, ton: 4, sku: "3Z-4", mat: 7200, labor: 10.5 },
    { zones: 3, ton: 4.5, sku: "3Z-45", mat: 8000, labor: 11 },
    { zones: 3, ton: 5, sku: "3Z-5", mat: 8800, labor: 11.5 },
    { zones: 4, ton: 2.5, sku: "4Z-25", mat: 6200, labor: 10.5 },
    { zones: 4, ton: 3, sku: "4Z-3", mat: 6800, labor: 11 },
    { zones: 4, ton: 3.5, sku: "4Z", mat: 7200, labor: 11.5 },
    { zones: 4, ton: 4, sku: "4Z-4", mat: 7800, labor: 12 },
    { zones: 4, ton: 4.5, sku: "4Z-45", mat: 8600, labor: 12.5 },
    { zones: 4, ton: 5, sku: "4Z-5", mat: 9400, labor: 13 },
    { zones: 5, ton: 3, sku: "5Z-3", mat: 7600, labor: 12.5 },
    { zones: 5, ton: 3.5, sku: "5Z-35", mat: 8100, labor: 13 },
    { zones: 5, ton: 4, sku: "5Z", mat: 8600, labor: 13.5 },
    { zones: 5, ton: 4.5, sku: "5Z-45", mat: 9200, labor: 14 },
    { zones: 5, ton: 5, sku: "5Z-5", mat: 10000, labor: 14.5 },
    { zones: 8, ton: 5, sku: "8Z", mat: 12400, labor: 18 },
  ];
  for (const mz of mitMz) {
    const sell = Math.round(
      autoUnitPrice({
        materialCost: mz.mat,
        laborHours: mz.labor,
        laborRate: DEFAULT_LABOR_RATE,
        materialDivisor: DEFAULT_MATERIAL_DIVISOR,
        laborDivisor: DEFAULT_LABOR_DIVISOR,
        priceMode: "auto",
      }),
    );
    out.push({
      id: "prod_mit_ms_mz_" + mz.sku.toLowerCase().replace(/\./g, ""),
      name: "Mitsubishi MXZ " + mz.zones + "-Zone · " + mz.ton + "-ton Ductless System",
      sku: "MIT-MS-MZ-" + mz.sku,
      category: "Ductless · Mitsubishi multi-zone",
      description:
        "Mitsubishi outdoor for up to " +
        mz.zones +
        " indoor heads. " +
        (mz.zones >= 8
          ? "This size uses a distribution box, a dedicated circuit, a service light, and an attic pan when the box is in the attic. Refrigerant lines run from the box to each head."
          : "Refrigerant lines run from the outdoor unit to each indoor head on a typical 2–5 zone system."),
      unitPrice: sell,
      unit: "system",
      materialCost: mz.mat,
      laborHours: mz.labor,
      familyId: "mitsu-ductless-mz-" + mz.sku.toLowerCase(),
      tier: mz.zones >= 8 ? 3 : 2,
      tierLabel: "Mitsubishi multi-zone · " + mz.zones + "-zone " + mz.ton + " ton",
      equipmentKind: "ductless",
      dimensions: slimOutdoorDims(mz.ton),
      matchKey: matchKeyFor("hp", mz.ton),
      ...ratingsForOutdoor("ductless", 2, mz.ton),
      soundDb: soundDbFor("ductless", 2) ?? undefined,
      benefits: [
        "One outdoor serves multiple indoor heads",
        "Independent room-by-room comfort",
        mz.zones >= 8
          ? "Distribution box path — dedicated power, service light, and attic pan when the box is in the attic"
          : "Up to " + mz.zones + " rooms on this outdoor",
        "High wall, 1-way cassette, low wall, or slim ducted indoor",
        "Custom concrete pad available for the outdoor unit",
      ],
      options: [makeConcretePadOption("mit_ms_mz_" + mz.sku.toLowerCase())],
      imageUrl:
        mz.zones >= 5 ? DUCTLESS_PHOTOS.mitMz : DUCTLESS_PHOTOS.mitOut,
      workScope:
        "1. Confirm each indoor head room and style with the homeowner.\n" +
        "2. Mount indoor heads; route line sets" +
        (mz.zones >= 8 ? " from the distribution box to each head" : "") +
        " and condensate.\n" +
        "3. Set the multi-zone outdoor (custom concrete pad if selected).\n" +
        (mz.zones >= 8
          ? "4. Set the distribution box, dedicated circuit, service light, and attic pan as specified.\n"
          : "4. Vacuum, charge, and start every indoor head.\n") +
        "5. Set remotes and Wi-Fi; train the homeowner on each room.",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
  }

  for (const ton of TONNAGE_OPTIONS) {
    const tLabel = tonnageLabel(ton);
    const slug = tonSlug(ton);
    out.push({
      id: "prod_bosch_" + slug,
      name: "Bosch IDS Inverter Heat Pump (" + tLabel + " ton)",
      sku: "BOS-IDS-" + slug.toUpperCase(),
      category: "Heat pump · Bosch",
      description:
        "Bosch inverter ducted heat pump · " +
        tLabel +
        " ton. Custom concrete pad option default on.",
      unitPrice: Math.round(6000 + ton * 950),
      unit: "system",
      materialCost: Math.round(3200 + ton * 480),
      laborHours: 4 + ton * 0.5,
      familyId: "bosch-ids-" + slug,
      tier: 1,
      tierLabel: "Bosch IDS · " + tLabel + " ton",
      equipmentKind: "heat_pump",
      dimensions: boschIdsDims(ton),
      matchKey: matchKeyFor("hp", ton),
      installFuel: "electric",
      installPower: "dedicated_circuit",
      installMount: "pad",
      installFootprint: "standard_cube",
      installEcosystem: "none",
      installCommunicating: false,
      seer2: ton >= 4 ? 18.5 : 20.0,
      eer2: ton >= 4 ? 11.5 : 12.5,
      hspf2: ton >= 4 ? 9.0 : 10.0,
      soundDb: ton >= 4 ? 58 : 56,
      benefits: [
        "Inverter-driven capacity",
        "Year-round heat pump comfort",
        "Side-discharge outdoor — as low as 56 dBA class",
        tLabel + "-ton capacity class",
        "Custom concrete pad available — sturdier mount & line-set protection",
      ],
      options: [makeConcretePadOption("bosch_" + slug)],
      imageUrl: ART.heatpump,
      workScope:
        "1. Set outdoor + air handler.\n2. Set outdoor (custom concrete pad if selected).\n3. Charge and commission inverter staging.",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    const ahSell = Math.round(baseAhPrice(ton) * 1.08);
    out.push({
      id: "prod_bosch_ah_" + slug,
      name: "Bosch IDS Air Handler (" + tLabel + " ton)",
      sku: "BOS-BVA-" + slug.toUpperCase(),
      category: "Air handler · Bosch",
      description:
        tLabel +
        "-ton Bosch IDS air handler. Matched to the Bosch IDS outdoor of the same size. Conventional 24-volt control.",
      unitPrice: ahSell,
      unit: "each",
      materialCost: Math.round(ahSell * 0.48),
      laborHours: 2.5 + ton * 0.2,
      familyId: "bosch-ids-ah-" + slug,
      tier: 1,
      tierLabel: "Bosch IDS indoor · " + tLabel + " ton",
      equipmentKind: "air_handler",
      matchKey: matchKeyFor("ah", ton),
      installFuel: "n/a",
      installPower: "from_outdoor_shared",
      installMount: "either",
      installFootprint: "standard_cube",
      installEcosystem: "none",
      installCommunicating: false,
      dimensions: airHandlerCabinetDims(ton),
      benefits: [
        "Matched Bosch IDS indoor airflow",
        "Quiet inverter-ready cabinet",
        "Standard 24-volt control — pairs with Bosch IDS outdoor",
        "Sized to the " + tLabel + "-ton outdoor class",
      ],
      options: [],
      imageUrl: ART.generic,
      workScope:
        "1. Set the Bosch air handler; transitions, condensate, and electrical.\n" +
        "2. Connect the line set to the matched Bosch IDS outdoor.\n" +
        "3. Commission airflow with the outdoor inverter.\n" +
        "4. Owner orientation on filter and drain.",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
  }
  return out;
}

const DUCTLESS_1TO1 = [
  { kbtu: 9, ton: 0.75, mat: 1680, labor: 4.2 },
  { kbtu: 12, ton: 1, mat: 1980, labor: 4.5 },
  { kbtu: 15, ton: 1.25, mat: 2280, labor: 4.8 },
  { kbtu: 18, ton: 1.5, mat: 2480, labor: 5.0 },
  { kbtu: 24, ton: 2, mat: 3120, labor: 5.6 },
  { kbtu: 36, ton: 3, mat: 4180, labor: 6.4 },
] as const;

function sellFromCost(mat: number, labor: number): number {
  return Math.round(
    autoUnitPrice({
      materialCost: mat,
      laborHours: labor,
      laborRate: DEFAULT_LABOR_RATE,
      materialDivisor: DEFAULT_MATERIAL_DIVISOR,
      laborDivisor: DEFAULT_LABOR_DIVISOR,
      priceMode: "auto",
    }),
  );
}

/** Residential 1-to-1 line — 9 / 12 / 18 / 24 / 36k. */
export function buildDuctlessOneToOne(): Product[] {
  const series = [
    {
      brand: "Mitsubishi",
      key: "mit",
      sku: "MIT-MS",
      title: "Mitsubishi",
      extra: "",
      tier: 1,
      matMul: 1,
      laborAdd: 0,
      photo: DUCTLESS_PHOTOS.mszFs,
    },
    {
      brand: "Mitsubishi",
      key: "mithyper",
      sku: "MIT-HYPER",
      title: "Mitsubishi Hyper-Heating®",
      extra: " Rated heat when it is actually cold outside.",
      tier: 2,
      matMul: 1.28,
      laborAdd: 0.4,
      photo: DUCTLESS_PHOTOS.mszFs,
    },
    {
      brand: "Carrier",
      key: "carperf",
      sku: "CAR-MS-PERF",
      title: "Carrier Performance™",
      extra: " Everyday inverter heat and cool.",
      tier: 1,
      matMul: 0.96,
      laborAdd: 0,
      photo: DUCTLESS_PHOTOS.carPerfWall,
    },
    {
      brand: "Carrier",
      key: "carinf",
      sku: "CAR-MS-INF",
      title: "Carrier Infinity®",
      extra: " Quietest Carrier ductless in this lineup.",
      tier: 3,
      matMul: 1.22,
      laborAdd: 0.35,
      photo: DUCTLESS_PHOTOS.carInfWall,
    },
  ] as const;

  const out: Product[] = [];
  for (const sz of DUCTLESS_1TO1) {
    const tag = String(sz.kbtu).padStart(2, "0");
    for (const s of series) {
      // 15k 1-to-1 is Mitsubishi only — Carrier 38MARB class is 9/12/18/24.
      if (sz.kbtu === 15 && s.brand !== "Mitsubishi") continue;
      const mat = Math.round(sz.mat * s.matMul);
      const labor = Math.round((sz.labor + s.laborAdd) * 10) / 10;
      const outdoorModel =
        s.key === "mithyper"
          ? `MUZ-FS${tag}NAH`
          : s.key === "mit"
            ? `MUZ-FS${tag}NA`
            : s.key === "carinf"
              ? "37MAHA"
              : "38MARB";
      const ratings = ratingsForOutdoor(
        "ductless",
        s.tier,
        Math.max(1.5, sz.ton),
      );
      out.push({
        id: `prod_${s.key}_1to1_${tag}`,
        name: `${s.title} ${outdoorModel} (${sz.kbtu},000 BTU)`,
        sku: `${s.sku}-${tag}`,
        category: `Ductless · ${s.brand} 1-to-1`,
        description:
          `${s.title} ${sz.kbtu},000 BTU heat pump. One outdoor and one indoor.` +
          s.extra +
          " Indoor style (high wall, one-way cassette, low wall, or slim hidden) is picked on the job.",
        unitPrice: sellFromCost(mat, labor),
        unit: "system",
        materialCost: mat,
        laborHours: labor,
        familyId: `ductless-1to1-${tag}`,
        packageRule: "eligible",
        tier: s.tier,
        tierLabel: `${s.title} · ${sz.kbtu}k 1-to-1`,
        equipmentKind: "ductless",
        capacityValue: sz.kbtu * 1000,
        dimensions: slimOutdoorDims(Math.max(2, sz.ton)),
        matchKey: matchKeyFor("hp", Math.max(2, sz.ton)),
        ...ratings,
        soundDb: soundDbFor("ductless", s.tier) ?? undefined,
        benefits: [
          `Properly sized ${sz.kbtu}k 1-to-1 for the room it serves`,
          "One outdoor. One indoor. No new ductwork.",
        ],
        options: [makeConcretePadOption(`${s.key}_1to1_${tag}`)],
        imageUrl: s.photo,
        workScope:
          "1. Mount the indoor head; route line set and condensate.\n" +
          "2. Set the outdoor unit.\n" +
          "3. Line set and electrical.\n" +
          "4. Evacuate, charge, and commission heat and cool.\n" +
          "5. Owner orientation on the remote and Wi-Fi.",
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    }
  }
  return out;
}


/**
 * Carrier ductless / mini-split line (single-zone + multi-zone outdoor classes).
 * Model families reference current Carrier residential ductless series:
 * - Performance single-zone (38MARB / 38MURA class)
 * - Infinity single-zone (37MAHA / 37MPRA class)
 * - Multi-zone outdoor (38MGR-class capacity) — head locations noted on the measure
 */
export function buildCarrierDuctless(): Product[] {
  const out: Product[] = [];
  for (const ton of [] as number[]) {
    const tLabel = tonnageLabel(ton);
    const slug = tonSlug(ton);

    // Performance single-zone
    out.push({
      id: "prod_car_ms_perf_" + slug,
      name: "Carrier Performance " + tLabel + "-Ton Ductless System",
      sku: "CAR-MS-PERF-" + slug.toUpperCase(),
      category: "Ductless · Carrier",
      description:
        "Carrier Performance ductless single-zone heat pump · " +
        tLabel +
        " ton class (38MARB / 38MURA series class). One outdoor + one indoor head. " +
        "Custom concrete pad option default on.",
      unitPrice: Math.round(4800 + ton * 850),
      unit: "system",
      materialCost: Math.round(2600 + ton * 420),
      laborHours: 4.5 + ton * 0.75,
      familyId: "carrier-ductless-" + slug,
      tier: 1,
      tierLabel: "Carrier Performance single-zone · " + tLabel + " ton",
      equipmentKind: "ductless",
      dimensions: slimOutdoorDims(ton),
      matchKey: matchKeyFor("hp", ton),
      ...ratingsForOutdoor("ductless", 1, ton),
      soundDb: soundDbFor("ductless", 1) ?? undefined,
      benefits: [
        "Carrier ductless single-zone heat & cool",
        "Inverter-driven outdoor for quieter, efficient runs",
        "Great for additions, offices, or rooms without ducts",
        "Sized near " + tLabel + "-ton capacity",
        "Custom concrete pad available — solid outdoor mount",
      ],
      options: [
        makeConcretePadOption("car_ms_perf_" + slug),
        {
          id: "opt_car_ms_linehide_" + slug,
          kind: "accessory",
          title: "Line-set cover kit",
          body: "Painted exterior line-hide from outdoor to wall penetration.",
          priceDelta: 275,
          materialCost: 90,
          laborHours: 0.5,
          defaultSelected: false,
        },
      ],
      imageUrl: ART.minisplit,
      workScope:
        "1. Mount Carrier indoor head; route line set and condensate.\n" +
        "2. Set outdoor unit (custom concrete pad if selected); secure and level.\n" +
        "3. Vacuum, charge, and commission heat/cool modes.\n" +
        "4. Configure wireless or wired control; train homeowner.",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    // Infinity single-zone premium
    out.push({
      id: "prod_car_ms_inf_" + slug,
      name: "Carrier Infinity " + tLabel + "-Ton Ductless System",
      sku: "CAR-MS-INF-" + slug.toUpperCase(),
      category: "Ductless · Carrier",
      description:
        "Carrier Infinity ductless single-zone · " +
        tLabel +
        " ton class (37MAHA / 37MPRA series class). Premium efficiency and quiet operation.",
      unitPrice: Math.round(6200 + ton * 1050),
      unit: "system",
      materialCost: Math.round(3400 + ton * 500),
      laborHours: 5 + ton * 0.8,
      familyId: "carrier-ductless-" + slug,
      tier: 3,
      tierLabel: "Carrier Infinity single-zone · " + tLabel + " ton",
      equipmentKind: "ductless",
      dimensions: slimOutdoorDims(ton),
      matchKey: matchKeyFor("hp", ton),
      ...ratingsForOutdoor("ductless", 3, ton),
      soundDb: soundDbFor("ductless", 3) ?? undefined,
      benefits: [
        "Infinity-class ductless efficiency and comfort",
        "Ultra-quiet indoor head for bedrooms and living areas",
        "Advanced inverter outdoor with basepan heater options on select models",
        "Sized near " + tLabel + "-ton capacity",
        "Custom concrete pad available",
      ],
      options: [makeConcretePadOption("car_ms_inf_" + slug)],
      imageUrl: ART.minisplit,
      workScope:
        "1. Mount Infinity indoor head; route line set and drain.\n" +
        "2. Set outdoor (custom concrete pad if selected).\n" +
        "3. Evacuate, charge, and commission.\n" +
        "4. Set up Infinity / communicating controls; owner orientation.",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
  }

  // Zone count = max heads; outdoor ton can go higher when heads are large.
  const multiZones = [
    { zones: 2, ton: 1.5, sku: "2Z-15", mat: 3600, labor: 6.5 },
    { zones: 2, ton: 2, sku: "2Z", mat: 4200, labor: 7 },
    { zones: 2, ton: 2.5, sku: "2Z-25", mat: 4800, labor: 7.5 },
    { zones: 2, ton: 3, sku: "2Z-3", mat: 5400, labor: 8 },
    { zones: 2, ton: 3.5, sku: "2Z-35", mat: 6000, labor: 8.5 },
    { zones: 3, ton: 2, sku: "3Z-2", mat: 4600, labor: 8 },
    { zones: 3, ton: 2.5, sku: "3Z-25", mat: 5000, labor: 8.5 },
    { zones: 3, ton: 3, sku: "3Z", mat: 5400, labor: 9 },
    { zones: 3, ton: 3.5, sku: "3Z-35", mat: 6000, labor: 9.5 },
    { zones: 3, ton: 4, sku: "3Z-4", mat: 6800, labor: 10 },
    { zones: 3, ton: 4.5, sku: "3Z-45", mat: 7600, labor: 10.5 },
    { zones: 3, ton: 5, sku: "3Z-5", mat: 8400, labor: 11 },
    { zones: 4, ton: 2.5, sku: "4Z-25", mat: 5800, labor: 10 },
    { zones: 4, ton: 3, sku: "4Z-3", mat: 6200, labor: 10.5 },
    { zones: 4, ton: 3.5, sku: "4Z", mat: 6800, labor: 11 },
    { zones: 4, ton: 4, sku: "4Z-4", mat: 7400, labor: 11.5 },
    { zones: 4, ton: 4.5, sku: "4Z-45", mat: 8200, labor: 12 },
    { zones: 4, ton: 5, sku: "4Z-5", mat: 9000, labor: 12.5 },
    { zones: 5, ton: 3, sku: "5Z-3", mat: 7200, labor: 12 },
    { zones: 5, ton: 3.5, sku: "5Z-35", mat: 7800, labor: 12.5 },
    { zones: 5, ton: 4, sku: "5Z", mat: 8200, labor: 13 },
    { zones: 5, ton: 4.5, sku: "5Z-45", mat: 8800, labor: 13.5 },
    { zones: 5, ton: 5, sku: "5Z-5", mat: 9600, labor: 14 },
  ];
  for (const mz of multiZones) {
    const sell = Math.round(
      autoUnitPrice({
        materialCost: mz.mat,
        laborHours: mz.labor,
        laborRate: DEFAULT_LABOR_RATE,
        materialDivisor: DEFAULT_MATERIAL_DIVISOR,
        laborDivisor: DEFAULT_LABOR_DIVISOR,
        priceMode: "auto",
      }),
    );
    out.push({
      id: "prod_car_ms_mz_" + mz.sku.toLowerCase().replace(/\./g, ""),
      name: "Carrier Performance " + mz.zones + "-Zone · " + mz.ton + "-ton Ductless System",
      sku: "CAR-MS-MZ-" + mz.sku,
      category: "Ductless · Carrier multi-zone",
      description:
        "Carrier Performance multi-zone ductless system for up to " +
        mz.zones +
        " indoor heads (38MGR-class). " +
        "Specify each indoor head location on the measure (packet work scope). " +
        "Indoor head styles (high-wall, cassette, etc.) finalized on design.",
      unitPrice: sell,
      unit: "system",
      materialCost: mz.mat,
      laborHours: mz.labor,
      familyId: "carrier-ductless-mz-" + mz.sku.toLowerCase(),
      tier: 2,
      tierLabel: "Carrier multi-zone · " + mz.zones + "-zone " + mz.ton + " ton",
      equipmentKind: "ductless",
      dimensions: slimOutdoorDims(mz.ton),
      matchKey: matchKeyFor("hp", mz.ton),
      ...ratingsForOutdoor("ductless", 2, mz.ton),
      soundDb: soundDbFor("ductless", 2) ?? undefined,
      benefits: [
        "One outdoor unit serves multiple indoor heads",
        "Independent room-by-room comfort",
        "Up to " + mz.zones + " zones on this outdoor class",
        "List each head location on the proposal for the homeowner",
        "Custom concrete pad available for the outdoor unit",
      ],
      options: [
        makeConcretePadOption("car_ms_mz_" + mz.sku.toLowerCase()),
        {
          id: "opt_car_mz_heads_" + mz.sku.toLowerCase(),
          kind: "accessory",
          title: "Additional indoor head (beyond base design)",
          body: "Extra high-wall head when design needs another zone — confirm capacity.",
          priceDelta: 1850,
          materialCost: 950,
          laborHours: 2.5,
          defaultSelected: false,
        },
      ],
      imageUrl: DUCTLESS_PHOTOS.carMz,
      workScope:
        "1. Confirm multi-zone design and each indoor head location with the homeowner.\n" +
        "2. Mount indoor heads at listed rooms/walls; route branch line sets and drains.\n" +
        "3. Set multi-zone outdoor unit (custom concrete pad if selected); level and secure.\n" +
        "4. Vacuum entire circuit, charge per Carrier multi-zone procedure, commission all zones.\n" +
        "5. Label zones on controllers; train homeowner on each room.\n" +
        "INDOOR HEAD LOCATIONS: (to be listed by comfort advisor on this measure)",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
  }

  return out;
}

let _sizedEquipmentCache: Product[] | null = null;

/** Memoized — building the sized ladder is pure and expensive to recompute. */

/** Residential furnace ladder: BTU × efficiency path for demo quoting. */
export function buildFurnaceSizedCatalog(): Product[] {
  const now = new Date().toISOString();
  const sizes = [40000, 60000, 80000, 100000, 120000] as const;
  const paths: {
    id: string;
    label: string;
    afue: string;
    uln: boolean;
    tier: number;
    priceBase: number;
    matBase: number;
  }[] = [
    {
      id: "std80",
      label: "Standard 80%",
      afue: "80% AFUE",
      uln: false,
      tier: 1,
      priceBase: 3800,
      matBase: 1200,
    },
    {
      id: "he90",
      label: "High efficiency 96%",
      afue: "96% AFUE condensing",
      uln: false,
      tier: 2,
      priceBase: 5200,
      matBase: 2100,
    },
    {
      id: "uln80",
      label: "Ultra-Low NOx 80%",
      afue: "80% AFUE Ultra-Low NOx",
      uln: true,
      tier: 2,
      priceBase: 4400,
      matBase: 1650,
    },
    {
      id: "ulnhe",
      label: "Ultra-Low NOx 96%",
      afue: "96% AFUE Ultra-Low NOx condensing",
      uln: true,
      tier: 3,
      priceBase: 6100,
      matBase: 2650,
    },
  ];

  const out: Product[] = [];
  for (const btu of sizes) {
    const k = btu / 1000;
    for (const path of paths) {
      const sku = `FUR-${path.id.toUpperCase()}-${k}K`;
      const sizeBump = (k - 60) * 18;
      out.push({
        id: `prod_${sku.toLowerCase()}`,
        name: `Carrier ${path.label} Gas Furnace — ${k},000 BTU`,
        sku,
        category: "Heating · Furnace",
        description: `${path.afue}. Residential ${k}k BTU input class.${
          path.uln ? " Ultra-Low NOx for CA emissions compliance." : ""
        }`,
        unitPrice: Math.round(path.priceBase + sizeBump),
        unit: "each",
        materialCost: Math.round(path.matBase + sizeBump * 0.55),
        laborHours: path.uln || path.tier >= 2 ? 3.5 : 3,
        familyId: `furnace-${path.id}`,
        tier: path.tier,
        tierLabel: `${path.label} · ${k}k BTU`,
        equipmentKind: "furnace",
        matchKey: `${k}k-furnace`,
        dimensions: furnaceCabinetDims(btu),
        benefits: [
          path.afue,
          `${k},000 BTU input class`,
          ...(path.uln
            ? ["Ultra-Low NOx (CA-style emissions path)"]
            : ["Standard NOx class"]),
          path.tier >= 2 ? "Two-stage / improved comfort class" : "Single-stage comfort class",
          "4-way multipoise cabinet class",
        ],
        options: [],
        imageUrl:
          path.id === "he90" || path.id === "ulnhe"
            ? FURN_SERIES_PHOTOS.comfort96
            : FURN_SERIES_PHOTOS.comfort80,
        workScope:
          "1. Remove existing furnace.\n2. Set new furnace; gas, vent, transitions, electrical.\n3. Startup, safety checks, owner walkthrough.",
        createdAt: now,
        updatedAt: now,
      } as Product);
    }
  }
  return out;
}

export function buildSizedEquipmentCatalog(): Product[] {
  if (_sizedEquipmentCache) return _sizedEquipmentCache;
  _sizedEquipmentCache = [
    ...buildCarrierSizedEquipment(),
    ...buildGoodmanSizedEquipment(),
    ...buildAltBrandHeatPumps(),
    ...buildDuctlessOneToOne(),
    ...buildCarrierDuctless(),
    ...buildFurnaceSizedCatalog(),
    ...buildWestCoastPilotCatalog(),
  ].map((p) =>
    stampLockedBenefits(stampOfficialPhoto(stampEnergyStar(p))),
  );
  return _sizedEquipmentCache;
}

/** Force rebuild after catalog ladder changes (dev / hot reload safety). */
export function invalidateSizedEquipmentCache(): void {
  _sizedEquipmentCache = null;
}

export function filterCatalogByTonnage(
  products: Product[],
  tonnage: number,
): Product[] {
  return products.filter((p) => {
    if (!p.equipmentKind || p.equipmentKind === "other") return true;
    if (
      p.equipmentKind === "heat_pump" ||
      p.equipmentKind === "air_handler" ||
      p.equipmentKind === "ac" ||
      p.equipmentKind === "ductless"
    ) {
      return productMatchesTonnageNeighborhood(p, tonnage);
    }
    return true;
  });
}
