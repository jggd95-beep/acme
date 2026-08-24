import type { Product } from "./proposal-types";
import { isDuctlessProduct } from "./equipment-catalog";

/**
 * Primary heating path for a job.
 * Filters catalog so sales aren't flooded with the wrong system type —
 * full catalog stays available via "Show all products".
 */
export type HeatingPath =
  | "furnace"
  | "heat_pump"
  | "heat_pump_conversion"
  | "all";

export const HEATING_PATH_OPTIONS: {
  id: HeatingPath;
  label: string;
  short: string;
  blurb: string;
}[] = [
  {
    id: "furnace",
    label: "Gas furnace",
    short: "Furnace",
    blurb:
      "Gas heat + AC package — show furnaces & ACs; hide heat pumps in the main list.",
  },
  {
    id: "heat_pump",
    label: "Heat pump",
    short: "Heat pump",
    blurb:
      "Heat pump does heat + cool — show heat pumps & air handlers; hide gas furnaces and ACs.",
  },
  {
    id: "heat_pump_conversion",
    label: "Heat pump conversion (from gas)",
    short: "HP conversion",
    blurb:
      "Leaving gas for a heat pump — heat pumps, air handlers, conversion guide; no furnace or AC in the main list (water heaters still OK).",
  },
  {
    id: "all",
    label: "Show all products",
    short: "All",
    blurb: "No system filter — full catalog for mixed or special jobs.",
  },
];

export function isFurnaceProduct(p: Product): boolean {
  if (p.equipmentKind === "furnace") return true;
  const blob = `${p.name} ${p.category} ${p.sku}`.toLowerCase();
  // Don't treat heat pumps as furnaces
  if (isHeatPumpProduct(p)) return false;
  return (
    /\bfurnace\b/.test(blob) ||
    /\bgas heat\b/.test(blob) ||
    (/heating\s*·/.test(blob) && !/heat\s*pump/.test(blob))
  );
}

export function isHeatPumpProduct(p: Product): boolean {
  // Ductless mini-splits are their own category — not ducted "heat pump" measures
  if (isDuctlessProduct(p)) return false;
  if (p.equipmentKind === "heat_pump") return true;
  const blob = `${p.name} ${p.category} ${p.sku}`.toLowerCase();
  return (
    /heat\s*pump/.test(blob) ||
    /\bhsp\b/.test(blob) ||
    (/inverter/.test(blob) && /heat/.test(blob) && !/furnace/.test(blob))
  );
}

/** Cooling-only outdoor units (not heat pumps). */
export function isAcProduct(p: Product): boolean {
  if (p.equipmentKind === "ac") return true;
  if (isHeatPumpProduct(p)) return false;
  const blob = `${p.name} ${p.category} ${p.sku}`.toLowerCase();
  return (
    /air conditioner/.test(blob) ||
    /\bac\b/.test(blob) ||
    /cooling\s*·/.test(blob) ||
    /^car-26/.test(blob) || // Carrier residential AC outdoor families
    /^ac-/.test(p.sku.toLowerCase())
  );
}

export function isAirHandlerProduct(p: Product): boolean {
  if (p.equipmentKind === "air_handler") return true;
  const blob = `${p.name} ${p.category} ${p.sku}`.toLowerCase();
  return /air handler|fan coil|fan-coil/.test(blob);
}

export function isWaterHeaterProduct(p: Product): boolean {
  // HVAC kinds are never water heaters — Navien NAZ/NAS/NPF must not match here
  if (
    p.equipmentKind === "heat_pump" ||
    p.equipmentKind === "air_handler" ||
    p.equipmentKind === "furnace" ||
    p.equipmentKind === "ac" ||
    p.equipmentKind === "ductless"
  ) {
    return false;
  }
  const blob = `${p.name} ${p.category} ${p.sku}`.toLowerCase();
  return (
    /water heater|tankless|hot water|aquanta/.test(blob) ||
    (/navien/.test(blob) && /water|tankless|boiler/.test(blob)) ||
    catIncludes(p.category, "hot water") ||
    catIncludes(p.category, "water")
  );
}

function catIncludes(cat: string, s: string) {
  return (cat || "").toLowerCase().includes(s);
}

/**
 * Equipment that the heating path can hide/show (not services like install).
 */
export function isPathFilteredEquipment(p: Product): boolean {
  return (
    isFurnaceProduct(p) ||
    isHeatPumpProduct(p) ||
    isAcProduct(p) ||
    isAirHandlerProduct(p) ||
    isDuctlessProduct(p)
  );
}

/**
 * Products visible in the primary picker for this path.
 * Path "all" / showAll → everything.
 *
 * furnace path: furnaces + ACs + air handlers (+ non-equipment always)
 * heat pump / conversion: ducted heat pumps + air handlers (no furnace/AC)
 *   Ductless is its own measure type — always allowed when browsing all, but
 *   not mixed into the ducted heat-pump list.
 */
export function productVisibleForHeatingPath(
  p: Product,
  path: HeatingPath,
  opts?: { showAll?: boolean },
): boolean {
  if (opts?.showAll || path === "all") return true;

  // Services, filters, stats, water heaters, conversion education, etc.
  if (!isPathFilteredEquipment(p)) return true;

  // Ductless never rides under furnace or ducted-HP path filters as "main" equip —
  // still visible when path is all; for other paths sales enable the Ductless measure type
  // which bypasses this in the package step. Hide on pure furnace path.
  if (isDuctlessProduct(p)) {
    if (path === "furnace") return false;
    // On heat pump paths, still hide from generic lists; ductless family shows them.
    return false;
  }

  if (path === "furnace") {
    if (isHeatPumpProduct(p)) return false;
    return isFurnaceProduct(p) || isAcProduct(p) || isAirHandlerProduct(p);
  }

  if (path === "heat_pump" || path === "heat_pump_conversion") {
    if (isFurnaceProduct(p)) return false;
    if (isAcProduct(p)) return false;
    return isHeatPumpProduct(p) || isAirHandlerProduct(p);
  }

  return true;
}

/**
 * Higher-tier equipment (Performance / Infinity) used to be nested-only upgrades.
 * Advisors need every tier as a full selectable model on the measure list —
 * upgrade options remain as a convenience after a base pick.
 * Always returns false so nothing is hidden from the main list.
 */
export function isHigherTierOnlyAsOption(
  _p: Product,
  _catalog: Product[],
): boolean {
  return false;
}

/** @deprecated use isPathFilteredEquipment — kept for older imports */
export function isHeatingEquipment(p: Product): boolean {
  return isFurnaceProduct(p) || isHeatPumpProduct(p) || isAcProduct(p);
}

export function filterProductsByHeatingPath(
  products: Product[],
  path: HeatingPath,
  opts?: {
    showAll?: boolean;
    /** Kept for API compatibility — higher tiers always list as main products now */
    allowHigherTiers?: boolean;
  },
): Product[] {
  return products.filter((p) => {
    if (!productVisibleForHeatingPath(p, path, opts)) return false;
    // Higher tiers (two-stage Performance, Infinity, etc.) always appear as
    // standalone selectable products — not only as nested options.
    return true;
  });
}

export function heatingPathLabel(path: HeatingPath): string {
  return HEATING_PATH_OPTIONS.find((o) => o.id === path)?.label || path;
}

/** Education measure for gas → heat pump conversions. */
export const HP_CONVERSION_GUIDE_SKU = "SVC-HP-VS-GAS";

/** Education measure for heat pump water heater expectations. */
export const HPWH_EXPECT_SKU = "SVC-HPWH-EXPECT";

/** Prefer SKUs when applying recommendations for a path. */
export function preferredSkusForHeatingPath(
  path: HeatingPath,
  tonnage: number = 3,
): string[] {
  const slug = String(tonnage).replace(".", "p").toUpperCase();
  if (path === "furnace") {
    return [
      "CAR-58SB1B",
      "CAR-26SCA5",
      "CAR-AH-" + slug + "-COM",
      "SVC-LOAD",
      "SVC-INSTALL",
      "SVC-PERMIT",
      "SVC-HERS",
    ];
  }
  if (path === "heat_pump") {
    return [
      `CAR-HP-${slug}-COM`,
      `CAR-AH-${slug}-COM`,
      "SVC-LOAD",
      "SVC-INSTALL",
      "SVC-PERMIT",
      "SVC-HERS",
    ];
  }
  if (path === "heat_pump_conversion") {
    return [
      `CAR-HP-${slug}-COM`,
      HP_CONVERSION_GUIDE_SKU,
      `CAR-AH-${slug}-COM`,
      "SVC-LOAD",
      "SVC-INSTALL",
      "SVC-DUCT",
      "SVC-PERMIT",
      "SVC-HERS",
    ];
  }
  return [];
}

/** SKUs that must never stay on a heat-pump path (AC / gas furnace). */
export function incompatibleSkusForPath(path: HeatingPath): string[] {
  if (path === "heat_pump" || path === "heat_pump_conversion") {
    return [
      "CAR-26SCA5",
      "CAR-26TPA8",
      "CAR-26VNA1",
      "CAR-58SB1B",
      "CAR-58TP1B",
      "CAR-58TN1B",
      "AC-16SEER",
      "FUR-96AFUE",
    ];
  }
  if (path === "furnace") {
    return [
      "CAR-27SCA5",
      "CAR-27TPA8",
      "CAR-27VNA0",
      "MIT-MS-GEN",
      "MIT-MS-HYPER",
      "BOS-IDS-GEN",
      "HP-18SEER",
      HP_CONVERSION_GUIDE_SKU,
    ];
  }
  return [];
}
