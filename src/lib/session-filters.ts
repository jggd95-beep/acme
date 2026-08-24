/**
 * Session UX filters ported into MASTER (2026-08-10).
 * Per-measure size chips, brand multi-select, water heater style path.
 */
import type { Product } from "@/lib/proposal-types";
import {
  extractBtuFromProduct,
  extractGallonsFromProduct,
  metricForFamily,
  type CapacityMetric,
} from "@/lib/capacity-filter";
import type { MeasureFamilyId } from "@/lib/quote-wizard";

export type WaterHeaterStyleFilter =
  | "gas-tank"
  | "he-gas"
  | "electric-tank"
  | "hybrid"
  | "tankless"
  | "sanden-split"
  | null;

export const WH_STYLE_OPTIONS: {
  id: NonNullable<WaterHeaterStyleFilter>;
  label: string;
  blurb: string;
  img: string;
}[] = [
  {
    id: "gas-tank",
    label: "Gas tank",
    blurb: "Draft hood · B-vent",
    img: "/path-art/wh-gas-tank.svg",
  },
  {
    id: "he-gas",
    label: "High-eff gas",
    blurb: "PVC flue · 120V",
    img: "/path-art/wh-he-gas.svg",
  },
  {
    id: "electric-tank",
    label: "Electric tank",
    blurb: "Plug-in storage",
    img: "/path-art/wh-electric-tank.svg",
  },
  {
    id: "hybrid",
    label: "Heat pump",
    blurb: "240V hybrid tank",
    img: "/path-art/wh-hybrid.svg",
  },
  {
    id: "sanden-split",
    label: "Sanden split",
    blurb: "Outdoor unit + tank",
    img: "/path-art/wh-sanden-split.svg",
  },
  {
    id: "tankless",
    label: "Tankless",
    blurb: "On-demand · gas",
    img: "/path-art/wh-tankless.svg",
  },
];

export const HUM_KIND_OPTIONS: {
  id: "flow" | "steam" | "both";
  label: string;
  blurb: string;
  img: string;
}[] = [
  {
    id: "flow",
    label: "Flow-through",
    blurb: "Bypass or powered pad",
    img: "/picker-art/hum-flow.svg",
  },
  {
    id: "steam",
    label: "Steam",
    blurb: "TrueSTEAM — own path",
    img: "/picker-art/hum-steam.svg",
  },
  {
    id: "both",
    label: "Both as options",
    blurb: "Flow-through + steam quotes",
    img: "/picker-art/hum-both.svg",
  },
];

export function detectHumidifierKind(
  p: Pick<Product, "sku" | "name">,
): "flow" | "steam" | null {
  const blob = `${p.sku || ""} ${p.name || ""}`;
  if (/HM5|trusteam|true.?steam/i.test(blob)) return "steam";
  if (/HE240|HE360|bypass|flow-through|powered humid/i.test(blob)) return "flow";
  return null;
}

export function detectWaterHeaterStyle(
  p: Pick<
    Product,
    | "name"
    | "tierLabel"
    | "description"
    | "sku"
    | "category"
    | "familyId"
    | "installFootprint"
    | "ventStyle"
    | "installFuel"
  >,
): NonNullable<WaterHeaterStyleFilter> | null {
  const blob =
    `${p.name} ${p.tierLabel || ""} ${p.description || ""} ${p.sku || ""} ${p.category || ""} ${p.familyId || ""}`.toLowerCase();
  const isWh =
    p.familyId === "water_heater" ||
    p.familyId === "aos-gas-tank" ||
    p.familyId === "aos-hpwh" ||
    p.familyId === "hpwh" ||
    p.installFootprint === "tank" ||
    p.installFootprint === "hpwh" ||
    /water.?heat|tankless|hpwh|hot water|npe-|voltex|proline/i.test(blob) ||
    /^(WTR-|AOS-)/i.test(p.sku || "");
  if (!isWh) return null;
  if (isExcludedWaterHeaterProduct(p)) return null;
  if (/what to expect|expectation|education/i.test(blob)) return null;

  if (
    /tankless|on-?demand|rtgh|npe-|noritz/i.test(blob) ||
    (/navien/.test(blob) &&
      /water|tankless|npe-/.test(blob) &&
      !/heat pump|air handler|furnace|naz|nas|npf|h2air|boiler/.test(blob))
  ) {
    return "tankless";
  }
  if (
    /sanden|sanco2|san-co2/i.test(`${p.name} ${p.sku || ""} ${p.category || ""}`) ||
    /^SAN-/i.test(p.sku || "") ||
    /eco-43ss|eco-83ss|san-119/i.test(`${p.sku || ""} ${p.name}`)
  ) {
    return "sanden-split";
  }
  if (
    p.installFootprint === "hpwh" ||
    /hybrid|heat pump water|hpwh|aero.?therm|premier.?hybrid|voltex/i.test(blob) ||
    (/heat pump/.test(blob) && /water/.test(blob))
  ) {
    return "hybrid";
  }
  if (
    p.ventStyle === "power_vent" ||
    /WTR-GAS-HE|AOS-HE-/i.test(p.sku || "") ||
    (/condensing|high[ -]?efficienc|power.?vent|pvc vent/i.test(blob) &&
      /gas|ng\b|natural gas/i.test(blob))
  ) {
    if (!/tankless|npe-/.test(blob)) return "he-gas";
  }
  if (
    (p.installFuel === "electric" ||
      (/electric|e-?series|marathon/i.test(blob) &&
        !/gas|ng\b|propane|lp\b/i.test(blob))) &&
    !/heat pump|hpwh|hybrid/i.test(blob)
  ) {
    return "electric-tank";
  }
  if (/gas|ng\b|propane|lp\b|natural gas|atmospheric|gravity/i.test(blob)) {
    return "gas-tank";
  }
  if (/electric/i.test(blob)) return "electric-tank";
  return "gas-tank";
}

/** Salesforce list: no Sanden, no 120V / 110V heat-pump tanks. */
export function isExcludedWaterHeaterProduct(
  p: Pick<Product, "name" | "sku" | "description" | "tierLabel" | "category">,
): boolean {
  const blob =
    `${p.name} ${p.sku || ""} ${p.description || ""} ${p.tierLabel || ""} ${p.category || ""}`.toLowerCase();
  // "Not Sanden" / "Not 120V" in catalog copy must not exclude the unit.
  if (
    /sanden|sanhem|sanhein|co2 heat pump|co₂|sanco2/i.test(blob) &&
    !/not\s+sanden|no\s+sanden|exclude.{0,24}sanden/i.test(blob)
  ) {
    return false;
  }
  if (
    /(120\s*v|110\s*v|120-volt|110-volt)/i.test(blob) &&
    /heat.?pump|hpwh|hybrid/i.test(blob) &&
    !/not\s*120|no\s*120|not\s*110|exclude.{0,24}120/i.test(blob)
  ) {
    return true;
  }
  return false;
}

/** How this water heater vents — seeds PVC vs B-vent vs none. */
export function detectWhVentKind(
  p?: Pick<
    Product,
    | "name"
    | "tierLabel"
    | "description"
    | "sku"
    | "category"
    | "familyId"
    | "installFootprint"
    | "ventStyle"
    | "benefits"
  > | null,
  style?: WaterHeaterStyleFilter | string | null,
): "pvc" | "bvent" | "none" {
  const s = style || (p ? detectWaterHeaterStyle(p) : null);
  if (s === "tankless" || s === "he-gas") return "pvc";
  if (s === "hybrid" || s === "electric-tank" || s === "sanden-split") return "none";
  if (s !== "gas-tank") return "none";
  if (!p) return "bvent";
  if (p.ventStyle === "power_vent" || p.ventStyle === "direct_vent") return "pvc";
  if (p.ventStyle === "gravity") return "bvent";
  const blob =
    `${p.name} ${p.tierLabel || ""} ${p.description || ""} ${p.sku || ""} ${(p.benefits || []).join(" ")}`.toLowerCase();
  if (
    /condensing|high.?efficien|hi-?e\b|power.?vent|direct.?vent|pvc vent|uef\s*0\.[89]/i.test(
      blob,
    )
  ) {
    return "pvc";
  }
  return "bvent";
}

const KNOWN_BRANDS = [
  "A. O. Smith",
  "A.O. Smith",
  "AO Smith",
  "Bradford White",
  "American Standard",
  "AprilAire",
  "Mitsubishi",
  "Honeywell",
  "ChargePoint",
  "Northridge",
  "Williams",
  "Carrier",
  "Bryant",
  "Bosch",
  "Daikin",
  "Trane",
  "Lennox",
  "Rheem",
  "Ruud",
  "Navien",
  "Rinnai",
  "Noritz",
  "Stiebel",
  "Eemax",
  "State",
  "Cozy",
  "IQAir",
  "Panasonic",
  "Broan",
  "NuTone",
  "Werner",
  "Generac",
  "Goodman",
];

const BRAND_ALIASES: [RegExp, string][] = [
  [/a\.?\s*o\.?\s*smith/i, "A. O. Smith"],
  [/bradford\s*white/i, "Bradford White"],
  [/american\s*standard/i, "American Standard"],
  [/april\s*aire|aprilaire/i, "AprilAire"],
  [/iq\s*air|iqair/i, "IQAir"],
  [/nu\s*tone|nutone/i, "NuTone"],
  [/charge\s*point/i, "ChargePoint"],
];

/** One display name. Drops junk like “A.” from “A. O. Smith”. */
export function canonicalizeBrand(raw: string): string {
  const s = (raw || "").trim();
  if (!s) return "";
  for (const [re, name] of BRAND_ALIASES) {
    if (re.test(s)) return name;
  }
  if (s.length <= 2 || /^[A-Za-z]\.$/.test(s) || /^the$/i.test(s)) return "";
  return s;
}

export function productBrand(p: Product): string {
  const any = p as Product & { brand?: string; manufacturer?: string };
  const explicit = canonicalizeBrand(any.brand || any.manufacturer || "");
  if (explicit) return explicit;
  const name = `${p.name || ""} ${p.sku || ""} ${p.tierLabel || ""}`.trim();
  for (const b of KNOWN_BRANDS) {
    if (b.toLowerCase() === "state" && /^state\s+required\b/i.test(name)) {
      continue;
    }
    if (name.toLowerCase().startsWith(b.toLowerCase())) {
      return canonicalizeBrand(b) || b;
    }
    const escaped = b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\b`, "i").test(name)) {
      if (b.toLowerCase() === "state" && /^state\s+required\b/i.test(name)) {
        continue;
      }
      return canonicalizeBrand(b) || b;
    }
  }
  return canonicalizeBrand(name.split(/\s+/)[0] || "") || "Other";
}

/** Nominal capacity number for filtering (tons, BTU, or gallons) */
export function productCapacityValue(
  p: Product,
  metric: CapacityMetric | null,
  waterHeaterStyle?: string | null,
): number | null {
  if (p.capacityValue != null && Number.isFinite(p.capacityValue) && p.capacityValue > 0) {
    return p.capacityValue;
  }
  // Tankless manufacturer class from name/SKU (150/180/210/240)
  if (
    waterHeaterStyle === "tankless" ||
    detectWaterHeaterStyle(p) === "tankless"
  ) {
    const blob = `${p.name} ${p.sku || ""} ${p.description || ""}`;
    const cls = blob.match(/\b(140|150|160|180|199|210|240)\b/);
    if (cls) {
      const n = parseInt(cls[1], 10);
      if (n === 140) return 150;
      if (n === 160) return 160;
      if (n === 199) return 199;
      return n;
    }
    // generic tankless without class — never hide solely on size
    return null;
  }
  if (!metric) return null;
  if (metric === "tons") {
    const blob = `${p.name} ${p.tierLabel || ""} ${p.sku || ""}`;
    const ton = blob.match(/(\d+(?:\.\d+)?)\s*-?\s*ton\b/i);
    if (ton) return parseFloat(ton[1]);
    const k = blob.match(/\b(\d{2,3})\s*k\b/i);
    if (k) {
      const btu = parseInt(k[1], 10) * 1000;
      return Math.round((btu / 12000) * 2) / 2;
    }
    const btu = extractBtuFromProduct(p);
    if (btu) return Math.round((btu / 12000) * 2) / 2;
    return null;
  }
  if (metric === "btu") return extractBtuFromProduct(p);
  if (metric === "gallons") {
    const g = extractGallonsFromProduct(p);
    if (g != null) return g;
    return null;
  }
  return null;
}

export function snapCapacityChip(
  metric: CapacityMetric | null,
  n: number,
): number {
  if (!Number.isFinite(n) || n <= 0) return n;
  if (metric === "tons") return Math.round(n * 2) / 2;
  if (metric === "btu") return Math.round(n / 1000) * 1000;
  return Math.round(n);
}

/** Only sizes that actually exist on this product pool. */
export function sizeChipsFromProducts(
  products: Product[],
  metric: CapacityMetric | null,
  waterHeaterStyle?: string | null,
): number[] {
  if (!metric) return [];
  const found = new Set<number>();
  for (const p of products) {
    const cap = productCapacityValue(p, metric, waterHeaterStyle);
    if (cap == null || !Number.isFinite(cap) || cap <= 0) continue;
    found.add(snapCapacityChip(metric, cap));
  }
  return [...found].sort((a, b) => a - b);
}

export function capacityMatchesSelection(
  productValue: number | null,
  selected: number[] | undefined,
  metric: CapacityMetric | null,
  waterHeaterStyle?: string | null,
): boolean {
  if (!selected || selected.length === 0) return true;
  // Unknown size products still show when filter is on (avoid empty lists)
  if (productValue == null) return true;
  for (const s of selected) {
    if (waterHeaterStyle === "tankless") {
      if (productValue === s) return true;
      continue;
    }
    if (metric === "tons") {
      if (Math.abs(productValue - s) < 0.26) return true;
    } else if (metric === "btu") {
      if (Math.abs(productValue - s) <= Math.max(2000, s * 0.12)) return true;
    } else if (metric === "gallons") {
      if (Math.abs(productValue - s) <= 5) return true;
    }
  }
  return false;
}

export function filterProductsSessionStyle(
  products: Product[],
  opts: {
    familyId: MeasureFamilyId;
    selectedCapacities?: number[];
    selectedBrands?: string[];
    allBrandsInSize?: boolean;
    waterHeaterStyle?: string | null;
    hpInstallPath?: string | null;
    wallVentStyle?: string | null;
    furnaceEffStyle?: string | null;
    furnaceCabinetStyle?: string | null;
    forceIncludeProductId?: string | null;
  },
): Product[] {
  const metric = metricForFamily(opts.familyId);
  return products.filter((p) => {
    if (opts.forceIncludeProductId && p.id === opts.forceIncludeProductId) {
      return true;
    }
    if (opts.familyId === "water_heater" && opts.waterHeaterStyle) {
      const want = String(opts.waterHeaterStyle).replace(/_/g, "-");
      const got = String(detectWaterHeaterStyle(p) || "").replace(/_/g, "-");
      if (got !== want) return false;
      if (isExcludedWaterHeaterProduct(p)) return false;
    }
    if (
      (opts.familyId === "heat_pump" ||
        opts.familyId === "air_handler" ||
        opts.familyId === "ac") &&
      opts.hpInstallPath
    ) {
      if (!matchesHpInstallPath(p, opts.hpInstallPath)) return false;
    }
    if (opts.familyId === "wall_heater" && opts.wallVentStyle) {
      if (detectWallVentStyle(p) !== opts.wallVentStyle) return false;
    }
    if (opts.familyId === "furnace" && opts.furnaceEffStyle) {
      if (detectFurnaceEffStyle(p) !== opts.furnaceEffStyle) return false;
    }
    if (opts.familyId === "furnace" && opts.furnaceCabinetStyle) {
      if (isNavienNpfProduct(p)) {
        if (
          !npfMatchesCabinet(
            p,
            opts.furnaceCabinetStyle as FurnaceCabinetStyle,
          )
        ) {
          return false;
        }
      } else if (/navien/i.test(`${p.name} ${p.sku || ""}`)) {
        // Other Navien heat (NHB) is not an NPF cabinet pick
        return false;
      }
    }
    // Hide NPF boxes until Navien path + cabinet are chosen
    if (
      opts.familyId === "furnace" &&
      isNavienNpfProduct(p) &&
      (opts.furnaceEffStyle !== "navien_npf" || !opts.furnaceCabinetStyle)
    ) {
      return false;
    }
    const cap = productCapacityValue(p, metric, opts.waterHeaterStyle);
    if (
      opts.selectedCapacities &&
      opts.selectedCapacities.length > 0 &&
      !capacityMatchesSelection(
        cap,
        opts.selectedCapacities,
        metric,
        opts.waterHeaterStyle,
      )
    ) {
      return false;
    }
    const brands = opts.selectedBrands || [];
    if (brands.length > 0) {
      const b = productBrand(p);
      const wanted = brands.map(canonicalizeBrand).filter(Boolean);
      if (
        wanted.length > 0 &&
        !wanted.some((x) => x.toLowerCase() === b.toLowerCase())
      ) {
        return false;
      }
    }
    return true;
  });
}

export function brandsInPool(products: Product[]): string[] {
  const set = new Set<string>();
  for (const p of products) {
    const b = canonicalizeBrand(productBrand(p));
    if (b && b !== "Other") set.add(b);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/** Client-facing title: prefer tier / line over raw SKU-heavy name when possible */
export function clientFacingProductTitle(p: Product): {
  line: string | null;
  title: string;
  model: string | null;
} {
  const line = p.tierLabel || null;
  const title = p.name;
  const model = p.sku || null;
  return { line, title, model };
}


export type HpInstallPath = "conventional" | "mini-split";

/** Outdoor-powered indoor (Mitsubishi / mini-split interconnect) — not 24V Infinity. */
export function isOutdoorPoweredIndoorProduct(p: Product): boolean {
  if (p.equipmentKind === "ductless") return true;
  const blob =
    `${p.name} ${p.sku || ""} ${p.tierLabel || ""} ${p.category || ""}`.toLowerCase();
  return /mini.?split|ductless|multi.?zone|hyper.?heat|m.?series|mxz|msz|mitsubishi|interconnect|s1.?s2.?s3/.test(
    blob,
  );
}

export function matchesHpInstallPath(
  p: Product,
  path: string | null | undefined,
): boolean {
  if (!path) return true;
  const outdoorPowered = isOutdoorPoweredIndoorProduct(p);
  if (path === "mini-split" || path === "interconnect" || path === "mini")
    return outdoorPowered;
  if (path === "conventional" || path === "24v" || path === "24V")
    return !outdoorPowered;
  return !outdoorPowered;
}

export function estimateMcaMocp(p: Product, tonnage = 3): { mca: number; mocp: number } | null {
  const kind = p.equipmentKind;
  if (kind !== "heat_pump" && kind !== "ac" && kind !== "ductless") return null;
  const t = Math.max(1.5, tonnage || 3);
  // Rough demo electricals by tonnage/tier
  const base = 12 + t * 4.2 + ((p.tier || 1) - 1) * 1.5;
  const mca = Math.round(base * 10) / 10;
  const mocp = Math.ceil(mca * 1.25 / 5) * 5;
  return { mca, mocp };
}

export const DEFAULT_DOC_REQUESTS: { id: string; label: string; requested: boolean }[] = [
  { id: "proposal-packet", label: "Proposal packet", requested: true },
  { id: "submittals", label: "Equipment submittals", requested: false },
  { id: "install-manuals", label: "Install manuals", requested: false },
  { id: "warranty-docs", label: "Warranty documents", requested: false },
  { id: "rebate-forms", label: "Rebate forms", requested: false },
];

export function defaultMeasureLanguage(
  familyId: string,
  label: string,
  placement?: string | null,
): string {
  if (familyId === "conversion_guide" || familyId === "hpwh_guide" || familyId === "load_calc") {
    return (
      "INFORMATION — no charge.\n\n" +
      "This section is provided for customer awareness and does not add " +
      "equipment or labor dollars to the investment total.\n\n" +
      "[Edit this language for the homeowner.]"
    );
  }
  const place = (placement || "").trim();
  return (
    `SCOPE — ${label}\n\n` +
    "Furnish and install equipment as selected on this measure, including " +
    "standard startup and homeowner orientation.\n\n" +
    (place
      ? `Install location (as sold): ${place}.\n\n`
      : "Placement: see measure placement on this proposal.\n\n") +
    "[Edit installation notes, exclusions, and customer commitments here.]"
  );
}


export type WallVentStyle = "top_vent" | "direct_vent" | "counterflow" | "rinnai";

export const WALL_VENT_OPTIONS: {
  id: WallVentStyle;
  label: string;
  blurb: string;
  img: string;
}[] = [
  {
    id: "top_vent",
    label: "Top vent",
    blurb: "Through the roof",
    img: "/product-photos/wall-williams-monterey.png",
  },
  {
    id: "direct_vent",
    label: "Direct vent",
    blurb: "Through the wall",
    img: "/product-photos/wall-williams-directvent.png",
  },
  {
    id: "counterflow",
    label: "Counterflow",
    blurb: "Downflow cabinet",
    img: "/product-photos/wall-williams-forsaire.png",
  },
  {
    id: "rinnai",
    label: "Rinnai",
    blurb: "Sealed · 120V",
    img: "/product-photos/wall-rinnai-ex.png",
  },
];

export function detectWallVentStyle(
  p: Pick<Product, "name" | "sku" | "tierLabel" | "description">,
): WallVentStyle {
  const blob = `${p.name} ${p.sku || ""} ${p.tierLabel || ""} ${p.description || ""}`.toLowerCase();
  if (/rinnai|energysaver|wall-rin|ex11|ex17|ex22|ex38/i.test(blob)) {
    return "rinnai";
  }
  if (/counterflow|forsaire/i.test(blob)) return "counterflow";
  if (/direct.?vent|sealed/i.test(blob)) return "direct_vent";
  return "top_vent";
}

function productBlob(p: Pick<Product, "name" | "sku" | "tierLabel" | "description" | "benefits">) {
  return `${p.name} ${p.sku || ""} ${p.tierLabel || ""} ${p.description || ""} ${(p.benefits || []).join(" ")}`;
}

/** Two-room Monterey 50k — not a same-cabinet swap from 25/35. */
export function isDualSidedWallHeater(
  p: Pick<Product, "name" | "sku" | "description" | "benefits">,
): boolean {
  const blob = productBlob(p).toLowerCase();
  return (
    /5009622/.test(p.sku || "") ||
    /double.?sided|2.?sided|two.?sided|dual.?wall|heats 2 adjacent/i.test(blob)
  );
}

/**
 * Same install box — option the next size, don't invent a new path.
 * 25↔35 Monterey yes. 50k dual-sided no. Navien NPE-2 180↔210 yes.
 */
export function sameInstallFoundation(a: Product, b: Product): boolean {
  if (!a || !b || a.id === b.id) return false;
  if ((a.sku || "") && a.sku === b.sku) return false;
  const ba = productBrand(a).toLowerCase();
  const bb = productBrand(b).toLowerCase();
  if (ba && bb && ba !== bb) return false;
  if (isDualSidedWallHeater(a) !== isDualSidedWallHeater(b)) return false;
  const wa = detectWaterHeaterStyle(a);
  const wb = detectWaterHeaterStyle(b);
  if (wa && wb && wa !== wb) return false;
  const wallA =
    a.familyId === "wall_heater" ||
    a.installFootprint === "wall_heater" ||
    /wall.?heater|wall furnace|monterey|forsaire|cozy|energysaver/i.test(
      productBlob(a),
    );
  const wallB =
    b.familyId === "wall_heater" ||
    b.installFootprint === "wall_heater" ||
    /wall.?heater|wall furnace|monterey|forsaire|cozy|energysaver/i.test(
      productBlob(b),
    );
  if (wallA && wallB && detectWallVentStyle(a) !== detectWallVentStyle(b)) {
    return false;
  }
  const da = a.dimensions;
  const db = b.dimensions;
  if (!da || !db) return false;
  const inch = (x?: number, y?: number) => Math.abs((x || 0) - (y || 0)) <= 1.05;
  return (
    inch(da.widthIn, db.widthIn) &&
    inch(da.depthIn, db.depthIn) &&
    inch(da.heightIn, db.heightIn)
  );
}

/** Standard sizes for a path, then only sizes that actually exist in catalog. */
export const WALL_HEATER_PATH_SIZES: Record<WallVentStyle, number[]> = {
  top_vent: [25000, 35000, 50000],
  direct_vent: [14000, 22000, 30000],
  counterflow: [35000, 40000, 60000],
  rinnai: [11000, 16700, 21500, 38400],
};

export function wallHeaterSizeChips(
  products: Product[],
  style: WallVentStyle,
): number[] {
  const found = new Set<number>();
  for (const p of products) {
    const blob = `${p.name} ${p.sku || ""} ${p.category || ""} ${p.tierLabel || ""}`.toLowerCase();
    const isWall =
      p.familyId === "wall_heater" ||
      p.installFootprint === "wall_heater" ||
      /wall.?heater|wall furnace|monterey|forsaire|cozy|energysaver/i.test(
        blob,
      );
    if (!isWall) continue;
    if (detectWallVentStyle(p) !== style) continue;
    const btu = extractBtuFromProduct(p);
    if (btu && btu >= 10000 && btu <= 80000) found.add(btu);
  }
  const list = [...found].sort((a, b) => a - b);
  return list.length ? list : WALL_HEATER_PATH_SIZES[style];
}


/** Furnace efficiency / emissions path (like HP system style / WH type). */
export type FurnaceEffStyle =
  | "standard_80"
  | "high_eff"
  | "uln_80"
  | "uln_high"
  | "navien_npf";

export const FURNACE_EFF_OPTIONS: {
  id: FurnaceEffStyle;
  label: string;
  blurb: string;
}[] = [
  {
    id: "standard_80",
    label: "Standard 80%",
    blurb: "Mid-efficiency ~80% AFUE — common B-vent / metal flue path.",
  },
  {
    id: "high_eff",
    label: "High efficiency (90%+)",
    blurb: "Condensing furnace — PVC vent, highest AFUE class.",
  },
  {
    id: "uln_80",
    label: "Ultra-Low NOx 80%",
    blurb: "CA Ultra-Low NOx mid-efficiency — emissions-compliant 80% path.",
  },
  {
    id: "uln_high",
    label: "Ultra-Low NOx high efficiency",
    blurb: "CA Ultra-Low NOx + condensing 90%+ — premium compliant path.",
  },
  {
    id: "navien_npf",
    label: "Navien NPF",
    blurb: "Hydronic NPF — pick cabinet orientation, then model.",
  },
];

export function detectFurnaceEffStyle(
  p: Pick<Product, "name" | "sku" | "tierLabel" | "description" | "benefits" | "familyId">,
): FurnaceEffStyle {
  if (isNavienNpfProduct(p)) return "navien_npf";
  const blob = `${p.name} ${p.sku || ""} ${p.tierLabel || ""} ${p.description || ""} ${(p.benefits || []).join(" ")}`.toLowerCase();
  const uln = /ultra.?low.?nox|uln|low.?nox|ca.?uln|ulln/i.test(blob);
  const high =
    /9[0-9]\s*%|afue\s*9|condensing|96%|95%|92%|97%|98%|high.?efficien/i.test(
      blob,
    ) && !/80\s*%\s*afue|80% afue|80afue|comfort.?80|performance.?80/i.test(blob);
  // Explicit 80% high path vs condensing
  const is80 = /80\s*%|80afue|58sb|58tp|58tn|mid.?efficien/i.test(blob) && !high;
  if (uln && high) return "uln_high";
  if (uln) return "uln_80";
  if (high) return "high_eff";
  return "standard_80";
}

/** Navien NPF cabinet — not convertible like Carrier. */
export type FurnaceCabinetStyle =
  | "upflow"
  | "downflow"
  | "horizontal_left"
  | "horizontal_right";

export const FURNACE_CABINET_OPTIONS: {
  id: FurnaceCabinetStyle;
  label: string;
  blurb: string;
  img: string;
}[] = [
  {
    id: "upflow",
    label: "Upflow",
    blurb: "Air out the top",
    img: "/furnace-orient/upflow.svg",
  },
  {
    id: "downflow",
    label: "Downflow",
    blurb: "Air out the bottom",
    img: "/furnace-orient/downflow.svg",
  },
  {
    id: "horizontal_left",
    label: "Horizontal left",
    blurb: "Lies on its side · left",
    img: "/furnace-orient/horizontal-left.svg",
  },
  {
    id: "horizontal_right",
    label: "Horizontal right",
    blurb: "Lies on its side · right",
    img: "/furnace-orient/horizontal-right.svg",
  },
];

export function isNavienNpfProduct(
  p: Pick<Product, "name" | "sku" | "familyId">,
): boolean {
  const sku = (p.sku || "").toUpperCase();
  return (
    /^NAV-NPF/i.test(sku) ||
    /NPF700/i.test(sku) ||
    p.familyId === "navien-npf" ||
    /navien.*npf|npf furnace/i.test(p.name || "")
  );
}

/** U / D / H from Navien model. Left/right share the H box. */
export function detectNpfCabinet(
  p: Pick<Product, "name" | "sku" | "tierLabel" | "description">,
): "upflow" | "downflow" | "horizontal" {
  const blob = `${p.name} ${p.sku || ""} ${p.tierLabel || ""} ${p.description || ""}`.toUpperCase();
  if (/DOWNFLOW|D3BH|D5CH|NPF-\d+D\b|NPF700-\d+D/.test(blob)) return "downflow";
  if (/HORIZONTAL|H3BH|H5CH|NPF-\d+H\b|NPF700-\d+H/.test(blob))
    return "horizontal";
  return "upflow";
}

export function npfMatchesCabinet(
  p: Pick<Product, "name" | "sku" | "tierLabel" | "description">,
  style: FurnaceCabinetStyle | null | undefined,
): boolean {
  if (!style) return true;
  const cab = detectNpfCabinet(p);
  if (style === "upflow") return cab === "upflow";
  if (style === "downflow") return cab === "downflow";
  return cab === "horizontal";
}

/** Sizes that actually exist for this furnace path + cabinet. */
export function furnaceSizeChips(
  products: Product[],
  opts: {
    furnaceEffStyle?: string | null;
    furnaceCabinetStyle?: string | null;
  },
): number[] {
  const pool = filterProductsSessionStyle(products, {
    familyId: "furnace",
    furnaceEffStyle: opts.furnaceEffStyle,
    furnaceCabinetStyle: opts.furnaceCabinetStyle,
    selectedCapacities: [],
    allBrandsInSize: true,
  });
  const found = new Set<number>();
  for (const p of pool) {
    const btu = extractBtuFromProduct(p);
    if (btu && btu >= 20000 && btu <= 200000) found.add(btu);
  }
  return [...found].sort((a, b) => a - b);
}
