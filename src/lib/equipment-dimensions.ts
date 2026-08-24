/**
 * Major equipment dimensions — inches only, snapped to ¼".
 * No millimeters. Uniform fractional inch display for sales + packet.
 */

export type EquipmentDimensions = {
  /** Width (left–right), inches */
  widthIn: number;
  /** Depth (front–back), inches */
  depthIn: number;
  /** Height (floor–top), inches */
  heightIn: number;
};

/** Major equipment that should carry W×D×H on quotes. */
export const DIMENSION_EQUIPMENT_KINDS = [
  "furnace",
  "heat_pump",
  "air_handler",
  "ac",
  "water_heater",
] as const;

export function isMajorEquipmentKind(
  kind: string | null | undefined,
): boolean {
  return (
    kind === "furnace" ||
    kind === "heat_pump" ||
    kind === "air_handler" ||
    kind === "ac" ||
    kind === "ductless"
  );
}

/** Snap to nearest ¼ inch (uniform stock sizes). */
export function snapInchQuarter(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 4) / 4;
}

export function normalizeDimensions(
  d?: Partial<EquipmentDimensions> | null,
): EquipmentDimensions | null {
  if (!d) return null;
  const widthIn = snapInchQuarter(Number(d.widthIn) || 0);
  const depthIn = snapInchQuarter(Number(d.depthIn) || 0);
  const heightIn = snapInchQuarter(Number(d.heightIn) || 0);
  if (!widthIn && !depthIn && !heightIn) return null;
  return { widthIn, depthIn, heightIn };
}

/**
 * Format inches as whole + 0, 1/4, 1/2, 3/4 only.
 * e.g. 21.25 → 21¼", 17.5 → 17½", 35 → 35"
 */
export function formatInches(n: number): string {
  const v = snapInchQuarter(n);
  if (v <= 0) return "—";
  const whole = Math.floor(v + 1e-9);
  const frac = Math.round((v - whole) * 4);
  const fracStr =
    frac === 1 ? "¼" : frac === 2 ? "½" : frac === 3 ? "¾" : "";
  if (!whole && fracStr) return `${fracStr}"`;
  if (fracStr) return `${whole}${fracStr}"`;
  return `${whole}"`;
}

/** W × D × H string for lists / packets. */
export function formatDimensions(d?: EquipmentDimensions | null): string {
  const n = normalizeDimensions(d);
  if (!n) return "";
  return `${formatInches(n.widthIn)} W × ${formatInches(n.depthIn)} D × ${formatInches(n.heightIn)} H`;
}

/**
 * Soft caution when any axis is large for residential access
 * (attic stairs, hallways, furnace closets). Not a hard block.
 */
export function dimensionCaution(
  d?: EquipmentDimensions | null,
): string | null {
  const n = normalizeDimensions(d);
  if (!n) return null;
  const max = Math.max(n.widthIn, n.depthIn, n.heightIn);
  const notes: string[] = [];
  if (max >= 48) {
    notes.push(
      "Large cabinet (≥48\") — confirm path of travel and staging before install day.",
    );
  } else if (max >= 36) {
    notes.push(
      "Tall/wide unit (≥36\") — check closet, attic hatch, and stair clearances.",
    );
  }
  // Footprint (W×D) for outdoor pad / platform
  const footprint = n.widthIn * n.depthIn;
  if (footprint >= 900) {
    notes.push(
      "Large footprint — verify pad/platform and service clearances (uniform inches).",
    );
  }
  return notes.length ? notes.join(" ") : null;
}

/** Rough residential cabinet defaults by kind (inches, already ¼-friendly). */
export function defaultDimensionsForKind(
  kind: string | null | undefined,
  tonnageHint?: number,
): EquipmentDimensions | null {
  const t = tonnageHint && tonnageHint > 0 ? tonnageHint : 3;
  switch (kind) {
    case "furnace":
      // Typical 80% gas furnace cabinet grows slightly with capacity class
      return {
        widthIn: t >= 4 ? 21 : 17.5,
        depthIn: 28.5,
        heightIn: t >= 4 ? 34.5 : 33.75,
      };
    case "air_handler":
      return {
        widthIn: t >= 4 ? 24.5 : 21.125,
        depthIn: 22,
        heightIn: t >= 4 ? 53.5 : 49.5,
      };
    case "heat_pump":
    case "ac":
      // Outdoor condenser / heat pump — square footprint class
      return {
        widthIn: t >= 4 ? 35.5 : t >= 3 ? 31.25 : 29.125,
        depthIn: t >= 4 ? 35.5 : t >= 3 ? 31.25 : 29.125,
        heightIn: t >= 4 ? 38.75 : 32.875,
      };
    case "ductless":
      // Outdoor multi/single-zone mini-split (approx class)
      return {
        widthIn: t >= 3 ? 37.5 : 31.5,
        depthIn: t >= 3 ? 13 : 11.25,
        heightIn: t >= 3 ? 31.5 : 21.625,
      };
    default:
      return null;
  }
}

/** Resolve W×D×H for advisor prompts — catalog first, then family defaults. */
export function resolveDisplayDimensions(
  product?: {
    name?: string;
    sku?: string;
    dimensions?: EquipmentDimensions | null;
    capacityValue?: number | null;
    familyId?: string;
    equipmentKind?: string;
    installFootprint?: string | null;
  } | null,
): EquipmentDimensions | null {
  const fromProduct = normalizeDimensions(product?.dimensions);
  if (fromProduct) return fromProduct;
  if (!product) return null;
  const family = product.familyId || product.equipmentKind || "";
  const cap = Number(product.capacityValue) || 0;
  const blob = `${product.name || ""} ${product.sku || ""}`.toLowerCase();
  const isWh =
    family === "water_heater" ||
    product.installFootprint === "tank" ||
    product.installFootprint === "hpwh";
  if (isWh) {
    if (
      product.installFootprint === "hpwh" ||
      /hybrid|hpwh|heat.?pump/.test(blob)
    ) {
      return hpwhDims(cap || 50);
    }
    return tankWaterHeaterDims(cap || 50);
  }
  if (family === "furnace") return furnaceCabinetDims(cap || 80000);
  if (family === "air_handler") return airHandlerCabinetDims(cap || 3);
  return defaultDimensionsForKind(family, cap || undefined);
}

/** Advisor-facing short name for fit questions. */
function fitEquipmentNoun(product?: {
  name?: string;
  sku?: string;
  familyId?: string;
  capacityValue?: number | null;
  installFootprint?: string | null;
  equipmentKind?: string;
} | null): string {
  if (!product) return "";
  const blob = `${product.name || ""} ${product.sku || ""} ${product.familyId || ""} ${product.installFootprint || ""}`;
  const cap = Number(product.capacityValue) || 0;
  const brand = /a\.?\s*o\.?\s*smith|aos-/i.test(blob)
    ? "A. O. Smith"
    : /navien/i.test(blob)
      ? "Navien"
      : /rheem/i.test(blob)
        ? "Rheem"
        : /williams/i.test(blob)
          ? "Williams"
          : /carrier/i.test(blob)
            ? "Carrier"
            : /bosch/i.test(blob)
              ? "Bosch"
              : /goodman/i.test(blob)
                ? "Goodman"
                : /rinnai/i.test(blob)
                  ? "Rinnai"
                  : "";
  const fam = (product.familyId || product.equipmentKind || "").toLowerCase();
  if (fam === "water_heater" || /water.?heat|hpwh|tankless|proline/i.test(blob)) {
    const gal =
      cap ||
      Number((blob.match(/(\d{2,3})\s*gal/i) || [])[1]) ||
      0;
    if (/hybrid|hpwh|voltex/i.test(blob) || product.installFootprint === "hpwh")
      return [gal ? `${gal}-gallon` : "", brand, "heat pump water heater"]
        .filter(Boolean)
        .join(" ");
    if (/tankless/i.test(blob))
      return [brand, "tankless water heater"].filter(Boolean).join(" ");
    if (/electric/i.test(blob))
      return [gal ? `${gal}-gallon` : "", brand, "electric tank"]
        .filter(Boolean)
        .join(" ");
    return [gal ? `${gal}-gallon` : "", brand, "gas tank"]
      .filter(Boolean)
      .join(" ");
  }
  if (fam === "wall_heater" || /wall.?heat|monterey/i.test(blob)) {
    const k = cap >= 1000 ? Math.round(cap / 1000) : cap;
    return [brand, k ? `${k}k` : "", "wall heater"].filter(Boolean).join(" ");
  }
  if (fam === "furnace") {
    const k = cap >= 1000 ? Math.round(cap / 1000) : cap;
    return [brand, k ? `${k}k` : "", "furnace"].filter(Boolean).join(" ");
  }
  if (fam === "heat_pump") {
    return [brand, cap ? `${cap}-ton` : "", "heat pump"]
      .filter(Boolean)
      .join(" ");
  }
  if (fam === "air_handler") {
    return [brand, cap ? `${cap}-ton` : "", "air handler"]
      .filter(Boolean)
      .join(" ");
  }
  if (fam === "ac") {
    return [brand, cap ? `${cap}-ton` : "", "air conditioner"]
      .filter(Boolean)
      .join(" ");
  }
  return (product.name || "").trim();
}

/** Advisor prompt: keep fit questions short. Long product name lives on the card. */
export function promptWithProductSize(
  prompt: string,
  questionId: string,
  product?: {
    name?: string;
    sku?: string;
    dimensions?: EquipmentDimensions | null;
    capacityValue?: number | null;
    familyId?: string;
    equipmentKind?: string;
    installFootprint?: string | null;
  } | null,
  opts?: { long?: boolean },
): string {
  if (questionId !== "equipment_access" && questionId !== "cabinet_fit") {
    return prompt;
  }
  const noun = fitEquipmentNoun(product);
  if (!opts?.long) {
    return noun
      ? `Will this ${noun} fit the path in?`
      : "Will this unit fit the path in?";
  }
  const dim = formatDimensions(resolveDisplayDimensions(product));
  const name = (product?.name || "").trim();
  const kindNoun =
    questionId === "cabinet_fit" &&
    (product?.familyId === "water_heater" ||
      product?.installFootprint === "tank" ||
      product?.installFootprint === "hpwh")
      ? "tank"
      : "cabinet";
  if (name && dim) {
    return `Will ${name} (${dim}) fit through the opening and path?`;
  }
  if (dim) {
    return `This ${kindNoun} is ${dim}. Do you have an opening and path that will pass it?`;
  }
  if (name) {
    return `Will ${name} fit through the opening and path?`;
  }
  return prompt;
}

/** Option SKUs attached to a measure (same-path upgrades). */
export function optionProductsFromSelections(
  selectedIds: string[] | undefined,
  main: { id: string; sku?: string } | null | undefined,
  products: { id: string; sku?: string; name?: string; dimensions?: EquipmentDimensions | null }[],
): typeof products {
  if (!selectedIds?.length || !main) return [];
  const out: typeof products = [];
  for (const oid of selectedIds) {
    const p = products.find((x) => {
      if (x.id === main.id) return false;
      const sku = (x.sku || "").trim();
      if (sku.length > 2 && oid.includes(sku)) return true;
      if (oid.includes(x.id)) return true;
      return false;
    });
    if (p && !out.some((y) => y.id === p.id)) out.push(p);
  }
  return out;
}

export function dimGrowNote(
  main?: EquipmentDimensions | null,
  opt?: EquipmentDimensions | null,
): string {
  const a = normalizeDimensions(main);
  const b = normalizeDimensions(opt);
  if (!a || !b) return "";
  const bits: string[] = [];
  const dw = b.widthIn - a.widthIn;
  const dd = b.depthIn - a.depthIn;
  const dh = b.heightIn - a.heightIn;
  if (dw > 0.2) bits.push(`+${formatInches(dw)} W`);
  if (dd > 0.2) bits.push(`+${formatInches(dd)} D`);
  if (dh > 0.2) bits.push(`+${formatInches(dh)} H`);
  return bits.join(" ");
}

/** A. O. Smith-style ULN gas tank (cylinder). */
export function tankWaterHeaterDims(gallons: number): EquipmentDimensions {
  const g = Number(gallons) || 50;
  if (g <= 40) return { widthIn: 20, depthIn: 20, heightIn: 58.25 };
  if (g <= 50) return { widthIn: 21, depthIn: 21, heightIn: 60.75 };
  if (g <= 65) return { widthIn: 24, depthIn: 24, heightIn: 61 };
  return { widthIn: 26, depthIn: 26, heightIn: 62.75 };
}

/** Hybrid / heat-pump water heater by gallon. */
export function hpwhDims(gallons: number): EquipmentDimensions {
  const g = Number(gallons) || 50;
  if (g <= 50) return { widthIn: 22, depthIn: 22, heightIn: 63 };
  if (g <= 66) return { widthIn: 24, depthIn: 24, heightIn: 65 };
  return { widthIn: 27, depthIn: 27, heightIn: 70.63 };
}

/** Navien NWP500 heat pump water heater. */
export function navienNwpDims(gallons: number): EquipmentDimensions {
  const g = Number(gallons) || 50;
  if (g <= 50) return { widthIn: 21.7, depthIn: 21.7, heightIn: 63 };
  if (g <= 65) return { widthIn: 25, depthIn: 25, heightIn: 63 };
  return { widthIn: 25, depthIn: 25, heightIn: 71.6 };
}
export function navienNpe2Dims(): EquipmentDimensions {
  return { widthIn: 17.3, depthIn: 11.4, heightIn: 27.4 };
}

/** Navien NAZ / similar side-discharge heat pump by tons. */
export function navienNazDims(tons: number): EquipmentDimensions {
  const t = Number(tons) || 3;
  if (t <= 2) return { widthIn: 35.5, depthIn: 13.4, heightIn: 24.8 };
  if (t <= 3) return { widthIn: 35.5, depthIn: 13.4, heightIn: 31.5 };
  if (t <= 4) return { widthIn: 37.4, depthIn: 13.8, heightIn: 36.2 };
  return { widthIn: 37.4, depthIn: 13.8, heightIn: 39.4 };
}

/** Residential furnace cabinet by input kBTU. */
export function furnaceCabinetDims(btu: number): EquipmentDimensions {
  const k = Number(btu) || 80000;
  if (k <= 60000) return { widthIn: 14.5, depthIn: 29, heightIn: 33.75 };
  if (k <= 80000) return { widthIn: 17.5, depthIn: 29, heightIn: 33.75 };
  if (k <= 100000) return { widthIn: 21, depthIn: 29, heightIn: 33.75 };
  return { widthIn: 24.5, depthIn: 29, heightIn: 33.75 };
}

/** Air handler cabinet by tons. */
export function airHandlerCabinetDims(tons: number): EquipmentDimensions {
  const t = Number(tons) || 3;
  if (t <= 2) return { widthIn: 17.5, depthIn: 21, heightIn: 45 };
  if (t <= 3) return { widthIn: 21, depthIn: 21, heightIn: 49 };
  if (t <= 4) return { widthIn: 21, depthIn: 21, heightIn: 53 };
  return { widthIn: 24.5, depthIn: 21, heightIn: 59 };
}

/** Slim / side-discharge outdoor (Carrier Performance, similar). */
export function slimOutdoorDims(tons: number): EquipmentDimensions {
  const t = Number(tons) || 3;
  if (t <= 2) return { widthIn: 35.5, depthIn: 13.4, heightIn: 24.9 };
  if (t <= 3) return { widthIn: 35.5, depthIn: 13.4, heightIn: 31.9 };
  if (t <= 4) return { widthIn: 37.4, depthIn: 13.8, heightIn: 36.2 };
  return { widthIn: 37.4, depthIn: 13.8, heightIn: 39.8 };
}

/** Bosch IDS outdoor cube-ish / compact. */
export function boschIdsDims(tons: number): EquipmentDimensions {
  const t = Number(tons) || 3;
  if (t <= 2) return { widthIn: 29.1, depthIn: 12.8, heightIn: 27.6 };
  if (t <= 3) return { widthIn: 37, depthIn: 13.8, heightIn: 31.1 };
  if (t <= 4) return { widthIn: 37, depthIn: 13.8, heightIn: 36.2 };
  return { widthIn: 37, depthIn: 13.8, heightIn: 49.2 };
}

/** Gravity / atmos flue height for tank water heaters. */
export function formatFlueHeight(inches?: number | null): string {
  const n = Number(inches);
  if (!Number.isFinite(n) || n <= 0) return "";
  return `${formatInches(n)} flue`;
}
