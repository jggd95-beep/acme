/**
 * Equipment staging compatibility (single vs two-stage vs variable).
 * Prevents pairing simple single-stage gear with multi-stage / communicating
 * equipment that will not work as a matched system.
 */
import type { Product, ProductOption } from "./proposal-types";
import { buildTierUpgradeOptions } from "./proposal-types";

export type EquipmentStaging = "single" | "two_stage" | "variable";

const STAGE_RANK: Record<EquipmentStaging, number> = {
  single: 1,
  two_stage: 2,
  variable: 3,
};

export function productStaging(p: Product): EquipmentStaging {
  const blob = `${p.tierLabel || ""} ${p.name || ""} ${p.description || ""} ${
    p.category || ""
  }`.toLowerCase();
  if (
    p.tier === 3 ||
    /variable|infinity|inverter|communicat|hyper-?heating|modulating/.test(
      blob,
    )
  ) {
    return "variable";
  }
  if (
    p.tier === 2 ||
    /two-?\s*stage|multi-?\s*stage|performance/.test(blob)
  ) {
    return "two_stage";
  }
  return "single";
}

export function stagingLabel(s: EquipmentStaging): string {
  if (s === "variable") return "variable-speed / communicating";
  if (s === "two_stage") return "two-stage / multi-stage";
  return "single-stage";
}

export function stagingCompatible(
  a: EquipmentStaging,
  b: EquipmentStaging,
): boolean {
  return a === b;
}

/** Effective staging after nested tier-upgrade options are applied. */
export function effectiveStaging(
  product: Product,
  selectedOptionIds: string[] | undefined,
  catalog: Product[],
): EquipmentStaging {
  let staging = productStaging(product);
  const tierOpts = buildTierUpgradeOptions(product, catalog);
  const allOpts = [...(product.options || []), ...tierOpts];
  for (const id of selectedOptionIds || []) {
    const o = allOpts.find((x) => x.id === id);
    if (!o || o.kind !== "tier_upgrade" || !o.upgradeSku) continue;
    const up =
      catalog.find((p) => p.sku === o.upgradeSku) ||
      catalog.find((p) => p.id === o.upgradeSku);
    if (up) staging = productStaging(up);
  }
  return staging;
}

/**
 * Families that must stage-match each other on a matched system.
 * heat_pump ↔ air_handler; ac ↔ furnace; ac ↔ air_handler.
 */
export function partnerFamiliesFor(family: string): string[] {
  switch (family) {
    case "heat_pump":
      return ["air_handler"];
    case "air_handler":
      return ["heat_pump", "ac"];
    case "ac":
      return ["furnace", "air_handler"];
    case "furnace":
      return ["ac"];
    default:
      return [];
  }
}

export function isStagedClimateProduct(p: Product): boolean {
  const k = p.equipmentKind;
  return (
    k === "heat_pump" ||
    k === "air_handler" ||
    k === "ac" ||
    k === "furnace" ||
    k === "ductless"
  );
}

/**
 * When outdoor upgrades to multi-stage, try to auto-select a matching
 * tier upgrade on the partner (same staging). Returns option id or null.
 */
export function matchingTierUpgradeId(
  partner: Product,
  targetStaging: EquipmentStaging,
  catalog: Product[],
): string | null {
  if (productStaging(partner) === targetStaging) return null;
  const opts = buildTierUpgradeOptions(partner, catalog);
  const hit = opts.find((o) => {
    if (!o.upgradeSku) return false;
    const up = catalog.find((p) => p.sku === o.upgradeSku);
    return up ? productStaging(up) === targetStaging : false;
  });
  return hit?.id || null;
}

/**
 * Keep tier upgrades that either match partner staging already, or can be
 * auto-synced on the partner. Hide upgrades that would leave a partner
 * stuck on incompatible staging with no matching option.
 */
export function filterTierUpgradesForPartners(
  base: Product,
  tierOpts: ProductOption[],
  partners: { product: Product; staging: EquipmentStaging }[],
  catalog: Product[],
): ProductOption[] {
  void base;
  if (!partners.length) return tierOpts;
  return tierOpts.filter((o) => {
    if (o.kind !== "tier_upgrade" || !o.upgradeSku) return true;
    const up =
      catalog.find((p) => p.sku === o.upgradeSku) ||
      catalog.find((p) => p.id === o.upgradeSku);
    if (!up) return false;
    const target = productStaging(up);
    return partners.every(({ product, staging }) => {
      if (stagingCompatible(staging, target)) return true;
      if (stagingCompatible(productStaging(product), target)) return true;
      return matchingTierUpgradeId(product, target, catalog) != null;
    });
  });
}

/** Filter catalog models so only staging-compatible gear is listed. */
export function filterProductsByPartnerStaging(
  list: Product[],
  partnerStagings: EquipmentStaging[],
): Product[] {
  if (!partnerStagings.length) return list;
  const partnerStage = partnerStagings.reduce((min, s) =>
    STAGE_RANK[s] < STAGE_RANK[min] ? s : min,
  );
  return list.filter((p) => {
    if (!isStagedClimateProduct(p)) return true;
    return stagingCompatible(productStaging(p), partnerStage);
  });
}
