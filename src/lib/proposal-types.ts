/**
 * Core proposal / product types, sample catalog, pricing helpers.
 * Acme HVAC Heating and Air Conditioning — sales quote tool.
 */
import {
  DEFAULT_LABOR_DIVISOR,
  DEFAULT_LABOR_RATE,
  DEFAULT_MATERIAL_DIVISOR,
  autoUnitPrice,
} from "./pricing";
import { COMPANY } from "./company";
import { getDefaultCommercialTerms, resolveTermsForPacket } from "./terms-store";
import { makeConcretePadOption, withLivePadCopy, padCustomerPrice } from "./equipment-catalog";
import {
  tankWaterHeaterDims,
  hpwhDims,
  navienNpe2Dims,
} from "./equipment-dimensions";
import { stampEnergyStar } from "./energy-star";
import type { HeatingPath } from "./heating-path";
import type { Rebate, FinancingOption } from "./rebates-financing";
import {
  enrichProductWarranty,
  resolveWarranty,
  applyWarrantyToBenefits,
  buildProposalWarrantyPage,
  scrubLineWarrantyBenefits,
} from "./warranty";
import { resolveOptionalDisplay } from "./domain/optional-rules";
import { resolveManufacturerLinks } from "./manufacturer-links";
import {
  resolveProductPhotoUrl,
  shouldShowProductPhoto,
  stampOfficialPhoto,
  FURN_SERIES_PHOTOS,
  WH_PHOTOS,
  WALL_PHOTOS,
  CTRL_PHOTOS,
  FILTER_PHOTOS,
} from "./product-photos";
import { lockedEquipmentBenefits, stampLockedBenefits } from "./locked-benefits";
import { sameDuctlessOneToOneSize } from "./ductless-materials";
import { productBrand } from "./session-filters";
import {
  defaultRebates as defaultRebatesFromLib,
  defaultFinancingOptions,
} from "./rebates-financing";

export type { Rebate, FinancingOption };

export type MeasureRole = "included" | "optional" | "info" | "parked";

export type ProductOption = {
  id: string;
  title: string;
  body: string;
  priceDelta?: number;
  kind?: "accessory" | "tier_upgrade" | "pad";
  upgradeSku?: string;
  upgradeTier?: number;
  materialCost?: number;
  laborHours?: number;
  defaultSelected?: boolean;
  /** True after the quote is sent — dollars stay as the customer saw them. */
  priceLocked?: boolean;
};

export type EquipmentKind =
  | "furnace"
  | "heat_pump"
  | "air_handler"
  | "ac"
  | "ductless"
  | "water_heater"
  | "other";

export type Product = {
  id: string;
  name: string;
  sku: string;
  category: string;
  description: string;
  unitPrice: number;
  unit: string;
  benefits: string[];
  options?: ProductOption[];
  imageUrl?: string | null;
  workScope?: string;
  materialCost?: number;
  laborHours?: number;
  laborRate?: number;
  materialDivisor?: number;
  laborDivisor?: number;
  familyId?: string;
  /** Owner-set manufacturer so a new SKU shows on the right brand chip. */
  manufacturer?: string | null;
  /** Advisor size chip — gallons, tons, or input BTU. Set in Backend so chips stay honest. */
  capacityValue?: number | null;
  tier?: number;
  tierLabel?: string;
  equipmentKind?: EquipmentKind;
  matchKey?: string;
  /**
   * Install profile — Backend product edit (not code-only).
   * Guides site path / package compatibility.
   */
  installFuel?: "gas" | "electric" | "n/a" | null;
  installPower?:
    | "none"
    | "plug_nearby"
    | "dedicated_circuit"
    | "from_outdoor_shared"
    | null;
  installMount?: "pad" | "wall" | "either" | null;
  installFootprint?:
    | "standard_cube"
    | "side_discharge"
    | "mini_outdoor"
    | "wall_heater"
    | "tank"
    | "hpwh"
    | "tankless"
    | null;
  installEcosystem?: "none" | "carrier_infinity" | null;
  installCommunicating?: boolean | null;
  /**
   * Quote package rule (owner-settable).
   * none = stay on the same path · eligible = gold / optional packages
   * forced = red / own comparison package when mixed with a different rule
   * (e.g. Navien furnace + T&P vs a standard furnace).
   */
  packageRule?: "none" | "eligible" | "forced" | null;
  /** Hydro / boiler-style — T&P relief required (Navien NPF / NHB). */
  requiresTpValve?: boolean | null;
  dimensions?: {
    widthIn: number;
    depthIn: number;
    heightIn: number;
  } | null;
  /** Advisor-only efficiency (decimal ratings). Not shown on customer PDF. */
  seer2?: number | null;
  eer2?: number | null;
  /** Uniform energy factor (water heaters). */
  uef?: number | null;
  /** Heat pumps / dual-fuel — heating season performance. */
  hspf2?: number | null;
  /** Outdoor unit sound rating (dB) — advisor only. */
  soundDb?: number | null;
  /** ENERGY STAR certified (owner-overridable). */
  energyStar?: boolean | null;
  /**
   * Vent path for water heaters / appliances.
   * gravity = atmospheric draft hood + B-vent (show flue height).
   */
  ventStyle?: "gravity" | "power_vent" | "direct_vent" | "none" | null;
  /** Floor to draft-hood / vent-collar height, inches (gravity tanks). */
  flueHeightIn?: number | null;
  /** Manufacturer limited parts years (typical registered residential). */
  partsWarrantyYears?: number | null;
  /** Acme HVAC labor warranty years for this product class. */
  laborWarrantyYears?: number | null;
  warrantySummary?: string;
  warrantyPartsDetail?: string;
  warrantyLaborDetail?: string;
  /**
   * Primary homeowner-facing manufacturer product page (consumer site, not contractor).
   */
  productInfoUrl?: string | null;
  /** Additional homeowner resource links shown on the customer packet. */
  manufacturerLinks?: { label: string; url: string; note?: string }[];
  createdAt: string;
  updatedAt: string;
};

export type QuoteLine = {
  id: string;
  productId: string | null;
  name: string;
  description: string;
  sku?: string;
  benefits: string[];
  options?: ProductOption[];
  quantity: number;
  unitPrice: number;
  unit: string;
  role: MeasureRole;
  optional: boolean;
  defaultSelected: boolean;
  customerSelected?: boolean;
  showPrice: boolean;
  sortOrder: number;
  imageUrl?: string | null;
  workScope?: string;
  materialCost: number;
  laborHours: number;
  laborRate: number;
  materialDivisor: number;
  laborDivisor: number;
  priceMode: "auto" | "manual";
  /** True after send — this line’s dollars stay put if owner GP changes. */
  priceLocked?: boolean;
  selectedOptionIds?: string[];
  dimensions?: {
    widthIn: number;
    depthIn: number;
    heightIn: number;
  } | null;
  /** Homeowner manufacturer product page */
  productInfoUrl?: string | null;
  manufacturerLinks?: { label: string; url: string; note?: string }[];
  /** Homeowner packet photo (not SVG icon) — subtle measure thumbnail */
  packetPhotoUrl?: string | null;
};

export type ProposalQA = {
  id: string;
  question: string;
  answer: string;
};

export type ProposalStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "signed"
  | "accepted"
  | "declined";

export type SignatureRecord = {
  signerName: string;
  signerEmail: string;
  signedAt: string;
  ipNote?: string;
  signatureDataUrl?: string;
  agreedToTerms?: boolean;
  selectedOptionalIds?: string[];
  selectedNestedOptionKeys?: string[];
  selectedRebateIds?: string[];
  selectedFinancingId?: string | null;
  finalTotal?: number;
  amountDueNow?: number;
};

/** Company / comfort advisor signature — auto-applied when the quote is created or sent. */
export type SalespersonSignature = {
  name: string;
  email?: string;
  title?: string;
  /** ISO timestamp when the salesperson signed / authorized this bid */
  signedAt: string;
  userId?: string;
  /** Optional drawn mark; otherwise the typed name is the e-sign representation */
  signatureDataUrl?: string | null;
};

export type Proposal = {
  id: string;
  title: string;
  status: ProposalStatus;
  clientCompany: string;
  clientContact: string;
  clientEmail: string;
  clientPhone?: string;
  clientAddress?: string;
  proposalNumber?: string;
  companyName?: string;
  companyTagline?: string;
  companyPhone?: string;
  contractorLicense?: string;
  propertyStreet?: string;
  propertyCity?: string;
  propertyState?: string;
  propertyZip?: string;
  propertyImageUrl?: string | null;
  propertyMapUrl?: string | null;
  propertyLat?: number | null;
  propertyLon?: number | null;
  propertyPhotoUrl?: string | null;
  validUntil?: string | null;
  warranty?: string;
  heatingPath?: HeatingPath;
  executiveSummary: string;
  scope: string;
  timeline: string;
  terms: string;
  notes: string;
  currency: string;
  taxRate: number;
  discount: number;
  /** When true, included measures show $; when false, price column stays Included */
  showMeasurePrices?: boolean;
  lineItems: QuoteLine[];
  questions: ProposalQA[];
  rebates?: Rebate[];
  financingOptions?: FinancingOption[];
  preferredFinancingId?: string | null;
  signingToken: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  /**
   * Set when the quote is sent. After this, unit prices and option dollars
   * stay as sent even if owner GP / markup changes.
   */
  pricesLockedAt?: string | null;
  signature: SignatureRecord | null;
  /** Comfort advisor / creator — pre-signed on every outgoing bid */
  salesperson?: SalespersonSignature | null;
  /** Training / test quote — always keep visible on home */
  isTest?: boolean;
  /**
   * Full sales-tool state so a saved row can reopen in the wizard.
   * Missing on old quotes / training samples.
   */
  wizardSnapshot?: {
    answers: import("./quote-wizard").WizardAnswers;
    stepIdx: number;
  } | null;
  /** Customer packet packages (A / B) — inferred if missing. */
  packetPackages?: import("./packet-packages").PacketPackageCard[] | null;
  /** Outdoor SKU the customer chose on the package board. */
  selectedPackageKey?: string | null;
  /**
   * Manager audit trail — selections & adjustments by comfort advisor.
   * Built at quote finish; refreshed after customer signs.
   */
  advisorAudit?: import("./advisor-audit").AdvisorAuditReport | null;
  /**
   * Frozen pull list of exact products sold — stamped at customer sign.
   * Unsigned quotes stay null. Warehouse export reads this later.
   */
  pullList?: import("./pull-list").PullListSnapshot | null;
  createdAt: string;
  updatedAt: string;
};

export const STATUS_ORDER: ProposalStatus[] = [
  "draft",
  "sent",
  "viewed",
  "signed",
  "accepted",
  "declined",
];

export const STATUS_LABELS: Record<ProposalStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  signed: "Signed",
  accepted: "Accepted",
  declined: "Declined",
};

export const LABOR_HOURS_BY_SKU: Record<string, number> = {
  "CAR-58SB1B": 3,
  "CAR-26SCA5": 2.5,
  "SVC-INSTALL": 8,
  "SVC-PERMIT": 1,
  "SVC-HERS": 0.5,
  "SVC-LOAD": 0,
};

export const MATERIAL_COST_BY_SKU: Record<string, number> = {};

function rid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

const nowIso = () => new Date().toISOString();

export function newProductOption(
  partial?: Partial<ProductOption>,
): ProductOption {
  return {
    id: partial?.id || rid("opt"),
    title: partial?.title || "Option",
    body: partial?.body || "",
    priceDelta: partial?.priceDelta ?? 0,
    kind: partial?.kind || "accessory",
    ...partial,
  };
}

/** 1 / 2 / 3 remote sensors — extra material + labor per sensor. */
export function remoteSensorPackOptions(
  brand: "ecobee" | "nest",
  premiumIncludesOne = false,
): ProductOption[] {
  const matEach = brand === "ecobee" ? 48 : 42;
  const hrEach = 0.35;
  const label =
    brand === "ecobee" ? "ecobee SmartSensor" : "Nest Temperature Sensor";
  return [1, 2, 3].map((n) => {
    const hours = Math.round(hrEach * n * 100) / 100;
    const mat = matEach * n;
    const extra = premiumIncludesOne
      ? `Premium already includes 1 sensor. This adds ${n} more.`
      : `Includes ${n} ${label}${n > 1 ? "s" : ""}, placed and paired.`;
    return newProductOption({
      id: `opt-${brand}-sns-${n}`,
      title: `${n} remote sensor${n > 1 ? "s" : ""}`,
      body: `${extra} ${hours} hr extra labor.`,
      kind: "accessory",
      materialCost: mat,
      laborHours: hours,
      priceDelta: padCustomerPrice(mat, hours),
      defaultSelected: false,
    });
  });
}

export function emptyQuoteLine(
  partial?: Partial<QuoteLine>,
): QuoteLine {
  return normalizeLine({
    id: rid("li"),
    productId: null,
    name: "Custom measure",
    description: "",
    benefits: [],
    quantity: 1,
    unitPrice: 0,
    unit: "each",
    role: "included",
    optional: false,
    defaultSelected: true,
    showPrice: true,
    sortOrder: 500,
    materialCost: 0,
    laborHours: 0,
    laborRate: DEFAULT_LABOR_RATE,
    materialDivisor: DEFAULT_MATERIAL_DIVISOR,
    laborDivisor: DEFAULT_LABOR_DIVISOR,
    priceMode: "manual",
    ...partial,
  });
}

export function emptyQA(partial?: Partial<ProposalQA>): ProposalQA {
  return {
    id: rid("qa"),
    question: "",
    answer: "",
    ...partial,
  };
}

export function normalizeLine(li: Partial<QuoteLine> & { id?: string }): QuoteLine {
  const role = (li.role || "included") as MeasureRole;
  // Deduplicate / strip wrong warranty stamps (e.g. 3-year labor on permits, triples)
  const rawBenefits = Array.isArray(li.benefits) ? li.benefits : [];
  const servicePacket = /permit|hers|load|vs heat pump|vs gas|conversion|education|guide|ductwork/i.test(
    li.name || "",
  );
  const seenB = new Set<string>();
  const benefits = rawBenefits.filter((b) => {
    const t = String(b || "").trim();
    if (!t) return false;
    if (
      servicePacket &&
      (/manufacturer limited parts warranty/i.test(t) ||
        /labor warranty on this install/i.test(t))
    )
      return false;
    const k = t.toLowerCase();
    if (seenB.has(k)) return false;
    seenB.add(k);
    return true;
  });

  return {
    id: li.id || rid("li"),
    productId: li.productId ?? null,
    name: li.name || "Measure",
    description: li.description || "",
    benefits,
    // Pad language stays live until the quote is sent (option.priceLocked).
    options: li.options
      ? li.options.map((o) => withLivePadCopy({ ...o }))
      : [],
    quantity: Math.max(1, Number(li.quantity) || 1),
    unitPrice: Math.max(0, Number(li.unitPrice) || 0),
    unit: li.unit || "each",
    role,
    optional: li.optional ?? role === "optional",
    defaultSelected:
      li.defaultSelected ??
      resolveOptionalDisplay({
        role,
        optional: li.optional ?? role === "optional",
        unitPrice: li.unitPrice,
        showPrice: li.showPrice,
      }).defaultSelected,
    customerSelected: li.customerSelected,
    showPrice: li.showPrice ?? true,
    sortOrder: Number(li.sortOrder) || 500,
    imageUrl: li.imageUrl ?? null,
    workScope: li.workScope || "",
    materialCost: Math.max(0, Number(li.materialCost) || 0),
    laborHours: Math.max(0, Number(li.laborHours) || 0),
    laborRate: Math.max(0, Number(li.laborRate) || DEFAULT_LABOR_RATE),
    materialDivisor: Number(li.materialDivisor) || DEFAULT_MATERIAL_DIVISOR,
    laborDivisor: Number(li.laborDivisor) || DEFAULT_LABOR_DIVISOR,
    priceMode: li.priceMode === "auto" && !li.priceLocked ? "auto" : "manual",
    priceLocked: Boolean(li.priceLocked),
    selectedOptionIds: li.selectedOptionIds
      ? [...li.selectedOptionIds]
      : undefined,
    dimensions: li.dimensions ?? null,
    productInfoUrl: li.productInfoUrl ?? null,
    manufacturerLinks: li.manufacturerLinks
      ? li.manufacturerLinks.map((l) => ({ ...l }))
      : undefined,
    packetPhotoUrl: li.packetPhotoUrl ?? null,
  };
}

export function measureBucketRankForProduct(product: Product): number {
  const sku = (product.sku || "").toUpperCase();
  const name = `${product.name} ${product.category}`.toLowerCase();
  if (
    product.equipmentKind === "heat_pump" ||
    product.equipmentKind === "furnace" ||
    product.equipmentKind === "ac" ||
    product.equipmentKind === "air_handler" ||
    product.equipmentKind === "ductless"
  )
    return 100;
  if (sku.includes("LOAD") || /load calc|manual j/i.test(name)) return 10;
  if (/filter|media|cleaner|purifier/i.test(name)) return 200;
  if (/thermostat|control|stat/i.test(name)) return 300;
  if (/humidif/i.test(name)) return 350;
  if (/water heater|tankless|navien|hpwh/i.test(name)) {
    if (/what to expect|expectation|education/i.test(name) || sku.includes("HPWH-EXPECT"))
      return 410;
    return 400;
  }
  if (/wall heater|wall furnace|direct.?vent|com-pak|monterey/i.test(name) || sku.startsWith("WALL-"))
    return 380;
  if (/duct/i.test(name) && !/ductless/i.test(name)) return 450;
  if (sku.includes("ZONE") || /zoning|zone /i.test(name)) return 530;
  if (/install|startup/i.test(name)) return 700;
  if (/maintenance|membership|club/i.test(name)) return 800;
  if (/permit/i.test(name)) return 9000;
  if (/conversion|gas furnace vs/i.test(name)) return 165;
  if (sku === "SVC-HPWH-EXPECT") return 410;
  return 500;
}

/** familyId stem without tonnage slug, e.g. carrier-hp-3p5 → carrier-hp */
function productLadderStem(familyId?: string | null): string {
  if (!familyId) return "";
  // Keep 1-to-1 size on the stem so 12k does not sibling a 36k.
  if (/ductless-1to1-\d+/i.test(familyId)) return familyId.toLowerCase();
  return familyId.replace(/-\d+(?:p\d+)?$/i, "").toLowerCase();
}

function tonnageFromProductBlob(p: Product): number | null {
  const blob = `${p.matchKey || ""} ${p.name || ""} ${p.tierLabel || ""} ${p.sku || ""}`;
  const m = blob.match(/(\d+(?:\.\d+)?)\s*ton/i) || blob.match(/-(\d+)p(\d+)-/i);
  if (!m) return null;
  if (m[2] != null && blob.includes("p")) {
    // sku style 3p5
    const a = blob.match(/-(\d+)p(\d+)/i);
    if (a) return Number(a[1]) + Number(a[2]) / 10;
  }
  return Number(m[1]);
}

function isHalfTon(n: number): boolean {
  return Math.abs(n * 2 - Math.round(n * 2)) < 0.01 && !Number.isInteger(n);
}

function isInfinityLike(p: Product): boolean {
  if (p.tier === 3) return true;
  const blob = `${p.name} ${p.tierLabel} ${p.sku}`.toLowerCase();
  return /infinity|variable-?speed/.test(blob);
}

/**
 * Same tonnage upgrades only.
 * Exception: half-ton base (e.g. 3.5) may step up to nearest whole-ton Infinity
 * (3 and 4) when that premium line does not offer half-ton sizes.
 */
function upgradeTonnageOk(base: Product, upgrade: Product): boolean {
  if (
    (base.equipmentKind === "ductless" || upgrade.equipmentKind === "ductless") &&
    sameDuctlessOneToOneSize(base, upgrade)
  ) {
    return true;
  }
  const bt = tonnageFromProductBlob(base);
  const ut = tonnageFromProductBlob(upgrade);
  if (bt == null || ut == null) {
    // Fall back to exact matchKey / familyId
    if (base.matchKey && upgrade.matchKey) return base.matchKey === upgrade.matchKey;
    return base.familyId === upgrade.familyId;
  }
  if (Math.abs(bt - ut) < 0.01) return true;
  // Half-ton base → whole-ton Infinity only (floor and ceil)
  if (isHalfTon(bt) && isInfinityLike(upgrade)) {
    const lo = Math.floor(bt);
    const hi = Math.ceil(bt);
    return Math.abs(ut - lo) < 0.01 || Math.abs(ut - hi) < 0.01;
  }
  return false;
}

/** Packet option title — no shop 1-to-1 / kBTU tags. */
function packetUpgradeName(p: Product): string {
  const label = (p.tierLabel || p.name || "").replace(/\s+/g, " ").trim();
  if (p.equipmentKind === "ductless" || /mini-?split|ductless/i.test(label)) {
    return label
      .replace(/\s*·\s*\d+k\s*1-to-1/gi, "")
      .replace(/\(1-to-1\)/gi, "")
      .replace(/\s*·\s*~\s*\d+(?:\.\d+)?\s*ton class/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim() || p.name;
  }
  return label;
}

export function buildTierUpgradeOptions(
  base: Product,
  catalog: Product[],
): ProductOption[] {
  if (base.tier == null) return [];
  const baseTier = base.tier;
  const kind = base.equipmentKind || "other";
  if (kind === "other") return [];
  const stem = productLadderStem(base.familyId);

  const upgrades = catalog
    .filter((p) => {
      if (p.id === base.id) return false;
      if (p.sku === base.sku) return false;
      if ((p.equipmentKind || "other") !== kind) return false;
      if (p.tier == null || p.tier <= baseTier) return false;
      // Same ladder (brand/family stem) — not a different brand
      if (stem && productLadderStem(p.familyId) !== stem) {
        // same exact familyId still ok
        if (p.familyId !== base.familyId) return false;
      }
      if (!upgradeTonnageOk(base, p)) return false;
      return true;
    })
    .sort((a, b) => {
      const da = Math.max(0, (a.unitPrice || 0) - (base.unitPrice || 0));
      const db = Math.max(0, (b.unitPrice || 0) - (base.unitPrice || 0));
      if (da !== db) return da - db;
      return (a.tier ?? 0) - (b.tier ?? 0);
    });

  return upgrades.map((p) => {
    const delta = Math.max(0, (p.unitPrice || 0) - (base.unitPrice || 0));
    const tierName = packetUpgradeName(p);
    const highlights = (lockedEquipmentBenefits(p) || []).filter(Boolean);
    const ut = tonnageFromProductBlob(p);
    const bt = tonnageFromProductBlob(base);
    const tonNote =
      bt != null && ut != null && Math.abs(bt - ut) > 0.01
        ? ` Nearest whole-ton Infinity size (${ut} ton) — half-ton not offered on this line.`
        : "";
    return {
      id: `tier_up_${base.sku}_to_${p.sku}`,
      kind: "tier_upgrade" as const,
      title: `Upgrade to ${tierName}`,
      body:
        (highlights.length
          ? highlights.join("\n")
          : `Step up from ${base.tierLabel || base.name} to ${tierName}.`) +
        (base.equipmentKind === "ductless"
          ? ""
          : " Matched capacity class — only higher tiers, never cheaper.") +
        tonNote,
      priceDelta: delta,
      upgradeSku: p.sku,
      upgradeTier: p.tier,
    };
  });
}

/** Every Comfort / Performance / Infinity sibling on the same ladder and size. */
export function findLadderSiblings(
  base: Product,
  catalog: Product[],
): Product[] {
  if (base.tier == null) return [base];
  const kind = base.equipmentKind || "other";
  if (kind === "other") return [base];
  const stem = productLadderStem(base.familyId);
  const found = catalog.filter((p) => {
    if ((p.equipmentKind || "other") !== kind) return false;
    if (p.tier == null) return false;
    if (stem && productLadderStem(p.familyId) !== stem) {
      if (p.familyId !== base.familyId) return false;
    }
    if (p.id === base.id || p.sku === base.sku) return true;
    return upgradeTonnageOk(base, p) || upgradeTonnageOk(p, base);
  });
  const list = found.length ? found : [base];
  const bt = tonnageFromProductBlob(base);
  const inf = list.filter(isInfinityLike);
  let trimmed = list;
  if (bt != null && inf.length > 1) {
    const target = Math.ceil(bt);
    trimmed = list.filter(
      (p) =>
        !isInfinityLike(p) ||
        Math.abs((tonnageFromProductBlob(p) || 0) - target) < 0.01,
    );
  }
  const byTier = new Map<number, Product[]>();
  for (const p of trimmed.sort((a, b) => (a.tier ?? 0) - (b.tier ?? 0))) {
    const t = p.tier ?? 0;
    const arr = byTier.get(t) || [];
    arr.push(p);
    byTier.set(t, arr);
  }
  if (base.equipmentKind === "ductless") {
    return trimmed.sort(
      (a, b) =>
        (a.unitPrice || 0) - (b.unitPrice || 0) ||
        (a.tier ?? 0) - (b.tier ?? 0) ||
        a.name.localeCompare(b.name),
    );
  }
  return Array.from(byTier.values()).map((arr) => arr[0]);
}

/**
 * Same-size outdoor units from every brand the advisor offered.
 * Carrier Comfort + Bosch IDS on a conversion is the gold path — not one brand.
 */
export function findOfferedBrandSiblings(
  base: Product,
  catalog: Product[],
  selectedBrands?: string[] | null,
  allBrandsInSize?: boolean,
): Product[] {
  const ladder = findLadderSiblings(base, catalog);
  const want = allBrandsInSize
    ? null
    : new Set(
        (selectedBrands || []).map((b) => b.toLowerCase()).filter(Boolean),
      );
  if (want && want.size === 0) return ladder;

  const extras = catalog.filter((p) => {
    if ((p.equipmentKind || "other") !== (base.equipmentKind || "other"))
      return false;
    if (p.tier == null) return false;
    if (p.id === base.id || p.sku === base.sku) return false;
    if (ladder.some((s) => s.id === p.id || s.sku === p.sku)) return false;
    if (
      (base.equipmentKind === "ductless" || p.equipmentKind === "ductless") &&
      !sameDuctlessOneToOneSize(base, p)
    ) {
      return false;
    }
    if (!upgradeTonnageOk(base, p) && !upgradeTonnageOk(p, base)) return false;
    const b = productBrand(p).toLowerCase();
    if (want && !want.has(b)) return false;
    return true;
  });
  if (!extras.length) return ladder;

  const seen = new Set<string>();
  const picked: Product[] = [];
  const sorted = [...extras].sort(
    (a, b) =>
      (a.unitPrice || 0) - (b.unitPrice || 0) ||
      (a.tier ?? 0) - (b.tier ?? 0) ||
      a.name.localeCompare(b.name),
  );
  for (const p of sorted) {
    const key = `${productBrand(p).toLowerCase()}::${p.tier ?? 0}`;
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(p);
  }
  return [...ladder, ...picked];
}

export function findMatchedIndoor(
  outdoor: Product,
  catalog: Product[],
  hint?: Product | null,
): Product | null {
  const ton = tonnageFromProductBlob(outdoor);
  const wantKind: EquipmentKind[] =
    outdoor.equipmentKind === "heat_pump"
      ? hint?.equipmentKind === "furnace"
        ? ["furnace", "air_handler"]
        : ["air_handler"]
      : outdoor.equipmentKind === "ac"
        ? ["air_handler", "furnace"]
      : outdoor.equipmentKind === "furnace"
        ? ["ac", "air_handler"]
        : [];
  if (!wantKind.length) return hint || null;
  const hintKind = hint?.equipmentKind;
  const kinds = hintKind && wantKind.includes(hintKind) ? [hintKind, ...wantKind] : wantKind;
  const brand = (outdoor.familyId || outdoor.name || "")
    .toLowerCase()
    .split(/[- ]/)[0];
  const scored = catalog.filter((p) => {
    if (!kinds.includes((p.equipmentKind || "other") as EquipmentKind))
      return false;
    if ((p.tier ?? 0) !== (outdoor.tier ?? 0)) return false;
    if (ton != null) {
      const pt = tonnageFromProductBlob(p);
      if (pt != null && Math.abs(pt - ton) > 0.01) {
        if (!(isInfinityLike(outdoor) && isInfinityLike(p))) return false;
      }
    }
    const pBrand = (p.familyId || p.name || "").toLowerCase().split(/[- ]/)[0];
    if (brand && pBrand && brand !== pBrand) return false;
    return true;
  });
  if (hint) {
    const same = scored.find((p) => p.id === hint.id || p.sku === hint.sku);
    if (same) return same;
  }
  return scored[0] || hint || null;
}

export function collapseFamilyDuplicateLines(
  items: QuoteLine[],
  catalog: Product[] = SAMPLE_PRODUCTS,
): QuoteLine[] {
  const resolve = (li: QuoteLine) =>
    (li.productId && catalog.find((p) => p.id === li.productId)) ||
    catalog.find((p) => p.sku && li.name.includes(p.sku)) ||
    null;

  type GroupKey = string;
  const groups = new Map<
    GroupKey,
    { line: QuoteLine; product: Product; tier: number }[]
  >();
  const passthrough: QuoteLine[] = [];

  for (const raw of items) {
    const line = normalizeLine(raw);
    const product = resolve(line);
    if (
      !product?.familyId ||
      product.tier == null ||
      !product.equipmentKind ||
      product.equipmentKind === "other"
    ) {
      passthrough.push(line);
      continue;
    }
    const key = `${product.familyId}::${product.equipmentKind}::${product.matchKey || "*"}`;
    const list = groups.get(key) ?? [];
    list.push({ line, product, tier: product.tier });
    groups.set(key, list);
  }

  const collapsed: QuoteLine[] = [];
  for (const list of groups.values()) {
    list.sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      const ra =
        a.line.role === "included" ? 0 : a.line.role === "optional" ? 1 : 2;
      const rb =
        b.line.role === "included" ? 0 : b.line.role === "optional" ? 1 : 2;
      return ra - rb;
    });
    const best = list[0];
    const tierOpts = buildTierUpgradeOptions(best.product, catalog);
    const accessories = (best.line.options || []).filter(
      (o) => o.kind !== "tier_upgrade",
    );
    const options = [...accessories, ...tierOpts];
    const higherSelected = list.find((x) => x.tier > best.tier);
    let selectedOptionIds = [...(best.line.selectedOptionIds || [])];
    if (higherSelected) {
      const match = tierOpts.find(
        (o) => o.upgradeSku === higherSelected.product.sku,
      );
      if (match && !selectedOptionIds.includes(match.id)) {
        selectedOptionIds = [
          ...selectedOptionIds.filter(
            (id) => !tierOpts.some((t) => t.id === id),
          ),
          match.id,
        ];
      }
    }
    collapsed.push(
      normalizeLine({
        ...best.line,
        options,
        selectedOptionIds,
      }),
    );
  }
  return [...collapsed, ...passthrough];
}


/** First benefit line on major climate equipment (homeowner packet). */
export const HOME_SIZING_BENEFIT =
  "This system has been sized specifically for your home using our advanced load-calculation software — for maximum comfort, efficiency, and dependable year-round performance.";

export function isHomeSizingEquipment(
  product: Pick<Product, "equipmentKind" | "name" | "category" | "sku">,
): boolean {
  const blob = `${product.name} ${product.category} ${product.sku || ""}`.toLowerCase();
  if (
    /hers|permit|load calc|svc-|title 24|compliance|warranty document/i.test(
      blob,
    )
  )
    return false;
  const kind = product.equipmentKind;
  if (
    kind === "heat_pump" ||
    kind === "furnace" ||
    kind === "air_handler" ||
    kind === "ductless"
  )
    return true;
  return (
    /mini-?split|ductless/.test(blob) ||
    (/heat pump/.test(blob) && !/water heater|waterheater/.test(blob)) ||
    /\bfurnace\b/.test(blob) ||
    /air handler|fan coil/.test(blob)
  );
}

/** Ensure sizing story is the first benefit; de-dupe if already present. */
export function applyHomeSizingBenefit(
  benefits: string[],
  product: Pick<Product, "equipmentKind" | "name" | "category" | "sku">,
): string[] {
  if (!isHomeSizingEquipment(product)) return benefits.filter(Boolean);
  const cleaned = (benefits || []).filter(
    (b) =>
      b &&
      !/sized specifically for your home|advanced load-?calculation software|advanced software which allows for maximum comfort/i.test(
        b,
      ),
  );
  return [HOME_SIZING_BENEFIT, ...cleaned];
}

export function productToLine(
  product: Product,
  opts?: {
    role?: MeasureRole;
    optional?: boolean;
    defaultSelected?: boolean;
    quantity?: number;
    sortOrder?: number;
    showPrice?: boolean;
    catalog?: Product[];
  },
): QuoteLine {
  const role = opts?.role ?? "included";
  let accessoryOpts = (product.options || []).map((o) => ({ ...o }));
  const isOutdoor =
    product.equipmentKind === "heat_pump" ||
    product.equipmentKind === "ac" ||
    product.equipmentKind === "ductless";
  const hasPad = accessoryOpts.some(
    (o) =>
      o.kind === "pad" ||
      /custom concrete pad|concrete pad|equipment pad/i.test(o.title),
  );
  if (isOutdoor && !hasPad) {
    // Language + costs strictly from Backend → Measures (standard copy)
    accessoryOpts.unshift(
      makeConcretePadOption(product.sku || product.id),
    );
  }
  const tierOpts = buildTierUpgradeOptions(
    product,
    opts?.catalog ?? SAMPLE_PRODUCTS,
  );
  const merged = [...accessoryOpts, ...tierOpts];
  const seen = new Set<string>();
  const options = merged.filter((o) => {
    if (!o.id || seen.has(o.id)) return false;
    seen.add(o.id);
    return true;
  });
  const selectedOptionIds = options
    .filter((o) => o.defaultSelected)
    .map((o) => o.id);

  const wInfo = resolveWarranty(product);
  const fillIn =
    /^(SVC-HERS|SVC-PERMIT|SVC-LOAD|SVC-INSTALL|SVC-REBATE)/i.test(
      product.sku || "",
    ) ||
    /hers|permit|load calc|compliance/i.test(
      `${product.name} ${product.category} ${product.familyId || ""}`,
    );
  const locked = fillIn ? null : lockedEquipmentBenefits(product);
  const benefits = fillIn
    ? [...(product.benefits || [])]
    : locked ??
      applyHomeSizingBenefit(
        applyWarrantyToBenefits([...(product.benefits || [])], wInfo),
        product,
      );

  const mfrLinks = resolveManufacturerLinks(product);

  return normalizeLine({
    id: rid("li"),
    productId: product.id,
    name: product.name,
    description: product.description,
    benefits,
    options,
    productInfoUrl: product.productInfoUrl || mfrLinks[0]?.url || null,
    manufacturerLinks: product.manufacturerLinks?.length
      ? product.manufacturerLinks
      : mfrLinks,
    packetPhotoUrl: shouldShowProductPhoto({
      name: product.name,
      unitPrice: product.unitPrice,
      showPrice: true,
      role: "included",
    })
      ? resolveProductPhotoUrl(product)
      : null,
    quantity: opts?.quantity ?? 1,
    unitPrice: product.unitPrice,
    unit: product.unit,
    role,
    defaultSelected:
      opts?.defaultSelected ??
      (role === "included" ? true : role === "optional" ? false : false),
    showPrice: opts?.showPrice ?? true,
    sortOrder: opts?.sortOrder ?? measureBucketRankForProduct(product),
    imageUrl: product.imageUrl,
    workScope: product.workScope || "",
    materialCost:
      product.materialCost ?? MATERIAL_COST_BY_SKU[product.sku] ?? 0,
    laborHours: product.laborHours ?? LABOR_HOURS_BY_SKU[product.sku] ?? 0,
    laborRate: product.laborRate ?? DEFAULT_LABOR_RATE,
    materialDivisor: product.materialDivisor ?? DEFAULT_MATERIAL_DIVISOR,
    laborDivisor: product.laborDivisor ?? DEFAULT_LABOR_DIVISOR,
    priceMode: "manual",
    selectedOptionIds,
    dimensions: product.dimensions ?? null,
  });
}

export function applyStandardMeasureOrder(
  items: QuoteLine[],
  catalog: Product[] = SAMPLE_PRODUCTS,
): QuoteLine[] {
  // Preserve advisor-chosen packet order (Order step writes 10, 20, 30…)
  if (items.length > 1) {
    const sorted = [...items].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
    );
    const sequential = sorted.every(
      (li, i) => (li.sortOrder || 0) === (i + 1) * 10,
    );
    if (sequential) {
      return sorted.map((li, i) =>
        normalizeLine({ ...li, sortOrder: (i + 1) * 10 }),
      );
    }
  }
  const resolve = (li: QuoteLine) =>
    (li.productId && catalog.find((p) => p.id === li.productId)) ||
    catalog.find((p) => p.sku && li.name.includes(p.sku));
  return [...items]
    .map((li, i) => {
      const p = resolve(li);
      const rank = p
        ? measureBucketRankForProduct(p)
        : li.sortOrder || 500 + i;
      return normalizeLine({ ...li, sortOrder: rank });
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export function sortedMeasures(items: QuoteLine[]): QuoteLine[] {
  return [...items].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  );
}

export function customerMeasures(items: QuoteLine[]): QuoteLine[] {
  // Include free education / expectation language (role "info") so HP conversion
  // and heat pump water heater guides print on the customer packet.
  return sortedMeasures(items).filter((li) => {
    if (li.role !== "info") return true;
    const blob = `${li.name} ${li.description || ""}`.toLowerCase();
    return (
      /what to expect|gas furnace vs|conversion|expectation|education|hpwh|heat pump water/i.test(
        blob,
      ) || Number(li.unitPrice) === 0
    );
  });
}

export function nestedOptionKey(lineId: string, optionId: string): string {
  return `${lineId}::${optionId}`;
}

export function selectedOptionsDelta(
  line: QuoteLine,
  nestedKeys?: string[] | Set<string>,
): number {
  const set =
    nestedKeys instanceof Set
      ? nestedKeys
      : new Set(nestedKeys || []);
  const selected = new Set(line.selectedOptionIds || []);
  let delta = 0;
  for (const o of line.options || []) {
    const key = nestedOptionKey(line.id, o.id);
    // Union: package-included (selectedOptionIds, e.g. pad) OR customer nested keys.
    // Never use defaultSelected alone — that inflated discounts.
    const on = selected.has(o.id) || set.has(key);
    if (on) delta += Math.max(0, Number(o.priceDelta) || 0);
  }
  return delta;
}

/** Keep only one tier_upgrade selected per measure. */
export function reconcileTierSelection(
  optionsOrLine: ProductOption[] | QuoteLine | undefined,
  selectedOptionIds: string[],
  toggledId: string,
  on: boolean,
): string[] {
  const options = Array.isArray(optionsOrLine)
    ? optionsOrLine
    : optionsOrLine?.options || [];
  const tierIds = new Set(
    options.filter((o) => o.kind === "tier_upgrade").map((o) => o.id),
  );
  const next = new Set(selectedOptionIds);
  if (on && tierIds.has(toggledId)) {
    for (const id of tierIds) next.delete(id);
    next.add(toggledId);
  } else if (!on) {
    next.delete(toggledId);
  } else {
    next.add(toggledId);
  }
  return Array.from(next);
}

export function calcTotals(
  proposal: Proposal,
  selectedOptionalIds: string[] = [],
  nestedKeys: string[] | Set<string> = [],
): {
  subtotal: number;
  discount: number;
  taxable: number;
  tax: number;
  total: number;
} {
  const nestedSet =
    nestedKeys instanceof Set ? nestedKeys : new Set(nestedKeys || []);
  const selectedOpt = new Set(selectedOptionalIds);
  let subtotal = 0;
  for (const raw of proposal.lineItems || []) {
    const li = normalizeLine(raw);
    const included =
      li.role === "included" ||
      li.role === "info" ||
      (li.role === "optional" &&
        (selectedOpt.has(li.id) || li.customerSelected === true));
    if (!included) continue;
    if (li.role === "info" || li.showPrice === false) {
      subtotal += selectedOptionsDelta(li, nestedSet);
      continue;
    }
    subtotal +=
      li.unitPrice * li.quantity + selectedOptionsDelta(li, nestedSet);
  }
  const discount = Math.max(0, Number(proposal.discount) || 0);
  const taxable = Math.max(0, subtotal - discount);
  const tax = taxable * (Math.max(0, Number(proposal.taxRate) || 0) / 100);
  const total = taxable + tax;
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discount: Math.round(discount * 100) / 100,
    taxable: Math.round(taxable * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

/**
 * California + packet notices — always from Backend → Terms (terms-store).
 * Placeholders {{companyName}} {{license}} {{phoneClause}} are filled here.
 */
export function californiaDisclosures(opts?: {
  companyName?: string;
  license?: string;
  contractorLicense?: string;
  companyPhone?: string;
}): {
  filledInCopy: string;
  downPayment: string;
  progressPayments: string;
  cslb: string;
  cancel3: string;
  cancel5Senior: string;
  mechanicsLien: string;
  cgl: string;
  permits: string;
  electronic: string;
  notLegalAdvice: string;
  rows: { key: string; label: string; text: string; statutory: boolean }[];
  sectionTitle: string;
  sectionIntro: string;
  signatureIntro: string;
  commercialTerms: string;
} {
  const r = resolveTermsForPacket(opts);
  return {
    filledInCopy: r.filledInCopy,
    downPayment: r.downPayment,
    progressPayments: r.progressPayments,
    cslb: r.cslb,
    cancel3: r.cancel3,
    cancel5Senior: r.cancel5Senior,
    mechanicsLien: r.mechanicsLien,
    cgl: r.cgl,
    permits: r.permits,
    electronic: r.electronic,
    notLegalAdvice: r.notLegalAdvice,
    rows: r.rows,
    sectionTitle: r.sectionTitle,
    sectionIntro: r.sectionIntro,
    signatureIntro: r.signatureIntro,
    commercialTerms: r.commercialTerms,
  };
}

export function createBlankProduct(partial?: Partial<Product>): Product {
  const t = nowIso();
  return {
    id: rid("prod"),
    name: partial?.name || "New product",
    sku: partial?.sku || `SKU-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    category: partial?.category || "General",
    description: partial?.description || "",
    unitPrice: partial?.unitPrice ?? 0,
    unit: partial?.unit || "each",
    benefits: partial?.benefits ? [...partial.benefits] : [],
    options: partial?.options ? partial.options.map((o) => ({ ...o })) : [],
    imageUrl: partial?.imageUrl ?? null,
    workScope: partial?.workScope || "",
    materialCost: partial?.materialCost ?? 0,
    laborHours: partial?.laborHours ?? 0,
    equipmentKind: partial?.equipmentKind || "other",
    createdAt: t,
    updatedAt: t,
    ...partial,
  };
}


const SALES_NAME_KEY = "aarvaks_salesperson_name";
const SALES_TITLE_KEY = "aarvaks_salesperson_title";
const SALES_EMAIL_KEY = "aarvaks_salesperson_email";

export function getDefaultSalespersonProfile(): {
  name: string;
  title: string;
  email: string;
} {
  try {
    if (typeof localStorage !== "undefined") {
      return {
        name:
          localStorage.getItem(SALES_NAME_KEY)?.trim() ||
          "Comfort Advisor",
        title:
          localStorage.getItem(SALES_TITLE_KEY)?.trim() ||
          "Comfort Advisor",
        email: localStorage.getItem(SALES_EMAIL_KEY)?.trim() || "",
      };
    }
  } catch {
    /* ignore */
  }
  return {
    name: "Comfort Advisor",
    title: "Comfort Advisor",
    email: "",
  };
}

export function setDefaultSalespersonProfile( partial: {
  name?: string;
  title?: string;
  email?: string;
}): void {
  try {
    if (typeof localStorage === "undefined") return;
    if (partial.name != null)
      localStorage.setItem(SALES_NAME_KEY, partial.name.trim());
    if (partial.title != null)
      localStorage.setItem(SALES_TITLE_KEY, partial.title.trim());
    if (partial.email != null)
      localStorage.setItem(SALES_EMAIL_KEY, partial.email.trim());
  } catch {
    /* ignore */
  }
}

/** Stamp or refresh the salesperson e-sign block (name + date). */
export function ensureSalespersonSignature(
  p: Proposal,
  override?: Partial<SalespersonSignature> | null,
): SalespersonSignature {
  const profile = getDefaultSalespersonProfile();
  const existing = p.salesperson;
  if (existing?.name && existing.signedAt && !override) {
    return existing;
  }
  const name =
    override?.name?.trim() ||
    existing?.name?.trim() ||
    profile.name ||
    "Comfort Advisor";
  return {
    name,
    email: override?.email ?? existing?.email ?? profile.email ?? undefined,
    title:
      override?.title ??
      existing?.title ??
      profile.title ??
      "Comfort Advisor",
    signedAt:
      override?.signedAt ||
      existing?.signedAt ||
      p.createdAt ||
      new Date().toISOString(),
    userId: override?.userId ?? existing?.userId,
    signatureDataUrl:
      override?.signatureDataUrl ?? existing?.signatureDataUrl ?? null,
  };
}

export function withSalespersonSignature(
  p: Proposal,
  override?: Partial<SalespersonSignature> | null,
): Proposal {
  return {
    ...p,
    salesperson: ensureSalespersonSignature(p, override),
  };
}

export function createBlankProposal(
  partial?: Partial<Proposal>,
): Proposal {
  const t = nowIso();
  const draft: Proposal = {
    id: rid("prop"),
    title: partial?.title || "New proposal",
    status: "draft",
    clientCompany: partial?.clientCompany || "",
    clientContact: partial?.clientContact || "",
    clientEmail: partial?.clientEmail || "",
    clientPhone: partial?.clientPhone || "",
    clientAddress: partial?.clientAddress || "",
    proposalNumber:
      partial?.proposalNumber || `Q-${Date.now().toString(36).toUpperCase()}`,
    companyName:
      partial?.companyName || COMPANY.name,

    companyTagline:
      partial?.companyTagline || COMPANY.tagline,
    companyPhone: partial?.companyPhone || COMPANY.phone,
    contractorLicense: partial?.contractorLicense || COMPANY.contractorLicense,
    propertyStreet: partial?.propertyStreet || "",
    propertyCity: partial?.propertyCity || "",
    propertyState: partial?.propertyState || "CA",
    propertyZip: partial?.propertyZip || "",
    propertyPhotoUrl: partial?.propertyPhotoUrl ?? null,
    propertyImageUrl: partial?.propertyImageUrl ?? null,
    propertyMapUrl: partial?.propertyMapUrl ?? null,
    propertyLat: partial?.propertyLat ?? null,
    propertyLon: partial?.propertyLon ?? null,
    executiveSummary: partial?.executiveSummary || "",
    scope: partial?.scope || "",
    timeline: partial?.timeline || "",
    terms: partial?.terms || getDefaultCommercialTerms(),
    notes: partial?.notes || "",
    warranty:
      partial?.warranty ||
      buildProposalWarrantyPage(
        [],
        partial?.companyName || COMPANY.name,
      ),
    currency: "USD",
    taxRate: partial?.taxRate ?? 9.25,
    discount: partial?.discount ?? 0,
    showMeasurePrices: partial?.showMeasurePrices ?? false,
    lineItems: partial?.lineItems || [],
    questions: partial?.questions || [],
    rebates: partial?.rebates || defaultRebatesFromLib(),
    financingOptions: partial?.financingOptions || defaultFinancingOptions(),
    preferredFinancingId: partial?.preferredFinancingId ?? null,
    signingToken: null,
    sentAt: null,
    viewedAt: null,
    pricesLockedAt: null,
    signature: null,
    salesperson: partial?.salesperson ?? null,
    isTest: partial?.isTest ?? false,
    advisorAudit: partial?.advisorAudit ?? null,
    pullList: partial?.pullList ?? null,
    selectedPackageKey: partial?.selectedPackageKey ?? null,
    createdAt: t,
    updatedAt: t,
    ...partial,
  };
  return withSalespersonSignature(draft, partial?.salesperson || undefined);
}

export function createSampleProposal(
  catalog: Product[] = SAMPLE_PRODUCTS,
): Proposal {
  const products = catalog.length ? catalog : SAMPLE_PRODUCTS;
  const comfortFurnace = products.find((x) => x.sku === "CAR-58SB1B");
  const twoStage = products.find((x) => x.sku === "CAR-58TP1B");
  const lines = products
    .filter((p) =>
      ["CAR-58SB1B", "CAR-26SCA5", "SVC-INSTALL", "SVC-PERMIT"].includes(p.sku),
    )
    .map((p) => {
      const line = productToLine(p, { catalog: products });
      if (
        p.sku === "CAR-58SB1B" &&
        comfortFurnace &&
        twoStage &&
        twoStage.id !== comfortFurnace.id
      ) {
        const delta = Math.max(
          0,
          (twoStage.unitPrice || 0) - (comfortFurnace.unitPrice || 0),
        );
        return {
          ...line,
          options: [
            ...(line.options || []),
            {
              id: "tier_up_58sb1b_to_58tp1b",
              kind: "tier_upgrade" as const,
              title: `Option: ${twoStage.name}`,
              body: "Two-stage Performance furnace — quieter cycles, more even heat. Same install path as Package A.",
              priceDelta: delta,
              upgradeSku: twoStage.sku,
              upgradeTier: twoStage.tier ?? 2,
              defaultSelected: false,
            },
          ],
        };
      }
      return line;
    });
  return createBlankProposal({
    id: "prop_sample_training",
    title: "Rivera Test Residence — training sample",
    proposalNumber: "TEST-SAMPLE-001",
    clientCompany: "Rivera Test Residence",
    clientContact: "Maria Rivera",
    clientEmail: "maria.rivera.test@example.com",
    clientPhone: "(510) 555-0199",
    propertyStreet: "1234 Dwight Way",
    propertyCity: "Berkeley",
    propertyState: "CA",
    propertyZip: "94702",
    isTest: true,
    status: "draft",
    lineItems: applyStandardMeasureOrder(lines, products),
    executiveSummary:
      "Saved training sample — always re-open from Home. Edit freely, send a test signing link, and return here anytime.",
    notes: "TEST PROPOSAL — safe to edit, re-send, and re-view.",
  });
}

const PRODUCT_ART = {
  heatpump: "/product-art/heatpump.svg",
  furnace: "/product-art/furnace.svg",
  ac: "/product-art/ac.svg",
  generic: "/product-art/generic.svg",
  filter: "/product-art/filter.svg",
  zoning: "/product-art/zoning.svg",
  duct: "/product-art/duct.svg",
  thermostat: "/product-art/thermostat.svg",
};

function p(partial: Product): Product {
  return stampLockedBenefits(
    stampOfficialPhoto(
      stampEnergyStar({
        ...partial,
        benefits: partial.benefits || [],
        options: partial.options || [],
      }),
    ),
  );
}

/** Honeywell professionally installed zone systems (3 & 4 zone). */
function honeywellZone(zones: 3 | 4): Product {
  const price = zones === 3 ? 3250 : 3850;
  const mat = zones === 3 ? 1420 : 1680;
  const labor = zones === 3 ? 8 : 10;
  return p({
    id: `prod_hw_zone_${zones}`,
    name: `Honeywell ${zones}-Zone Comfort System`,
    sku: `ZONE-HW-${zones}`,
    category: "Zoning · Honeywell",
    description: `Independent temperature in ${zones} living areas — motorized dampers and thermostats so rooms stop fighting over one setting.`,
    unitPrice: price,
    unit: "system",
    materialCost: mat,
    laborHours: labor,
    familyId: "honeywell-zone",
    tier: zones - 2, // 3→1, 4→2 for sort
    tierLabel: `Honeywell ${zones}-zone`,
    equipmentKind: "other",
    matchKey: `zones-${zones}`,
    benefits: [
      `Each of the ${zones} areas gets its own temperature — no more fighting over one thermostat.`,
      "Motorized dampers send air where the room is calling for it.",
      "Installed, balanced, and shown to you by Acme HVAC.",
      "Acme HVAC 3-year labor warranty on the zoning we install.",
      "Works with most conventional heating and cooling systems.",
    ],
    options: [],
    imageUrl: PRODUCT_ART.zoning,
    workScope: [
      "1. Acme HVAC will install a new zone system to meet manufacturer and local code requirements, with Acme’s stamp of quality.",
      `2. Install a new Honeywell ${zones}-zone comfort system.`,
      `3. Install new motorized dampers for each zone. Seal all new connections and insulate all exposed metal to industry standards.`,
      "4. Install a thermostat in each comfort area.",
      "5. Check, test, and adjust the zone board so multi-stage heating and cooling work correctly. Confirm each area heats and cools properly.",
    ].join("\n"),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
}

/** Carrier Infinity zone systems (2–8 zones). */
function infinityZone(zones: number): Product {
  const base = 3800;
  const price = base + (zones - 2) * 650;
  const mat = 1600 + (zones - 2) * 280;
  const labor = 7 + (zones - 2) * 1.25;
  return p({
    id: `prod_inf_zone_${zones}`,
    name: `Carrier Infinity® ${zones}-Zone System`,
    sku: `ZONE-INF-${zones}`,
    category: "Zoning · Carrier Infinity",
    description: `Infinity communicating comfort in ${zones} areas — each on its own schedule, matched to Infinity equipment.`,
    unitPrice: price,
    unit: "system",
    materialCost: mat,
    laborHours: labor,
    familyId: "carrier-infinity-zone",
    tier: zones,
    tierLabel: `Infinity ${zones}-zone`,
    equipmentKind: "other",
    matchKey: `inf-zones-${zones}`,
    benefits: [
      `Carrier Infinity® control of ${zones} comfort areas — each on its own schedule.`,
      "Communicating dampers and airflow, matched to Infinity equipment.",
      "Quiet operation. App and remote when the system has Infinity controls.",
      "Installed, balanced, and shown to you by Acme HVAC.",
      "Acme HVAC 3-year labor warranty on the zoning we install.",
    ],
    options: [],
    imageUrl: PRODUCT_ART.zoning,
    workScope: [
      "1. Acme HVAC will install a new zone system to meet manufacturer and local code requirements, with Acme’s stamp of quality.",
      `2. Install a new Carrier Infinity ${zones}-zone system.`,
      "3. Install new motorized dampers for each zone. Seal all new connections and insulate all exposed metal to industry standards.",
      "4. Install Infinity wall controls or temperature sensors as selected.",
      "5. Check, test, and start the new zone system. Confirm each area heats and cools properly.",
    ].join("\n"),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
}


/** AprilAire whole-home media air cleaner install packages (cabinet + media). */
function aprilaireMedia(
  model: string,
  opts: {
    mediaFamily: string;
    sizeNote: string;
    /** Nominal media opening W×H×thickness (inches) for advisor fit check */
    mediaW: number;
    mediaH: number;
    mediaT: number;
    /** Cabinet envelope W×D×H (inches) for path-of-travel / return bay */
    cabinetW: number;
    cabinetD: number;
    cabinetH: number;
    unitPrice: number;
    materialCost: number;
    laborHours: number;
    merv11: string;
    merv13: string;
    merv16?: string;
    carbon?: string;
    tier?: number;
  },
): Product {
  const mediaLabel = `${opts.mediaW}×${opts.mediaH}×${opts.mediaT}"`;
  const dimNote = `Cabinet ~${opts.cabinetW}" W × ${opts.cabinetD}" D × ${opts.cabinetH}" H · Media ${mediaLabel}`;
  const options: ProductOption[] = [
    {
      id: `opt_aa_${model}_merv13`,
      kind: "accessory",
      title: `AprilAire ${opts.merv13} · MERV 13 Healthy Home · ${mediaLabel}`,
      body: `Genuine AprilAire MERV 13 media (${mediaLabel}) — finer particle capture than MERV 11. Confirm this media size matches the Model ${model} cabinet.`,
      priceDelta: 55,
      materialCost: 28,
      laborHours: 0,
      defaultSelected: false,
    },
  ];
  if (opts.merv16) {
    options.push({
      id: `opt_aa_${model}_merv16`,
      kind: "accessory",
      title: `AprilAire ${opts.merv16} · MERV 16 Allergy & Asthma · ${mediaLabel}`,
      body: `AprilAire Allergy & Asthma media (${mediaLabel}) — confirm fit in Model ${model} cabinet before ordering.`,
      priceDelta: 95,
      materialCost: 48,
      laborHours: 0,
      defaultSelected: false,
    });
  }
  if (opts.carbon) {
    options.push({
      id: `opt_aa_${model}_carbon`,
      kind: "accessory",
      title: `AprilAire ${opts.carbon} · MERV 13 + carbon · ${mediaLabel}`,
      body: `Carbon-infused MERV 13 media (${mediaLabel}) for odors/VOCs — same ${mediaLabel} opening as Model ${model}.`,
      priceDelta: 110,
      materialCost: 55,
      laborHours: 0,
      defaultSelected: false,
    });
  }
  options.push({
    id: `opt_aa_${model}_spare`,
    kind: "accessory",
    title: `Spare media (${mediaLabel})`,
    body: `Extra genuine AprilAire media left on site — ${mediaLabel} for Model ${model}.`,
    priceDelta: 65,
    materialCost: 35,
    laborHours: 0,
    defaultSelected: false,
  });

  return p({
    id: `prod_aa_${model}`,
    name: `AprilAire ${model} Whole-Home Media Air Cleaner`,
    sku: `AA-${model}`,
    category: "Indoor air quality · AprilAire",
    description: `Genuine AprilAire Model ${model} whole-home media air cleaner. ${dimNote}. ${opts.sizeNote}. Base package includes MERV 11 media (${opts.merv11}); upgrade MERV 13 / 16 / carbon as optional selections. Advisor: verify cabinet and media dimensions against the return bay and equipment.`,
    unitPrice: opts.unitPrice,
    unit: "each",
    materialCost: opts.materialCost,
    laborHours: opts.laborHours,
    familyId: "aprilaire-media",
    tier: opts.tier ?? 1,
    tierLabel: `AprilAire ${model} · ${mediaLabel}`,
    equipmentKind: "other",
    matchKey: "iaq-media",
    dimensions: {
      widthIn: opts.cabinetW,
      depthIn: opts.cabinetD,
      heightIn: opts.cabinetH,
    },
    benefits: [
      "Genuine AprilAire whole-home media cabinet — not a 1\" throwaway filter",
      dimNote,
      `Media family ${opts.mediaFamily} · opening ${mediaLabel}`,
      "Captures dust, pollen, pet dander, and household particles at the return",
      "Helps protect the evaporator coil and blower from buildup",
      "Deep media bed for lower pressure drop and longer change intervals",
      "Cleaner air for the entire ducted home",
    ],
    options,
    imageUrl: FILTER_PHOTOS.aprilaire,
    workScope:
      `1. Confirm return-air location and clearances for AprilAire Model ${model}.\n` +
      `2. Install AprilAire ${model} media air cleaner cabinet; level and seal transitions.\n` +
      `3. Integrate so return air passes through the media before the equipment.\n` +
      `4. Install genuine AprilAire media (${opts.merv11} MERV 11 base, or selected upgrade).\n` +
      `5. Verify static pressure / airflow; leave change-interval guidance and any spare media.`,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
}


/**
 * Williams wall / top-vent / counterflow heaters stocked at Home Depot.
 * hdPrice = HD equipment street (local store may vary).
 * unitPrice = equipment + install package.
 */
function inferWallVentClass(vent: string): "top_vent" | "direct_vent" | "counterflow" | "rinnai" {
  const v = (vent || "").toLowerCase();
  if (v.includes("rinnai") || v.includes("energysaver")) return "rinnai";
  if (v.includes("counterflow")) return "counterflow";
  if (v.includes("direct")) return "direct_vent";
  return "top_vent";
}

function wallHeaterProduct(opts: {
  id: string;
  sku: string;
  name: string;
  brand: string;
  model: string;
  hdPrice: number;
  btu: number;
  fuel: string;
  vent: string;
  widthIn: number;
  depthIn: number;
  heightIn: number;
  laborHours: number;
  benefits: string[];
  workScope: string;
  description?: string;
  tier?: number;
}): Product {
  const mat = opts.hdPrice;
  const laborSell = Math.round(opts.laborHours * 145);
  const unitPrice = Math.round(mat * 1.18 + laborSell);
  const ventClass = inferWallVentClass(opts.vent);
  const classLabel =
    ventClass === "counterflow"
      ? "Counterflow"
      : ventClass === "direct_vent"
        ? "Direct-vent"
        : "Top-vent";
  const btuStr = opts.btu.toLocaleString();
  // Polished packet defaults when caller benefits are short/legacy — keep caller text if rich
  const defaultBenefits: Record<string, string[]> = {
    top_vent: [
      "Quiet gravity wall furnace — no central ductwork required for this zone",
      "Top-vent design matches common East Bay wall-furnace replacements",
      `Sized at ${btuStr} BTU input for this room / zone`,
      "Home Depot–stocked Williams equipment — easy future parts support",
      "Professional install, startup, and safety checks by Acme HVAC",
    ],
    direct_vent: [
      "Sealed direct-vent design — combustion air from outdoors, not from the room",
      "Better fit for tighter spaces and exterior-wall installs",
      `${btuStr} BTU natural gas capacity for the designated zone`,
      "Through-wall vent terminal keeps products of combustion outdoors",
      "Installed and commissioned to manufacturer specifications",
    ],
    counterflow: [
      "Counterflow design delivers warm air low — comfortable floor-level heat",
      "Sealed / direct-vent options suited to garages and exterior-wall applications",
      `${btuStr} BTU capacity for larger single zones`,
      "Tall cabinet footprint designed for counterflow performance",
      "Full professional install including vent, gas, and startup",
    ],
  };
  const defaultScope: Record<string, string> = {
    top_vent:
      "1. Confirm fuel type, existing vent path, and clearances for the new Williams top-vent furnace.\n" +
      "2. Safely disconnect and remove the existing wall furnace; protect floors and finishes.\n" +
      "3. Set the Monterey cabinet plumb and secure; connect gas and top vent per manufacturer and code.\n" +
      "4. Start up, verify draft and operation, check for gas tightness, and walk the customer through operation.",
    direct_vent:
      "1. Confirm exterior wall location, wall thickness, and clearances for the direct-vent terminal.\n" +
      "2. Core or prepare the exterior penetration; protect interior and exterior finishes.\n" +
      "3. Mount the heater; install the concentric/direct-vent kit and seals; connect gas per code.\n" +
      "4. Commission the unit, verify safe venting and ignition, and orient the customer.",
    counterflow:
      "1. Confirm cabinet footprint, exterior vent termination, and gas supply for the Forsaire counterflow unit.\n" +
      "2. Set the cabinet; install the vent kit; complete gas piping and any required blower power.\n" +
      "3. Start up and safety-check the system (ignition, venting, airflow).\n" +
      "4. Customer orientation on controls and filter/maintenance access if applicable.",
  };
  // Checkpoint: polished packet language by vent class (caller arrays kept for reference in source calls)
  const benefits = defaultBenefits[ventClass];
  const workScope = defaultScope[ventClass];

  return p({
    id: opts.id,
    name: opts.name,
    sku: opts.sku,
    category: `Wall heat · ${classLabel}`,
    description:
      opts.description ||
      `${opts.brand} ${opts.model} — ${btuStr} BTU ${opts.fuel}, ${opts.vent}. ` +
        `Home Depot equipment street ~$${opts.hdPrice.toLocaleString()} (local store may vary). ` +
        `Package includes Acme HVAC professional install. ` +
        `Cabinet ~${opts.widthIn}" W × ${opts.depthIn}" D × ${opts.heightIn}" H.`,
    unitPrice,
    unit: "each",
    materialCost: mat,
    laborHours: opts.laborHours,
    familyId: "wall-heater",
    tier: opts.tier ?? 1,
    tierLabel: `${classLabel} · ${btuStr} BTU · ${opts.fuel}`,
    equipmentKind: "other",
    matchKey: `wall-heater-${ventClass.replace("_", "-")}`,
    dimensions: {
      widthIn: opts.widthIn,
      depthIn: opts.depthIn,
      heightIn: opts.heightIn,
    },
    benefits,
    options: [
      {
        id: `opt_${opts.id}_tstat`,
        kind: "accessory",
        title: "Wall thermostat upgrade",
        body: "Dedicated wall thermostat where compatible.",
        priceDelta: 185,
        materialCost: 45,
        laborHours: 0.75,
        defaultSelected: false,
      },
      {
        id: `opt_${opts.id}_high_alt`,
        kind: "accessory",
        title: "High-altitude orifice kit (if required)",
        body: "Manufacturer high-altitude kit when elevation requires it.",
        priceDelta: 95,
        materialCost: 40,
        laborHours: 0.5,
        defaultSelected: false,
      },
    ],
    imageUrl: /rinnai|energysaver/i.test(`${opts.name} ${opts.brand} ${opts.vent}`)
      ? WALL_PHOTOS.rinnai
      : /monterey/i.test(opts.name)
        ? WALL_PHOTOS.williamsMonterey
        : WALL_PHOTOS.williamsForsaire,
    workScope,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
}


export const SAMPLE_PRODUCTS: Product[] = [
  p({
    id: "prod_carrier_26sca5",
    name: "Carrier Comfort™ 16 Air Conditioner (26SCA5)",
    sku: "CAR-26SCA5",
    category: "Cooling · Carrier",
    description:
      "Comfort single-stage AC. Upgrade checkboxes only show higher tiers with matching size class.",
    unitPrice: 4800,
    unit: "each",
    materialCost: 2100,
    laborHours: 2.5,
    familyId: "carrier-ac",
    tier: 1,
    tierLabel: "Comfort 16 AC",
    equipmentKind: "ac",
    matchKey: "3ton-class",
    seer2: 15.2,
    soundDb: 74,
    eer2: 12.0,
    benefits: [
      "Up to 16.5 SEER2",
      "Single-stage scroll compressor",
      "Puron Advance™ refrigerant",
      "Quiet outdoor operation",
      "10-year parts",
    ],
    options: [],
    imageUrl: "/product-photos/ac-comfort-26sca5.png",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  p({
    id: "prod_carrier_26tpa8",
    name: "Carrier Performance™ 18 AC (26TPA8)",
    sku: "CAR-26TPA8",
    category: "Cooling · Carrier",
    description: "Performance two-stage AC — above Comfort only.",
    unitPrice: 5600,
    unit: "each",
    materialCost: 2450,
    laborHours: 2.75,
    familyId: "carrier-ac",
    tier: 2,
    tierLabel: "Performance 18 AC (two-stage)",
    equipmentKind: "ac",
    matchKey: "3ton-class",
    seer2: 17.5,
    soundDb: 68,
    eer2: 13.0,
    benefits: [
      "Two-stage cooling",
      "Higher SEER2 than Comfort",
      "Better humidity control",
      "Quieter long cycles",
    ],
    options: [],
    imageUrl: "/product-photos/ac-performance-26tpa8.png",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  p({
    id: "prod_carrier_26vna1",
    name: "Carrier Infinity® Variable-Speed AC (26VNA1)",
    sku: "CAR-26VNA1",
    category: "Cooling · Carrier",
    description: "Top-tier Infinity AC — only as upgrade above Comfort/Performance.",
    unitPrice: 7200,
    unit: "each",
    materialCost: 3100,
    laborHours: 3,
    familyId: "carrier-ac",
    tier: 3,
    tierLabel: "Infinity variable-speed AC",
    equipmentKind: "ac",
    matchKey: "3ton-class",
    seer2: 21.0,
    soundDb: 62,
    eer2: 14.0,
    benefits: [
      "Variable-speed inverter",
      "Top SEER2 in ladder",
      "Ultra-quiet",
      "Best humidity control with Infinity match",
    ],
    options: [],
    imageUrl: "/product-photos/ac-infinity-26vna1.png",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  p({
    id: "prod_carrier_58sb1b",
    name: "Carrier Comfort™ 80 Gas Furnace (58SB1B)",
    sku: "CAR-58SB1B",
    category: "Heating · Carrier",
    description:
      "Base 80% furnace. Upgrades only show Performance/Infinity above — never lower.",
    unitPrice: 4200,
    unit: "each",
    materialCost: 1443,
    laborHours: 3,
    familyId: "carrier-furnace-80",
    tier: 1,
    tierLabel: "Comfort 80 furnace",
    equipmentKind: "furnace",
    matchKey: "80afue-mid",
    dimensions: { widthIn: 17.5, depthIn: 28.5, heightIn: 33.75 },
    benefits: [
      "80% AFUE",
      "Multi 18-speed ECM blower",
      "4-way multipoise",
      "Quiet operation",
      "Strong HX warranty path",
    ],
    options: [
      {
        id: "opt_lp",
        kind: "accessory",
        title: "Natural gas to propane kit",
        body: "Factory LP conversion.",
        priceDelta: 141,
      },
      {
        id: "opt_filter_cab",
        kind: "accessory",
        title: "Filter cabinet",
        body: "Side-return filter cabinet.",
        priceDelta: 79,
      },
    ],
    imageUrl: FURN_SERIES_PHOTOS.comfort80,
    workScope:
      "1. Remove existing furnace.\n2. Set new unit; gas, vent, transitions.\n3. Startup and safety checks.\n4. Owner walkthrough.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  p({
    id: "prod_carrier_58tp1b",
    name: "Carrier Performance™ 80 Two-Stage Furnace (58TP1B)",
    sku: "CAR-58TP1B",
    category: "Heating · Carrier",
    description: "Performance two-stage — upgrade above Comfort.",
    unitPrice: 5100,
    unit: "each",
    materialCost: 1935,
    laborHours: 3.25,
    familyId: "carrier-furnace-80",
    tier: 2,
    tierLabel: "Performance 80 two-stage furnace",
    equipmentKind: "furnace",
    matchKey: "80afue-mid",
    dimensions: { widthIn: 17.5, depthIn: 28.5, heightIn: 33.75 },
    benefits: [
      "Two-stage heat",
      "Even temperatures",
      "Quieter cycles",
      "Strong cooling airflow support",
    ],
    options: [],
    imageUrl: FURN_SERIES_PHOTOS.performance80,
    workScope:
      "1. Set Performance furnace.\n2. Gas, vent, electrical.\n3. Commission two-stage heat.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  p({
    id: "prod_carrier_58tn1b",
    name: "Carrier Infinity® 80 Two-Stage Furnace (58TN1B)",
    sku: "CAR-58TN1B",
    category: "Heating · Carrier",
    description: "Infinity variable-speed — top of 80% ladder.",
    unitPrice: 5800,
    unit: "each",
    materialCost: 2580,
    laborHours: 3.5,
    familyId: "carrier-furnace-80",
    tier: 3,
    tierLabel: "Infinity 80 variable-speed furnace",
    equipmentKind: "furnace",
    matchKey: "80afue-mid",
    dimensions: { widthIn: 17.5, depthIn: 28.5, heightIn: 33.75 },
    benefits: [
      "Variable-speed constant airflow",
      "Infinity communicating",
      "Even temps & humidity help",
      "Premium warranty path",
    ],
    options: [],
    imageUrl: FURN_SERIES_PHOTOS.infinity80,
    workScope:
      "1. Set Infinity furnace.\n2. Communicating control integration.\n3. Commission staging and airflow.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  p({
    id: "prod_hp_conversion_guide",
    name: "Gas furnace vs heat pump — what changes",
    sku: "SVC-HP-VS-GAS",
    category: "Education",
    description:
      "Free expectation language for homeowners converting from gas heat to a heat pump. Never charged — always included for proper expectations.",
    unitPrice: 0,
    unit: "each",
    materialCost: 0,
    laborHours: 0,
    equipmentKind: "other",
    benefits: [
      "Clear gas vs heat pump differences",
      "What Acme HVAC sets up on a conversion",
      "No pressure — information only",
    ],
    options: [],
    imageUrl: PRODUCT_ART.generic,
    workScope:
      "WHAT YOU ARE LEAVING BEHIND (GAS FURNACE)\n1. Natural gas or propane burns in a heat exchanger; warm air is blown through the ducts.\n2. Heat is typically short, high-temperature cycles controlled by a thermostat.\n3. Combustion air, flue/venting, gas piping, and CO safety devices are part of the system.\n4. Operating cost tracks gas rates and AFUE efficiency.\n\nWHAT YOU ARE MOVING TO (HEAT PUMP)\n1. The outdoor unit extracts heat from outdoor air (even in cold weather) and delivers it indoors — reverse cycle for cooling in summer.\n2. Capacity is modulated or staged for longer, quieter cycles and more even room temperatures.\n3. No furnace burner for primary heat; electrical service and outdoor clearances matter more than gas venting.\n4. Operating cost tracks electricity rates, system efficiency (HSPF2 / SEER2), and how cold it gets outside.\n\nWHAT ACME HVAC SETS UP ON A CONVERSION\n1. Confirm load and electrical capacity for the heat pump design.\n2. Plan removal or isolation of gas furnace equipment as applicable.\n3. Install matched heat pump outdoor and indoor equipment.\n4. Commission heat and cool modes; orient the homeowner.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  p({
    id: "prod_hpwh_expect",
    name: "Heat pump water heater — what to expect",
    sku: "SVC-HPWH-EXPECT",
    category: "Education",
    description:
      "Free homeowner education when a heat pump (hybrid) water heater is specified. Recovery is slower than gas; efficiency is excellent. Not a priced measure.",
    unitPrice: 0,
    unit: "each",
    materialCost: 0,
    laborHours: 0,
    equipmentKind: "other",
    benefits: [
      "Honest recovery-time expectations vs gas or standard electric",
      "Why heat pump water heaters use far less energy",
      "Placement, noise, and cool-air byproduct explained",
      "Tips so the first weeks feel predictable — not surprising",
    ],
    options: [],
    imageUrl: PRODUCT_ART.generic,
    workScope:
      "HEAT PUMP WATER HEATER — HOMEOWNER EXPECTATIONS\n\n" +
      "WHY FAMILIES CHOOSE THEM\n" +
      "1. A heat pump water heater (also called a hybrid water heater) moves heat from the surrounding air into the tank instead of making heat only with electric elements. That is why they are among the most efficient water heaters available.\n" +
      "2. Over a year they typically use substantially less electricity than a standard electric tank of the same size.\n" +
      "3. Many models can switch modes (heat-pump only, hybrid, electric-only) if you ever need a temporary boost.\n\n" +
      "RECOVERY IS SLOWER — PLAN AROUND IT\n" +
      "1. Gas and conventional electric tanks reheat a drained tank relatively quickly. A heat pump water heater in efficient heat-pump mode recovers more slowly because it is moving heat, not blasting full element power all the time.\n" +
      "2. After heavy use (back-to-back showers, laundry + dishes + showers), the tank may need longer to fully reheat. That is normal — not a defect.\n" +
      "3. Sizing (gallon capacity), your household’s peak-hour use, and the mode setting all affect how often you notice recovery time. Your comfort advisor sizes and sets mode recommendations for your home.\n" +
      "4. If you occasionally need faster recovery, hybrid or electric-boost modes can help; we will show you how to use them without giving up efficiency most of the year.\n\n" +
      "OTHER THINGS WORTH KNOWING\n" +
      "1. Cooler air nearby: While heating water, the unit pulls heat from the room air and exhausts cooler air. In a garage or basement this is usually fine; in a tight mechanical closet we plan airflow and clearances carefully.\n" +
      "2. Sound: The compressor and fan make a soft appliance-level sound (often compared to a refrigerator or dehumidifier). Placement and mounting reduce how noticeable it is.\n" +
      "3. Condensate: The process creates water that must drain. We install a proper condensate path (gravity or pump as needed).\n" +
      "4. Space and airflow: Heat pump water heaters need manufacturer clearances and enough air volume. Tight closets may need louvered doors or a different location — we confirm this before install.\n" +
      "5. First-hour rating vs “endless” feel: Unlike tankless gas, a tank still has a first-hour limit. Good sizing and smart habits (staggering large draws) keep comfort high.\n" +
      "6. Vacation / away modes: Many units have energy-saving schedules; we can set a baseline and teach simple app or panel controls if included.\n\n" +
      "WHAT ACME HVAC DOES\n" +
      "1. Confirm model, capacity, electrical circuit, condensate, and placement fit your home.\n" +
      "2. Install to manufacturer and code requirements; remove and recycle the old heater when included in scope.\n" +
      "3. Commission modes and walk you through day-to-day use, recovery expectations, and when to use a boost mode.\n" +
      "4. Leave you with clear operating tips so the efficiency you paid for matches real-life comfort.\n\n" +
      "This section is informational only — no equipment charge for this language. It is included so everyone has the same honest expectations before work begins.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  p({
    id: "prod_hpwh_hybrid_50",
    name: "A. O. Smith Voltex Heat Pump Water Heater — 50 Gallon",
    sku: "WTR-HPWH-50",
    category: "Water heating",
    description:
      "50-gallon hybrid heat pump water heater class. UEF ~3.5. Recovery in heat-pump mode is slower than gas — see expectation language on this proposal.",
    unitPrice: 3850,
    unit: "each",
    materialCost: 1680,
    laborHours: 6,
    familyId: "hpwh",
    matchKey: "wh-hpwh-50",
    capacityValue: 50,
    installFuel: "electric",
    installPower: "dedicated_circuit",
    installFootprint: "hpwh",
    dimensions: hpwhDims(50),
    soundDb: 49,
    benefits: [
      "Among the lowest operating costs for tank-style hot water",
      "UEF ~3.5 class · first-hour ~65–75 gal",
      "Cabinet ~22\" × 22\" × 63\" · ~49 dBA heat-pump mode",
      "Hybrid modes for everyday efficiency with boost when needed",
      "Paired with Acme HVAC homeowner orientation on recovery and use",
    ],
    options: [],
    imageUrl: WH_PHOTOS.voltex,
    workScope:
      "1. Confirm electrical circuit, condensate path, and clearances for heat pump water heater.\n2. Remove existing water heater; haul and recycle as included.\n3. Set new hybrid heat pump water heater; water, electrical, condensate, seismic strap as required.\n4. Commission modes; set temperature; verify first-hour performance.\n5. Orient homeowner on recovery expectations, modes, and maintenance.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  p({
    id: "prod_hpwh_hybrid_65",
    name: "A. O. Smith Voltex Heat Pump Water Heater — 80 Gallon",
    sku: "WTR-HPWH-80",
    category: "Water heating",
    description:
      "65–80 gallon hybrid heat pump water heater class. UEF ~3.7. Extra first-hour for bigger households; recovery still slower than gas in heat-pump mode.",
    unitPrice: 4450,
    unit: "each",
    materialCost: 1980,
    laborHours: 6.5,
    familyId: "hpwh",
    matchKey: "wh-hpwh-80",
    capacityValue: 80,
    installFuel: "electric",
    installPower: "dedicated_circuit",
    installFootprint: "hpwh",
    dimensions: hpwhDims(80),
    soundDb: 50,
    benefits: [
      "Extra capacity for peak morning/evening demand",
      "UEF ~3.7 class · first-hour ~95–110 gal",
      "Cabinet ~27\" × 27\" × 81\" · ~50 dBA heat-pump mode",
      "Boost / hybrid modes available when you need faster recovery",
    ],
    options: [],
    imageUrl: WH_PHOTOS.voltex,
    workScope:
      "1. Confirm electrical, condensate, and placement for larger hybrid unit.\n2. Remove existing heater; haul/recycle as included.\n3. Set hybrid heat pump water heater; connect water, power, condensate; strap per code.\n4. Commission and homeowner orientation including recovery expectations.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  p({
    id: "prod_load",
    name: "Precision Home Load & Efficiency Analysis",
    sku: "SVC-LOAD",
    category: "Design",
    description:
      "Proper sizing using room-by-room load methodology and efficiency measurements. Included at no charge on equipment quotes.",
    unitPrice: 0,
    unit: "each",
    materialCost: 0,
    laborHours: 0,
    benefits: [
      "Right-sized equipment — not oversold tonnage",
      "Special technology to measure house efficiency",
      "Supports permit and manufacturer specs",
    ],
    options: [],
    imageUrl: PRODUCT_ART.generic,
    workScope:
      "1. Measure envelope and rooms as needed.\n2. Run load / efficiency analysis.\n3. Match equipment capacity to results.\n4. Document for the packet and install team.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  p({
    id: "prod_duct",
    name: "Ductwork",
    sku: "SVC-DUCT",
    category: "Airflow · Ductwork",
    description:
      "Reconnect, tune, or replace the duct system so the new equipment can deliver its rated airflow. Path is picked on the job.",
    unitPrice: 950,
    unit: "job",
    materialCost: 220,
    laborHours: 3,
    familyId: "ductwork",
    equipmentKind: "other",
    matchKey: "ductwork",
    packageRule: "eligible",
    benefits: [
      "Ducts sized and connected so the new equipment can move the air it was designed for",
      "Sealed connections — less wasted heating and cooling in the attic or crawl",
      "Hard metal fittings at tight turns so flex is not crushed and airflow stays open",
      "Insulated to manufacturer and code requirements",
      "Acme HVAC 3-year labor warranty on the duct work we install",
    ],
    options: [
      {
        id: "opt_new_ducts",
        kind: "accessory",
        title: "Recommended: replace the duct system",
        body:
          "New ducts sized for this equipment. Better airflow, fewer leaks, and a cleaner HERS path than leaving old or undersized pipe. We recommend this when the existing system will not deliver the airflow this equipment needs.",
        priceDelta: 6200,
        laborHours: 14,
        materialCost: 2100,
        defaultSelected: false,
      },
    ],
    imageUrl: PRODUCT_ART.duct,
    workScope:
      "1. Reconnect or replace the duct system as scoped for this equipment.\n" +
      "2. Seal new connections and accessible joints.\n" +
      "3. Confirm the path can deliver the airflow the equipment needs.\n" +
      "4. Insulate new ducts per manufacturer and code requirements.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  // —— Odds & ends (standalone small jobs) ——
  p({
    id: "prod_svc_gas",
    name: "Gas line (new or extended)",
    sku: "SVC-GAS",
    category: "Odds & ends · Gas",
    description:
      "Run or extend gas piping for the appliance on this quote, sized to code and local requirements.",
    unitPrice: 875,
    unit: "job",
    materialCost: 180,
    laborHours: 2.5,
    familyId: "gas-line",
    equipmentKind: "other",
    matchKey: "gas_line",
    benefits: [
      "Sized for the appliance BTU load on this proposal",
      "New or extended run as scoped on site",
      "Supports furnace, water heater, or other gas appliance needs",
      "Quoted as a clear line item — not buried in install",
    ],
    options: [],
    imageUrl: PRODUCT_ART.generic,
    workScope:
      "1. Confirm appliance BTU and run length on site.\n2. Install or extend gas piping with approved materials.\n3. Pressure-test as required.\n4. Cap/secure and label as needed; clean up.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  p({
    id: "prod_svc_duct_one",
    name: "Single duct run",
    sku: "SVC-DUCT-ONE",
    category: "Odds & ends · Duct",
    description:
      "One supply or return run — not a full-home duct redesign. Use for a single room or short extension.",
    unitPrice: 650,
    unit: "job",
    materialCost: 140,
    laborHours: 2,
    familyId: "single-duct",
    equipmentKind: "other",
    matchKey: "single_duct",
    benefits: [
      "One clear supply or return path",
      "Sized for the room / register on this quote",
      "Separate from full duct sealing packages",
    ],
    options: [],
    imageUrl: PRODUCT_ART.duct,
    workScope:
      "1. Route one supply or return run as marked on site.\n2. Install register/grille as scoped.\n3. Seal connections in the work path.\n4. Verify open airflow; clean up.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  p({
    id: "prod_svc_flue",
    name: "Flue / vent work",
    sku: "SVC-FLUE",
    category: "Odds & ends · Venting",
    description:
      "Flue pipe, B-vent, or vent modifications for gas appliances as scoped on site.",
    unitPrice: 725,
    unit: "job",
    materialCost: 160,
    laborHours: 2,
    familyId: "flue",
    equipmentKind: "other",
    matchKey: "flue",
    benefits: [
      "Proper venting for the gas appliance we are installing",
      "Materials and clearances per code and manufacturer",
      "Separate line so vent work is visible on the proposal",
    ],
    options: [],
    imageUrl: PRODUCT_ART.generic,
    workScope:
      "1. Inspect existing vent path and clearances.\n2. Install or modify flue / B-vent as scoped.\n3. Secure, seal joints, and check draft/termination as applicable.\n4. Clean up and note any remaining recommendations.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  p({
    id: "prod_svc_disc",
    name: "Electrical disconnect / whip",
    sku: "SVC-DISC",
    category: "Odds & ends · Electrical",
    description:
      "Outdoor disconnect and whip for condenser or heat pump — sized to the unit on this proposal.",
    unitPrice: 425,
    unit: "job",
    materialCost: 95,
    laborHours: 1.25,
    familyId: "electrical_disconnect",
    equipmentKind: "other",
    matchKey: "electrical_disconnect",
    benefits: [
      "Disconnect within sight of the outdoor unit",
      "Whip and connections sized to nameplate",
      "Clear line item for production and inspection",
    ],
    options: [],
    imageUrl: PRODUCT_ART.generic,
    workScope:
      "1. Confirm nameplate ampacity.\n2. Install outdoor disconnect and whip as scoped.\n3. Land connections; verify secure and weather-protected.\n4. Clean up.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  p({
    id: "prod_elec_120",
    name: "120-volt circuit",
    sku: "ELEC-120",
    category: "Electrical",
    description:
      "A dedicated 15/20-amp, 120-volt circuit — receptacle or small equipment. Not a heat-pump feeder.",
    unitPrice: 685,
    unit: "job",
    materialCost: 95,
    laborHours: 2,
    familyId: "electrical",
    equipmentKind: "other",
    matchKey: "electrical",
    installPower: "dedicated_circuit",
    benefits: [
      "A dedicated 120-volt circuit sized to the load — not a leftover circuit.",
      "Listed breaker, wire, and landing that will pass inspection.",
      "Acme HVAC 3-year labor warranty on the electrical we install.",
    ],
    options: [],
    imageUrl: PRODUCT_ART.generic,
    workScope:
      "1. Confirm the load and the panel.\n2. Run a new 120-volt circuit and land it on a proper breaker.\n3. Test and leave the work inspectable.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  p({
    id: "prod_elec_240",
    name: "240-volt circuit",
    sku: "ELEC-240",
    category: "Electrical",
    description:
      "A 240-volt circuit for a dryer, range, or car charger. Amp size is picked on the job.",
    unitPrice: 1185,
    unit: "job",
    materialCost: 185,
    laborHours: 3.25,
    familyId: "electrical",
    equipmentKind: "other",
    matchKey: "electrical",
    installPower: "dedicated_circuit",
    benefits: [
      "A 240-volt circuit sized to the appliance listing — 30, 40, or 50 amp as selected.",
      "Listed breaker, conductors, and receptacle so the appliance starts clean.",
      "Acme HVAC 3-year labor warranty on the electrical we install.",
    ],
    options: [],
    imageUrl: PRODUCT_ART.generic,
    workScope:
      "1. Confirm the nameplate and the panel.\n2. Run a new 240-volt circuit and land it.\n3. Test and leave the work inspectable.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  p({
    id: "prod_elec_gfi",
    name: "GFCI receptacle",
    sku: "ELEC-GFI",
    category: "Electrical",
    description:
      "Add or replace a GFCI receptacle. Short job — still written so the homeowner sees the protection.",
    unitPrice: 285,
    unit: "job",
    materialCost: 38,
    laborHours: 0.85,
    familyId: "electrical",
    equipmentKind: "other",
    matchKey: "electrical",
    installPower: "plug_nearby",
    benefits: [
      "Listed GFCI that trips and resets the way it should",
      "Protects people where water and power meet",
      "Replace in place, or add a new landing if the site needs it",
      "Acme HVAC 3-year labor on the work we perform",
    ],
    options: [],
    imageUrl: PRODUCT_ART.generic,
    workScope:
      "1. Confirm the location and the existing box.\n2. Install a listed GFCI receptacle.\n3. Test trip and reset.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  p({
    id: "prod_elec_light",
    name: "light and wall switch",
    sku: "ELEC-LIGHT",
    category: "Electrical",
    description:
      "A light and a concealed wall switch in a finished room. Rough patch by Acme. Texture and paint by the owner.",
    unitPrice: 885,
    unit: "job",
    materialCost: 95,
    laborHours: 2.75,
    familyId: "electrical",
    equipmentKind: "other",
    matchKey: "electrical",
    installPower: "dedicated_circuit",
    benefits: [
      "Concealed switch leg — no surface pipe in a living space",
      "Top plate, joist block, and finish called out before the crew shows up",
      "Acme leaves a rough patch. Texture and paint stay with the owner — no surprise painters",
      "Acme HVAC 3-year labor on the work we perform",
    ],
    options: [],
    imageUrl: PRODUCT_ART.generic,
    workScope:
      "1. Confirm the fixture and switch location.\n2. Run power and the switch leg concealed.\n3. Rough-patch. Test the light and switch.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  p({
    id: "prod_elec_sub",
    name: "sub panel",
    sku: "ELEC-SUB",
    category: "Electrical",
    description:
      "When the main is full. New sub panel, feeder from the main, and room for the next load.",
    unitPrice: 2485,
    unit: "job",
    materialCost: 420,
    laborHours: 6,
    familyId: "electrical",
    equipmentKind: "other",
    matchKey: "electrical",
    installPower: "dedicated_circuit",
    benefits: [
      "Solves a full main without a whole-house service change",
      "Proper feeder, ground, and neutrals — not a jumper in a stuffed can",
      "Space for the new load and the next one this house will ask for",
      "Acme HVAC 3-year labor on the work we perform",
    ],
    options: [],
    imageUrl: PRODUCT_ART.generic,
    workScope:
      "1. Confirm the main is full and pick the sub location.\n2. Run the feeder and set the sub panel.\n3. Move circuits as scoped. Label and test.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  p({
    id: "prod_elec_custom",
    name: "custom electrical work",
    sku: "ELEC-CUSTOM",
    category: "Electrical",
    description:
      "Electrical work this list does not already cover. The advisor writes what we are doing. It still prints like a real measure.",
    unitPrice: 485,
    unit: "job",
    materialCost: 65,
    laborHours: 1.5,
    familyId: "electrical",
    equipmentKind: "other",
    matchKey: "electrical",
    installPower: "dedicated_circuit",
    benefits: [
      "Written in plain language so the homeowner knows what they bought",
      "Priced as real work — not a mystery line at the bottom",
      "Same care and code standard as every other Acme electrical job",
      "Acme HVAC 3-year labor on the work we perform",
    ],
    options: [],
    imageUrl: PRODUCT_ART.generic,
    workScope:
      "1. Confirm the work described on this measure.\n2. Complete it to code.\n3. Test and leave the work inspectable.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  p({
    id: "prod_svc_cond",
    name: "Condensate drain work",
    sku: "SVC-COND",
    category: "Odds & ends · Drainage",
    description:
      "Primary/secondary condensate drain, pump, or line work for the indoor unit on this quote.",
    unitPrice: 385,
    unit: "job",
    materialCost: 75,
    laborHours: 1.25,
    familyId: "condensate",
    equipmentKind: "other",
    matchKey: "condensate",
    benefits: [
      "Protects floors and ceilings from overflow",
      "Pump or gravity path as site allows",
      "Scoped separately when drain is the main work",
    ],
    options: [],
    imageUrl: PRODUCT_ART.generic,
    workScope:
      "1. Route primary and secondary drain as required.\n2. Install pump if gravity path is not available.\n3. Test flow; secure lines.\n4. Clean up.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  p({
    id: "prod_svc_sm",
    name: "Sheet metal / plenum fab",
    sku: "SVC-SM",
    category: "Odds & ends · Sheet metal",
    description:
      "Plenum, transition, or small sheet-metal fab for the equipment change on this proposal.",
    unitPrice: 550,
    unit: "job",
    materialCost: 120,
    laborHours: 1.75,
    familyId: "sheet-metal",
    equipmentKind: "other",
    matchKey: "sheet_metal",
    benefits: [
      "Clean transitions for the new equipment",
      "Fab scoped to the install path",
      "Visible as its own measure when metal work stands alone",
    ],
    options: [],
    imageUrl: PRODUCT_ART.generic,
    workScope:
      "1. Measure openings and transitions on site.\n2. Fabricate or fit plenum/transition as scoped.\n3. Seal and secure; check clearances.\n4. Clean up.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  // —— Zoning lineup ——
  honeywellZone(3),
  honeywellZone(4),
  infinityZone(2),
  infinityZone(3),
  infinityZone(4),
  infinityZone(5),
  infinityZone(6),
  infinityZone(7),
  infinityZone(8),
  // —— AprilAire whole-home media air cleaners (filter measure) ——
  // Cabinet W×D×H and media W×H×T are advisor-only fit checks (inches).
  aprilaireMedia("1210", {
    mediaFamily: "210 / 213 / 216 / 213CBN",
    sizeNote: "compact return · 20×25 media class",
    mediaW: 20, mediaH: 25, mediaT: 4,
    cabinetW: 24.5, cabinetD: 6.75, cabinetH: 20.5,
    unitPrice: 725, materialCost: 340, laborHours: 1.5,
    merv11: "210", merv13: "213", merv16: "216", carbon: "213CBN", tier: 1,
  }),
  aprilaireMedia("1310", {
    mediaFamily: "310 / 313",
    sizeNote: "16×25 media class",
    mediaW: 16, mediaH: 25, mediaT: 4,
    cabinetW: 20.5, cabinetD: 6.75, cabinetH: 25,
    unitPrice: 765, materialCost: 360, laborHours: 1.5,
    merv11: "310", merv13: "313", tier: 2,
  }),
  aprilaireMedia("1410", {
    mediaFamily: "410 / 413 / 416 / 413CBN",
    sizeNote: "16×25 media · popular retrofit",
    mediaW: 16, mediaH: 25, mediaT: 4,
    cabinetW: 20.5, cabinetD: 6.75, cabinetH: 25,
    unitPrice: 795, materialCost: 375, laborHours: 1.75,
    merv11: "410", merv13: "413", merv16: "416", carbon: "413CBN", tier: 3,
  }),
  aprilaireMedia("1510", {
    mediaFamily: "510 / 513",
    sizeNote: "20×25 media class",
    mediaW: 20, mediaH: 25, mediaT: 4,
    cabinetW: 24.5, cabinetD: 6.75, cabinetH: 25,
    unitPrice: 845, materialCost: 400, laborHours: 1.75,
    merv11: "510", merv13: "513", tier: 4,
  }),
  aprilaireMedia("1610", {
    mediaFamily: "610 / 613 / 616",
    sizeNote: "high-capacity media for larger systems",
    mediaW: 20, mediaH: 25, mediaT: 5,
    cabinetW: 24.5, cabinetD: 7.5, cabinetH: 28,
    unitPrice: 925, materialCost: 445, laborHours: 2,
    merv11: "610", merv13: "613", merv16: "616", tier: 5,
  }),
  aprilaireMedia("2210", {
    mediaFamily: "210 / 213 / 216 / 213CBN",
    sizeNote: "current-gen compact",
    mediaW: 20, mediaH: 25, mediaT: 4,
    cabinetW: 24.5, cabinetD: 6.75, cabinetH: 20.5,
    unitPrice: 875, materialCost: 420, laborHours: 1.75,
    merv11: "210", merv13: "213", merv16: "216", carbon: "213CBN", tier: 6,
  }),
  aprilaireMedia("2410", {
    mediaFamily: "410 / 413 / 416 / 413CBN",
    sizeNote: "current-gen 16×25 class",
    mediaW: 16, mediaH: 25, mediaT: 4,
    cabinetW: 20.5, cabinetD: 6.75, cabinetH: 25,
    unitPrice: 945, materialCost: 455, laborHours: 1.75,
    merv11: "410", merv13: "413", merv16: "416", carbon: "413CBN", tier: 7,
  }),

  // —— Williams wall heaters (Home Depot–stocked) ——
  // Equipment $ from public HD listings; local CA store may vary. Williams only.
  wallHeaterProduct({
    id: "prod_wall_wil_25ng",
    sku: "WALL-WIL-2509622A",
    name: "Williams Monterey 25,000 BTU Top-Vent Wall Furnace (NG)",
    brand: "Williams",
    model: "2509622A",
    hdPrice: 725,
    btu: 25000,
    fuel: "natural gas",
    vent: "top-vent gravity",
    widthIn: 14.25,
    depthIn: 6.5,
    heightIn: 72,
    laborHours: 5.5,
    tier: 1,
    benefits: [
      "Home Depot–stocked Williams Monterey — common East Bay replacement",
      "25,000 BTU natural gas · small zone / studio class",
      "Top-vent gravity — heat without blower power dependency",
      "Works during power outages (standing pilot / millivolt systems)",
      "Advisor fit: 14¼\" W × 6½\" D × 72\" H",
    ],
    workScope:
      "1. Confirm fuel, vent path, and clearances for Williams 2509622A.\n" +
      "2. Remove existing wall heater if applicable.\n" +
      "3. Set Monterey cabinet; gas and vent per code.\n" +
      "4. Fire, adjust, draft/CO checks; owner orientation.",
  }),
  wallHeaterProduct({
    id: "prod_wall_wil_35ng",
    sku: "WALL-WIL-3509622A",
    name: "Williams Monterey 35,000 BTU Top-Vent Wall Furnace (NG)",
    brand: "Williams",
    model: "3509622A",
    hdPrice: 1429,
    btu: 35000,
    fuel: "natural gas",
    vent: "top-vent gravity",
    widthIn: 14.25,
    depthIn: 6.5,
    heightIn: 72,
    laborHours: 6,
    tier: 2,
    benefits: [
      "HD equipment street ~$1,429 (local store may vary)",
      "35,000 BTU NG Monterey — popular whole-room wall furnace",
      "66% AFUE class gravity wall heat",
      "Advisor fit: 14¼\" W × 6½\" D × 72\" H",
    ],
    workScope:
      "1. Confirm load, gas, top-vent route for 3509622A.\n" +
      "2. Set Monterey; gas, vent, controls.\n" +
      "3. Startup, draft/CO checks, owner walkthrough.",
  }),
  wallHeaterProduct({
    id: "prod_wall_wil_50ng",
    sku: "WALL-WIL-5009622A",
    name: "Williams Monterey 50,000 BTU Top-Vent Dual-Sided Wall Furnace (NG)",
    brand: "Williams",
    model: "5009622A",
    hdPrice: 1539,
    btu: 50000,
    fuel: "natural gas",
    vent: "top-vent gravity",
    widthIn: 16,
    depthIn: 6.5,
    heightIn: 72,
    laborHours: 6.5,
    tier: 3,
    benefits: [
      "Double-sided — heats two adjacent rooms (25k each side)",
      "Not a swap for 25k / 35k single-sided Monterey — different cabinet and wall opening",
      "HD equipment street ~$1,539 class",
      "Advisor fit: 16\" W × 6½\" D × 72\" H class",
    ],
    workScope:
      "1. Confirm two-room opening, gas, and vent for dual-sided 5009622A — this is not a 25/35 single-sided swap.\n2. Cut / finish the second-side grille path as required.\n3. Set furnace; connect gas/vent.\n4. Commission with combustion checks.\n5. Owner orientation.",
  }),
  wallHeaterProduct({
    id: "prod_wall_wil_35cf",
    sku: "WALL-WIL-3508632",
    name: "Williams 35,000 BTU Counterflow Top-Vent Wall Heater (NG)",
    brand: "Williams",
    model: "3508632",
    hdPrice: 1299,
    btu: 35000,
    fuel: "natural gas",
    vent: "counterflow top-vent",
    widthIn: 14.25,
    depthIn: 10.5,
    heightIn: 72,
    laborHours: 6.5,
    tier: 3,
    benefits: [
      "Counterflow design delivers warm air at floor level",
      "35k BTU NG — common HD Williams counterflow",
      "Advisor fit: 14¼\" W × 10½\" D × 72\" H class",
    ],
    workScope:
      "1. Confirm counterflow clearances and vent.\n2. Install 3508632; gas and vent.\n3. Commission blower/counterflow and safeties.\n4. Owner orientation.",
  }),

  // Williams direct-vent (through-wall) — NG only, HD-stocked
  wallHeaterProduct({
    id: "prod_wall_wil_14dv",
    sku: "WALL-WIL-1403822",
    name: "Williams Direct-Vent Gravity Wall Heater 14,000 BTU (NG)",
    brand: "Williams",
    model: "1403822",
    hdPrice: 1150,
    btu: 14000,
    fuel: "natural gas",
    vent: "direct-vent through-wall (sealed)",
    widthIn: 18,
    depthIn: 7.125,
    heightIn: 26.75,
    laborHours: 5,
    tier: 10,
    benefits: [
      "Williams sealed direct-vent — outdoor air for combustion",
      "14,000 BTU NG · baths, small rooms, additions",
      "Through-wall vent kit included with unit (no chimney)",
      "HD-stocked gravity direct-vent line",
      "Advisor fit: 18\" W × 7⅛\" D × 26¾\" H",
    ],
    workScope:
      "1. Core exterior wall; confirm thickness for Williams DV kit (1403822).\n" +
      "2. Mount heater; install concentric/direct-vent terminal and seals.\n" +
      "3. Gas connection, leak test, fire and adjust.\n" +
      "4. CO/safety checks; owner orientation.",
  }),
  wallHeaterProduct({
    id: "prod_wall_wil_22dv",
    sku: "WALL-WIL-2203822",
    name: "Williams Direct-Vent Gravity Wall Heater 22,000 BTU (NG)",
    brand: "Williams",
    model: "2203822",
    hdPrice: 1299,
    btu: 22000,
    fuel: "natural gas",
    vent: "direct-vent through-wall (sealed)",
    widthIn: 18,
    depthIn: 7.125,
    heightIn: 26.75,
    laborHours: 5,
    tier: 11,
    benefits: [
      "22,000 BTU NG direct-vent gravity — HD Williams 2203822",
      "~67% AFUE class · heats roughly mid-size rooms",
      "Sealed combustion — no room air for burner",
      "Advisor fit: 18\" W × 7⅛\" D × 26¾\" H class",
    ],
    workScope:
      "1. Locate exterior wall penetration for 2203822.\n" +
      "2. Install heater and direct-vent terminal per Williams.\n" +
      "3. Gas, fire, safety checks; owner orientation.",
  }),
  wallHeaterProduct({
    id: "prod_wall_wil_30dv",
    sku: "WALL-WIL-3003822",
    name: "Williams Direct-Vent Gravity Wall Heater 30,000 BTU (NG)",
    brand: "Williams",
    model: "3003822",
    hdPrice: 1516,
    btu: 30000,
    fuel: "natural gas",
    vent: "direct-vent through-wall (sealed)",
    widthIn: 32.125,
    depthIn: 10.25,
    heightIn: 28,
    laborHours: 5.5,
    tier: 12,
    benefits: [
      "30,000 BTU NG direct-vent — HD/Ferguson-class 3003822",
      "~66% AFUE sealed gravity wall heat",
      "Larger DV cabinet for stronger zone capacity",
      "Advisor fit: 32⅛\" W × 10¼\" D × 28\" H",
    ],
    workScope:
      "1. Confirm wall space and exterior termination for 3003822.\n" +
      "2. Set cabinet; install direct-vent kit; gas per code.\n" +
      "3. Commission; CO/draft checks; owner orientation.",
  }),
  wallHeaterProduct({
    id: "prod_wall_wil_40dv",
    sku: "WALL-WIL-4007732",
    name: "Williams Forsaire 40,000 BTU Counterflow Direct-Vent (NG)",
    brand: "Williams",
    model: "4007732",
    hdPrice: 2199,
    btu: 40000,
    fuel: "natural gas",
    vent: "counterflow direct-vent",
    widthIn: 14.25,
    depthIn: 11.5,
    heightIn: 72,
    laborHours: 7,
    tier: 13,
    benefits: [
      "Williams Forsaire 40k counterflow direct-vent (NG)",
      "~75% AFUE class · warm air delivered at floor level",
      "Sealed combustion for garages / exterior walls",
      "Advisor fit: ~14¼\" W × 11½\" D × 72\" H class",
    ],
    workScope:
      "1. Plan exterior DV termination and gas for 4007732.\n" +
      "2. Set Forsaire counterflow cabinet; install DV kit.\n" +
      "3. Electrical for blower if required; full commission.\n" +
      "4. Owner orientation.",
  }),
  wallHeaterProduct({
    id: "prod_wall_wil_60dv",
    sku: "WALL-WIL-6007732",
    name: "Williams Forsaire 60,000 BTU Counterflow Direct-Vent (NG)",
    brand: "Williams",
    model: "6007732",
    hdPrice: 2699,
    btu: 60000,
    fuel: "natural gas",
    vent: "counterflow direct-vent",
    widthIn: 16,
    depthIn: 12,
    heightIn: 72,
    laborHours: 8,
    tier: 14,
    benefits: [
      "Williams Forsaire 60k counterflow direct-vent (NG)",
      "High capacity sealed DV for larger zones",
      "~76% AFUE class with counterflow blower",
      "Advisor fit: ~16\" W × 12\" D × 72\" H class",
    ],
    workScope:
      "1. Confirm capacity, gas, and exterior vent for 6007732.\n" +
      "2. Install Forsaire; DV kit; blower power.\n" +
      "3. Full startup and safety checks; owner orientation.",
  }),


  p({
    id: "prod_stat_ecobee_premium",
    name: "ecobee Smart Thermostat Premium",
    sku: "CTRL-ECO-PREM",
    category: "Controls · Thermostat",
    description:
      "ecobee Smart Thermostat Premium — room sensor included, air quality monitoring, smart scheduling, Alexa built-in. Professional install & wiring.",
    unitPrice: 549,
    unit: "each",
    materialCost: 249,
    laborHours: 1.25,
    familyId: "thermostat",
    tier: 2,
    tierLabel: "ecobee Premium",
    equipmentKind: "other",
    matchKey: "thermostat",
    benefits: [
      "Smart schedules that learn the home",
      "Room sensor for even comfort",
      "Air quality monitoring on Premium model",
      "App control and voice assistant support",
      "Professional install, wiring, and homeowner training",
    ],
    options: remoteSensorPackOptions("ecobee", true),
    imageUrl: CTRL_PHOTOS.ecobee,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  p({
    id: "prod_stat_ecobee_enhanced",
    name: "ecobee Smart Thermostat Enhanced",
    sku: "CTRL-ECO-ENH",
    category: "Controls · Thermostat",
    description:
      "ecobee Smart Thermostat Enhanced — smart scheduling and app control at a value tier. Professional install.",
    unitPrice: 449,
    unit: "each",
    materialCost: 179,
    laborHours: 1,
    familyId: "thermostat",
    tier: 1,
    tierLabel: "ecobee Enhanced",
    equipmentKind: "other",
    matchKey: "thermostat",
    benefits: [
      "Smart home schedules and energy reports",
      "Smartphone app control",
      "Works with common heat pump and furnace systems",
      "Professional install & wiring",
    ],
    options: remoteSensorPackOptions("ecobee", false),
    imageUrl: CTRL_PHOTOS.ecobee,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  p({
    id: "prod_stat_nest_learning",
    name: "Google Nest Learning Thermostat",
    sku: "CTRL-NEST-LRN",
    category: "Controls · Thermostat",
    description:
      "Google Nest Learning Thermostat — learns preferences, Nest app, works with Google Home. Professional install.",
    unitPrice: 499,
    unit: "each",
    materialCost: 229,
    laborHours: 1.25,
    familyId: "thermostat",
    tier: 2,
    tierLabel: "Nest Learning",
    equipmentKind: "other",
    matchKey: "thermostat",
    benefits: [
      "Learns temperature preferences over time",
      "Nest / Google Home app control",
      "Auto-Schedule and Home/Away Assist",
      "Professional install & wiring",
    ],
    options: remoteSensorPackOptions("nest", false),
    imageUrl: CTRL_PHOTOS.nest,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  p({
    id: "prod_stat_nest_std",
    name: "Google Nest Thermostat",
    sku: "CTRL-NEST-STD",
    category: "Controls · Thermostat",
    description:
      "Google Nest Thermostat — savings features and app control. Professional install.",
    unitPrice: 399,
    unit: "each",
    materialCost: 149,
    laborHours: 1,
    familyId: "thermostat",
    tier: 1,
    tierLabel: "Nest Thermostat",
    equipmentKind: "other",
    matchKey: "thermostat",
    benefits: [
      "Nest app schedules and energy insights",
      "Clean design; easy daily use",
      "Professional install & wiring",
    ],
    options: [],
    imageUrl: CTRL_PHOTOS.nest,
    workScope:
      "1. Remove existing thermostat.\n" +
      "2. Install Nest Thermostat; verify C-wire needs.\n" +
      "3. Set up Nest app.\n" +
      "4. Owner orientation.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  p({
    id: "prod_stat_carrier_infinity",
    name: "Carrier Infinity System Control",
    sku: "CTRL-INF-SYS",
    category: "Controls · Thermostat",
    description:
      "Carrier Infinity System Control — communicating wall control for Infinity equipment, zoning-ready display, full system diagnostics. Best paired with Infinity outdoor/indoor equipment.",
    unitPrice: 895,
    unit: "each",
    materialCost: 420,
    laborHours: 1.5,
    familyId: "thermostat",
    tier: 3,
    tierLabel: "Infinity System Control",
    equipmentKind: "other",
    matchKey: "thermostat",
    benefits: [
      "Designed for Carrier Infinity communicating systems",
      "High-resolution control of stages, humidity, and airflow",
      "System diagnostics for faster service visits",
      "Professional Infinity network wiring and setup",
    ],
    options: [],
    imageUrl: PRODUCT_ART.thermostat,
    workScope:
      "1. Remove existing thermostat / control.\n" +
      "2. Install Infinity System Control on ABCD communicating bus.\n" +
      "3. Commission with outdoor/indoor Infinity equipment.\n" +
      "4. Configure schedules, humidity, and owner preferences.\n" +
      "5. Demonstrate Infinity features to the homeowner.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  p({
    id: "prod_stat_carrier_comfort",
    name: "Carrier Comfort Programmable Thermostat",
    sku: "CTRL-CAR-CMF",
    category: "Controls · Thermostat",
    description:
      "Carrier Comfort programmable thermostat — reliable non-communicating control for Comfort / Performance equipment. Professional install.",
    unitPrice: 325,
    unit: "each",
    materialCost: 95,
    laborHours: 1,
    familyId: "thermostat",
    tier: 1,
    tierLabel: "Carrier Comfort",
    equipmentKind: "other",
    matchKey: "thermostat",
    benefits: [
      "Clear programmable schedules",
      "Compatible with conventional and heat pump systems",
      "Professional install & wiring",
    ],
    options: [],
    imageUrl: PRODUCT_ART.thermostat,
    workScope:
      "1. Remove existing thermostat.\n" +
      "2. Install Carrier Comfort thermostat.\n" +
      "3. Program schedules; train homeowner.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  p({
    id: "prod_install",
    name: "Standard Installation & Startup",
    sku: "SVC-INSTALL",
    category: "Labor",
    description: "Crew labor, haul-away of replaced equipment, startup.",
    unitPrice: 2800,
    unit: "job",
    materialCost: 150,
    laborHours: 8,
    benefits: [
      "Licensed install crew",
      "Haul-away of old equipment",
      "Full startup checklist",
    ],
    options: [],
    imageUrl: PRODUCT_ART.generic,
    workScope:
      "1. Protect floors and work areas.\n2. Remove and haul away replaced equipment.\n3. Install quoted measures.\n4. Startup, safety checks, owner orientation.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  p({
    id: "prod_permit",
    name: "HVAC Permit Acquisition and Processing",
    sku: "SVC-PERMIT",
    category: "Compliance",
    description:
      "Building permits are required for mechanical, electrical, or plumbing work. Acme HVAC pulls the permit and coordinates inspections.",
    unitPrice: 450,
    unit: "job",
    materialCost: 0,
    laborHours: 1,
    familyId: "permits",
    benefits: [
      "Building permits are required for any modifications to a structure, electrical work, plumbing work, or mechanical work per City/County and the Contractors State License Board.",
      "Avoid fines, penalties, or additional costs down the road, including real estate transaction issues.",
      "Stay within required law and city or county codes.",
      "Maintain the homeowner's insurance policy integrity.",
    ],
    options: [],
    imageUrl: PRODUCT_ART.generic,
    workScope:
      "1. Acme HVAC will procure and coordinate required building permits and inspections.\n" +
      "2. Acme HVAC will leave all permit documentation with the homeowner for the inspection visit.\n" +
      "3. Client (or representative) to be present for city/county inspection. Acme HVAC will work with the client to schedule inspection dates. Acme personnel will also stand by for larger projects as needed.\n" +
      "4. SMOKE AND CARBON MONOXIDE ALARMS: To comply with California Code requirements for inspection approval, smoke detectors must be placed in (1) every sleeping room, (2) outside each sleeping area, and (3) on every level of the dwelling. Carbon monoxide (CO) detectors must be installed on every floor of the dwelling.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  p({
    id: "prod_hers",
    name: "State Required Independent HERS Testing of Duct System & AC/Heat Pump",
    sku: "SVC-HERS",
    category: "Compliance",
    description:
      "Title 24 HERS testing required in the Bay Area when ducted HVAC equipment is changed or ducts are altered.",
    unitPrice: 395,
    unit: "job",
    materialCost: 0,
    laborHours: 0.5,
    familyId: "hers",
    benefits: [
      "Effective July 1, 2015, per Title 24, duct testing is now mandatory when HVAC equipment is changed and the ducts are altered. This applies to both residential and commercial applications.",
      "Studies indicate that duct leakage can account for a total of 30% of home energy loss. Even worse than energy loss, leaking ducts pull dust and other harmful irritants into the conditioned space.",
      "For more information, call the energy hotline at the California Energy Commission 1-800-772-3300.",
    ],
    options: [],
    imageUrl: PRODUCT_ART.generic,
    workScope:
      "1. Acme HVAC will promptly schedule the required testing after project completion.\n" +
      "2. Duct Test: This test measures the amount of air leakage in unconditioned areas from the duct system (attic or crawlspace). The HERS rater will need access to all areas of the home that have air vents so they can be properly sealed off for testing.\n" +
      "3. AC/Heat Pump Test: This test measures the performance of your new air conditioning system and verifies that the refrigerant levels meet manufacturer specifications.\n" +
      "4. These tests generally take from 1 to 2 hours to perform.\n" +
      "5. Acme HVAC will provide the HERS rater the detailed HVAC equipment specifications as needed.\n" +
      "6. A compliance certificate will be issued by the California Energy Commission for the finalization of your building permit.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  p({
    id: "prod_wtr_navien",
    name: "Navien NPE-180S2 Tankless Water Heater",
    sku: "WTR-NAV-NPE-180S2",
    category: "Water heating",
    description:
      "Navien NPE-2 condensing tankless, 180 class. ~8.4 GPM at 35°F rise. UEF 0.96. Wall-hung 17.3\" × 13.2\" × 27.4\". Natural gas on this quote.",
    unitPrice: 3499,
    unit: "each",
    materialCost: 1649,
    laborHours: 5,
    familyId: "water_heater",
    matchKey: "wh-npe2",
    tierLabel: "NPE-2 · 180",
    capacityValue: 180,
    installFuel: "gas",
    installPower: "plug_nearby",
    installMount: "wall",
    dimensions: navienNpe2Dims(),
    soundDb: 47,
    benefits: [
      "Endless hot water when sized correctly",
      "UEF 0.96 condensing · ~8.4 GPM at 35°F rise (6.5 GPM at 45°F)",
      "Wall-hung 17.3\" W × 13.2\" D × 27.4\" H · ~47 dBA class",
      "Natural gas on this quote (no LP conversion quoted)",
    ],
    options: [],
    imageUrl: PRODUCT_ART.generic,
    workScope:
      "1. Remove tank or existing heater.\n2. Set Navien NPE-2; gas, water, vent, condensate.\n3. Commission and train owner.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  p({
    id: "prod_wtr_navien_150",
    name: "Navien NPE-150S2 Tankless Water Heater",
    sku: "WTR-NAV-NPE-150S2",
    category: "Water heating",
    description:
      "Navien NPE-2 150 class — compact / 1 bath. ~6.8 GPM at 35°F rise. UEF 0.96. Same 17.3\" × 13.2\" × 27.4\" cabinet. Natural gas on this quote.",
    unitPrice: 3199,
    unit: "each",
    materialCost: 1450,
    laborHours: 5,
    familyId: "water_heater",
    matchKey: "wh-npe2",
    tierLabel: "NPE-2 · 150",
    capacityValue: 150,
    installFuel: "gas",
    installPower: "plug_nearby",
    installMount: "wall",
    dimensions: navienNpe2Dims(),
    soundDb: 47,
    benefits: [
      "Right-sized for smaller demand",
      "UEF 0.96 · ~6.8 GPM at 35°F rise",
      "Wall-hung 17.3\" W × 13.2\" D × 27.4\" H · ~47 dBA class",
      "Natural gas on this quote",
    ],
    options: [],
    imageUrl: PRODUCT_ART.generic,
    workScope:
      "1. Remove existing heater.\n2. Set Navien NPE-150S2; gas, water, vent, condensate.\n3. Commission and train owner.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  p({
    id: "prod_wtr_navien_210",
    name: "Navien NPE-210A2 Tankless Water Heater",
    sku: "WTR-NAV-NPE-210A2",
    category: "Water heating",
    description:
      "Navien NPE-2 210 A2 — recirc-ready. ~10.1 GPM at 35°F rise. UEF 0.96. Same 17.3\" × 13.2\" × 27.4\" cabinet. Natural gas on this quote.",
    unitPrice: 3899,
    unit: "each",
    materialCost: 1899,
    laborHours: 5.5,
    familyId: "water_heater",
    matchKey: "wh-npe2",
    tierLabel: "NPE-2 · 210",
    capacityValue: 210,
    installFuel: "gas",
    installPower: "plug_nearby",
    installMount: "wall",
    dimensions: navienNpe2Dims(),
    soundDb: 47,
    benefits: [
      "Strong multi-bath capacity",
      "A2 built-in recirculation features",
      "UEF 0.96 · ~10.1 GPM at 35°F rise",
      "Wall-hung 17.3\" W × 13.2\" D × 27.4\" H · ~47 dBA class",
      "Natural gas on this quote",
    ],
    options: [],
    imageUrl: PRODUCT_ART.generic,
    workScope:
      "1. Remove existing heater.\n2. Set Navien NPE-210A2; gas, water, vent, condensate, recirc as designed.\n3. Commission and train owner.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  p({
    id: "prod_wtr_navien_240",
    name: "Navien NPE-240A2 Tankless Water Heater",
    sku: "WTR-NAV-NPE-240A2",
    category: "Water heating",
    description:
      "Navien NPE-2 240 A2 — high demand. 11.2 GPM at 35°F rise. UEF 0.95. Same 17.3\" × 13.2\" × 27.4\" cabinet. Natural gas on this quote.",
    unitPrice: 4299,
    unit: "each",
    materialCost: 2099,
    laborHours: 5.5,
    familyId: "water_heater",
    matchKey: "wh-tankless-240",
    tierLabel: "NPE-2 Premium",
    capacityValue: 240,
    installFuel: "gas",
    installPower: "plug_nearby",
    installMount: "wall",
    dimensions: navienNpe2Dims(),
    soundDb: 47,
    benefits: [
      "Top residential flow class",
      "Recirc-ready A2",
      "UEF 0.95 · 11.2 GPM at 35°F rise",
      "Wall-hung 17.3\" W × 13.2\" D × 27.4\" H · ~47 dBA class",
      "Natural gas on this quote",
    ],
    options: [],
    imageUrl: PRODUCT_ART.generic,
    workScope:
      "1. Remove existing heater.\n2. Set Navien NPE-240A2; gas, water, vent, condensate.\n3. Commission and train owner.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  p({
    id: "prod_wtr_gas_40",
    name: "Rheem Performance Gas Water Heater 40 Gal",
    sku: "WTR-RHEEM-G40",
    category: "Water heating",
    description:
      "Atmospheric / power-vent class 40-gallon gas storage. UEF ~0.60. Typical 18\" diameter × 61\" tall. Gravity flue to collar 66¾\".",
    unitPrice: 1899,
    unit: "each",
    materialCost: 720,
    laborHours: 3.5,
    familyId: "water_heater",
    matchKey: "wh-tank-40",
    tierLabel: "Performance",
    capacityValue: 40,
    installFuel: "gas",
    installFootprint: "tank",
    ventStyle: "gravity",
    flueHeightIn: 66.75,
    dimensions: tankWaterHeaterDims(40),
    benefits: [
      "Proven gas storage comfort",
      "UEF ~0.60 · first-hour ~65 gal class",
      "Cabinet ~18\" diameter × 62\" tall · flue 66¾\" to draft hood",
      "Fast recovery vs heat pump",
    ],
    options: [],
    imageUrl: PRODUCT_ART.generic,
    workScope:
      "1. Remove existing tank.\n2. Set 40-gal gas water heater; gas, water, vent, T&P, strap.\n3. Fire and train owner.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  p({
    id: "prod_wtr_gas_50",
    name: "Rheem Performance Gas Water Heater 50 Gal",
    sku: "WTR-RHEEM-G50",
    category: "Water heating",
    description:
      "50-gallon gas storage — common family size. UEF ~0.63. Typical 22\" diameter × 61\" tall. Gravity flue to collar 68½\".",
    unitPrice: 2099,
    unit: "each",
    materialCost: 820,
    laborHours: 3.5,
    familyId: "water_heater",
    matchKey: "wh-tank-50",
    tierLabel: "Performance",
    capacityValue: 50,
    installFuel: "gas",
    installFootprint: "tank",
    ventStyle: "gravity",
    flueHeightIn: 68.5,
    dimensions: tankWaterHeaterDims(50),
    benefits: [
      "Extra first-hour vs 40 gal (~80 gal class)",
      "UEF ~0.63 · gas recovery speed",
      "Cabinet ~22\" diameter × 61\" tall · flue 68½\" to draft hood",
    ],
    options: [],
    imageUrl: PRODUCT_ART.generic,
    workScope:
      "1. Remove existing tank.\n2. Set 50-gal gas water heater; gas, water, vent, T&P, strap.\n3. Fire and train owner.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  p({
    id: "prod_wtr_gas_75",
    name: "75 Gallon Gas Water Heater",
    sku: "WTR-GAS-75",
    category: "Water heating",
    description:
      "75-gallon atmospheric gas storage. UEF ~0.59. Draft hood + Type-B vent. Typical 26\" diameter × 61\" tall.",
    unitPrice: 2499,
    unit: "each",
    materialCost: 980,
    laborHours: 4,
    familyId: "water_heater",
    matchKey: "wh-tank-75",
    tierLabel: "75 gal gas",
    capacityValue: 75,
    installFuel: "gas",
    installFootprint: "tank",
    ventStyle: "gravity",
    flueHeightIn: 70,
    dimensions: tankWaterHeaterDims(75),
    benefits: [
      "Large first-hour for bigger homes",
      "UEF ~0.59 · first-hour ~115 gal class",
      "Gravity B-vent / draft hood",
    ],
    options: [],
    imageUrl: PRODUCT_ART.generic,
    workScope:
      "1. Remove existing tank.\n2. Set 75-gal gas water heater; gas, water, vent, T&P, strap.\n3. Fire and train owner.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  p({
    id: "prod_wtr_gas_he_50",
    name: "High Efficiency 50 Gallon Gas Water Heater",
    sku: "WTR-GAS-HE-50",
    category: "Water heating",
    description:
      "High-efficiency condensing 50-gallon gas tank. PVC vent (same path as tankless). UEF ~0.80. Needs 120V and a condensate drain.",
    unitPrice: 2899,
    unit: "each",
    materialCost: 1180,
    laborHours: 5,
    familyId: "water_heater",
    matchKey: "wh-tank-he-50",
    tierLabel: "HE 50 gal",
    capacityValue: 50,
    installFuel: "gas",
    installPower: "plug_nearby",
    installFootprint: "tank",
    ventStyle: "power_vent",
    dimensions: tankWaterHeaterDims(50),
    benefits: [
      "Condensing high efficiency — PVC vent",
      "UEF ~0.80 class",
      "Lower gas use than a standard tank",
    ],
    options: [],
    imageUrl: PRODUCT_ART.generic,
    workScope:
      "1. Confirm PVC vent path, condensate, and 120V for the high-efficiency tank.\n2. Remove existing tank.\n3. Set HE 50-gal gas water heater; gas, water, PVC vent, condensate, T&P, strap.\n4. Fire and train owner.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  p({
    id: "prod_wtr_gas_he_75",
    name: "High Efficiency 75 Gallon Gas Water Heater",
    sku: "WTR-GAS-HE-75",
    category: "Water heating",
    description:
      "High-efficiency condensing 75-gallon gas tank. PVC vent (same path as tankless). UEF ~0.80. Needs 120V and a condensate drain.",
    unitPrice: 3499,
    unit: "each",
    materialCost: 1520,
    laborHours: 5.5,
    familyId: "water_heater",
    matchKey: "wh-tank-he-75",
    tierLabel: "HE 75 gal",
    capacityValue: 75,
    installFuel: "gas",
    installPower: "plug_nearby",
    installFootprint: "tank",
    ventStyle: "power_vent",
    dimensions: tankWaterHeaterDims(75),
    benefits: [
      "Condensing high efficiency — PVC vent",
      "UEF ~0.80 class · large first-hour",
      "Lower gas use than a standard 75-gal tank",
    ],
    options: [],
    imageUrl: PRODUCT_ART.generic,
    workScope:
      "1. Confirm PVC vent path, condensate, and 120V for the high-efficiency tank.\n2. Remove existing tank.\n3. Set HE 75-gal gas water heater; gas, water, PVC vent, condensate, T&P, strap.\n4. Fire and train owner.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  p({
    id: "prod_wtr_tl_140",
    name: "Navien NPE-150S2 Tankless Water Heater",
    sku: "WTR-TL-140",
    category: "Water heating",
    description:
      "Navien NPE-2 150 class. Compact / 1–1.5 bath. PVC vent. Natural gas on this quote.",
    unitPrice: 2999,
    unit: "each",
    materialCost: 1380,
    laborHours: 5,
    familyId: "water_heater",
    matchKey: "wh-npe2",
    tierLabel: "NPE-2 · 150",
    capacityValue: 150,
    installFuel: "gas",
    installPower: "plug_nearby",
    installMount: "wall",
    dimensions: navienNpe2Dims(),
    benefits: [
      "Navien NPE-150S2 — on-demand when sized correctly",
      "150,000 BTU input class",
      "PVC vent / condensate",
    ],
    options: [],
    imageUrl: PRODUCT_ART.generic,
    workScope:
      "1. Remove existing heater.\n2. Set Navien NPE-150S2; gas, water, PVC vent, condensate.\n3. Commission and train owner.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  p({
    id: "prod_wtr_tl_160",
    name: "Navien NPE-180S2 Tankless Water Heater",
    sku: "WTR-TL-160",
    category: "Water heating",
    description:
      "Navien NPE-2 180 class. Typical 2-bath. PVC vent. Natural gas on this quote.",
    unitPrice: 3299,
    unit: "each",
    materialCost: 1540,
    laborHours: 5,
    familyId: "water_heater",
    matchKey: "wh-npe2",
    tierLabel: "NPE-2 · 180",
    capacityValue: 180,
    installFuel: "gas",
    installPower: "plug_nearby",
    installMount: "wall",
    dimensions: navienNpe2Dims(),
    benefits: [
      "Navien NPE-180S2 — on-demand when sized correctly",
      "180,000 BTU input class",
      "PVC vent / condensate",
    ],
    options: [],
    imageUrl: PRODUCT_ART.generic,
    workScope:
      "1. Remove existing heater.\n2. Set Navien NPE-180S2; gas, water, PVC vent, condensate.\n3. Commission and train owner.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  p({
    id: "prod_wtr_tl_199",
    name: "Navien NPE-240A2 Tankless Water Heater",
    sku: "WTR-TL-199",
    category: "Water heating",
    description:
      "Navien NPE-2 240 A2. High-demand / multi-bath. PVC vent. Natural gas on this quote.",
    unitPrice: 3999,
    unit: "each",
    materialCost: 1980,
    laborHours: 5.5,
    familyId: "water_heater",
    matchKey: "wh-npe2",
    tierLabel: "NPE-2 · 240",
    capacityValue: 240,
    installFuel: "gas",
    installPower: "plug_nearby",
    installMount: "wall",
    dimensions: navienNpe2Dims(),
    benefits: [
      "Navien NPE-240A2 — top residential flow class",
      "199–240k input class",
      "PVC vent / condensate · recirc-ready A2",
    ],
    options: [],
    imageUrl: PRODUCT_ART.generic,
    workScope:
      "1. Remove existing heater.\n2. Set Navien NPE-240A2; gas, water, PVC vent, condensate.\n3. Commission and train owner.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  p({
    id: "prod_wtr_elec_40",
    name: "AO Smith Signature Electric Water Heater 40 Gal",
    sku: "WTR-AOS-E40",
    category: "Water heating",
    description:
      "Electric storage 40 gallon. UEF ~0.92. Typical 18–20\" diameter × 47–49\" tall. No venting.",
    unitPrice: 1499,
    unit: "each",
    materialCost: 490,
    laborHours: 2.75,
    familyId: "water_heater",
    matchKey: "wh-elec-40",
    tierLabel: "Signature",
    capacityValue: 40,
    installFuel: "electric",
    installPower: "dedicated_circuit",
    installFootprint: "tank",
    dimensions: tankWaterHeaterDims(40),
    benefits: [
      "No gas venting",
      "UEF ~0.92 · first-hour ~40–45 gal class",
      "Smaller cabinet for tight closets",
    ],
    options: [],
    imageUrl: PRODUCT_ART.generic,
    workScope:
      "1. Remove existing tank.\n2. Set electric 40-gal; water, electrical, T&P, strap.\n3. Energize and train owner.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  p({
    id: "prod_wtr_elec_50",
    name: "AO Smith Signature Electric Water Heater 50 Gal",
    sku: "WTR-AOS-E50",
    category: "Water heating",
    description:
      "Electric storage 50 gallon. UEF ~0.93. Typical 22\" diameter × 61\" tall. No venting.",
    unitPrice: 1699,
    unit: "each",
    materialCost: 580,
    laborHours: 3,
    familyId: "water_heater",
    matchKey: "wh-elec-50",
    tierLabel: "Signature",
    capacityValue: 50,
    installFuel: "electric",
    installPower: "dedicated_circuit",
    installFootprint: "tank",
    dimensions: tankWaterHeaterDims(50),
    benefits: [
      "No gas venting",
      "UEF ~0.93 · first-hour ~50–55 gal class",
      "Cabinet ~22\" diameter × 61\" tall",
    ],
    options: [],
    imageUrl: PRODUCT_ART.generic,
    workScope:
      "1. Remove existing tank.\n2. Set electric 50-gal; water, electrical, T&P, strap.\n3. Energize and train owner.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  p({
    id: "prod_wtr_elec_80",
    name: "AO Smith Signature Electric Water Heater 80 Gal",
    sku: "WTR-AOS-E80",
    category: "Water heating",
    description:
      "Electric storage 80 gallon. UEF ~0.93. Typical 26.5\" diameter × 61\" tall.",
    unitPrice: 2199,
    unit: "each",
    materialCost: 890,
    laborHours: 3.5,
    familyId: "water_heater",
    matchKey: "wh-elec-80",
    tierLabel: "Signature",
    capacityValue: 80,
    installFuel: "electric",
    installPower: "dedicated_circuit",
    installFootprint: "tank",
    dimensions: tankWaterHeaterDims(75),
    benefits: [
      "High storage for electric-only homes",
      "UEF ~0.93 · first-hour ~80 gal class",
      "Cabinet ~26½\" diameter × 61\" tall",
    ],
    options: [],
    imageUrl: PRODUCT_ART.generic,
    workScope:
      "1. Remove existing tank.\n2. Set electric 80-gal; water, electrical, T&P, strap.\n3. Energize and train owner.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
  p({
    id: "prod_maint",
    name: "Acme HVAC Comfort Club Membership (annual)",
    sku: "SVC-CLUB",
    category: "Maintenance",
    description: "Priority service and seasonal tune-ups.",
    unitPrice: 288,
    unit: "year",
    materialCost: 40,
    laborHours: 1.5,
    benefits: [
      "Two seasonal visits",
      "Priority scheduling",
      "Member repair discounts",
    ],
    options: [],
    imageUrl: PRODUCT_ART.generic,
    workScope:
      "1. Enroll homeowner.\n2. Schedule first visit.\n3. Document equipment baseline.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }),
];
